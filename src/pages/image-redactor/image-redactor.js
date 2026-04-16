import { languageService } from "../../services/languageService.js";

let image = null;
let canvas, ctx;
let redactions = [];
let activeMode = "pixelate";
let pixelSize = 10;
let blurRadius = 6;
let drawing = false;
let startX = 0,
  startY = 0,
  mouseX = 0,
  mouseY = 0;

function getScale() {
  const rect = canvas.getBoundingClientRect();
  return rect.width / canvas.width;
}

function toCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const s = getScale();
  return {
    x: (clientX - rect.left) / s,
    y: (clientY - rect.top) / s,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function applyPixelate(sx, sy, sw, sh, pSize) {
  sx = Math.round(sx);
  sy = Math.round(sy);
  sw = Math.round(sw);
  sh = Math.round(sh);

  if (sw <= 0 || sh <= 0) return;
  sx = clamp(sx, 0, canvas.width - 1);
  sy = clamp(sy, 0, canvas.height - 1);
  sw = clamp(sw, 1, canvas.width - sx);
  sh = clamp(sh, 1, canvas.height - sy);

  try {
    const imgData = ctx.getImageData(sx, sy, sw, sh);
    const d = imgData.data;
    const blockSize = Math.max(1, pSize);

    for (let py = 0; py < sh; py += blockSize) {
      for (let px = 0; px < sw; px += blockSize) {
        const x1 = px;
        const y1 = py;
        const x2 = Math.min(px + blockSize, sw);
        const y2 = Math.min(py + blockSize, sh);
        const count = (x2 - x1) * (y2 - y1);

        let r = 0, g = 0, b = 0, a = 0;
        for (let by = y1; by < y2; by++) {
          for (let bx = x1; bx < x2; bx++) {
            const i = (by * sw + bx) * 4;
            r += d[i];
            g += d[i + 1];
            b += d[i + 2];
            a += d[i + 3];
          }
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        a = Math.round(a / count);

        for (let by = y1; by < y2; by++) {
          for (let bx = x1; bx < x2; bx++) {
            const i = (by * sw + bx) * 4;
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b;
            d[i + 3] = a;
          }
        }
      }
    }

    ctx.putImageData(imgData, sx, sy);
  } catch {
    ctx.fillStyle = "#888";
    ctx.fillRect(sx, sy, sw, sh);
  }
}

function applyBlur(sx, sy, sw, sh, radius) {
  sx = Math.round(sx);
  sy = Math.round(sy);
  sw = Math.round(sw);
  sh = Math.round(sh);

  if (sw <= 0 || sh <= 0) return;
  sx = clamp(sx, 0, canvas.width - 1);
  sy = clamp(sy, 0, canvas.height - 1);
  sw = clamp(sw, 1, canvas.width - sx);
  sh = clamp(sh, 1, canvas.height - sy);

  try {
    const tmp = document.createElement("canvas");
    tmp.width = sw;
    tmp.height = sh;
    const tmpCtx = tmp.getContext("2d");
    tmpCtx.filter = `blur(${radius}px)`;
    tmpCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    ctx.drawImage(tmp, sx, sy);
  } catch {
    ctx.fillStyle = "#888";
    ctx.fillRect(sx, sy, sw, sh);
  }
}

function applyRedaction(r) {
  const x = Math.min(r.x, r.x + r.w);
  const y = Math.min(r.y, r.y + r.h);
  const w = Math.abs(r.w);
  const h = Math.abs(r.h);

  switch (r.mode) {
    case "pixelate":
      applyPixelate(x, y, w, h, r.pixelSize);
      break;
    case "blur":
      applyBlur(x, y, w, h, r.blurRadius);
      break;
    case "black":
      ctx.fillStyle = "#000000";
      ctx.fillRect(x, y, w, h);
      break;
    case "white":
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, w, h);
      break;
  }
}

function render(showPreview = false) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  for (const r of redactions) {
    applyRedaction(r);
  }

  if (showPreview && drawing) {
    const x = Math.min(startX, mouseX);
    const y = Math.min(startY, mouseY);
    const w = Math.abs(mouseX - startX);
    const h = Math.abs(mouseY - startY);

    const s = getScale();
    ctx.save();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = Math.max(1, 2 / s);
    ctx.setLineDash([Math.max(3, 5 / s), Math.max(3, 5 / s)]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}

function setupCanvasEvents() {
  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);
    startX = x;
    startY = y;
    mouseX = x;
    mouseY = y;
    drawing = true;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);
    mouseX = x;
    mouseY = y;
    render(true);
  });

  canvas.addEventListener("mouseup", (e) => {
    if (!drawing) return;
    drawing = false;
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);
    const w = x - startX;
    const h = y - startY;

    if (Math.abs(w) > 3 && Math.abs(h) > 3) {
      redactions.push({
        x: startX,
        y: startY,
        w,
        h,
        mode: activeMode,
        pixelSize,
        blurRadius,
      });
    }
    render();
  });

  canvas.addEventListener("mouseleave", () => {
    if (drawing) {
      drawing = false;
      render();
    }
  });

  // Touch support
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = toCanvasCoords(touch.clientX, touch.clientY);
    startX = x;
    startY = y;
    mouseX = x;
    mouseY = y;
    drawing = true;
  });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!drawing) return;
    const touch = e.touches[0];
    const { x, y } = toCanvasCoords(touch.clientX, touch.clientY);
    mouseX = x;
    mouseY = y;
    render(true);
  });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (!drawing) return;
    drawing = false;
    const w = mouseX - startX;
    const h = mouseY - startY;

    if (Math.abs(w) > 3 && Math.abs(h) > 3) {
      redactions.push({
        x: startX,
        y: startY,
        w,
        h,
        mode: activeMode,
        pixelSize,
        blurRadius,
      });
    }
    render();
  });
}

