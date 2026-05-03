document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.parentNode.querySelector('[name=productId]').value;
      const csrf = btn.parentNode.querySelector('[name=_csrf]').value;
      const prodElement = btn.closest('article');

      fetch('/admin/product/' + prodId, {
        method: 'DELETE',
        headers: { 'csrf-token': csrf },
      })
        .then(result => result.json())
        .then(data => {
          console.log(data);
          prodElement.parentNode.removeChild(prodElement);

          if (document.querySelectorAll('.product-item').length === 0) {
            document.querySelector('.grid')?.remove();
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
          }
        })
        .catch(err => console.log(err));
    });
  });
});
