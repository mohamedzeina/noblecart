jest.mock('../../../models/order');
jest.mock('../../../models/product');
jest.mock('../../../models/review');
jest.mock('../../../util/reviewHelpers');
jest.mock('../../../util/email', () => ({ sendOrderConfirmation: jest.fn().mockResolvedValue() }));
jest.mock('stripe', () => jest.fn(() => ({
  checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'sess_test_123' }) } },
})));

const mongoose = require('mongoose');
const Order = require('../../../models/order');
const Product = require('../../../models/product');
const { buildRatingsMap } = require('../../../util/reviewHelpers');
const shopController = require('../../../controllers/shop');

function id() {
  return new mongoose.Types.ObjectId();
}

function makeRes() {
  const res = {
    render: jest.fn(),
    redirect: jest.fn(),
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    params: {},
    body: {},
    query: {},
    headers: {},
    flash: jest.fn().mockReturnValue([]),
    csrfToken: jest.fn().mockReturnValue('csrf-token'),
    protocol: 'http',
    get: jest.fn().mockReturnValue('localhost:3000'),
    user: {
      _id: id(),
      cart: { items: [] },
      wishlist: [],
      save: jest.fn().mockResolvedValue({}),
      addToCart: jest.fn().mockResolvedValue({}),
      removeFromCart: jest.fn().mockResolvedValue({}),
      decrementFromCart: jest.fn().mockResolvedValue({}),
      clearCart: jest.fn().mockResolvedValue({}),
      populate: jest.fn(),
    },
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─── postReorder ─────────────────────────────────────────────────────────────

describe('postReorder', () => {
  it('redirects to /orders when order not found', async () => {
    Order.findOne = jest.fn().mockResolvedValue(null);
    const req = makeReq({ params: { orderId: id().toString() } });
    const res = makeRes();
    await shopController.postReorder(req, res, jest.fn());
    expect(res.redirect).toHaveBeenCalledWith('/orders');
  });

  it('adds in-stock products to cart preserving original quantities', async () => {
    const productId = id();
    Order.findOne = jest.fn().mockResolvedValue({
      products: [{ productData: { _id: productId }, quantity: 3 }],
    });
    Product.find = jest.fn().mockResolvedValue([{ _id: productId }]);

    const req = makeReq({ params: { orderId: id().toString() } });
    await shopController.postReorder(req, makeRes(), jest.fn());

    expect(req.user.cart.items[0].quantity).toBe(3);
  });

  it('skips out-of-stock products', async () => {
    const inStockId = id();
    const outOfStockId = id();
    Order.findOne = jest.fn().mockResolvedValue({
      products: [
        { productData: { _id: inStockId }, quantity: 2 },
        { productData: { _id: outOfStockId }, quantity: 1 },
      ],
    });
    Product.find = jest.fn().mockResolvedValue([{ _id: inStockId }]);

    const req = makeReq({ params: { orderId: id().toString() } });
    await shopController.postReorder(req, makeRes(), jest.fn());

    expect(req.user.cart.items).toHaveLength(1);
    expect(req.user.cart.items[0].productId.toString()).toBe(inStockId.toString());
  });

  it('calls user.save exactly once regardless of product count', async () => {
    const ids = [id(), id(), id()];
    Order.findOne = jest.fn().mockResolvedValue({
      products: ids.map((pid) => ({ productData: { _id: pid }, quantity: 1 })),
    });
    Product.find = jest.fn().mockResolvedValue(ids.map((pid) => ({ _id: pid })));

    const req = makeReq({ params: { orderId: id().toString() } });
    await shopController.postReorder(req, makeRes(), jest.fn());

    expect(req.user.save).toHaveBeenCalledTimes(1);
  });

  it('increments quantity when product already in cart', async () => {
    const productId = id();
    Order.findOne = jest.fn().mockResolvedValue({
      products: [{ productData: { _id: productId }, quantity: 2 }],
    });
    Product.find = jest.fn().mockResolvedValue([{ _id: productId }]);

    const req = makeReq({ params: { orderId: id().toString() } });
    req.user.cart.items = [{ productId, quantity: 1 }];

    await shopController.postReorder(req, makeRes(), jest.fn());

    expect(req.user.cart.items[0].quantity).toBe(3);
  });

  it('redirects to /checkout on success', async () => {
    Order.findOne = jest.fn().mockResolvedValue({ products: [] });
    Product.find = jest.fn().mockResolvedValue([]);

    const req = makeReq({ params: { orderId: id().toString() } });
    const res = makeRes();
    await shopController.postReorder(req, res, jest.fn());

    expect(res.redirect).toHaveBeenCalledWith('/checkout');
  });
});

// ─── getOrders ────────────────────────────────────────────────────────────────

describe('getOrders', () => {
  function setupOrders() {
    Order.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    Order.aggregate = jest.fn().mockResolvedValue([{
      all: [{ n: 0 }], active: [], delivered: [], canceled: [],
    }]);
  }

  it('fetches all orders when status=all', async () => {
    setupOrders();
    const req = makeReq({ query: { status: 'all' } });
    await shopController.getOrders(req, makeRes(), jest.fn());
    const queryArg = Order.find.mock.calls[0][0];
    expect(queryArg.status).toBeUndefined();
  });

  it('applies $in filter for active status', async () => {
    setupOrders();
    const req = makeReq({ query: { status: 'active' } });
    await shopController.getOrders(req, makeRes(), jest.fn());
    const queryArg = Order.find.mock.calls[0][0];
    expect(queryArg.status.$in).toContain('pending');
    expect(queryArg.status.$in).toContain('confirmed');
    expect(queryArg.status.$in).toContain('shipped');
    expect(queryArg.status.$in).toContain('out_for_delivery');
  });

  it('applies exact status filter for delivered', async () => {
    setupOrders();
    const req = makeReq({ query: { status: 'delivered' } });
    await shopController.getOrders(req, makeRes(), jest.fn());
    const queryArg = Order.find.mock.calls[0][0];
    expect(queryArg.status).toBe('delivered');
  });

  it('applies exact status filter for canceled', async () => {
    setupOrders();
    const req = makeReq({ query: { status: 'canceled' } });
    await shopController.getOrders(req, makeRes(), jest.fn());
    const queryArg = Order.find.mock.calls[0][0];
    expect(queryArg.status).toBe('canceled');
  });

  it('defaults to all when status param is missing', async () => {
    setupOrders();
    const req = makeReq({ query: {} });
    await shopController.getOrders(req, makeRes(), jest.fn());
    const queryArg = Order.find.mock.calls[0][0];
    expect(queryArg.status).toBeUndefined();
  });
});

// ─── postCart ────────────────────────────────────────────────────────────────

describe('postCart', () => {
  it('calls addToCart and returns JSON with cart count for fetch requests', async () => {
    const product = { _id: id(), price: 10 };
    Product.findById = jest.fn().mockResolvedValue(product);
    const req = makeReq({
      body: { productId: product._id.toString() },
      headers: { 'x-requested-with': 'fetch' },
    });
    req.user.cart.items = [{ productId: product._id, quantity: 2 }];

    const res = makeRes();
    await shopController.postCart(req, res, jest.fn());

    expect(req.user.addToCart).toHaveBeenCalledWith(product);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, cartCount: 2 }));
  });

  it('redirects to /cart for non-fetch requests', async () => {
    Product.findById = jest.fn().mockResolvedValue({ _id: id() });
    const req = makeReq({ body: { productId: id().toString() }, headers: {} });
    const res = makeRes();
    await shopController.postCart(req, res, jest.fn());
    expect(res.redirect).toHaveBeenCalledWith('/cart');
  });
});

