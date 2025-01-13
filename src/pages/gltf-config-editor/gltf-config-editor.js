import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import Sortable from "sortablejs";
import Quill from "quill";
import { languageService } from "../../services/languageService.js";

const fileInput = document.getElementById("fileInput");
const fileDropArea = document.getElementById("fileDropArea");
const artworksList = document.getElementById("artworksList");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const jsonInput = document.getElementById("jsonInput");

const progressContainer = document.getElementById("progressContainer");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const progressStats = document.getElementById("progressStats");
const cancelLoadBtn = document.getElementById("cancelLoadBtn");

let abortController = null;

let configData = {
  exhibition: {
    id: 1,
    title: "",
    description: "",
    audio: "",
    exhibitor: "",
    exhibitorMail: "",
    logo: "",
    backgroundLoadingPhoto: "images/loading/background-photo.jpg",
    featuredPhoto: "images/loading/featured-photo.jpg",
    sourceARPage: "",
    privacyPolicyLink: "",
    aboutExhibitionTitle: "",
    aboutExhibitionDescripton: "",
    aboutExhibitionAudio: "",
  },
  artworks: [],
  movies: [],
  arModels: [],
  uiBlocks: [],
  tourpoints: [
    {
      id: 1,
      title: "loc_entry",
      positionX: 0.0,
      positionY: 0.0,
      positionZ: 0.0,
      rotationX: 0.0,
      rotationY: 0.0,
      rotationZ: 0.0,
    },
  ],
};

let quillEditors = {};

let sortableInstance = null;

let exhibitionQuillEditor = null;

let selectedLanguage = "en";

// Add this function near the top of the file, before loadGLTFFile
function extractTextureFromObject(object) {
  try {
    // Check if object has material
    if (!object.material) {
      return null;
    }

    // Handle array of materials
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    // Look for the first valid texture
    for (const material of materials) {
      // Check common texture properties
      const possibleMaps = [
        material.map,
        material.diffuseMap,
        material.albedoMap,
        material.baseColorMap,
        material.colorMap,
      ];

      for (const map of possibleMaps) {
        if (map && map.image) {
          return map.image;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn("Error extracting texture from object:", error);
    return null;
  }
}

// Update the getDataUrlFromImage function to handle errors
function getDataUrlFromImage(image) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width || 256; // Fallback size if width is not available
    canvas.height = image.height || 256; // Fallback size if height is not available
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.warn("Could not get 2D context for canvas");
      return null;
    }

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8); // Added quality parameter
  } catch (error) {
    console.warn("Error converting image to data URL:", error);
    return null;
  }
}

// Initialize sortable
function initializeSortable() {
  if (sortableInstance) {
    sortableInstance.destroy();
  }

  sortableInstance = new Sortable(artworksList, {
    animation: 150,
    handle: ".drag-handle",
    onEnd: (evt) => {
      const { oldIndex, newIndex } = evt;
      const artwork = configData.artworks.splice(oldIndex, 1)[0];
      configData.artworks.splice(newIndex, 0, artwork);
      updateArtworksList();
    },
  });
}

