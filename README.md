# Noblecart

A full-stack luxury e-commerce web application built with Node.js and Express.js, following the MVC pattern. Features a 3D product viewer, slide-out cart drawer, product categories, Stripe payments, and PDF invoice generation.

**Live demo:** [online-shop-luts.onrender.com](https://online-shop-luts.onrender.com)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)

## Features

- **User Authentication**
  - Registration and login with session-based auth
  - Passwords hashed with bcryptjs
  - Email-based password reset via tokenized links (expires after 1 hour)
  - Signup confirmation email via Resend

- **Product Management** (Admin only)
  - Create, edit, and delete products with category assignment
  - Image upload with drag-and-drop support and instant preview, stored on Cloudinary (`noblecart/`)
  - Optional GLB 3D model upload, stored on Cloudinary (`noblecart-models/`)
  - Delete with inline confirmation and toast feedback — no accidental deletions
  - Deleting a product automatically removes it from all user carts

- **3D Product Viewer**
  - Interactive 3D viewer powered by Three.js for products with a GLB model
  - OrbitControls with drag-to-rotate, scroll-to-zoom, and auto-dismiss hint overlay
  - Falls back to standard image display when no model is available

- **Product Categories**
  - Products are tagged with a category: Electronics, Fashion, Home & Living, or Accessories
  - Category filtering via navbar links with active underline state
  - Breadcrumb navigation on category and product detail pages

- **Cart Drawer**
  - Slide-out cart drawer on all pages — no separate cart page
  - Add products without page reload — cart badge updates live
  - Adjust quantity with + / − controls or remove items from within the drawer
  - Line totals and order total update instantly
  - Cart persists across sessions via MongoDB

- **Orders & Payments**
  - Stripe Checkout integration for secure payments
  - Orders created automatically on successful payment
  - Paginated order history per user
  - PDF invoices generated server-side with PDFKit — premium black/white design

- **Security**
  - CSRF protection on all state-changing requests
  - HTTP security headers via Helmet
  - Server-side input validation with express-validator

- **Other**
  - Pagination on product listings
  - GLB product seed script with Puppeteer thumbnail capture
  - Morgan HTTP request logging to `access.log`
  - Response compression

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| View Engine | EJS |
| Database | MongoDB + Mongoose |
| Sessions | express-session + connect-mongodb-session |
| Auth | bcryptjs |
| File Uploads | Multer + Cloudinary |
| 3D Viewer | Three.js (self-hosted, bundled with esbuild) |
| Payments | Stripe |
| Email | Resend |
| PDF | PDFKit |
| Validation | express-validator |
| Security | Helmet, csurf |
| Dev | nodemon, morgan, Puppeteer |

## Architecture

This project follows the **Model-View-Controller (MVC)** pattern:

- **Models** (`/models`) — Mongoose schemas for `User`, `Product`, and `Order`. The `User` model includes cart methods (`addToCart`, `decrementFromCart`, `removeFromCart`, `clearCart`).
- **Views** (`/views`) — EJS templates organized by feature (`shop/`, `admin/`, `auth/`), with shared partials in `includes/` including the cart drawer.
- **Controllers** (`/controllers`) — Business logic separated into `shop.js`, `admin.js`, `auth.js`, and `error.js`.
- **Routes** (`/routes`) — Express routers map HTTP methods/paths to controller functions, with `isAuth` middleware guarding protected routes.

## Project Structure

```
.
├── app.js                  # App entry point (HTTPS server, middleware, routes)
├── nodemon.json            # Dev environment variables (gitignored)
├── middleware/
│   └── is-auth.js
├── models/
│   ├── user.js
│   ├── product.js
│   └── order.js
├── controllers/
│   ├── auth.js
│   ├── shop.js
│   ├── admin.js
│   └── error.js
├── routes/
│   ├── auth.js
│   ├── shop.js
│   └── admin.js
├── views/
│   ├── auth/
│   ├── shop/
│   ├── admin/
│   └── includes/           # Shared partials (nav, head, cart drawer, etc.)
├── public/
│   ├── css/
│   └── js/
├── util/
│   ├── file.js             # Cloudinary delete helper
│   ├── cloudinary.js       # Cloudinary SDK config
│   └── paginationHelper.js
├── scripts/
│   ├── seed-glb-products.js  # Seed products from local GLB files
│   └── products/             # Product data folders (gitignored)
│       └── <slug>/
│           ├── meta.txt      # title, price, category, description
│           ├── model.glb     # 3D model (required)
│           └── image.png     # Optional — auto-captured via Puppeteer if missing
└── invoices/               # Generated PDF invoices (gitignored)
```

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mohamedzeina/online-shop.git
   cd online-shop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `nodemon.json` file in the project root (gitignored — never commit it):
   ```json
   {
     "env": {
       "MONGODB_URI": "your-mongodb-connection-string",
       "RESEND_API_KEY": "your-resend-api-key",
       "FROM_EMAIL": "your-verified-sender-email",
       "STRIPE_PUB_KEY": "your-stripe-publishable-key",
       "STRIPE_SECRET_KEY": "your-stripe-secret-key",
       "CLOUDINARY_CLOUD_NAME": "your-cloud-name",
       "CLOUDINARY_API_KEY": "your-api-key",
       "CLOUDINARY_API_SECRET": "your-api-secret"
     }
   }
   ```

4. **Generate local SSL certificates**

   The app runs on HTTPS locally. Generate a self-signed certificate:
   ```bash
   openssl req -nodes -new -x509 -keyout server.key -out server.cert
   ```
   When prompted for **Common Name (CN)**, enter `localhost`.

5. **Build the 3D viewer bundle**
   ```bash
   npm run build:viewer
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. Visit [https://localhost:3000](https://localhost:3000)

   > Your browser will warn about the self-signed certificate — proceed past it for local development.

## Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | [MongoDB Atlas](https://www.mongodb.com/atlas) or local MongoDB |
| `RESEND_API_KEY` | Resend API key for transactional email | [Resend Dashboard](https://resend.com) |
| `FROM_EMAIL` | Verified sender email address | Your Resend verified sender (or `onboarding@resend.dev` for testing) |
| `STRIPE_PUB_KEY` | Stripe publishable key | [Stripe Dashboard](https://dashboard.stripe.com) |
| `STRIPE_SECRET_KEY` | Stripe secret key | [Stripe Dashboard](https://dashboard.stripe.com) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | [Cloudinary Console](https://cloudinary.com/console) |
| `CLOUDINARY_API_KEY` | Cloudinary API key | [Cloudinary Console](https://cloudinary.com/console) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | [Cloudinary Console](https://cloudinary.com/console) |

> For Stripe, use test-mode keys (prefixed `pk_test_` / `sk_test_`) during development.

## Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `node app.js` | Start the production server |
| `dev` | `nodemon app.js` | Start with auto-reload (reads env from nodemon.json) |
| `build:viewer` | `esbuild ...` | Bundle the Three.js 3D viewer for the browser |
| `seed` | `node scripts/seed-glb-products.js` | Delete all products and re-seed from `scripts/products/` |

### Seeding Products

Place each product in its own folder under `scripts/products/<slug>/`:

```
scripts/products/
└── sony-ps5/
    ├── meta.txt      # Title, Price, Category, Description
    └── model.glb     # 3D model (compressed to <10MB for Cloudinary free tier)
```

`meta.txt` format:
```
Title: Sony PlayStation 5
Price: 499.99
Category: electronics
Description: ...
```

Then run:
```bash
npm run seed
```

If no `image.png` is provided, a thumbnail is auto-captured from the GLB via Puppeteer.
