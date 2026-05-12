jest.mock('../../../models/order');
jest.mock('../../../models/product');
jest.mock('../../../models/user');
jest.mock('../../../models/review');
jest.mock('../../../util/email', () => ({ sendStatusUpdate: jest.fn().mockResolvedValue() }));
jest.mock('../../../util/cloudinary');
jest.mock('../../../util/file', () => ({ deleteFile: jest.fn(), deleteModel: jest.fn() }));
jest.mock('express-validator', () => ({
  validationResult: jest.fn().mockReturnValue({ isEmpty: () => true, array: () => [] }),
}));

const mongoose = require('mongoose');
const Order = require('../../../models/order');
const Product = require('../../../models/product');
const User = require('../../../models/user');
const Review = require('../../../models/review');
const { sendStatusUpdate } = require('../../../util/email');
const { validationResult } = require('express-validator');
const cloudinary = require('../../../util/cloudinary');
const adminController = require('../../../controllers/admin');

function id() {
  return new mongoose.Types.ObjectId();
}

function makeRes() {
  return {
    render: jest.fn(),
    redirect: jest.fn(),
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };
}

function makeReq(overrides = {}) {
  return {
    params: {},
    body: {},
    query: {},
    admin: { _id: id() },
    csrfToken: jest.fn().mockReturnValue('csrf-token'),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

// ─── patchOrderStatus ─────────────────────────────────────────────────────────

describe('patchOrderStatus', () => {
  it('returns 404 when order is not found', async () => {
    Order.findById = jest.fn().mockResolvedValue(null);
    const res = makeRes();
    await adminController.patchOrderStatus(makeReq({ params: { orderId: id() } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 422 when transition is invalid', async () => {
    const order = {
      status: 'delivered',
      canTransitionTo: jest.fn().mockReturnValue(false),
    };
    Order.findById = jest.fn().mockResolvedValue(order);
    const res = makeRes();
    await adminController.patchOrderStatus(
      makeReq({ params: { orderId: id() }, body: { status: 'canceled' } }),
      res, jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('transitions the order and sends status update email', async () => {
    const order = {
      status: 'pending',
      user: { email: 'buyer@test.com' },
      canTransitionTo: jest.fn().mockReturnValue(true),
      transitionTo: jest.fn().mockResolvedValue(),
    };
    Order.findById = jest.fn().mockResolvedValue(order);
    const res = makeRes();
    await adminController.patchOrderStatus(
      makeReq({ params: { orderId: id() }, body: { status: 'confirmed' } }),
      res, jest.fn()
    );
    expect(order.transitionTo).toHaveBeenCalledWith('confirmed');
    expect(sendStatusUpdate).toHaveBeenCalledWith(order, 'buyer@test.com');
  });

  it('returns the new status in JSON response', async () => {
    const order = {
      status: 'confirmed',
      user: { email: 'buyer@test.com' },
      canTransitionTo: jest.fn().mockReturnValue(true),
      transitionTo: jest.fn().mockResolvedValue(),
    };
    Order.findById = jest.fn().mockResolvedValue(order);
    const res = makeRes();
    await adminController.patchOrderStatus(
      makeReq({ params: { orderId: id() }, body: { status: 'shipped' } }),
      res, jest.fn()
    );
    expect(res.json).toHaveBeenCalledWith({ status: 'confirmed' });
  });
});

// ─── getAdminOrders ───────────────────────────────────────────────────────────

describe('getAdminOrders', () => {
  function setupOrders(orders = []) {
    Order.countDocuments = jest.fn().mockResolvedValue(orders.length);
    Order.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(orders),
    });
  }

  it('renders admin/orders with paginated results', async () => {
    setupOrders([]);
    const res = makeRes();
    await adminController.getAdminOrders(makeReq({ query: {} }), res, jest.fn());
    expect(res.render).toHaveBeenCalledWith('admin/orders', expect.objectContaining({
      currentPage: 1,
      lastPage: 0,
    }));
  });

  it('filters by status when status param provided', async () => {
    setupOrders([]);
    await adminController.getAdminOrders(makeReq({ query: { status: 'shipped' } }), makeRes(), jest.fn());
    const filterArg = Order.countDocuments.mock.calls[0][0];
    expect(filterArg.status).toBe('shipped');
  });

  it('omits status filter when status param is empty', async () => {
    setupOrders([]);
    await adminController.getAdminOrders(makeReq({ query: {} }), makeRes(), jest.fn());
    const filterArg = Order.countDocuments.mock.calls[0][0];
    expect(filterArg.status).toBeUndefined();
  });

  it('applies date filter for "today"', async () => {
    setupOrders([]);
    await adminController.getAdminOrders(makeReq({ query: { date: 'today' } }), makeRes(), jest.fn());
    const filterArg = Order.countDocuments.mock.calls[0][0];
    expect(filterArg._id).toBeDefined();
    expect(filterArg._id.$gte).toBeDefined();
  });

  it('applies date filter for "7d"', async () => {
    setupOrders([]);
    await adminController.getAdminOrders(makeReq({ query: { date: '7d' } }), makeRes(), jest.fn());
    const filterArg = Order.countDocuments.mock.calls[0][0];
    expect(filterArg._id.$gte).toBeDefined();
  });

  it('calls next with 500 on DB failure', async () => {
    Order.countDocuments = jest.fn().mockRejectedValue(new Error('DB down'));
    Order.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) });
    const next = jest.fn();
    await adminController.getAdminOrders(makeReq({ query: {} }), makeRes(), next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].httpStatusCode).toBe(500);
  });
});

// ─── deleteProduct ────────────────────────────────────────────────────────────

describe('deleteProduct', () => {
  it('returns 404 when product not found', async () => {
    Product.findById = jest.fn().mockResolvedValue(null);
    const res = makeRes();
    await adminController.deleteProduct(makeReq({ params: { prodId: id() } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('removes product from all user carts and wishlists', async () => {
    const prodId = id();
    Product.findById = jest.fn().mockResolvedValue({ _id: prodId, imagePublicId: 'img', modelPublicId: null });
    Product.deleteOne = jest.fn().mockResolvedValue({});
    User.updateMany = jest.fn().mockResolvedValue({});
    Product.countDocuments = jest.fn().mockResolvedValue(5);

    await adminController.deleteProduct(makeReq({ params: { prodId }, admin: { _id: id() } }), makeRes(), jest.fn());

    expect(User.updateMany).toHaveBeenCalledTimes(2);
    const [cartCall, wishlistCall] = User.updateMany.mock.calls;
    expect(cartCall[1].$pull['cart.items']).toBeDefined();
    expect(wishlistCall[1].$pull.wishlist).toBeDefined();
  });

  it('returns totalItems in response after deletion', async () => {
    const prodId = id();
    Product.findById = jest.fn().mockResolvedValue({ _id: prodId, imagePublicId: 'img', modelPublicId: null });
    Product.deleteOne = jest.fn().mockResolvedValue({});
    User.updateMany = jest.fn().mockResolvedValue({});
    Product.countDocuments = jest.fn().mockResolvedValue(4);

    const res = makeRes();
    await adminController.deleteProduct(makeReq({ params: { prodId }, admin: { _id: id() } }), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ totalItems: 4 }));
  });
});

// ─── postUpdateStock ──────────────────────────────────────────────────────────

describe('postUpdateStock', () => {
  it('redirects to /admin/products when product not found', async () => {
    Product.findById = jest.fn().mockResolvedValue(null);
    const res = makeRes();
    await adminController.postUpdateStock(
      makeReq({ body: { productId: id().toString(), stock: '5' } }),
      res, jest.fn(),
    );
    expect(res.redirect).toHaveBeenCalledWith('/admin/products');
  });

  it('redirects when admin does not own the product', async () => {
    const product = { _id: id(), adminId: id() };
    Product.findById = jest.fn().mockResolvedValue(product);
    const res = makeRes();
    await adminController.postUpdateStock(
      makeReq({ body: { productId: product._id.toString(), stock: '5' }, admin: { _id: id() } }),
      res, jest.fn(),
    );
    expect(res.redirect).toHaveBeenCalledWith('/admin/products');
  });

  it('updates stock and redirects to product page', async () => {
    const adminId = id();
    const productId = id();
    const product = { _id: productId, adminId, stock: 3, save: jest.fn().mockResolvedValue({}) };
    Product.findById = jest.fn().mockResolvedValue(product);

    const res = makeRes();
    await adminController.postUpdateStock(
      makeReq({ body: { productId: productId.toString(), stock: '10' }, admin: { _id: adminId } }),
      res, jest.fn(),
    );

    expect(product.stock).toBe(10);
    expect(product.save).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith('/admin/product/' + productId.toString());
  });
});

// ─── getAdminProduct ──────────────────────────────────────────────────────────

describe('getAdminProduct', () => {
  it('redirects when product not found', async () => {
    Product.findById = jest.fn().mockResolvedValue(null);
    const res = makeRes();
    await adminController.getAdminProduct(
      makeReq({ params: { productId: id().toString() } }), res, jest.fn(),
    );
    expect(res.redirect).toHaveBeenCalledWith('/admin/products');
  });

  it('redirects when admin does not own the product', async () => {
    const product = { _id: id(), adminId: id() };
    Product.findById = jest.fn().mockResolvedValue(product);
    const res = makeRes();
    await adminController.getAdminProduct(
      makeReq({ params: { productId: product._id.toString() }, admin: { _id: id() } }),
      res, jest.fn(),
    );
    expect(res.redirect).toHaveBeenCalledWith('/admin/products');
  });

  it('renders product-detail with reviews and stats', async () => {
    const adminId = id();
    const product = { _id: id(), adminId };
    Product.findById = jest.fn().mockResolvedValue(product);
    Review.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    Review.aggregate = jest.fn().mockResolvedValue([{ avg: 4.5, count: 10 }]);
    Order.aggregate = jest.fn().mockResolvedValue([{ total: 25 }]);

    const res = makeRes();
    await adminController.getAdminProduct(
      makeReq({ params: { productId: product._id.toString() }, admin: { _id: adminId } }),
      res, jest.fn(),
    );

    expect(res.render).toHaveBeenCalledWith('admin/product-detail', expect.objectContaining({
      product,
      unitsSold: 25,
    }));
  });
});

// ─── postAddProduct ───────────────────────────────────────────────────────────

describe('postAddProduct', () => {
  beforeEach(() => {
    cloudinary.uploader = {
      upload_stream: jest.fn((opts, cb) => {
        cb(null, { secure_url: 'https://res.cloudinary.com/img.jpg', public_id: 'noblecart/abc' });
        return { end: jest.fn() };
      }),
    };
  });

  it('returns 422 when no image is provided', async () => {
    const res = makeRes();
    await adminController.postAddProduct(
      makeReq({ body: { title: 'Watch', price: '50', description: 'Nice', category: 'watches', stock: '5' }, files: {} }),
      res, jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.render).toHaveBeenCalledWith('admin/edit-product', expect.objectContaining({ hasError: true }));
  });

  it('returns 422 when validation errors exist', async () => {
    validationResult.mockReturnValueOnce({ isEmpty: () => false, array: () => [{ msg: 'Title is required' }] });

    const res = makeRes();
    await adminController.postAddProduct(
      makeReq({
        body: { title: '', price: '50', description: 'Nice', category: 'watches', stock: '5' },
        files: { image: [{ buffer: Buffer.from('img') }] },
      }),
      res, jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('uploads image and creates product on valid input', async () => {
    Product.mockImplementation(() => ({ save: jest.fn().mockResolvedValue({}) }));

    const res = makeRes();
    await adminController.postAddProduct(
      makeReq({
        body: { title: 'Watch', price: '50', description: 'Nice', category: 'watches', stock: '5' },
        files: { image: [{ buffer: Buffer.from('img') }] },
      }),
      res, jest.fn(),
    );

    expect(res.redirect).toHaveBeenCalledWith('/admin/products');
  });
});

// ─── postEditProduct ──────────────────────────────────────────────────────────

describe('postEditProduct', () => {
  it('returns 422 when validation errors exist', async () => {
    validationResult.mockReturnValueOnce({ isEmpty: () => false, array: () => [{ msg: 'Price invalid' }] });

    const res = makeRes();
    await adminController.postEditProduct(
      makeReq({
        body: { productId: id().toString(), title: 'Watch', price: 'abc', description: 'Nice', category: 'watches', stock: '5' },
        files: {},
      }),
      res, jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.render).toHaveBeenCalledWith('admin/edit-product', expect.objectContaining({ hasError: true }));
  });

  it('redirects to / when admin does not own the product', async () => {
    const product = { adminId: id() };
    Product.findById = jest.fn().mockResolvedValue(product);

    const res = makeRes();
    await adminController.postEditProduct(
      makeReq({
        body: { productId: id().toString(), title: 'Watch', price: '50', description: 'Nice', category: 'watches', stock: '5' },
        files: {},
        admin: { _id: id() },
      }),
      res, jest.fn(),
    );
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('saves updated fields and redirects when no new files are uploaded', async () => {
    const adminId = id();
    const productId = id();
    const product = {
      _id: productId,
      adminId,
      title: 'Old',
      price: '30',
      stock: 2,
      description: 'Old desc',
      category: 'old',
      save: jest.fn().mockResolvedValue({}),
    };
    Product.findById = jest.fn().mockResolvedValue(product);

    const res = makeRes();
    await adminController.postEditProduct(
      makeReq({
        body: { productId: productId.toString(), title: 'New Watch', price: '60', description: 'Updated', category: 'watches', stock: '8' },
        files: {},
        admin: { _id: adminId },
      }),
      res, jest.fn(),
    );

    expect(product.title).toBe('New Watch');
    expect(product.save).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith('/admin/products');
  });
});
