import { languageService } from "../../services/languageService";

const FONTS = [
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

// Draw a single row of tokens at position (x, y)
function drawRow(rowTokens, x, y, line) {
  let curX = x;
  for (const token of rowTokens) {
    ctx.font = buildFont(line, token.italic);
    ctx.fillText(token.text, curX, y);
    curX += ctx.measureText(token.text).width;
  }
}

function renderCanvas() {
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
    ctx.textAlign = "left";
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

      for (const rowTokens of rows) {
        drawRow(rowTokens, mLeft + offsetX, currentY + offsetY, line);
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
  div.className =
    "border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50";
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
        <input type="number" value="${line.fontSizePct}" min="0.5" max="50" step="0.5"
          class="line-size w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngWeight">Weight</label>
        <select class="line-weight w-full p-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none">
          ${FONT_WEIGHTS.map((fw) => `<option value="${fw.value}" ${fw.value === line.fontWeight ? "selected" : ""}>${fw.label}</option>`).join("")}
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-0.5" data-i18n="textToPngColor">Color</label>
        <input type="color" value="${line.color}"
          class="line-color w-full h-[34px] border border-gray-300 rounded cursor-pointer" />
      </div>
    </div>
    <div class="grid grid-cols-4 gap-2">
      <div class="flex items-center gap-2">
        <input type="checkbox" ${line.italic ? "checked" : ""} class="line-italic" id="italic-${line.id}" />
        <label for="italic-${line.id}" class="text-sm text-gray-600" data-i18n="textToPngItalic">Italic</label>
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
  bindInput(".line-font", "fontFamily");
  bindInput(".line-size", "fontSizePct", Number);
  bindInput(".line-weight", "fontWeight");
  bindInput(".line-color", "color");
  bindInput(".line-italic", "italic");
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

downloadBtn.addEventListener("click", () => {
  renderCanvas();
  const link = document.createElement("a");
  link.download = filenameInput.value || "text_transparent.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

window.addEventListener("resize", renderCanvas);

addLine("Sample Text");
