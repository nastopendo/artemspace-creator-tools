import { languageService } from "../../services/languageService";
import Sortable from "sortablejs";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { GIFEncoder, quantize } from "gifenc";

// ─── State ────────────────────────────────────────────────────────────────────

// Each item: photo → { id, type:'photo', file, url, img, duration, fitMode }
//            video → { id, type:'video', file, url, videoEl, duration, fps }
let photos = [];
let nextId = 0;
let isEncoding = false;

const isVideo = (item) => item.type === "video";
const isPhoto = (item) => item.type === "photo";

// Playback state
const pb = {
  isPlaying: false,
  rafId: null,
  position: 0, // elapsed seconds in the whole slideshow
  lastTs: null, // last rAF timestamp (ms)
  canvasW: 0,
  canvasH: 0,
  activeVideo: null, // currently playing video item
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const photoListSection = document.getElementById("photoListSection");
const photoList = document.getElementById("photoList");
const generateBtn = document.getElementById("generateBtn");
const progressSection = document.getElementById("progressSection");
const progressBar = document.getElementById("progressBar");
const progressPct = document.getElementById("progressPct");
const progressLabel = document.getElementById("progressLabel");
const downloadLink = document.getElementById("downloadLink");
const errorMsg = document.getElementById("errorMsg");
const previewWrapper = document.getElementById("previewWrapper");
const previewCanvas = document.getElementById("previewCanvas");
const previewEmpty = document.getElementById("previewEmpty");
const previewCtx = previewCanvas.getContext("2d");
const previewControls = document.getElementById("previewControls");
const photoCount = document.getElementById("photoCount");
const previewPlayBtn = document.getElementById("previewPlayBtn");
const previewRestartBtn = document.getElementById("previewRestartBtn");
const previewScrubber = document.getElementById("previewScrubber");
const previewScrubFill = document.getElementById("previewScrubFill");
const previewScrubThumb = document.getElementById("previewScrubThumb");
const previewPhotoInd = document.getElementById("previewPhotoIndicator");
const previewTimeInd = document.getElementById("previewTimeIndicator");

// Cover image
const thumbWrapper = document.getElementById("thumbWrapper");
const thumbCanvas = document.getElementById("thumbCanvas");
const thumbEmpty = document.getElementById("thumbEmpty");
const thumbCtx = thumbCanvas.getContext("2d");
const thumbOverlayEnabled = document.getElementById("thumbOverlayEnabled");
const thumbOverlayOptions = document.getElementById("thumbOverlayOptions");
const thumbDarkOpacity = document.getElementById("thumbDarkOpacity");
const thumbDarkOpacityVal = document.getElementById("thumbDarkOpacityVal");
const thumbVignette = document.getElementById("thumbVignette");
const thumbVignetteVal = document.getElementById("thumbVignetteVal");
const thumbBtnSize = document.getElementById("thumbBtnSize");
const thumbBtnColor = document.getElementById("thumbBtnColor");
const thumbBtnColorHex = document.getElementById("thumbBtnColorHex");
const downloadThumbBtn = document.getElementById("downloadThumbBtn");

const dimensionPreset = document.getElementById("dimensionPreset");
const customDimensions = document.getElementById("customDimensions");
const customWidth = document.getElementById("customWidth");
const customHeight = document.getElementById("customHeight");
const fitMode = document.getElementById("fitMode");
const applyGlobalFitModeBtn = document.getElementById("applyGlobalFitMode");
const bgColor = document.getElementById("bgColor");
const bgColorHex = document.getElementById("bgColorHex");
const globalDuration = document.getElementById("globalDuration");
const applyGlobalDurationBtn = document.getElementById("applyGlobalDuration");
const fpsSelect = document.getElementById("fps");
const fpsLockNote = document.getElementById("fpsLockNote");
const transitionType = document.getElementById("transitionType");
const transitionDurationRow = document.getElementById("transitionDurationRow");
const transitionDuration = document.getElementById("transitionDuration");
const paddingEnabled = document.getElementById("paddingEnabled");
const paddingOptions = document.getElementById("paddingOptions");
const paddingSize = document.getElementById("paddingSize");
const paddingSizeVal = document.getElementById("paddingSizeVal");
const outputFilename = document.getElementById("outputFilename");
const browserWarning = document.getElementById("browserWarning");
const endIndicatorEnabled = document.getElementById("endIndicatorEnabled");
const endIndicatorOptions = document.getElementById("endIndicatorOptions");
const endIndicatorType = document.getElementById("endIndicatorType");
const endIndicatorDuration = document.getElementById("endIndicatorDuration");

// GIF export
const gifFpsInput = document.getElementById("gifFps");
const gifMaxWidthInput = document.getElementById("gifMaxWidth");
const generateGifBtn = document.getElementById("generateGifBtn");
const gifProgressSection = document.getElementById("gifProgressSection");
const gifProgressBar = document.getElementById("gifProgressBar");
const gifProgressPct = document.getElementById("gifProgressPct");
const gifProgressLabel = document.getElementById("gifProgressLabel");
const gifPreviewWrapper = document.getElementById("gifPreviewWrapper");
const gifPreviewImg = document.getElementById("gifPreviewImg");
const gifPreviewInfo = document.getElementById("gifPreviewInfo");
const gifSizeInfo = document.getElementById("gifSizeInfo");
const gifSizeWarning = document.getElementById("gifSizeWarning");
const gifDownloadLink = document.getElementById("gifDownloadLink");
const gifErrorMsg = document.getElementById("gifErrorMsg");
let gifBlobUrl = null;
let isEncodingGif = false;

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
  const first = photos.length > 0 ? photos[0] : null;
  let srcW, srcH;
  if (!first) {
    srcW = 1920;
    srcH = 1080;
  } else if (isVideo(first)) {
    srcW = first.videoEl.videoWidth || 1920;
    srcH = first.videoEl.videoHeight || 1080;
  } else {
    srcW = first.img.naturalWidth;
    srcH = first.img.naturalHeight;
  }

  if (dimensionPreset.value === "original") {
    return {
      width: Math.max(2, Math.floor(srcW / 2) * 2),
      height: Math.max(2, Math.floor(srcH / 2) * 2),
    };
  }
  if (dimensionPreset.value === "auto") {
    const MAX = 2048;
    const scale = MAX / Math.max(srcW, srcH);
    return {
      width: Math.max(2, Math.floor((srcW * scale) / 2) * 2),
      height: Math.max(2, Math.floor((srcH * scale) / 2) * 2),
    };
  }
  if (dimensionPreset.value === "custom") {
    return {
      width: Math.max(2, Math.floor(parseInt(customWidth.value) / 2) * 2),
      height: Math.max(2, Math.floor(parseInt(customHeight.value) / 2) * 2),
    };
  }
  const [w, h] = dimensionPreset.value.split("x").map(Number);
  return { width: w, height: h };
}

function getBgColor() {
  return bgColor.value;
}
function getFps() {
  const videoItem = photos.find(isVideo);
  return videoItem ? videoItem.fps : parseInt(fpsSelect.value);
}
function getTransitionType() {
  return transitionType.value;
}
function getTransitionDuration() {
  return Math.max(0.05, parseFloat(transitionDuration.value) || 0.5);
}
function getPadding() {
  return paddingEnabled.checked ? parseInt(paddingSize.value) / 100 : 0;
}

function getEffectivePadding(item) {
  if (!isPhoto(item)) return 0;
  return item.padding !== null && item.padding !== undefined
    ? item.padding / 100
    : getPadding();
}

function getMediaDuration() {
  return photos.reduce((sum, p) => sum + p.duration, 0);
}

function getEndIndicator() {
  return {
    enabled: endIndicatorEnabled.checked,
    type: endIndicatorType.value,
    duration: Math.max(0.1, parseFloat(endIndicatorDuration.value) || 1.5),
  };
}

function getTotalDuration() {
  const ei = getEndIndicator();
  return getMediaDuration() + (ei.enabled ? ei.duration : 0);
}

/** Returns local time inside end-indicator zone, or -1 if pos is outside the zone. */
function getEndIndicatorLocalTime(pos) {
  const ei = getEndIndicator();
  if (!ei.enabled) return -1;
  const mediaDur = getMediaDuration();
  if (pos < mediaDur) return -1;
  return Math.min(pos - mediaDur, ei.duration);
}

// ─── FPS lock ─────────────────────────────────────────────────────────────────

function updateFpsLock() {
  const videoItem = photos.find(isVideo);
  if (videoItem) {
    fpsSelect.disabled = true;
    const msg = languageService
      .translate("photoToVideoFpsLocked")
      .replace("{fps}", videoItem.fps);
    fpsLockNote.textContent = msg;
    fpsLockNote.classList.remove("hidden");
  } else {
    fpsSelect.disabled = false;
    fpsLockNote.classList.add("hidden");
  }
}

// ─── Dimension preset toggle ──────────────────────────────────────────────────

let lastComputedDimensions = { width: 1920, height: 1080 };

