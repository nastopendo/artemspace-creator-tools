import { languageService } from "../../services/languageService.js";

const fileInput = document.getElementById("fileInput");
const fileDropArea = document.getElementById("fileDropArea");
const imagesList = document.getElementById("imagesList");
const exportBtn = document.getElementById("exportBtn");

let images = [];

// Create image element with dimension inputs
function createImageElement(file, index) {
  const container = document.createElement("div");
  container.className = "flex items-center gap-4 p-4 bg-gray-50 rounded-lg";

  // Thumbnail wrapper with hover functionality
  const imgWrapper = document.createElement("div");
  imgWrapper.className = "w-24 h-24 flex-shrink-0 relative group";

  // Thumbnail image
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  img.className = "w-full h-full object-contain rounded border border-gray-200";

  // Preview container
  const previewContainer = document.createElement("div");
  previewContainer.className =
    "hidden group-hover:block absolute left-0 bottom-full z-50 transform -translate-y-2";

  // Preview image wrapper
  const previewWrapper = document.createElement("div");
  previewWrapper.className = "bg-white p-2 rounded-lg shadow-lg";

  // Preview image
  const previewImg = document.createElement("img");
  previewImg.src = img.src;
  previewImg.className = "max-w-[300px] max-h-[300px] object-contain";
  previewImg.alt = file.name;

  // Assemble the preview
  previewWrapper.appendChild(previewImg);
  previewContainer.appendChild(previewWrapper);
  imgWrapper.appendChild(img);
  imgWrapper.appendChild(previewContainer);

  // Details
  const details = document.createElement("div");
  details.className = "flex-1 space-y-2";

  const fileName = document.createElement("p");
  fileName.className = "font-medium text-gray-800";
  fileName.textContent = file.name;

  // Height input
  const heightContainer = document.createElement("div");
  heightContainer.className = "flex items-center gap-2";
  const heightLabel = document.createElement("label");
  heightLabel.textContent = languageService.translate("height");
  heightLabel.className = "text-sm text-gray-600";
  const heightInput = document.createElement("input");
  heightInput.type = "number";
  heightInput.min = "0";
  heightInput.step = "0.1";
  heightInput.className = "w-24 px-2 py-1 border rounded";
  heightInput.dataset.index = index;
  heightInput.addEventListener("input", (e) => {
    images[e.target.dataset.index].height = parseFloat(e.target.value) || 0;
    updateExportButton();
  });
  heightContainer.append(heightLabel, heightInput);

  details.append(fileName, heightContainer);
  container.append(imgWrapper, details);

  return container;
}

function updateExportButton() {
  exportBtn.disabled = !images.some((img) => img.height > 0);
}

function handleFiles(files) {
  images = Array.from(files)
    .filter((file) => file.type.startsWith("image/"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file) => ({ file, height: 0 }));

  imagesList.innerHTML = "";
  images.forEach((image, index) => {
    imagesList.appendChild(createImageElement(image.file, index));
  });

  updateExportButton();
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
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  handleFiles(fileInput.files);
});

// Export functionality
exportBtn.addEventListener("click", () => {
  const exportData = images.map((img) => ({
    name: img.file.name,
    height: img.height,
  }));

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "image_dimensions.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
