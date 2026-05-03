document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('order-btn');
  const stripe = Stripe(btn.dataset.stripeKey);

  btn.addEventListener('click', () => {
    stripe.redirectToCheckout({ sessionId: btn.dataset.sessionId });
  });
});
