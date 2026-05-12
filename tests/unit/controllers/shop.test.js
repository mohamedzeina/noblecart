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
const Review = require('../../../models/review');
const { buildRatingsMap } = require('../../../util/reviewHelpers');
const { sendOrderConfirmation } = require('../../../util/email');
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
      email: 'test@test.com',
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

// ─── postCartUpdate ───────────────────────────────────────────────────────────

describe('postCartUpdate', () => {
  it('calls addToCart for increase and returns JSON', async () => {
    const productId = id();
    const product = { _id: productId, price: 25 };
    Product.findById = jest.fn().mockResolvedValue(product);

    const req = makeReq({ body: { productId: productId.toString(), action: 'increase' } });
    req.user.cart.items = [{ productId, quantity: 2 }];
    const res = makeRes();
    await shopController.postCartUpdate(req, res, jest.fn());

    expect(req.user.addToCart).toHaveBeenCalledWith(product);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ cartCount: 2, removed: false }));
  });

  it('calls decrementFromCart for decrease', async () => {
    const productId = id();
    Product.findById = jest.fn().mockResolvedValue({ _id: productId, price: 25 });

    const req = makeReq({ body: { productId: productId.toString(), action: 'decrease' } });
    req.user.cart.items = [{ productId, quantity: 1 }];
    await shopController.postCartUpdate(req, makeRes(), jest.fn());

    expect(req.user.decrementFromCart).toHaveBeenCalledWith(productId.toString());
  });

  it('returns removed: true when item quantity drops to 0', async () => {
    const productId = id();
    Product.findById = jest.fn().mockResolvedValue({ _id: productId, price: 25 });

    const req = makeReq({ body: { productId: productId.toString(), action: 'decrease' } });
    req.user.cart.items = [];
    const res = makeRes();
    await shopController.postCartUpdate(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ removed: true, itemQuantity: 0 }));
  });

  it('calls next with 500 when product not found', async () => {
    Product.findById = jest.fn().mockResolvedValue(null);
    const next = jest.fn();
    await shopController.postCartUpdate(
      makeReq({ body: { productId: id().toString(), action: 'increase' } }),
      makeRes(), next,
    );
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].httpStatusCode).toBe(500);
  });
});

// ─── postWishlistToggle ───────────────────────────────────────────────────────

describe('postWishlistToggle', () => {
  it('returns inWishlist: true when product is in wishlist after toggle', async () => {
    const productId = id();
    const req = makeReq({ body: { productId: productId.toString() } });
    req.user.toggleWishlist = jest.fn().mockResolvedValue({});
    req.user.wishlist = [{ productId }];

    const res = makeRes();
    await shopController.postWishlistToggle(req, res, jest.fn());

    expect(req.user.toggleWishlist).toHaveBeenCalledWith(productId.toString());
    expect(res.json).toHaveBeenCalledWith({ success: true, inWishlist: true, wishlistCount: 1 });
  });

  it('returns inWishlist: false when product is removed from wishlist', async () => {
    const productId = id();
    const req = makeReq({ body: { productId: productId.toString() } });
    req.user.toggleWishlist = jest.fn().mockResolvedValue({});
    req.user.wishlist = [];

    const res = makeRes();
    await shopController.postWishlistToggle(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ success: true, inWishlist: false, wishlistCount: 0 });
  });
});

// ─── getCheckoutSuccess ───────────────────────────────────────────────────────

describe('getCheckoutSuccess', () => {
  function makeCartItem(qty = 2) {
    const productId = id();
    return {
      quantity: qty,
      productId: { _id: productId, _doc: { _id: productId, title: 'Watch', price: 100 } },
    };
  }

  it('creates an Order with the current user data', async () => {
    const item = makeCartItem();
    const req = makeReq();
    req.user.email = 'buyer@test.com';
    req.user.populate = jest.fn().mockResolvedValue({ cart: { items: [item] } });

    const savedOrder = { _id: id(), user: { email: 'buyer@test.com' } };
    Order.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(savedOrder) }));
    Product.updateOne = jest.fn().mockResolvedValue({});

    await shopController.getCheckoutSuccess(req, makeRes(), jest.fn());

    expect(Order).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ email: 'buyer@test.com' }),
      status: 'pending',
    }));
  });

  it('decrements stock for each cart item', async () => {
    const item = makeCartItem(3);
    const req = makeReq();
    req.user.populate = jest.fn().mockResolvedValue({ cart: { items: [item] } });

    const savedOrder = { _id: id(), user: { email: 'buyer@test.com' } };
    Order.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(savedOrder) }));
    Product.updateOne = jest.fn().mockResolvedValue({});

    await shopController.getCheckoutSuccess(req, makeRes(), jest.fn());

    expect(Product.updateOne).toHaveBeenCalledWith(
      { _id: item.productId._id },
      { $inc: { stock: -3 } },
    );
  });

  it('clears the cart and redirects to /orders on success', async () => {
    const req = makeReq();
    req.user.populate = jest.fn().mockResolvedValue({ cart: { items: [] } });

    const savedOrder = { _id: id(), user: { email: 'buyer@test.com' } };
    Order.mockImplementation(() => ({ save: jest.fn().mockResolvedValue(savedOrder) }));

    const res = makeRes();
    await shopController.getCheckoutSuccess(req, res, jest.fn());

    expect(req.user.clearCart).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith('/orders');
  });
});

