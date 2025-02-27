import { languageService } from "../../services/languageService.js";

const fileInput = document.getElementById("fileInput");
const fileDropArea = document.getElementById("fileDropArea");
const imagesList = document.getElementById("imagesList");
const imagesListContainer = document.getElementById("imagesListContainer");
const calculateBtn = document.getElementById("calculateBtn");
const recalculateBtn = document.getElementById("recalculateBtn");
const wallLengthsInput = document.getElementById("wallLengths");
const wallMarginsInput = document.getElementById("wallMargins");
const spaceBetweenInput = document.getElementById("spaceBetween");
const calculationResults = document.getElementById("calculationResults");
const distributionResults = document.getElementById("distributionResults");
const wallDistributionTable = document.getElementById("wallDistributionTable");
const longestDimensionOutput = document.getElementById("longestDimension");
const totalArtworksOutput = document.getElementById("totalArtworks");

let images = [];
let distributionCalculated = false;

// Initialize event listeners
function initEventListeners() {
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

  // Calculate distribution button
  calculateBtn.addEventListener("click", calculateDistribution);
  recalculateBtn.addEventListener("click", calculateDistribution);

  // Input change listeners for auto recalculation when distribution was already calculated
  [wallLengthsInput, wallMarginsInput, spaceBetweenInput].forEach((input) => {
    input.addEventListener("input", () => {
      if (distributionCalculated) {
        recalculateBtn.disabled = false;
      }
    });
  });
}

// Handle uploaded files
function handleFiles(files) {
  images = Array.from(files)
    .filter((file) => file.type.startsWith("image/"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file) => ({
      file,
      name: file.name,
      aspectRatio: 0,
      isPortrait: false,
      loaded: false,
    }));

  imagesList.innerHTML = "";

  if (images.length > 0) {
    imagesListContainer.classList.remove("hidden");

    // Create image elements and load image data
    let loadedCount = 0;

    images.forEach((image, index) => {
      const imgElement = createImageElement(image, index);
      imagesList.appendChild(imgElement);

      // Create an Image object to get natural dimensions
      const img = new Image();
      img.onload = () => {
        image.aspectRatio = img.naturalWidth / img.naturalHeight;
        image.isPortrait = img.naturalHeight > img.naturalWidth;
        image.loaded = true;
        loadedCount++;

        // Update the orientation info in the UI
        const orientationInfo = document.getElementById(`orientation-${index}`);
        if (orientationInfo) {
          orientationInfo.textContent = `${img.naturalWidth}×${
            img.naturalHeight
          }px (${image.isPortrait ? "Portrait" : "Landscape"})`;
        }

        // Enable calculate button when all images are loaded
        if (loadedCount === images.length) {
          calculateBtn.disabled = false;
        }
      };
      img.src = URL.createObjectURL(image.file);
    });
  } else {
    imagesListContainer.classList.add("hidden");
    calculateBtn.disabled = true;
  }

  // Reset distribution if it was calculated
  if (distributionCalculated) {
    distributionResults.classList.add("hidden");
    calculationResults.classList.add("hidden");
    distributionCalculated = false;
  }
}

// Create image element with preview
function createImageElement(image, index) {
  const container = document.createElement("div");
  container.className = "flex items-center gap-4 p-4 bg-gray-50 rounded-lg";

  // Thumbnail wrapper with hover functionality
  const imgWrapper = document.createElement("div");
  imgWrapper.className = "w-24 h-24 flex-shrink-0 relative group";

  // Thumbnail image
  const img = document.createElement("img");
  img.src = URL.createObjectURL(image.file);
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
  previewImg.alt = image.name;

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
  fileName.textContent = image.name;

  // Orientation info
  const orientationInfo = document.createElement("p");
  orientationInfo.className = "text-sm text-gray-600";
  orientationInfo.id = `orientation-${index}`;
  orientationInfo.textContent = "Loading dimensions...";

  details.append(fileName, orientationInfo);
  container.append(imgWrapper, details);

  return container;
}

// Parse wall lengths from input
function parseWallLengths() {
  const input = wallLengthsInput.value.trim();
  if (!input) return null;

  try {
    const lengths = input.split(",").map((length) => {
      const value = parseFloat(length.trim());
      if (isNaN(value) || value <= 0) throw new Error("Invalid value");
      return value;
    });

    if (lengths.length === 0) return null;
    return lengths;
  } catch (e) {
    alert(languageService.translate("invalidWallLengths"));
    return null;
  }
}

