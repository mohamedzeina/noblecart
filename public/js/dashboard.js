document.addEventListener('DOMContentLoaded', () => {
  // Count-up animation for KPI values
  function countUp(el, target, prefix, decimals, duration) {
    const start = performance.now();
    const update = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + (eased * target).toFixed(decimals);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  document.querySelectorAll('.dash-kpi__value[data-target]').forEach((el, i) => {
    const target   = parseFloat(el.dataset.target) || 0;
    const prefix   = el.dataset.prefix || '';
    const decimals = parseInt(el.dataset.decimals, 10) || 0;
    setTimeout(() => countUp(el, target, prefix, decimals, 900), i * 80);
  });

  // Animate status bars — set width via JS to avoid CSP inline-style restriction
  document.querySelectorAll('.dash-status-row__bar[data-pct]').forEach((bar, i) => {
    const pct = bar.dataset.pct;
    setTimeout(() => { bar.style.width = pct + '%'; }, 400 + i * 60);
  });
});
