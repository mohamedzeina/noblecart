/**
 * seed.js — Full database reset and seed
 *
 * 1. Deletes all Cloudinary assets tied to existing products
 * 2. Clears every MongoDB collection
 * 3. Creates admin
 * 4. Uploads products from scripts/products/
 * 5. Creates 4 test customers (test@test.com … test4@test.com, password: 123456)
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
  };
}

async function uploadImage(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'noblecart',
    resource_type: 'image',
  });
  return { url: result.secure_url, publicId: result.public_id };
}

async function uploadModel(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'noblecart-models',
    resource_type: 'raw',
    use_filename: true,
    unique_filename: true,
  });
  return { url: result.secure_url, publicId: result.public_id };
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
    { timeout: 30000 }
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
  const slugs = fs.readdirSync(PRODUCTS_DIR)
    .filter(name => fs.statSync(path.join(PRODUCTS_DIR, name)).isDirectory())
    .sort();

  const productMap = {};
  for (const slug of slugs) {
    const dir = path.join(PRODUCTS_DIR, slug);
    const metaPath = path.join(dir, 'meta.txt');
    if (!fs.existsSync(metaPath)) { console.warn(`  Skipping ${slug} — no meta.txt`); continue; }

    const meta = parseMeta(metaPath);
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
      tmpThumb = await captureGlbThumbnail(modelPath);
      imagePath = tmpThumb;
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
  const [u1, u2, u3, u4] = await Promise.all(
    ['test@test.com', 'test2@test.com', 'test3@test.com', 'test4@test.com'].map(email =>
      User.create({ email, password: customerHash, cart: { items: [] }, wishlist: [] })
    )
  );
  [u1, u2, u3, u4].forEach(u => console.log(`  ✓ ${u.email}  (password: ${CUSTOMER_PASSWORD})`));

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

    // u4 — bought Nockeby (delivered) and MacBook (pending, not yet delivered)
    makeOrder(u4, [{ product: p['ikea-nockeby'], quantity: 1 }], 'delivered'),
    makeOrder(u4, [{ product: p['macbook-pro-m3-16-2024'], quantity: 1 }], 'pending'),
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

    // ── PS5 ───────────────────────────────────────────────────────────────────
    { slug: 'sony-ps5', user: u1, rating: 4, verifiedPurchase: true,
      comment: "Great console — the SSD makes load times almost non-existent and DualSense haptics are genuinely impressive in supported games. Docking a star because the UI is still a confusing mess." },
    { slug: 'sony-ps5', user: u3, rating: 5, verifiedPurchase: false,
      comment: "The hardware is phenomenal. Spider-Man 2, Astro's Playroom — nothing else delivers this kind of experience right now. If you have a 4K TV this is a must-buy." },

    // ── IKEA Kallax ───────────────────────────────────────────────────────────
    { slug: 'ikea-kallax-147x147', user: u2, rating: 4, verifiedPurchase: true,
      comment: "Solid shelving unit. Assembly took about an hour but the instructions are clear. Really versatile — using mine for books, plants, and as a room divider. Would definitely buy again." },
    { slug: 'ikea-kallax-147x147', user: u3, rating: 1, verifiedPurchase: false,
      comment: "Just from looking at the dimensions — this will not fit in a standard apartment bedroom without careful planning. The product photos use wide-angle lenses to make it look much smaller than it is." },

    // ── IKEA Nockeby ──────────────────────────────────────────────────────────
    { slug: 'ikea-nockeby', user: u4, rating: 3, verifiedPurchase: true,
      comment: "Looks great and very Scandinavian. The cushions are comfortable initially but lose their shape after a few weeks. Slipcover system is clever but slides around more than I'd like." },

    // ── Nike Air Zoom Citizen ─────────────────────────────────────────────────
    { slug: 'air-zoom-citizen-1999', user: u1, rating: 3, verifiedPurchase: false,
      comment: "Decent retro runner but sizing runs narrow. If you have wide feet size up. The colorways are cool but for this price I expected better cushioning — the Air Zoom unit feels dated vs modern alternatives." },
    { slug: 'air-zoom-citizen-1999', user: u2, rating: 5, verifiedPurchase: true,
      comment: "Exactly what I wanted — a clean low-profile runner that looks as good off the track as on it. Comfortable from day one, zero break-in. The 1999 colorway is perfect." },

    // ── Mercurial Vapor IV ────────────────────────────────────────────────────
    { slug: 'mercurial-vapor-iv', user: u3, rating: 5, verifiedPurchase: true,
      comment: "Absolute rockets. The TPU soleplate gives incredible energy return and the NikeSkin upper molds to your foot after a few sessions. Scored in my first game wearing these. Pure nostalgia." },
    { slug: 'mercurial-vapor-iv', user: u4, rating: 3, verifiedPurchase: false,
      comment: "Looks amazing in photos but the fit is really narrow — anything wider than a D width will be uncomfortable. The soleplate is also very firm, best on soft ground only, not great on FG." },

    // ── Tiempo Legend 2014 ────────────────────────────────────────────────────
    { slug: 'tiempo-legend-2014', user: u3, rating: 4, verifiedPurchase: true,
      comment: "Classic leather feel that no synthetic can replicate. Soft touch on the ball, great for close control. Traction is solid on natural grass. A bit heavier than modern options but that's the trade-off you accept." },

    // ── Mercurial IC 2014 ─────────────────────────────────────────────────────
    { slug: 'mercurial-ic-2014', user: u4, rating: 4, verifiedPurchase: false,
      comment: "Great futsal shoe. Non-marking rubber outsole grips well on sport court and the upper is tight enough for quick direction changes. Runs about half a size small so order up." },
  ];

  for (const { slug, user, rating, verifiedPurchase, comment } of reviews) {
    const product = productMap[slug];
    if (!product) { console.warn(`  Skipping review — product "${slug}" not found`); continue; }
    const userName = user.email.split('@')[0];
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
