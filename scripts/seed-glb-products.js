/**
 * seed-glb-products.js
 *
 * Reads every folder inside scripts/products/, uploads its GLB and image
 * to Cloudinary, then inserts the product into MongoDB.
 *
 * If no image file is present but a model.glb exists, Puppeteer renders
 * the GLB via model-viewer and captures a thumbnail automatically.
 *
 * Folder structure per product:
 *   scripts/products/<slug>/
 *     meta.txt        — Title, Price, Category, Description
 *     model.glb       — optional 3D model
 *     image.png/.jpg  — optional (auto-captured from GLB if absent)
 *
 * Usage:
 *   npm run seed
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const mongoose = require('mongoose');

const { env } = require('../nodemon.json');
Object.assign(process.env, env);

const cloudinary = require('../util/cloudinary');
const User = require('../models/user');
const Product = require('../models/product');

const PRODUCTS_DIR = path.join(__dirname, 'products');

// ── Parse meta.txt ────────────────────────────────────────────────────────────

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
  if (missing.length) throw new Error(`meta.txt missing: ${missing.join(', ')}`);

  return {
    title: meta.title,
    price: parseFloat(meta.price),
    category: meta.category.toLowerCase(),
    description: meta.description,
  };
}

// ── Cloudinary uploads ────────────────────────────────────────────────────────

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

// ── Find optional files ───────────────────────────────────────────────────────

function findFile(dir, names) {
  for (const name of names) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ── Puppeteer GLB thumbnail ───────────────────────────────────────────────────

async function captureGlbThumbnail(glbPath) {
  const puppeteer = require('puppeteer');
  const glbBuffer = fs.readFileSync(glbPath);

  // Serve GLB + HTML from a local server so model-viewer can load it
  const server = http.createServer((req, res) => {
    if (req.url === '/model.glb') {
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
      return res.end(glbBuffer);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; }
    body { background: #eef2f6; width: 600px; height: 600px; overflow: hidden; }
    model-viewer { width: 600px; height: 600px; --progress-bar-color: transparent; }
  </style>
</head>
<body>
  <model-viewer
    src="/model.glb"
    camera-controls
    interaction-prompt="none"
    ar-modes=""
    style="width:600px;height:600px;">
  </model-viewer>
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
</body>
</html>`);
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 600 });
  await page.goto(`http://127.0.0.1:${port}/`);

  // Wait for model-viewer to finish loading the model
  await page.waitForFunction(
    () => document.querySelector('model-viewer')?.loaded === true,
    { timeout: 30000 }
  );

  // Give the renderer a moment to settle
  await new Promise(resolve => setTimeout(resolve, 2000));

  const screenshot = await page.screenshot({ type: 'png' });

  await browser.close();
  await new Promise(resolve => server.close(resolve));

  // Write to temp file for Cloudinary upload
  const tmpPath = path.join(os.tmpdir(), `glb-thumb-${Date.now()}.png`);
  fs.writeFileSync(tmpPath, screenshot);
  return tmpPath;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const user = await User.findOne({ email: 'test@test.com' });
  if (!user) {
    console.error('User test@test.com not found. Create the account first.');
    process.exit(1);
  }

  await Product.deleteMany({ userId: user._id });
  console.log('Cleared existing products');

  const slugs = fs.readdirSync(PRODUCTS_DIR).filter(name =>
    fs.statSync(path.join(PRODUCTS_DIR, name)).isDirectory()
  );

  if (!slugs.length) {
    console.log('No product folders found in scripts/products/');
    return;
  }

  for (const slug of slugs) {
    const dir = path.join(PRODUCTS_DIR, slug);
    console.log(`\nProcessing: ${slug}`);

    const metaPath = path.join(dir, 'meta.txt');
    if (!fs.existsSync(metaPath)) {
      console.warn(`  Skipping — no meta.txt found`);
      continue;
    }

    const meta = parseMeta(metaPath);
    const doc = { ...meta, userId: user._id, imageUrl: '', imagePublicId: '' };

    const modelPath = findFile(dir, ['model.glb']);
    if (modelPath) {
      process.stdout.write('  Uploading GLB… ');
      const { url, publicId } = await uploadModel(modelPath);
      doc.modelUrl = url;
      doc.modelPublicId = publicId;
      console.log('done');
    }

    let imagePath = findFile(dir, ['image.png', 'image.jpg', 'image.jpeg', 'image.webp']);
    let tmpThumb = null;

    if (!imagePath && modelPath) {
      process.stdout.write('  Capturing thumbnail from GLB… ');
      tmpThumb = await captureGlbThumbnail(modelPath);
      imagePath = tmpThumb;
      console.log('done');
    }

    if (!imagePath) {
      console.warn(`  Skipping — no image or GLB found`);
      continue;
    }

    process.stdout.write('  Uploading image… ');
    const { url, publicId } = await uploadImage(imagePath);
    doc.imageUrl = url;
    doc.imagePublicId = publicId;
    console.log('done');

    if (tmpThumb) fs.unlinkSync(tmpThumb);

    await Product.create(doc);
    console.log(`  ✓ "${meta.title}" inserted`);
  }

  console.log('\nAll done.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
