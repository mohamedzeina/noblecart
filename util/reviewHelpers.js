const Review = require('../models/review');

exports.buildRatingsMap = (ids) =>
  Review.aggregate([
    { $match: { productId: { $in: ids } } },
    { $group: { _id: '$productId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]).then((agg) => {
    const map = {};
    agg.forEach((r) => { map[r._id.toString()] = { avg: r.avg, count: r.count }; });
    return map;
  });
