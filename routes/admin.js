const express = require('express');

const adminController = require('../controllers/admin');
const isAuth = require('../middleware/is-auth');
const { body } = require('express-validator');

const router = express.Router();

// /admin/add-product => GET
router.get('/add-product', isAuth, adminController.getAddProduct);

// /admin/add-product => POST
router.post(
  '/add-product',
  [
    body(
      'title',
      'Title has to be a string that is at least 3 characters long.'
    )
      .isString()
      .isLength({ min: 3 })
      .trim(),
    body('price', 'Please enter a valid price.').isFloat(),
    body('description').isLength({ min: 5, max: 400 }).trim(),
    body('category', 'Please select a valid category.').isIn(['electronics', 'fashion', 'home', 'accessories']),
  ],
  isAuth,
  adminController.postAddProduct
);

// /admin/products => GET
router.get('/products', isAuth, adminController.getProducts);

// /admin/orders => GET
router.get('/orders', isAuth, adminController.getAdminOrders);

router.get('/edit-product/:productId', isAuth, adminController.getEditProduct);

router.post(
  '/edit-product',
  [
    body(
      'title',
      'Title has to be a string that is at least 3 characters long.'
    )
      .isString()
      .isLength({ min: 3 })
      .trim(),
    body('price', 'Please enter a valid price.').isFloat(),
    body(
      'description',
      'Description has to be a string that is between 5 and 400 characters long.'
    )
      .isLength({ min: 5, max: 400 })
      .trim(),
    body('category', 'Please select a valid category.').isIn(['electronics', 'fashion', 'home', 'accessories']),
  ],
  isAuth,
  adminController.postEditProduct
);

router.delete('/product/:prodId', isAuth, adminController.deleteProduct);

module.exports = router;