function setupUpload() {
  const uploadArea = document.getElementById("uploadArea");
  const fileInput = document.getElementById("fileInput");
  const selectBtn = document.getElementById("selectImageBtn");

  selectBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  uploadArea.addEventListener("click", () => fileInput.click());

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("border-blue-400", "bg-blue-50");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("border-blue-400", "bg-blue-50");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("border-blue-400", "bg-blue-50");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) loadImage(file);
  });

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) loadImage(file);
  });
}

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    image = new Image();
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      redactions = [];
      render();
      document.getElementById("uploadSection").classList.add("hidden");
      document.getElementById("editorSection").classList.remove("hidden");
    };
    image.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function setupModeButtons() {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeMode = btn.dataset.mode;
      document
        .querySelectorAll(".mode-btn")
        .forEach((b) => b.classList.remove("active-mode"));
      btn.classList.add("active-mode");

      document
        .getElementById("pixelSizeControl")
        .classList.toggle("hidden", activeMode !== "pixelate");
      document
        .getElementById("blurRadiusControl")
        .classList.toggle("hidden", activeMode !== "blur");
    });
  });
}

function setupSliders() {
  const pixelSlider = document.getElementById("pixelSizeSlider");
  const pixelValue = document.getElementById("pixelSizeValue");
  pixelSlider.addEventListener("input", () => {
    pixelSize = parseInt(pixelSlider.value);
    pixelValue.textContent = pixelSize;
  });

  const blurSlider = document.getElementById("blurRadiusSlider");
  const blurValue = document.getElementById("blurRadiusValue");
  blurSlider.addEventListener("input", () => {
    blurRadius = parseInt(blurSlider.value);
    blurValue.textContent = blurRadius;
  });
}

function setupActionButtons() {
  document.getElementById("undoBtn").addEventListener("click", () => {
    if (redactions.length > 0) {
      redactions.pop();
      render();
    }
  });

  document.getElementById("clearAllBtn").addEventListener("click", () => {
    redactions = [];
    render();
  });

  document.getElementById("downloadBtn").addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "redacted.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  document.getElementById("copyBtn").addEventListener("click", async () => {
    const btn = document.getElementById("copyBtn");
    try {
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      const original = btn.textContent;
      btn.textContent = languageService.translate("imageRedactorCopied");
      btn.classList.replace("bg-blue-500", "bg-green-500");
      btn.classList.replace("hover:bg-blue-600", "hover:bg-green-600");
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.replace("bg-green-500", "bg-blue-500");
        btn.classList.replace("hover:bg-green-600", "hover:bg-blue-600");
      }, 2000);
    } catch {
      btn.textContent = "⚠ Not supported";
      setTimeout(() => {
        btn.textContent = languageService.translate("imageRedactorCopy");
      }, 2000);
    }
  });

  document.getElementById("newImageBtn").addEventListener("click", () => {
    image = null;
    redactions = [];
    document.getElementById("fileInput").value = "";
    document.getElementById("editorSection").classList.add("hidden");
    document.getElementById("uploadSection").classList.remove("hidden");
  });
}

function addModeButtonStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .mode-btn {
      background: white;
      color: #374151;
      border-color: #d1d5db;
    }
    .mode-btn:hover {
      background: #f3f4f6;
    }
    .mode-btn.active-mode {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }
  `;
  document.head.appendChild(style);
}

function init() {
  canvas = document.getElementById("redactorCanvas");
  ctx = canvas.getContext("2d");

  addModeButtonStyles();
  setupUpload();
  setupModeButtons();
  setupSliders();
  setupCanvasEvents();
  setupActionButtons();
}

init();
