const Product = require('../models/product');

const ITEMS_PER_PAGE = 6;
const paginationHelper = (
  req,
  res,
  next,
  pageToRender,
  pageTitle,
  path,
  filter,
  extraData = {}
) => {
  const page = parseInt(req.query.page, 10) || 1;
  let totalItems;

  Product.find(filter)
    .countDocuments()
    .then((numProds) => {
      totalItems = numProds;
      return Product.find(filter)
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render(pageToRender, {
        prods: products,
        pageTitle: pageTitle,
        path: path,
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPrevPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        ...extraData,
      }); // Passing options to the template
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.paginationHelper = paginationHelper;
