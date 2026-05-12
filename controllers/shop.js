const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const Product = require('../models/product');
const Order = require('../models/order');
const Review = require('../models/review');
const { sendOrderConfirmation } = require('../util/email');
const { buildRatingsMap } = require('../util/reviewHelpers');
const pg = require('../util/paginationHelper');

const REVIEWS_PER_PAGE = 5;

const REVIEW_SORT_OPTS = {
  newest:  { createdAt: -1 },
  highest: { rating: -1, createdAt: -1 },
  lowest:  { rating: 1,  createdAt: -1 },
};

function buildStockError(items) {
  const names = items.map((p) => p.productId.title).join(', ');
  return `${names} ${items.length === 1 ? 'is' : 'are'} out of stock or have insufficient quantity. Please update your cart.`;
}

function createStripeSession(cartProducts, req) {
  const baseUrl = req.protocol + '://' + req.get('host');
  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: cartProducts.map((p) => ({
      price_data: {
        currency: 'usd',
        product_data: { name: p.productId.title, description: p.productId.description },
        unit_amount: Math.round(p.productId.price * 100),
      },
      quantity: p.quantity,
    })),
    mode: 'payment',
    success_url: baseUrl + '/checkout/success',
    cancel_url: baseUrl + '/checkout/cancel',
  });
}

exports.getProduct = async (req, res, next) => {
  try {
    const prodId = req.params.productId;
    const activeReviewSort = REVIEW_SORT_OPTS[req.query.reviewSort] ? req.query.reviewSort : 'newest';

    const [product, reviews] = await Promise.all([
      Product.findById(prodId),
      Review.find({ productId: prodId }).sort(REVIEW_SORT_OPTS[activeReviewSort]),
    ]);

    const avgRating = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;
    const userReview = req.user
      ? reviews.find((r) => r.userId.toString() === req.user._id.toString())
      : null;
    const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: reviews.filter((r) => r.rating === star).length,
    }));
    const otherReviews = reviews.filter(
      (r) => !userReview || r._id.toString() !== userReview._id.toString()
    );
    const reviewError = req.flash('reviewError');

    const relatedProducts = await Product.aggregate([
      { $match: { category: product.category, _id: { $ne: product._id } } },
      { $lookup: { from: 'reviews', localField: '_id', foreignField: 'productId', as: '_r' } },
      { $addFields: { _avg: { $ifNull: [{ $avg: '$_r.rating' }, 0] } } },
      { $sort: { _avg: -1, _id: -1 } },
      { $project: { _r: 0, _avg: 0 } },
      { $limit: 4 },
    ]);

    const relatedRatingsMap = await buildRatingsMap(relatedProducts.map((p) => p._id));

    res.render('shop/product-detail', {
      pageTitle: product.title,
      path: '/products',
      product,
      reviews,
      displayedReviews: otherReviews.slice(0, REVIEWS_PER_PAGE),
      reviewsListTotal: otherReviews.length,
      avgRating,
      userReview,
      ratingBreakdown,
      activeReviewSort,
      reviewError: reviewError.length > 0 ? reviewError[0] : null,
      relatedProducts,
      relatedRatingsMap,
    });
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.getProductReviews = (req, res, next) => {
  const { productId } = req.params;
  const skip = parseInt(req.query.skip, 10) || 0;
  const activeReviewSort = REVIEW_SORT_OPTS[req.query.reviewSort] ? req.query.reviewSort : 'newest';
  const filter = { productId };
  if (req.user) filter.userId = { $ne: req.user._id };

  return Review.find(filter)
    .sort(REVIEW_SORT_OPTS[activeReviewSort])
    .skip(skip)
    .limit(REVIEWS_PER_PAGE)
    .then((reviews) => {
      res.json({
        reviews: reviews.map((r) => ({
          _id: r._id,
          userName: r.userName,
          rating: r.rating,
          comment: r.comment,
          verifiedPurchase: r.verifiedPurchase,
          createdAt: r.createdAt,
        })),
        hasMore: reviews.length === REVIEWS_PER_PAGE,
      });
    })
    .catch(() => res.status(500).json({ error: 'Failed to load reviews' }));
};

