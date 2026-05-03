document.addEventListener('submit', (e) => {
  const form = e.target.closest('.add-to-cart-form');
  if (!form) return;
  e.preventDefault();

  const btn = form.querySelector('button[type="submit"]');
  const original = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    Adding…
  `;

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
    .catch(() => form.submit())
    .finally(() => {
      btn.disabled = false;
      btn.textContent = original;
    });
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