dimensionPreset.addEventListener("change", () => {
  if (dimensionPreset.value === "custom") {
    customWidth.value = lastComputedDimensions.width;
    customHeight.value = lastComputedDimensions.height;
    customDimensions.classList.remove("hidden");
    customDimensions.classList.add("flex");
  } else {
    customDimensions.classList.remove("flex");
    customDimensions.classList.add("hidden");
  }
  onSettingsChange();
});

[customWidth, customHeight].forEach((el) =>
  el.addEventListener("input", onSettingsChange),
);
fitMode.addEventListener("change", onSettingsChange);

// ─── Transition type toggle ───────────────────────────────────────────────────

transitionType.addEventListener("change", () => {
  const hasTransition = transitionType.value !== "none";
  transitionDurationRow.classList.toggle("hidden", !hasTransition);
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

// ─── End indicator listeners ──────────────────────────────────────────────────

endIndicatorEnabled.addEventListener("change", () => {
  const show = endIndicatorEnabled.checked;
  endIndicatorOptions.classList.toggle("hidden", !show);
  pb.position = Math.min(pb.position, getTotalDuration());
  if (!pb.isPlaying) redrawCurrentFrame();
  updatePlaybackUI();
});

endIndicatorType.addEventListener("change", () => {
  if (!pb.isPlaying && getEndIndicatorLocalTime(pb.position) >= 0) {
    redrawCurrentFrame();
  }
});

endIndicatorDuration.addEventListener("input", () => {
  pb.position = Math.min(pb.position, getTotalDuration());
  if (!pb.isPlaying) redrawCurrentFrame();
  updatePlaybackUI();
});

function onSettingsChange() {
  const { width, height } = getOutputDimensions();
  lastComputedDimensions = { width, height };
  const ar = height / width;
  previewWrapper.style.paddingBottom = (ar * 100).toFixed(4) + "%";
  thumbWrapper.style.paddingBottom = (ar * 100).toFixed(4) + "%";
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
    if (isVideo(p)) return; // video duration is fixed
    p.duration = dur;
    const input = document.querySelector(
      `[data-photo-id="${p.id}"] .photo-duration`,
    );
    if (input) input.value = dur;
  });
  updatePlaybackUI();
});

// ─── Global fit mode apply ────────────────────────────────────────────────────

applyGlobalFitModeBtn.addEventListener("click", () => {
  const fit = fitMode.value;
  photos.forEach((p) => {
    if (isVideo(p)) return; // fit mode doesn't apply to video
    p.fitMode = fit;
    const sel = document.querySelector(`[data-photo-id="${p.id}"] .photo-fit`);
    if (sel) sel.value = fit;
  });
  if (!pb.isPlaying) redrawCurrentFrame();
  renderThumbPreview();
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
  const files = Array.from(e.dataTransfer.files).filter(
    (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
  );
  addMedia(files);
});
fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files);
  addMedia(files);
  fileInput.value = "";
});

// ─── Add media ────────────────────────────────────────────────────────────────

async function addMedia(files) {
  for (const file of files) {
    let item;
    if (file.type.startsWith("video/")) {
      item = await loadVideoMedia(file);
    } else if (file.type.startsWith("image/")) {
      item = await loadPhoto(file);
    } else {
      continue;
    }
    photos.push(item);
    renderMediaItem(item);
  }
  if (photos.length > 0) {
    photoListSection.classList.remove("hidden");
    photoCount.textContent = photos.length;
    generateBtn.disabled = false;
    generateGifBtn.disabled = false;
    downloadLink.classList.add("hidden");
    downloadLink.classList.remove("flex");
    previewControls.classList.remove("hidden");
    previewEmpty.classList.add("hidden");
    thumbEmpty.classList.add("hidden");
    downloadThumbBtn.disabled = false;
    updateFpsLock();
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
    img.onload = () =>
      resolve({
        id: nextId++,
        type: "photo",
        file,
        url,
        img,
        duration: parseFloat(globalDuration.value) || 3,
        fitMode: fitMode.value,
        padding: null, // null = use global; number 0-25 = custom %
      });
    img.src = url;
  });
}

function loadVideoMedia(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement("video");
    videoEl.preload = "auto";
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.src = url;

    videoEl.onloadedmetadata = async () => {
      const fps = await detectVideoFps(videoEl);
      resolve({
        id: nextId++,
        type: "video",
        file,
        url,
        videoEl,
        duration: videoEl.duration,
        fps,
      });
    };
  });
}

async function detectVideoFps(videoEl) {
  try {
    if (typeof videoEl.captureStream === "function") {
      const stream = videoEl.captureStream(0);
      await new Promise((r) => setTimeout(r, 80));
      const track = stream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        stream.getTracks().forEach((t) => t.stop());
        if (settings.frameRate && settings.frameRate > 1) {
          const fps = Math.round(settings.frameRate);
          // Map 29/23 to common standards
          if (fps === 29) return 30;
          if (fps === 23) return 24;
          return fps;
        }
      }
    }
  } catch (_) {}
  return 30;
}

// ─── Render media list items ──────────────────────────────────────────────────

function renderMediaItem(item) {
  if (isVideo(item)) {
    renderVideoItem(item);
  } else {
    renderPhotoItem(item);
  }
}

function renderPhotoItem(photo) {
  const li = document.createElement("li");
  li.className =
    "flex flex-col p-2.5 bg-gray-50 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing select-none hover:bg-gray-100 transition-colors";
  li.dataset.photoId = photo.id;

  const fitOptions = ["contain", "cover", "stretch"]
    .map(
      (v) =>
        `<option value="${v}"${photo.fitMode === v ? " selected" : ""}>${languageService.translate("photoToVideoFit_" + v)}</option>`,
    )
    .join("");

  const hasCustomPadding = photo.padding !== null;
  const paddingSliderVal = photo.padding !== null ? photo.padding : 5;

  li.innerHTML = `
    <div class="flex items-center gap-3">
      <span class="text-gray-300 text-xl leading-none flex-shrink-0">⠿</span>
      <img src="${photo.url}" class="w-16 h-11 object-cover rounded-md flex-shrink-0 shadow-sm" />
      <div class="flex-1 min-w-0">
        <p class="text-sm text-gray-700 truncate font-medium" title="${escapeHtml(photo.file.name)}">${escapeHtml(photo.file.name)}</p>
        <p class="text-xs text-gray-400 mt-0.5">${photo.img.naturalWidth} × ${photo.img.naturalHeight}</p>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        <label class="text-xs text-gray-400 flex-shrink-0"></label>
        <input
          type="number"
          class="photo-duration w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          value="${photo.duration}"
          min="0.1" max="300" step="0.1"
          title="seconds"
        />
        <span class="text-xs text-gray-400">s</span>
        <select class="photo-fit border border-gray-200 rounded-lg px-1.5 py-1 text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">${fitOptions}</select>
        <button class="photo-margin-toggle w-6 h-6 flex items-center justify-center rounded text-xs flex-shrink-0 transition-colors font-semibold ${hasCustomPadding ? "border border-blue-400 text-blue-600 bg-blue-50" : "border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500"}" title="${languageService.translate("photoToVideoItemMargin")}">M</button>
      </div>
      <button class="photo-remove w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 text-xl leading-none flex-shrink-0 transition-colors" title="Remove">×</button>
    </div>
    <div class="photo-margin-row ${hasCustomPadding ? "flex" : "hidden"} items-center gap-2 mt-2 pl-[76px]">
      <span class="text-xs text-gray-400 flex-shrink-0">${languageService.translate("photoToVideoItemMargin")}</span>
      <input type="range" class="photo-padding-range flex-1 accent-blue-600 h-1.5" min="0" max="25" value="${paddingSliderVal}" />
      <span class="photo-padding-val text-xs text-gray-500 w-8 text-right tabular-nums">${paddingSliderVal}%</span>
      <button class="photo-padding-reset text-xs text-gray-400 hover:text-gray-600 px-1 rounded leading-none" title="Reset to global">↺</button>
    </div>
  `;

  li.querySelector("label").textContent = languageService.translate(
    "photoToVideoDurationLabel",
  );

  li.querySelector(".photo-duration").addEventListener("input", (e) => {
    photo.duration = parseFloat(e.target.value) || 1;
    updatePlaybackUI();
  });

  li.querySelector(".photo-fit").addEventListener("change", (e) => {
    photo.fitMode = e.target.value;
    if (!pb.isPlaying) redrawCurrentFrame();
    renderThumbPreview();
  });

  const marginToggle = li.querySelector(".photo-margin-toggle");
  const marginRow = li.querySelector(".photo-margin-row");
  const paddingRange = li.querySelector(".photo-padding-range");
  const paddingValEl = li.querySelector(".photo-padding-val");
  const paddingReset = li.querySelector(".photo-padding-reset");

  function setMarginActive(active) {
    marginRow.classList.toggle("hidden", !active);
    marginRow.classList.toggle("flex", active);
    marginToggle.classList.toggle("border-blue-400", active);
    marginToggle.classList.toggle("text-blue-600", active);
    marginToggle.classList.toggle("bg-blue-50", active);
    marginToggle.classList.toggle("border-dashed", !active);
    marginToggle.classList.toggle("border-gray-300", !active);
    marginToggle.classList.toggle("text-gray-400", !active);
  }

  marginToggle.addEventListener("click", () => {
    const isHidden = marginRow.classList.contains("hidden");
    if (isHidden) {
      photo.padding = parseInt(paddingRange.value);
      setMarginActive(true);
    } else {
      photo.padding = null;
      setMarginActive(false);
    }
    if (!pb.isPlaying) redrawCurrentFrame();
    renderThumbPreview();
  });

  paddingRange.addEventListener("input", () => {
    photo.padding = parseInt(paddingRange.value);
    paddingValEl.textContent = paddingRange.value + "%";
    if (!pb.isPlaying) redrawCurrentFrame();
    renderThumbPreview();
  });

  paddingReset.addEventListener("click", () => {
    photo.padding = null;
    setMarginActive(false);
    if (!pb.isPlaying) redrawCurrentFrame();
    renderThumbPreview();
  });

  li.querySelector(".photo-remove").addEventListener("click", () =>
    removeMediaItem(photo, li),
  );

  photoList.appendChild(li);
}

