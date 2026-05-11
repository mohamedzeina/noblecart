const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const STATUSES = ['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'canceled'];

const VALID_TRANSITIONS = {
  pending:          ['confirmed', 'canceled'],
  confirmed:        ['shipped', 'canceled'],
  shipped:          ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered:        [],
  canceled:         [],
};

const orderSchema = new Schema({
  products: [
    {
      productData: { type: Object, required: true },
      quantity: { type: Number, required: true },
    },
  ],
  user: {
    email: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Types.ObjectId,
      required: true,
      ref: 'User',
    },
  },
  status: {
    type: String,
    enum: STATUSES,
    default: 'pending',
  },
  statusHistory: [
    {
      status: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

orderSchema.methods.canTransitionTo = function (newStatus) {
  return (VALID_TRANSITIONS[this.status] ?? []).includes(newStatus);
};

orderSchema.methods.transitionTo = function (newStatus) {
  if (!this.canTransitionTo(newStatus)) {
    throw new Error(`Invalid transition: ${this.status} → ${newStatus}`);
  }
  this.status = newStatus;
  this.statusHistory.push({ status: newStatus, timestamp: new Date() });
  return this.save();
};

module.exports = mongoose.model('Order', orderSchema);
