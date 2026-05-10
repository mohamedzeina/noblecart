import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const toggleBtns = document.querySelectorAll('.view-toggle__btn');
const viewImage = document.getElementById('view-image');
const view3d = document.getElementById('view-3d');
const modelUrl = view3d.dataset.modelUrl;

// Warm the browser cache immediately so the GLB is ready when the user clicks
fetch(modelUrl);

let viewerInitialized = false;

function initViewer() {
  const wrap = document.createElement('div');
  wrap.className = 'viewer-wrap';

  const loadingEl = document.createElement('div');
  loadingEl.className = 'viewer-loading';
  loadingEl.innerHTML = `
    <div class="viewer-loading__bar">
      <div class="viewer-loading__progress" id="viewer-progress"></div>
    </div>
    <span id="viewer-loading-text">Loading model…</span>
  `;
  wrap.appendChild(loadingEl);
  view3d.appendChild(wrap);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef2f6);

  const camera = new THREE.PerspectiveCamera(45, wrap.clientWidth / wrap.clientHeight, 0.01, 1000);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
  pmrem.dispose();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.5;
  controls.enablePan = false;

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  loader.load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.15;

      camera.position.set(center.x, center.y + size.y * 0.1, center.z + dist);
      camera.near = dist / 100;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();

      controls.target.copy(center);
      controls.minDistance = dist * 0.4;
      controls.maxDistance = dist * 4;
      controls.update();

      scene.add(model);
      loadingEl.style.display = 'none';
    },
    (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        const bar = document.getElementById('viewer-progress');
        const text = document.getElementById('viewer-loading-text');
        if (bar) bar.style.width = pct + '%';
        if (text) text.textContent = `Loading… ${pct}%`;
      }
    },
    (err) => {
      console.error('GLB load error:', err);
      const text = document.getElementById('viewer-loading-text');
      if (text) text.textContent = 'Failed to load model.';
    }
  );

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  const ro = new ResizeObserver(() => {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w && h) {
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  });
  ro.observe(wrap);
}

toggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    toggleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.dataset.view === '3d') {
      viewImage.style.display = 'none';
      view3d.style.display = 'block';
      if (!viewerInitialized) {
        viewerInitialized = true;
        initViewer();
      }
    } else {
      viewImage.style.display = 'block';
      view3d.style.display = 'none';
    }
  });
});
