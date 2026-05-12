function animateValue(el, from, to, duration) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = '$' + to.toFixed(2);
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = '$' + (from + (to - from) * eased).toFixed(2);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.cart__qty-btn');
  if (!btn) return;

  const action = btn.dataset.action;
  const productId = btn.dataset.productId;
  const csrf = document.querySelector('[name="_csrf"]').value;
  const controls = btn.closest('.cart__qty-controls');
  const allBtns = controls.querySelectorAll('.cart__qty-btn');

  allBtns.forEach(b => b.disabled = true);

  fetch('/cart-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ productId, action, _csrf: csrf }),
  })
    .then((res) => res.json())
    .then(({ cartCount, itemQuantity, itemTotal, removed }) => {
      // Update navbar badge
      const badge = document.querySelector('.cart-badge');
      if (badge) badge.textContent = cartCount;

      if (removed) {
        document.querySelector(`.cart__item[data-product-id="${productId}"]`)?.remove();
        document.querySelector(`.cart-summary__item[data-product-id="${productId}"]`)?.remove();
        if (document.querySelectorAll('.cart__item').length === 0) {
          location.reload();
          return;
        }
      } else {
        // Update row
        const row = document.querySelector(`.cart__item[data-product-id="${productId}"]`);
        if (row) {
          row.querySelector('.cart__qty-value').textContent = itemQuantity;
          const itemTotalEl = row.querySelector('.cart__item-total');
          const prevItem = parseFloat(itemTotalEl.textContent.replace(/[^0-9.]/g, '')) || 0;
          animateValue(itemTotalEl, prevItem, parseFloat(itemTotal), 350);
        }
        // Update summary item
        const summaryItem = document.querySelector(`.cart-summary__item[data-product-id="${productId}"]`);
        if (summaryItem) {
          summaryItem.querySelector('.summary-item__qty').textContent = itemQuantity;
          const stEl = summaryItem.querySelector('.summary-item__total');
          if (stEl) {
            const prevSt = parseFloat(stEl.textContent.replace(/[^0-9.]/g, '')) || 0;
            animateValue(stEl, prevSt, parseFloat(itemTotal), 350);
          }
        }
      }

      // Recalculate grand total from all visible rows
      let total = 0;
      document.querySelectorAll('.cart__item').forEach((item) => {
        const price = parseFloat(item.dataset.price);
        const qty = parseInt(item.querySelector('.cart__qty-value').textContent);
        total += price * qty;
      });
      const grandTotal = document.getElementById('cart-grand-total');
      if (grandTotal) {
        const prevGrand = parseFloat(grandTotal.textContent.replace(/[^0-9.]/g, '')) || 0;
        animateValue(grandTotal, prevGrand, total, 400);
      }
    })
    .catch((err) => console.error(err))
    .finally(() => allBtns.forEach(b => b.disabled = false));
});
