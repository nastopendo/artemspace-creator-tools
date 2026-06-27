import JSZip from "jszip";
import { languageService } from "../../services/languageService";

// ---- DOM ----
const inputEl = document.getElementById("mdInput");
const inputCountEl = document.getElementById("mdInputCount");
const fileInput = document.getElementById("mdFileInput");
const loadFileBtn = document.getElementById("mdLoadFileBtn");
const clearBtn = document.getElementById("mdClearBtn");
const maxCharsEl = document.getElementById("mdMaxChars");
const pauseH1El = document.getElementById("mdPauseH1");
const pauseH2El = document.getElementById("mdPauseH2");
const pauseH3El = document.getElementById("mdPauseH3");
const pauseSectionEl = document.getElementById("mdPauseSection");
const pauseFragmentStartEl = document.getElementById("mdPauseFragmentStart");
const pauseFragmentEl = document.getElementById("mdPauseFragment");
const upperH1El = document.getElementById("mdUpperH1");
const upperH2El = document.getElementById("mdUpperH2");
const upperH3El = document.getElementById("mdUpperH3");
const stripMarkdownEl = document.getElementById("mdStripMarkdown");
const splitBtn = document.getElementById("mdSplitBtn");
const exportBar = document.getElementById("mdExportBar");
const filenameEl = document.getElementById("mdFilename");
const downloadSingleBtn = document.getElementById("mdDownloadSingle");
const downloadZipBtn = document.getElementById("mdDownloadZip");
const downloadIndexBtn = document.getElementById("mdDownloadIndex");
const summaryEl = document.getElementById("mdSummary");
const resultsEl = document.getElementById("mdResults");

// Localized placeholder (languageService only handles textContent)
const phKey = inputEl.getAttribute("data-i18n-placeholder");
if (phKey) inputEl.placeholder = languageService.translate(phKey);

// ---- State ----
let fragments = []; // array of strings (the rendered chunk text)

const t = (key) => languageService.translate(key);
const fillTemplate = (template, params) =>
  template.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : `{${k}}`
  );