function renderVideoItem(item) {
  const li = document.createElement("li");
  li.className =
    "flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing select-none hover:bg-gray-100 transition-colors";
  li.dataset.photoId = item.id;

  // Thumbnail canvas
  const thumbCv = document.createElement("canvas");
  thumbCv.width = 64;
  thumbCv.height = 44;
  thumbCv.className = "rounded-md flex-shrink-0 shadow-sm";
  thumbCv.style.width = "64px";
  thumbCv.style.height = "44px";
  const tCtx = thumbCv.getContext("2d");
  tCtx.fillStyle = "#1f2937";
  tCtx.fillRect(0, 0, 64, 44);
  tCtx.fillStyle = "#6b7280";
  tCtx.font = "18px sans-serif";
  tCtx.textAlign = "center";
  tCtx.textBaseline = "middle";
  tCtx.fillText("▶", 32, 22);

  const drawThumb = () => {
    const vw = item.videoEl.videoWidth;
    const vh = item.videoEl.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.min(64 / vw, 44 / vh);
    const dw = vw * scale,
      dh = vh * scale;
    tCtx.fillStyle = "#1f2937";
    tCtx.fillRect(0, 0, 64, 44);
    tCtx.drawImage(
      item.videoEl,
      0,
      0,
      vw,
      vh,
      (64 - dw) / 2,
      (44 - dh) / 2,
      dw,
      dh,
    );
  };

  if (item.videoEl.readyState >= 2) {
    drawThumb();
  } else {
    item.videoEl.addEventListener("loadeddata", drawThumb, { once: true });
    if (item.videoEl.currentTime === 0) item.videoEl.currentTime = 0.001;
  }

  // Info section
  const info = document.createElement("div");
  info.className = "flex-1 min-w-0";
  info.innerHTML = `
    <div class="flex items-center gap-1.5 mb-0.5">
      <span class="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded leading-none">VIDEO</span>
      <p class="text-sm text-gray-700 truncate font-medium" title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</p>
    </div>
    <p class="text-xs text-gray-400">${item.videoEl.videoWidth} × ${item.videoEl.videoHeight} · ${formatTime(item.duration)} · ${item.fps} fps</p>
  `;

  const removeBtn = document.createElement("button");
  removeBtn.className =
    "photo-remove w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 text-xl leading-none flex-shrink-0 transition-colors";
  removeBtn.title = "Remove";
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => removeMediaItem(item, li));

  const drag = document.createElement("span");
  drag.className = "text-gray-300 text-xl leading-none flex-shrink-0";
  drag.textContent = "⠿";

  li.appendChild(drag);
  li.appendChild(thumbCv);
  li.appendChild(info);
  li.appendChild(removeBtn);

  photoList.appendChild(li);
}

function removeMediaItem(item, li) {
  stopPlayback();
  if (isVideo(item)) {
    item.videoEl.pause();
    item.videoEl.src = "";
  }
  URL.revokeObjectURL(item.url);
  photos = photos.filter((p) => p.id !== item.id);
  li.remove();
  updateFpsLock();
  if (photos.length === 0) {
    photoListSection.classList.add("hidden");
    generateBtn.disabled = true;
    generateGifBtn.disabled = true;
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
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Sortable ─────────────────────────────────────────────────────────────────

Sortable.create(photoList, {
  animation: 150,
  handle: "li",
  onEnd() {
    const order = Array.from(photoList.children).map((li) =>
      parseInt(li.dataset.photoId),
    );
    photos.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    onSettingsChange();
  },
});

// ─── Draw helpers ─────────────────────────────────────────────────────────────

function ensureCanvasDimensions() {
  const { width, height } = getOutputDimensions();
  if (previewCanvas.width !== width || previewCanvas.height !== height) {
    previewCanvas.width = width;
    previewCanvas.height = height;
    pb.canvasW = width;
    pb.canvasH = height;
  }
}

function drawFrame(ctx, img, outW, outH, bg, fit, padding = 0, zoom = 0) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, outW, outH);

  const padX = outW * padding;
  const padY = outH * padding;
  const areaW = outW - 2 * padX;
  const areaH = outH - 2 * padY;

  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  let sx = 0,
    sy = 0,
    sw = imgW,
    sh = imgH;
  let dx = padX,
    dy = padY,
    dw = areaW,
    dh = areaH;

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

  if (zoom > 0) {
    ctx.save();
    const s = 1 + zoom;
    ctx.translate(outW / 2, outH / 2);
    ctx.scale(s, s);
    ctx.translate(-outW / 2, -outH / 2);
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }
}

function drawVideoToCanvas(ctx, videoEl, outW, outH, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, outW, outH);
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return;
  const scale = Math.min(outW / vw, outH / vh);
  const dw = vw * scale,
    dh = vh * scale;
  const dx = (outW - dw) / 2,
    dy = (outH - dh) / 2;
  ctx.drawImage(videoEl, 0, 0, vw, vh, dx, dy, dw, dh);
}

// ─── Media at position ────────────────────────────────────────────────────────

/** Returns the item, its index, local time within it, and segment start time. */
function mediaAtPosition(pos) {
  let elapsed = 0;
  for (let i = 0; i < photos.length; i++) {
    const start = elapsed;
    elapsed += photos[i].duration;
    if (pos < elapsed || i === photos.length - 1) {
      return {
        media: photos[i],
        index: i,
        localTime: pos - start,
        segmentStart: start,
      };
    }
  }
  const last = photos[photos.length - 1];
  const start = getTotalDuration() - last.duration;
  return {
    media: last,
    index: photos.length - 1,
    localTime: last.duration,
    segmentStart: start,
  };
}

// ─── Transition helpers ───────────────────────────────────────────────────────

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function drawTransitionFrame(
  ctx,
  imgA,
  imgB,
  t,
  outW,
  outH,
  bg,
  fitA,
  fitB,
  type,
  paddingA = 0,
  paddingB = 0,
  zoomA = 0,
  zoomB = 0,
) {
  const te = easeInOut(t);

  if (type === "fade" || type === "zoom-fade") {
    drawFrame(ctx, imgA, outW, outH, bg, fitA, paddingA, zoomA);
    ctx.globalAlpha = te;
    drawFrame(ctx, imgB, outW, outH, bg, fitB, paddingB, zoomB);
    ctx.globalAlpha = 1;
    return;
  }

  let dxA = 0,
    dyA = 0,
    dxB = 0,
    dyB = 0;
  if (type === "slide-left") {
    dxA = -outW * te;
    dxB = outW * (1 - te);
  } else if (type === "slide-right") {
    dxA = outW * te;
    dxB = -outW * (1 - te);
  } else if (type === "slide-up") {
    dyA = -outH * te;
    dyB = outH * (1 - te);
  } else if (type === "slide-down") {
    dyA = outH * te;
    dyB = -outH * (1 - te);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, outW, outH);
  ctx.clip();
  ctx.translate(dxA, dyA);
  drawFrame(ctx, imgA, outW, outH, bg, fitA, paddingA);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, outW, outH);
  ctx.clip();
  ctx.translate(dxB, dyB);
  drawFrame(ctx, imgB, outW, outH, bg, fitB, paddingB);
  ctx.restore();
}

const ZOOM_FADE_SCALE = 0.05;