// ─── postReview ───────────────────────────────────────────────────────────────

describe('postReview', () => {
  it('flashes error and redirects when rating is 0', async () => {
    const productId = id().toString();
    const req = makeReq({ params: { productId }, body: { rating: '0', comment: 'Good' } });
    const res = makeRes();
    await shopController.postReview(req, res, jest.fn());
    expect(req.flash).toHaveBeenCalledWith('reviewError', expect.any(String));
    expect(res.redirect).toHaveBeenCalledWith('/products/' + productId);
  });

  it('flashes error when comment is blank', async () => {
    const productId = id().toString();
    const req = makeReq({ params: { productId }, body: { rating: '4', comment: '   ' } });
    await shopController.postReview(req, makeRes(), jest.fn());
    expect(req.flash).toHaveBeenCalledWith('reviewError', expect.any(String));
  });

  it('sets verifiedPurchase: true when user has ordered the product', async () => {
    const productId = id().toString();
    Order.findOne = jest.fn().mockResolvedValue({ _id: id() });
    Review.mockImplementation(() => ({ save: jest.fn().mockResolvedValue({}) }));

    const req = makeReq({ params: { productId }, body: { rating: '5', comment: 'Excellent!' } });
    await shopController.postReview(req, makeRes(), jest.fn());

    expect(Review).toHaveBeenCalledWith(expect.objectContaining({ verifiedPurchase: true }));
  });

  it('sets verifiedPurchase: false when no matching order exists', async () => {
    const productId = id().toString();
    Order.findOne = jest.fn().mockResolvedValue(null);
    Review.mockImplementation(() => ({ save: jest.fn().mockResolvedValue({}) }));

    const req = makeReq({ params: { productId }, body: { rating: '3', comment: 'OK' } });
    await shopController.postReview(req, makeRes(), jest.fn());

    expect(Review).toHaveBeenCalledWith(expect.objectContaining({ verifiedPurchase: false }));
  });

  it('redirects without calling next on duplicate review (code 11000)', async () => {
    const productId = id().toString();
    Order.findOne = jest.fn().mockResolvedValue(null);
    Review.mockImplementation(() => ({ save: jest.fn().mockRejectedValue({ code: 11000 }) }));

    const next = jest.fn();
    const res = makeRes();
    const req = makeReq({ params: { productId }, body: { rating: '4', comment: 'Nice!' } });
    await shopController.postReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/products/' + productId);
  });
});

// ─── putReview ────────────────────────────────────────────────────────────────

describe('putReview', () => {
  it('flashes error and redirects when rating is out of range', async () => {
    const productId = id().toString();
    const req = makeReq({ params: { productId }, body: { rating: '6', comment: 'Good' } });
    const res = makeRes();
    await shopController.putReview(req, res, jest.fn());
    expect(req.flash).toHaveBeenCalledWith('reviewError', expect.any(String));
    expect(res.redirect).toHaveBeenCalledWith('/products/' + productId);
  });

  it('calls findOneAndUpdate with correct fields', async () => {
    const productId = id().toString();
    Review.findOneAndUpdate = jest.fn().mockResolvedValue({});
    const req = makeReq({ params: { productId }, body: { rating: '4', comment: 'Updated' } });
    await shopController.putReview(req, makeRes(), jest.fn());
    expect(Review.findOneAndUpdate).toHaveBeenCalledWith(
      { productId, userId: req.user._id },
      { rating: 4, comment: 'Updated' },
      { new: true },
    );
  });

  it('redirects to product on success', async () => {
    const productId = id().toString();
    Review.findOneAndUpdate = jest.fn().mockResolvedValue({});
    const req = makeReq({ params: { productId }, body: { rating: '3', comment: 'Good' } });
    const res = makeRes();
    await shopController.putReview(req, res, jest.fn());
    expect(res.redirect).toHaveBeenCalledWith('/products/' + productId);
  });
});

// ─── deleteReview ─────────────────────────────────────────────────────────────

describe('deleteReview', () => {
  it('calls findOneAndDelete with correct ids', async () => {
    const productId = id().toString();
    Review.findOneAndDelete = jest.fn().mockResolvedValue({});
    const req = makeReq({ params: { productId } });
    await shopController.deleteReview(req, makeRes(), jest.fn());
    expect(Review.findOneAndDelete).toHaveBeenCalledWith({ productId, userId: req.user._id });
  });

  it('redirects to product on success', async () => {
    const productId = id().toString();
    Review.findOneAndDelete = jest.fn().mockResolvedValue({});
    const req = makeReq({ params: { productId } });
    const res = makeRes();
    await shopController.deleteReview(req, res, jest.fn());
    expect(res.redirect).toHaveBeenCalledWith('/products/' + productId);
  });
});
