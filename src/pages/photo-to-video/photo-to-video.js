import { languageService } from "../../services/languageService";
import Sortable from "sortablejs";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

// ─── State ────────────────────────────────────────────────────────────────────

let photos = []; // { id, file, url, img, duration }
let nextId = 0;
let isEncoding = false;

// Playback state
const pb = {
  isPlaying: false,
  rafId: null,
  position: 0,       // elapsed seconds
  lastTs: null,      // last rAF timestamp (ms)
  canvasW: 0,
  canvasH: 0,
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const dropZone          = document.getElementById("dropZone");
const fileInput         = document.getElementById("fileInput");
const photoListSection  = document.getElementById("photoListSection");
const photoList         = document.getElementById("photoList");
const generateBtn       = document.getElementById("generateBtn");
const progressSection   = document.getElementById("progressSection");
const progressBar       = document.getElementById("progressBar");
const progressPct       = document.getElementById("progressPct");
const progressLabel     = document.getElementById("progressLabel");
const downloadLink      = document.getElementById("downloadLink");
const errorMsg          = document.getElementById("errorMsg");
const previewWrapper    = document.getElementById("previewWrapper");
const previewCanvas     = document.getElementById("previewCanvas");
const previewEmpty      = document.getElementById("previewEmpty");
const previewCtx        = previewCanvas.getContext("2d");
const previewControls   = document.getElementById("previewControls");
const photoCount        = document.getElementById("photoCount");
const previewPlayBtn    = document.getElementById("previewPlayBtn");
const previewRestartBtn = document.getElementById("previewRestartBtn");
const previewScrubber   = document.getElementById("previewScrubber");
const previewScrubFill  = document.getElementById("previewScrubFill");
const previewScrubThumb = document.getElementById("previewScrubThumb");
const previewPhotoInd   = document.getElementById("previewPhotoIndicator");
const previewTimeInd    = document.getElementById("previewTimeIndicator");

// Cover image
const thumbWrapper         = document.getElementById("thumbWrapper");
const thumbCanvas          = document.getElementById("thumbCanvas");
const thumbEmpty           = document.getElementById("thumbEmpty");
const thumbCtx             = thumbCanvas.getContext("2d");
const thumbOverlayEnabled  = document.getElementById("thumbOverlayEnabled");
const thumbOverlayOptions  = document.getElementById("thumbOverlayOptions");
const thumbDarkOpacity     = document.getElementById("thumbDarkOpacity");
const thumbDarkOpacityVal  = document.getElementById("thumbDarkOpacityVal");
const thumbVignette        = document.getElementById("thumbVignette");
const thumbVignetteVal     = document.getElementById("thumbVignetteVal");
const thumbBtnSize         = document.getElementById("thumbBtnSize");
const thumbBtnColor        = document.getElementById("thumbBtnColor");
const thumbBtnColorHex     = document.getElementById("thumbBtnColorHex");
const downloadThumbBtn     = document.getElementById("downloadThumbBtn");

const dimensionPreset  = document.getElementById("dimensionPreset");
const customDimensions = document.getElementById("customDimensions");
const customWidth      = document.getElementById("customWidth");
const customHeight     = document.getElementById("customHeight");
const fitMode          = document.getElementById("fitMode");
const bgColor          = document.getElementById("bgColor");
const bgColorHex       = document.getElementById("bgColorHex");
const globalDuration   = document.getElementById("globalDuration");
const applyGlobalDurationBtn = document.getElementById("applyGlobalDuration");
const fpsSelect        = document.getElementById("fps");
const transitionType        = document.getElementById("transitionType");
const transitionDurationRow = document.getElementById("transitionDurationRow");
const transitionDuration    = document.getElementById("transitionDuration");
const paddingEnabled   = document.getElementById("paddingEnabled");
const paddingOptions   = document.getElementById("paddingOptions");
const paddingSize      = document.getElementById("paddingSize");
const paddingSizeVal   = document.getElementById("paddingSizeVal");
const outputFilename   = document.getElementById("outputFilename");
const browserWarning   = document.getElementById("browserWarning");

// ─── Browser support check ────────────────────────────────────────────────────

if (typeof VideoEncoder === "undefined") {
  browserWarning.classList.remove("hidden");
}

// ─── i18n button titles ───────────────────────────────────────────────────────

function applyButtonTitles() {
  document.querySelectorAll("[data-title-key]").forEach((el) => {
    el.title = languageService.translate(el.dataset.titleKey);
  });
}
applyButtonTitles();

// ─── Settings helpers ─────────────────────────────────────────────────────────

function getOutputDimensions() {
  if (dimensionPreset.value === "auto") {
    const MAX = 2048;
    const src = photos.length > 0 ? photos[0].img : null;
    const srcW = src ? src.naturalWidth  : 1920;
    const srcH = src ? src.naturalHeight : 1080;
    const scale = MAX / Math.max(srcW, srcH);
    return {
      width:  Math.max(2, Math.floor(srcW * scale / 2) * 2),
      height: Math.max(2, Math.floor(srcH * scale / 2) * 2),
    };
  }
  if (dimensionPreset.value === "custom") {
    return {
      width:  Math.max(2, Math.floor(parseInt(customWidth.value)  / 2) * 2),
      height: Math.max(2, Math.floor(parseInt(customHeight.value) / 2) * 2),
    };
  }
  const [w, h] = dimensionPreset.value.split("x").map(Number);
  return { width: w, height: h };
}

function getBgColor()           { return bgColor.value; }
function getFps()               { return parseInt(fpsSelect.value); }
function getTransitionType()    { return transitionType.value; }
function getTransitionDuration(){ return Math.max(0.05, parseFloat(transitionDuration.value) || 0.5); }
function getPadding()           { return paddingEnabled.checked ? parseInt(paddingSize.value) / 100 : 0; }

function getTotalDuration() {
  return photos.reduce((sum, p) => sum + p.duration, 0);
}

// ─── Dimension preset toggle ──────────────────────────────────────────────────

let lastComputedDimensions = { width: 1920, height: 1080 };

dimensionPreset.addEventListener("change", () => {
  if (dimensionPreset.value === "custom") {
    customWidth.value  = lastComputedDimensions.width;
    customHeight.value = lastComputedDimensions.height;
    customDimensions.classList.remove("hidden");
    customDimensions.classList.add("flex");
  } else {
    customDimensions.classList.remove("flex");
    customDimensions.classList.add("hidden");
  }
  onSettingsChange();
});

[customWidth, customHeight].forEach((el) => el.addEventListener("input", onSettingsChange));
fitMode.addEventListener("change", onSettingsChange);

// ─── Transition type toggle ───────────────────────────────────────────────────

transitionType.addEventListener("change", () => {
  const hasTransition = transitionType.value !== "none";
  transitionDurationRow.classList.toggle("hidden",   !hasTransition);
  transitionDurationRow.style.display = hasTransition ? "flex" : "";
  if (!pb.isPlaying) redrawCurrentFrame();
});
transitionDuration.addEventListener("input", () => {
  if (!pb.isPlaying) redrawCurrentFrame();
});

// ─── Padding toggle ───────────────────────────────────────────────────────────

paddingEnabled.addEventListener("change", () => {
  const show = paddingEnabled.checked;
  paddingOptions.classList.toggle("hidden", !show);
  paddingOptions.style.display = show ? "flex" : "";
  if (!pb.isPlaying) redrawCurrentFrame();
  renderThumbPreview();
});

paddingSize.addEventListener("input", () => {
  paddingSizeVal.textContent = paddingSize.value + "%";
  if (!pb.isPlaying) redrawCurrentFrame();
  renderThumbPreview();
});

function onSettingsChange() {
  const { width, height } = getOutputDimensions();
  lastComputedDimensions = { width, height };
  const ar = height / width;
  previewWrapper.style.paddingBottom = (ar * 100).toFixed(4) + "%";
  thumbWrapper.style.paddingBottom   = (ar * 100).toFixed(4) + "%";
  if (!pb.isPlaying) redrawCurrentFrame();
  renderThumbPreview();
}

// ─── Background color sync ────────────────────────────────────────────────────

bgColor.addEventListener("input", () => {
  bgColorHex.value = bgColor.value;
  if (!pb.isPlaying) redrawCurrentFrame();
  renderThumbPreview();
});

bgColorHex.addEventListener("input", () => {
  const val = bgColorHex.value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    bgColor.value = val;
    if (!pb.isPlaying) redrawCurrentFrame();
    renderThumbPreview();
  }
});

