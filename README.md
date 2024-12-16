# Online Shop

Welcome to the **Online Shop** repository! This project is a feature-rich e-commerce platform built to demonstrate web development, database management, and user authentication concepts. It provides essential functionalities to create and manage an online store.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation](#installation)

## Features

- **User Authentication**
  - Registration and login system.
  - User-specific session handling.

- **Product Management**
  - Add, update, and delete products.
  - Browse product catalog.
  - Search and filter options.

- **Shopping Cart**
  - Add/remove items to/from the cart.
  - View total cost dynamically.

- **Order Management**
  - Place orders.
  - Track order history.


## Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** EJS (Embedded JavaScript) templating engine
- **Database:** MongoDB with Mongoose
- **Authentication:** Express-sessions (with connect-mongodb-session for session storage) for session management, bcryptjs for password encryption
- **Security:** csurf for CSRF protection
- **Payment Gateway:** Integrated with **Stripe** for secure payment processing


## Architecture

This project follows the **Model-View-Controller (MVC)** pattern:

- **Model:** MongoDB collections, with schema definitions handled by Mongoose.
- **View:** EJS (Embedded JavaScript) templating engine
- **Controller:** Business logic is handled by Express.js controllers, interacting with models and rendering appropriate views or sending JSON responses.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mohamedzeina/online-shop.git
   cd online-shop
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables in a .env file:
   ```makefile
   MONGODB_URI=<your-mongodb-uri>
   NODEMAILER_API_KEY=<your-nodemailer-api-key>
   FROM_EMAIL=<email-used-for-nodemailer>
   STRIPE_PUB_KEY=<your-stripe-publishable-key>
   STRIPE_SECRET_KEY=<your-stripe-secret>
   ```
4. Start the development server:
   ```bash
   npm start
   ```