// Calculate optimal distribution of images on walls
function calculateDistribution() {
  // Get configuration values
  const wallLengths = parseWallLengths();
  const wallMargins = parseFloat(wallMarginsInput.value) || 0;
  const spaceBetween = parseFloat(spaceBetweenInput.value) || 0;

  if (!wallLengths || images.length === 0) {
    alert(languageService.translate("missingValues"));
    return;
  }

  // Make sure all images are loaded
  if (!images.every((img) => img.loaded)) {
    alert("Still loading images. Please wait...");
    return;
  }

  // Calculate available space for each wall (after margins)
  const availableWallSpaces = wallLengths.map(
    (length) => length - wallMargins * 2
  );

  // Calculate total wall space
  const totalWallSpace = availableWallSpaces.reduce(
    (sum, space) => sum + space,
    0
  );

  // Oblicz przybliżoną liczbę zdjęć na każdej ścianie na podstawie proporcji długości
  const totalArtworks = images.length;
  let totalSpacingNeeded = 0;

  const initialDistribution = wallLengths.map((length, index) => {
    const wallProportion = availableWallSpaces[index] / totalWallSpace;
    const artworkCount = Math.max(
      1,
      Math.round(totalArtworks * wallProportion)
    );
    if (artworkCount > 1) {
      totalSpacingNeeded += (artworkCount - 1) * spaceBetween;
    }
    return {
      wallNumber: index + 1,
      length: length,
      availableSpace: availableWallSpaces[index],
      approximateArtworkCount: artworkCount,
    };
  });

  // Dostępna przestrzeń na zdjęcia po uwzględnieniu odstępów
  const availableArtworkSpace = totalWallSpace - totalSpacingNeeded;

  // Oblicz sumaryczną "bazową" szerokość zdjęć przy założeniu, że najdłuższy bok = 100cm
  let totalBaseWidth = 0;
  images.forEach((image) => {
    // Dla zdjęć horyzontalnych: baseWidth = 100, dla wertykalnych: baseWidth = 100 * aspectRatio
    const baseWidth = image.isPortrait ? 100 * image.aspectRatio : 100;
    totalBaseWidth += baseWidth;
  });

  // Wyznacz skalę, która dopasuje zdjęcia do dostępnej przestrzeni
  const scaleFactor = availableArtworkSpace / totalBaseWidth;
  let longestDimension = 100 * scaleFactor;

  // Sortujemy zdjęcia – już alfabetycznie posortowane
  const sortedImages = [...images];

  // Rozdziel zdjęcia na ściany
  const distribution = distributeImagesOnWalls(
    sortedImages,
    wallLengths,
    availableWallSpaces,
    longestDimension,
    spaceBetween,
    wallMargins,
    initialDistribution
  );

  // Wyświetl wyniki
  displayDistributionResults(distribution, wallLengths, longestDimension);

  // Aktualizuj wyniki obliczeń w UI
  longestDimensionOutput.textContent = longestDimension.toFixed(2);
  totalArtworksOutput.textContent = totalArtworks;
  calculationResults.classList.remove("hidden");

  distributionCalculated = true;
  recalculateBtn.disabled = true;
}

