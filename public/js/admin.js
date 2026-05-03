document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.parentNode.querySelector('[name=productId]').value;
      const csrf = btn.parentNode.querySelector('[name=_csrf]').value;
      const prodElement = btn.closest('article');

      fetch('/admin/product/' + prodId, {
        method: 'DELETE',
        headers: { 'csrf-token': csrf },
      })
        .then(result => result.json())
        .then(data => {
          console.log(data);
          prodElement.parentNode.removeChild(prodElement);
        })
        .catch(err => console.log(err));
    });
  });
});
