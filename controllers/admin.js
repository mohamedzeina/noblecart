const { validationResult } = require('express-validator');

const Product = require('../models/product');
const Order = require('../models/order');
const User = require('../models/user');
const fileHelper = require('../util/file');
const pg = require('../util/paginationHelper');
const { sendStatusUpdate } = require('../util/email');

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

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.files && req.files.image ? req.files.image[0] : null;
  const model = req.files && req.files.model ? req.files.model[0] : null;
  const description = req.body.description;
  const price = req.body.price;
  const category = req.body.category;

  if (!image) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: { title, price, description, category },
      errorMessage: 'Please provide a product image.',
      validationErrors: [],
    });
  }

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    fileHelper.deleteFile(image.filename);
    if (model) fileHelper.deleteModel(model.filename);
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: { title, price, description, category },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  const product = new Product({
    title,
    price,
    imageUrl: image.path,
    imagePublicId: image.filename,
    modelUrl: model ? model.path : undefined,
    modelPublicId: model ? model.filename : undefined,
    description,
    category,
    adminId: req.admin._id,
  });
  product
    .save()
    .then(() => {
      res.redirect('/admin/products');
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
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

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const image = req.files && req.files.image ? req.files.image[0] : null;
  const model = req.files && req.files.model ? req.files.model[0] : null;
  const updatedPrice = req.body.price;
  const updatedDesc = req.body.description;
  const updatedCategory = req.body.category;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    if (image) fileHelper.deleteFile(image.filename);
    if (model) fileHelper.deleteModel(model.filename);
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
        _id: prodId,
      },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  Product.findById(prodId)
    .then((product) => {
      if (product.adminId.toString() !== req.admin._id.toString()) {
        return res.redirect('/');
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      if (image) {
        fileHelper.deleteFile(product.imagePublicId);
        product.imageUrl = image.path;
        product.imagePublicId = image.filename;
      }
      if (model) {
        fileHelper.deleteModel(product.modelPublicId);
        product.modelUrl = model.path;
        product.modelPublicId = model.filename;
      }
      product.description = updatedDesc;
      product.category = updatedCategory;

      return product.save().then(() => {
        res.redirect('/admin/products');
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProducts = (req, res, next) => {
  pg.paginationHelper(
    req,
    res,
    next,
    'admin/products',
    'Admin Products',
    '/admin/products',
    { adminId: req.admin._id }
  );
};

const ORDERS_PER_PAGE = 10;

exports.getAdminOrders = (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  let totalOrders;

  Order.countDocuments()
    .then((count) => {
      totalOrders = count;
      return Order.find()
        .sort({ _id: -1 })
        .skip((page - 1) * ORDERS_PER_PAGE)
        .limit(ORDERS_PER_PAGE);
    })
    .then((orders) => {
      res.render('admin/orders', {
        pageTitle: 'All Orders',
        path: '/admin/orders',
        orders,
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