function renderFrame(ctx, pos, outW, outH, bg) {
  if (photos.length === 0) return;

  const eiLocalTime = getEndIndicatorLocalTime(pos);
  if (eiLocalTime >= 0) {
    renderEndIndicatorFrame(ctx, eiLocalTime, outW, outH, bg);
    return;
  }

  const { media, index, localTime } = mediaAtPosition(pos);

  // Video items: draw directly, no transitions or fit options
  if (isVideo(media)) {
    drawVideoToCanvas(ctx, media.videoEl, outW, outH, bg);
    return;
  }

  const type = getTransitionType();
  const transDur = getTransitionDuration();
  const fitA = media.fitMode;
  const paddingA = getEffectivePadding(media);

  const prevIsPhoto = index > 0 && isPhoto(photos[index - 1]);
  const zoomOffset = type === "zoom-fade" && prevIsPhoto ? transDur : 0;
  const currentZoom =
    type === "zoom-fade"
      ? Math.min(1, (localTime + zoomOffset) / media.duration) * ZOOM_FADE_SCALE
      : 0;

  // Transitions only between two photo items
  if (type !== "none" && transDur > 0 && index < photos.length - 1) {
    const next = photos[index + 1];
    const remaining = media.duration - localTime;
    if (remaining < transDur && remaining >= 0 && isPhoto(next)) {
      const t = 1 - remaining / transDur;
      const zoomB =
        type === "zoom-fade"
          ? t * (transDur / next.duration) * ZOOM_FADE_SCALE
          : 0;
      const paddingB = getEffectivePadding(next);
      drawTransitionFrame(
        ctx,
        media.img,
        next.img,
        t,
        outW,
        outH,
        bg,
        fitA,
        next.fitMode,
        type,
        paddingA,
        paddingB,
        currentZoom,
        zoomB,
      );
      return;
    }
  }

  drawFrame(ctx, media.img, outW, outH, bg, fitA, paddingA, currentZoom);
}

// ─── End indicator rendering ──────────────────────────────────────────────────

