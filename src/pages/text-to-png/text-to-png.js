import JSZip from "jszip";
import { languageService } from "../../services/languageService";

const FONTS = [
  "Aptos",
  "Aptos Narrow",
  "Open Sans",
  "Roboto",
  "Lato",
  "Montserrat",
  "Playfair Display",
  "Merriweather",
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
];

const FONT_WEIGHTS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi Bold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
];

const ALL_WEIGHT_VALUES = FONT_WEIGHTS.map((w) => w.value);

// Weights actually shipped for each font (matches the @font-face/Google Fonts
// declarations in index.html). System fonts fall through to all weights since
// the browser will synthesize what's missing.
const FONT_WEIGHTS_AVAILABLE = {
  Aptos: ["300", "400", "600", "700", "800"],
  "Aptos Narrow": ["300", "400", "600", "700", "800"],
  "Open Sans": ["300", "400", "500", "600", "700", "800"],
  Roboto: ["300", "400", "500", "700"],
  Lato: ["300", "400", "700"],
  Montserrat: ["300", "400", "500", "600", "700"],
  "Playfair Display": ["400", "500", "600", "700"],
  Merriweather: ["300", "400", "700"],
};

function getAvailableWeights(fontFamily) {
  return FONT_WEIGHTS_AVAILABLE[fontFamily] || ALL_WEIGHT_VALUES;
}

function pickClosestWeight(target, available) {
  if (available.includes(target)) return target;
  if (available.includes("400")) return "400";
  if (available.includes("700")) return "700";
  const targetNum = Number(target);
  return available
    .slice()
    .sort((a, b) => Math.abs(Number(a) - targetNum) - Math.abs(Number(b) - targetNum))[0];
}

let lines = [];
let nextLineId = 0;

const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");
const canvasWidthEl = document.getElementById("canvasWidth");
const canvasHeightEl = document.getElementById("canvasHeight");
const marginTopEl = document.getElementById("marginTop");
const marginBottomEl = document.getElementById("marginBottom");
const marginLeftEl = document.getElementById("marginLeft");
const marginRightEl = document.getElementById("marginRight");
const linesContainer = document.getElementById("linesContainer");
const addLineBtn = document.getElementById("addLineBtn");
const downloadBtn = document.getElementById("downloadBtn");
const filenameInput = document.getElementById("filename");

function getCanvasW() {
  return parseInt(canvasWidthEl.value);
}
function getCanvasH() {
  return parseInt(canvasHeightEl.value);
}

function applyNonBreakingSpaces(text) {
  return text.replace(/(^|[  ])([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]) /g, "$1$2 ");
}

function createLineConfig(text = "Sample Text") {
  return {
    id: nextLineId++,
    text,
    fontFamily: "Open Sans",
    fontSizePct: 10,
    fontWeight: "400",
    italic: false,
    color: "#1C1C1C",
    lineHeight: 1,
    shadow: false,
    shadowColor: "#000000",
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    offsetXPct: 0,
    offsetYPct: 0,
    textAlign: "left",
  };
}

function fontSizePx(line) {
  return Math.round((line.fontSizePct / 100) * getCanvasH());
}

function buildFont(line, italic) {
  const style = italic ? "italic " : "";
  const px = fontSizePx(line);
  return `${style}${line.fontWeight} ${px}px "${line.fontFamily}"`;
}

// Parse *italic* markers. baseItalic is the line's italic checkbox state.
// *...* toggles: if base is normal, *text* becomes italic; if base is italic, *text* becomes normal.
function parseSegments(text, baseItalic) {
  const segments = [];
  const regex = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        italic: baseItalic,
      });
    }
    segments.push({ text: match[1], italic: !baseItalic });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), italic: baseItalic });
  }

  if (segments.length === 0) {
    segments.push({ text: "", italic: baseItalic });
  }

  return segments;
}

// Split segments into word-level tokens: [{text, italic, isSpace}]
function tokenize(segments) {
  const tokens = [];
  for (const seg of segments) {
    const parts = seg.text.split(/( +)/);
    for (const part of parts) {
      if (part.length > 0) {
        tokens.push({
          text: part,
          italic: seg.italic,
          isSpace: /^ +$/.test(part),
        });
      }
    }
  }
  return tokens;
}

// Measure token width with correct font
function measureToken(token, line) {
  ctx.font = buildFont(line, token.italic);
  return ctx.measureText(token.text).width;
}

