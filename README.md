# Noblecart

A full-stack e-commerce web application built with Node.js, Express, and MongoDB following the MVC pattern. Features include a 3D GLB product viewer, slide-out cart drawer, product reviews with verified-purchase badges, live search with keyboard navigation, wishlists, multi-state order tracking, Stripe checkout, PDF invoice generation, an analytics admin dashboard, cascading country/state/city address selects, and a full user profile system.

**Live demo:** [noblecart.onrender.com](https://noblecart.onrender.com)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)

---

## Features

### Catalog & Discovery
- Homepage with paginated product grid (6 per page) and hero section
- Browse by category (electronics, fashion, home, wearables) with chip filters
- Sort by newest, price ascending, price descending, or top-rated
- Price range filters: under $50, $50–200, $200–500, $500+
- Full-text search across product title, category, and description
- Live search dropdown with debounced suggestions (300 ms) and keyboard navigation (arrows + enter)
- Cmd/Ctrl+K global search shortcut
- "View all results" fallback link from suggestion overlay
- Related products carousel on product detail page
- Out-of-stock and "Only X left" low-stock badges

### Product Detail
- Image and 3D GLB model viewer with toggle (auto-rotate, drag-rotate, scroll-zoom, orbit controls)
- Loading progress bar and dismissible interaction hint for 3D viewer
- Star rating, rating distribution breakdown, and review count
- Trust signals (free shipping, 30-day returns, secure payment)
- Hover-revealed description on product cards

### Reviews & Ratings
- Submit a 1–5 star review with comment (one review per user per product)
- Edit or delete your own review
- Paginated review list (5 per page, "load more" without navigation)
- Sort reviews by newest, highest, or lowest rating
- Verified-purchase badge on reviewers who bought the product
- Aggregated average and count shown on product cards, detail page, and admin views

### Shopping Cart
- Add to cart from product card or detail page with toast confirmation
- Off-canvas cart drawer with slide-in animation and skeleton loaders
- Increase, decrease, or remove items with optimistic UI and revert-on-error
- Animated grand total with eased value transitions
- Cart badge in nav updates dynamically
- Body scroll lock and focus restoration when drawer closes
- Escape-to-close and click-outside-to-close

### Wishlist
- Heart-icon toggle on product cards and search suggestions
- Dedicated wishlist page with one-click removal and fade-out animation
- Wishlist badge in nav with live count
- Wishlist state surfaced in live search suggestions

### Checkout & Payment
- Stripe Checkout session creation
- Pre-checkout stock validation with inline error and disabled order button
- Quantity adjustments and item removal on checkout page with stock-limit enforcement
- Automatic redirect home if cart becomes empty
- bfcache-safe button state restore on browser back

### Orders
- Order history with status filters (all, active, delivered, canceled)
- Order-count and total-spent metrics
- Order detail page with item-by-item breakdown
- Downloadable PDF invoice (order ID, date, customer email, item table, grand total)
- "Reorder" action that adds in-stock items from a prior order back to cart

### Authentication & Account
- Separate customer and admin login flows with session-based auth
- Signup with name, email, password, and optional avatar upload (5 MB limit, live preview)
- Show/hide password toggle on all auth forms
- Welcome email on signup
- Forgot-password flow with emailed reset token (1-hour expiration)
- New-password form via reset link
- Session regeneration on login; CSRF tokens on all state-changing requests

### User Profile
- Tabbed interface (info, address, security) with URL-hash routing
- Update display name and avatar (Cloudinary-backed)
- Shipping address with cascading country → state → city selects (loaded from API)
- Dynamic field labels based on country (e.g., "State" vs. "Province")
- Change password with current-password verification, length check (6–128), and live match/length hints
- Profile summary cards: order count, member-since date, wishlist count

### Admin Dashboard
- Revenue KPIs (total, 7-day, 30-day) with animated count-up
- Paid order count and average order value
- Top 5 products by revenue with units sold
- Order status breakdown with animated bars
- Recent orders list (last 5)
- Daily revenue trend chart (7 or 30 days) rendered with Chart.js

### Admin Product Management
- Create products with title, price, description, category, stock, image, and optional 3D GLB model
- Drag-and-drop image upload with preview
- 3D model upload via `<model-viewer>` web component
- Auto-generated thumbnail captured from the 3D model render
- Edit product details and replace assets
- Update stock via inline +/− controls
- Delete products with inline confirmation; cascades removal from all user carts and wishlists
- Paginated product list with category filter chips
- Admin product detail view with review aggregation and units-sold

### Admin Order Management
- Paginated list of all customer orders (10 per page)
- Filter by status and by date (today, 7 days, 30 days)
- State-machine status transitions: pending → confirmed → shipped → out_for_delivery → delivered (or pending → canceled / confirmed → canceled)
- Inline confirm-before-change dialog per status action
- Automatic email notification to customer on status change

### Cross-Cutting UX
- Scroll-triggered fade-up animations via IntersectionObserver (one-time, staggered)
- Toast notifications with auto-dismiss
- Skeleton loaders during async fetches
- Scroll-position preservation across sort/filter/pagination navigation via sessionStorage
- `prefers-reduced-motion` respected throughout
- ARIA labels, `aria-expanded`, `aria-current`, live regions, and focus management
- Mobile-first responsive layouts (hamburger nav, collapsible admin sidebar)
- Lazy-loaded product images

### Security
- HTTPS in dev when `server.key` and `server.cert` are present
- Helmet with custom CSP (Cloudinary, Unsplash, Stripe, Google Fonts)
- gzip response compression
- bcryptjs password hashing
- MongoDB-backed session store
- CSRF tokens injected into every form
- Server-side validation via express-validator
- Multer file-type filters (image MIME types + GLB)
- Morgan request logging to `access.log`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Web framework | Express 4 |
| Templating | EJS |
| Database | MongoDB via Mongoose 8 |
| Sessions | express-session + connect-mongodb-session |
| Auth | bcryptjs, csurf, session-based |
| Validation | express-validator |
| File upload | Multer (memory storage) |
| Asset storage | Cloudinary (images + 3D models) |
| Payments | Stripe |
| Email | Resend |
| PDF | PDFKit |
| 3D viewer | Three.js (GLTF + Draco), `<model-viewer>` |
| Charts | Chart.js |
| Security | Helmet, compression, csurf |
| Logging | Morgan |
| Bundler | esbuild |
| Testing | Jest 30 |
| Dev tooling | nodemon, dotenv |

---

## Architecture

Classic MVC with a thin service layer for shared logic:

- **Models** (`models/`) — Mongoose schemas for User, Admin, Product, Order, and Review. Business logic for cart mutation, wishlist toggle, and order state-machine transitions lives on instance methods.
- **Controllers** (`controllers/`) — One per feature area (shop, auth, admin, admin-auth, profile, error). Controllers handle HTTP, call model methods, and render EJS templates or return JSON.
- **Views** (`views/`) — EJS templates grouped by area (shop, admin, auth, errors) plus `includes/` partials for reusable components (nav, cart drawer, pagination, wishlist button).
- **Routes** (`routes/`) — Express Routers mounted in `app.js`. Each route lists its middleware chain (auth guards, multer, validators).
- **Middleware** (`middleware/`) — Three guards: `is-auth`, `is-admin`, `is-not-admin` (prevents admins from seeing the storefront).
- **Util** (`util/`) — Cloudinary config, email senders, file deleters, pagination helper, and review aggregation helper.
- **Public** (`public/`) — Static CSS and per-page JS modules; one module per feature (cart-drawer, search, checkout, profile, etc.). The 3D viewer is bundled separately via esbuild.

Notable patterns:
- **Server-side rendering** with EJS and progressive enhancement via per-page JS modules.
- **Optimistic UI** with revert-on-error in cart, wishlist, and checkout interactions.
- **State machine** for order status, enforced both server-side (via `transitionTo`) and client-side (next-state buttons).
- **Response locals middleware** exposes `isAuthenticated`, `isAdmin`, `csrfToken`, `cartCount`, `wishlistIds`, and `wishlistCount` to every template.

---

## Project Structure

```
Online-Shop/
├── app.js                      # Express bootstrap: middleware, routes, HTTPS, error handlers
├── package.json
├── jest.config.js
├── server.key / server.cert    # Optional, enables HTTPS in dev
├── access.log                  # Morgan request log
├── controllers/
│   ├── shop.js                 # Browsing, cart, checkout, orders, reviews, invoice
│   ├── auth.js                 # User login, signup, password reset
│   ├── admin-auth.js           # Admin login/logout
│   ├── admin.js                # Admin dashboard, product CRUD, order status
│   ├── profile.js              # Profile info, address, password
│   └── error.js                # 404 / 500 pages
├── models/
│   ├── user.js                 # Customer + cart + wishlist
│   ├── admin.js                # Admin account
│   ├── product.js              # Catalog item
│   ├── order.js                # Order with state machine
│   └── review.js               # Product review with unique (product, user) index
├── routes/
│   ├── shop.js                 # Storefront + customer-authenticated routes
│   ├── auth.js                 # Customer auth + reset
│   ├── admin-auth.js           # Admin auth
│   ├── admin.js                # Admin-only routes
│   └── api.js                  # States/cities JSON endpoints
├── middleware/
│   ├── is-auth.js
│   ├── is-admin.js
│   └── is-not-admin.js
├── util/
│   ├── cloudinary.js           # SDK config
│   ├── email.js                # Resend-powered transactional emails
│   ├── file.js                 # Cloudinary deletion helpers
│   ├── paginationHelper.js     # Pagination + sort + price filter for product lists
│   └── reviewHelpers.js        # Aggregate avg/count ratings by product IDs
├── views/
│   ├── shop/                   # index, product-detail, search, checkout, orders, order-detail, profile, wishlist
│   ├── admin/                  # dashboard, products, product-detail, edit-product, orders, login
│   ├── auth/                   # login, signup, reset, new-password
│   ├── includes/               # navigation, admin-sidebar, cart-drawer, pagination, wishlist-btn, add-to-cart
│   ├── 403.ejs / 404.ejs / 500.ejs
├── public/
│   ├── css/                    # main, forms, product, cart, cart-drawer, checkout, orders, profile, search, auth, signup-avatar, wishlist, admin
│   ├── js/                     # admin, animations, auth, cart-add, cart-drawer, cart, checkout-qty, checkout, dashboard, main, orders, product-detail (bundled), profile, search, signup-avatar, upload, wishlist
│   └── images/
├── tests/
│   └── unit/
│       ├── controllers/        # admin, profile, shop
│       ├── models/             # user, order
│       └── util/               # paginationHelper, reviewHelpers
└── coverage/                   # Generated by `npm run test:coverage`
```

---

## Installation

### 1. Prerequisites
- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB instance)
- Cloudinary account
- Stripe account
- Resend account