function renderEndIndicatorFrame(ctx, localTime, outW, outH, bg) {
  if (photos.length === 0) return;
  const ei = getEndIndicator();
  const lastIdx = photos.length - 1;
  const last = photos[lastIdx];

  // Draw last media at its final state
  if (isVideo(last)) {
    drawVideoToCanvas(ctx, last.videoEl, outW, outH, bg);
  } else {
    const type = getTransitionType();
    const lastZoom = type === "zoom-fade" ? ZOOM_FADE_SCALE : 0;
    drawFrame(
      ctx,
      last.img,
      outW,
      outH,
      bg,
      last.fitMode,
      getEffectivePadding(last),
      lastZoom,
    );
  }

  // Fade-in (0 → 1) over the first ~35% of the end-indicator duration
  const fadeInDur = Math.min(0.45, ei.duration * 0.35);
  const fade = fadeInDur > 0 ? Math.min(1, localTime / fadeInDur) : 1;

  // Dark veil — reaches ~58% max
  if (fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${0.58 * fade})`;
    ctx.fillRect(0, 0, outW, outH);
  }

  // Centered icon
  const iconBase = Math.min(outW, outH) * 0.15;
  const scale = 0.7 + 0.3 * fade; // subtle scale-in with fade
  const size = iconBase * scale;
  const cx = outW / 2;
  const cy = outH / 2;
  const color = "rgba(255,255,255,0.96)";

  ctx.save();
  ctx.globalAlpha = fade;
  if (ei.type === "loop") {
    drawLoopIcon(ctx, cx, cy, size, color);
  } else {
    drawEndIcon(ctx, cx, cy, size, color);
  }
  ctx.restore();
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawEndIcon(ctx, cx, cy, size, color) {
  const half = size * 0.42;
  const r = size * 0.14;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = size * 0.28;
  ctx.fillStyle = color;
  roundedRectPath(ctx, cx - half, cy - half, half * 2, half * 2, r);
  ctx.fill();
  ctx.restore();
}

function drawLoopIcon(ctx, cx, cy, size, color) {
  const radius = size * 0.4;
  const lineWidth = size * 0.13;
  // Arc sweeping clockwise (canvas angles increase clockwise), leaving a gap
  const startAng = Math.PI * 0.18; // ~32° below right-horizontal
  const sweep = Math.PI * 1.63; // ~293°
  const endAng = startAng + sweep;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = size * 0.22;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAng, endAng);
  ctx.stroke();

  // Arrow head at the end of the arc, pointing in the motion direction
  const tipX = cx + Math.cos(endAng) * radius;
  const tipY = cy + Math.sin(endAng) * radius;
  const tanX = -Math.sin(endAng); // tangent (clockwise motion dir)
  const tanY = Math.cos(endAng);
  const radX = Math.cos(endAng); // radial outward
  const radY = Math.sin(endAng);

  const aLen = lineWidth * 2.1;
  const aWid = lineWidth * 1.35;

  const pTipX = tipX + tanX * aLen * 0.6;
  const pTipY = tipY + tanY * aLen * 0.6;
  const baseX = tipX - tanX * aLen * 0.4;
  const baseY = tipY - tanY * aLen * 0.4;
  const pB1X = baseX + radX * aWid;
  const pB1Y = baseY + radY * aWid;
  const pB2X = baseX - radX * aWid;
  const pB2Y = baseY - radY * aWid;

  ctx.beginPath();
  ctx.moveTo(pTipX, pTipY);
  ctx.lineTo(pB1X, pB1Y);
  ctx.lineTo(pB2X, pB2Y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function redrawCurrentFrame() {
  if (photos.length === 0) return;
  ensureCanvasDimensions();
  const { width, height } = getOutputDimensions();

  // End-indicator zone: seek last video to its final frame before drawing.
  const eiLocalTime = getEndIndicatorLocalTime(pb.position);
  if (eiLocalTime >= 0) {
    const last = photos[photos.length - 1];
    if (isVideo(last)) {
      const targetTime = Math.max(0, last.duration - 0.05);
      const draw = () =>
        renderFrame(previewCtx, pb.position, width, height, getBgColor());
      if (
        Math.abs(last.videoEl.currentTime - targetTime) < 0.08 &&
        last.videoEl.readyState >= 2
      ) {
        draw();
      } else {
        const onSeeked = () => {
          last.videoEl.removeEventListener("seeked", onSeeked);
          draw();
        };
        last.videoEl.addEventListener("seeked", onSeeked);
        last.videoEl.currentTime = targetTime;
      }
    } else {
      renderFrame(previewCtx, pb.position, width, height, getBgColor());
    }
    return;
  }

  const { media, localTime } = mediaAtPosition(pb.position);

  if (isVideo(media)) {
    const targetTime = Math.max(0, Math.min(localTime, media.duration - 0.001));
    const draw = () =>
      renderFrame(previewCtx, pb.position, width, height, getBgColor());

    if (
      Math.abs(media.videoEl.currentTime - targetTime) < 0.05 &&
      media.videoEl.readyState >= 2
    ) {
      draw();
    } else {
      const onSeeked = () => {
        media.videoEl.removeEventListener("seeked", onSeeked);
        draw();
      };
      media.videoEl.addEventListener("seeked", onSeeked);
      media.videoEl.currentTime = targetTime;
    }
  } else {
    renderFrame(previewCtx, pb.position, width, height, getBgColor());
  }
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
  if (pb.position >= total) {
    pb.position = 0;
    if (pb.activeVideo) {
      pb.activeVideo.videoEl.pause();
      pb.activeVideo = null;
    }
  }

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
  if (pb.activeVideo) {
    pb.activeVideo.videoEl.pause();
    pb.activeVideo.videoEl.muted = true;
  }
  previewPlayBtn.textContent = "▶";
  previewPlayBtn.dataset.titleKey = "photoToVideoPlay";
  applyButtonTitles();
}

function stopPlayback() {
  pb.isPlaying = false;
  if (pb.rafId) cancelAnimationFrame(pb.rafId);
  if (pb.activeVideo) {
    pb.activeVideo.videoEl.pause();
    pb.activeVideo.videoEl.muted = true;
    pb.activeVideo = null;
  }
  pb.lastTs = null;
  previewPlayBtn.textContent = "▶";
  previewPlayBtn.dataset.titleKey = "photoToVideoPlay";
  applyButtonTitles();
}

function rafLoop(timestamp) {
  if (!pb.isPlaying) return;

  const total = getTotalDuration();
  const mediaDur = getMediaDuration();

  // End-indicator zone: advance via time delta, pause any active video.
  if (pb.position >= mediaDur && getEndIndicator().enabled) {
    if (pb.activeVideo && !pb.activeVideo.videoEl.paused) {
      pb.activeVideo.videoEl.pause();
      pb.lastTs = null;
    }
    if (pb.lastTs !== null) {
      pb.position += (timestamp - pb.lastTs) / 1000;
    }
    pb.lastTs = timestamp;

    if (pb.position >= total) {
      pb.position = total;
      stopPlayback();
      redrawCurrentFrame();
      updatePlaybackUI();
      return;
    }

    ensureCanvasDimensions();
    const { width, height } = getOutputDimensions();
    renderFrame(previewCtx, pb.position, width, height, getBgColor());
    updatePlaybackUI();
    pb.rafId = requestAnimationFrame(rafLoop);
    return;
  }

  const info = mediaAtPosition(pb.position);
  const { media, segmentStart, localTime } = info;

  if (isVideo(media)) {
    if (pb.activeVideo !== media) {
      // Switching to a new (or first) video
      if (pb.activeVideo && pb.activeVideo !== media)
        pb.activeVideo.videoEl.pause();
      pb.activeVideo = media;
      pb.lastTs = null;
      media.videoEl.muted = false;
      const seekTo = Math.max(0, Math.min(localTime, media.duration - 0.001));
      if (Math.abs(media.videoEl.currentTime - seekTo) > 0.1) {
        media.videoEl.currentTime = seekTo;
      }
      media.videoEl.play().catch(() => {});
    }
    pb.position = segmentStart + media.videoEl.currentTime;
  } else {
    // Photo item
    if (pb.activeVideo) {
      pb.activeVideo.videoEl.pause();
      pb.activeVideo = null;
      pb.lastTs = null; // reset to avoid time jump on first photo frame
    }
    if (pb.lastTs !== null) {
      pb.position += (timestamp - pb.lastTs) / 1000;
    }
  }

  pb.lastTs = timestamp;

  if (pb.position >= total) {
    pb.position = total;
    stopPlayback();
    redrawCurrentFrame();
    updatePlaybackUI();
    return;
  }

  ensureCanvasDimensions();
  const { width, height } = getOutputDimensions();
  renderFrame(previewCtx, pb.position, width, height, getBgColor());
  updatePlaybackUI();

  pb.rafId = requestAnimationFrame(rafLoop);
}

// ─── Scrubber ─────────────────────────────────────────────────────────────────

// Tracks an active drag so the rAF loop can skip while the user is seeking, and
// so we can resume playback on release if it was playing when the drag started.
const scrubState = {
  active: false,
  wasPlaying: false,
};

function scrubToFraction(fraction) {
  const total = getTotalDuration();
  pb.position = Math.max(0, Math.min(total, fraction * total));
  pb.lastTs = null;

  // Scrubbing always pauses any active video for instant visual feedback. When
  // the drag ends, startPlayback() will re-seek and resume from pb.position.
  if (pb.activeVideo) {
    pb.activeVideo.videoEl.pause();
    pb.activeVideo.videoEl.muted = true;
    pb.activeVideo = null;
  }

  redrawCurrentFrame();
  updatePlaybackUI();
}

function getScrubClientX(e) {
  if (e.touches && e.touches.length) return e.touches[0].clientX;
  if (e.changedTouches && e.changedTouches.length)
    return e.changedTouches[0].clientX;
  return e.clientX;
}

function seekFromEvent(e) {
  const rect = previewScrubber.getBoundingClientRect();
  const frac = Math.max(
    0,
    Math.min(1, (getScrubClientX(e) - rect.left) / rect.width),
  );
  scrubToFraction(frac);
}

function onScrubMove(e) {
  if (!scrubState.active) return;
  if (e.cancelable) e.preventDefault();
  seekFromEvent(e);
}

function onScrubEnd() {
  if (!scrubState.active) return;
  scrubState.active = false;

  window.removeEventListener("mousemove", onScrubMove);
  window.removeEventListener("mouseup", onScrubEnd);
  window.removeEventListener("touchmove", onScrubMove);
  window.removeEventListener("touchend", onScrubEnd);
  window.removeEventListener("touchcancel", onScrubEnd);

  previewScrubber.classList.remove("scrubbing");
  previewScrubThumb.classList.remove("opacity-100");

  // If the user was playing before grabbing the scrubber, resume from the new
  // position. startPlayback() handles end-of-timeline reset.
  if (scrubState.wasPlaying) {
    scrubState.wasPlaying = false;
    startPlayback();
  }
}

function onScrubStart(e) {
  if (photos.length === 0) return;
  if (e.cancelable) e.preventDefault();

  scrubState.active = true;
  scrubState.wasPlaying = pb.isPlaying;
  if (pb.isPlaying) pausePlayback();

  // Keep the thumb visible while dragging, even if the cursor leaves the track.
  previewScrubber.classList.add("scrubbing");
  previewScrubThumb.classList.add("opacity-100");

  seekFromEvent(e);

  if (e.type === "touchstart") {
    window.addEventListener("touchmove", onScrubMove, { passive: false });
    window.addEventListener("touchend", onScrubEnd);
    window.addEventListener("touchcancel", onScrubEnd);
  } else {
    window.addEventListener("mousemove", onScrubMove);
    window.addEventListener("mouseup", onScrubEnd);
  }
}

previewScrubber.addEventListener("mousedown", onScrubStart);
previewScrubber.addEventListener("touchstart", onScrubStart, {
  passive: false,
});

// ─── Playback UI update ───────────────────────────────────────────────────────

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function updatePlaybackUI() {
  if (photos.length === 0) return;
  const total = getTotalDuration();
  const pos = Math.min(pb.position, total);
  const frac = total > 0 ? pos / total : 0;

  previewScrubFill.style.width = (frac * 100).toFixed(2) + "%";
  previewScrubThumb.style.left = (frac * 100).toFixed(2) + "%";
  previewTimeInd.textContent = `${formatTime(pos)} / ${formatTime(total)}`;

  const { index } = mediaAtPosition(pos < total ? pos : total - 0.001);
  previewPhotoInd.textContent = `${index + 1} / ${photos.length}`;
}

// ─── Cover image ──────────────────────────────────────────────────────────────

thumbOverlayEnabled.addEventListener("change", () => {
  thumbOverlayOptions.style.display = thumbOverlayEnabled.checked ? "" : "none";
  renderThumbPreview();
});

thumbDarkOpacity.addEventListener("input", () => {
  thumbDarkOpacityVal.textContent = thumbDarkOpacity.value + "%";
  renderThumbPreview();
});
thumbVignette.addEventListener("input", () => {
  thumbVignetteVal.textContent = thumbVignette.value + "%";
  renderThumbPreview();
});

thumbBtnSize.addEventListener("change", renderThumbPreview);

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

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function drawOverlay(ctx, w, h, opts = {}) {
  const darkPct =
    "darkPct" in opts ? opts.darkPct : parseInt(thumbDarkOpacity.value) / 100;
  const vignPct =
    "vignPct" in opts ? opts.vignPct : parseInt(thumbVignette.value) / 100;
  const btnSizeKey =
    "btnSizeKey" in opts ? opts.btnSizeKey : thumbBtnSize.value;
  const btnHex = "btnHex" in opts ? opts.btnHex : thumbBtnColor.value;

  if (darkPct > 0) {
    ctx.fillStyle = `rgba(0,0,0,${darkPct})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (vignPct > 0) {
    const cx = w / 2,
      cy = h / 2;
    const radius = Math.sqrt(cx * cx + cy * cy);
    const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(0.5, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(0,0,0,${vignPct})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  const radiusFrac =
    btnSizeKey === "sm" ? 0.07 : btnSizeKey === "lg" ? 0.135 : 0.1;
  const r = Math.min(w, h) * radiusFrac;
  const cx = w / 2,
    cy = h / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = r * 0.6;
  ctx.shadowOffsetY = r * 0.05;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = btnHex;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = r * 0.05;
  ctx.stroke();

  const lum = luminance(btnHex);
  const triColor =
    lum > 0.35 ? "rgba(15,15,15,0.85)" : "rgba(255,255,255,0.92)";

  const ox = r * 0.02;
  const th = r * 0.38;
  const tlx = cx - r * 0.27 + ox;
  const rx = cx + r * 0.48 + ox;
  const p0 = [tlx, cy - th];
  const p1 = [tlx, cy + th];
  const p2 = [rx, cy];
  const cr = r * 0.09;

  ctx.beginPath();
  ctx.moveTo((p2[0] + p0[0]) / 2, (p2[1] + p0[1]) / 2);
  ctx.arcTo(p0[0], p0[1], p1[0], p1[1], cr);
  ctx.arcTo(p1[0], p1[1], p2[0], p2[1], cr);
  ctx.arcTo(p2[0], p2[1], p0[0], p0[1], cr);
  ctx.closePath();
  ctx.fillStyle = triColor;
  ctx.fill();
}

function renderThumbPreview() {
  if (photos.length === 0) return;
  const first = photos[0];
  const { width, height } = getOutputDimensions();
  thumbCanvas.width = width;
  thumbCanvas.height = height;

  if (isVideo(first)) {
    if (first.videoEl.readyState >= 2) {
      drawVideoToCanvas(thumbCtx, first.videoEl, width, height, getBgColor());
    } else {
      thumbCtx.fillStyle = "#1f2937";
      thumbCtx.fillRect(0, 0, width, height);
    }
  } else {
    drawFrame(
      thumbCtx,
      first.img,
      width,
      height,
      getBgColor(),
      fitMode.value,
      getPadding(),
    );
  }

  if (thumbOverlayEnabled.checked) {
    drawOverlay(thumbCtx, width, height);
  }
}

function downloadThumbnail() {
  if (photos.length === 0) return;
  const first = photos[0];
  const { width, height } = getOutputDimensions();
  const encW = Math.floor(width / 2) * 2;
  const encH = Math.floor(height / 2) * 2;

  const offCanvas = document.createElement("canvas");
  offCanvas.width = encW;
  offCanvas.height = encH;
  const offCtx = offCanvas.getContext("2d");

  if (isVideo(first)) {
    drawVideoToCanvas(offCtx, first.videoEl, encW, encH, getBgColor());
  } else {
    drawFrame(
      offCtx,
      first.img,
      encW,
      encH,
      getBgColor(),
      fitMode.value,
      getPadding(),
    );
  }
  if (thumbOverlayEnabled.checked) drawOverlay(offCtx, encW, encH);

  offCanvas.toBlob(
    (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (outputFilename.value.trim() || "slideshow") + "-cover.jpg";
      a.click();
      URL.revokeObjectURL(url);
    },
    "image/jpeg",
    0.95,
  );
}

// ─── AVC level selection ──────────────────────────────────────────────────────

function avcCodecForSize(w, h) {
  const area = w * h;
  if (area <= 2_097_152) return "avc1.420028";
  if (area <= 5_652_480) return "avc1.420032";
  return "avc1.420033";
}

// ─── Seek video helper ────────────────────────────────────────────────────────

function seekVideo(videoEl, time) {
  return new Promise((resolve) => {
    if (Math.abs(videoEl.currentTime - time) < 0.001) {
      resolve();
      return;
    }
    const onSeeked = () => {
      videoEl.removeEventListener("seeked", onSeeked);
      resolve();
    };
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.currentTime = time;
  });
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
    const fps = getFps();
    const bg = getBgColor();

    const encW = Math.floor(width / 2) * 2;
    const encH = Math.floor(height / 2) * 2;

    const AUDIO_SAMPLE_RATE = 44100;
    const AUDIO_CHANNELS = 2;
    const AUDIO_BITRATE = 128_000;
    const AUDIO_FRAME_SIZE = 1024;
    const AUDIO_CODEC = "mp4a.40.2";

    let hasAudio = photos.some(isVideo) && typeof AudioEncoder !== "undefined";

    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: "avc", width: encW, height: encH },
      ...(hasAudio
        ? {
            audio: {
              codec: "aac",
              numberOfChannels: AUDIO_CHANNELS,
              sampleRate: AUDIO_SAMPLE_RATE,
            },
          }
        : {}),
      fastStart: "in-memory",
    });

    let encoderError = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        console.error("VideoEncoder error:", e);
        encoderError = e;
      },
    });

    encoder.configure({
      codec: avcCodecForSize(encW, encH),
      width: encW,
      height: encH,
      bitrate: Math.min(10_000_000, encW * encH * fps * 0.1),
      framerate: fps,
    });

    let audioEncoder = null;
    let audioChunkCount = 0;
    if (hasAudio) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          audioChunkCount++;
          muxer.addAudioChunk(chunk, meta);
        },
        error: (e) => {
          console.error("AudioEncoder error:", e);
          encoderError = e;
        },
      });
      audioEncoder.configure({
        codec: AUDIO_CODEC,
        numberOfChannels: AUDIO_CHANNELS,
        sampleRate: AUDIO_SAMPLE_RATE,
        bitrate: AUDIO_BITRATE,
      });
    }

    const offCanvas = new OffscreenCanvas(encW, encH);
    const offCtx = offCanvas.getContext("2d");

    const ei = getEndIndicator();
    const eiFrameCount = ei.enabled
      ? Math.max(1, Math.round(ei.duration * fps))
      : 0;

    const frameDurUs = Math.round(1_000_000 / fps);
    const totalFrames =
      photos.reduce(
        (s, p) => s + Math.max(1, Math.round(p.duration * fps)),
        0,
      ) + eiFrameCount;
    const videoProgressCap = hasAudio ? 60 : 90;
    let timestampUs = 0;
    let encodedFrames = 0;
    let frameTimeSec = 0;

    // ── Video frames ────────────────────────────────────────────────────────────

    for (const item of photos) {
      const frameCount = Math.max(1, Math.round(item.duration * fps));

      if (isVideo(item)) {
        const videoEl = item.videoEl;
        for (let i = 0; i < frameCount; i++) {
          if (encoderError) throw encoderError;
          const targetTime = Math.min(i / fps, item.duration - 1 / fps);
          await seekVideo(videoEl, targetTime);
          drawVideoToCanvas(offCtx, videoEl, encW, encH, bg);
          const vf = new VideoFrame(offCanvas, {
            timestamp: timestampUs,
            duration: frameDurUs,
          });
          encoder.encode(vf, { keyFrame: i === 0 });
          vf.close();
          timestampUs += frameDurUs;
          encodedFrames++;
          if (encodedFrames % 5 === 0) {
            if (encoderError) throw encoderError;
            setProgress(
              Math.round((encodedFrames / totalFrames) * videoProgressCap),
              languageService.translate("photoToVideoEncoding"),
            );
            await yieldToMain();
          }
        }
        frameTimeSec += item.duration;
      } else {
        for (let i = 0; i < frameCount; i++) {
          if (encoderError) throw encoderError;
          renderFrame(offCtx, frameTimeSec, encW, encH, bg);
          const vf = new VideoFrame(offCanvas, {
            timestamp: timestampUs,
            duration: frameDurUs,
          });
          encoder.encode(vf, { keyFrame: i === 0 });
          vf.close();
          timestampUs += frameDurUs;
          frameTimeSec += 1 / fps;
          encodedFrames++;
          if (encodedFrames % 15 === 0) {
            if (encoderError) throw encoderError;
            setProgress(
              Math.round((encodedFrames / totalFrames) * videoProgressCap),
              languageService.translate("photoToVideoEncoding"),
            );
            await yieldToMain();
          }
        }
      }
    }

    // End indicator frames
    if (ei.enabled) {
      const last = photos[photos.length - 1];
      if (isVideo(last)) {
        await seekVideo(last.videoEl, Math.max(0, last.duration - 1 / fps));
      }
      const mediaDurSec = getMediaDuration();
      for (let i = 0; i < eiFrameCount; i++) {
        if (encoderError) throw encoderError;
        const absPos = mediaDurSec + i / fps;
        renderFrame(offCtx, absPos, encW, encH, bg);
        const vf = new VideoFrame(offCanvas, {
          timestamp: timestampUs,
          duration: frameDurUs,
        });
        encoder.encode(vf, { keyFrame: i === 0 });
        vf.close();
        timestampUs += frameDurUs;
        encodedFrames++;
        if (encodedFrames % 15 === 0) {
          if (encoderError) throw encoderError;
          setProgress(
            Math.round((encodedFrames / totalFrames) * videoProgressCap),
            languageService.translate("photoToVideoEncoding"),
          );
          await yieldToMain();
        }
      }
    }

    if (encoderError) throw encoderError;
    await encoder.flush();
    if (encoderError) throw encoderError;

    // ── Audio encoding ──────────────────────────────────────────────────────────

    if (hasAudio) {
      setProgress(62, languageService.translate("photoToVideoEncoding"));
      const audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
      if (audioCtx.state === "suspended") {
        try {
          await audioCtx.resume();
        } catch (_) {
          /* ignore */
        }
      }
      let audioTimestampUs = 0;

      const audioItems = [
        ...photos,
        ...(ei.enabled ? [{ type: "silence", duration: ei.duration }] : []),
      ];

      let videoAudioSuccessCount = 0;
      let videoAudioAttemptCount = 0;
      const decodeErrors = [];

      for (let idx = 0; idx < audioItems.length; idx++) {
        const item = audioItems[idx];
        const totalSamples = Math.round(item.duration * AUDIO_SAMPLE_RATE);
        const ch0 = new Float32Array(totalSamples);
        const ch1 = new Float32Array(totalSamples);

        if (isVideo(item)) {
          videoAudioAttemptCount++;
          // decodeAudioData detaches the input buffer, so always pass a fresh copy.
          try {
            const arrBuf = await item.file.arrayBuffer();
            const bufCopy = arrBuf.slice(0);
            const decoded = await audioCtx.decodeAudioData(bufCopy);
            if (decoded.numberOfChannels === 0 || decoded.length === 0) {
              console.warn(`No audio track found in "${item.file.name}".`);
            } else {
              const src0 = decoded.getChannelData(0);
              const src1 =
                decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : src0;
              ch0.set(src0.subarray(0, Math.min(src0.length, totalSamples)));
              ch1.set(src1.subarray(0, Math.min(src1.length, totalSamples)));
              videoAudioSuccessCount++;
            }
          } catch (e) {
            console.error(
              `Failed to decode audio from "${item.file.name}":`,
              e,
            );
            decodeErrors.push({ file: item.file.name, error: e });
          }
        }

        for (
          let offset = 0;
          offset < totalSamples;
          offset += AUDIO_FRAME_SIZE
        ) {
          if (encoderError) throw encoderError;
          const frames = Math.min(AUDIO_FRAME_SIZE, totalSamples - offset);
          const buf = new Float32Array(frames * AUDIO_CHANNELS);
          buf.set(ch0.subarray(offset, offset + frames), 0);
          buf.set(ch1.subarray(offset, offset + frames), frames);
          const ad = new AudioData({
            format: "f32-planar",
            sampleRate: AUDIO_SAMPLE_RATE,
            numberOfFrames: frames,
            numberOfChannels: AUDIO_CHANNELS,
            timestamp: audioTimestampUs,
            data: buf,
          });
          audioEncoder.encode(ad);
          ad.close();
          audioTimestampUs += Math.round(
            (frames * 1_000_000) / AUDIO_SAMPLE_RATE,
          );
        }

        setProgress(
          62 + Math.round(((idx + 1) / audioItems.length) * 26),
          languageService.translate("photoToVideoEncoding"),
        );
        await yieldToMain();
      }

      try {
        audioCtx.close();
      } catch (_) {
        /* ignore */
      }
      if (encoderError) throw encoderError;
      await audioEncoder.flush();
      if (encoderError) throw encoderError;

      // If the user supplied videos but NONE decoded successfully, remember it
      // so we can show a non-fatal warning once the download is ready.
      if (videoAudioAttemptCount > 0 && videoAudioSuccessCount === 0) {
        const detail = decodeErrors[0]?.error?.message || "unknown error";
        console.warn(
          `Failed to decode audio from all source videos (${detail}). Export may be silent.`,
        );
      }
    }

    setProgress(90, languageService.translate("photoToVideoFinalizing"));
    muxer.finalize();
    setProgress(100, languageService.translate("photoToVideoDone"));

    const blob = new Blob([target.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const filename = (outputFilename.value.trim() || "slideshow") + ".mp4";

    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.classList.remove("hidden");
    downloadLink.classList.add("flex");
    downloadLink.textContent =
      "⬇ " + languageService.translate("photoToVideoDownload");
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
  progressBar.style.width = pct + "%";
  progressPct.textContent = pct + "%";
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

// ─── Video Thumbnail Generator ────────────────────────────────────────────────

const vtDropZone = document.getElementById("vtDropZone");
const vtFileInput = document.getElementById("vtFileInput");
const vtPreviewWrapper = document.getElementById("vtPreviewWrapper");
const vtCanvasWrapper = document.getElementById("vtCanvasWrapper");
const vtCanvas = document.getElementById("vtCanvas");
const vtCtx = vtCanvas.getContext("2d");
const vtFilename = document.getElementById("vtFilename");
const vtDimensions = document.getElementById("vtDimensions");
const vtScrubberTrack = document.getElementById("vtScrubberTrack");
const vtScrubFill = document.getElementById("vtScrubFill");
const vtScrubThumb = document.getElementById("vtScrubThumb");
const vtTimeDisplay = document.getElementById("vtTimeDisplay");
const vtOverlayEnabled = document.getElementById("vtOverlayEnabled");
const vtOverlayOptions = document.getElementById("vtOverlayOptions");
const vtDarkOpacity = document.getElementById("vtDarkOpacity");
const vtDarkOpacityVal = document.getElementById("vtDarkOpacityVal");
const vtVignette = document.getElementById("vtVignette");
const vtVignetteVal = document.getElementById("vtVignetteVal");
const vtBtnSize = document.getElementById("vtBtnSize");
const vtBtnColor = document.getElementById("vtBtnColor");
const vtBtnColorHex = document.getElementById("vtBtnColorHex");
const vtScale = document.getElementById("vtScale");
const vtOutputSize = document.getElementById("vtOutputSize");
const vtDownloadBtn = document.getElementById("vtDownloadBtn");

const vtVideo = document.createElement("video");
vtVideo.preload = "auto";
vtVideo.muted = true;
vtVideo.playsInline = true;

let vtReady = false;

vtDropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  vtDropZone.classList.add("border-blue-400", "bg-blue-50");
});
vtDropZone.addEventListener("dragleave", () => {
  vtDropZone.classList.remove("border-blue-400", "bg-blue-50");
});
vtDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  vtDropZone.classList.remove("border-blue-400", "bg-blue-50");
  const file = Array.from(e.dataTransfer.files).find((f) =>
    f.type.startsWith("video/"),
  );
  if (file) vtLoadVideo(file);
});
vtFileInput.addEventListener("change", () => {
  if (vtFileInput.files[0]) vtLoadVideo(vtFileInput.files[0]);
  vtFileInput.value = "";
});

