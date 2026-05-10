(function () {
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');
  const suggestions = document.getElementById('search-suggestions');
  const backdrop = document.getElementById('search-backdrop');
  const closeBtn = document.getElementById('search-close');
  const toggleBtns = document.querySelectorAll('.search-toggle');

  if (!overlay) return;

  let debounceTimer;
  let activeIndex = -1;

  function open() {
    overlay.classList.add('open');
    setTimeout(() => input.focus(), 50);
  }

  function close() {
    overlay.classList.remove('open');
    clearSuggestions();
    input.value = '';
    activeIndex = -1;
  }

  toggleBtns.forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      overlay.classList.contains('open') ? close() : open();
    })
  );

  backdrop.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  function clearSuggestions() {
    suggestions.innerHTML = '';
    activeIndex = -1;
  }

  function showLoading() {
    const row = `
      <div class="search-skeleton__item">
        <div class="search-skeleton__img"></div>
        <div class="search-skeleton__text">
          <div class="search-skeleton__line search-skeleton__line--title"></div>
          <div class="search-skeleton__line search-skeleton__line--meta"></div>
        </div>
        <div class="search-skeleton__price"></div>
      </div>`;
    suggestions.innerHTML = `<div class="search-skeleton">${row}${row}${row}</div>`;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function categoryLabel(cat) {
    const map = { electronics: 'Electronics', fashion: 'Fashion', home: 'Home & Living', accessories: 'Accessories' };
    return map[cat] || cat;
  }

  function renderSuggestions(results, query, wishlistedIds) {
    if (!results.length) { clearSuggestions(); return; }

    const saved = new Set(wishlistedIds);

    const items = results
      .map((p) => {
        const heart = saved.has(String(p._id)) ? `
          <span class="search-suggestion__heart">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z"/>
            </svg>
          </span>` : '';
        return `
        <a class="search-suggestion" href="/products/${p._id}">
          <img class="search-suggestion__img" src="${escHtml(p.imageUrl)}" alt="${escHtml(p.title)}" loading="lazy">
          <div class="search-suggestion__text">
            <div class="search-suggestion__title">${escHtml(p.title)}</div>
            <div class="search-suggestion__meta">${escHtml(categoryLabel(p.category))}</div>
          </div>
          <div class="search-suggestion__right">
            ${heart}
            <span class="search-suggestion__price">$${parseFloat(p.price).toFixed(2)}</span>
          </div>
        </a>`;
      })
      .join('');

    const footer = `<div class="search-suggestions__footer" data-query="${escHtml(query)}">View all results for "<strong>${escHtml(query)}</strong>"</div>`;

    suggestions.innerHTML = items + footer;
    activeIndex = -1;

    suggestions.querySelector('.search-suggestions__footer').addEventListener('click', function () {
      submitSearch(this.dataset.query);
    });
  }

  function submitSearch(q) {
    if (q && q.trim()) window.location.href = '/search?q=' + encodeURIComponent(q.trim());
  }

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitSearch(input.value);
  });

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 2) { clearSuggestions(); return; }
    showLoading();
    debounceTimer = setTimeout(() => {
      fetch('/search/suggest?q=' + encodeURIComponent(q))
        .then((r) => r.json())
        .then((data) => renderSuggestions(data.results, data.query, data.wishlistedIds || []))
        .catch(clearSuggestions);
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('.search-suggestion');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
      updateActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        window.location.href = items[activeIndex].href;
      } else {
        submitSearch(input.value);
      }
    }
  });

  function updateActive(items) {
    items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
  }
})();