// ─── Global duration apply ────────────────────────────────────────────────────

applyGlobalDurationBtn.addEventListener("click", () => {
  const dur = parseFloat(globalDuration.value) || 3;
  photos.forEach((p) => {
    p.duration = dur;
    const input = document.querySelector(`[data-photo-id="${p.id}"] .photo-duration`);
    if (input) input.value = dur;
  });
  updatePlaybackUI();
});

// ─── File upload ──────────────────────────────────────────────────────────────

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("border-blue-400", "bg-blue-50");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("border-blue-400", "bg-blue-50");
});
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("border-blue-400", "bg-blue-50");
  const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
  addPhotos(files);
});
fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files);
  addPhotos(files);
  fileInput.value = "";
});

// ─── Add photos ───────────────────────────────────────────────────────────────

async function addPhotos(files) {
  for (const file of files) {
    const photo = await loadPhoto(file);
    photos.push(photo);
    renderPhotoItem(photo);
  }
  if (photos.length > 0) {
    photoListSection.classList.remove("hidden");
    photoCount.textContent = photos.length;
    generateBtn.disabled = false;
    downloadLink.classList.add("hidden");
    downloadLink.classList.remove("flex");
    previewControls.classList.remove("hidden");
    previewEmpty.classList.add("hidden");
    thumbEmpty.classList.add("hidden");
    downloadThumbBtn.disabled = false;
    onSettingsChange();
    redrawCurrentFrame();
    renderThumbPreview();
    updatePlaybackUI();
  }
}

