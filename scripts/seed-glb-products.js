/**
 * seed-glb-products.js
 *
 * Reads every folder inside scripts/products/, uploads its GLB and image
 * to Cloudinary, then inserts the product into MongoDB.
 *
 * Folder structure per product:
 *   scripts/products/<slug>/
 *     meta.txt        — Title, Price, Category, Description
 *     model.glb       — optional 3D model
 *     image.png/.jpg  — optional image (skipped if absent)
 *
 * Usage:
 *   node scripts/seed-glb-products.js
 *   npm run seed
 */

const path = require('path');
const fs = require('fs');
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
    folder: 'shop-products',
    resource_type: 'image',
  });
  return { url: result.secure_url, publicId: result.public_id };
}

async function uploadModel(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'shop-models',
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
    const doc = { ...meta, userId: user._id, imageUrl: '', imagePublicId: '', modelUrl: undefined, modelPublicId: undefined };

    const imagePath = findFile(dir, ['image.png', 'image.jpg', 'image.jpeg', 'image.webp']);
    if (imagePath) {
      process.stdout.write('  Uploading image… ');
      const { url, publicId } = await uploadImage(imagePath);
      doc.imageUrl = url;
      doc.imagePublicId = publicId;
      console.log('done');
    } else {
      console.log('  No image file found — imageUrl will be empty');
    }

    const modelPath = findFile(dir, ['model.glb']);
    if (modelPath) {
      process.stdout.write('  Uploading GLB… ');
      const { url, publicId } = await uploadModel(modelPath);
      doc.modelUrl = url;
      doc.modelPublicId = publicId;
      console.log('done');
    }

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