// Word-wrap tokens into rows. Each row is an array of tokens.
function wrapTokens(tokens, maxWidth, line) {
  const rows = [];
  let row = [];
  let rowWidth = 0;

  for (const token of tokens) {
    const w = measureToken(token, line);

    if (!token.isSpace && rowWidth + w > maxWidth && row.length > 0) {
      // Remove trailing spaces from current row
      while (row.length > 0 && row[row.length - 1].isSpace) {
        row.pop();
      }
      rows.push(row);
      row = [token];
      rowWidth = w;
    } else {
      row.push(token);
      rowWidth += w;
    }
  }

  if (row.length > 0) {
    while (row.length > 0 && row[row.length - 1].isSpace) {
      row.pop();
    }
    if (row.length > 0) rows.push(row);
  }

  return rows;
}

function measureRow(rowTokens, line) {
  return rowTokens.reduce((sum, token) => {
    ctx.font = buildFont(line, token.italic);
    return sum + ctx.measureText(token.text).width;
  }, 0);
}

// Draw a single row of tokens at position (x, y). `extraPerSpace` adds extra
// pixels after each space token (used to justify the row).
function drawRow(rowTokens, x, y, line, extraPerSpace = 0) {
  let curX = x;
  for (const token of rowTokens) {
    ctx.font = buildFont(line, token.italic);
    ctx.fillText(token.text, curX, y);
    curX += ctx.measureText(token.text).width;
    if (extraPerSpace && token.isSpace) curX += extraPerSpace;
  }
}

