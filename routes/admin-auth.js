const express = require('express');
const { body } = require('express-validator');

const adminAuthController = require('../controllers/admin-auth');

const router = express.Router();

router.get('/login', adminAuthController.getLogin);

router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .normalizeEmail(),
    body('password', 'Please enter a password that is at least 6 characters long.')
      .isLength({ min: 6 })
      .trim(),
  ],
  adminAuthController.postLogin
);

router.post('/logout', adminAuthController.postLogout);

module.exports = router;