// Rozdziel zdjęcia na ściany proporcjonalnie i alfabetycznie
function distributeImagesOnWalls(
  images,
  wallLengths,
  availableWallSpaces,
  longestDimension,
  spaceBetween,
  wallMargins,
  initialDistribution
) {
  const totalArtworks = images.length;
  const totalAvailableSpace = availableWallSpaces.reduce(
    (sum, space) => sum + space,
    0
  );

  // Wyznacz docelową liczbę zdjęć dla każdej ściany
  const distribution = wallLengths.map((length, index) => {
    const proportion = availableWallSpaces[index] / totalAvailableSpace;
    let targetCount = Math.max(1, Math.round(totalArtworks * proportion));
    return {
      wallNumber: index + 1,
      length,
      availableSpace: availableWallSpaces[index],
      targetCount,
      artworks: [],
      usedSpace: 0,
    };
  });

  // Dostosuj liczbę zdjęć tak, aby łączna liczba odpowiadała totalArtworks
  let currentTotal = distribution.reduce(
    (sum, wall) => sum + wall.targetCount,
    0
  );

  while (currentTotal > totalArtworks) {
    const wallWithMost = distribution.reduce(
      (max, wall) => (wall.targetCount > max.targetCount ? wall : max),
      distribution[0]
    );
    if (wallWithMost.targetCount > 1) {
      wallWithMost.targetCount--;
      currentTotal--;
    } else {
      break;
    }
  }

  while (currentTotal < totalArtworks) {
    const wallWithMostSpace = distribution.reduce(
      (max, wall) =>
        wall.availableSpace / (wall.targetCount + 1) >
        max.availableSpace / (max.targetCount + 1)
          ? wall
          : max,
      distribution[0]
    );
    wallWithMostSpace.targetCount++;
    currentTotal++;
  }

  // Rozdziel zdjęcia (alfabetycznie) na ściany
  let artworkIndex = 0;
  for (let wallIndex = 0; wallIndex < distribution.length; wallIndex++) {
    const wall = distribution[wallIndex];
    for (let i = 0; i < wall.targetCount && artworkIndex < images.length; i++) {
      const image = images[artworkIndex++];

      // Oblicz wymiary zdjęcia przy danym longestDimension:
      // Dla zdjęć horyzontalnych: width = longestDimension, height = longestDimension / aspectRatio
      // Dla zdjęć wertykalnych: width = longestDimension * aspectRatio, height = longestDimension
      const imageWidth = image.isPortrait
        ? longestDimension * image.aspectRatio
        : longestDimension;
      const imageHeight = image.isPortrait
        ? longestDimension
        : longestDimension / image.aspectRatio;

      if (wall.artworks.length > 0) {
        wall.usedSpace += spaceBetween;
      }

      wall.artworks.push({
        ...image,
        width: imageWidth,
        height: imageHeight,
      });

      wall.usedSpace += imageWidth;
    }
  }

  // Jeśli któraś ściana przekracza dostępne miejsce, dostosuj skalę
  let needsAdjustment = false;
  let maxOverflowRatio = 1;

  distribution.forEach((wall) => {
    if (wall.usedSpace > wall.availableSpace) {
      const ratio = wall.availableSpace / wall.usedSpace;
      if (ratio < maxOverflowRatio) {
        maxOverflowRatio = ratio;
        needsAdjustment = true;
      }
    }
  });

  if (needsAdjustment) {
    const scaledLongestDimension = longestDimension * maxOverflowRatio * 0.98; // 2% margines bezpieczeństwa

    distribution.forEach((wall) => {
      wall.artworks = [];
      wall.usedSpace = 0;
    });

    artworkIndex = 0;

    for (let wallIndex = 0; wallIndex < distribution.length; wallIndex++) {
      const wall = distribution[wallIndex];
      for (
        let i = 0;
        i < wall.targetCount && artworkIndex < images.length;
        i++
      ) {
        const image = images[artworkIndex++];

        const imageWidth = image.isPortrait
          ? scaledLongestDimension * image.aspectRatio
          : scaledLongestDimension;
        const imageHeight = image.isPortrait
          ? scaledLongestDimension
          : scaledLongestDimension / image.aspectRatio;

        if (wall.artworks.length > 0) {
          wall.usedSpace += spaceBetween;
        }

        wall.artworks.push({
          ...image,
          width: imageWidth,
          height: imageHeight,
        });

        wall.usedSpace += imageWidth;
      }
    }

    longestDimension = scaledLongestDimension;
  }

  return distribution;
}

// Display distribution results in the UI
function displayDistributionResults(
  distribution,
  wallLengths,
  longestDimension
) {
  wallDistributionTable.innerHTML = "";
  distribution.forEach((wall) => {
    const row = document.createElement("tr");
    row.className = wall.artworks.length > 0 ? "" : "text-gray-400";

    const wallNumberCell = document.createElement("td");
    wallNumberCell.className = "py-3 px-4 border-b";
    wallNumberCell.textContent = wall.wallNumber;

    const wallLengthCell = document.createElement("td");
    wallLengthCell.className = "py-3 px-4 border-b";
    wallLengthCell.textContent = `${wall.length.toFixed(0)} cm`;

    const artworksCountCell = document.createElement("td");
    artworksCountCell.className = "py-3 px-4 border-b";
    artworksCountCell.textContent = wall.artworks.length;

    const firstArtworkCell = document.createElement("td");
    firstArtworkCell.className = "py-3 px-4 border-b";
    firstArtworkCell.textContent =
      wall.artworks.length > 0
        ? wall.artworks[0].name
        : languageService.translate("noArtworks");

    const lastArtworkCell = document.createElement("td");
    lastArtworkCell.className = "py-3 px-4 border-b";
    lastArtworkCell.textContent =
      wall.artworks.length > 0
        ? wall.artworks[wall.artworks.length - 1].name
        : languageService.translate("noArtworks");

    row.append(
      wallNumberCell,
      wallLengthCell,
      artworksCountCell,
      firstArtworkCell,
      lastArtworkCell
    );
    wallDistributionTable.appendChild(row);
  });

  distributionResults.classList.remove("hidden");
}

// Initialize the page
initEventListeners();
