const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');

const Admin = require('../models/admin');

exports.getLogin = (req, res, next) => {
  let message = req.flash('adminLoginError');
  res.render('admin/login', {
    path: '/admin/login',
    pageTitle: 'Admin Login',
    errorMessage: message.length > 0 ? message[0] : null,
    oldInput: { email: '' },
    validationErrors: [],
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render('admin/login', {
      path: '/admin/login',
      pageTitle: 'Admin Login',
      errorMessage: errors.array()[0].msg,
      oldInput: { email },
      validationErrors: errors.array(),
    });
  }

  Admin.findOne({ email })
    .then((admin) => {
      if (!admin) {
        return res.status(422).render('admin/login', {
          path: '/admin/login',
          pageTitle: 'Admin Login',
          errorMessage: 'Invalid email or password.',
          oldInput: { email },
          validationErrors: [],
        });
      }
      return bcrypt.compare(password, admin.password).then((doMatch) => {
        if (!doMatch) {
          return res.status(422).render('admin/login', {
            path: '/admin/login',
            pageTitle: 'Admin Login',
            errorMessage: 'Invalid email or password.',
            oldInput: { email },
            validationErrors: [],
          });
        }
        return req.session.regenerate((err) => {
          if (err) {
            console.log(err);
            return res.redirect('/admin/login');
          }
          req.session.adminId = admin._id;
          req.session.save((saveErr) => {
            if (saveErr) console.log(saveErr);
            res.redirect('/admin/orders');
          });
        });
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) console.log(err);
    res.redirect('/admin/login');
  });
};