function vtLoadVideo(file) {
  vtReady = false;
  vtDownloadBtn.disabled = true;
  const url = URL.createObjectURL(file);
  vtVideo.src = url;
  vtFilename.textContent = file.name;

  vtVideo.onloadedmetadata = () => {
    const vw = vtVideo.videoWidth;
    const vh = vtVideo.videoHeight;
    vtCanvas.width = vw;
    vtCanvas.height = vh;
    vtDimensions.textContent = `${vw} × ${vh}`;
    const ar = vh / vw;
    vtCanvasWrapper.style.paddingBottom = (ar * 100).toFixed(4) + "%";
    vtPreviewWrapper.classList.remove("hidden");
    vtReady = true;
    vtDownloadBtn.disabled = false;
    vtUpdateOutputSize();
    vtVideo.currentTime = 0;
  };

  vtVideo.onseeked = () => {
    if (!vtReady) return;
    vtDrawFrame();
  };
}

function vtDrawFrame() {
  const vw = vtVideo.videoWidth;
  const vh = vtVideo.videoHeight;
  vtCtx.drawImage(vtVideo, 0, 0, vw, vh);
  if (vtOverlayEnabled.checked) {
    drawOverlay(vtCtx, vw, vh, {
      darkPct: parseInt(vtDarkOpacity.value) / 100,
      vignPct: parseInt(vtVignette.value) / 100,
      btnSizeKey: vtBtnSize.value,
      btnHex: vtBtnColor.value,
    });
  }
  vtUpdateScrubberUI();
}

