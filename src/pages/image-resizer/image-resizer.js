import JSZip from "jszip";

const fileInput = document.getElementById("fileInput");
const fileDropArea = document.getElementById("fileDropArea");
const processBtn = document.getElementById("processBtn");
const downloadBtn = document.getElementById("downloadBtn");
const previewContainer = document.getElementById("preview");
const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const formatSelect = document.getElementById("formatSelect");

let loadedFiles = [];
let processedBlobUrl = null;

//=============================
// Drag & Drop Enhancements
//=============================
fileDropArea.addEventListener("click", () => {
  fileInput.click();
});

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
  fileInput.dispatchEvent(new Event("change"));
});

//=============================
// File Input & Preview
//=============================
fileInput.addEventListener("change", () => {
  loadedFiles = Array.from(fileInput.files);
  previewContainer.innerHTML = "";

  if (loadedFiles.length > 0) {
    loadedFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.alt = file.name;
        img.className =
          "w-full h-auto rounded-lg shadow-sm opacity-100 transition-opacity duration-500";
        previewContainer.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }
});

//=============================
// Main Processing Logic
//=============================
processBtn.addEventListener("click", async () => {
  if (!loadedFiles.length) {
    alert("Please select some images first.");
    return;
  }

  const selectedSize = parseInt(
    document.getElementById("dimensionSelect").value,
    10
  );
  const quality =
    parseInt(document.getElementById("qualityInput").value, 10) / 100;
  const outputFormat = formatSelect.value;

  if (isNaN(selectedSize) || isNaN(quality) || quality < 0.01 || quality > 1) {
    alert("Please enter valid dimension and quality values.");
    return;
  }

  processBtn.disabled = true;
  downloadBtn.disabled = true;
  progressContainer.classList.remove("hidden");
  progressContainer.classList.add("flex");
  progressBar.style.width = "0%";
  progressText.textContent = "0%";

  const zip = new JSZip();

  for (let i = 0; i < loadedFiles.length; i++) {
    const file = loadedFiles[i];
    try {
      const dataUrl = await resizeImage(
        file,
        selectedSize,
        quality,
        outputFormat
      );
      const blob = dataURLtoBlob(dataUrl);

      let newFileName = file.name;
      if (outputFormat === "jpg") {
        newFileName = changeFileExtension(file.name, "jpg");
      } else if (outputFormat === "png") {
        newFileName = changeFileExtension(file.name, "png");
      } else if (outputFormat === "webp") {
        newFileName = changeFileExtension(file.name, "webp");
      }
      zip.file(newFileName, blob);
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      alert(`Failed to process ${file.name}.`);
    }

    const progress = Math.round(((i + 1) / loadedFiles.length) * 100);
    progressBar.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
  }

  try {
    const content = await zip.generateAsync({ type: "blob" }, (metadata) => {
      const progress = Math.round(metadata.percent);
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${progress}%`;
    });
    processedBlobUrl = URL.createObjectURL(content);
    downloadBtn.disabled = false;
  } catch (error) {
    console.error("Error generating ZIP:", error);
    alert("Failed to generate the ZIP file.");
  } finally {
    processBtn.disabled = false;
    progressContainer.classList.remove("flex");
    progressContainer.classList.add("hidden");
  }
});

downloadBtn.addEventListener("click", () => {
  if (processedBlobUrl) {
    const a = document.createElement("a");
    a.href = processedBlobUrl;
    a.download = "resized_images.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
});

//=============================
// Helper Functions
//=============================
function resizeImage(file, maxSize, quality, outputFormat) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            const scale = maxSize / width;
            width = maxSize;
            height = Math.round(height * scale);
          }
        } else {
          if (height > maxSize) {
            const scale = maxSize / height;
            height = maxSize;
            width = Math.round(width * scale);
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        let mimeType = file.type;
        if (outputFormat === "jpg") {
          mimeType = "image/jpeg";
        } else if (outputFormat === "png") {
          mimeType = "image/png";
        } else if (outputFormat === "webp") {
          mimeType = "image/webp";
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            } else {
              reject(new Error("Canvas is empty"));
            }
          },
          mimeType,
          outputFormat === "original" ? undefined : quality
        );
      };
      img.onerror = reject;
      img.src = evt.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function changeFileExtension(filename, newExt) {
  const baseName = filename.substring(0, filename.lastIndexOf(".")) || filename;
  return `${baseName}.${newExt}`;
}
