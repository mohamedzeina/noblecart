document.querySelectorAll('.input-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = btn.closest('.input-wrapper').querySelector('input');
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        btn.classList.toggle('is-visible', isHidden);
        btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        input.focus();
    });
});

document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', () => {
        const btn = form.querySelector('button[type="submit"]');
        if (!btn) return;
        btn.disabled = true;
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Please wait…
        `;
    });
});
