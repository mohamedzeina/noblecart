# Noblecart

A full-stack e-commerce web application built with Node.js and Express, following the MVC pattern. Features a 3D product viewer, slide-out cart drawer, product reviews, live search with autocomplete, wishlists, order tracking, Stripe payments, PDF invoice generation, an analytics admin dashboard, and a full user profile system with cascading address selects.

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

---

## Features

### User Authentication
- Registration and login with session-based authentication
- Optional avatar upload on signup with live initial-letter preview
- Passwords hashed with bcryptjs (12 salt rounds)
- Email-based password reset via tokenized links (expires after 1 hour)
- Welcome email sent on signup via Resend
- Session regenerated on login to prevent session fixation

### User Profile
- Update display name and avatar photo (auto-cropped to 200×200 via Cloudinary)
- Old avatar deleted from Cloudinary when replaced
- Client-side avatar file size check (5 MB limit) with instant error feedback
- Shipping address with cascading country → state/province → city selects (offline, via country-state-city)
- Address labels adapt by country (State/City for US/CA/AU; City-Province/District for others)
- Password change with current-password verification, length enforcement (6–128 chars), and same-password check
- Blur-time hints on password fields (length indicator, match indicator)
- Tab-based layout with URL hash routing (`#info`, `#address`, `#security`)

### Shopping
- Homepage and per-category product grids with pagination (6 per page)
- Sort by newest, price ascending/descending, or top-rated
- Price bracket filter (0–50, 50–200, 200–500, 500+)
- Live search overlay with 300ms debounce, skeleton loading, and keyboard navigation (arrow keys, Enter, Escape)
- Search suggestions include product image, category, rating, price, and wishlist indicator
- Wishlist toggle on all product cards and the search overlay

### Product Detail
- Full product page with image, description, category, stock status, and pricing
- Interactive 3D viewer (Three.js + GLTFLoader) for products with a GLB model — drag to rotate, scroll to zoom, auto-rotation
- GLB loads lazily on "3D View" button click with a progress bar
- Add-to-cart without page reload; cart badge updates instantly
- Related products shown below main content

### Cart
- Slide-out cart drawer from the right with skeleton loading state
- Add, increment, decrement, and remove items — all async with optimistic UI
- Animated grand total counter on every change
- Stock-aware quantity controls (+ button disabled at stock limit)
- Persistent across sessions via MongoDB session store

### Checkout & Payments
- Stripe Checkout integration — session created server-side, redirected client-side
- Stock validation before redirecting to Stripe; out-of-stock items shown with error
- On successful payment: order created, stock decremented per item, cart cleared, confirmation email sent
- Stripe cancel redirects back to the checkout page

### Orders
- Order history with status filter tabs (All, Active, Delivered, Cancelled)
- Happy-face empty state when no cancelled orders exist; sad-face for other empty filters
- Per-order detail page with full product list and status timeline
- Order status history tracked with timestamps
- Reorder items from any past order — out-of-stock items skipped automatically
- Downloadable PDF invoice per order (server-generated, access-controlled to order owner)
- Email notification on every status change

### Order Status State Machine
- Flow: `pending` → `confirmed` → `shipped` → `out_for_delivery` → `delivered`
- Cancellation allowed from `pending` or `confirmed`
- `delivered` and `canceled` are terminal states; invalid transitions are rejected

### Reviews
- Star rating (1–5) with comment (max 1000 chars) per product per user
- Verified Purchase badge when reviewer has a matching order
- Sort reviews by newest, highest-rated, or lowest-rated
- Load more reviews via async pagination (no page reload)
- Edit and delete own review inline
- Review avatar shows user's profile photo or initial letter
- Reviewer name stored at time of review

### Wishlist
- Add/remove from any product card or product detail page
- Wishlist page shows all saved products with ratings
- Heart button pop animation; toast notification on add/remove
- Card fades out on removal; page reloads if list becomes empty

### Admin — Authentication
- Separate admin login at `/admin/login` with its own session (independent from customer sessions)
- `isAdmin` middleware guards all admin routes; `isNotAdmin` prevents admins accessing customer routes
- Admins who visit customer routes are redirected to `/admin/products`

### Admin — Dashboard
- KPI cards: total revenue, paid order count, average order value, product count
- Time range toggle: 7-day / 30-day
- Daily revenue trend line chart (Chart.js) with gradient fill
- Top 5 products by revenue with units sold
- Order status breakdown
- Recent orders table with direct links
- Count-up animations and status bar animations; all respect `prefers-reduced-motion`

