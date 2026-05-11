const backdrop = document.querySelector('.backdrop');
const sideDrawer = document.querySelector('.mobile-nav');
const menuToggle = document.querySelector('#side-menu-toggle');

function backdropClickHandler() {
  backdrop.style.display = 'none';
  sideDrawer.classList.remove('open');
}

function menuToggleClickHandler() {
  backdrop.style.display = 'block';
  sideDrawer.classList.add('open');
}

backdrop.addEventListener('click', backdropClickHandler);
menuToggle.addEventListener('click', menuToggleClickHandler);

document.querySelectorAll('form[action="/logout"], form[action="/admin/logout"]').forEach((form) => {
  form.addEventListener('submit', () => {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.style.justifyContent = 'center';
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      `;
    }
  });
});

const accountToggle = document.querySelector('.account-toggle');
const accountMenu = document.querySelector('.account-menu');

if (accountToggle && accountMenu) {
  accountToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = accountMenu.classList.toggle('account-menu--open');
    accountToggle.setAttribute('aria-expanded', String(isOpen));
  });

  accountMenu.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', () => {
    accountMenu.classList.remove('account-menu--open');
    accountToggle.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      accountMenu.classList.remove('account-menu--open');
      accountToggle.setAttribute('aria-expanded', 'false');
      accountToggle.focus();
    }
  });
}

if (new URLSearchParams(window.location.search).has('page')) {
  const products = document.getElementById('products');
  if (products) products.scrollIntoView({ behavior: 'instant', block: 'start' });
}
