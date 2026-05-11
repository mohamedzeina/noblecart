module.exports = (req, res, next) => {
  if (req.admin === undefined && req.user === undefined) {
    return res.redirect('/admin/login');
  }
  if (req.admin === undefined) {
    return res.status(403).render('403', { pageTitle: 'Access Denied', path: '' });
  }
  next();
};