### Admin — Product Management
- Create, edit, and delete products with title, price, description, category, stock
- Image upload with drag-and-drop, instant preview, stored on Cloudinary
- Optional GLB 3D model upload with live model-viewer preview and auto-generated thumbnail
- Thumbnail composited onto white background from a canvas render
- Delete with inline confirmation dialog and toast feedback
- Deleting a product removes it from all user carts and wishlists automatically
- Ownership verification: admins can only edit/delete their own products
- Category filter chips on product list; pagination with sort

### Admin — Order Management
- Paginated order list with status and date-range filters (today, 7 days)
- Status transition controls per order, validated against the state machine
- Status update email sent to customer on every transition

### Accessibility
- Skip-to-main-content link at top of every page
- `aria-label` on all icon-only buttons
- `aria-expanded` and `aria-haspopup` on dropdown menus
- `aria-modal` on search overlay dialog
- Focus restored to triggering element when cart drawer closes
- Arrow-key navigation in search suggestions
- All animations respect `prefers-reduced-motion`
- Semantic HTML: `<nav>`, `role="menu"`, `role="menuitem"`, `role="dialog"`
- Explicit `<label>` for all form inputs; required-field indicators

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| Database | MongoDB with Mongoose |
| Session store | connect-mongodb-session |
| Templating | EJS |
| Auth | express-session + bcryptjs |
| CSRF protection | csurf |
| Security headers | helmet (custom CSP) |
| File upload | multer (memory storage) |
| Image/model hosting | Cloudinary |
| Email | Resend API |
| Payments | Stripe Checkout |
| PDF generation | PDFKit |
| 3D viewer | Three.js (GLTFLoader, OrbitControls, DRACOLoader) |
| Charts | Chart.js |
| Address data | country-state-city (offline) |
| Input validation | express-validator |
| Flash messages | connect-flash |
| Compression | compression (gzip) |
| Logging | morgan → access.log |
| Testing | Jest |
| Build | esbuild (3D viewer bundle) |
| Dev server | nodemon |

---

## Architecture

The project follows a strict **MVC pattern**:

- **Models** (`models/`) — Mongoose schemas with business logic as instance methods. `Order` implements a state-machine transition validator. `User` owns cart and wishlist mutation methods.
- **Controllers** (`controllers/`) — Handle all request/response logic. Each file maps to a domain: `shop.js` (browsing, cart, checkout, orders, reviews, wishlist), `auth.js` (user auth), `admin.js` (admin features), `admin-auth.js` (admin auth), `profile.js` (user profile), `error.js` (404/500).
- **Routes** (`routes/`) — Mount controllers onto paths and apply middleware. Three distinct middleware guards: `isAuth`, `isAdmin`, `isNotAdmin`.
- **Views** (`views/`) — EJS templates split into `shop/`, `auth/`, `admin/`, and `includes/` (shared partials: navigation, cart drawer, head, pagination).
- **Public** (`public/`) — Per-feature CSS files and per-page JS files. No bundler except for the Three.js viewer which is compiled with esbuild.
- **Utilities** (`util/`) — Thin wrappers: Cloudinary config, file deletion, email sending (Resend), review rating aggregation, pagination helper.

**Notable patterns:**
- Separate user and admin sessions: `req.session.userId` vs `req.session.adminId`, both loaded in parallel on every request
- `res.locals` populated globally: `isAuthenticated`, `isAdmin`, `currentUser`, `csrfToken`, `cartCount`, `wishlistIds`, `wishlistCount`
- Product snapshots embedded in orders at purchase time — price changes don't affect historical orders
- Avatar and reviewer name snapshotted in reviews at submission time
- HTTPS auto-detected: creates `https.createServer` if `server.key` / `server.cert` are present, otherwise plain HTTP

---

## Project Structure