function loadPhoto(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({
      id: nextId++,
      file,
      url,
      img,
      duration: parseFloat(globalDuration.value) || 3,
    });
    img.src = url;
  });
}

// ─── Render photo list item ───────────────────────────────────────────────────

function renderPhotoItem(photo) {
  const li = document.createElement("li");
  li.className =
    "flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing select-none hover:bg-gray-100 transition-colors";
  li.dataset.photoId = photo.id;

  li.innerHTML = `
    <span class="text-gray-300 text-xl leading-none flex-shrink-0">⠿</span>
    <img src="${photo.url}" class="w-16 h-11 object-cover rounded-md flex-shrink-0 shadow-sm" />
    <div class="flex-1 min-w-0">
      <p class="text-sm text-gray-700 truncate font-medium" title="${escapeHtml(photo.file.name)}">${escapeHtml(photo.file.name)}</p>
      <p class="text-xs text-gray-400 mt-0.5">${photo.img.naturalWidth} × ${photo.img.naturalHeight}</p>
    </div>
    <div class="flex items-center gap-1 flex-shrink-0">
      <label class="text-xs text-gray-400"></label>
      <input
        type="number"
        class="photo-duration w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        value="${photo.duration}"
        min="0.1" max="300" step="0.1"
        title="seconds"
      />
      <span class="text-xs text-gray-400">s</span>
    </div>
    <button class="photo-remove w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 text-xl leading-none flex-shrink-0 transition-colors" title="Remove">×</button>
  `;

  li.querySelector("label").textContent = languageService.translate("photoToVideoDurationLabel");

  li.querySelector(".photo-duration").addEventListener("input", (e) => {
    photo.duration = parseFloat(e.target.value) || 1;
    updatePlaybackUI();
  });

  li.querySelector(".photo-remove").addEventListener("click", () => {
    stopPlayback();
    URL.revokeObjectURL(photo.url);
    photos = photos.filter((p) => p.id !== photo.id);
    li.remove();
    if (photos.length === 0) {
      photoListSection.classList.add("hidden");
      generateBtn.disabled = true;
      downloadThumbBtn.disabled = true;
      previewControls.classList.add("hidden");
      previewEmpty.classList.remove("hidden");
      thumbEmpty.classList.remove("hidden");
    } else {
      photoCount.textContent = photos.length;
      pb.position = Math.min(pb.position, getTotalDuration());
      redrawCurrentFrame();
      renderThumbPreview();
      updatePlaybackUI();
    }
  });

  photoList.appendChild(li);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─── Sortable ─────────────────────────────────────────────────────────────────

Sortable.create(photoList, {
  animation: 150,
  handle: "li",
  onEnd() {
    const order = Array.from(photoList.children).map((li) => parseInt(li.dataset.photoId));
    photos.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    if (dimensionPreset.value === "auto") onSettingsChange();
    else if (!pb.isPlaying) redrawCurrentFrame();
  },
});

// ─── Draw helpers ─────────────────────────────────────────────────────────────

function ensureCanvasDimensions() {
  const { width, height } = getOutputDimensions();
  if (previewCanvas.width !== width || previewCanvas.height !== height) {
    previewCanvas.width  = width;
    previewCanvas.height = height;
    pb.canvasW = width;
    pb.canvasH = height;
  }
}

function drawFrame(ctx, img, outW, outH, bg, fit, padding = 0) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, outW, outH);

  const padX = outW * padding;
  const padY = outH * padding;
  const areaW = outW - 2 * padX;
  const areaH = outH - 2 * padY;

  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  let sx = 0, sy = 0, sw = imgW, sh = imgH;
  let dx = padX, dy = padY, dw = areaW, dh = areaH;

  if (fit === "contain") {
    const scale = Math.min(areaW / imgW, areaH / imgH);
    dw = imgW * scale;
    dh = imgH * scale;
    dx = padX + (areaW - dw) / 2;
    dy = padY + (areaH - dh) / 2;
  } else if (fit === "cover") {
    const scale = Math.max(areaW / imgW, areaH / imgH);
    sx = Math.round((imgW - areaW / scale) / 2);
    sy = Math.round((imgH - areaH / scale) / 2);
    sw = Math.round(areaW / scale);
    sh = Math.round(areaH / scale);
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** Returns photo, index, and local time within that photo's slot. */
function photoAtPosition(pos) {
  let elapsed = 0;
  for (let i = 0; i < photos.length; i++) {
    const start = elapsed;
    elapsed += photos[i].duration;
    if (pos < elapsed || i === photos.length - 1) {
      return { photo: photos[i], index: i, localTime: pos - start };
    }
  }
  const last = photos[photos.length - 1];
  return { photo: last, index: photos.length - 1, localTime: last.duration };
}

// ─── Transition helpers ───────────────────────────────────────────────────────

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Draw a transition frame between imgA (outgoing) and imgB (incoming).
 * t: 0 = fully showing A, 1 = fully showing B.
 */
function drawTransitionFrame(ctx, imgA, imgB, t, outW, outH, bg, fit, type, padding = 0) {
  const te = easeInOut(t);

  if (type === "fade") {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, outW, outH);
    ctx.globalAlpha = 1 - te;
    drawFrame(ctx, imgA, outW, outH, bg, fit, padding);
    ctx.globalAlpha = te;
    drawFrame(ctx, imgB, outW, outH, bg, fit, padding);
    ctx.globalAlpha = 1;
    return;
  }

  // Slide transitions
  let dxA = 0, dyA = 0, dxB = 0, dyB = 0;
  if      (type === "slide-left")  { dxA = -outW * te; dxB =  outW * (1 - te); }
  else if (type === "slide-right") { dxA =  outW * te; dxB = -outW * (1 - te); }
  else if (type === "slide-up")    { dyA = -outH * te; dyB =  outH * (1 - te); }
  else if (type === "slide-down")  { dyA =  outH * te; dyB = -outH * (1 - te); }

  // Outgoing photo
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, outW, outH); ctx.clip();
  ctx.translate(dxA, dyA);
  drawFrame(ctx, imgA, outW, outH, bg, fit, padding);
  ctx.restore();

  // Incoming photo
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, outW, outH); ctx.clip();
  ctx.translate(dxB, dyB);
  drawFrame(ctx, imgB, outW, outH, bg, fit, padding);
  ctx.restore();
}

