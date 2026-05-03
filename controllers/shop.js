const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');


const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const Product = require('../models/product');
const Order = require('../models/order');
const pg = require('../util/paginationHelper');

exports.getProducts = (req, res, next) => {
  pg.paginationHelper(
    req,
    res,
    next,
    'shop/product-list',
    'All Products',
    '/products',
    {}
  );
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId; // Extracting dynamic parameter from path
  Product.findById(prodId)
    .then((product) => {
      res.render('shop/product-detail', {
        pageTitle: product.title,
        path: '/products',
        product: product,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  pg.paginationHelper(req, res, next, 'shop/index', 'Shop', '/', {});
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then((user) => {
      const cartProducts = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: cartProducts,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then(() => {
      console.log('Added Product to Cart Successfully');
      res.redirect('/cart');
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(() => {
      console.log('Product Removed from Cart Successfully');
      res.redirect('/cart');
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then((orders) => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  let cartProducts;
  let total = 0;
  req.user
    .populate('cart.items.productId')
    .then((user) => {
      cartProducts = user.cart.items;
      cartProducts.forEach((p) => {
        total += p.quantity * p.productId.price;
      });

      return stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: cartProducts.map((p) => {
          return {
            price_data: {
              currency: 'usd',
              product_data: {
                name: p.productId.title,
                description: p.productId.description,
              },
              unit_amount: p.productId.price * 100,
            },
            quantity: p.quantity,
          };
        }),
        mode: 'payment',
        success_url:
          req.protocol + '://' + req.get('host') + '/checkout/success',
        cancel_url: req.protocol + '://' + req.get('host') + '/checkout/cancel',
      });
    })
    .then((session) => {
      res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: cartProducts,
        totalSum: total,
        sessionId: session.id,
        stripePublicKey: process.env.STRIPE_PUB_KEY,
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, productData: { ...i.productId._doc } }; // _doc to pull out all the data inside the object
      });

      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user._id,
        },
        products: products,
      });
      return order.save();
    })
    .then(() => {
      return req.user.clearCart();
    })
    .then(() => {
      console.log('Order Placed Successfully');
      res.redirect('/orders');
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, productData: { ...i.productId._doc } }; // _doc to pull out all the data inside the object
      });

      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user._id,
        },
        products: products,
      });
      return order.save();
    })
    .then(() => {
      return req.user.clearCart();
    })
    .then(() => {
      console.log('Order Placed Successfully');
      res.redirect('/orders');
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error('No order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        console.log(order.user.userId.toString());
        console.log(req.user._id.toString());
        return next(new Error('Unauthorized access.'));
      }

      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('invoices', invoiceName);

      const pdfDoc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + invoiceName + '"'
      );
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text('Order #' + orderId, {
        underline: true,
      });
      pdfDoc.text('---------------');
      let totalPrice = 0;
      order.products.forEach((prod) => {
        totalPrice = totalPrice + prod.quantity * prod.productData.price;
        pdfDoc
          .fontSize(14)
          .text(
            prod.productData.title +
              ' - ' +
              prod.quantity +
              ' x ' +
              '$' +
              prod.productData.price
          );
      });
      pdfDoc.fontSize(26).text('---------------');
      pdfDoc.fontSize(20).text('Total Price: $' + totalPrice);

      pdfDoc.end();
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};