```
Online-Shop/
├── app.js                    # Express app entry: middleware, routes, MongoDB connect
├── jest.config.js            # Jest config: coverage dirs, test pattern
├── nodemon.json              # Nodemon config with env vars for dev
├── access.log                # HTTP request log (morgan)
│
├── controllers/
│   ├── admin.js              # Dashboard, product CRUD, order management
│   ├── admin-auth.js         # Admin login/logout
│   ├── auth.js               # User registration, login, password reset
│   ├── error.js              # 404 / 500 pages
│   ├── profile.js            # Profile info, address, password update
│   └── shop.js               # Products, cart, checkout, orders, reviews, wishlist
│
├── middleware/
│   ├── is-auth.js            # Redirect to /login if not authenticated
│   ├── is-admin.js           # 403 if not admin
│   └── is-not-admin.js       # Redirect admin to /admin/products
│
├── models/
│   ├── admin.js              # Admin schema (email, password)
│   ├── order.js              # Order schema + state machine methods
│   ├── product.js            # Product schema (with 3D model fields)
│   ├── review.js             # Review schema (userName, userAvatar snapshotted)
│   └── user.js               # User schema + cart/wishlist instance methods
│
├── routes/
│   ├── admin.js              # /admin/* (isAdmin guard)
│   ├── admin-auth.js         # /admin/login, /admin/logout
│   ├── api.js                # /api/states/:cc, /api/cities/:cc/:sc
│   ├── auth.js               # /login, /signup, /logout, /reset
│   └── shop.js               # /, /products, /cart, /checkout, /orders, /profile, ...
│
├── util/
│   ├── cloudinary.js         # Cloudinary SDK init
│   ├── email.js              # sendOrderConfirmation, sendStatusUpdate, sendWelcome, sendPasswordReset
│   ├── file.js               # deleteFile, deleteModel (Cloudinary cleanup)
│   ├── paginationHelper.js   # Shared pagination + sort + price filter logic
│   └── reviewHelpers.js      # buildRatingsMap aggregation
│
├── views/
│   ├── includes/             # navigation, head, end, cart-drawer, pagination, partials
│   ├── admin/                # dashboard, products, orders, edit-product, product-detail, login
│   ├── auth/                 # login, signup, reset, new-password
│   ├── shop/                 # index, product-detail, search, cart, checkout, orders,
│   │                         #   order-detail, wishlist, profile
│   ├── 403.ejs
│   ├── 404.ejs
│   └── 500.ejs
│
├── public/
│   ├── css/                  # main, product, cart, cart-drawer, checkout, orders,
│   │                         #   profile, search, wishlist, auth, admin, forms, signup-avatar
│   └── js/
│       ├── admin.js          # Admin controls: stock, delete, order status, toasts
│       ├── animations.js     # Scroll-triggered card entrance (IntersectionObserver)
│       ├── auth.js           # Password show/hide, form loading state
│       ├── cart-add.js       # Async add-to-cart from product pages
│       ├── cart-drawer.js    # Full cart drawer: fetch, render, qty controls, focus mgmt
│       ├── cart.js           # Cart page qty controls and animated totals
│       ├── checkout.js       # Stripe redirect + bfcache restore
│       ├── checkout-qty.js   # Checkout qty controls + stock validation + session fetch
│       ├── dashboard.js      # Count-up KPIs, Chart.js revenue chart
│       ├── main.js           # Global: scroll restore, mobile menu, account dropdown, reviews
│       ├── orders.js         # Reorder button loading state
│       ├── product-detail.js # Bundled Three.js viewer (esbuild output)
│       ├── product-detail-src.js  # Three.js 3D viewer source
│       ├── profile.js        # Tabs, cascading selects, avatar preview, password hints
│       ├── search.js         # Live search overlay with keyboard navigation
│       ├── signup-avatar.js  # Avatar preview and initial letter during signup
│       ├── upload.js         # Admin image/GLB upload with drag-drop and thumbnail capture
│       └── wishlist.js       # Heart toggle, toast, badge, animated remove
│
├── scripts/
│   └── seed.js               # Full DB reset + 12 test users (with addresses) + products + orders + reviews
│
└── tests/
    └── unit/
        ├── controllers/      # admin.test.js, shop.test.js, profile.test.js
        ├── models/           # user.test.js, order.test.js
        └── util/             # paginationHelper.test.js, reviewHelpers.test.js
```

---

## Installation

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account
- Resend account (for email)
- Stripe account (for payments)

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd Online-Shop

# 2. Install dependencies
npm install

# 3. Create nodemon.json with environment variables (see below)
# nodemon.json is used for local dev; copy the structure from the table below

# 4. (Optional) Generate self-signed SSL certificates for HTTPS
openssl req -nodes -new -x509 -keyout server.key -out server.cert

# 5. Build the Three.js viewer bundle
npm run build:viewer

# 6. Seed the database (requires a running MongoDB and valid env vars)
npm run seed

