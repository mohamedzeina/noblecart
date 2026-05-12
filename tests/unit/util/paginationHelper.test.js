jest.mock('../../../models/product');
jest.mock('../../../util/reviewHelpers');

const mongoose = require('mongoose');
const Product = require('../../../models/product');
const { buildRatingsMap } = require('../../../util/reviewHelpers');
const { paginationHelper } = require('../../../util/paginationHelper');

function makeReq(query = {}) {
  return { query: { page: '1', ...query } };
}

function makeRes() {
  return { render: jest.fn() };
}

function mockFind(items = []) {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(items),
  };
  Product.find.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  Product.countDocuments = jest.fn().mockResolvedValue(0);
  Product.aggregate = jest.fn().mockResolvedValue([]);
  buildRatingsMap.mockResolvedValue({});
  mockFind([]);
});

// ─── pagination math ─────────────────────────────────────────────────────────

describe('pagination math', () => {
  it('computes lastPage from total item count', async () => {
    Product.countDocuments.mockResolvedValue(12);
    const res = makeRes();
    await paginationHelper(makeReq(), res, jest.fn(), 'shop/index', 'Test', '/', {});
    const [, data] = res.render.mock.calls[0];
    expect(data.lastPage).toBe(2);
  });

  it('sets hasNextPage true when more pages remain', async () => {
    Product.countDocuments.mockResolvedValue(12);
    const res = makeRes();
    await paginationHelper(makeReq({ page: '1' }), res, jest.fn(), 'shop/index', 'Test', '/', {});
    const [, data] = res.render.mock.calls[0];
    expect(data.hasNextPage).toBe(true);
    expect(data.hasPrevPage).toBe(false);
  });

  it('sets hasPrevPage true on page 2+', async () => {
    Product.countDocuments.mockResolvedValue(12);
    const res = makeRes();
    await paginationHelper(makeReq({ page: '2' }), res, jest.fn(), 'shop/index', 'Test', '/', {});
    const [, data] = res.render.mock.calls[0];
    expect(data.hasPrevPage).toBe(true);
    expect(data.hasNextPage).toBe(false);
  });
});

// ─── price filtering ─────────────────────────────────────────────────────────

describe('price filtering', () => {
  const cases = [
    ['0-50',    { $lt: 50 }],
    ['50-200',  { $gte: 50, $lte: 200 }],
    ['200-500', { $gte: 200, $lte: 500 }],
    ['500up',   { $gte: 500 }],
  ];

  test.each(cases)('price=%s applies correct MongoDB filter', async (price, expected) => {
    const res = makeRes();
    await paginationHelper(makeReq({ price }), res, jest.fn(), 'shop/index', 'Test', '/', {});
    const filterArg = Product.countDocuments.mock.calls[0][0];
    expect(filterArg.price).toEqual(expected);
  });

  it('omits price filter for "all"', async () => {
    const res = makeRes();
    await paginationHelper(makeReq(), res, jest.fn(), 'shop/index', 'Test', '/', {});
    const filterArg = Product.countDocuments.mock.calls[0][0];
    expect(filterArg.price).toBeUndefined();
  });

  it('ignores invalid price param and falls back to all', async () => {
    const res = makeRes();
    await paginationHelper(makeReq({ price: 'cheap' }), res, jest.fn(), 'shop/index', 'Test', '/', {});
    const filterArg = Product.countDocuments.mock.calls[0][0];
    expect(filterArg.price).toBeUndefined();
  });
});

// ─── sort options ────────────────────────────────────────────────────────────

describe('sort options', () => {
  it('uses Product.aggregate for top-rated sort', async () => {
    await paginationHelper(makeReq({ sort: 'top-rated' }), makeRes(), jest.fn(), 'shop/index', 'Test', '/', {});
    expect(Product.aggregate).toHaveBeenCalled();
    expect(Product.find).not.toHaveBeenCalled();
  });

  it('uses Product.find for standard sorts', async () => {
    for (const sort of ['newest', 'price-asc', 'price-desc']) {
      jest.clearAllMocks();
      Product.countDocuments.mockResolvedValue(0);
      buildRatingsMap.mockResolvedValue({});
      mockFind([]);
      await paginationHelper(makeReq({ sort }), makeRes(), jest.fn(), 'shop/index', 'Test', '/', {});
      expect(Product.find).toHaveBeenCalled();
      expect(Product.aggregate).not.toHaveBeenCalled();
    }
  });

  it('falls back to newest for invalid sort value', async () => {
    const res = makeRes();
    await paginationHelper(makeReq({ sort: 'random' }), res, jest.fn(), 'shop/index', 'Test', '/', {});
    const [, data] = res.render.mock.calls[0];
    expect(data.activeSort).toBe('newest');
  });
});

// ─── error handling ──────────────────────────────────────────────────────────

describe('error handling', () => {
  it('calls next with an error on DB failure', async () => {
    Product.countDocuments.mockRejectedValue(new Error('DB down'));
    const next = jest.fn();
    await paginationHelper(makeReq(), makeRes(), next, 'shop/index', 'Test', '/', {});
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].httpStatusCode).toBe(500);
  });
});