function vtUpdateOutputSize() {
  if (!vtReady) {
    vtOutputSize.textContent = "";
    return;
  }
  const scale = parseFloat(vtScale.value);
  const w = Math.round(vtVideo.videoWidth * scale);
  const h = Math.round(vtVideo.videoHeight * scale);
  vtOutputSize.textContent = `${w} × ${h}`;
}

vtScale.addEventListener("change", vtUpdateOutputSize);

function vtUpdateScrubberUI() {
  const dur = vtVideo.duration || 0;
  const cur = vtVideo.currentTime;
  const frac = dur > 0 ? cur / dur : 0;
  vtScrubFill.style.width = (frac * 100).toFixed(2) + "%";
  vtScrubThumb.style.left = (frac * 100).toFixed(2) + "%";
  vtTimeDisplay.textContent = `${vtFormatTime(cur)} / ${vtFormatTime(dur)}`;
}

function vtFormatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

vtScrubberTrack.addEventListener("mousedown", (e) => {
  vtSeek(e);
  const onMove = (e) => vtSeek(e);
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
});

function vtSeek(e) {
  if (!vtReady) return;
  const rect = vtScrubberTrack.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  vtVideo.currentTime = frac * vtVideo.duration;
  vtUpdateScrubberUI();
}

vtOverlayEnabled.addEventListener("change", () => {
  vtOverlayOptions.style.display = vtOverlayEnabled.checked ? "" : "none";
  if (vtReady) vtDrawFrame();
});

vtDarkOpacity.addEventListener("input", () => {
  vtDarkOpacityVal.textContent = vtDarkOpacity.value + "%";
  if (vtReady) vtDrawFrame();
});
vtVignette.addEventListener("input", () => {
  vtVignetteVal.textContent = vtVignette.value + "%";
  if (vtReady) vtDrawFrame();
});
vtBtnSize.addEventListener("change", () => {
  if (vtReady) vtDrawFrame();
});
vtBtnColor.addEventListener("input", () => {
  vtBtnColorHex.value = vtBtnColor.value;
  if (vtReady) vtDrawFrame();
});
vtBtnColorHex.addEventListener("input", () => {
  const val = vtBtnColorHex.value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    vtBtnColor.value = val;
    if (vtReady) vtDrawFrame();
  }
});

vtDownloadBtn.addEventListener("click", () => {
  if (!vtReady) return;
  const scale = parseFloat(vtScale.value);
  const vw = Math.round(vtVideo.videoWidth * scale);
  const vh = Math.round(vtVideo.videoHeight * scale);
  const off = document.createElement("canvas");
  off.width = vw;
  off.height = vh;
  const offCtx = off.getContext("2d");
  offCtx.drawImage(vtVideo, 0, 0, vw, vh);
  if (vtOverlayEnabled.checked) {
    drawOverlay(offCtx, vw, vh, {
      darkPct: parseInt(vtDarkOpacity.value) / 100,
      vignPct: parseInt(vtVignette.value) / 100,
      btnSizeKey: vtBtnSize.value,
      btnHex: vtBtnColor.value,
    });
  }
  off.toBlob(
    (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const base = vtVideo.src
        ? vtFilename.textContent.replace(/\.[^.]+$/, "")
        : "thumbnail";
      a.href = url;
      a.download = base + "-cover.jpg";
      a.click();
      URL.revokeObjectURL(url);
    },
    "image/jpeg",
    0.95,
  );
});

// ─── GIF Export ───────────────────────────────────────────────────────────────

generateGifBtn.addEventListener("click", generateGif);

function setGifProgress(pct, label) {
  gifProgressBar.style.width = pct + "%";
  gifProgressPct.textContent = pct + "%";
  if (label) gifProgressLabel.textContent = label;
}

