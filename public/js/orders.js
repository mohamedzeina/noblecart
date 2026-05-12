document.querySelectorAll('.order-detail__reorder-form').forEach((form) => {
  form.addEventListener('submit', () => {
    const btn = form.querySelector('.order-detail__reorder-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="spin" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Adding…
    `;
  });
});
