const imageInput = document.getElementById('image');
const imagePreview = document.getElementById('image-preview');
const imagePlaceholder = document.getElementById('upload-placeholder');
const imageArea = document.getElementById('file-upload-area');

const modelInput = document.getElementById('model-file');
const modelPlaceholder = document.getElementById('model-placeholder');

function showImagePreview(src) {
  imagePreview.src = src;
  imagePreview.style.display = 'block';
  if (imagePlaceholder) imagePlaceholder.style.display = 'none';
}

function compositeOnWhite(rawBlob) {
  return new Promise((resolve) => {
    const img = new Image();
    const rawUrl = URL.createObjectURL(rawBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#eef2f6';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(rawUrl);
      canvas.toBlob(resolve, 'image/png');
    };
    img.src = rawUrl;
  });
}

function lockImageSection() {
  imageArea.classList.add('file-upload--locked');
  const hint = imageArea.querySelector('.file-upload__hint');
  if (hint) hint.textContent = 'Auto-generated from 3D model';
  const labelHint = document.getElementById('image-label-hint');
  if (labelHint) labelHint.textContent = '(auto-generated from 3D model)';
}

const adminForm = document.querySelector('form');
const submitBtn = adminForm && adminForm.querySelector('button[type="submit"]');
if (adminForm && submitBtn) {
  adminForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitBtn.classList.add('btn--loading');
    // setTimeout(0) passes through the browser's rendering phase before submitting,
    // guaranteeing the loading state is painted first
    setTimeout(() => adminForm.submit(), 0);
  });
}

// Manual image selection
imageInput.addEventListener('change', () => {
  const file = imageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => showImagePreview(e.target.result);
  reader.readAsDataURL(file);
});

imageInput.addEventListener('dragover', (e) => { e.preventDefault(); imageArea.classList.add('drag-over'); });
imageInput.addEventListener('dragleave', () => imageArea.classList.remove('drag-over'));
imageInput.addEventListener('drop', () => imageArea.classList.remove('drag-over'));

// GLB selection — create model-viewer in its own container, capture thumbnail on white
if (modelInput) {
  modelInput.addEventListener('change', () => {
    const file = modelInput.files[0];
    if (!file) return;

    const container = document.getElementById('model-viewer-container');

    if (modelPlaceholder) {
      modelPlaceholder.querySelector('p').textContent = file.name;
      modelPlaceholder.querySelector('span').textContent = 'Generating thumbnail…';
    }

    let mv = document.getElementById('model-preview-viewer');
    if (!mv) {
      mv = document.createElement('model-viewer');
      mv.id = 'model-preview-viewer';
      mv.setAttribute('auto-rotate', '');
      mv.setAttribute('camera-controls', '');
      mv.setAttribute('interaction-prompt', 'none');
      mv.setAttribute('ar-modes', '');
      mv.style.cssText = 'width:100%;height:420px;overflow:hidden;display:block;';
      container.appendChild(mv);
    }

    container.style.display = 'block';
    mv.src = URL.createObjectURL(file);

    mv.addEventListener('load', () => {
      setTimeout(async () => {
        try {
          const rawBlob = await mv.toBlob({ idealAspect: true, mimeType: 'image/png' });
          if (!rawBlob || rawBlob.size === 0) return;

          // Composite the transparent GLB render over a solid white background
          const finalBlob = await compositeOnWhite(rawBlob);
          if (!finalBlob) return;

          const dt = new DataTransfer();
          dt.items.add(new File([finalBlob], 'thumbnail.png', { type: 'image/png' }));
          imageInput.files = dt.files;

          const reader = new FileReader();
          reader.onload = (e) => showImagePreview(e.target.result);
          reader.readAsDataURL(finalBlob);

          if (modelPlaceholder) modelPlaceholder.querySelector('span').textContent = 'Thumbnail captured';
          lockImageSection();
        } catch (err) {
          console.error('Thumbnail capture failed:', err);
        }
      }, 1500);
    }, { once: true });
  });
}
