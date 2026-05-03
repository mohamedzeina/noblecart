document.addEventListener('submit', (e) => {
  const form = e.target.closest('.add-to-cart-form');
  if (!form) return;
  e.preventDefault();

  fetch('/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'fetch',
    },
    body: new URLSearchParams(new FormData(form)),
  })
    .then((res) => res.json())
    .then(({ cartCount }) => {
      let badge = document.querySelector('.cart-badge');
      if (badge) {
        badge.textContent = cartCount;
      } else {
        badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.textContent = cartCount;
        const icon = document.querySelector('.nav-icon');
        if (icon) icon.appendChild(badge);
      }
      showToast('Added to cart');
    })
    .catch(() => form.submit());
});

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'cart-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('cart-toast--show'));
  });
  setTimeout(() => {
    toast.classList.remove('cart-toast--show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
