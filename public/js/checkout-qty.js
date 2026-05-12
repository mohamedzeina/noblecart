document.addEventListener('DOMContentLoaded', () => {
  const list = document.querySelector('.cart__item-list');
  if (!list) return;

  function getCsrf() {
    return document.getElementById('cart-drawer-csrf')?.value || '';
  }

  function flash(el) {
    el.classList.remove('qty-flash');
    void el.offsetWidth;
    el.classList.add('qty-flash');
  }

  function syncIncBtn(item) {
    const stock  = parseInt(item.dataset.stock, 10);
    const qty    = parseInt(item.querySelector('.cart__qty-value').textContent, 10);
    const incBtn = item.querySelector('.checkout-qty-inc');
    if (incBtn) incBtn.disabled = qty >= stock;
  }

  // Initialise + button states on load
  document.querySelectorAll('.cart__item').forEach(syncIncBtn);

  function recalcGrandTotal() {
    let total = 0;
    document.querySelectorAll('.cart__item').forEach((item) => {
      total += parseFloat(item.dataset.price) * parseInt(item.querySelector('.cart__qty-value').textContent, 10);
    });
    const el = document.querySelector('.js-grand-total');
    if (el) { el.textContent = '$' + total.toFixed(2); flash(el); }
  }

  function setStockError(msg) {
    const summary = document.querySelector('.cart-summary');
    const errMsg  = document.getElementById('checkout-stock-error-msg');
    if (msg) {
      if (errMsg) errMsg.textContent = msg;
      summary?.classList.add('cart-summary--stock-error');
    } else {
      summary?.classList.remove('cart-summary--stock-error');
    }
  }

  function allItemsInStock() {
    return Array.from(document.querySelectorAll('.cart__item')).every((item) => {
      const stock = parseInt(item.dataset.stock, 10);
      const qty   = parseInt(item.querySelector('.cart__qty-value').textContent, 10);
      return qty <= stock;
    });
  }

  function refreshSession() {
    fetch('/checkout/session')
      .then((r) => r.json())
      .then(({ sessionId, stockError }) => {
        if (stockError) {
          setStockError(stockError);
        } else {
          setStockError(null);
          const btn = document.getElementById('order-btn');
          if (btn && sessionId) btn.dataset.sessionId = sessionId;
          if (btn) btn.disabled = false;
        }
      })
      .catch(() => {
        const btn = document.getElementById('order-btn');
        if (btn) btn.disabled = false;
      });
  }

  list.addEventListener('click', (e) => {
    const dec = e.target.closest('.checkout-qty-dec');
    const inc = e.target.closest('.checkout-qty-inc');
    const rm  = e.target.closest('.checkout-remove');
    if (!dec && !inc && !rm) return;

    const clicked  = dec || inc || rm;
    const item     = clicked.closest('.cart__item');
    const pid      = item.dataset.productId;
    const price    = parseFloat(item.dataset.price);
    const stock    = parseInt(item.dataset.stock, 10);
    const qtyEl    = item.querySelector('.cart__qty-value');
    const totalEl  = item.querySelector('.js-item-total');
    const orderBtn = document.getElementById('order-btn');
    const prevQty  = parseInt(qtyEl.textContent, 10);

    // Hard cap: ignore increment clicks at stock limit
    if (inc && prevQty >= stock) return;

    const newQty = rm ? 0 : inc ? prevQty + 1 : Math.max(0, prevQty - 1);

    // Lock controls while request is in flight
    item.querySelectorAll('.checkout-qty-dec, .checkout-qty-inc, .checkout-remove')
      .forEach((b) => (b.disabled = true));
    if (orderBtn) orderBtn.disabled = true;

    const summaryItem = document.querySelector(`.cart-summary__item[data-product-id="${pid}"]`);

    if (newQty === 0) {
      item.classList.add('cart__item--removing');
      if (summaryItem) summaryItem.classList.add('cart-summary__item--removing');
    } else {
      qtyEl.textContent = newQty;
      flash(qtyEl);
      const newTotal = price * newQty;
      totalEl.textContent = '$' + newTotal.toFixed(2);
      flash(totalEl);

      if (summaryItem) {
        const sqEl = summaryItem.querySelector('.js-summary-qty');
        const stEl = summaryItem.querySelector('.js-summary-total');
        if (sqEl) sqEl.textContent = newQty;
        if (stEl) stEl.textContent = '$' + newTotal.toFixed(2);
      }
      recalcGrandTotal();
    }

    const isRemove = !!rm || newQty === 0;
    const url  = isRemove ? '/cart-delete-item' : '/cart-update';
    const body = isRemove
      ? new URLSearchParams({ productId: pid, _csrf: getCsrf() })
      : new URLSearchParams({ productId: pid, action: inc ? 'increase' : 'decrease', _csrf: getCsrf() });

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'x-requested-with': 'fetch' },
      body: body.toString(),
    })
      .then((r) => r.json())
      .then(({ removed }) => {
        if (removed || newQty === 0) {
          setTimeout(() => {
            item.remove();
            summaryItem?.remove();
            recalcGrandTotal();
            if (!document.querySelector('.cart__item')) {
              window.location.href = '/';
            }
          }, 250);
        } else {
          item.querySelectorAll('.checkout-qty-dec, .checkout-qty-inc, .checkout-remove')
            .forEach((b) => (b.disabled = false));
          syncIncBtn(item);

          // Optimistically clear the error if client-side check says all items are in stock.
          // Button stays disabled (loading) until refreshSession confirms and provides session ID.
          if (allItemsInStock()) {
            setStockError(null);
            const btn = document.getElementById('order-btn');
            if (btn) btn.disabled = true;
          }
        }
        refreshSession();
      })
      .catch(() => {
        qtyEl.textContent   = prevQty;
        totalEl.textContent = '$' + (price * prevQty).toFixed(2);
        if (summaryItem) {
          const sqEl = summaryItem.querySelector('.js-summary-qty');
          const stEl = summaryItem.querySelector('.js-summary-total');
          if (sqEl) sqEl.textContent = prevQty;
          if (stEl) stEl.textContent = '$' + (price * prevQty).toFixed(2);
        }
        recalcGrandTotal();
        item.querySelectorAll('.checkout-qty-dec, .checkout-qty-inc, .checkout-remove')
          .forEach((b) => (b.disabled = false));
        syncIncBtn(item);
        if (orderBtn) orderBtn.disabled = false;
      });
  });
});
