const express = require('express');

const adminController = require('../controllers/admin');
const isAdmin = require('../middleware/is-admin');
const { body } = require('express-validator');

const router = express.Router();

router.get('/dashboard', isAdmin, adminController.getAdminDashboard);

// /admin/add-product => GET
router.get('/add-product', isAdmin, adminController.getAddProduct);

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
    body('category', 'Please select a valid category.').isIn(['electronics', 'fashion', 'home', 'wearables']),
  ],
  isAdmin,
  adminController.postAddProduct
);

// /admin/products => GET
router.get('/products', isAdmin, adminController.getProducts);

// /admin/orders => GET
router.get('/orders', isAdmin, adminController.getAdminOrders);

router.get('/edit-product/:productId', isAdmin, adminController.getEditProduct);

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
    body('category', 'Please select a valid category.').isIn(['electronics', 'fashion', 'home', 'wearables']),
  ],
  isAdmin,
  adminController.postEditProduct
);

router.get('/product/:productId', isAdmin, adminController.getAdminProduct);

router.post('/update-stock', isAdmin, adminController.postUpdateStock);

router.delete('/product/:prodId', isAdmin, adminController.deleteProduct);

router.patch('/order/:orderId/status', isAdmin, adminController.patchOrderStatus);

module.exports = router;
