const Product = require('../models/product');

const ITEMS_PER_PAGE = 6;
const paginationHelper = (
  req,
  res,
  next,
  pageToRender,
  pageTitle,
  path,
  filter
) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find(filter)
    .countDocuments()
    .then((numProds) => {
      totalItems = numProds;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE) // Skips amount of products
        .limit(ITEMS_PER_PAGE); // Limits the amount of data you get
    });
  Product.find(filter)
    .countDocuments()
    .then((numProds) => {
      totalItems = numProds;
      return Product.find(filter)
        .skip((page - 1) * ITEMS_PER_PAGE) // Skips amount of products
        .limit(ITEMS_PER_PAGE); // Limits the amount of data you get
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
