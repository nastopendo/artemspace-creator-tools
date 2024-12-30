import JSZip from "jszip";
import Sortable from "sortablejs";

const fileInput = document.getElementById("fileInput");
const fileDropArea = document.getElementById("fileDropArea");
const imageGallery = document.getElementById("imageGallery");
const gridViewBtn = document.getElementById("gridViewBtn");
const listViewBtn = document.getElementById("listViewBtn");
const gridDensity = document.getElementById("gridDensity");
const exportBtn = document.getElementById("exportBtn");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const dragInstructions = document.getElementById("dragInstructions");
const closeTip = document.getElementById("closeTip");

let images = [];
let isGridView = true;
let sortableInstance = null;

// Initialize the gallery
function initializeGallery() {
  const columns = gridDensity.value;

  // Remove any existing grid-cols classes
  imageGallery.classList.remove(
    "grid-cols-3",
    "grid-cols-4",
    "grid-cols-5",
    "grid-cols-6",
    "grid-cols-7",
    "grid-cols-8",
    "grid-cols-9",
    "grid-cols-10",

    "md:grid-cols-3",
    "md:grid-cols-4",
    "md:grid-cols-5",
    "md:grid-cols-6",
    "md:grid-cols-7",
    "md:grid-cols-8",
    "md:grid-cols-9",
    "md:grid-cols-10"
  );

  imageGallery.className = isGridView
    ? `mt-8 grid gap-4 grid-cols-2 md:grid-cols-${columns}`
    : "mt-8 space-y-4";

  // Destroy existing Sortable instance if it exists
  if (sortableInstance) {
    sortableInstance.destroy();
  }

  // Initialize Sortable
  sortableInstance = new Sortable(imageGallery, {
    animation: 150,
    ghostClass: "opacity-50",
    onEnd: (evt) => {
      const { oldIndex, newIndex } = evt;
      if (oldIndex !== newIndex) {
        const element = images[oldIndex];
        images.splice(oldIndex, 1);
        images.splice(newIndex, 0, element);
        renderImages();
      }
    },
  });
}

// Create image element
function createImageElement(file, index) {
  const container = document.createElement("div");
  container.className = isGridView
    ? "relative group bg-gray-100 rounded-lg overflow-hidden cursor-move"
    : "flex items-center gap-4 p-2 bg-gray-100 rounded-lg cursor-move";

  const imgWrapper = document.createElement("div");
  imgWrapper.className = isGridView ? "aspect-square" : "";

  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  img.className = isGridView
    ? "w-full h-full object-cover"
    : "w-20 h-20 object-cover rounded";

  if (isGridView) {
    imgWrapper.appendChild(img);
  }

  const details = document.createElement("div");
  details.className = isGridView
    ? "absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity"
    : "flex-1";

  // Create separate elements for order number and filename
  const orderNumber = document.createElement("p");
  orderNumber.className = `text-sm ${
    isGridView ? "text-white" : "text-gray-800"
  }`;
  orderNumber.textContent = `#${index + 1}`;

  const fileName = document.createElement("p");
  fileName.className = `truncate text-sm ${
    isGridView ? "text-white" : "text-gray-800"
  }`;
  fileName.textContent = file.name;

  details.appendChild(orderNumber);
  details.appendChild(fileName);

  if (isGridView) {
    container.appendChild(imgWrapper);
    container.appendChild(details);
  } else {
    container.appendChild(img);
    container.appendChild(details);
  }

  return container;
}

// Render all images
function renderImages() {
  imageGallery.innerHTML = "";
  images.forEach((file, index) => {
    imageGallery.appendChild(createImageElement(file, index));
  });
}

// Update gallery view
function updateGalleryView() {
  initializeGallery();
  renderImages();
}

// File input handlers
fileDropArea.addEventListener("click", () => fileInput.click());

fileDropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileDropArea.classList.add("border-blue-500", "bg-blue-50");
});

fileDropArea.addEventListener("dragleave", () => {
  fileDropArea.classList.remove("border-blue-500", "bg-blue-50");
});

fileDropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  fileDropArea.classList.remove("border-blue-500", "bg-blue-50");
  fileInput.files = e.dataTransfer.files;
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
});

function showDragInstructions() {
  // Check if user has previously dismissed the tip
  const tipDismissed = localStorage.getItem("dragTipDismissed");
  if (!tipDismissed && images.length > 0) {
    dragInstructions.style.display = "block";
  }
}

// Add event listener for the close button
closeTip.addEventListener("click", () => {
  dragInstructions.style.display = "none";
  localStorage.setItem("dragTipDismissed", "true");
});

function handleFiles(files) {
  images = Array.from(files)
    .filter((file) => file.type.startsWith("image/"))
    .sort((a, b) => a.name.localeCompare(b.name));

  exportBtn.disabled = images.length === 0;

  // Show drag instructions only if not previously dismissed
  showDragInstructions();

  renderImages();
}

// View controls
gridViewBtn.addEventListener("click", () => {
  isGridView = true;
  gridViewBtn.classList.replace("bg-gray-500", "bg-blue-500");
  listViewBtn.classList.replace("bg-blue-500", "bg-gray-500");
  updateGalleryView();
});

listViewBtn.addEventListener("click", () => {
  isGridView = false;
  listViewBtn.classList.replace("bg-gray-500", "bg-blue-500");
  gridViewBtn.classList.replace("bg-blue-500", "bg-gray-500");
  updateGalleryView();
});

gridDensity.addEventListener("input", () => {
  if (isGridView) {
    updateGalleryView();
  }
});

// Export functionality
exportBtn.addEventListener("click", async () => {
  const prefix = document.getElementById("prefixInput").value || "";
  const suffix = document.getElementById("suffixInput").value || "";
  const digits = parseInt(document.getElementById("digitsInput").value) || 3;

  progressContainer.classList.remove("hidden");
  progressContainer.classList.add("flex");
  exportBtn.disabled = true;

  const zip = new JSZip();

  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    const number = String(i + 1).padStart(digits, "0");
    const extension = file.name.split(".").pop();
    const newFilename = `${prefix}${number}${suffix}.${extension}`;

    zip.file(newFilename, file);

    const progress = Math.round(((i + 1) / images.length) * 100);
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
  }

  try {
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "organized_images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating ZIP:", error);
    alert("Failed to generate the ZIP file.");
  } finally {
    exportBtn.disabled = false;
    progressContainer.classList.remove("flex");
    progressContainer.classList.add("hidden");
  }
});

// Initialize
initializeGallery();

function safelist() {
  // This function is never called, it's just to make sure
  // Tailwind includes these classes in the build
  const classes = `
     grid-cols-3 grid-cols-4 grid-cols-5 grid-cols-6 grid-cols-7 grid-cols-8 grid-cols-9 grid-cols-10
     md:grid-cols-3 md:grid-cols-4 md:grid-cols-5 md:grid-cols-6 md:grid-cols-7 md:grid-cols-8 md:grid-cols-9 md:grid-cols-10
  `;
}
