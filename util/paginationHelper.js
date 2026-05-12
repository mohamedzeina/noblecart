const Product = require('../models/product');
const { buildRatingsMap } = require('./reviewHelpers');

const ITEMS_PER_PAGE = 6;
const VALID_SORTS = ['newest', 'price-asc', 'price-desc', 'top-rated'];
const SORT_OPTS = {
  'newest':     { _id: -1 },
  'price-asc':  { price: 1 },
  'price-desc': { price: -1 },
};

const VALID_PRICES = ['0-50', '50-200', '200-500', '500up'];
const PRICE_FILTERS = {
  '0-50':    { $lt: 50 },
  '50-200':  { $gte: 50, $lte: 200 },
  '200-500': { $gte: 200, $lte: 500 },
  '500up':   { $gte: 500 },
};

const paginationHelper = async (req, res, next, pageToRender, pageTitle, path, filter, extraData = {}) => {
  const page = parseInt(req.query.page, 10) || 1;
  const activeSort = VALID_SORTS.includes(req.query.sort) ? req.query.sort : 'newest';
  const activePrice = VALID_PRICES.includes(req.query.price) ? req.query.price : 'all';

  if (activePrice !== 'all') {
    filter = { ...filter, price: PRICE_FILTERS[activePrice] };
  }

  const extraQuery = (extraData.extraQuery || '')
    + (activeSort !== 'newest' ? `&sort=${activeSort}` : '')
    + (activePrice !== 'all' ? `&price=${activePrice}` : '');

  const productQuery = activeSort === 'top-rated'
    ? Product.aggregate([
        { $match: filter },
        { $lookup: { from: 'reviews', localField: '_id', foreignField: 'productId', as: '_r' } },
        { $addFields: { _avg: { $ifNull: [{ $avg: '$_r.rating' }, 0] } } },
        { $sort: { _avg: -1, _id: -1 } },
        { $project: { _r: 0, _avg: 0 } },
        { $skip: (page - 1) * ITEMS_PER_PAGE },
        { $limit: ITEMS_PER_PAGE },
      ])
    : Product.find(filter)
        .sort(SORT_OPTS[activeSort])
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);

  try {
    const [totalItems, products] = await Promise.all([
      Product.countDocuments(filter),
      productQuery,
    ]);

    const ratingsMap = await buildRatingsMap(products.map((p) => p._id));

    res.render(pageToRender, {
      prods: products,
      ratingsMap,
      pageTitle,
      path,
      currentPage: page,
      hasNextPage: ITEMS_PER_PAGE * page < totalItems,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      activeSort,
      activePrice,
      ...extraData,
      extraQuery,
    });
  } catch (err) {
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  }
};

exports.paginationHelper = paginationHelper;
