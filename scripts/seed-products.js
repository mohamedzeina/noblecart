const mongoose = require('mongoose');

// Load env vars from nodemon.json (used instead of .env in this project)
const { env } = require('../nodemon.json');
Object.assign(process.env, env);

const User = require('../models/user');
const Product = require('../models/product');

const PRODUCTS = [
  // Electronics
  {
    title: 'Wireless Noise-Cancelling Headphones',
    price: 89.99,
    description: 'Premium over-ear headphones with active noise cancellation, 30-hour battery life, and foldable design. Perfect for travel and work.',
    category: 'electronics',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80',
  },
  {
    title: 'Mechanical Gaming Keyboard',
    price: 129.99,
    description: 'Full-size mechanical keyboard with tactile switches, RGB backlight, and aluminum frame. Anti-ghosting for competitive gaming.',
    category: 'electronics',
    imageUrl: 'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=600&q=80',
  },
  {
    title: 'Smart LED Desk Lamp',
    price: 34.99,
    description: 'Touch-controlled desk lamp with adjustable color temperature, USB charging port, and memory function. Eye-care certified.',
    category: 'electronics',
    imageUrl: 'https://images.unsplash.com/photo-1534073737927-85f1ebff1f5d?w=600&q=80',
  },
  {
    title: 'Portable Bluetooth Speaker',
    price: 59.99,
    description: 'Waterproof portable speaker with 360° sound, 12-hour playtime, and built-in microphone. Connects to two devices simultaneously.',
    category: 'electronics',
    imageUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&q=80',
  },

  // Fashion
  {
    title: 'Classic Leather Biker Jacket',
    price: 199.99,
    description: 'Genuine leather jacket with asymmetric zip, silver hardware, and quilted lining. A timeless wardrobe staple for every season.',
    category: 'fashion',
    imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80',
  },
  {
    title: 'Minimalist White Sneakers',
    price: 79.99,
    description: 'Clean low-top leather sneakers with cushioned insole and durable rubber outsole. Pairs effortlessly with any outfit.',
    category: 'fashion',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
  },
  {
    title: 'Floral Wrap Dress',
    price: 54.99,
    description: 'Lightweight floral print wrap dress with adjustable tie waist. Flattering silhouette in breathable woven fabric, perfect for summer.',
    category: 'fashion',
    imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&q=80',
  },
  {
    title: 'Structured Leather Handbag',
    price: 119.99,
    description: 'Top-handle handbag in smooth genuine leather with gold-tone hardware, interior zip pocket, and detachable shoulder strap.',
    category: 'fashion',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80',
  },

  // Home
  {
    title: 'Minimalist Arc Floor Lamp',
    price: 69.99,
    description: 'Sleek arc floor lamp with a matte black finish and adjustable head. Creates warm ambient lighting ideal for reading corners and living rooms.',
    category: 'home',
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80',
  },
  {
    title: 'Velvet Accent Chair',
    price: 299.99,
    description: 'Mid-century modern accent chair upholstered in premium velvet. Solid wood legs and high-density foam seat for lasting comfort.',
    category: 'home',
    imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
  },
  {
    title: 'Indoor Monstera Plant',
    price: 24.99,
    description: 'Thriving potted Monstera Deliciosa in a ceramic pot. Low-maintenance tropical plant that purifies air and adds a lush, natural touch to any room.',
    category: 'home',
    imageUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&q=80',
  },
  {
    title: 'Luxury Soy Candle Set',
    price: 39.99,
    description: 'Set of 3 hand-poured soy wax candles in amber glass jars. Scents include sandalwood, cedar, and vanilla — 40-hour burn time each.',
    category: 'home',
    imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&q=80',
  },

  // Accessories
  {
    title: 'Polarized Aviator Sunglasses',
    price: 44.99,
    description: 'Classic aviator sunglasses with polarized UV400 lenses and lightweight metal frame. Reduces glare for driving and outdoor activities.',
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1511499767150-a4d1dc0769e2?w=600&q=80',
  },
  {
    title: 'Stainless Steel Minimalist Watch',
    price: 149.99,
    description: 'Swiss-movement dress watch with sapphire crystal glass, brushed stainless steel case, and genuine leather strap. Water-resistant to 50m.',
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&q=80',
  },
  {
    title: 'Slim Bifold Leather Wallet',
    price: 39.99,
    description: 'Handcrafted full-grain leather bifold wallet with 6 card slots, bill compartment, and RFID-blocking lining. Slim profile fits any pocket.',
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80',
  },
  {
    title: 'Layered Gold Chain Necklace',
    price: 64.99,
    description: '18k gold-plated layered chain necklace with adjustable length. Tarnish-resistant and hypoallergenic — perfect for everyday wear.',
    category: 'accessories',
    imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80',
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const user = await User.findOne({ email: 'test@test.com' });
  if (!user) {
    console.error('User test@test.com not found. Create the account first.');
    process.exit(1);
  }
  console.log(`Found user: ${user.email} (${user._id})`);

  const docs = PRODUCTS.map(p => ({ ...p, userId: user._id, imagePublicId: '' }));
  await Product.insertMany(docs);

  console.log(`✓ Seeded ${docs.length} products across 4 categories`);
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