/**
 * Render the correct frame (with transition if applicable) at time `pos`
 * onto any canvas context.
 */
function renderFrame(ctx, pos, outW, outH, bg, fit, padding = 0) {
  if (photos.length === 0) return;
  const { photo, index, localTime } = photoAtPosition(pos);
  const type    = getTransitionType();
  const transDur = getTransitionDuration();

  if (type !== "none" && transDur > 0 && index < photos.length - 1) {
    const remaining = photo.duration - localTime;
    if (remaining < transDur && remaining >= 0) {
      const t = 1 - remaining / transDur;
      drawTransitionFrame(ctx, photo.img, photos[index + 1].img, t, outW, outH, bg, fit, type, padding);
      return;
    }
  }

  drawFrame(ctx, photo.img, outW, outH, bg, fit, padding);
}

function redrawCurrentFrame() {
  if (photos.length === 0) return;
  ensureCanvasDimensions();
  const { width, height } = getOutputDimensions();
  renderFrame(previewCtx, pb.position, width, height, getBgColor(), fitMode.value, getPadding());
}

// ─── Playback ─────────────────────────────────────────────────────────────────

previewPlayBtn.addEventListener("click", () => {
  if (pb.isPlaying) pausePlayback();
  else startPlayback();
});

previewRestartBtn.addEventListener("click", () => {
  stopPlayback();
  pb.position = 0;
  redrawCurrentFrame();
  updatePlaybackUI();
});

