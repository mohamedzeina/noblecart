const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const Product = require('../models/product');
const Order = require('../models/order');
const User = require('../models/user');
const fileHelper = require('../util/file');
const cloudinary = require('../util/cloudinary');
const pg = require('../util/paginationHelper');
const { sendStatusUpdate } = require('../util/email');

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

function uploadImage(file) {
  return uploadBuffer(file.buffer, { folder: 'noblecart' });
}

function uploadModel(file) {
  return uploadBuffer(file.buffer, { folder: 'noblecart-models', resource_type: 'raw', format: 'glb' });
}

exports.getAddProduct = (req, res, next) => {
  res.render('admin/edit-product', {
    pageTitle: 'Add Product',
    path: '/admin/add-product',
    editing: false,
    hasError: false,
    errorMessage: null,
    validationErrors: [],
  });
};

exports.postAddProduct = async (req, res, next) => {
  const title = req.body.title;
  const imageFile = req.files && req.files.image ? req.files.image[0] : null;
  const modelFile = req.files && req.files.model ? req.files.model[0] : null;
  const description = req.body.description;
  const price = req.body.price;
  const category = req.body.category;
  const stock = parseInt(req.body.stock, 10) || 0;

  if (!imageFile) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: { title, price, description, category, stock },
      errorMessage: 'Please provide a product image.',
      validationErrors: [],
    });
  }

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: { title, price, description, category, stock },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  try {
    const imageResult = await uploadImage(imageFile);
    const modelResult = modelFile ? await uploadModel(modelFile) : null;

    const product = new Product({
      title,
      price,
      imageUrl: imageResult.secure_url,
      imagePublicId: imageResult.public_id,
      modelUrl: modelResult ? modelResult.secure_url : undefined,
      modelPublicId: modelResult ? modelResult.public_id : undefined,
      description,
      category,
      stock,
      adminId: req.admin._id,
    });
    await product.save();
    res.redirect('/admin/products');
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit; // Query parameter
  if (!editMode) {
    return res.redirect('/');
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return res.redirect('/');
      }
      res.render('admin/edit-product', {
        pageTitle: 'Edit Product',
        path: '/admin/edit-product',
        editing: editMode,
        product: product,
        hasError: false,
        errorMessage: null,
        validationErrors: [],
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postEditProduct = async (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const imageFile = req.files && req.files.image ? req.files.image[0] : null;
  const modelFile = req.files && req.files.model ? req.files.model[0] : null;
  const updatedPrice = req.body.price;
  const updatedDesc = req.body.description;
  const updatedCategory = req.body.category;
  const updatedStock = parseInt(req.body.stock, 10) || 0;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Edit Product',
      path: '/admin/edit-product',
      editing: true,
      hasError: true,
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
        category: updatedCategory,
        stock: updatedStock,
        _id: prodId,
      },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  try {
    const product = await Product.findById(prodId);
    if (product.adminId.toString() !== req.admin._id.toString()) {
      return res.redirect('/');
    }

    product.title = updatedTitle;
    product.price = updatedPrice;
    product.stock = updatedStock;

    if (imageFile) {
      const imageResult = await uploadImage(imageFile);
      fileHelper.deleteFile(product.imagePublicId);
      product.imageUrl = imageResult.secure_url;
      product.imagePublicId = imageResult.public_id;
    }
    if (modelFile) {
      const modelResult = await uploadModel(modelFile);
      fileHelper.deleteModel(product.modelPublicId);
      product.modelUrl = modelResult.secure_url;
      product.modelPublicId = modelResult.public_id;
    }

    product.description = updatedDesc;
    product.category = updatedCategory;

    await product.save();
    res.redirect('/admin/products');
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.getAdminDashboard = async (req, res, next) => {
  try {
    const [
      revenueResult,
      paidOrders,
      topProducts,
      statusBreakdown,
      recentOrders,
      productCount,
    ] = await Promise.all([
      Order.aggregate([
        { $match: { status: { $ne: 'canceled' } } },
        { $unwind: '$products' },
        { $group: {
          _id: null,
          revenue: { $sum: { $multiply: ['$products.productData.price', '$products.quantity'] } },
        }},
      ]),
      Order.countDocuments({ status: { $ne: 'canceled' } }),
      Order.aggregate([
        { $match: { status: { $ne: 'canceled' } } },
        { $unwind: '$products' },
        { $group: {
          _id: '$products.productData.title',
          revenue: { $sum: { $multiply: ['$products.productData.price', '$products.quantity'] } },
          unitsSold: { $sum: '$products.quantity' },
        }},
        { $sort: { revenue: -1 } },
        { $limit: 5 },
      ]),
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Order.find().sort({ _id: -1 }).limit(5),
      Product.countDocuments(),
    ]);

    const totalRevenue = revenueResult[0]?.revenue || 0;
    const avgOrderValue = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    const recentOrdersMapped = recentOrders.map((o) => ({
      id: o._id.toString().slice(-6).toUpperCase(),
      email: o.user.email,
      date: o._id.getTimestamp(),
      status: o.status,
      total: o.products.reduce((sum, p) => sum + p.productData.price * p.quantity, 0),
    }));

    res.render('admin/dashboard', {
      pageTitle: 'Dashboard',
      path: '/admin/dashboard',
      totalRevenue,
      paidOrders,
      avgOrderValue,
      productCount,
      topProducts,
      statusBreakdown,
      recentOrders: recentOrdersMapped,
    });
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.getProducts = (req, res, next) => {
  const activeCategory = req.query.category || '';

  const filter = { adminId: req.admin._id };
  if (activeCategory) filter.category = activeCategory;

  const extraQuery = activeCategory ? `&category=${activeCategory}` : '';

  pg.paginationHelper(
    req,
    res,
    next,
    'admin/products',
    'Admin Products',
    '/admin/products',
    filter,
    { activeCategory, extraQuery }
  );
};

const ORDERS_PER_PAGE = 10;

exports.getAdminOrders = (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const activeStatus = req.query.status || '';
  const activeDate = req.query.date || '';

  const filter = {};
  if (activeStatus) filter.status = activeStatus;

  if (activeDate) {
    const now = new Date();
    const fromDate =
      activeDate === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) :
      activeDate === '7d'    ? new Date(now - 7  * 24 * 60 * 60 * 1000) :
      activeDate === '30d'   ? new Date(now - 30 * 24 * 60 * 60 * 1000) :
      null;
    if (fromDate) {
      const hex = Math.floor(fromDate.getTime() / 1000).toString(16).padStart(8, '0');
      filter._id = { $gte: new mongoose.Types.ObjectId(hex + '0000000000000000') };
    }
  }

  let totalOrders;
  Order.countDocuments(filter)
    .then((count) => {
      totalOrders = count;
      return Order.find(filter)
        .sort({ _id: -1 })
        .skip((page - 1) * ORDERS_PER_PAGE)
        .limit(ORDERS_PER_PAGE);
    })
    .then((orders) => {
      res.render('admin/orders', {
        pageTitle: 'All Orders',
        path: '/admin/orders',
        orders,
        activeStatus,
        activeDate,
        currentPage: page,
        hasNextPage: ORDERS_PER_PAGE * page < totalOrders,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
        lastPage: Math.ceil(totalOrders / ORDERS_PER_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.patchOrderStatus = (req, res, next) => {
  const { orderId } = req.params;
  const { status } = req.body;

  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return res.status(404).json({ message: 'Order not found.' });
      }
      if (!order.canTransitionTo(status)) {
        return res.status(422).json({ message: `Cannot transition from ${order.status} to ${status}.` });
      }
      return order.transitionTo(status).then(() => {
        sendStatusUpdate(order, order.user.email).catch(() => {});
        res.json({ status: order.status });
      });
    })
    .catch((err) => {
      res.status(500).json({ message: 'Failed to update order status.' });
    });
};

exports.getAdminProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product || product.adminId.toString() !== req.admin._id.toString()) {
      return res.redirect('/admin/products');
    }

    const Review = require('../models/review');

    const [reviews, ratingAgg, soldAgg] = await Promise.all([
      Review.find({ productId: product._id }).sort({ createdAt: -1 }).lean(),
      Review.aggregate([
        { $match: { productId: product._id } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $unwind: '$products' },
        { $match: { 'products.productData._id': product._id } },
        { $group: { _id: null, total: { $sum: '$products.quantity' } } },
      ]),
    ]);

    const rating = ratingAgg[0] || { avg: 0, count: 0 };
    const unitsSold = soldAgg[0]?.total || 0;

    res.render('admin/product-detail', {
      pageTitle: product.title,
      path: '/admin/products',
      product,
      reviews,
      rating,
      unitsSold,
      csrfToken: req.csrfToken(),
    });
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.postUpdateStock = async (req, res, next) => {
  try {
    const { productId, stock } = req.body;
    const product = await Product.findById(productId);
    if (!product || product.adminId.toString() !== req.admin._id.toString()) {
      return res.redirect('/admin/products');
    }
    product.stock = Math.max(0, parseInt(stock, 10) || 0);
    await product.save();
    res.redirect('/admin/product/' + productId);
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    next(error);
  }
};

exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.prodId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return res.status(404).json({ message: 'Product not found.' });
      }

      fileHelper.deleteFile(product.imagePublicId);
      fileHelper.deleteModel(product.modelPublicId);
      return Promise.all([
        Product.deleteOne({ _id: prodId, adminId: req.admin._id }),
        User.updateMany(
          { 'cart.items.productId': prodId },
          { $pull: { 'cart.items': { productId: prodId } } }
        ),
        User.updateMany(
          { 'wishlist.productId': prodId },
          { $pull: { wishlist: { productId: prodId } } }
        ),
      ]);
    })
    .then(() => {
      return Product.countDocuments({ adminId: req.admin._id });
    })
    .then((totalItems) => {
      res.status(200).json({ message: 'Deleting product succeeded.', totalItems });
    })
    .catch((err) => {
      res.status(500).json({ message: 'Deleting product failed.' });
    });
};