function showGifError(msg) {
  gifProgressSection.classList.add("hidden");
  gifErrorMsg.textContent = msg;
  gifErrorMsg.classList.remove("hidden");
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/**
 * Floyd–Steinberg dithering against a fixed palette.
 * Returns Uint8Array of palette indices (length = width * height).
 */
function ditherFrameFS(rgba, width, height, palette) {
  const numPixels = width * height;
  const indices = new Uint8Array(numPixels);

  const buf = new Float32Array(numPixels * 3);
  for (let i = 0, j = 0; i < numPixels; i++, j += 3) {
    buf[j] = rgba[i * 4];
    buf[j + 1] = rgba[i * 4 + 1];
    buf[j + 2] = rgba[i * 4 + 2];
  }

  const cache = new Int16Array(32768).fill(-1);
  const palLen = palette.length;

  const nearest = (r, g, b) => {
    r = r < 0 ? 0 : r > 255 ? 255 : r | 0;
    g = g < 0 ? 0 : g > 255 ? 255 : g | 0;
    b = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let idx = cache[key];
    if (idx >= 0) return idx;
    let bestD = Infinity,
      bestI = 0;
    for (let i = 0; i < palLen; i++) {
      const c = palette[i];
      const dr = r - c[0],
        dg = g - c[1],
        db = b - c[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    cache[key] = bestI;
    return bestI;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const or = buf[idx],
        og = buf[idx + 1],
        ob = buf[idx + 2];

      const pi = nearest(or, og, ob);
      const pc = palette[pi];
      indices[y * width + x] = pi;

      const er = or - pc[0];
      const eg = og - pc[1];
      const eb = ob - pc[2];

      if (x + 1 < width) {
        const n = idx + 3;
        buf[n] += (er * 7) / 16;
        buf[n + 1] += (eg * 7) / 16;
        buf[n + 2] += (eb * 7) / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          const n = ((y + 1) * width + x - 1) * 3;
          buf[n] += (er * 3) / 16;
          buf[n + 1] += (eg * 3) / 16;
          buf[n + 2] += (eb * 3) / 16;
        }
        {
          const n = ((y + 1) * width + x) * 3;
          buf[n] += (er * 5) / 16;
          buf[n + 1] += (eg * 5) / 16;
          buf[n + 2] += (eb * 5) / 16;
        }
        if (x + 1 < width) {
          const n = ((y + 1) * width + x + 1) * 3;
          buf[n] += (er * 1) / 16;
          buf[n + 1] += (eg * 1) / 16;
          buf[n + 2] += (eb * 1) / 16;
        }
      }
    }
  }

  return indices;
}

function computeGifDimensions() {
  const out = getOutputDimensions();
  const maxW = Math.max(
    16,
    Math.min(1920, parseInt(gifMaxWidthInput.value) || 480),
  );
  if (out.width <= maxW) {
    return { width: out.width, height: out.height };
  }
  const scale = maxW / out.width;
  return {
    width: maxW,
    height: Math.max(2, Math.round(out.height * scale)),
  };
}

async function generateGif() {
  if (isEncodingGif || photos.length === 0) return;

  stopPlayback();
  isEncodingGif = true;
  generateGifBtn.disabled = true;
  gifErrorMsg.classList.add("hidden");
  gifDownloadLink.classList.add("hidden");
  gifDownloadLink.classList.remove("flex");
  gifPreviewWrapper.classList.add("hidden");
  gifSizeWarning.classList.add("hidden");
  gifProgressSection.classList.remove("hidden");
  setGifProgress(0, languageService.translate("photoToGifEncoding"));

  if (gifBlobUrl) {
    URL.revokeObjectURL(gifBlobUrl);
    gifBlobUrl = null;
  }

  try {
    const fps = Math.max(1, Math.min(30, parseInt(gifFpsInput.value) || 3));
    const { width: gifW, height: gifH } = computeGifDimensions();
    const bg = getBgColor();

    const off = document.createElement("canvas");
    off.width = gifW;
    off.height = gifH;
    const offCtx = off.getContext("2d", { willReadFrequently: true });

    const ei = getEndIndicator();
    const eiFrameCount = ei.enabled
      ? Math.max(1, Math.round(ei.duration * fps))
      : 0;
    const mediaFrameCount = photos.reduce(
      (s, p) => s + Math.max(1, Math.round(p.duration * fps)),
      0,
    );
    const totalFrames = mediaFrameCount + eiFrameCount;

    // ── Phase 1: render all frames as RGBA ────────────────────────────────────
    const frames = [];
    let frameTimeSec = 0;

    for (const item of photos) {
      const frameCount = Math.max(1, Math.round(item.duration * fps));
      if (isVideo(item)) {
        const videoEl = item.videoEl;
        for (let i = 0; i < frameCount; i++) {
          const targetTime = Math.min(i / fps, item.duration - 1 / fps);
          await seekVideo(videoEl, targetTime);
          drawVideoToCanvas(offCtx, videoEl, gifW, gifH, bg);
          frames.push(offCtx.getImageData(0, 0, gifW, gifH).data);
          setGifProgress(
            Math.round((frames.length / totalFrames) * 35),
            languageService.translate("photoToGifEncoding"),
          );
          if (frames.length % 4 === 0) await yieldToMain();
        }
        frameTimeSec += item.duration;
      } else {
        for (let i = 0; i < frameCount; i++) {
          renderFrame(offCtx, frameTimeSec, gifW, gifH, bg);
          frames.push(offCtx.getImageData(0, 0, gifW, gifH).data);
          frameTimeSec += 1 / fps;
          setGifProgress(
            Math.round((frames.length / totalFrames) * 35),
            languageService.translate("photoToGifEncoding"),
          );
          if (frames.length % 8 === 0) await yieldToMain();
        }
      }
    }

    if (ei.enabled) {
      const last = photos[photos.length - 1];
      if (isVideo(last)) {
        await seekVideo(last.videoEl, Math.max(0, last.duration - 1 / fps));
      }
      const mediaDurSec = getMediaDuration();
      for (let i = 0; i < eiFrameCount; i++) {
        const absPos = mediaDurSec + i / fps;
        renderFrame(offCtx, absPos, gifW, gifH, bg);
        frames.push(offCtx.getImageData(0, 0, gifW, gifH).data);
        setGifProgress(
          Math.round((frames.length / totalFrames) * 35),
          languageService.translate("photoToGifEncoding"),
        );
        if (frames.length % 8 === 0) await yieldToMain();
      }
    }

    // ── Phase 2: build a global 256-color palette ─────────────────────────────
    setGifProgress(40, languageService.translate("photoToGifQuantizing"));
    await yieldToMain();

    // Sample pixels from up to ~12 evenly-spaced frames to keep quantize fast.
    const sampleFrameCount = Math.min(frames.length, 12);
    const step = Math.max(1, Math.floor(frames.length / sampleFrameCount));
    const pxPerFrame = gifW * gifH;
    const sample = new Uint8Array(sampleFrameCount * pxPerFrame * 4);
    let offset = 0;
    for (let i = 0; i < frames.length && offset < sample.length; i += step) {
      sample.set(frames[i], offset);
      offset += frames[i].length;
    }
    const paletteSample = sample.subarray(0, offset);
    const palette = quantize(paletteSample, 256, { format: "rgb444" });

    // ── Phase 3: dither each frame and write to the GIF ───────────────────────
    const encoder = GIFEncoder();
    const delayMs = Math.round(1000 / fps);

    for (let i = 0; i < frames.length; i++) {
      const indices = ditherFrameFS(frames[i], gifW, gifH, palette);
      encoder.writeFrame(indices, gifW, gifH, {
        palette: i === 0 ? palette : undefined,
        first: i === 0,
        delay: delayMs,
        repeat: 0,
      });
      setGifProgress(
        40 + Math.round(((i + 1) / frames.length) * 55),
        languageService.translate("photoToGifDithering"),
      );
      await yieldToMain();
    }

    encoder.finish();
    setGifProgress(100, languageService.translate("photoToVideoDone"));

    const bytes = encoder.bytes();
    const blob = new Blob([bytes], { type: "image/gif" });
    gifBlobUrl = URL.createObjectURL(blob);

    const filename = (outputFilename.value.trim() || "slideshow") + ".gif";
    gifDownloadLink.href = gifBlobUrl;
    gifDownloadLink.download = filename;
    gifDownloadLink.classList.remove("hidden");
    gifDownloadLink.classList.add("flex");
    gifDownloadLink.textContent =
      "⬇ " +
      languageService.translate("photoToGifDownload").replace(/^⬇\s*/, "");

    gifPreviewImg.src = gifBlobUrl;
    gifPreviewInfo.textContent = `${gifW} × ${gifH} · ${fps} fps · ${frames.length} ${frames.length === 1 ? "frame" : "frames"}`;
    gifSizeInfo.textContent = formatFileSize(bytes.byteLength);
    gifPreviewWrapper.classList.remove("hidden");

    if (bytes.byteLength > 2 * 1024 * 1024) {
      gifSizeWarning.classList.remove("hidden");
      gifSizeInfo.classList.add("text-amber-700");
      gifSizeInfo.classList.remove("text-gray-700");
    } else {
      gifSizeWarning.classList.add("hidden");
      gifSizeInfo.classList.remove("text-amber-700");
      gifSizeInfo.classList.add("text-gray-700");
    }
  } catch (err) {
    console.error("GIF encoding error:", err);
    showGifError(err.message || languageService.translate("photoToGifError"));
  } finally {
    isEncodingGif = false;
    generateGifBtn.disabled = photos.length === 0;
  }
}
