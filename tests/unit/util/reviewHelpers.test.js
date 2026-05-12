jest.mock('../../../models/review');

const mongoose = require('mongoose');
const Review = require('../../../models/review');
const { buildRatingsMap } = require('../../../util/reviewHelpers');

function id() {
  return new mongoose.Types.ObjectId();
}

describe('buildRatingsMap', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a map keyed by productId string', async () => {
    const id1 = id();
    const id2 = id();
    Review.aggregate = jest.fn().mockResolvedValue([
      { _id: id1, avg: 4.5, count: 10 },
      { _id: id2, avg: 3.2, count: 5 },
    ]);

    const map = await buildRatingsMap([id1, id2]);

    expect(map[id1.toString()]).toEqual({ avg: 4.5, count: 10 });
    expect(map[id2.toString()]).toEqual({ avg: 3.2, count: 5 });
  });

  it('returns an empty map when no reviews exist', async () => {
    Review.aggregate = jest.fn().mockResolvedValue([]);
    const map = await buildRatingsMap([id()]);
    expect(map).toEqual({});
  });

  it('passes the provided ids to the $match stage', async () => {
    const ids = [id(), id()];
    Review.aggregate = jest.fn().mockResolvedValue([]);
    await buildRatingsMap(ids);

    const pipeline = Review.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match.productId.$in).toEqual(ids);
  });

  it('handles an empty ids array without throwing', async () => {
    Review.aggregate = jest.fn().mockResolvedValue([]);
    await expect(buildRatingsMap([])).resolves.toEqual({});
  });

  it('groups by productId using $avg and $sum in the pipeline', async () => {
    Review.aggregate = jest.fn().mockResolvedValue([]);
    await buildRatingsMap([id()]);

    const pipeline = Review.aggregate.mock.calls[0][0];
    const groupStage = pipeline[1].$group;
    expect(groupStage.avg).toEqual({ $avg: '$rating' });
    expect(groupStage.count).toEqual({ $sum: 1 });
  });
});
