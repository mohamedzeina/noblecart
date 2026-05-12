document.addEventListener('DOMContentLoaded', () => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    if (reducedMotion) {
      el.textContent = prefix + target.toFixed(decimals);
    } else {
      setTimeout(() => countUp(el, target, prefix, decimals, 900), i * 80);
    }
  });

  // Animate status bars — set width via JS to avoid CSP inline-style restriction
  document.querySelectorAll('.dash-status-row__bar[data-pct]').forEach((bar, i) => {
    const pct = bar.dataset.pct;
    if (reducedMotion) {
      bar.style.width = pct + '%';
    } else {
      setTimeout(() => { bar.style.width = pct + '%'; }, 400 + i * 60);
    }
  });

  // Revenue trend chart
  const canvas = document.getElementById('revenue-chart');
  if (canvas && typeof Chart !== 'undefined') {
    const rawLabels = canvas.dataset.labels.split(',');
    const rawValues = canvas.dataset.values.split(',').map(Number);

    // Format labels as "May 12" style
    const labels = rawLabels.map(d => {
      const [y, m, day] = d.split('-');
      return new Date(+y, +m - 1, +day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    });

    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
          data: rawValues,
          fill: true,
          tension: 0.4,
          borderColor: '#3b82f6',
          borderWidth: 2,
          backgroundColor: (ctx) => {
            const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
            gradient.addColorStop(0, 'rgba(59,130,246,0.18)');
            gradient.addColorStop(1, 'rgba(59,130,246,0)');
            return gradient;
          },
          pointRadius: rawLabels.length <= 7 ? 4 : 2,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reducedMotion ? false : { duration: 600, easing: 'easeOutCubic' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#94a3b8',
            bodyColor: '#f8fafc',
            padding: 10,
            callbacks: {
              label: (ctx) => ' $' + ctx.parsed.y.toFixed(2),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 }, maxTicksLimit: 8 },
            border: { display: false },
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              callback: (v) => '$' + v.toFixed(0),
            },
            border: { display: false },
          },
        },
      },
    });
  }
});
