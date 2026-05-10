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
