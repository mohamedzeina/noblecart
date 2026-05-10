(function () {
  const drawer = document.getElementById('cart-drawer');
  if (!drawer) return;

  const overlay = document.getElementById('cart-drawer-overlay');
  const closeBtn = document.getElementById('cart-drawer-close');
  const body = document.getElementById('cart-drawer-body');
  const footer = document.getElementById('cart-drawer-footer');
  const grandTotal = document.getElementById('drawer-grand-total');
  const toggle = document.getElementById('cart-drawer-toggle');
  const countEl = document.getElementById('drawer-count');
  const continueBtn = document.getElementById('cart-drawer-continue');

  function getCsrf() {
    return document.getElementById('cart-drawer-csrf')?.value || '';
  }

  function updateBadge(count) {
    let badge = document.querySelector('.cart-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        toggle?.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  }

  function recalcTotal() {
    let total = 0;
    let count = 0;
    drawer.querySelectorAll('.drawer-item').forEach((item) => {
      const qty = parseInt(item.querySelector('.drawer-qty-value').textContent);
      total += parseFloat(item.dataset.price) * qty;
      count += qty;
    });
    grandTotal.textContent = '$' + total.toFixed(2);
    if (countEl) countEl.textContent = count > 0 ? `(${count})` : '';
  }

  function renderItems(items) {
    if (items.length === 0) {
      body.innerHTML = '<p class="cart-drawer__empty">Your cart is empty.</p>';
      footer.style.display = 'none';
      return;
    }

    footer.style.display = '';
    if (countEl) countEl.textContent = `(${items.reduce((s, i) => s + i.quantity, 0)})`;
    body.innerHTML = items.map((item) => `
      <div class="drawer-item" data-product-id="${item.productId}" data-price="${item.price}">
        <div class="drawer-item__image">
          <img src="${item.imageUrl}" alt="${item.title}">
        </div>
        <div class="drawer-item__info">
          <p class="drawer-item__title">${item.title}</p>
          <p class="drawer-item__price">$${item.price.toFixed(2)} each</p>
          <div class="drawer-item__controls">
            <button class="drawer-qty-btn" data-action="decrease" data-product-id="${item.productId}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="12" height="12">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
              </svg>
            </button>
            <span class="drawer-qty-value">${item.quantity}</span>
            <button class="drawer-qty-btn" data-action="increase" data-product-id="${item.productId}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="12" height="12">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>
        <div class="drawer-item__right">
          <span class="drawer-item__total">$${(item.price * item.quantity).toFixed(2)}</span>
          <button class="drawer-item__remove" data-product-id="${item.productId}" title="Remove">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    recalcTotal();
  }

  function loadCart() {
    body.innerHTML = '<div class="cart-drawer__loading">Loading…</div>';
    fetch('/cart/data')
      .then((res) => res.json())
      .then((data) => renderItems(data.items))
      .catch(() => {
        body.innerHTML = '<p class="cart-drawer__empty">Failed to load cart.</p>';
      });
  }

  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    loadCart();
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Open on cart icon click
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      openDrawer();
    });
  }

  // Close
  overlay.addEventListener('click', closeDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  if (continueBtn) continueBtn.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  // Qty + remove delegation
  body.addEventListener('click', (e) => {
    const qtyBtn = e.target.closest('.drawer-qty-btn');
    const removeBtn = e.target.closest('.drawer-item__remove');

    if (qtyBtn) {
      const productId = qtyBtn.dataset.productId;
      const action = qtyBtn.dataset.action;
      const item = body.querySelector(`.drawer-item[data-product-id="${productId}"]`);
      const btns = item.querySelectorAll('.drawer-qty-btn');
      btns.forEach((b) => (b.disabled = true));

      fetch('/cart-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ productId, action, _csrf: getCsrf() }),
      })
        .then((res) => res.json())
        .then(({ cartCount, itemQuantity, removed }) => {
          updateBadge(cartCount);
          if (removed) {
            item.remove();
            if (!body.querySelector('.drawer-item')) {
              body.innerHTML = '<p class="cart-drawer__empty">Your cart is empty.</p>';
              footer.style.display = 'none';
            }
          } else {
            item.querySelector('.drawer-qty-value').textContent = itemQuantity;
            const price = parseFloat(item.dataset.price);
            item.querySelector('.drawer-item__total').textContent = '$' + (price * itemQuantity).toFixed(2);
          }
          recalcTotal();
        })
        .finally(() => btns.forEach((b) => (b.disabled = false)));
    }

    if (removeBtn) {
      const productId = removeBtn.dataset.productId;
      const item = body.querySelector(`.drawer-item[data-product-id="${productId}"]`);

      fetch('/cart-delete-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-requested-with': 'fetch',
        },
        body: new URLSearchParams({ productId, _csrf: getCsrf() }),
      })
        .then((res) => res.json())
        .then(({ cartCount }) => {
          updateBadge(cartCount);
          item.remove();
          if (!body.querySelector('.drawer-item')) {
            body.innerHTML = '<p class="cart-drawer__empty">Your cart is empty.</p>';
            footer.style.display = 'none';
          }
          recalcTotal();
        });
    }
  });
})();