exports.getIndex = (req, res, next) => {
  pg.paginationHelper(req, res, next, 'shop/index', 'Noblecart', '/', {});
};

exports.getCategory = (req, res, next) => {
  const category = req.params.category;
  pg.paginationHelper(req, res, next, 'shop/index', category.charAt(0).toUpperCase() + category.slice(1), `/category/${category}`, { category }, { activeCategory: category });
};

exports.getSearch = (req, res, next) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.redirect('/');

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  Product.find({ $or: [{ title: regex }, { category: regex }, { description: regex }] })
    .then((products) => {
      if (products.length > 0) {
        return buildRatingsMap(products.map((p) => p._id)).then((ratingsMap) =>
          res.render('shop/search', {
            pageTitle: `"${query}"`,
            path: '/search',
            products,
            query,
            suggestions: [],
            ratingsMap,
          })
        );
      }
      return Product.find({}).limit(4).then((suggestions) =>
        buildRatingsMap(suggestions.map((p) => p._id)).then((ratingsMap) =>
          res.render('shop/search', {
            pageTitle: `"${query}"`,
            path: '/search',
            products: [],
            query,
            suggestions,
            ratingsMap,
          })
        )
      );
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getSearchSuggest = (req, res, next) => {
  const query = (req.query.q || '').trim();
  if (query.length < 2) return res.json({ results: [], query, wishlistedIds: [] });

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return Product.find({ $or: [{ title: regex }, { category: regex }] })
    .select('title price imageUrl category _id')
    .limit(6)
    .then((products) => {
      const productIds = products.map((p) => p._id);
      return buildRatingsMap(productIds).then((ratingsMap) => {
        const wishlistSet = req.user
          ? new Set(req.user.wishlist.map((i) => i.productId.toString()))
          : new Set();
        const wishlistedIds = products
          .filter((p) => wishlistSet.has(p._id.toString()))
          .map((p) => p._id.toString());

        const results = products.map((p) => ({
          _id: p._id,
          title: p.title,
          price: p.price,
          imageUrl: p.imageUrl,
          category: p.category,
          rating: ratingsMap[p._id.toString()] || null,
        }));

        res.json({ results, query, wishlistedIds });
      });
    })
    .catch(() => res.json({ results: [], query, wishlistedIds: [] }));
};

exports.getCartData = (req, res, next) => {
  return req.user
    .populate('cart.items.productId')
    .then((user) => {
      const items = user.cart.items.map((i) => ({
        productId: i.productId._id,
        title: i.productId.title,
        price: i.productId.price,
        imageUrl: i.productId.imageUrl,
        quantity: i.quantity,
      }));
      res.json({ items });
    })
    .catch((err) => {
      res.status(500).json({ error: 'Failed to load cart' });
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  return Product.findById(prodId)
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

  return Product.findById(productId)
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
  return req.user
    .removeFromCart(prodId)
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

exports.getOrders = async (req, res, next) => {
  try {
    const statusFilter = req.query.status || 'all';
    const query = { 'user.userId': req.user._id };
    if (statusFilter === 'active') {
      query.status = { $in: ['pending', 'confirmed', 'shipped', 'out_for_delivery'] };
    } else if (statusFilter === 'delivered' || statusFilter === 'canceled') {
      query.status = statusFilter;
    }

    const [orders, [rawCounts]] = await Promise.all([
      Order.find(query).sort({ _id: -1 }),
      Order.aggregate([
        { $match: { 'user.userId': req.user._id } },
        {
          $facet: {
            all:       [{ $count: 'n' }],
            active:    [{ $match: { status: { $in: ['pending', 'confirmed', 'shipped', 'out_for_delivery'] } } }, { $count: 'n' }],
            delivered: [{ $match: { status: 'delivered' } }, { $count: 'n' }],
            canceled:  [{ $match: { status: 'canceled' } },  { $count: 'n' }],
          },
        },
      ]),
    ]);

    const orderCounts = {
      all:       rawCounts?.all?.[0]?.n       || 0,
      active:    rawCounts?.active?.[0]?.n    || 0,
      delivered: rawCounts?.delivered?.[0]?.n || 0,
      canceled:  rawCounts?.canceled?.[0]?.n  || 0,
    };

    res.render('shop/orders', {
      path: '/orders',
      pageTitle: 'Your Orders',
      orders,
      statusFilter,
      orderCounts,
    });
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.postReorder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, 'user.userId': req.user._id });
    if (!order) return res.redirect('/orders');

    const productIds = order.products.map((p) => p.productData._id);
    const inStock = await Product.find({ _id: { $in: productIds }, stock: { $gt: 0 } });
    const inStockIds = new Set(inStock.map((p) => p._id.toString()));

    for (const { productData, quantity } of order.products) {
      if (!inStockIds.has(productData._id.toString())) continue;
      const idx = req.user.cart.items.findIndex(
        (i) => i.productId.toString() === productData._id.toString()
      );
      if (idx >= 0) {
        req.user.cart.items[idx].quantity += quantity;
      } else {
        req.user.cart.items.push({ productId: productData._id, quantity });
      }
    }
    await req.user.save();
    res.redirect('/checkout');
  } catch (err) {
    next(err);
  }
};

exports.getCheckout = async (req, res, next) => {
  try {
    const user = await req.user.populate('cart.items.productId');
    const cartProducts = user.cart.items;
    if (cartProducts.length === 0) return res.redirect('/');

    let total = 0;
    cartProducts.forEach((p) => { total += p.quantity * p.productId.price; });

    const outOfStock = cartProducts.filter((p) => p.productId.stock < p.quantity);
    if (outOfStock.length > 0) {
      return res.render('shop/checkout', {
        path: '/checkout',
        pageTitle: 'Checkout',
        products: cartProducts,
        totalSum: total,
        sessionId: null,
        stripePublicKey: process.env.STRIPE_PUB_KEY,
        stockError: buildStockError(outOfStock),
        csrfToken: req.csrfToken(),
      });
    }

    const session = await createStripeSession(cartProducts, req);

    res.render('shop/checkout', {
      path: '/checkout',
      pageTitle: 'Checkout',
      products: cartProducts,
      totalSum: total,
      sessionId: session.id,
      stripePublicKey: process.env.STRIPE_PUB_KEY,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.getCheckoutSession = async (req, res, next) => {
  try {
    const user = await req.user.populate('cart.items.productId');
    const cartProducts = user.cart.items;
    if (cartProducts.length === 0) return res.json({ sessionId: null, stockError: null });

    const overStock = cartProducts.filter((p) => p.productId.stock < p.quantity);
    if (overStock.length > 0) {
      return res.json({ sessionId: null, stockError: buildStockError(overStock) });
    }

    const session = await createStripeSession(cartProducts, req);
    res.json({ sessionId: session.id, stockError: null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session' });
  }
};

exports.getCheckoutSuccess = (req, res, next) => {
  return req.user
    .populate('cart.items.productId')
    .then((user) => {
      const cartItems = user.cart.items;
      const products = cartItems.map((i) => {
        return { quantity: i.quantity, productData: { ...i.productId._doc } };
      });

      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user._id,
        },
        products: products,
        status: 'pending',
        statusHistory: [{ status: 'pending', timestamp: new Date() }],
      });
      return order.save().then((savedOrder) => {
        return Promise.all(
          cartItems.map((item) =>
            Product.updateOne(
              { _id: item.productId._id },
              { $inc: { stock: -item.quantity } }
            )
          )
        ).then(() => savedOrder);
      });
    })
    .then((order) => {
      sendOrderConfirmation(order, order.user.email).catch(() => {});
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postWishlistToggle = (req, res, next) => {
  const prodId = req.body.productId;
  return req.user
    .toggleWishlist(prodId)
    .then(() => {
      const inWishlist = req.user.wishlist.some(
        (i) => i.productId.toString() === prodId.toString()
      );
      res.json({ success: true, inWishlist, wishlistCount: req.user.wishlist.length });
    })
    .catch(() => res.status(500).json({ error: 'Failed to update wishlist' }));
};

exports.getWishlist = (req, res, next) => {
  return req.user
    .populate('wishlist.productId')
    .then((user) => {
      const products = user.wishlist
        .filter((i) => i.productId)
        .map((i) => i.productId);
      return buildRatingsMap(products.map((p) => p._id)).then((ratingsMap) => {
        res.render('shop/wishlist', {
          path: '/wishlist',
          pageTitle: 'Wishlist',
          products,
          ratingsMap,
        });
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrderDetail = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, 'user.userId': req.user._id });
    if (!order) return next(new Error('No order found.'));
    res.render('shop/order-detail', {
      path: '/orders',
      pageTitle: 'Order Details',
      order,
    });
  } catch (err) {
    next(err);
  }
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
    const margin = 50;
    const contentRight = pageWidth - margin;
    const contentWidth = pageWidth - margin * 2;
    const invoiceDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const shortOrderId = '#' + orderId.toString().slice(-8).toUpperCase();

    // === HEADER ===
    pdfDoc.rect(0, 0, pageWidth, 100).fill('#0c0a09');
    pdfDoc.fillColor('#ffffff').fontSize(30).font('Helvetica-Bold').text('INVOICE', margin, 30);
    pdfDoc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
      .text('NOBLECART_', 0, 32, { align: 'right', width: contentRight });
    pdfDoc.fillColor('rgba(255,255,255,0.45)').fontSize(8).font('Helvetica')
      .text(invoiceDate, 0, 50, { align: 'right', width: contentRight });

    // Subtle separator below header
    pdfDoc.rect(0, 100, pageWidth, 1).fill('#2a2a2a');

    // === META: ORDER + BILLED TO side by side ===
    const metaY = 124;
    const col2X = margin + contentWidth * 0.5;

    pdfDoc.fillColor('#94a3b8').fontSize(7).font('Helvetica-Bold')
      .text('ORDER', margin, metaY, { characterSpacing: 1.5 });
    pdfDoc.fillColor('#0c0a09').fontSize(14).font('Helvetica-Bold')
      .text(shortOrderId, margin, metaY + 11);

    pdfDoc.fillColor('#94a3b8').fontSize(7).font('Helvetica-Bold')
      .text('BILLED TO', col2X, metaY, { characterSpacing: 1.5 });
    pdfDoc.fillColor('#0c0a09').fontSize(10).font('Helvetica')
      .text(order.user.email, col2X, metaY + 13);

    // Divider
    const dividerY = metaY + 46;
    pdfDoc.moveTo(margin, dividerY).lineTo(contentRight, dividerY)
      .strokeColor('#e2e8f0').lineWidth(1).stroke();

    // === TABLE HEADER ===
    const tableY = dividerY + 12;
    const ROW_H = 36;
    const COL_QTY = margin + Math.round(contentWidth * 0.58);
    const COL_PRICE = margin + Math.round(contentWidth * 0.71);
    const COL_TOTAL = margin + Math.round(contentWidth * 0.85);

    pdfDoc.rect(margin, tableY, contentWidth, 24).fill('#f8fafc');
    pdfDoc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica-Bold')
      .text('ITEM', margin + 10, tableY + 9, { characterSpacing: 1 })
      .text('QTY', COL_QTY, tableY + 9, { width: 40, align: 'center', characterSpacing: 1 })
      .text('UNIT PRICE', COL_PRICE, tableY + 9, { width: 70, align: 'right', characterSpacing: 1 })
      .text('TOTAL', COL_TOTAL, tableY + 9, { width: contentRight - COL_TOTAL, align: 'right', characterSpacing: 1 });

    // === PRODUCT ROWS ===
    let y = tableY + 24;
    let totalPrice = 0;

    order.products.forEach((prod, i) => {
      const lineTotal = prod.quantity * prod.productData.price;
      totalPrice += lineTotal;

      if (i % 2 === 1) {
        pdfDoc.rect(margin, y, contentWidth, ROW_H).fill('#fafafa');
      }

      const textY = y + ROW_H / 2 - 5;
      pdfDoc.fillColor('#334155').fontSize(10).font('Helvetica')
        .text(prod.productData.title, margin + 10, textY, { width: COL_QTY - margin - 16 })
        .text(String(prod.quantity), COL_QTY, textY, { width: 40, align: 'center' })
        .text('$' + prod.productData.price.toFixed(2), COL_PRICE, textY, { width: 70, align: 'right' });
      pdfDoc.fillColor('#0c0a09').font('Helvetica-Bold')
        .text('$' + lineTotal.toFixed(2), COL_TOTAL, textY, { width: contentRight - COL_TOTAL, align: 'right' });

      y += ROW_H;
      pdfDoc.moveTo(margin, y).lineTo(contentRight, y)
        .strokeColor('#f1f5f9').lineWidth(0.5).stroke();
    });

    // === TOTAL ROW ===
    const totalRowY = y + 14;
    pdfDoc.moveTo(margin, totalRowY).lineTo(contentRight, totalRowY)
      .strokeColor('#0c0a09').lineWidth(1.5).stroke();
    pdfDoc.fillColor('#64748b').fontSize(8).font('Helvetica')
      .text('TOTAL DUE', COL_PRICE, totalRowY + 10, { width: 70, align: 'right', characterSpacing: 0.8 });
    pdfDoc.fillColor('#0c0a09').fontSize(15).font('Helvetica-Bold')
      .text('$' + totalPrice.toFixed(2), COL_TOTAL, totalRowY + 7, { width: contentRight - COL_TOTAL, align: 'right' });

    // === FOOTER ===
    const footerY = totalRowY + 62;
    pdfDoc.moveTo(margin, footerY).lineTo(contentRight, footerY)
      .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    pdfDoc.fillColor('#cbd5e1').fontSize(7.5).font('Helvetica')
      .text('Thank you for your purchase — Noblecart_', margin, footerY + 10, {
        align: 'center',
        width: contentWidth,
      });

    pdfDoc.end();
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  }
};

exports.postReview = (req, res, next) => {
  const { productId } = req.params;
  const { rating, comment } = req.body;
  const ratingNum = parseInt(rating, 10);

  if (!ratingNum || ratingNum < 1 || ratingNum > 5 || !comment || !comment.trim()) {
    req.flash('reviewError', 'Please select a star rating and write a comment.');
    return res.redirect('/products/' + productId);
  }

  return Order.findOne({ 'user.userId': req.user._id, 'products.productData._id': productId })
    .then((order) => new Review({
      productId,
      userId: req.user._id,
      userName: req.user.name || req.user.email.split('@')[0],
      userAvatar: req.user.avatar || '',
      rating: ratingNum,
      comment,
      verifiedPurchase: !!order,
    }).save())
    .then(() => res.redirect('/products/' + productId))
    .catch((err) => {
      if (err.code === 11000) return res.redirect('/products/' + productId);
      next(new Error(err));
    });
};

exports.putReview = (req, res, next) => {
  const { productId } = req.params;
  const { rating, comment } = req.body;
  const ratingNum = parseInt(rating, 10);

  if (!ratingNum || ratingNum < 1 || ratingNum > 5 || !comment || !comment.trim()) {
    req.flash('reviewError', 'Please select a star rating and write a comment.');
    return res.redirect('/products/' + productId);
  }

  return Review.findOneAndUpdate(
    { productId, userId: req.user._id },
    { rating: ratingNum, comment },
    { new: true }
  )
    .then(() => res.redirect('/products/' + productId))
    .catch((err) => next(new Error(err)));
};

exports.deleteReview = (req, res, next) => {
  const { productId } = req.params;

  return Review.findOneAndDelete({ productId, userId: req.user._id })
    .then(() => res.redirect('/products/' + productId))
    .catch((err) => next(new Error(err)));
};
