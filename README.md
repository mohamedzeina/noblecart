# Noblecart

A full-stack luxury e-commerce web application built with Node.js and Express.js, following the MVC pattern. Features a 3D product viewer, slide-out cart drawer, product reviews and ratings, full-text search with autocomplete, wishlists, order tracking, Stripe payments, and PDF invoice generation.

**Live demo:** [noblecart.onrender.com](https://noblecart.onrender.com)

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
  - Welcome email on signup via Resend

- **Admin Authentication**
  - Separate admin login at `/admin/login` — independent session from customer accounts
  - Admin sessions stored in MongoDB; `isAdmin` middleware guards all admin routes
  - `isNotAdmin` middleware prevents admins from accessing customer-only routes

- **Product Management** (Admin only)
  - Create, edit, and delete products with category assignment
  - Image upload with drag-and-drop support and instant preview, stored on Cloudinary (`noblecart/`)
  - Optional GLB 3D model upload, stored on Cloudinary (`noblecart-models/`)
  - Delete with inline confirmation and toast feedback — no accidental deletions
  - Deleting a product automatically removes it from all user carts
  - Category filter chips on the admin product list

- **3D Product Viewer**
  - Interactive 3D viewer powered by Three.js for products with a GLB model
  - OrbitControls with drag-to-rotate, scroll-to-zoom, and auto-dismiss hint overlay
  - Falls back to standard image display when no model is available

- **Product Categories & Sort**
  - Products tagged with a category: Electronics, Fashion, Home & Living, or Accessories
  - Category filtering via navbar links with active underline state
  - Sort bar on the shop listing: Newest, Price Low → High, Price High → Low, Top Rated
  - Top Rated sort uses a live MongoDB aggregation — no denormalized fields
  - Scroll position preserved across sort, filter, and pagination navigations
  - Breadcrumb navigation on category and product detail pages

- **Full-Text Search**
  - Debounced autocomplete overlay with keyboard navigation (↑ ↓ Enter Escape)
  - Suggestions show product image, category, price, and star rating
  - Heart icon on suggestions reflects wishlist state
  - Full search results page with star ratings on each card

- **Wishlist**
  - Save products for later from any product card or detail page
  - Heart button toggles with instant visual feedback and toast notification
  - Dedicated wishlist page accessible from the account dropdown
  - Star ratings displayed on wishlist cards

- **Cart Drawer**
  - Slide-out cart drawer on all pages — no separate cart page
  - Add products without page reload — cart badge updates live
  - Adjust quantity with + / − controls or remove items from within the drawer
  - Line totals and order total update instantly
  - Cart persists across sessions via MongoDB

- **Orders & Payments**
  - Stripe Checkout integration for secure payments
  - Orders created automatically on successful payment via Stripe webhook
  - Branded order confirmation email sent on successful checkout
  - Paginated order history per user
  - PDF invoices generated server-side with PDFKit — premium black/white design

- **Order Status Tracking**
  - Full state machine: Pending → Confirmed → Shipped → Out for Delivery → Delivered (or Canceled)
  - Admin order management: status update buttons with confirmation modals, status badge per order
  - Transactional email on each status change (shipped, out for delivery, delivered, canceled)
  - Customer-facing progress stepper on the orders page
  - Admin order list filterable by status and date range (Today, Last 7 days, Last 30 days)

- **Product Reviews & Ratings**
  - Authenticated users can submit one review per product (1–5 stars + comment)
  - Verified Purchase badge for orders the user has paid for
  - Edit and delete own review inline — no page reload
  - Reviews paginated (5 shown initially) with a Load More button
  - Sort reviews by Newest, Highest Rated, or Lowest Rated
  - Aggregate star rating (average + count) shown on product cards, search results, wishlist, and search suggestions
  - Half-star precision on all rating displays

- **Security**
  - CSRF protection on all state-changing requests
  - HTTP security headers via Helmet
  - Server-side input validation with express-validator

- **Other**
  - Pagination on product listings and admin order/product lists
  - Full database seed script with Cloudinary upload, order creation, and realistic reviews
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

- **Models** (`/models`) — Mongoose schemas for `Admin`, `User`, `Product`, `Order`, and `Review`. The `User` model includes cart methods (`addToCart`, `decrementFromCart`, `removeFromCart`, `clearCart`).
- **Views** (`/views`) — EJS templates organized by feature (`shop/`, `admin/`, `auth/`), with shared partials in `includes/` including the cart drawer and pagination.
- **Controllers** (`/controllers`) — Business logic separated into `shop.js`, `admin.js`, `auth.js`, `admin-auth.js`, and `error.js`.
- **Routes** (`/routes`) — Express routers map HTTP methods/paths to controller functions, with `isAuth`, `isAdmin`, and `isNotAdmin` middleware guarding protected routes.

## Project Structure

```
.
├── app.js                  # App entry point (HTTPS server, middleware, routes)
├── nodemon.json            # Dev environment variables (gitignored)
├── middleware/
│   ├── is-auth.js
│   ├── is-admin.js
│   └── is-not-admin.js
├── models/
│   ├── admin.js
│   ├── user.js
│   ├── product.js
│   ├── order.js
│   └── review.js
├── controllers/
│   ├── auth.js
│   ├── admin-auth.js
│   ├── shop.js
│   ├── admin.js
│   └── error.js
├── routes/
│   ├── auth.js
│   ├── admin-auth.js
│   ├── shop.js
│   └── admin.js
├── views/
│   ├── auth/
│   ├── shop/
│   ├── admin/
│   ├── includes/           # Shared partials (nav, head, cart drawer, pagination, etc.)
│   ├── 403.ejs
│   ├── 404.ejs
│   └── 500.ejs
├── public/
│   ├── css/
│   └── js/
├── util/
│   ├── file.js             # Cloudinary delete helper
│   ├── cloudinary.js       # Cloudinary SDK config
│   ├── email.js            # Resend transactional email helpers
│   └── paginationHelper.js
├── scripts/
│   ├── seed.js               # Full DB reset and seed (Cloudinary + orders + reviews)
│   └── products/             # Product data folders (gitignored)
│       └── <genre>/          # Category subfolder (electronics, fashion, home, accessories)
│           └── <slug>/
│               ├── meta.txt  # title, price, category, stock, description
│               ├── model.glb # 3D model (optional)
│               └── image.png # Optional — auto-captured via Puppeteer if missing
└── invoices/               # Generated PDF invoices (gitignored)
```

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mohamedzeina/noblecart.git
   cd noblecart
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
       "SESSION_SECRET": "a-long-random-secret",
       "APP_URL": "https://localhost:3000",
       "ADMIN_EMAIL": "admin@example.com",
       "ADMIN_PASSWORD": "your-admin-password",
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
| `SESSION_SECRET` | Secret used to sign session cookies | Any long random string |
| `APP_URL` | Base URL of the app (used in emails) | `https://localhost:3000` locally; your domain in production |
| `ADMIN_EMAIL` | Admin account email | Choose your own |
| `ADMIN_PASSWORD` | Admin account password | Choose your own |
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
| `seed` | `node scripts/seed.js` | Full DB reset: clears Cloudinary + all collections, re-seeds products, admin, 12 customers, orders, and reviews |

### Seeding the Database

`npm run seed` does a full reset — clears Cloudinary, wipes every collection, then seeds:
- Admin account (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- All products from `scripts/products/` (uploaded to Cloudinary)
- 12 test customers (`test@test.com` … `test12@test.com`, password: `123456`)
- Orders across customers with realistic status histories
- ~60 reviews across all products, including verified purchases and review sorts

Place each product in its own folder under `scripts/products/<slug>/`:

```
scripts/products/
└── sony-ps5/
    ├── meta.txt      # Title, Price, Category, Description
    └── model.glb     # 3D model (optional; image.png auto-captured via Puppeteer if missing)
```

`meta.txt` format:
```
Title: Sony PlayStation 5
Price: 499.99
Category: electronics
Description: ...
```
