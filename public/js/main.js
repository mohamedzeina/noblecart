const SPINNER = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;

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
      btn.innerHTML = SPINNER;
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

// Review form — validation + loading state
const reviewForm = document.querySelector('form.review-form');
if (reviewForm) {
  const errorEl = document.getElementById('review-error-msg');
  reviewForm.addEventListener('submit', (e) => {
    if (!reviewForm.querySelector('input[name="rating"]:checked')) {
      e.preventDefault();
      errorEl.textContent = 'Please select a star rating before submitting.';
      errorEl.style.display = '';
      return;
    }
    errorEl.style.display = 'none';
    const btn = reviewForm.querySelector('.review-form__submit');
    btn.disabled = true;
    btn.innerHTML = SPINNER + ' Submitting…';
  });
}

// Edit review form — loading state
const editReviewForm = document.querySelector('.review-form__edit-fields');
if (editReviewForm) {
  editReviewForm.addEventListener('submit', () => {
    const btn = editReviewForm.querySelector('.review-form__submit');
    btn.disabled = true;
    btn.innerHTML = SPINNER + ' Saving…';
  });
}

// Delete review — loading state
const deleteReviewBtn = document.querySelector('.review-form__delete-btn');
if (deleteReviewBtn) {
  deleteReviewBtn.closest('form').addEventListener('submit', () => {
    deleteReviewBtn.disabled = true;
    deleteReviewBtn.innerHTML = SPINNER;
  });
}
