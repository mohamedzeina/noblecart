const express = require('express');

const shopController = require('../controllers/shop');
const isAuth = require('../middleware/is-auth');
const isNotAdmin = require('../middleware/is-not-admin');

const router = express.Router();

router.use(isNotAdmin);

router.get('/', shopController.getIndex);

router.get('/category/:category', shopController.getCategory);

router.get('/products/:productId', shopController.getProduct);

router.get('/search/suggest', shopController.getSearchSuggest);

router.get('/search', shopController.getSearch);

router.get('/cart/data', isAuth, shopController.getCartData);

router.post('/cart', isAuth, shopController.postCart);

router.post('/cart-update', isAuth, shopController.postCartUpdate);

router.post('/cart-delete-item', isAuth, shopController.postCartDeleteProduct);

router.get('/orders', isAuth, shopController.getOrders);

router.get('/checkout', isAuth, shopController.getCheckout);

router.get('/checkout/session', isAuth, shopController.getCheckoutSession);

router.get('/checkout/success', isAuth, shopController.getCheckoutSuccess);

router.get('/checkout/cancel', isAuth, (req, res) => res.redirect('/checkout'));

router.post('/wishlist-toggle', isAuth, shopController.postWishlistToggle);

router.get('/wishlist', isAuth, shopController.getWishlist);

router.get('/orders/:orderId', isAuth, shopController.getOrderDetail);
router.get('/orders/:orderId/invoice', isAuth, shopController.getInvoice);
router.post('/orders/:orderId/reorder', isAuth, shopController.postReorder);

router.get('/products/:productId/reviews', shopController.getProductReviews);
router.post('/products/:productId/review', isAuth, shopController.postReview);
router.post('/products/:productId/review/update', isAuth, shopController.putReview);
router.post('/products/:productId/review/delete', isAuth, shopController.deleteReview);

module.exports = router;
