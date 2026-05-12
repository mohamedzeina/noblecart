# Noblecart

A full-stack luxury e-commerce web application built with Node.js and Express.js, following the MVC pattern. Features a 3D product viewer, slide-out cart drawer, product reviews and ratings, full-text search with autocomplete, wishlists, order tracking, Stripe payments, PDF invoice generation, and an analytics admin dashboard.

**Live demo:** [noblecart.onrender.com](https://noblecart.onrender.com)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)

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

- **Admin Dashboard**
  - KPI cards: total revenue, paid order count, average order value, and product count
  - Daily revenue trend chart (Chart.js line graph) with configurable time range (7D / 30D / All)
  - Top 5 products by revenue with units sold
  - Order status breakdown
  - Recent orders table with links to full order management
  - All charts and animations respect `prefers-reduced-motion`

- **Product Management** (Admin only)
  - Create, edit, and delete products with category assignment
  - Image upload with drag-and-drop support and instant preview, stored on Cloudinary (`noblecart/`)
  - Optional GLB 3D model upload, stored on Cloudinary (`noblecart-models/`)
  - Delete with inline confirmation and toast feedback — no accidental deletions
  - Deleting a product automatically removes it from all user carts and wishlists
  - Category filter chips on the admin product list
  - Per-product detail page showing total units sold, aggregate rating, and all reviews

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

- **Price Range Filter**
  - Preset price chips on the shop listing: Under $50 / $50–$200 / $200–$500 / $500+
  - Combines with the active sort param — both are preserved in the URL

- **Full-Text Search**
  - Debounced autocomplete overlay with keyboard navigation (↑ ↓ Enter Escape)
  - Suggestions show product image, category, price, and star rating
  - Heart icon on suggestions reflects current wishlist state
  - Full search results page with star ratings on each card

- **Product Detail Page**
  - Related products carousel (same category, sorted by average rating, max 4)
  - Star rating breakdown showing per-star distribution (5 → 1) alongside the aggregate
  - User's own review highlighted separately from other reviews

- **Wishlist**
  - Save products for later from any product card or detail page
  - Heart button toggles with instant visual feedback and toast notification
  - Dedicated wishlist page accessible from the account dropdown
  - Star ratings displayed on wishlist cards

- **Cart Drawer**
  - Slide-out cart drawer on all pages — no separate cart page
  - Add products without page reload — cart badge updates live
  - Adjust quantity with + / − controls or remove items from within the drawer
  - Line totals and order total animate with a count-up effect on quantity changes
  - Cart persists across sessions via MongoDB
  - Skeleton loading state while fetching; empty state when cart is empty
  - Focus management: opens to close button, restores focus to opener on close
  - Full accessibility: `aria-hidden`, `aria-live`, keyboard operable

- **Checkout & Payments**
  - Stripe Checkout integration for secure card payments
  - Stock validated before redirect — blocked with a clear error if any item exceeds available stock
  - Orders created automatically on successful payment; stock decremented per item
  - Branded order confirmation email sent on successful checkout

- **Orders**
  - Paginated order history per user, filterable by status (All / Active / Delivered / Canceled) with badge counts
  - Order cards show product thumbnails, short order ID, date, item count, total, and color-coded status badge
  - **Order Detail Page**: horizontal progress stepper with milestone timestamps, status banner with contextual message, full product breakdown, and PDF invoice download link
  - **Reorder / Buy Again**: re-adds all in-stock items from a past order to the cart in their original quantities

- **Order Status Tracking**
  - Full state machine: Pending → Confirmed → Shipped → Out for Delivery → Delivered (or Canceled from Pending/Confirmed)
  - Invalid transitions are rejected — history is append-only with timestamps
  - Admin order management: status update buttons with confirmation, paginated order list filterable by status and date range (Today, Last 7 days, Last 30 days)
  - Transactional email on each status change (confirmed, shipped, out for delivery, delivered, canceled)

- **PDF Invoices**
  - Generated server-side with PDFKit — premium black-and-white design
  - Itemized product table with unit price, quantity, and line total
  - Accessible via the order detail page; opens inline in a new tab

- **Product Reviews & Ratings**
  - Authenticated users can submit one review per product (1–5 stars + comment)
  - Verified Purchase badge for products the user has paid for
  - Edit and delete own review inline — no page reload
  - Reviews paginated (5 shown initially) with a Load More button
  - Sort reviews by Newest, Highest Rated, or Lowest Rated
  - Aggregate star rating (average + count) shown on product cards, search results, wishlist, and search suggestions
  - Half-star precision on all rating displays

- **Stock Management**
  - In Stock / Out of Stock badge on product cards and detail page
  - "Only X left" low-stock warning when stock ≤ 5
  - Add to Cart button disabled and relabeled when stock = 0
  - Admin can update stock directly from the product detail page

- **Security**
  - CSRF protection on all state-changing requests
  - HTTP security headers via Helmet (CSP configured for Cloudinary, Stripe, Google APIs, jsDelivr)
  - Server-side input validation with express-validator
  - Session regeneration on login

- **Accessibility & UX**
  - `aria-current` on active sort and price filter chips for screen reader announcements
  - `aria-label` on product card articles
  - All interactive elements have visible focus states and `cursor-pointer`
  - Fade-up stagger animation on product cards via Intersection Observer (disabled for `prefers-reduced-motion`)
  - Consistent touch targets (min 44×44 px)

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
| Charts | Chart.js |
| Payments | Stripe |
| Email | Resend |
| PDF | PDFKit |
| Validation | express-validator |
| Security | Helmet, csurf |
| Testing | Jest |
| Dev | nodemon, morgan, Puppeteer |

## Architecture

This project follows the **Model-View-Controller (MVC)** pattern:

- **Models** (`/models`) — Mongoose schemas for `Admin`, `User`, `Product`, `Order`, and `Review`. The `User` model includes cart methods (`addToCart`, `decrementFromCart`, `removeFromCart`, `clearCart`) and a `toggleWishlist` method. The `Order` model implements a validated status state machine via `canTransitionTo` and `transitionTo` methods.
- **Views** (`/views`) — EJS templates organized by feature (`shop/`, `admin/`, `auth/`), with shared partials in `includes/` including the cart drawer, pagination, and wishlist button.
- **Controllers** (`/controllers`) — Business logic separated into `shop.js`, `admin.js`, `auth.js`, `admin-auth.js`, and `error.js`.
- **Routes** (`/routes`) — Express routers map HTTP methods/paths to controller functions, with `isAuth`, `isAdmin`, and `isNotAdmin` middleware guarding protected routes.
- **Utilities** (`/util`) — Shared helpers: `reviewHelpers.js` (ratings aggregation), `paginationHelper.js` (pagination + price/sort filters), `email.js` (Resend transactional emails), `cloudinary.js` (SDK config), `file.js` (Cloudinary delete helper).

## Project Structure

```
.
├── app.js                  # App entry point (HTTPS server, middleware, routes)
├── jest.config.js          # Jest test configuration
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
│   ├── reviewHelpers.js    # Ratings aggregation utility
│   └── paginationHelper.js # Pagination + price/sort filter helper
├── tests/
│   └── unit/
│       ├── models/         # user.test.js, order.test.js
│       ├── controllers/    # shop.test.js, admin.test.js
│       └── util/           # paginationHelper.test.js, reviewHelpers.test.js
├── scripts/
│   ├── seed.js               # Full DB reset and seed (Cloudinary + orders + reviews)
│   └── products/             # Product data folders (gitignored)
│       └── <slug>/
│           ├── meta.txt  # title, price, category, stock, description
│           ├── model.glb # 3D model (optional)
│           └── image.png # Optional — auto-captured via Puppeteer if missing
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
| `test` | `jest` | Run the full unit test suite |
| `test:coverage` | `jest --coverage` | Run tests with a coverage report |
| `test:watch` | `jest --watch` | Re-run tests on file changes (watch mode) |

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

## Testing

The project includes a Jest unit test suite covering models, utilities, and controllers.

```bash
npm test                # Run all tests
npm run test:coverage   # Run with coverage report
npm run test:watch      # Watch mode for development
```

| Suite | Tests | What's covered |
|---|---|---|
| `models/user` | 16 | Cart add/increment/decrement/remove/clear, wishlist toggle |
| `models/order` | 20 | All valid and invalid `canTransitionTo` cases, `transitionTo` state mutations and history |
| `util/reviewHelpers` | 5 | Ratings aggregation map |
| `util/paginationHelper` | 13 | Pagination math, all price filter ranges, sort options |
| `controllers/shop` | 31 | Cart, checkout success, orders, reviews (post/put/delete), wishlist, reorder |
| `controllers/admin` | 22 | Product CRUD, orders, stock updates, status transitions |
| **Total** | **126** | |

Coverage: models ~94%, utilities ~97%, controllers ~40%. Tests run in a Node environment with models and external services (Cloudinary, Stripe, email) mocked at the module boundary.