# 7. Start the development server
npm run dev
```

The app listens on `http://localhost:3000` (or `https://localhost:3000` if certificates are present).

**Seeded test accounts** (all passwords: `123456`):

| Email | Name | Address |
|---|---|---|
| test@test.com | Alice Johnson | New York, US |
| test2@test.com | Bob Smith | London, UK |
| test3@test.com | Carol White | London, UK |
| test4@test.com | David Lee | Istanbul, Turkey |
| test5@test.com | Eva Martinez | Los Angeles, US |
| test6@test.com | Frank Brown | New York, US |
| test7@test.com | Grace Kim | Toronto, Canada |
| test8@test.com | Henry Davis | — |
| test9@test.com | Isla Wilson | Sydney, Australia |
| test10@test.com | Jack Taylor | — |
| test11@test.com | Karen Anderson | Chicago, US |
| test12@test.com | Liam Thomas | — |

Admin credentials are set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars.

---

## Environment Variables

Create a `nodemon.json` file at the project root (used by `npm run dev`) with this structure:

```json
{
  "env": {
    "MONGODB_URI": "...",
    "SESSION_SECRET": "...",
    "CLOUDINARY_CLOUD_NAME": "...",
    "CLOUDINARY_API_KEY": "...",
    "CLOUDINARY_API_SECRET": "...",
    "RESEND_API_KEY": "...",
    "FROM_EMAIL": "...",
    "APP_URL": "...",
    "STRIPE_KEY": "...",
    "ADMIN_EMAIL": "...",
    "ADMIN_PASSWORD": "...",
    "PORT": "3000"
  }
}
```

| Variable | Description | Where to get it |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | MongoDB Atlas or local instance |
| `SESSION_SECRET` | Secret for signing session cookies | Any random string |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Cloudinary dashboard |
| `RESEND_API_KEY` | API key for Resend email service | resend.com |
| `FROM_EMAIL` | Sender address for all outgoing emails | Verified domain in Resend |
| `APP_URL` | Base URL for email links (e.g. `https://noblecart.onrender.com`) | Your deployment URL |
| `STRIPE_KEY` | Stripe secret key | Stripe dashboard |
| `ADMIN_EMAIL` | Email address for the seeded admin account | Your choice |
| `ADMIN_PASSWORD` | Password for the seeded admin account | Your choice |
| `PORT` | Server port (default: `3000`) | Optional |

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `node app.js` | Start the production server |
| `dev` | `nodemon app.js` | Start dev server with auto-restart |
| `build:viewer` | `esbuild ...` | Bundle Three.js viewer to `public/js/product-detail.js` |
| `seed` | `node scripts/seed.js` | Reset DB and seed products, users, orders, and reviews |
| `test` | `jest` | Run all unit tests |
| `test:coverage` | `jest --coverage` | Run tests and generate coverage report |
| `test:watch` | `jest --watch` | Run tests in watch mode |

---

## Testing

### Running Tests

```bash
npm test                # all tests, no coverage
npm run test:coverage   # all tests + HTML/LCOV coverage report in coverage/
npm run test:watch      # watch mode for development
```

### Test Suites

| Suite | File | Tests | What's Covered |
|---|---|---|---|
| Shop controller | `controllers/shop.test.js` | 70 | Cart ops, checkout, orders, reorder, wishlist, reviews (post/put/delete), Stripe session |
| Admin controller | `controllers/admin.test.js` | 33 | Order status patch, product CRUD, stock update, admin orders list |
| Profile controller | `controllers/profile.test.js` | 26 | Get profile, update name/avatar, address validation, password change validation |
| Order model | `models/order.test.js` | 22 | State machine: all valid and invalid transitions, `transitionTo` side effects |
| User model | `models/user.test.js` | 17 | addToCart, decrementFromCart, removeFromCart, clearCart, toggleWishlist |
| Pagination helper | `util/paginationHelper.test.js` | 12 | Page math, price filters, sort options, error handling |
| Review helpers | `util/reviewHelpers.test.js` | 5 | buildRatingsMap aggregation, empty inputs, grouping accuracy |
| **Total** | | **185** | |

### Coverage Configuration

Coverage is collected from `controllers/**`, `models/**`, and `util/**` (excluding `email.js`, `cloudinary.js`, and `file.js` which are thin external-API wrappers). Reports are generated as `text` (terminal) and `lcov` (HTML in `coverage/lcov-report/`).
