const { validationResult } = require('express-validator');

const Product = require('../models/product');
const User = require('../models/user');
const fileHelper = require('../util/file');
const pg = require('../util/paginationHelper');

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
  const image = req.file;
  const description = req.body.description;
  const price = req.body.price;
  const category = req.body.category;

  if (!image) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add Product',
      path: '/admin/add-product',
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description,
        category: category,
      },
      errorMessage: 'Attached file is not an image.',
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
      product: {
        title: title,
        price: price,
        description: description,
        category: category,
      },
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
    });
  }

  const imageUrl = image.path;
  const imagePublicId = image.filename;

  const product = new Product({
    title: title,
    price: price,
    imageUrl: imageUrl,
    imagePublicId: imagePublicId,
    description: description,
    category: category,
    userId: req.user,
  });
  product
    .save()
    .then(() => {
      console.log('Created Product Successfully');
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
  const image = req.file;
  const updatedPrice = req.body.price;
  const updatedDesc = req.body.description;
  const updatedCategory = req.body.category;

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(updatedDesc);
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
      if (product.userId.toString() !== req.user._id.toString()) {
        return res.redirect('/');
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      if (image) {
        fileHelper.deleteFile(product.imagePublicId);
        product.imageUrl = image.path;
        product.imagePublicId = image.filename;
      }
      product.description = updatedDesc;
      product.category = updatedCategory;

      return product.save().then(() => {
        console.log('Updated Product Successfully');
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
    { userId: req.user._id }
  );
};

exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.prodId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return new Error('Product not found.');
      }

      fileHelper.deleteFile(product.imagePublicId);
      return Promise.all([
        Product.deleteOne({ _id: prodId, userId: req.user._id }),
        User.updateMany(
          { 'cart.items.productId': prodId },
          { $pull: { 'cart.items': { productId: prodId } } }
        ),
      ]);
    })
    .then(() => {
      return Product.countDocuments({ userId: req.user._id });
    })
    .then((totalItems) => {
      console.log('Deleted Product Successfully');
      res.status(200).json({ message: 'Deleting product succeeded.', totalItems });
    })
    .catch((err) => {
      res.status(500).json({ message: 'Deleting product failed.' });
    });
};
