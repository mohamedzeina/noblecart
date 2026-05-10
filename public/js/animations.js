document.addEventListener('DOMContentLoaded', () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const sectionHeader = document.querySelector('.products-section__header');
  const categoryCards = document.querySelectorAll('.category-card');
  const cards = document.querySelectorAll('.card');
  const targets = [];

  if (sectionHeader) {
    sectionHeader.classList.add('fade-up');
    targets.push(sectionHeader);
  }

  categoryCards.forEach((card, i) => {
    card.classList.add('fade-up');
    card.style.transitionDelay = `${i * 0.08}s`;
    targets.push(card);
  });

  cards.forEach((card, i) => {
    card.classList.add('fade-up');
    card.style.transitionDelay = `${i * 0.08}s`;
    targets.push(card);
  });

  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        entry.target.addEventListener(
          'transitionend',
          () => {
            entry.target.classList.remove('fade-up');
            entry.target.style.transitionDelay = '';
          },
          { once: true }
        );
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.1 }
  );

  targets.forEach((el) => observer.observe(el));
});
