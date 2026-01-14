const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("fileInput");
const selectBtn = document.getElementById("selectBtn");
const sky = document.getElementById("sky");
const resetBtn = document.getElementById("resetBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");

const DEFAULT_FOV = 80;
let currentFov = DEFAULT_FOV;
const MIN_FOV = 20;
const MAX_FOV = 110;
const ZOOM_STEP = 5;

//=============================
// Script Loading
//=============================

async function loadAFrame() {
  if (window.AFRAME) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://aframe.io/releases/1.6.0/aframe.min.js";
    script.onload = () => {
      console.log("A-Frame 1.6.0 loaded");
      if (document.readyState === 'complete') {
        setTimeout(resolve, 200);
      } else {
        window.addEventListener('load', () => setTimeout(resolve, 200));
      }
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

//=============================
// Initialization
//=============================

async function init() {
  try {
    await loadAFrame();
    setupEventListeners();
    setupZoomHandler();
  } catch (err) {
    console.error("Error during A-Frame initialization:", err);
  }
}

function updateZoom(delta) {
  const camera = document.querySelector("[camera]");
  if (!camera) return;

  currentFov = Math.min(MAX_FOV, Math.max(MIN_FOV, currentFov + delta));
  camera.setAttribute("camera", "fov", currentFov);
}

function setupEventListeners() {
  if (selectBtn) selectBtn.onclick = () => fileInput.click();
  if (fileInput) fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  if (dropZone) {
    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    };
    dropZone.ondragleave = () => dropZone.classList.remove("drag-over");
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleFile(file);
    };
  }

  if (zoomInBtn) zoomInBtn.onclick = () => updateZoom(-ZOOM_STEP);
  if (zoomOutBtn) zoomOutBtn.onclick = () => updateZoom(ZOOM_STEP);

  if (resetBtn) {
    resetBtn.onclick = () => {
      const camera = document.querySelector("[camera]");
      if (camera) {
        camera.setAttribute("rotation", "0 0 0");
        currentFov = DEFAULT_FOV;
        camera.setAttribute("camera", "fov", currentFov);
        if (camera.components && camera.components["look-controls"]) {
          camera.components["look-controls"].pitchObject.rotation.x = 0;
          camera.components["look-controls"].yawObject.rotation.y = 0;
        }
      }
      if (sky) sky.setAttribute("rotation", "0 -90 0");
    };
  }
}

function setupZoomHandler() {
  const scene = document.querySelector('a-scene');
  if (!scene) return;

  scene.addEventListener('wheel', (e) => {
    // Only zoom if we are not hovering over UI or if the scene is active
    if (e.target.closest('#drop-zone')) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? 2 : -2;
    updateZoom(delta);
  }, { passive: false });
}

//=============================
// File Handling
//=============================

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    
    if (sky) {
      sky.setAttribute("src", dataUrl);
      if (sky.components && sky.components.material) {
        sky.setAttribute("material", "src", dataUrl);
      }
    }
    
    if (dropZone) {
      dropZone.classList.add("hidden");
    }

    const scene = document.querySelector('a-scene');
    if (scene && scene.render) {
        scene.render();
    }
  };
  reader.readAsDataURL(file);
}

init();