// Create artwork element
function createArtworkElement(artwork, index) {
  const div = document.createElement("div");
  div.className = "bg-gray-50 p-4 rounded-lg shadow";

  const defaultImage = artwork.name + ".jpg";

  div.innerHTML = `
    <div class="flex items-center gap-4">
      <div class="drag-handle cursor-move p-2 hover:bg-gray-100 rounded">
        <svg class="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path>
        </svg>
      </div>
      
      <!-- Basic Info -->
      <div class="grid grid-cols-12 gap-4 flex-1">
        <div class="col-span-3 flex items-center gap-4 relative group">
          <div>
            <label class="block text-sm font-medium text-gray-500">ID</label>
            <span class="block py-2">${index + 1}</span>
          </div>
          ${
            artwork.texturePreview
              ? `
            <div class="w-10 h-10 rounded overflow-hidden border border-gray-200">
              <img src="${artwork.texturePreview}" 
                   class="w-full h-full object-cover" 
                   alt="${artwork.name} preview">
              <div class="hidden group-hover:block absolute left-0 top-0 z-50 transform -translate-y-full">
                <div class="bg-white p-2 rounded-lg shadow-lg">
                  <img src="${artwork.texturePreview}" 
                       class="max-w-[250px] max-h-[250px] object-contain" 
                       alt="${artwork.name}">
                </div>
              </div>
            </div>
          `
              : `
              <div class="w-10 h-10 overflow-hidden rounded"></div>
              `
          }
          <div>
            <label class="block text-sm font-medium text-gray-500" data-i18n="name">Name</label>
            <span class="block w-full py-2">${artwork.name}</span>
          </div>
        </div>
        
        <div class="col-span-4">
          <label class="block text-sm font-medium text-gray-500" data-i18n="title">Title</label>
          <input type="text" value="${artwork.title}" 
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
            onchange="window.updateArtworkField(${index}, 'title', this.value)"
            placeholder="${languageService.translate("artworkTitle")}">
        </div>
        <div class="col-span-3">
          <label class="block text-sm font-medium text-gray-500" data-i18n="artist">Artist</label>
          <input type="text" value="${artwork.artist}" 
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
            onchange="window.updateArtworkField(${index}, 'artist', this.value)"
            placeholder="${languageService.translate("artworkAuthor")}">
        </div>
        <div class="col-span-2">
          <div class="flex items-center gap-1">
            <label class="block text-sm font-medium text-gray-500" data-i18n="year">Year</label>
            <div class="group relative">
              <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <div class="hidden group-hover:block absolute z-10 w-48 p-2 mt-1 text-sm bg-gray-900 text-white rounded-lg -left-20 top-full">
                ${languageService.translate("artworkYearTooltip")}
              </div>
            </div>
          </div>
                    <input type="number" value="${artwork.year}" 
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
            onchange="window.updateArtworkField(${index}, 'year', this.value)"
            placeholder="${languageService.translate("year")}"
            maxlength="4"
            min="0"
            max="9999">
        </div>
      </div>

      <!-- Expand/Collapse Button -->
      <button onclick="window.toggleArtworkDetails(${index})" 
        class="p-2 text-gray-500 hover:text-gray-500 focus:outline-none">
        <svg class="w-6 h-6 transform transition-transform artwork-expand-icon-${index}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>

    <!-- Expandable Section -->
    <div class="hidden mt-4 space-y-4 border-t pt-4 artwork-details-${index}">
      <div class="grid grid-cols-4 gap-4">
        <div>
          <div class="flex items-center gap-1">
            <label class="block text-sm font-medium text-gray-500" data-i18n="image">Image</label>
            <div class="group relative">
              <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <div class="hidden group-hover:block absolute z-10 w-64 p-2 mt-1 text-sm bg-gray-900 text-white rounded-lg -left-24 top-full">
                ${languageService.translate("artworkImageTooltip")}
              </div>
            </div>
          </div>
          <input type="text" value="${artwork.image || defaultImage}" 
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
            onchange="window.updateArtworkField(${index}, 'image', this.value)"
            placeholder="${languageService.translate("image")}">
        </div>
        <div>
          <div class="flex items-center gap-1">
            <label class="block text-sm font-medium text-gray-500" data-i18n="audio">Audio</label>
            <div class="group relative">
              <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              <div class="hidden group-hover:block absolute z-10 w-64 p-2 mt-1 text-sm bg-gray-900 text-white rounded-lg -left-24 top-full">
                ${languageService.translate("artworkAudioTooltip")}
              </div>
            </div>
          </div>
          <input type="text" value="${artwork.audio || ""}" 
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2 bg-white"
            onchange="window.updateArtworkField(${index}, 'audio', this.value)"
            placeholder="${languageService.translate("audio")}">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-500" data-i18n="type">Type</label>
          <select
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5 bg-white"
            onchange="window.updateArtworkField(${index}, 'type', this.value)">
            <option value="painting" ${
              artwork.type === "painting" ? "selected" : ""
            }>${languageService.translate("painting")}</option>
            <option value="sculpture" ${
              artwork.type === "sculpture" ? "selected" : ""
            }>${languageService.translate("sculpture")}</option>
            <option value="movie" ${
              artwork.type === "movie" ? "selected" : ""
            }>${languageService.translate("movie")}</option>
          </select>
        </div>
        <div class="pt-3 px-3 gap-4">
            <label class="inline-flex items-center mb-2">
              <input type="checkbox" 
                class="w-5 h-5 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                ${artwork.showInfoBox ? "checked" : ""}
                onchange="window.updateArtworkField(${index}, 'showInfoBox', this.checked)">
              <span class="ml-3 text-gray-700" data-i18n="showInfoBox">Show Info Box</span>
            </label>
            <label class="inline-flex items-center">
              <input type="checkbox" 
                class="w-5 h-5 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                ${artwork.showInObjectList ? "checked" : ""}
                onchange="window.updateArtworkField(${index}, 'showInObjectList', this.checked)">
              <span class="ml-3 text-gray-700" data-i18n="showInObjectList">Show In Object List</span>
            </label>
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-500 mb-2" data-i18n="description">Description</label>
        <div class="border rounded-md bg-white border-gray-300 overflow-hidden">
          <div id="editor-${index}">
            ${artwork.description || ""}
          </div>
        </div>
      </div>
    </div>
  `;

  return div;
}

