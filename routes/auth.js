const express = require('express');
const { body } = require('express-validator');

const authController = require('../controllers/auth');
const User = require('../models/user');

const router = express.Router();

router.get('/login', authController.getLogin);

router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .normalizeEmail(),
    body(
      'password',
      'Please enter a password that is at least 6 characters long.'
    )
      .isLength({ min: 6 })
      .trim(),
  ],
  authController.postLogin
);

router.get('/signup', authController.getSignup);

router.post(
  '/signup',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Please enter your name.')
      .isLength({ max: 100 })
      .withMessage('Name must be 100 characters or fewer.'),
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email.')
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject(
              'E-Mail exists already, please pick a different one.'
            );
          }
        });
      })
      .normalizeEmail(),
    body(
      'password',
      'Please enter a password that is at least 6 characters long.'
    )
      .isLength({ min: 6 })
      .trim(),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords have to match!');
        }
        return true;
      })
      .trim(),
  ],
  authController.postSignup
);

router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post(
  '/new-password',
  [
    body(
      'password',
      'Please enter a password that is at least 6 characters long.'
    )
      .isLength({ min: 6 })
      .trim(),
  ],
  authController.postNewPassword
);

module.exports = router;
