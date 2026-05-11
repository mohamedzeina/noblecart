document.addEventListener('DOMContentLoaded', () => {
  const main = document.querySelector('main');

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'cart-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('cart-toast--show'));
    setTimeout(() => {
      toast.classList.remove('cart-toast--show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 2500);
  }

  function updateOrderStatus(statusContainer, orderId, csrf, newStatus) {
    fetch(`/admin/order/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'csrf-token': csrf },
      body: JSON.stringify({ status: newStatus }),
    })
      .then((res) => res.json())
      .then(({ status }) => {
        const badge = statusContainer.querySelector('.order-status-badge');
        badge.className = `order-status-badge order-status-badge--${status}`;
        badge.textContent = status.replace(/_/g, ' ');
        statusContainer.querySelector('.order-status-actions')?.remove();
        statusContainer.querySelector('.order-cancel-confirm')?.remove();
        showToast('Order status updated');
      })
      .catch(() => {
        statusContainer.innerHTML = statusContainer.dataset.original;
        showToast('Failed to update status');
      });
  }

  const STATUS_LABELS = {
    confirmed: 'Confirmed', shipped: 'Shipped',
    out_for_delivery: 'Out for delivery', delivered: 'Delivered', canceled: 'Canceled',
  };

  main.addEventListener('click', (e) => {
    if (e.target.closest('.order-status-btn')) {
      const btn = e.target.closest('.order-status-btn');
      const statusContainer = btn.closest('.admin-order-item__status');
      const newStatus = btn.dataset.status;
      const label = STATUS_LABELS[newStatus] || newStatus;

      statusContainer.dataset.pendingStatus = newStatus;
      statusContainer.dataset.csrf = btn.dataset.csrf;
      statusContainer.dataset.orderId = btn.dataset.orderId;
      statusContainer.dataset.original = statusContainer.innerHTML;

      statusContainer.querySelector('.order-status-actions').style.display = 'none';

      const confirmEl = document.createElement('div');
      confirmEl.className = 'order-cancel-confirm';
      confirmEl.innerHTML = `
        <span class="order-cancel-confirm__label">Move to <strong>${label}</strong>?</span>
        <button class="btn order-cancel-confirm__yes" type="button">Yes</button>
        <button class="btn order-cancel-confirm__no" type="button">Cancel</button>
      `;
      statusContainer.appendChild(confirmEl);
      return;
    }

    if (e.target.closest('.order-cancel-confirm__no')) {
      const statusContainer = e.target.closest('.admin-order-item__status');
      statusContainer.innerHTML = statusContainer.dataset.original;
      return;
    }

    if (e.target.closest('.order-cancel-confirm__yes')) {
      const yesBtn = e.target.closest('.order-cancel-confirm__yes');
      const statusContainer = yesBtn.closest('.admin-order-item__status');
      const orderId = statusContainer.dataset.orderId;
      const csrf = statusContainer.dataset.csrf;
      const newStatus = statusContainer.dataset.pendingStatus;
      yesBtn.disabled = true;
      yesBtn.textContent = 'Updating…';
      updateOrderStatus(statusContainer, orderId, csrf, newStatus);
      return;
    }
  });

  main.addEventListener('click', (e) => {
    // Delete button clicked — show inline confirmation
    if (e.target.closest('.delete-btn')) {
      const btn = e.target.closest('.delete-btn');
      const actions = btn.closest('.card__actions');

      actions.dataset.prodId = btn.parentNode.querySelector('[name=productId]').value;
      actions.dataset.csrf = btn.parentNode.querySelector('[name=_csrf]').value;
      actions.dataset.original = actions.innerHTML;

      actions.innerHTML = `
        <span class="delete-confirm__label">Delete this product?</span>
        <button class="btn delete-confirm__yes" type="button">Yes, delete</button>
        <button class="btn delete-confirm__no" type="button">Cancel</button>
      `;
    }

    // Cancel — restore original buttons
    if (e.target.closest('.delete-confirm__no')) {
      const actions = e.target.closest('.card__actions');
      actions.innerHTML = actions.dataset.original;
    }

    // Confirm — proceed with delete
    if (e.target.closest('.delete-confirm__yes')) {
      const yesBtn = e.target.closest('.delete-confirm__yes');
      const actions = yesBtn.closest('.card__actions');
      const prodId = actions.dataset.prodId;
      const csrf = actions.dataset.csrf;
      const prodElement = actions.closest('article');

      yesBtn.disabled = true;
      yesBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Deleting…
      `;

      fetch('/admin/product/' + prodId, {
        method: 'DELETE',
        headers: { 'csrf-token': csrf },
      })
        .then(result => result.json())
        .then(({ totalItems }) => {
          prodElement.remove();
          showToast('Product deleted');

          const subtitle = document.querySelector('.admin-page-header__subtitle');
          if (subtitle) {
            const remaining = document.querySelectorAll('.admin-product-item').length;
            subtitle.textContent = `${remaining} product${remaining !== 1 ? 's' : ''} listed`;
          }

          const ITEMS_PER_PAGE = 6;
          const params = new URLSearchParams(window.location.search);
          const currentPage = parseInt(params.get('page')) || 1;
          const lastPage = Math.ceil(totalItems / ITEMS_PER_PAGE);

          if (totalItems === 0) {
            document.querySelector('.admin-product-list')?.remove();
            document.querySelector('.pagination')?.remove();
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
              <div class="empty-state__icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="48" height="48">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 class="empty-state__title">No products yet</h2>
              <p class="empty-state__subtitle">Get started by adding your first product.</p>
            `;
            document.querySelector('main').appendChild(emptyState);
          } else if (currentPage > lastPage) {
            params.set('page', lastPage);
            window.location.search = params.toString();
          } else {
            window.location.reload();
          }
        })
        .catch(err => console.log(err));
    }
  });
});
