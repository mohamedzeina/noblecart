module.exports = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).render('403', { pageTitle: 'Access Denied', path: '' });
  }
  next();
};