// ─── postCartDeleteProduct ────────────────────────────────────────────────────

describe('postCartDeleteProduct', () => {
  it('calls removeFromCart and returns JSON for fetch requests', async () => {
    const productId = id();
    const req = makeReq({
      body: { productId: productId.toString() },
      headers: { 'x-requested-with': 'fetch' },
    });
    req.user.cart.items = [];
    const res = makeRes();
    await shopController.postCartDeleteProduct(req, res, jest.fn());

    expect(req.user.removeFromCart).toHaveBeenCalledWith(productId.toString());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('redirects to /cart for non-fetch requests', async () => {
    const req = makeReq({ body: { productId: id().toString() }, headers: {} });
    const res = makeRes();
    await shopController.postCartDeleteProduct(req, res, jest.fn());
    expect(res.redirect).toHaveBeenCalledWith('/cart');
  });
});

// ─── getCheckoutSession ───────────────────────────────────────────────────────

describe('getCheckoutSession', () => {
  it('returns sessionId null and stockError when items are over stock', async () => {
    const product = { _id: id(), title: 'Watch', price: 100, stock: 1 };
    const req = makeReq();
    req.user.populate = jest.fn().mockResolvedValue({
      cart: { items: [{ productId: product, quantity: 5 }] },
    });

    const res = makeRes();
    await shopController.getCheckoutSession(req, res, jest.fn());

    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.sessionId).toBeNull();
    expect(jsonArg.stockError).toContain('Watch');
  });

  it('returns sessionId when all items are in stock', async () => {
    const product = { _id: id(), title: 'Watch', price: 100, stock: 10, description: 'Nice' };
    const req = makeReq();
    req.user.populate = jest.fn().mockResolvedValue({
      cart: { items: [{ productId: product, quantity: 1 }] },
    });

    const res = makeRes();
    await shopController.getCheckoutSession(req, res, jest.fn());

    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.sessionId).toBe('sess_test_123');
    expect(jsonArg.stockError).toBeNull();
  });

  it('returns sessionId null when cart is empty', async () => {
    const req = makeReq();
    req.user.populate = jest.fn().mockResolvedValue({ cart: { items: [] } });

    const res = makeRes();
    await shopController.getCheckoutSession(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ sessionId: null, stockError: null });
  });
});

// ─── getOrderDetail ───────────────────────────────────────────────────────────

describe('getOrderDetail', () => {
  it('renders order-detail when order is found', async () => {
    const order = { _id: id(), status: 'pending', products: [], statusHistory: [] };
    Order.findOne = jest.fn().mockResolvedValue(order);

    const req = makeReq({ params: { orderId: order._id.toString() } });
    const res = makeRes();
    await shopController.getOrderDetail(req, res, jest.fn());

    expect(res.render).toHaveBeenCalledWith('shop/order-detail', expect.objectContaining({ order }));
  });

  it('calls next with an error when order is not found', async () => {
    Order.findOne = jest.fn().mockResolvedValue(null);
    const next = jest.fn();
    await shopController.getOrderDetail(makeReq({ params: { orderId: id().toString() } }), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
