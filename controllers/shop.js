const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');


const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const Product = require('../models/product');
const Order = require('../models/order');
const pg = require('../util/paginationHelper');


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
      const cartCount = req.user.cart.items.reduce((sum, i) => sum + i.quantity, 0);
      if (req.headers['x-requested-with'] === 'fetch') {
        return res.json({ success: true, cartCount });
      }
      res.redirect('/cart');
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartUpdate = (req, res, next) => {
  const { productId, action } = req.body;
  let productPrice;

  Product.findById(productId)
    .then((product) => {
      if (!product) throw new Error('Product not found');
      productPrice = product.price;
      return action === 'increase'
        ? req.user.addToCart(product)
        : req.user.decrementFromCart(productId);
    })
    .then(() => {
      const cartCount = req.user.cart.items.reduce((sum, i) => sum + i.quantity, 0);
      const cartItem = req.user.cart.items.find(
        (i) => i.productId.toString() === productId
      );
      const itemQuantity = cartItem ? cartItem.quantity : 0;
      const itemTotal = (itemQuantity * productPrice).toFixed(2);
      res.json({ cartCount, itemQuantity, itemTotal, removed: itemQuantity === 0 });
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


exports.getInvoice = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);

    if (!order) return next(new Error('No order found.'));
    if (order.user.userId.toString() !== req.user._id.toString()) {
      return next(new Error('Unauthorized access.'));
    }

    const invoiceName = 'invoice-' + orderId + '.pdf';
    const invoicePath = path.join('invoices', invoiceName);

    fs.mkdirSync('invoices', { recursive: true });

    const pdfDoc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + invoiceName + '"');
    pdfDoc.pipe(fs.createWriteStream(invoicePath));
    pdfDoc.pipe(res);

    const pageWidth = pdfDoc.page.width;
    const contentRight = pageWidth - 50;

    // Header bar
    pdfDoc.rect(0, 0, pageWidth, 75).fill('#0f766e');
    pdfDoc.fillColor('white').fontSize(26).font('Helvetica-Bold').text('INVOICE', 50, 22);
    pdfDoc.fontSize(10).font('Helvetica')
      .text('Noblecart', 0, 25, { align: 'right', width: contentRight })
      .text('online-shop-luts.onrender.com', 0, 40, { align: 'right', width: contentRight });

    // Order meta
    pdfDoc.fillColor('#475569').fontSize(10).font('Helvetica-Bold').text('ORDER ID', 50, 100);
    pdfDoc.font('Helvetica').fillColor('#1e293b').fontSize(10).text(orderId, 50, 114);
    pdfDoc.fillColor('#475569').fontSize(10).font('Helvetica-Bold').text('BILLED TO', 50, 135);
    pdfDoc.font('Helvetica').fillColor('#1e293b').text(order.user.email, 50, 149);

    // Divider
    pdfDoc.moveTo(50, 175).lineTo(contentRight, 175).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // Table header
    const ROW_H = 32;
    const COL_QTY = 340;
    const COL_PRICE = 390;
    const COL_TOTAL = 470;

    pdfDoc.rect(50, 182, pageWidth - 100, 22).fill('#f8fafc');
    pdfDoc.fillColor('#64748b').fontSize(9).font('Helvetica-Bold')
      .text('ITEM', 60, 189)
      .text('QTY', COL_QTY, 189, { width: 44, align: 'center' })
      .text('UNIT PRICE', COL_PRICE, 189, { width: 74, align: 'right' })
      .text('TOTAL', COL_TOTAL, 189, { width: contentRight - COL_TOTAL, align: 'right' });

    // Products
    let y = 212;
    let totalPrice = 0;

    order.products.forEach((prod, i) => {
      const lineTotal = prod.quantity * prod.productData.price;
      totalPrice += lineTotal;
      const midY = y + ROW_H / 2;

      pdfDoc.fillColor('#1e293b').fontSize(11).font('Helvetica')
        .text(prod.productData.title, 60, midY - 6, { width: 270 })
        .text(String(prod.quantity), COL_QTY, midY - 6, { width: 44, align: 'center' })
        .text('$' + prod.productData.price.toFixed(2), COL_PRICE, midY - 6, { width: 74, align: 'right' });
      pdfDoc.fillColor('#0f766e').font('Helvetica-Bold')
        .text('$' + lineTotal.toFixed(2), COL_TOTAL, midY - 6, { width: contentRight - COL_TOTAL, align: 'right' });

      y += ROW_H;
      pdfDoc.moveTo(50, y).lineTo(contentRight, y).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
    });

    // Total row
    pdfDoc.moveTo(50, y + 10).lineTo(contentRight, y + 10).strokeColor('#e2e8f0').lineWidth(1).stroke();
    pdfDoc.fillColor('#0f766e').fontSize(13).font('Helvetica-Bold')
      .text('TOTAL', COL_PRICE, y + 20, { width: 74, align: 'right' })
      .text('$' + totalPrice.toFixed(2), COL_TOTAL, y + 20, { width: contentRight - COL_TOTAL, align: 'right' });

    pdfDoc.end();
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  }
};