// Update artworks list
function updateArtworksList() {
  // Clean up existing Quill editors
  Object.values(quillEditors).forEach((editor) => {
    if (editor) {
      const container = editor.container.parentNode;
      if (container) {
        container.innerHTML = "";
      }
    }
  });
  quillEditors = {};

  artworksList.innerHTML = "";
  configData.artworks.forEach((artwork, index) => {
    artworksList.appendChild(createArtworkElement(artwork, index));

    // Initialize Quill editor for this artwork
    const editorContainer = document.querySelector(`#editor-${index}`);
    if (editorContainer) {
      const quill = new Quill(editorContainer, {
        theme: "snow",
        modules: {
          toolbar: [
            ["bold", "italic", "underline"],
            [{ align: [] }],
            ["clean"],
          ],
        },
      });

      // Set initial content
      quill.root.innerHTML = artwork.description || "";

      // Update configData when content changes
      quill.on("text-change", () => {
        configData.artworks[index].description = quill.root.innerHTML;
      });

      quillEditors[index] = quill;
    }
  });

  // Apply translations to all elements with data-i18n attributes
  artworksList.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (element.tagName === "INPUT") {
      element.placeholder = languageService.translate(key);
    } else {
      element.textContent = languageService.translate(key);
    }
  });

  // Update tooltips
  artworksList.querySelectorAll(".group .hidden").forEach((tooltip) => {
    const key = tooltip.getAttribute("data-i18n");
    if (key) {
      tooltip.textContent = languageService.translate(key);
    }
  });

  exportBtn.disabled = configData.artworks.length === 0;
}

// Add this function to update progress
function updateProgress(current, total) {
  const percent = Math.round((current / total) * 100);
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;
  progressStats.textContent = `${current}/${total} objects`;
}

// Update the loadGLTFFile function
async function loadGLTFFile(file) {
  const loader = new GLTFLoader();
  const url = URL.createObjectURL(file);

  // Show progress container
  progressContainer.classList.remove("hidden");
  abortController = new AbortController();

  try {
    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        url,
        resolve,
        // Progress callback
        (event) => {
          if (event.lengthComputable) {
            updateProgress(event.loaded, event.total);
          }
        },
        reject
      );
    });

    // Count total objects that start with C_
    let totalObjects = 0;
    gltf.scene.traverse((object) => {
      if (object.name.startsWith("C_")) totalObjects++;
    });

    const artworks = [];
    let processedObjects = 0;

    // Process objects and update progress
    for (const object of getAllObjects(gltf.scene)) {
      if (abortController.signal.aborted) {
        throw new Error("Operation cancelled by user");
      }

      if (object.name.startsWith("C_")) {
        const textureImage = extractTextureFromObject(object);
        const textureDataUrl = textureImage
          ? getDataUrlFromImage(textureImage)
          : null;

        artworks.push({
          id: configData.artworks.length + artworks.length,
          name: object.name,
          title: "",
          artist: "",
          description: "",
          year: "",
          image: object.name + ".jpg",
          texturePreview: textureDataUrl,
          type: "painting",
          showInfoBox: true,
          showInObjectList: true,
          dimensions: "",
          height: 0,
          width: 0,
          depth: 0,
          unit: "cm",
          technique: "",
          genre: "",
          tags: "",
          linkDisplayName: "",
          linkURL: "",
          AR: false,
          customModal: {
            buttonText: "",
            buttonIcon: "",
            modalTitle: "",
            modalBody: "",
          },
          price: "",
          currency: "",
          status: "",
          audio: "",
          exhibitor: "",
          exhibitorMail: "",
          creditsInfo: "",
          creditsImage: "",
          creditsImageLink: "",
          positionX: object.position.x,
          positionY: object.position.y,
          positionZ: object.position.z,
          rotationX: object.rotation.x,
          rotationY: object.rotation.y,
          rotationZ: object.rotation.z,
        });

        processedObjects++;
        updateProgress(processedObjects, totalObjects);
      }
    }

    configData.artworks = configData.artworks.concat(artworks);
    updateArtworksList();
    initializeSortable();
  } catch (error) {
    if (error.message === "Operation cancelled by user") {
      console.log("GLTF loading cancelled by user");
    } else {
      console.error("Error loading GLTF:", error);
      alert("Failed to load GLTF file");
    }
  } finally {
    // Hide progress container and cleanup
    progressContainer.classList.add("hidden");
    URL.revokeObjectURL(url);
    abortController = null;
  }
}