### 2. Clone and install
```bash
git clone <repo-url>
cd Online-Shop
npm install
```

### 3. Configure environment
Create a `.env` file in the project root with the variables listed in [Environment Variables](#environment-variables).

### 4. (Optional) Enable HTTPS in development
Generate a self-signed cert and place `server.key` and `server.cert` in the project root. `app.js` will boot an HTTPS server when both files are present.

```bash
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```

### 5. (Optional) Seed the database
```bash
npm run seed
```

### 6. Build the 3D viewer bundle
```bash
npm run build:viewer
```

### 7. Run the server
```bash
npm run dev      # nodemon with auto-restart
# or
npm start        # production
```

The app listens on the port reported in the console (typically 3000).

---

## Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string used for both data and session store | MongoDB Atlas → Connect → Drivers |
| `SESSION_SECRET` | Secret used to sign session cookies | Any long random string |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Cloudinary dashboard |
| `STRIPE_SECRET_KEY` | Stripe secret key for server-side session creation | Stripe dashboard → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for `stripe.redirectToCheckout` | Stripe dashboard → Developers → API keys |
| `RESEND_API_KEY` | Resend API key for transactional emails | Resend dashboard |
| `RESEND_FROM` | Verified sender address used as `from` | Configured in Resend |
| `PORT` | Optional; defaults to 3000 | — |

---

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Runs `node app.js` (production) |
| `npm run dev` | Runs `nodemon app.js` with auto-restart on file changes |
| `npm test` | Runs the full Jest suite once |
| `npm run test:coverage` | Runs Jest with coverage report (text + LCOV in `coverage/`) |
| `npm run test:watch` | Runs Jest in watch mode |
| `npm run build:viewer` | esbuild bundles `public/js/product-detail-src.js` → `public/js/product-detail.js` (ESM, browser-target) for the 3D viewer |
| `npm run seed` | Runs the database seeding script in `scripts/` |

---

## Testing

The project uses Jest 30 with unit tests organized by layer. External services (MongoDB, Cloudinary, Stripe, bcryptjs, Resend) are mocked.

### Test suite breakdown

| Suite | File | Tests | Coverage focus |
|---|---|---|---|
| Shop controller | `tests/unit/controllers/shop.test.js` | 39 | Cart, orders, reviews (create/edit/delete), checkout session, wishlist |
| Profile controller | `tests/unit/controllers/profile.test.js` | 26 | Profile updates, address validation, password change |
| Admin controller | `tests/unit/controllers/admin.test.js` | 25 | Order status transitions, product CRUD, stock updates |
| User model | `tests/unit/models/user.test.js` | 17 | Cart add/decrement/remove/clear, wishlist toggle |
| Order model | `tests/unit/models/order.test.js` | 8 | State machine: pending → confirmed → shipped → out_for_delivery → delivered, plus cancellation paths |
| Pagination helper | `tests/unit/util/paginationHelper.test.js` | 9 | Pagination math, price filters, sort options |
| Review helpers | `tests/unit/util/reviewHelpers.test.js` | 5 | `buildRatingsMap` aggregation |
| **Total** | | **129** | |

### Running tests
```bash
npm test                  # run once
npm run test:watch        # re-run on changes
npm run test:coverage     # generate coverage/ report
```

### Current coverage
Coverage is collected from `controllers/`, `models/`, and `util/` (excluding `util/email.js`, `util/cloudinary.js`, `util/file.js`, and `scripts/`).

| Metric | Coverage |
|---|---|
| Statements | 31.85% (251/788) |
| Branches | 27.11% (80/295) |
| Functions | 22.58% (42/186) |
| Lines | 32.08% (239/745) |

| Module | Lines |
|---|---|
| Models | 94.02% |
| Utilities (covered set) | 71.84% |
| Controllers | 22.89% |

All current tests are isolated unit tests; there are no integration or end-to-end tests in the suite.
