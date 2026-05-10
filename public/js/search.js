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

  function renderSuggestions(results, query) {
    if (!results.length) { clearSuggestions(); return; }

    const items = results
      .map(
        (p) => `
      <a class="search-suggestion" href="/products/${p._id}">
        <img class="search-suggestion__img" src="${escHtml(p.imageUrl)}" alt="${escHtml(p.title)}" loading="lazy">
        <div class="search-suggestion__text">
          <div class="search-suggestion__title">${escHtml(p.title)}</div>
          <div class="search-suggestion__meta">${escHtml(categoryLabel(p.category))}</div>
        </div>
        <span class="search-suggestion__price">$${parseFloat(p.price).toFixed(2)}</span>
      </a>`
      )
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
        .then((data) => renderSuggestions(data.results, data.query))
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