function isLightColor(hex) {
  if (typeof hex !== "string" || !/^#([0-9a-fA-F]{6})$/.test(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.7;
}

const LIGHT_PREVIEW_BG =
  "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 20px 20px";
const DARK_PREVIEW_BG =
  "repeating-conic-gradient(#4b5563 0% 25%, #374151 0% 50%) 50% / 20px 20px";

function updatePreviewBackground() {
  const container = document.getElementById("previewContainer");
  if (!container) return;
  const hasLightText = lines.some((l) => isLightColor(l.color));
  container.style.background = hasLightText ? DARK_PREVIEW_BG : LIGHT_PREVIEW_BG;
}

async function ensureFontsLoaded() {
  if (!document.fonts || typeof document.fonts.load !== "function") return;
  const fontStrings = new Set();
  for (const line of lines) {
    fontStrings.add(buildFont(line, false));
    fontStrings.add(buildFont(line, true));
  }
  try {
    await Promise.all([...fontStrings].map((fs) => document.fonts.load(fs)));
  } catch {
    // Ignore — fall back to whatever the browser has.
  }
}

async function renderCanvas() {
  updatePreviewBackground();
  await ensureFontsLoaded();
  renderCanvasSync();
}

function renderCanvasSync() {
  const w = getCanvasW();
  const h = getCanvasH();
  canvas.width = w;
  canvas.height = h;

  const container = document.getElementById("previewContainer");
  const maxDisplayWidth = container.clientWidth - 2;
  const scale = Math.min(1, maxDisplayWidth / w);
  canvas.style.width = w * scale + "px";
  canvas.style.height = h * scale + "px";

  ctx.clearRect(0, 0, w, h);

  const mTop = (parseFloat(marginTopEl.value) / 100) * h;
  const mLeft = (parseFloat(marginLeftEl.value) / 100) * w;
  const mRight = (parseFloat(marginRightEl.value) / 100) * w;

  const textAreaWidth = w - mLeft - mRight;
  let currentY = mTop;

  for (const line of lines) {
    const px = fontSizePx(line);
    const lh = px * (1 + line.lineHeight * 0.3);

    const offsetX = (line.offsetXPct / 100) * w;
    const offsetY = (line.offsetYPct / 100) * h;

    ctx.fillStyle = line.color;
    ctx.textBaseline = "top";

    if (line.shadow) {
      ctx.shadowColor = line.shadowColor;
      ctx.shadowBlur = line.shadowBlur;
      ctx.shadowOffsetX = line.shadowOffsetX;
      ctx.shadowOffsetY = line.shadowOffsetY;
    }

    const paragraphs = line.text.split("\n");

    for (const paragraph of paragraphs) {
      if (paragraph === "") {
        currentY += lh;
        continue;
      }

      const segments = parseSegments(paragraph, line.italic);
      const tokens = tokenize(segments);
      const rows = wrapTokens(tokens, textAreaWidth, line);

      for (let i = 0; i < rows.length; i++) {
        const rowTokens = rows[i];
        const isLastRow = i === rows.length - 1;
        const rowWidth = measureRow(rowTokens, line);
        let startX;
        let extraPerSpace = 0;

        if (line.textAlign === "center") {
          startX = mLeft + textAreaWidth / 2 - rowWidth / 2 + offsetX;
        } else if (line.textAlign === "right") {
          startX = mLeft + textAreaWidth - rowWidth + offsetX;
        } else if (line.textAlign === "justify") {
          startX = mLeft + offsetX;
          const spaceCount = rowTokens.filter((t) => t.isSpace).length;
          // Don't justify the last row of a paragraph or rows with no gaps.
          if (!isLastRow && spaceCount > 0 && rowWidth < textAreaWidth) {
            extraPerSpace = (textAreaWidth - rowWidth) / spaceCount;
          }
        } else {
          startX = mLeft + offsetX;
        }
        drawRow(rowTokens, startX, currentY + offsetY, line, extraPerSpace);
        currentY += lh;
      }
    }

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

function createLineElement(line) {
  const div = document.createElement("div");
  div.className = "border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50";
  div.dataset.lineId = line.id;

  div.innerHTML = `
    <div class="flex items-start gap-2">
      <textarea rows="2"
        class="line-text flex-1 p-2 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y"
        placeholder="${languageService.translate("textToPngPlaceholder")}">${line.text.replace(/</g, "&lt;")}</textarea>
      <button class="remove-line-btn px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 mt-1" title="${languageService.translate("textToPngRemoveLine")}">✕</button>
    </div>
    <p class="text-xs text-gray-400" data-i18n="textToPngItalicHint">Use *text* for inline italic</p>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngFont">Font</label>
        <select class="line-font w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none">
          ${FONTS.map((f) => `<option value="${f}" ${f === line.fontFamily ? "selected" : ""}>${f}</option>`).join("")}
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngSize">Size</label>
        <input type="number" value="${line.fontSizePct}" min="0.5" max="100" step="0.5"
          class="line-size w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngWeight">Weight</label>
        <select class="line-weight w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none">
          ${FONT_WEIGHTS.filter((fw) => getAvailableWeights(line.fontFamily).includes(fw.value)).map((fw) => `<option value="${fw.value}" ${fw.value === line.fontWeight ? "selected" : ""}>${fw.label}</option>`).join("")}
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngColor">Color</label>
        <input type="color" value="${line.color}"
          class="line-color w-full h-[34px] border border-gray-300 rounded cursor-pointer" />
      </div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <div class="flex items-center gap-2">
        <input type="checkbox" ${line.italic ? "checked" : ""} class="line-italic" id="italic-${line.id}" />
        <label for="italic-${line.id}" class="text-sm text-gray-600" data-i18n="textToPngItalic">Italic</label>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngAlign">Align</label>
        <select class="line-align w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none">
          <option value="left" ${line.textAlign === "left" ? "selected" : ""} data-i18n="textToPngAlignLeft">Left</option>
          <option value="center" ${line.textAlign === "center" ? "selected" : ""} data-i18n="textToPngAlignCenter">Center</option>
          <option value="right" ${line.textAlign === "right" ? "selected" : ""} data-i18n="textToPngAlignRight">Right</option>
          <option value="justify" ${line.textAlign === "justify" ? "selected" : ""} data-i18n="textToPngAlignJustify">Justify</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngLineHeight">Line Height</label>
        <input type="number" value="${line.lineHeight}" min="0" max="5" step="0.1"
          class="line-line-height w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngOffsetX">Offset X</label>
        <input type="number" value="${line.offsetXPct}" step="0.5"
          class="line-offset-x w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngOffsetY">Offset Y</label>
        <input type="number" value="${line.offsetYPct}" step="0.5"
          class="line-offset-y w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none" />
      </div>
    </div>
    <div class="grid grid-cols-5 gap-2 items-end">
      <div class="flex items-center gap-2">
        <input type="checkbox" ${line.shadow ? "checked" : ""} class="line-shadow" id="shadow-${line.id}" />
        <label for="shadow-${line.id}" class="text-sm text-gray-600" data-i18n="textToPngShadow">Shadow</label>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngShadowColor">Color</label>
        <input type="color" value="${line.shadowColor}"
          class="line-shadow-color w-full h-[30px] border border-gray-300 rounded cursor-pointer" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngShadowBlur">Blur</label>
        <input type="number" value="${line.shadowBlur}" min="0" max="100" step="1"
          class="line-shadow-blur w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngShadowX">X</label>
        <input type="number" value="${line.shadowOffsetX}" step="1"
          class="line-shadow-x w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngShadowY">Y</label>
        <input type="number" value="${line.shadowOffsetY}" step="1"
          class="line-shadow-y w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none" />
      </div>
    </div>
  `;

  const bindInput = (selector, prop, transform = (v) => v) => {
    const el = div.querySelector(selector);
    const event =
      el.type === "checkbox"
        ? "change"
        : el.tagName === "SELECT"
          ? "change"
          : "input";
    el.addEventListener(event, (e) => {
      line[prop] =
        el.type === "checkbox" ? el.checked : transform(e.target.value);
      renderCanvas();
    });
  };

  bindInput(".line-text", "text");

  const textareaEl = div.querySelector(".line-text");
  textareaEl.addEventListener("paste", () => {
    setTimeout(() => {
      const transformed = applyNonBreakingSpaces(textareaEl.value);
      if (transformed !== textareaEl.value) {
        const pos = textareaEl.selectionStart;
        textareaEl.value = transformed;
        textareaEl.setSelectionRange(pos, pos);
      }
      line.text = textareaEl.value;
      renderCanvas();
    }, 0);
  });

  const fontEl = div.querySelector(".line-font");
  const weightEl = div.querySelector(".line-weight");

  function rebuildWeightOptions() {
    const available = getAvailableWeights(line.fontFamily);
    const nextWeight = pickClosestWeight(line.fontWeight, available);
    line.fontWeight = nextWeight;
    weightEl.innerHTML = FONT_WEIGHTS.filter((fw) =>
      available.includes(fw.value),
    )
      .map(
        (fw) =>
          `<option value="${fw.value}" ${fw.value === nextWeight ? "selected" : ""}>${fw.label}</option>`,
      )
      .join("");
  }

  fontEl.addEventListener("change", (e) => {
    line.fontFamily = e.target.value;
    rebuildWeightOptions();
    renderCanvas();
  });

  weightEl.addEventListener("change", (e) => {
    line.fontWeight = e.target.value;
    renderCanvas();
  });

  bindInput(".line-size", "fontSizePct", Number);
  bindInput(".line-color", "color");
  bindInput(".line-italic", "italic");
  bindInput(".line-align", "textAlign");
  bindInput(".line-line-height", "lineHeight", Number);
  bindInput(".line-shadow", "shadow");
  bindInput(".line-shadow-color", "shadowColor");
  bindInput(".line-shadow-blur", "shadowBlur", Number);
  bindInput(".line-shadow-x", "shadowOffsetX", Number);
  bindInput(".line-shadow-y", "shadowOffsetY", Number);
  bindInput(".line-offset-x", "offsetXPct", Number);
  bindInput(".line-offset-y", "offsetYPct", Number);

  div.querySelector(".remove-line-btn").addEventListener("click", () => {
    lines = lines.filter((l) => l.id !== line.id);
    div.remove();
    renderCanvas();
  });

  return div;
}

function addLine(text) {
  const line = createLineConfig(text);
  lines.push(line);
  const el = createLineElement(line);
  linesContainer.appendChild(el);
  renderCanvas();
}

addLineBtn.addEventListener("click", () => addLine("New Line"));

canvasWidthEl.addEventListener("change", renderCanvas);
canvasHeightEl.addEventListener("change", renderCanvas);
marginTopEl.addEventListener("input", renderCanvas);
marginBottomEl.addEventListener("input", renderCanvas);
marginLeftEl.addEventListener("input", renderCanvas);
marginRightEl.addEventListener("input", renderCanvas);

downloadBtn.addEventListener("click", async () => {
  await renderCanvas();
  const link = document.createElement("a");
  link.download = filenameInput.value || "text_transparent.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

window.addEventListener("resize", renderCanvas);

// --- Bulk generation from JSON ---------------------------------------------

const bulkToggle = document.getElementById("bulkToggle");
const bulkPanel = document.getElementById("bulkPanel");
const bulkToggleIcon = document.getElementById("bulkToggleIcon");
const bulkJsonInput = document.getElementById("bulkJsonInput");
const bulkFieldsSection = document.getElementById("bulkFieldsSection");
const bulkFieldsEl = document.getElementById("bulkFields");
const bulkFilenamePatternEl = document.getElementById("bulkFilenamePattern");
const bulkGenerateBtn = document.getElementById("bulkGenerateBtn");
const bulkStatus = document.getElementById("bulkStatus");

let bulkRecords = [];

bulkToggle.addEventListener("click", () => {
  const hidden = bulkPanel.classList.toggle("hidden");
  bulkToggleIcon.textContent = hidden ? "▼" : "▲";
});

function fillTemplate(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : `{${k}}`,
  );
}

// Substitute {fieldName} placeholders in text using a JSON record. Missing
// or null fields collapse to "". Non-string values are stringified.
function substitutePlaceholders(text, record) {
  return text.replace(/\{([^}\s]+)\}/g, (_, key) => {
    if (!Object.prototype.hasOwnProperty.call(record, key)) return "";
    const val = record[key];
    if (val == null) return "";
    return String(val);
  });
}

function sanitizeFilename(name) {
  const cleaned = name
    .replace(/[\\/:*?"<>|\n\r\t]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 200);
  return cleaned || "untitled";
}

function detectFields(records) {
  const keys = new Set();
  for (const r of records) {
    if (r && typeof r === "object" && !Array.isArray(r)) {
      for (const k of Object.keys(r)) keys.add(k);
    }
  }
  return [...keys];
}

function renderFieldChips(fields) {
  bulkFieldsEl.innerHTML = fields
    .map(
      (f) =>
        `<button type="button" class="bulk-field-chip px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-xs rounded border border-gray-300 font-mono" data-field="${f}">{${f}}</button>`,
    )
    .join("");
  bulkFieldsEl.querySelectorAll(".bulk-field-chip").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const placeholder = `{${btn.dataset.field}}`;
      try {
        await navigator.clipboard.writeText(placeholder);
        bulkStatus.textContent = fillTemplate(
          languageService.translate("textToPngBulkCopied"),
          { placeholder },
        );
      } catch {
        bulkStatus.textContent = placeholder;
      }
    });
  });
}

bulkJsonInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  bulkStatus.textContent = "";
  try {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      bulkStatus.textContent = fillTemplate(
        languageService.translate("textToPngBulkInvalidJson"),
        { msg: err.message },
      );
      bulkGenerateBtn.disabled = true;
      return;
    }
    if (!Array.isArray(parsed)) {
      bulkStatus.textContent = languageService.translate(
        "textToPngBulkNeedArray",
      );
      bulkGenerateBtn.disabled = true;
      return;
    }
    bulkRecords = parsed.filter(
      (r) => r && typeof r === "object" && !Array.isArray(r),
    );
    if (bulkRecords.length === 0) {
      bulkStatus.textContent = languageService.translate(
        "textToPngBulkNoRecords",
      );
      bulkGenerateBtn.disabled = true;
      return;
    }
    const fields = detectFields(bulkRecords);
    renderFieldChips(fields);
    bulkFieldsSection.classList.remove("hidden");
    bulkGenerateBtn.disabled = false;
    bulkStatus.textContent = fillTemplate(
      languageService.translate("textToPngBulkLoaded"),
      { n: bulkRecords.length },
    );
  } catch (err) {
    bulkStatus.textContent = fillTemplate(
      languageService.translate("textToPngBulkInvalidJson"),
      { msg: err.message },
    );
    bulkGenerateBtn.disabled = true;
  }
});

