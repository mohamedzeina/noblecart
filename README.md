# Online Shop

A full-stack e-commerce web application built with Node.js and Express.js, following the MVC pattern. Supports product management, shopping cart, Stripe payments, PDF invoice generation, and email-based password reset.

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
  - Signup confirmation email via SendGrid

- **Product Management** (Admin only)
  - Create, edit, and delete products
  - Image upload with drag-and-drop support and instant preview, stored on Cloudinary
  - Delete with inline confirmation and loading state — no accidental deletions
  - Deleting a product automatically removes it from all user carts
  - Products are scoped to the authenticated admin user

- **Shopping Cart**
  - Add products without page reload — cart icon updates live with a badge counter
  - Adjust quantity with + / − controls or remove items entirely with a trash icon
  - Line totals and order summary update instantly without page reload
  - Cart persists across sessions via MongoDB

- **Orders & Payments**
  - Stripe Checkout integration for secure payments
  - Orders created automatically on successful payment
  - Paginated order history per user
  - Downloadable PDF invoices generated server-side with PDFKit

- **Security**
  - CSRF protection on all state-changing requests
  - HTTP security headers via Helmet
  - Server-side input validation with express-validator
  - HTTPS for local development

- **Other**
  - Pagination on product listings and admin dashboard
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
| Payments | Stripe |
| Email | Resend |
| PDF | PDFKit |
| Validation | express-validator |
| Security | Helmet, csurf |
| Dev | nodemon, morgan |

## Architecture

This project follows the **Model-View-Controller (MVC)** pattern:

- **Models** (`/models`) — Mongoose schemas for `User`, `Product`, and `Order`. The `User` model includes cart methods (`addToCart`, `removeFromCart`, `clearCart`).
- **Views** (`/views`) — EJS templates organized by feature (`shop/`, `admin/`, `auth/`), with shared partials in `includes/`.
- **Controllers** (`/controllers`) — Business logic separated into `shop.js`, `admin.js`, `auth.js`, and `error.js`.
- **Routes** (`/routes`) — Express routers map HTTP methods/paths to controller functions, with `isAuth` middleware guarding protected routes.

## Project Structure

```
.
├── app.js                  # App entry point (HTTPS server, middleware, routes)
├── nodemon.json            # Dev environment variables (gitignored — see below)
├── middleware/
│   └── is-auth.js          # Session-based auth guard
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
│   └── includes/
├── public/
│   ├── css/
│   └── js/
├── util/
│   ├── file.js             # Cloudinary delete helper
│   ├── cloudinary.js       # Cloudinary SDK config
│   └── paginationHelper.js
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

   Create a `nodemon.json` file in the project root (this file is gitignored — never commit it):
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

   See [Environment Variables](#environment-variables) for details on obtaining each value.

4. **Generate local SSL certificates**

   The app runs on HTTPS locally. Generate a self-signed certificate:
   ```bash
   openssl req -nodes -new -x509 -keyout server.key -out server.cert
   ```
   When prompted for **Common Name (CN)**, enter `localhost`.

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. Visit [https://localhost:3000](https://localhost:3000)

   > Your browser will warn about the self-signed certificate. This is expected — proceed past the warning for local development.

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
