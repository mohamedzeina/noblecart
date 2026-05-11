const { env } = require('../nodemon.json');
Object.assign(process.env, env);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/admin');

const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env');
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => Admin.findOne({ email: EMAIL }))
  .then((existing) => {
    if (existing) {
      console.error('Admin already exists.');
      process.exit(1);
    }
    return bcrypt.hash(PASSWORD, 12);
  })
  .then((hashedPassword) => {
    const admin = new Admin({ email: EMAIL, password: hashedPassword });
    return admin.save();
  })
  .then(() => {
    console.log(`Admin created: ${EMAIL}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
