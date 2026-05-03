const input = document.getElementById('image');
const preview = document.getElementById('image-preview');
const placeholder = document.getElementById('upload-placeholder');
const area = document.getElementById('file-upload-area');

function showPreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

input.addEventListener('change', () => {
  const file = input.files[0];
  if (file) showPreview(file);
});

// The input overlays the area, so drag events fire on the input
input.addEventListener('dragover', (e) => {
  e.preventDefault();
  area.classList.add('drag-over');
});
input.addEventListener('dragleave', () => area.classList.remove('drag-over'));
input.addEventListener('drop', () => area.classList.remove('drag-over'));
