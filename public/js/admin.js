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
