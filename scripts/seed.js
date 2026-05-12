/**
 * seed.js — Full database reset and seed
 *
 * 1. Deletes all Cloudinary assets tied to existing products
 * 2. Clears every MongoDB collection
 * 3. Creates admin
 * 4. Uploads products from scripts/products/
 * 5. Creates 12 test customers (test@test.com … test12@test.com, password: 123456)
 * 6. Creates orders across customers
 * 7. Creates reviews — both verified purchases and unverified
 *
 * Usage: npm run seed:all
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { env } = require('../nodemon.json');
Object.assign(process.env, env);

const cloudinary = require('../util/cloudinary');
const Admin = require('../models/admin');
const Product = require('../models/product');
const User = require('../models/user');
const Order = require('../models/order');
const Review = require('../models/review');

const PRODUCTS_DIR = path.join(__dirname, 'products');
const CUSTOMER_PASSWORD = '123456';

// Stock levels per product — covers all UI states: out of stock (0), low (1–5), normal (6+)
const STOCK_MAP = {
  'macbook-pro-m3-16-2024':  0,   // out of stock
  'sony-ps5':                3,   // low stock
  'ikea-kallax-147x147':     15,
  'ikea-vittsjo':            2,   // low stock
  'ikea-nockeby':            0,   // out of stock
  'air-zoom-citizen-1999':   12,
  'mercurial-vapor-iv':      4,   // low stock
  'tiempo-legend-2014':      8,
  'mercurial-ic-2014':       1,   // low stock
};

// ── Product upload helpers (shared with seed-glb-products.js) ────────────────

function parseMeta(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const meta = {};
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key && value) meta[key] = value;
  }
  const missing = ['title', 'price', 'category', 'description'].filter(k => !meta[k]);
  if (missing.length) throw new Error(`meta.txt missing fields: ${missing.join(', ')}`);
  return {
    title: meta.title,
    price: parseFloat(meta.price),
    category: meta.category.toLowerCase(),
    description: meta.description,
    stock: meta.stock ? parseInt(meta.stock, 10) : 10,
  };
}

async function uploadImage(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'noblecart',
    resource_type: 'image',
  });
  return { url: result.secure_url, publicId: result.public_id };
}

function uploadModel(filePath) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, {
      folder: 'noblecart-models',
      resource_type: 'raw',
      format: 'glb',
      use_filename: true,
      unique_filename: true,
    }, (error, result) => {
      if (error) return reject(error);
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
  });
}

function findFile(dir, names) {
  for (const name of names) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function captureGlbThumbnail(glbPath) {
  const puppeteer = require('puppeteer');
  const glbBuffer = fs.readFileSync(glbPath);
  const server = http.createServer((req, res) => {
    if (req.url === '/model.glb') {
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
      return res.end(glbBuffer);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html><html><head><style>*{margin:0;padding:0;}body{background:#eef2f6;width:600px;height:600px;overflow:hidden;}model-viewer{width:600px;height:600px;--progress-bar-color:transparent;}</style></head><body><model-viewer src="/model.glb" camera-controls interaction-prompt="none" ar-modes="" style="width:600px;height:600px;"></model-viewer><script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 600 });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(
    () => document.querySelector('model-viewer')?.loaded === true,
    { timeout: 60000 }
  );
  await new Promise(resolve => setTimeout(resolve, 2000));
  const screenshot = await page.screenshot({ type: 'png' });
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  const tmpPath = path.join(os.tmpdir(), `glb-thumb-${Date.now()}.png`);
  fs.writeFileSync(tmpPath, screenshot);
  return tmpPath;
}

// ── Order helpers ─────────────────────────────────────────────────────────────

function buildStatusHistory(finalStatus) {
  const chain = ['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered'];
  const idx = chain.indexOf(finalStatus);
  if (idx === -1) return [{ status: finalStatus, timestamp: new Date() }];
  const now = Date.now();
  return chain.slice(0, idx + 1).map((status, i) => ({
    status,
    timestamp: new Date(now - (idx - i) * 24 * 60 * 60 * 1000),
  }));
}

function makeOrder(user, items, status) {
  return Order.create({
    user: { email: user.email, userId: user._id },
    products: items.map(({ product, quantity }) => ({
      productData: { ...product.toObject() },
      quantity,
    })),
    status,
    statusHistory: buildStatusHistory(status),
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB\n');

  // Step 1: Clear Cloudinary assets
  console.log('── Clearing Cloudinary assets…');
  const existingProducts = await Product.find({});
  const imageIds = existingProducts.map(p => p.imagePublicId).filter(Boolean);
  const modelIds = existingProducts.map(p => p.modelPublicId).filter(Boolean);
  if (imageIds.length) {
    await cloudinary.api.delete_resources(imageIds);
    console.log(`  Deleted ${imageIds.length} image(s)`);
  }
  if (modelIds.length) {
    await cloudinary.api.delete_resources(modelIds, { resource_type: 'raw' });
    console.log(`  Deleted ${modelIds.length} model(s)`);
  }
  if (!imageIds.length && !modelIds.length) console.log('  Nothing to delete');

  // Step 2: Clear all collections
  console.log('\n── Clearing database…');
  await Promise.all([
    Admin.deleteMany({}),
    Product.deleteMany({}),
    User.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
  ]);
  console.log('  All collections cleared');

  // Step 3: Create admin
  console.log('\n── Creating admin…');
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  const admin = await Admin.create({ email: process.env.ADMIN_EMAIL, password: adminHash });
  console.log(`  ✓ ${admin.email}`);

  // Step 4: Seed products
  console.log('\n── Seeding products…');
  const productEntries = [];
  for (const genre of fs.readdirSync(PRODUCTS_DIR).sort()) {
    const genrePath = path.join(PRODUCTS_DIR, genre);
    if (!fs.statSync(genrePath).isDirectory()) continue;
    for (const slug of fs.readdirSync(genrePath).sort()) {
      const slugPath = path.join(genrePath, slug);
      if (fs.statSync(slugPath).isDirectory()) productEntries.push({ slug, dir: slugPath });
    }
  }

  const productMap = {};
  for (const { slug, dir } of productEntries) {
    const metaPath = path.join(dir, 'meta.txt');
    if (!fs.existsSync(metaPath)) { console.warn(`  Skipping ${slug} — no meta.txt`); continue; }

    const meta = parseMeta(metaPath);
    if (slug in STOCK_MAP) meta.stock = STOCK_MAP[slug];
    const doc = { ...meta, adminId: admin._id, imageUrl: '', imagePublicId: '' };

    const modelPath = findFile(dir, ['model.glb']);
    if (modelPath) {
      process.stdout.write(`  [${slug}] Uploading GLB… `);
      const { url, publicId } = await uploadModel(modelPath);
      doc.modelUrl = url;
      doc.modelPublicId = publicId;
      console.log('done');
    }

    let imagePath = findFile(dir, ['image.png', 'image.jpg', 'image.jpeg', 'image.webp']);
    let tmpThumb = null;
    if (!imagePath && modelPath) {
      process.stdout.write(`  [${slug}] Capturing GLB thumbnail… `);
      try {
        tmpThumb = await captureGlbThumbnail(modelPath);
        imagePath = tmpThumb;
      } catch (e) {
        console.warn(`\n  ⚠ Thumbnail capture failed for ${slug} — add an image.png manually`);
      }
      console.log('done');
    }
    if (!imagePath) { console.warn(`  Skipping ${slug} — no image or GLB`); continue; }

    process.stdout.write(`  [${slug}] Uploading image… `);
    const { url, publicId } = await uploadImage(imagePath);
    doc.imageUrl = url;
    doc.imagePublicId = publicId;
    console.log('done');
    if (tmpThumb) fs.unlinkSync(tmpThumb);

    productMap[slug] = await Product.create(doc);
    console.log(`  ✓ "${meta.title}"`);
  }

  // Step 5: Create customers
  console.log('\n── Creating customers…');
  const customerHash = await bcrypt.hash(CUSTOMER_PASSWORD, 12);
  const USERS = [
    {
      email: 'test@test.com', name: 'Alice Johnson',
      address: { label: 'Home', street: '350 Fifth Avenue', city: 'New York City', state: 'New York', stateCode: 'NY', zip: '10118', country: 'United States', countryCode: 'US' },
    },
    {
      email: 'test2@test.com', name: 'Bob Smith',
      address: { label: 'Home', street: '10 Downing Street', city: 'London', state: 'England', stateCode: 'ENG', zip: 'SW1A 2AA', country: 'United Kingdom', countryCode: 'GB' },
    },
    {
      email: 'test3@test.com', name: 'Carol White',
      address: { label: 'Home', street: '221B Baker Street', city: 'London', state: 'England', stateCode: 'ENG', zip: 'NW1 6XE', country: 'United Kingdom', countryCode: 'GB' },
    },
    {
      email: 'test4@test.com', name: 'David Lee',
      address: { label: 'Home', street: 'Bağdat Caddesi 100', city: 'Kadıköy', state: 'Istanbul', stateCode: '34', zip: '34710', country: 'Turkey', countryCode: 'TR' },
    },
    {
      email: 'test5@test.com', name: 'Eva Martinez',
      address: { label: 'Work', street: '1 Infinite Loop', city: 'Los Angeles', state: 'California', stateCode: 'CA', zip: '90001', country: 'United States', countryCode: 'US' },
    },
    {
      email: 'test6@test.com', name: 'Frank Brown',
      address: { label: 'Home', street: '55 Water Street', city: 'New York City', state: 'New York', stateCode: 'NY', zip: '10041', country: 'United States', countryCode: 'US' },
    },
    {
      email: 'test7@test.com', name: 'Grace Kim',
      address: { label: 'Home', street: '100 Queen Street West', city: 'Toronto', state: 'Ontario', stateCode: 'ON', zip: 'M5H 2N2', country: 'Canada', countryCode: 'CA' },
    },
    { email: 'test8@test.com',  name: 'Henry Davis'    },
    {
      email: 'test9@test.com', name: 'Isla Wilson',
      address: { label: 'Home', street: '1 Macquarie Street', city: 'Sydney', state: 'New South Wales', stateCode: 'NSW', zip: '2000', country: 'Australia', countryCode: 'AU' },
    },
    { email: 'test10@test.com', name: 'Jack Taylor'    },
    {
      email: 'test11@test.com', name: 'Karen Anderson',
      address: { label: 'Home', street: '233 S Wacker Drive', city: 'Chicago', state: 'Illinois', stateCode: 'IL', zip: '60606', country: 'United States', countryCode: 'US' },
    },
    { email: 'test12@test.com', name: 'Liam Thomas'    },
  ];

  const [u1, u2, u3, u4, u5, u6, u7, u8, u9, u10, u11, u12] = await Promise.all(
    USERS.map(({ email, name, address }) =>
      User.create({ email, name, password: customerHash, cart: { items: [] }, wishlist: [], ...(address ? { address } : {}) })
    )
  );
  [u1, u2, u3, u4, u5, u6, u7, u8, u9, u10, u11, u12].forEach(u => console.log(`  ✓ ${u.email}  (password: ${CUSTOMER_PASSWORD})`));

  // Step 6: Create orders
  console.log('\n── Creating orders…');
  const p = productMap; // shorthand

  const orders = await Promise.all([
    // u1 — bought MacBook (delivered) and PS5 (shipped)
    makeOrder(u1, [{ product: p['macbook-pro-m3-16-2024'], quantity: 1 }], 'delivered'),
    makeOrder(u1, [{ product: p['sony-ps5'], quantity: 1 }], 'shipped'),

    // u2 — bought Kallax (delivered) and Vittsjo + Air Zoom (confirmed)
    makeOrder(u2, [{ product: p['ikea-kallax-147x147'], quantity: 2 }], 'delivered'),
    makeOrder(u2, [{ product: p['ikea-vittsjo'], quantity: 1 }, { product: p['air-zoom-citizen-1999'], quantity: 1 }], 'confirmed'),

    // u3 — bought Vapor IV + Tiempo Legend (delivered)
    makeOrder(u3, [{ product: p['mercurial-vapor-iv'], quantity: 1 }, { product: p['tiempo-legend-2014'], quantity: 1 }], 'delivered'),

    // u4 — bought Nockeby (delivered) and MacBook (pending)
    makeOrder(u4, [{ product: p['ikea-nockeby'], quantity: 1 }], 'delivered'),
    makeOrder(u4, [{ product: p['macbook-pro-m3-16-2024'], quantity: 1 }], 'pending'),

    // u5 — bought PS5 + Mercurial IC (delivered), Kallax (out for delivery)
    makeOrder(u5, [{ product: p['sony-ps5'], quantity: 1 }], 'delivered'),
    makeOrder(u5, [{ product: p['mercurial-ic-2014'], quantity: 1 }], 'delivered'),
    makeOrder(u5, [{ product: p['ikea-kallax-147x147'], quantity: 1 }], 'out_for_delivery'),

    // u6 — bought Vittsjo + Nockeby (delivered), Air Zoom (confirmed)
    makeOrder(u6, [{ product: p['ikea-vittsjo'], quantity: 1 }, { product: p['ikea-nockeby'], quantity: 1 }], 'delivered'),
    makeOrder(u6, [{ product: p['air-zoom-citizen-1999'], quantity: 1 }], 'confirmed'),

    // u7 — bought Tiempo Legend + Vapor IV (delivered), MacBook (shipped)
    makeOrder(u7, [{ product: p['tiempo-legend-2014'], quantity: 1 }, { product: p['mercurial-vapor-iv'], quantity: 1 }], 'delivered'),
    makeOrder(u7, [{ product: p['macbook-pro-m3-16-2024'], quantity: 1 }], 'shipped'),

    // u8 — bought PS5 + Mercurial IC (delivered)
    makeOrder(u8, [{ product: p['sony-ps5'], quantity: 1 }, { product: p['mercurial-ic-2014'], quantity: 1 }], 'delivered'),

    // u9 — bought MacBook + PS5 (both delivered)
    makeOrder(u9, [{ product: p['macbook-pro-m3-16-2024'], quantity: 1 }], 'delivered'),
    makeOrder(u9, [{ product: p['sony-ps5'], quantity: 1 }], 'delivered'),

    // u10 — bought MacBook + Vapor IV (both delivered)
    makeOrder(u10, [{ product: p['macbook-pro-m3-16-2024'], quantity: 1 }], 'delivered'),
    makeOrder(u10, [{ product: p['mercurial-vapor-iv'], quantity: 1 }], 'delivered'),

    // u11 — bought PS5 + Tiempo Legend (both delivered)
    makeOrder(u11, [{ product: p['sony-ps5'], quantity: 1 }], 'delivered'),
    makeOrder(u11, [{ product: p['tiempo-legend-2014'], quantity: 1 }], 'delivered'),

    // u12 — bought MacBook + PS5 + Vapor IV (all delivered)
    makeOrder(u12, [{ product: p['macbook-pro-m3-16-2024'], quantity: 1 }], 'delivered'),
    makeOrder(u12, [{ product: p['sony-ps5'], quantity: 1 }], 'delivered'),
    makeOrder(u12, [{ product: p['mercurial-vapor-iv'], quantity: 1 }], 'delivered'),
  ]);
  console.log(`  ✓ ${orders.length} orders created`);

  // Step 7: Create reviews
  console.log('\n── Creating reviews…');

  const reviews = [
    // ── MacBook Pro ───────────────────────────────────────────────────────────
    { slug: 'macbook-pro-m3-16-2024', user: u1, rating: 5, verifiedPurchase: true,
      comment: "Absolutely incredible machine. The M3 chip handles everything I throw at it — video editing, Xcode builds, even running local AI models. Battery genuinely lasts all day. Best laptop I've ever owned." },
    { slug: 'macbook-pro-m3-16-2024', user: u2, rating: 2, verifiedPurchase: false,
      comment: "Overpriced for what it is. The base RAM isn't enough for serious workloads and you're paying the Apple premium for features that matter less than the spec sheet implies. Build quality is nice, value isn't." },
    { slug: 'macbook-pro-m3-16-2024', user: u7, rating: 5, verifiedPurchase: true,
      comment: "The performance leap over my old Intel MacBook is insane. Compiling large projects that used to take minutes now finish in seconds. The display is stunning and the battery life is real-world excellent." },
    { slug: 'macbook-pro-m3-16-2024', user: u5, rating: 4, verifiedPurchase: false,
      comment: "Genuinely great machine. My only gripe is the notch and the fact that upgrading RAM after purchase is impossible — plan ahead. If you need a workhorse laptop this is hard to beat." },
    { slug: 'macbook-pro-m3-16-2024', user: u6, rating: 3, verifiedPurchase: false,
      comment: "It's good but the price-to-spec ratio feels off compared to what Windows machines offer at this price point. The ecosystem lock-in is real. Great if you're already in the Apple world." },

    // ── PS5 ───────────────────────────────────────────────────────────────────
    { slug: 'sony-ps5', user: u1, rating: 4, verifiedPurchase: true,
      comment: "Great console — the SSD makes load times almost non-existent and DualSense haptics are genuinely impressive in supported games. Docking a star because the UI is still a confusing mess." },
    { slug: 'sony-ps5', user: u3, rating: 5, verifiedPurchase: false,
      comment: "The hardware is phenomenal. Spider-Man 2, Astro's Playroom — nothing else delivers this kind of experience right now. If you have a 4K TV this is a must-buy." },
    { slug: 'sony-ps5', user: u5, rating: 5, verifiedPurchase: true,
      comment: "Exactly what next-gen should feel like. The haptic feedback on the DualSense is the first genuinely new controller innovation in years. Game library is finally strong enough to justify the purchase." },
    { slug: 'sony-ps5', user: u8, rating: 3, verifiedPurchase: true,
      comment: "Hardware is undeniably impressive but the exclusive lineup is still thin if you're not into first-party Sony titles. Good console, but the value depends heavily on what you play." },
    { slug: 'sony-ps5', user: u6, rating: 4, verifiedPurchase: false,
      comment: "Runs whisper quiet compared to the PS4. Load times are basically gone. The UI takes getting used to but once you do it's fine. Solid upgrade if you're coming from last gen." },

    // ── IKEA Kallax ───────────────────────────────────────────────────────────
    { slug: 'ikea-kallax-147x147', user: u2, rating: 4, verifiedPurchase: true,
      comment: "Solid shelving unit. Assembly took about an hour but the instructions are clear. Really versatile — using mine for books, plants, and as a room divider. Would definitely buy again." },
    { slug: 'ikea-kallax-147x147', user: u3, rating: 1, verifiedPurchase: false,
      comment: "Just from looking at the dimensions — this will not fit in a standard apartment bedroom without careful planning. The product photos use wide-angle lenses to make it look much smaller than it is." },
    { slug: 'ikea-kallax-147x147', user: u5, rating: 5, verifiedPurchase: true,
      comment: "Exactly what I needed. Sturdy, looks great, incredibly versatile with the insert options. I've set it up as a TV unit with storage boxes and it's been perfect for over a year now." },
    { slug: 'ikea-kallax-147x147', user: u7, rating: 3, verifiedPurchase: false,
      comment: "Decent enough but the particleboard isn't the most durable — dropped a heavy book on a shelf and it dented. Fine for light use, wouldn't rely on it for anything particularly heavy." },

    // ── IKEA Vittsjo ──────────────────────────────────────────────────────────
    { slug: 'ikea-vittsjo', user: u2, rating: 4, verifiedPurchase: true,
      comment: "Love the open industrial look. Super easy to assemble — maybe 20 minutes. The metal and glass combo is striking. Just make sure you anchor it to the wall since it's quite tall." },
    { slug: 'ikea-vittsjo', user: u6, rating: 5, verifiedPurchase: true,
      comment: "Exactly what I was looking for — minimal, modern, and doesn't make a small room feel cramped. The glass shelves show off everything nicely. Surprisingly sturdy for the price." },
    { slug: 'ikea-vittsjo', user: u4, rating: 2, verifiedPurchase: false,
      comment: "Looks nice in photos but the glass shelves scratch easily and the unit wobbles unless anchored. For the price it's OK but I expected better stability. Not great if you have kids or pets." },

    // ── IKEA Nockeby ──────────────────────────────────────────────────────────
    { slug: 'ikea-nockeby', user: u4, rating: 3, verifiedPurchase: true,
      comment: "Looks great and very Scandinavian. The cushions are comfortable initially but lose their shape after a few weeks. Slipcover system is clever but slides around more than I'd like." },
    { slug: 'ikea-nockeby', user: u6, rating: 4, verifiedPurchase: true,
      comment: "Really comfortable once the cushions are broken in and the slipcover is a game-changer for keeping it clean with kids. Looks a lot more expensive than it is. Assembly is straightforward." },
    { slug: 'ikea-nockeby', user: u3, rating: 2, verifiedPurchase: false,
      comment: "The slipcover bunches up constantly and the seat cushions flatten out quickly with regular use. Looks great in the showroom but the long-term comfort isn't there. Disappointed." },

    // ── Nike Air Zoom Citizen ─────────────────────────────────────────────────
    { slug: 'air-zoom-citizen-1999', user: u1, rating: 3, verifiedPurchase: false,
      comment: "Decent retro runner but sizing runs narrow. If you have wide feet size up. The colorways are cool but for this price I expected better cushioning — the Air Zoom unit feels dated vs modern alternatives." },
    { slug: 'air-zoom-citizen-1999', user: u2, rating: 5, verifiedPurchase: true,
      comment: "Exactly what I wanted — a clean low-profile runner that looks as good off the track as on it. Comfortable from day one, zero break-in. The 1999 colorway is perfect." },
    { slug: 'air-zoom-citizen-1999', user: u6, rating: 4, verifiedPurchase: true,
      comment: "Really clean silhouette. I wear these mostly as a lifestyle shoe and they've held up great over several months. Cushioning is decent for casual wear, not ideal for long runs." },
    { slug: 'air-zoom-citizen-1999', user: u7, rating: 2, verifiedPurchase: false,
      comment: "Stylish but the build quality let me down — the glue started separating at the toe box after two months. Nike's quality control on retro lines isn't what it used to be." },

    // ── Mercurial Vapor IV ────────────────────────────────────────────────────
    { slug: 'mercurial-vapor-iv', user: u3, rating: 5, verifiedPurchase: true,
      comment: "Absolute rockets. The TPU soleplate gives incredible energy return and the NikeSkin upper molds to your foot after a few sessions. Scored in my first game wearing these. Pure nostalgia." },
    { slug: 'mercurial-vapor-iv', user: u4, rating: 3, verifiedPurchase: false,
      comment: "Looks amazing in photos but the fit is really narrow — anything wider than a D width will be uncomfortable. The soleplate is also very firm, best on soft ground only, not great on FG." },
    { slug: 'mercurial-vapor-iv', user: u7, rating: 5, verifiedPurchase: true,
      comment: "One of the most iconic boots ever made and this reproduction is faithful to the original. The NikeSkin upper is butter soft and the speed plate is insane. Wore these in a 5-a-side and felt unstoppable." },
    { slug: 'mercurial-vapor-iv', user: u8, rating: 4, verifiedPurchase: false,
      comment: "Beautifully made and genuinely fast-feeling on the pitch. Sizing is true to Nike's usual fit — go half up if you're between sizes. The only downside is they're not very durable beyond 20-30 games." },

    // ── Tiempo Legend 2014 ────────────────────────────────────────────────────
    { slug: 'tiempo-legend-2014', user: u3, rating: 4, verifiedPurchase: true,
      comment: "Classic leather feel that no synthetic can replicate. Soft touch on the ball, great for close control. Traction is solid on natural grass. A bit heavier than modern options but that's the trade-off you accept." },
    { slug: 'tiempo-legend-2014', user: u7, rating: 5, verifiedPurchase: true,
      comment: "The kangaroo leather upper is a thing of beauty. These mold to your foot perfectly after a few sessions and the touch on the ball is incomparable. Old school comfort for players who value feel over speed." },
    { slug: 'tiempo-legend-2014', user: u5, rating: 3, verifiedPurchase: false,
      comment: "Great leather quality but the outsole is stiff out of the box and takes a while to break in. If you're patient it rewards you — just don't expect to feel great in your first session." },
    { slug: 'tiempo-legend-2014', user: u8, rating: 4, verifiedPurchase: false,
      comment: "Solid boot. The leather upper is the real deal and traction on natural grass is excellent. Goes narrow in the toe box so size up if you have wide feet. A classic for a reason." },

    // ── Mercurial IC 2014 ─────────────────────────────────────────────────────
    { slug: 'mercurial-ic-2014', user: u4, rating: 4, verifiedPurchase: false,
      comment: "Great futsal shoe. Non-marking rubber outsole grips well on sport court and the upper is tight enough for quick direction changes. Runs about half a size small so order up." },
    { slug: 'mercurial-ic-2014', user: u5, rating: 5, verifiedPurchase: true,
      comment: "Best indoor shoe I've owned. The grip on sport court is exceptional and the low profile gives you great court feel. Light enough that you barely notice them. Highly recommend for serious futsal players." },
    { slug: 'mercurial-ic-2014', user: u8, rating: 4, verifiedPurchase: true,
      comment: "Really solid futsal shoe. Quick pivot support is great, the upper wraps the foot well. Only issue is the toe area is a little stiff initially — wear them around the house a few times first." },
    { slug: 'mercurial-ic-2014', user: u6, rating: 3, verifiedPurchase: false,
      comment: "Decent performance but the sizing is very off — I normally take a 10.5 and had to go up to an 11.5. Once sized correctly they're comfortable enough, but the inconsistency is frustrating." },

    // ── MacBook Pro — additional reviews (→ 11 total) ─────────────────────────
    { slug: 'macbook-pro-m3-16-2024', user: u9, rating: 5, verifiedPurchase: true,
      comment: "The performance is in a different league from anything Windows at this price. Silent under load, buttery smooth display, and the battery holds up through a full workday without breaking a sweat." },
    { slug: 'macbook-pro-m3-16-2024', user: u10, rating: 4, verifiedPurchase: true,
      comment: "M3 chip is a genuine leap. Docker containers that used to throttle my old machine run without a hitch, and the 16-inch Liquid Retina display is gorgeous for design work." },
    { slug: 'macbook-pro-m3-16-2024', user: u12, rating: 5, verifiedPurchase: true,
      comment: "Apple finally made a laptop that doesn't need to be plugged in all day. The fan barely kicks in even during heavy tasks. Premium price but the machine earns every penny." },
    { slug: 'macbook-pro-m3-16-2024', user: u11, rating: 2, verifiedPurchase: false,
      comment: "Would love to own one but the non-upgradeable memory is a deal-breaker for long-term value. You're locked in the moment you buy — plan accordingly or you'll be unhappy in two years." },
    { slug: 'macbook-pro-m3-16-2024', user: u3, rating: 5, verifiedPurchase: false,
      comment: "Borrowed a colleague's for a week — the trackpad alone is worth the price of admission. Nothing I've used comes close. Saving up to buy one and I'm already impatient." },
    { slug: 'macbook-pro-m3-16-2024', user: u8, rating: 4, verifiedPurchase: false,
      comment: "Display and build are genuinely flawless. My hesitation is macOS — if you're coming from Windows the learning curve is steeper than Apple marketing suggests. Worth the switch though." },

    // ── PS5 — additional reviews (→ 11 total) ────────────────────────────────
    { slug: 'sony-ps5', user: u9, rating: 5, verifiedPurchase: true,
      comment: "Day one purchase and I haven't regretted it once. The adaptive triggers alone changed how I experience games. Spider-Man 2 and God of War look absolutely stunning on this hardware." },
    { slug: 'sony-ps5', user: u11, rating: 4, verifiedPurchase: true,
      comment: "Huge upgrade over last gen. The DualSense is genuinely innovative and games load in seconds. Still waiting for more first-party exclusives but what's there is excellent." },
    { slug: 'sony-ps5', user: u12, rating: 5, verifiedPurchase: true,
      comment: "Hardware is exceptional — silent, fast, and the controller is unlike anything else. Game Pass offers better value but nothing matches the quality of PS5 exclusives when they land." },
    { slug: 'sony-ps5', user: u2, rating: 4, verifiedPurchase: false,
      comment: "The UI is genuinely bad but the games more than compensate. Demon's Souls and Returnal justify this purchase alone if you enjoy challenging games. Hardware is flawless." },
    { slug: 'sony-ps5', user: u4, rating: 3, verifiedPurchase: false,
      comment: "Impressive hardware held back by a confusing interface and a still-thin exclusive library if you're not a Sony franchise fan. Hardware-wise it's a marvel, software-wise it needs work." },
    { slug: 'sony-ps5', user: u7, rating: 5, verifiedPurchase: false,
      comment: "Tried one at a friend's — the haptic feedback is not a gimmick, it's genuinely immersive. Returnal alone sold me. On my list as soon as I can justify the spend." },

    // ── Mercurial Vapor IV — additional reviews (→ 11 total) ─────────────────
    { slug: 'mercurial-vapor-iv', user: u10, rating: 5, verifiedPurchase: true,
      comment: "First match in these and I felt electric. The TPU soleplate snaps back energy on every stride and the NikeSkin locks your foot in perfectly. Worth every penny for a speed player." },
    { slug: 'mercurial-vapor-iv', user: u12, rating: 4, verifiedPurchase: true,
      comment: "Incredible boot. The NikeSkin upper locks your foot in without being restrictive. These run narrow — worth going half a size up — but once dialed in they are phenomenal." },
    { slug: 'mercurial-vapor-iv', user: u1, rating: 4, verifiedPurchase: false,
      comment: "Iconic design and era-accurate colorway. The soleplate geometry is exactly as I remember from watching Ronaldo wear these. Narrower than modern Mercurials so size accordingly." },
    { slug: 'mercurial-vapor-iv', user: u2, rating: 3, verifiedPurchase: false,
      comment: "Pure speed when the fit works. I tape my toes for longer sessions due to the narrow last, but on the pitch the feeling is unmatched. Not for wide-footed players." },
    { slug: 'mercurial-vapor-iv', user: u5, rating: 4, verifiedPurchase: false,
      comment: "Not for wide feet — had to return my first pair and size up. After that adjustment they were great. The NikeSkin upper molds beautifully to the foot over time." },
    { slug: 'mercurial-vapor-iv', user: u6, rating: 5, verifiedPurchase: false,
      comment: "Everything a retro speed boot should be. The gold and black colorway is stunning on the pitch and the feel on the ball is exactly what legends are made of." },
    { slug: 'mercurial-vapor-iv', user: u11, rating: 5, verifiedPurchase: false,
      comment: "The myth, the legend. These boots carry serious history and the feel reflects it. Tight fit but if you're a speed merchant they are absolutely worth it." },

    // ── Tiempo Legend 2014 — additional reviews (→ 11 total) ─────────────────
    { slug: 'tiempo-legend-2014', user: u11, rating: 5, verifiedPurchase: true,
      comment: "Proper leather boot. The kangaroo upper breaks in beautifully and the touch on the ball is something no synthetic can replicate. Worth every penny for a touch player." },
    { slug: 'tiempo-legend-2014', user: u9, rating: 4, verifiedPurchase: false,
      comment: "The weight is noticeable compared to modern boots but the control you get from the leather upper makes up for it. Classic choice for technical midfielders who value feel." },
    { slug: 'tiempo-legend-2014', user: u12, rating: 4, verifiedPurchase: false,
      comment: "Tried these at a friend's session — the leather feel is genuinely different to anything modern. If you value touch over pace these are hard to argue with." },
    { slug: 'tiempo-legend-2014', user: u1, rating: 5, verifiedPurchase: false,
      comment: "Kangaroo leather is becoming rarer in football boots so these feel special. Soft, responsive, and they get better with every session. A classic that still holds up." },
    { slug: 'tiempo-legend-2014', user: u2, rating: 3, verifiedPurchase: false,
      comment: "The leather upper delivers on its promise but the outsole is stiff and the boot feels dated compared to modern options. Good if heritage is what you're after." },
    { slug: 'tiempo-legend-2014', user: u4, rating: 3, verifiedPurchase: false,
      comment: "Beautiful heritage boot and the touch is exceptional. My issue is the weight — modern alternatives like the Predator give similar control at a fraction of the mass." },
    { slug: 'tiempo-legend-2014', user: u6, rating: 4, verifiedPurchase: false,
      comment: "Classic leather craftsmanship that feels like it was made by someone who actually played the game. Heavy, yes, but for a number 10 the close control is worth it." },

    // ── AirPods Pro (2nd Generation) ─────────────────────────────────────────
    { slug: 'airpods-pro', user: u2, rating: 5, verifiedPurchase: true,
      comment: "The ANC is genuinely class-leading. I use these on daily commutes and they make the Underground feel silent. Transparency mode is so good you forget you're wearing them. Worth every penny." },
    { slug: 'airpods-pro', user: u4, rating: 4, verifiedPurchase: true,
      comment: "Huge upgrade over the first gen. Adaptive Audio is a feature I didn't know I needed — it blends noise cancellation and transparency seamlessly based on your environment. Battery life is much improved too." },
    { slug: 'airpods-pro', user: u6, rating: 5, verifiedPurchase: false,
      comment: "Borrowed a pair for a flight — the ANC blocked out engine noise better than my over-ears. Spatial Audio in movies is legitimately immersive. Buying my own pair as soon as possible." },
    { slug: 'airpods-pro', user: u9, rating: 3, verifiedPurchase: false,
      comment: "Great earbuds but the fit doesn't work for my ear shape — they pop out during runs regardless of which tip size I use. ANC and sound quality are excellent when they stay in though." },
    { slug: 'airpods-pro', user: u11, rating: 5, verifiedPurchase: true,
      comment: "The Conversation Awareness feature alone makes these worth it. Media pauses and volume drops the moment I start talking — it sounds like a small thing until you've used it for a week." },

    // ── AirPods Max ───────────────────────────────────────────────────────────
    { slug: 'airpods-max', user: u3, rating: 5, verifiedPurchase: true,
      comment: "The best headphones I've ever owned. The ANC is otherworldly and the sound quality is rich and detailed across every genre. The aluminium build feels like wearing a precision instrument on your head." },
    { slug: 'airpods-max', user: u7, rating: 4, verifiedPurchase: false,
      comment: "Tried these for a week and the sound quality is genuinely stunning. My only hesitation is the case — it looks like a bra and offers almost no protection. For the price that's embarrassing." },
    { slug: 'airpods-max', user: u10, rating: 5, verifiedPurchase: true,
      comment: "Spatial Audio with head tracking is not a gimmick — watching films on a plane with these is a cinema experience. The knitted mesh headband is the most comfortable I've worn over long sessions." },
    { slug: 'airpods-max', user: u12, rating: 3, verifiedPurchase: false,
      comment: "Exceptional sound but the weight becomes noticeable after two hours. Sony's XM5s are lighter, cheaper, and have a better case. These are the status play if you're already in the Apple ecosystem." },
    { slug: 'airpods-max', user: u5, rating: 4, verifiedPurchase: true,
      comment: "Sound quality is reference-grade and ANC handles airplane cabin noise better than anything else I've tried. The Digital Crown for volume is a thoughtful detail. Case is still awful though." },

    // ── Apple Watch Ultra ─────────────────────────────────────────────────────
    { slug: 'apple-watch-ultra', user: u4, rating: 5, verifiedPurchase: true,
      comment: "The original Ultra set the bar for what a smartwatch could be. Titanium case, 40m water resistance, precise GPS — and the Action Button is still one of the smartest hardware additions Apple has made." },
    { slug: 'apple-watch-ultra', user: u6, rating: 4, verifiedPurchase: false,
      comment: "Still an excellent watch even with the Ultra 2 out. The 2000 nit display handles direct sunlight well and the battery life is miles ahead of the standard Apple Watch. Great value at the current price." },
    { slug: 'apple-watch-ultra', user: u8, rating: 5, verifiedPurchase: true,
      comment: "Used this for a full Ironman — GPS held perfect throughout the swim, bike, and run. The crash detection and emergency SOS gave real peace of mind in remote sections of the course." },
    { slug: 'apple-watch-ultra', user: u2, rating: 3, verifiedPurchase: false,
      comment: "Great watch but if you're choosing between this and the Ultra 2 the S9 chip and 3000 nit display are meaningful upgrades. This one is only worth it if the price difference is significant." },
    { slug: 'apple-watch-ultra', user: u11, rating: 4, verifiedPurchase: true,
      comment: "Chunky but purposeful. The ocean band is genuinely comfortable for watersports and the 40m dive rating actually gets used. Build quality is exceptional — no scratches after six months of hard use." },

    // ── Rolex Datejust 41 ─────────────────────────────────────────────────────
    { slug: 'rolex-datejust', user: u1, rating: 5, verifiedPurchase: true,
      comment: "Flawless craftsmanship. The Calibre 3235 movement is buttery smooth and the jubilee bracelet wears beautifully. This is a watch you buy once and pass down. Every detail is considered and perfect." },
    { slug: 'rolex-datejust', user: u5, rating: 5, verifiedPurchase: false,
      comment: "Tried one at a boutique — the fit, weight, and finish are in a different universe from anything else I've worn. The Cyclops lens is more useful than it looks. A timeless object in every sense." },
    { slug: 'rolex-datejust', user: u9, rating: 4, verifiedPurchase: true,
      comment: "Incredible watch. The 70-hour power reserve is reassuring and the self-winding movement is hypnotic to watch through the caseback. Only giving four stars because the waiting list experience was frustrating." },
    { slug: 'rolex-datejust', user: u3, rating: 5, verifiedPurchase: false,
      comment: "The Datejust is the definitive dress watch. Clean, legible, and appropriate for every occasion. The fluted bezel catches light beautifully. Nothing else in this category comes close to the overall package." },
    { slug: 'rolex-datejust', user: u7, rating: 4, verifiedPurchase: true,
      comment: "Superb quality and a watch that only improves with age. The bracelet has zero play after months of daily wear. Would give five stars but the date font feels slightly dated against modern competitors." },
  ];

  for (const { slug, user, rating, verifiedPurchase, comment } of reviews) {
    const product = productMap[slug];
    if (!product) { console.warn(`  Skipping review — product "${slug}" not found`); continue; }
    const userName = user.name;
    await Review.create({ productId: product._id, userId: user._id, userName, rating, comment, verifiedPurchase });
    const label = verifiedPurchase ? '✓ verified' : '  unverified';
    console.log(`  ${label}  ${userName} → "${product.title.slice(0, 28)}…" ${rating}★`);
  }

  console.log('\n✅ Seed complete.\n');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('\n❌', err.message || err);
  process.exit(1);
});