// Helper function to get all objects from scene
function* getAllObjects(object) {
  yield object;
  for (const child of object.children) {
    yield* getAllObjects(child);
  }
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
  const file = e.dataTransfer.files[0];
  if (file && (file.name.endsWith(".gltf") || file.name.endsWith(".glb"))) {
    loadGLTFFile(file);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) {
    loadGLTFFile(fileInput.files[0]);
  }
});

// Export functionality
exportBtn.addEventListener("click", () => {
  console.log("Exporting JSON");

  // Create a deep copy of configData
  const exportData = JSON.parse(JSON.stringify(configData));

  // Process exhibition texts
  exportData.exhibition.aboutExhibitionDescripton = addNonBreakingSpaces(
    exportData.exhibition.aboutExhibitionDescripton
  );
  exportData.exhibition.title = addNonBreakingSpaces(
    exportData.exhibition.title
  );
  exportData.exhibition.description = addNonBreakingSpaces(
    exportData.exhibition.description
  );

  // Process artworks texts
  exportData.artworks = exportData.artworks.map((artwork) => {
    const { texturePreview, ...artworkWithoutTexture } = artwork;

    // Add non-breaking spaces to artwork texts
    artworkWithoutTexture.title = addNonBreakingSpaces(
      artworkWithoutTexture.title
    );
    artworkWithoutTexture.description = addNonBreakingSpaces(
      artworkWithoutTexture.description
    );

    return artworkWithoutTexture;
  });

  const jsonString = JSON.stringify(exportData, null, 2);
  console.log("JSON String:", jsonString);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${selectedLanguage}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Import functionality
importBtn.addEventListener("click", () => jsonInput.click());

jsonInput.addEventListener("change", async () => {
  const file = jsonInput.files[0];
  if (file) {
    try {
      const text = await file.text();
      configData = JSON.parse(text);

      // Check if filename contains language code
      const languageMatch = file.name.match(/^([a-z]{2})\.json$/);
      if (languageMatch) {
        const detectedLanguage = languageMatch[1];
        selectedLanguage = detectedLanguage;
        document.getElementById("languageSelect").value = detectedLanguage;
      }

      updateArtworksList();
      initializeSortable();
      initializeExhibitionFields();
    } catch (error) {
      console.error("Error importing JSON:", error);
      alert("Failed to import JSON file");
    }
  }
});

// Global functions for artwork updates
window.updateArtworkTitle = (index, value) => {
  configData.artworks[index].title = value;
};

window.updateArtworkArtist = (index, value) => {
  configData.artworks[index].artist = value;
};

window.editArtwork = (index) => {
  // TODO: Implement detailed artwork editing modal
  console.log("Edit artwork:", configData.artworks[index]);
};

// Add these new global functions
window.updateArtworkField = (index, field, value) => {
  configData.artworks[index][field] = value;
};

window.toggleArtworkDetails = (index) => {
  const detailsSection = document.querySelector(`.artwork-details-${index}`);
  const expandIcon = document.querySelector(`.artwork-expand-icon-${index}`);

  const isExpanding = detailsSection.classList.contains("hidden");
  detailsSection.classList.toggle("hidden");
  expandIcon.classList.toggle("rotate-180");

  // Initialize Quill if the section is being shown and editor doesn't exist
  if (isExpanding) {
    if (!quillEditors[index]) {
      const editor = new Quill(`#editor-${index}`, {
        theme: "snow",
        modules: {
          toolbar: [
            ["bold", "italic", "underline"],
            [{ align: [] }],
            ["clean"],
          ],
        },
        bounds: `#editor-${index}`,
      });

      // Set minimum height for the editor area
      editor.container.querySelector(".ql-editor").style.minHeight = "100px";

      // Remove default border from Quill container
      editor.container.classList.remove("ql-container-border");

      quillEditors[index] = editor;

      // Update the configData when the editor content changes
      editor.on("text-change", () => {
        window.updateArtworkField(index, "description", editor.root.innerHTML);
      });
    }
  }
};

// Add cancel button handler
cancelLoadBtn.addEventListener("click", () => {
  if (abortController) {
    abortController.abort();
  }
});

// Initialize
initializeSortable();

function initializeExhibitionFields() {
  // Set initial values from configData
  document.getElementById("exhibitionTitle").value =
    configData.exhibition.title || "";
  document.getElementById("exhibitionDescription").value =
    configData.exhibition.description || "";
  document.getElementById("featuredPhoto").value =
    configData.exhibition.featuredPhoto || "";
  document.getElementById("backgroundLoadingPhoto").value =
    configData.exhibition.backgroundLoadingPhoto || "";
  document.getElementById("aboutExhibitionTitle").value =
    configData.exhibition.aboutExhibitionTitle || "";
  document.getElementById("aboutExhibitionAudio").value =
    configData.exhibition.aboutExhibitionAudio || "";

  // Add event listeners to update configData on change
  document.getElementById("exhibitionTitle").addEventListener("change", (e) => {
    configData.exhibition.title = e.target.value;
  });
  document
    .getElementById("exhibitionDescription")
    .addEventListener("change", (e) => {
      configData.exhibition.description = e.target.value;
    });
  document.getElementById("featuredPhoto").addEventListener("change", (e) => {
    configData.exhibition.featuredPhoto = e.target.value;
  });
  document
    .getElementById("backgroundLoadingPhoto")
    .addEventListener("change", (e) => {
      configData.exhibition.backgroundLoadingPhoto = e.target.value;
    });
  document
    .getElementById("aboutExhibitionTitle")
    .addEventListener("change", (e) => {
      configData.exhibition.aboutExhibitionTitle = e.target.value;
    });
  document
    .getElementById("aboutExhibitionAudio")
    .addEventListener("change", (e) => {
      configData.exhibition.aboutExhibitionAudio = e.target.value;
    });

  // Initialize or update Quill editor
  if (!exhibitionQuillEditor) {
    exhibitionQuillEditor = new Quill("#aboutExhibitionDescripton", {
      theme: "snow",
      modules: {
        toolbar: [["bold", "italic", "underline"], [{ align: [] }], ["clean"]],
      },
      bounds: "#aboutExhibitionDescripton",
    });

    // Set minimum height for the editor area
    exhibitionQuillEditor.container.querySelector(
      ".ql-editor"
    ).style.minHeight = "100px";

    // Remove default border from Quill container
    exhibitionQuillEditor.container.classList.remove("ql-container-border");

    // Update configData when content changes
    exhibitionQuillEditor.on("text-change", () => {
      window.updateExhibitionField(
        "aboutExhibitionDescripton",
        exhibitionQuillEditor.root.innerHTML
      );
    });
  }

  // Update Quill editor content if it exists in configData
  if (configData.exhibition.aboutExhibitionDescripton) {
    exhibitionQuillEditor.root.innerHTML =
      configData.exhibition.aboutExhibitionDescripton;
  } else {
    exhibitionQuillEditor.root.innerHTML = "";
  }
}

// Add to window object
window.updateExhibitionField = (field, value) => {
  configData.exhibition[field] = value;
};

// Call initializeExhibitionFields after the page loads
initializeExhibitionFields();

// Add new function to handle language selection
window.handleLanguageChange = (value) => {
  selectedLanguage = value;
  languageService.setLanguage(value);
  languageService.updatePageTranslations();

  // Update all artwork translations
  document.querySelectorAll(".artwork").forEach((artwork) => {
    artwork.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      if (element.tagName === "INPUT") {
        element.placeholder = languageService.translate(key);
      } else {
        element.textContent = languageService.translate(key);
      }
    });
  });
};

