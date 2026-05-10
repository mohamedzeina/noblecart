(function () {
  const isWishlistPage = window.location.pathname === '/wishlist';

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'cart-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('cart-toast--show')));
    setTimeout(() => {
      toast.classList.remove('cart-toast--show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function updateBadge(count) {
    let badge = document.getElementById('wishlist-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'wishlist-badge';
      badge.className = 'wishlist-badge';
      const icon = document.querySelector('.wishlist-nav-icon');
      if (icon) icon.appendChild(badge);
    }
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  document.querySelectorAll('.wishlist-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const productId = btn.dataset.productId;
      const csrf = btn.dataset.csrf;

      fetch('/wishlist-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `productId=${encodeURIComponent(productId)}&_csrf=${encodeURIComponent(csrf)}`,
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.success) return;

          btn.classList.toggle('wishlist-btn--active', data.inWishlist);
          btn.setAttribute('aria-label', data.inWishlist ? 'Remove from wishlist' : 'Save to wishlist');
          const label = btn.querySelector('.wishlist-detail-btn__label');
          if (label) label.textContent = data.inWishlist ? 'Saved to Wishlist' : 'Save to Wishlist';

          btn.classList.remove('wishlist-btn--pop');
          void btn.offsetWidth;
          btn.classList.add('wishlist-btn--pop');

          updateBadge(data.wishlistCount);
          showToast(data.inWishlist ? 'Saved to wishlist' : 'Removed from wishlist');


          if (isWishlistPage && !data.inWishlist) {
            const card = btn.closest('.card');
            if (!card) return;
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            card.addEventListener('transitionend', () => {
              card.remove();
              const remaining = document.querySelectorAll('.grid .card');
              if (remaining.length === 0) location.reload();
            }, { once: true });
          }
        })
        .catch(console.error);
    });
  });
})();
