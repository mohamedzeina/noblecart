const avatarInput = document.getElementById('avatar');
const avatarImgPreview = document.getElementById('avatar-img-preview');
const avatarInitial = document.getElementById('avatar-initial');
const nameInput = document.getElementById('name');

function updateInitial() {
  const val = nameInput ? nameInput.value.trim() : '';
  avatarInitial.textContent = val ? val[0].toUpperCase() : '?';
}

if (nameInput) {
  nameInput.addEventListener('input', updateInitial);
  updateInitial();
}

if (avatarInput) {
  avatarInput.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      avatarImgPreview.src = e.target.result;
      avatarImgPreview.classList.remove('hidden');
      avatarInitial.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
}