function addNonBreakingSpaces(text) {
  if (!text) return text;

  // Handle single Cyrillic letters
  text = text.replace(
    /(\s)([АаБбВвІіЇїЎўУуОоКкСсІіЙйЯяЕеЁёЭэЫыЮюЖжЗзХхЦцЧчШшЩщЬьЪъ])\s/g,
    "$1$2&nbsp;"
  );

  // Handle single Latin letters
  text = text.replace(
    /(\s)([aAiIuUoOwWzZyYeEbBcCdDfFgGhHjJkKlLmMnNpPqQrRsStTvVxX])\s/g,
    "$1$2&nbsp;"
  );

  // Handle numbers with units
  text = text.replace(
    /(\d+)\s+((?:см|мм|м|км|кг|г|мг|л|мл|px|pt|%|°|℃|℉|cm|mm|m|km|kg|g|mg|ml)\.?)/g,
    "$1&nbsp;$2"
  );

  return text;
}

// Add event listener for language changes
document.getElementById("languageSelect").addEventListener("change", (e) => {
  const newLanguage = e.target.value;
  selectedLanguage = newLanguage;
});

// Initialize language on page load
window.addEventListener("DOMContentLoaded", () => {
  const initialLanguage = languageService.currentLanguage;
  document.getElementById("languageSelect").value = initialLanguage;
  selectedLanguage = initialLanguage;
  languageService.updatePageTranslations();
});