bulkGenerateBtn.addEventListener("click", async () => {
  if (bulkRecords.length === 0) return;
  bulkGenerateBtn.disabled = true;
  const originalLines = lines;
  const pattern = bulkFilenamePattern();
  const zip = new JSZip();
  const usedNames = new Set();

  await ensureFontsLoaded();

  try {
    for (let i = 0; i < bulkRecords.length; i++) {
      const record = bulkRecords[i];
      bulkStatus.textContent = fillTemplate(
        languageService.translate("textToPngBulkProgress"),
        { i: i + 1, n: bulkRecords.length },
      );

      lines = originalLines.map((l) => ({
        ...l,
        text: substitutePlaceholders(l.text, record),
      }));
      renderCanvasSync();

      let filename = sanitizeFilename(substitutePlaceholders(pattern, record));
      if (!/\.png$/i.test(filename)) filename += ".png";

      let unique = filename;
      let n = 1;
      while (usedNames.has(unique)) {
        const base = filename.replace(/\.png$/i, "");
        unique = `${base}_${n}.png`;
        n++;
      }
      usedNames.add(unique);

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (blob) zip.file(unique, blob);

      // Yield so the status text repaints.
      await new Promise((r) => setTimeout(r, 0));
    }

    bulkStatus.textContent = languageService.translate("textToPngBulkZipping");
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.download = "text-to-png-bulk.zip";
    link.href = URL.createObjectURL(zipBlob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    bulkStatus.textContent = fillTemplate(
      languageService.translate("textToPngBulkDone"),
      { n: bulkRecords.length },
    );
  } catch (err) {
    bulkStatus.textContent = `Error: ${err.message}`;
  } finally {
    lines = originalLines;
    renderCanvasSync();
    bulkGenerateBtn.disabled = false;
  }
});

function bulkFilenamePattern() {
  const v = bulkFilenamePatternEl.value.trim();
  return v || "{numer_katalogowy}_{autor_nazwisko_imie}_transparent.png";
}

addLine("Sample Text");
