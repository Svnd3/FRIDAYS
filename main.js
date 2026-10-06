// ╔══════════════════════════════════════════════════════════╗
// ║  Photo Globe — Concentric spheres of squircle photos   ║
// ║  Three.js  •  OrbitControls  •  Fibonacci distribution ║
// ╚══════════════════════════════════════════════════════════╝

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── Configuration ──────────────────────────────────────────

/** Each layer defines a concentric sphere of photo tiles */
const LAYERS = [
  { radius: 7.0,  count: 80, cardSize: 1.15, speed:  0.08  },
  { radius: 5.0,  count: 48, cardSize: 0.95, speed: -0.12  },
  { radius: 3.2,  count: 24, cardSize: 0.78, speed:  0.17  },
  { radius: 1.8,  count: 10, cardSize: 0.58, speed: -0.24  },
];

const NUM_UNIQUE_PHOTOS   = 42;
const PHOTO_RESOLUTION    = 300;        // px per texture tile
const CORNER_RADIUS_RATIO = 0.13;       // squircle softness
const BG_COLOR            = 0xf6eee3;
const FOG_DENSITY         = 0.012;

// ─── DOM References ─────────────────────────────────────────

const container   = document.getElementById('canvas-container');
const progressBar = document.getElementById('progress-bar');
const progressTxt = document.getElementById('progress-text');
const loadScreen  = document.getElementById('loading-screen');
const instructions = document.getElementById('instructions');

// ─── Scene, Camera, Renderer ────────────────────────────────

const scene = new THREE.Scene();
scene.fog   = new THREE.FogExp2(BG_COLOR, FOG_DENSITY);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 1.5, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(BG_COLOR, 0);
container.appendChild(renderer.domElement);

// ─── Controls ───────────────────────────────────────────────

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.06;
controls.minDistance     = 3.5;
controls.maxDistance     = 30;
controls.enablePan      = false;
controls.rotateSpeed    = 0.5;
controls.zoomSpeed      = 0.7;

let isInteracting = false;
controls.addEventListener('start', () => { isInteracting = true; });
controls.addEventListener('end',   () => { isInteracting = false; });

// ─── Utilities ──────────────────────────────────────────────

/**
 * Distribute `count` points evenly on a sphere of given `radius`
 * using the golden-angle Fibonacci spiral.
 */
function fibonacciSphere(count, radius) {
  const pts = [];
  const golden = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < count; i++) {
    const theta = (2 * Math.PI * i) / golden;
    const phi   = Math.acos(1 - (2 * (i + 0.5)) / count);

    pts.push(new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    ));
  }
  return pts;
}

/** Draw a rounded-rectangle path on a 2-D context (squircle shape) */
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Stamp an image onto a new canvas with a squircle clip + subtle border,
 * then return a THREE.CanvasTexture with transparent corners.
 */
function createSquircleTexture(imageSource) {
  const s = PHOTO_RESOLUTION;
  const r = s * CORNER_RADIUS_RATIO;

  const canvas = document.createElement('canvas');
  canvas.width  = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');

  // Transparent base
  ctx.clearRect(0, 0, s, s);

  // Clip to squircle + draw image
  ctx.save();
  roundedRect(ctx, 0, 0, s, s, r);
  ctx.clip();
  ctx.drawImage(imageSource, 0, 0, s, s);
  ctx.restore();

  // Subtle white border along the squircle edge
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth   = 2.5;
  roundedRect(ctx, 1, 1, s - 2, s - 2, r - 1);
  ctx.stroke();

  // Very faint inner shadow for depth
  ctx.save();
  roundedRect(ctx, 0, 0, s, s, r);
  ctx.clip();
  const grad = ctx.createRadialGradient(s / 2, s / 2, s * 0.32, s / 2, s / 2, s * 0.56);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.07)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generate a beautiful abstract gradient canvas as a photo fallback.
 */
function generateGradientArt(seed, size = PHOTO_RESOLUTION) {
  const s = size;
  const canvas = document.createElement('canvas');
  canvas.width  = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');

  const h1 = (seed * 47 + 15) % 360;
  const h2 = (h1 + 45 + seed * 11) % 360;

  // Angled gradient
  const a  = ((seed * 33) % 360) * (Math.PI / 180);
  const cx = s / 2, cy = s / 2, len = s / 2;
  const grad = ctx.createLinearGradient(
    cx + Math.cos(a) * len, cy + Math.sin(a) * len,
    cx - Math.cos(a) * len, cy - Math.sin(a) * len,
  );
  grad.addColorStop(0,   `hsl(${h1}, 62%, 62%)`);
  grad.addColorStop(0.5, `hsl(${(h1 + h2) / 2}, 55%, 52%)`);
  grad.addColorStop(1,   `hsl(${h2}, 58%, 44%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  // Organic radial blobs for richness
  for (let j = 0; j < 3; j++) {
    const bx = s * (0.2 + 0.6 * Math.abs(Math.sin(seed * 3.1 + j * 2.3)));
    const by = s * (0.2 + 0.6 * Math.abs(Math.cos(seed * 4.7 + j * 1.9)));
    const br = s * (0.14 + 0.12 * Math.abs(Math.sin(seed + j)));
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    rg.addColorStop(0, `hsla(${(h1 + j * 55) % 360}, 60%, 68%, 0.35)`);
    rg.addColorStop(1, `hsla(${(h2 + j * 40) % 360}, 45%, 48%, 0)`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, s, s);
  }

  return canvas;
}

// ─── Photo Loading ──────────────────────────────────────────

async function loadPhotos() {
  let loaded = 0;

  function updateProgress() {
    loaded++;
    const pct = Math.round((loaded / NUM_UNIQUE_PHOTOS) * 100);
    progressBar.style.width = pct + '%';
    progressTxt.textContent  = pct + '%';
  }

  const promises = Array.from({ length: NUM_UNIQUE_PHOTOS }, (_, i) => {
    return new Promise((resolve) => {
      const img   = new Image();
      img.crossOrigin = 'anonymous';

      // Spread IDs across picsum's library for variety
      const picId = (i * 5 + 1);

      img.onload = () => {
        resolve({ texture: createSquircleTexture(img), picId, isFallback: false, seed: i });
        updateProgress();
      };

      img.onerror = () => {
        // Graceful fallback: abstract gradient art
        resolve({ texture: createSquircleTexture(generateGradientArt(i)), picId: null, isFallback: true, seed: i });
        updateProgress();
      };

      img.src = `https://picsum.photos/id/${picId}/${PHOTO_RESOLUTION}/${PHOTO_RESOLUTION}`;
    });
  });

  return Promise.all(promises);
}

