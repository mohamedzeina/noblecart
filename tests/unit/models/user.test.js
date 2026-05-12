const mongoose = require('mongoose');
const User = require('../../../models/user');

function makeUser(cartItems = [], wishlist = []) {
  const user = new User({ email: 'test@test.com', name: 'Test User', password: 'hashed' });
  user.cart = { items: cartItems };
  user.wishlist = wishlist;
  user.save = jest.fn().mockResolvedValue(user);
  return user;
}

function id() {
  return new mongoose.Types.ObjectId();
}

// ─── addToCart ───────────────────────────────────────────────────────────────

describe('addToCart', () => {
  it('adds a new product with quantity 1', async () => {
    const user = makeUser();
    const product = { _id: id(), price: 10 };
    await user.addToCart(product);

    expect(user.cart.items).toHaveLength(1);
    expect(user.cart.items[0].productId.toString()).toBe(product._id.toString());
    expect(user.cart.items[0].quantity).toBe(1);
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  it('increments quantity for an existing product', async () => {
    const productId = id();
    const user = makeUser([{ productId, quantity: 2 }]);
    await user.addToCart({ _id: productId, price: 10 });

    expect(user.cart.items).toHaveLength(1);
    expect(user.cart.items[0].quantity).toBe(3);
  });

  it('does not affect other cart items when incrementing', async () => {
    const id1 = id();
    const id2 = id();
    const user = makeUser([{ productId: id1, quantity: 1 }]);
    await user.addToCart({ _id: id2, price: 20 });

    expect(user.cart.items).toHaveLength(2);
    expect(user.cart.items[0].quantity).toBe(1);
    expect(user.cart.items[1].productId.toString()).toBe(id2.toString());
  });

  it('saves once per call', async () => {
    const user = makeUser();
    await user.addToCart({ _id: id(), price: 5 });
    expect(user.save).toHaveBeenCalledTimes(1);
  });
});

// ─── decrementFromCart ───────────────────────────────────────────────────────

describe('decrementFromCart', () => {
  it('decrements quantity by 1', async () => {
    const productId = id();
    const user = makeUser([{ productId, quantity: 3 }]);
    await user.decrementFromCart(productId);

    expect(user.cart.items).toHaveLength(1);
    expect(user.cart.items[0].quantity).toBe(2);
  });

  it('removes the item when quantity reaches 1', async () => {
    const productId = id();
    const user = makeUser([{ productId, quantity: 1 }]);
    await user.decrementFromCart(productId);

    expect(user.cart.items).toHaveLength(0);
  });

  it('does not remove other items when decrementing', async () => {
    const id1 = id();
    const id2 = id();
    const user = makeUser([{ productId: id1, quantity: 1 }, { productId: id2, quantity: 2 }]);
    await user.decrementFromCart(id1);

    expect(user.cart.items).toHaveLength(1);
    expect(user.cart.items[0].productId.toString()).toBe(id2.toString());
  });

  it('no-ops silently when product is not in cart', async () => {
    const user = makeUser();
    await user.decrementFromCart(id());

    expect(user.cart.items).toHaveLength(0);
    expect(user.save).toHaveBeenCalledTimes(1);
  });
});

// ─── removeFromCart ──────────────────────────────────────────────────────────

describe('removeFromCart', () => {
  it('removes the product from cart', async () => {
    const productId = id();
    const user = makeUser([{ productId, quantity: 5 }]);
    await user.removeFromCart(productId);

    expect(user.cart.items).toHaveLength(0);
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  it('removes only the targeted item and leaves others intact', async () => {
    const id1 = id();
    const id2 = id();
    const user = makeUser([{ productId: id1, quantity: 1 }, { productId: id2, quantity: 2 }]);
    await user.removeFromCart(id1);

    expect(user.cart.items).toHaveLength(1);
    expect(user.cart.items[0].productId.toString()).toBe(id2.toString());
  });

  it('no-ops silently when product is not in cart', async () => {
    const user = makeUser([{ productId: id(), quantity: 2 }]);
    await user.removeFromCart(id());

    expect(user.cart.items).toHaveLength(1);
  });
});

// ─── clearCart ───────────────────────────────────────────────────────────────

describe('clearCart', () => {
  it('empties the cart', async () => {
    const user = makeUser([{ productId: id(), quantity: 2 }, { productId: id(), quantity: 1 }]);
    await user.clearCart();

    expect(user.cart.items).toHaveLength(0);
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  it('no-ops on an already empty cart', async () => {
    const user = makeUser();
    await user.clearCart();

    expect(user.cart.items).toHaveLength(0);
    expect(user.save).toHaveBeenCalledTimes(1);
  });
});

// ─── toggleWishlist ──────────────────────────────────────────────────────────

describe('toggleWishlist', () => {
  it('adds product to wishlist when not present', async () => {
    const user = makeUser();
    const productId = id();
    await user.toggleWishlist(productId);

    expect(user.wishlist).toHaveLength(1);
    expect(user.wishlist[0].productId.toString()).toBe(productId.toString());
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  it('removes product from wishlist when already present', async () => {
    const productId = id();
    const user = makeUser([], [{ productId }]);
    await user.toggleWishlist(productId);

    expect(user.wishlist).toHaveLength(0);
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  it('does not affect other wishlist items when removing', async () => {
    const id1 = id();
    const id2 = id();
    const user = makeUser([], [{ productId: id1 }, { productId: id2 }]);
    await user.toggleWishlist(id1);

    expect(user.wishlist).toHaveLength(1);
    expect(user.wishlist[0].productId.toString()).toBe(id2.toString());
  });

  it('can add multiple distinct products', async () => {
    const user = makeUser();
    await user.toggleWishlist(id());
    user.save.mockResolvedValue(user);
    await user.toggleWishlist(id());

    expect(user.wishlist).toHaveLength(2);
  });
});