// ---- Markdown helpers ----
function stripInline(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function stripMarkdownText(s) {
  return stripInline(s.replace(/^#{1,6}[ \t]+/gm, ""));
}

// ---- Parse into segments (heading + body up to next # / ##) ----
function parseSegments(text) {
  const lines = text.split(/\r?\n/);
  const segs = [];
  let cur = { level: 0, heading: null, bodyLines: [] };
  const hasContent = (s) => s.heading || s.bodyLines.some((l) => l.trim());

  for (const line of lines) {
    const m = line.match(/^(#{1,3})[ \t]+/);
    if (m) {
      if (hasContent(cur)) segs.push(cur);
      cur = { level: m[1].length, heading: line, bodyLines: [] };
    } else {
      cur.bodyLines.push(line);
    }
  }
  if (hasContent(cur)) segs.push(cur);

  return segs.map((s) => ({
    level: s.level,
    heading: s.heading,
    body: s.bodyLines.join("\n"),
  }));
}

// ---- Group segments so a heading without its own body stays glued to the
// following segment(s). Keeps a chapter/subchapter/section run (e.g. # -> ## ->
// ### + text) together as one indivisible packing unit. ----
function groupSegments(segments) {
  const groups = [];
  let pending = [];
  for (const seg of segments) {
    const isEmptyHeading = seg.heading && !seg.body.trim();
    if (isEmptyHeading) {
      pending.push(seg);
    } else {
      groups.push([...pending, seg]);
      pending = [];
    }
  }
  if (pending.length) groups.push(pending); // trailing headings with no content
  return groups;
}

// ---- Plain chapter label (heading text without the leading # markers) ----
function chapterTitle(heading) {
  const m = heading.match(/^#{1,3}[ \t]+(.*)$/);
  return (m ? m[1] : heading).trim();
}

// ---- Render a single segment to text given options ----
function renderSegment(seg, opts) {
  const parts = [];

  if (seg.heading) {
    const m = seg.heading.match(/^(#{1,3})[ \t]+(.*)$/);
    const prefix = m[1];
    const level = prefix.length;
    let title = m[2];
    if (opts.uppercase[level]) title = title.toLocaleUpperCase();
    if (opts.stripMarkdown) {
      parts.push(stripInline(title).trim());
    } else {
      parts.push(`${prefix} ${title}`);
    }
    if (opts.pauseAfter[level]) parts.push("[pause]");
  }

  let body = seg.body;
  if (opts.stripMarkdown) body = stripMarkdownText(body);
  body = body.replace(/\n{3,}/g, "\n\n").trim();
  if (body) parts.push(body);

  if (opts.pauseEndSection) parts.push("[pause]");

  return parts.join("\n\n");
}

// ---- Collapse runs of adjacent [pause] into one ----
function dedupePauses(text) {
  return text.replace(/\[pause\](\s*\[pause\])+/g, "[pause]");
}

// ---- Hard split a single oversized segment ----
function splitLongParagraph(p, limit) {
  const sentences = p.match(/[^.!?]+[.!?]*\s*/g) || [p];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if (s.length > limit) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      for (let i = 0; i < s.length; i += limit) out.push(s.slice(i, i + limit));
      continue;
    }
    if (cur && cur.length + s.length > limit) {
      out.push(cur);
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function hardSplit(text, limit) {
  const paras = text.split(/\n{2,}/);
  const out = [];
  let cur = "";
  for (const p of paras) {
    if (p.length > limit) {
      if (cur) {
        out.push(cur);
        cur = "";
      }
      out.push(...splitLongParagraph(p, limit));
      continue;
    }
    const sep = cur ? 2 : 0;
    if (cur && cur.length + sep + p.length > limit) {
      out.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// ---- Core: split text into fragments ----
function splitText(text, max, opts) {
  const segments = parseSegments(text);
  const groups = groupSegments(segments);
  let currentChapter = null; // most recent # (level 1) title; null before first chapter
  const rendered = groups
    .map((g) => {
      if (g[0].level === 1) currentChapter = chapterTitle(g[0].heading);
      return {
        text: g.map((s) => renderSegment(s, opts)).join("\n\n"),
        startLevel: g[0].level, // 0 = preamble, 1 = #, 2 = ##, 3 = ###
        chapter: currentChapter,
      };
    })
    .filter((r) => r.text.trim());

  const SEP = "\n\n";
  const startPause = opts.pauseStartFragment ? "[pause]\n\n" : "";
  const endPause = opts.pauseEndFragment ? "\n\n[pause]" : "";
  const reserve = startPause.length + endPause.length;

  const chunks = []; // array of { parts: string[], chapter }
  let parts = [];
  let partsLen = 0;
  let chapter = null;
  const flush = () => {
    if (parts.length) {
      chunks.push({ parts, chapter });
      parts = [];
      partsLen = 0;
    }
  };

  for (const g of rendered) {
    // Every new chapter (#) always starts a new fragment
    if (g.startLevel === 1 && parts.length) {
      flush();
    }
    // Oversized group -> hard split into standalone chunks
    if (g.text.length + reserve > max) {
      flush();
      for (const piece of hardSplit(g.text, Math.max(1, max - reserve))) {
        chunks.push({ parts: [piece], chapter: g.chapter });
      }
      continue;
    }
    const sepLen = parts.length ? SEP.length : 0;
    if (parts.length && partsLen + sepLen + g.text.length + reserve > max) {
      flush();
    }
    if (!parts.length) chapter = g.chapter; // first group sets the chunk's chapter
    const sepLen2 = parts.length ? SEP.length : 0;
    parts.push(g.text);
    partsLen += sepLen2 + g.text.length;
  }
  flush();

  return chunks.map((chunk) => {
    let text = chunk.parts.join(SEP);
    if (opts.pauseStartFragment) text = `[pause]\n\n${text}`;
    if (opts.pauseEndFragment) text += "\n\n[pause]";
    return { text: dedupePauses(text).trim(), chapter: chunk.chapter };
  });
}

// ---- Render result cards ----
function renderResults() {
  resultsEl.innerHTML = "";
  const max = getMax();

  if (!fragments.length) {
    exportBar.classList.add("hidden");
    exportBar.classList.remove("flex");
    const empty = document.createElement("p");
    empty.className = "text-center text-gray-500 py-6";
    empty.textContent = t("mdSplitterEmpty");
    resultsEl.appendChild(empty);
    return;
  }

  exportBar.classList.remove("hidden");
  exportBar.classList.add("flex");

  let lastChapter;
  fragments.forEach((frag, i) => {
    // Chapter divider whenever the chapter changes
    if (i === 0 || frag.chapter !== lastChapter) {
      lastChapter = frag.chapter;
      const divider = document.createElement("h2");
      divider.className =
        "text-lg font-bold text-gray-700 border-b-2 border-blue-400 pb-1 pt-4";
      divider.textContent = frag.chapter
        ? `📖 ${frag.chapter}`
        : t("mdSplitterPreamble");
      resultsEl.appendChild(divider);
    }

    const card = document.createElement("div");
    card.className =
      "bg-white rounded-lg shadow-md p-4 space-y-3 border-l-4 border-blue-300";

    const header = document.createElement("div");
    header.className = "flex items-center justify-between gap-2";

    const title = document.createElement("h3");
    title.className = "font-semibold text-gray-800";
    title.textContent = `${t("mdSplitterFragment")} ${i + 1}`;

    const right = document.createElement("div");
    right.className = "flex items-center gap-2";

    const badge = document.createElement("span");
    badge.className = "text-sm font-mono px-2 py-1 rounded";
    setBadge(badge, frag.text.length, max);

    const copyBtn = document.createElement("button");
    copyBtn.className =
      "px-3 py-1.5 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600";
    copyBtn.textContent = t("mdSplitterCopy");
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(fragments[i].text);
        copyBtn.textContent = t("mdSplitterCopied");
        setTimeout(() => (copyBtn.textContent = t("mdSplitterCopy")), 1500);
      } catch {
        /* clipboard unavailable */
      }
    });

    right.append(badge, copyBtn);
    header.append(title, right);

    const textarea = document.createElement("textarea");
    textarea.className =
      "w-full p-3 border border-gray-300 rounded-md font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none";
    textarea.rows = Math.min(16, Math.max(4, frag.text.split("\n").length + 1));
    textarea.value = frag.text;
    textarea.addEventListener("input", () => {
      fragments[i].text = textarea.value;
      setBadge(badge, textarea.value.length, max);
      updateSummary();
    });

    card.append(header, textarea);
    resultsEl.appendChild(card);
  });

  updateSummary();
}

function setBadge(badge, len, max) {
  badge.textContent = `${len} / ${max}`;
  if (len > max) {
    badge.classList.add("bg-red-100", "text-red-700");
    badge.classList.remove("bg-gray-100", "text-gray-600");
  } else {
    badge.classList.add("bg-gray-100", "text-gray-600");
    badge.classList.remove("bg-red-100", "text-red-700");
  }
}

function updateSummary() {
  const total = fragments.reduce((sum, f) => sum + f.text.length, 0);
  summaryEl.textContent = fillTemplate(t("mdSplitterSummary"), {
    count: fragments.length,
    chars: total,
  });
}

// ---- Option / input helpers ----
function getMax() {
  const v = parseInt(maxCharsEl.value, 10);
  return Number.isFinite(v) && v > 0 ? v : 5000;
}

function getOptions() {
  return {
    pauseAfter: {
      1: pauseH1El.checked,
      2: pauseH2El.checked,
      3: pauseH3El.checked,
    },
    pauseEndSection: pauseSectionEl.checked,
    pauseStartFragment: pauseFragmentStartEl.checked,
    pauseEndFragment: pauseFragmentEl.checked,
    uppercase: {
      1: upperH1El.checked,
      2: upperH2El.checked,
      3: upperH3El.checked,
    },
    stripMarkdown: stripMarkdownEl.checked,
  };
}

function updateInputCount() {
  inputCountEl.textContent = String(inputEl.value.length);
}

// ---- Export ----
function buildBaseName() {
  return (filenameEl.value || "fragments").replace(/[^\w\-]+/g, "_") || "fragments";
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function downloadSingle() {
  if (!fragments.length) return;
  const out = [];
  let lastChapter;
  fragments.forEach((frag, i) => {
    if (i === 0 || frag.chapter !== lastChapter) {
      lastChapter = frag.chapter;
      out.push(
        fillTemplate(t("mdSplitterFileChapter"), {
          chapter: frag.chapter || t("mdSplitterPreamble"),
        })
      );
    }
    const header = fillTemplate(t("mdSplitterFileSeparator"), {
      n: i + 1,
      chars: frag.text.length,
    });
    out.push(`${header}\n\n${frag.text}`);
  });
  const blob = new Blob([out.join("\n\n\n")], {
    type: "text/plain;charset=utf-8",
  });
  downloadBlob(blob, `${buildBaseName()}.txt`);
}

async function downloadZip() {
  if (!fragments.length) return;
  const zip = new JSZip();
  const pad = String(fragments.length).length;
  fragments.forEach((frag, i) => {
    const num = String(i + 1).padStart(pad, "0");
    zip.file(`fragment-${num}.txt`, frag.text);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${buildBaseName()}.zip`);
}

// Index file: chapter names + the fragment numbers they contain (no text)
function downloadIndex() {
  if (!fragments.length) return;
  const lines = [t("mdSplitterIndexTitle"), ""];
  let runChapter = fragments[0].chapter;
  let nums = [];
  const flushLine = () => {
    if (!nums.length) return;
    const name = runChapter || t("mdSplitterPreamble");
    lines.push(`${name}: ${nums.join(", ")}`);
    nums = [];
  };
  fragments.forEach((frag, i) => {
    if (frag.chapter !== runChapter) {
      flushLine();
      runChapter = frag.chapter;
    }
    nums.push(i + 1);
  });
  flushLine();
  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  downloadBlob(blob, `${buildBaseName()}-index.txt`);
}

// ---- File loading ----
async function loadFile(file) {
  if (!file) return;
  inputEl.value = await file.text();
  updateInputCount();
}

// ---- Events ----
inputEl.addEventListener("input", updateInputCount);

loadFileBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));

inputEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  inputEl.classList.add("border-blue-500", "bg-blue-50");
});
inputEl.addEventListener("dragleave", () => {
  inputEl.classList.remove("border-blue-500", "bg-blue-50");
});
inputEl.addEventListener("drop", (e) => {
  e.preventDefault();
  inputEl.classList.remove("border-blue-500", "bg-blue-50");
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

clearBtn.addEventListener("click", () => {
  inputEl.value = "";
  fragments = [];
  updateInputCount();
  renderResults();
});

splitBtn.addEventListener("click", () => {
  const text = inputEl.value;
  if (!text.trim()) {
    fragments = [];
    renderResults();
    return;
  }
  fragments = splitText(text, getMax(), getOptions());
  renderResults();
});

downloadSingleBtn.addEventListener("click", downloadSingle);
downloadZipBtn.addEventListener("click", downloadZip);
downloadIndexBtn.addEventListener("click", downloadIndex);

// ---- Init ----
updateInputCount();
renderResults();