function startPlayback() {
  if (photos.length === 0) return;
  const total = getTotalDuration();
  if (pb.position >= total) pb.position = 0;

  pb.isPlaying = true;
  pb.lastTs = null;
  previewPlayBtn.textContent = "⏸";
  previewPlayBtn.dataset.titleKey = "photoToVideoPause";
  applyButtonTitles();
  pb.rafId = requestAnimationFrame(rafLoop);
}

function pausePlayback() {
  pb.isPlaying = false;
  if (pb.rafId) cancelAnimationFrame(pb.rafId);
  previewPlayBtn.textContent = "▶";
  previewPlayBtn.dataset.titleKey = "photoToVideoPlay";
  applyButtonTitles();
}

function stopPlayback() {
  pb.isPlaying = false;
  if (pb.rafId) cancelAnimationFrame(pb.rafId);
  previewPlayBtn.textContent = "▶";
  previewPlayBtn.dataset.titleKey = "photoToVideoPlay";
  applyButtonTitles();
}

function rafLoop(timestamp) {
  if (!pb.isPlaying) return;

  if (pb.lastTs !== null) {
    pb.position += (timestamp - pb.lastTs) / 1000;
  }
  pb.lastTs = timestamp;

  const total = getTotalDuration();
  if (pb.position >= total) {
    pb.position = total;
    stopPlayback();
    redrawCurrentFrame();
    updatePlaybackUI();
    return;
  }

  ensureCanvasDimensions();
  const { width, height } = getOutputDimensions();
  renderFrame(previewCtx, pb.position, width, height, getBgColor(), fitMode.value, getPadding());
  updatePlaybackUI();

  pb.rafId = requestAnimationFrame(rafLoop);
}

// ─── Scrubber ─────────────────────────────────────────────────────────────────

function scrubToFraction(fraction) {
  const total = getTotalDuration();
  pb.position = Math.max(0, Math.min(total, fraction * total));
  if (!pb.isPlaying) {
    redrawCurrentFrame();
  }
  updatePlaybackUI();
}

previewScrubber.addEventListener("mousedown", (e) => {
  seek(e);
  const onMove = (e) => seek(e);
  const onUp   = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
});

function seek(e) {
  const rect = previewScrubber.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  scrubToFraction(frac);
}

// ─── Playback UI update ───────────────────────────────────────────────────────

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updatePlaybackUI() {
  if (photos.length === 0) return;
  const total = getTotalDuration();
  const pos   = Math.min(pb.position, total);
  const frac  = total > 0 ? pos / total : 0;

  previewScrubFill.style.width        = (frac * 100).toFixed(2) + "%";
  previewScrubThumb.style.left        = (frac * 100).toFixed(2) + "%";
  previewTimeInd.textContent          = `${formatTime(pos)} / ${formatTime(total)}`;

  const { index } = photoAtPosition(pos < total ? pos : total - 0.001);
  previewPhotoInd.textContent = `${index + 1} / ${photos.length}`;
}

// ─── Cover image ──────────────────────────────────────────────────────────────

// Toggle overlay options visibility
thumbOverlayEnabled.addEventListener("change", () => {
  thumbOverlayOptions.style.display = thumbOverlayEnabled.checked ? "" : "none";
  renderThumbPreview();
});

// Sliders
thumbDarkOpacity.addEventListener("input", () => {
  thumbDarkOpacityVal.textContent = thumbDarkOpacity.value + "%";
  renderThumbPreview();
});
thumbVignette.addEventListener("input", () => {
  thumbVignetteVal.textContent = thumbVignette.value + "%";
  renderThumbPreview();
});

