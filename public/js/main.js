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

// Load more reviews
const loadMoreBtn = document.querySelector('.reviews-load-more__btn');
if (loadMoreBtn) {
  const loadMoreWrap = loadMoreBtn.closest('.reviews-load-more');
  const countEl = loadMoreWrap.querySelector('.reviews-load-more__count');
  const list = document.getElementById('review-list');

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function buildStars(rating) {
    let s = '';
    for (let i = 1; i <= 5; i++) {
      s += `<svg class="star${i <= rating ? ' star--filled' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
    return s;
  }

  loadMoreBtn.addEventListener('click', () => {
    const productId = loadMoreBtn.dataset.productId;
    let skip = parseInt(loadMoreBtn.dataset.skip, 10);

    loadMoreBtn.disabled = true;
    loadMoreBtn.innerHTML = SPINNER + ' Loading…';

    fetch(`/products/${productId}/reviews?skip=${skip}`)
      .then((r) => r.json())
      .then(({ reviews, hasMore }) => {
        reviews.forEach((review) => {
          const date = new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const verified = review.verifiedPurchase ? '<span class="review-item__verified">Verified Purchase</span>' : '';
          const li = document.createElement('li');
          li.className = 'review-item';
          li.innerHTML = `
            <div class="review-item__header">
              <div class="review-item__avatar">${escHtml(review.userName.charAt(0).toUpperCase())}</div>
              <div class="review-item__meta">
                <div class="stars-display">${buildStars(review.rating)}</div>
                <div class="review-item__author-row">
                  <span class="review-item__author">${escHtml(review.userName)}</span>
                  ${verified}
                </div>
              </div>
              <span class="review-item__date">${date}</span>
            </div>
            <p class="review-item__comment">"${escHtml(review.comment)}"</p>`;
          list.appendChild(li);
        });

        skip += reviews.length;
        loadMoreBtn.dataset.skip = skip;
        if (countEl) countEl.textContent = `${skip} of ${parseInt(countEl.textContent.split('of')[1], 10)}`;

        if (!hasMore) {
          loadMoreWrap.remove();
        } else {
          loadMoreBtn.disabled = false;
          loadMoreBtn.textContent = 'Load more reviews';
        }
      })
      .catch(() => {
        loadMoreBtn.disabled = false;
        loadMoreBtn.textContent = 'Load more reviews';
      });
  });
}

// Edit review toggle
const reviewCard = document.querySelector('.review-form--existing');
if (reviewCard) {
  reviewCard.querySelector('.review-form__edit-btn')?.addEventListener('click', () => {
    reviewCard.classList.add('review-form--editing');
  });
  reviewCard.querySelector('.review-form__cancel-btn')?.addEventListener('click', () => {
    reviewCard.classList.remove('review-form--editing');
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) reviewCard.classList.remove('review-form--editing');
  });
}