// ─── Globe Construction ─────────────────────────────────────

function buildGlobe(photoData) {
  const groups = [];
  const sharedGeo = new THREE.PlaneGeometry(1, 1);

  LAYERS.forEach((layer, li) => {
    const group  = new THREE.Group();
    const points = fibonacciSphere(layer.count, layer.radius);

    points.forEach((pos, pi) => {
      // Cycle textures with an offset per layer to avoid visual repetition
      const dataIdx = (pi + li * 13) % photoData.length;
      const data    = photoData[dataIdx];

      const mat = new THREE.MeshBasicMaterial({
        map:         data.texture,
        transparent: true,
        alphaTest:   0.05,
        side:        THREE.DoubleSide,
        fog:         true,
      });

      const mesh = new THREE.Mesh(sharedGeo, mat);
      mesh.scale.set(layer.cardSize, layer.cardSize, 1);
      mesh.position.copy(pos);

      // Store photo info for click handler
      mesh.userData.picId      = data.picId;
      mesh.userData.isFallback = data.isFallback;
      mesh.userData.seed       = data.seed;

      // Orient card to face outward from the globe center
      mesh.lookAt(pos.clone().multiplyScalar(2));

      group.add(mesh);
      allMeshes.push(mesh);
    });

    scene.add(group);
    groups.push({ group, speed: layer.speed });
  });

  return groups;
}

// ─── Animation Loop ─────────────────────────────────────────

let layerGroups = [];
let allMeshes   = [];
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const speedMul = isInteracting ? 0.15 : 1.0;

  // Per-layer parallax rotation
  layerGroups.forEach((layer, i) => {
    layer.group.rotation.y += layer.speed * 0.008 * speedMul;

    // Very gentle wobble for organic feel
    layer.group.rotation.x = Math.sin(elapsed * 0.13 * (i + 1)) * 0.025;
    layer.group.rotation.z = Math.cos(elapsed * 0.10 * (i + 1)) * 0.018;
  });

  // Subtle floating breath
  scene.position.y = Math.sin(elapsed * 0.18) * 0.12;

  controls.update();
  renderer.render(scene, camera);
}

// ─── Resize ─────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Raycaster & Interaction ────────────────────────────────

const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();
const pointerDown = { x: 0, y: 0 };

const CLICK_THRESHOLD = 6; // px – distinguish click from drag

// Track pointer-down position so we can ignore drags
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDown.x = e.clientX;
  pointerDown.y = e.clientY;
});

renderer.domElement.addEventListener('pointerup', (e) => {
  const dx = e.clientX - pointerDown.x;
  const dy = e.clientY - pointerDown.y;
  if (Math.sqrt(dx * dx + dy * dy) < CLICK_THRESHOLD) {
    onCanvasClick(e);
  }
});

// Hover – change cursor when over a photo tile
renderer.domElement.addEventListener('pointermove', (e) => {
  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(allMeshes, false);
  renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
});

function onCanvasClick(e) {
  pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(allMeshes, false);

  if (hits.length > 0) {
    openModal(hits[0].object.userData);
  }
}

// ─── Modal / Lightbox ───────────────────────────────────────

const modal        = document.getElementById('photo-modal');
const modalImg     = document.getElementById('modal-image');
const modalSpinner = document.getElementById('modal-spinner');
const modalClose   = document.getElementById('modal-close');
const MODAL_SIZE   = 800; // full-res image size for the lightbox

function openModal(data) {
  // Reset state
  modalImg.classList.remove('loaded');
  modalSpinner.classList.remove('hidden');

  if (data.isFallback) {
    // Render high-res gradient art and use as data-URL
    const canvas = generateGradientArt(data.seed, MODAL_SIZE);
    modalImg.src = canvas.toDataURL();
  } else {
    modalImg.src = `https://picsum.photos/id/${data.picId}/${MODAL_SIZE}/${MODAL_SIZE}`;
  }

  modalImg.onload = () => {
    modalSpinner.classList.add('hidden');
    modalImg.classList.add('loaded');
  };

  modal.classList.add('active');
}

function closeModal() {
  modal.classList.remove('active');
}

// Close: click backdrop, × button, or Escape
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});
modalClose.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ─── Init ───────────────────────────────────────────────────

async function init() {
  const photoData = await loadPhotos();
  layerGroups = buildGlobe(photoData);

  // Dismiss loading screen
  loadScreen.classList.add('hidden');
  setTimeout(() => loadScreen.remove(), 1200);

  // Fade out instructions after a few seconds
  setTimeout(() => instructions.classList.add('fade-out'), 4500);

  animate();
}

init();