thumbBtnSize.addEventListener("change", renderThumbPreview);

// Button color sync
thumbBtnColor.addEventListener("input", () => {
  thumbBtnColorHex.value = thumbBtnColor.value;
  renderThumbPreview();
});
thumbBtnColorHex.addEventListener("input", () => {
  const val = thumbBtnColorHex.value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    thumbBtnColor.value = val;
    renderThumbPreview();
  }
});

downloadThumbBtn.addEventListener("click", downloadThumbnail);

/** Returns luminance 0–1 for a hex colour string. */
function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Draw the play-button overlay onto any canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w  canvas width
 * @param {number} h  canvas height
 */
function drawOverlay(ctx, w, h) {
  const darkPct   = parseInt(thumbDarkOpacity.value) / 100;
  const vignPct   = parseInt(thumbVignette.value)    / 100;
  const btnSizeKey = thumbBtnSize.value;            // "sm" | "md" | "lg"
  const btnHex    = thumbBtnColor.value;

  // 1 ─ Uniform dark overlay
  if (darkPct > 0) {
    ctx.fillStyle = `rgba(0,0,0,${darkPct})`;
    ctx.fillRect(0, 0, w, h);
  }

  // 2 ─ Vignette (radial gradient: transparent centre → dark edges)
  if (vignPct > 0) {
    const cx = w / 2, cy = h / 2;
    const radius = Math.sqrt(cx * cx + cy * cy);
    const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    vg.addColorStop(0,   "rgba(0,0,0,0)");
    vg.addColorStop(0.5, "rgba(0,0,0,0)");
    vg.addColorStop(1,   `rgba(0,0,0,${vignPct})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // 3 ─ Play button circle
  const radiusFrac = btnSizeKey === "sm" ? 0.07 : btnSizeKey === "lg" ? 0.135 : 0.10;
  const r  = Math.min(w, h) * radiusFrac;
  const cx = w / 2, cy = h / 2;

  // Drop shadow
  ctx.save();
  ctx.shadowColor   = "rgba(0,0,0,0.45)";
  ctx.shadowBlur    = r * 0.6;
  ctx.shadowOffsetY = r * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = btnHex;
  ctx.fill();
  ctx.restore();

  // Subtle inner rim for depth
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth   = r * 0.05;
  ctx.stroke();

  // 4 ─ Play triangle with rounded corners via arcTo
  const lum = luminance(btnHex);
  const triColor = lum > 0.35 ? "rgba(15,15,15,0.85)" : "rgba(255,255,255,0.92)";

  // Triangle vertices
  const ox  = r * 0.02;             // slight rightward optical nudge
  const th  = r * 0.38;             // half-height
  const tlx = cx - r * 0.27 + ox;  // left vertices x
  const rx  = cx + r * 0.48 + ox;  // right tip x
  const p0  = [tlx, cy - th];       // top-left
  const p1  = [tlx, cy + th];       // bottom-left
  const p2  = [rx,  cy];            // right tip

  const cr = r * 0.09; // corner radius for all three vertices

  ctx.beginPath();
  ctx.moveTo((p2[0] + p0[0]) / 2, (p2[1] + p0[1]) / 2);
  ctx.arcTo(p0[0], p0[1], p1[0], p1[1], cr);
  ctx.arcTo(p1[0], p1[1], p2[0], p2[1], cr);
  ctx.arcTo(p2[0], p2[1], p0[0], p0[1], cr);
  ctx.closePath();
  ctx.fillStyle = triColor;
  ctx.fill();
}

/** Render the thumbnail preview canvas (small, live). */
function renderThumbPreview() {
  if (photos.length === 0) return;

  const { width, height } = getOutputDimensions();
  thumbCanvas.width  = width;
  thumbCanvas.height = height;

  drawFrame(thumbCtx, photos[0].img, width, height, getBgColor(), fitMode.value, getPadding());

  if (thumbOverlayEnabled.checked) {
    drawOverlay(thumbCtx, width, height);
  }
}

/** Generate full-res PNG and trigger download. */
function downloadThumbnail() {
  if (photos.length === 0) return;

  const { width, height } = getOutputDimensions();
  const encW = Math.floor(width  / 2) * 2;
  const encH = Math.floor(height / 2) * 2;

  const offCanvas = document.createElement("canvas");
  offCanvas.width  = encW;
  offCanvas.height = encH;
  const offCtx = offCanvas.getContext("2d");

  drawFrame(offCtx, photos[0].img, encW, encH, getBgColor(), fitMode.value, getPadding());
  if (thumbOverlayEnabled.checked) drawOverlay(offCtx, encW, encH);

  offCanvas.toBlob((blob) => {
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = (outputFilename.value.trim() || "slideshow") + "-cover.jpg";
    a.click();
    URL.revokeObjectURL(url);
  }, "image/jpeg", 0.95);
}

// ─── Generate video ───────────────────────────────────────────────────────────

generateBtn.addEventListener("click", generateVideo);

async function generateVideo() {
  if (isEncoding || photos.length === 0) return;

  if (typeof VideoEncoder === "undefined") {
    showError(languageService.translate("photoToVideoNoWebCodecs"));
    return;
  }

  stopPlayback();
  isEncoding = true;
  generateBtn.disabled = true;
  downloadLink.classList.add("hidden");
  errorMsg.classList.add("hidden");
  progressSection.classList.remove("hidden");
  setProgress(0, languageService.translate("photoToVideoEncoding"));

  try {
    const { width, height } = getOutputDimensions();
    const fps     = getFps();
    const bg      = getBgColor();
    const fit     = fitMode.value;
    const padding = getPadding();

    const encW = Math.floor(width  / 2) * 2;
    const encH = Math.floor(height / 2) * 2;

    const target = new ArrayBufferTarget();
    const muxer  = new Muxer({
      target,
      video: { codec: "avc", width: encW, height: encH },
      fastStart: "in-memory",
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  (e) => { throw new Error(e.message); },
    });

    encoder.configure({
      codec:     "avc1.420028",
      width:     encW,
      height:    encH,
      bitrate:   Math.min(10_000_000, encW * encH * fps * 0.1),
      framerate: fps,
    });

    const offCanvas = new OffscreenCanvas(encW, encH);
    const offCtx    = offCanvas.getContext("2d");

    const frameDurUs  = Math.round(1_000_000 / fps);
    const totalFrames = photos.reduce((s, p) => s + Math.max(1, Math.round(p.duration * fps)), 0);
    let timestampUs   = 0;
    let encodedFrames = 0;

    let frameTimeSec = 0;
    for (const photo of photos) {
      const frameCount = Math.max(1, Math.round(photo.duration * fps));
      for (let i = 0; i < frameCount; i++) {
        renderFrame(offCtx, frameTimeSec, encW, encH, bg, fit, padding);
        const vf = new VideoFrame(offCanvas, { timestamp: timestampUs, duration: frameDurUs });
        encoder.encode(vf, { keyFrame: i === 0 });
        vf.close();
        timestampUs   += frameDurUs;
        frameTimeSec  += 1 / fps;
        encodedFrames++;
        if (encodedFrames % 15 === 0) {
          setProgress(Math.round((encodedFrames / totalFrames) * 90), languageService.translate("photoToVideoEncoding"));
          await yieldToMain();
        }
      }
    }

    setProgress(90, languageService.translate("photoToVideoFinalizing"));
    await encoder.flush();
    muxer.finalize();
    setProgress(100, languageService.translate("photoToVideoDone"));

    const blob     = new Blob([target.buffer], { type: "video/mp4" });
    const url      = URL.createObjectURL(blob);
    const filename = (outputFilename.value.trim() || "slideshow") + ".mp4";

    downloadLink.href     = url;
    downloadLink.download = filename;
    downloadLink.classList.remove("hidden");
    downloadLink.classList.add("flex");
    downloadLink.textContent = "⬇ " + languageService.translate("photoToVideoDownload");

  } catch (err) {
    console.error("Encoding error:", err);
    showError(err.message || languageService.translate("photoToVideoError"));
  } finally {
    isEncoding = false;
    generateBtn.disabled = false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setProgress(pct, label) {
  progressBar.style.width  = pct + "%";
  progressPct.textContent  = pct + "%";
  if (label) progressLabel.textContent = label;
}

function showError(msg) {
  progressSection.classList.add("hidden");
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}

function yieldToMain() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
