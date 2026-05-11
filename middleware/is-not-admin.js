module.exports = (req, res, next) => {
  if (req.admin !== undefined) {
    return res.redirect('/admin/products');
  }
  next();
};
