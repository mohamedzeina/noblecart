const mongoose = require('mongoose');
const Order = require('../../../models/order');

function makeOrder(status) {
  const order = new Order({
    products: [],
    user: { email: 'test@test.com', userId: new mongoose.Types.ObjectId() },
    status,
    statusHistory: [{ status, timestamp: new Date() }],
  });
  order.save = jest.fn().mockResolvedValue(order);
  return order;
}

// ─── canTransitionTo ─────────────────────────────────────────────────────────

describe('canTransitionTo', () => {
  const cases = [
    // [from, to, expected]
    ['pending',          'confirmed',        true ],
    ['pending',          'canceled',         true ],
    ['pending',          'shipped',          false],
    ['pending',          'delivered',        false],
    ['pending',          'out_for_delivery', false],
    ['confirmed',        'shipped',          true ],
    ['confirmed',        'canceled',         true ],
    ['confirmed',        'delivered',        false],
    ['confirmed',        'pending',          false],
    ['shipped',          'out_for_delivery', true ],
    ['shipped',          'delivered',        false],
    ['shipped',          'canceled',         false],
    ['out_for_delivery', 'delivered',        true ],
    ['out_for_delivery', 'canceled',         false],
    ['out_for_delivery', 'confirmed',        false],
    ['delivered',        'canceled',         false],
    ['delivered',        'pending',          false],
    ['canceled',         'pending',          false],
    ['canceled',         'confirmed',        false],
  ];

  test.each(cases)('%s → %s should be %s', (from, to, expected) => {
    expect(makeOrder(from).canTransitionTo(to)).toBe(expected);
  });
});

// ─── transitionTo ────────────────────────────────────────────────────────────

describe('transitionTo', () => {
  it('updates the status field', async () => {
    const order = makeOrder('pending');
    await order.transitionTo('confirmed');
    expect(order.status).toBe('confirmed');
  });

  it('appends the new status to statusHistory', async () => {
    const order = makeOrder('pending');
    await order.transitionTo('confirmed');
    expect(order.statusHistory).toHaveLength(2);
    expect(order.statusHistory[1].status).toBe('confirmed');
  });

  it('records a timestamp close to now', async () => {
    const before = Date.now();
    const order = makeOrder('pending');
    await order.transitionTo('confirmed');
    const ts = new Date(order.statusHistory[1].timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(Date.now() + 100);
  });

  it('calls save exactly once', async () => {
    const order = makeOrder('pending');
    await order.transitionTo('confirmed');
    expect(order.save).toHaveBeenCalledTimes(1);
  });

  it('throws on an invalid transition', () => {
    const order = makeOrder('delivered');
    expect(() => order.transitionTo('canceled')).toThrow('Invalid transition');
  });

  it('does not mutate state when transition throws', async () => {
    const order = makeOrder('canceled');
    try { await order.transitionTo('confirmed'); } catch {}
    expect(order.status).toBe('canceled');
    expect(order.statusHistory).toHaveLength(1);
  });

  it('does not call save when transition is invalid', async () => {
    const order = makeOrder('delivered');
    try { await order.transitionTo('pending'); } catch {}
    expect(order.save).not.toHaveBeenCalled();
  });

  it('supports the full happy path: pending → confirmed → shipped → out_for_delivery → delivered', async () => {
    const order = makeOrder('pending');
    const steps = ['confirmed', 'shipped', 'out_for_delivery', 'delivered'];
    for (const step of steps) {
      await order.transitionTo(step);
    }
    expect(order.status).toBe('delivered');
    expect(order.statusHistory).toHaveLength(5);
  });
});
