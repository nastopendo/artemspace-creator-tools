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

  // Sort images alphabetically (they should already be sorted)
  const sortedImages = [...images];

  // Calculate how many spaces between artworks will be needed for all walls
  // We need to estimate the approximate number of artworks per wall
  let totalSpacingNeeded = 0;

  // First, calculate a rough distribution of artworks based on wall length proportion
  const totalArtworks = sortedImages.length;

  const initialDistribution = wallLengths.map((length, index) => {
    const wallProportion = availableWallSpaces[index] / totalWallSpace;
    // Calculate approximate number of artworks for this wall
    const artworkCount = Math.max(
      1,
      Math.round(totalArtworks * wallProportion)
    );
    // For each wall with artworks, we need (artworkCount - 1) spaces
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

  // Available space for artworks (after considering spaces between them)
  const availableArtworkSpace = totalWallSpace - totalSpacingNeeded;

  // Calculate proportion of each artwork
  let totalAspectRatioSpace = 0;
  sortedImages.forEach((image) => {
    // We'll standardize to landscape orientation for calculations
    const aspectRatio = image.isPortrait
      ? 1 / image.aspectRatio
      : image.aspectRatio;
    totalAspectRatioSpace += aspectRatio;
  });

  // Calculate longest dimension for all images
  let longestDimension = availableArtworkSpace / totalAspectRatioSpace;

  // Distribute images to walls based on the calculated approximation
  const distribution = distributeImagesOnWalls(
    sortedImages,
    wallLengths,
    availableWallSpaces,
    longestDimension,
    spaceBetween,
    wallMargins,
    initialDistribution
  );

  // Display results
  displayDistributionResults(distribution, wallLengths, longestDimension);

  // Update calculation results section
  longestDimensionOutput.textContent = longestDimension.toFixed(2);
  totalArtworksOutput.textContent = totalArtworks;
  calculationResults.classList.remove("hidden");

  distributionCalculated = true;
  recalculateBtn.disabled = true;
}

// Distribute images on walls proportionally and in sequential alphabetical order
function distributeImagesOnWalls(
  images,
  wallLengths,
  availableWallSpaces,
  longestDimension,
  spaceBetween,
  wallMargins,
  initialDistribution
) {
  // First, calculate how many artworks should go on each wall
  // based on wall length proportions
  const totalArtworks = images.length;
  const totalAvailableSpace = availableWallSpaces.reduce(
    (sum, space) => sum + space,
    0
  );

  // Calculate target artwork count for each wall proportionally
  const distribution = wallLengths.map((length, index) => {
    const proportion = availableWallSpaces[index] / totalAvailableSpace;
    // Calculate target number of artworks (minimum 1 if we have enough artworks)
    let targetCount = Math.max(1, Math.round(totalArtworks * proportion));

    return {
      wallNumber: index + 1,
      length,
      availableSpace: availableWallSpaces[index],
      targetCount, // How many artworks should go on this wall
      artworks: [],
      usedSpace: 0,
    };
  });

  // Adjust target counts to ensure we have exactly totalArtworks
  let currentTotal = distribution.reduce(
    (sum, wall) => sum + wall.targetCount,
    0
  );

  // If we have more slots than artworks, reduce from largest walls first
  while (currentTotal > totalArtworks) {
    // Find the wall with the most artworks
    const wallWithMost = distribution.reduce(
      (max, wall) => (wall.targetCount > max.targetCount ? wall : max),
      distribution[0]
    );

    if (wallWithMost.targetCount > 1) {
      wallWithMost.targetCount--;
      currentTotal--;
    } else {
      // Can't reduce any further
      break;
    }
  }

  // If we have fewer slots than artworks, add to largest walls first
  while (currentTotal < totalArtworks) {
    // Find the wall with the most space per artwork
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

  // Now we know how many artworks should go on each wall
  // Let's distribute them in alphabetical order
  let artworkIndex = 0;

  // Distribute artworks in order across walls
  for (let wallIndex = 0; wallIndex < distribution.length; wallIndex++) {
    const wall = distribution[wallIndex];

    for (let i = 0; i < wall.targetCount && artworkIndex < images.length; i++) {
      const image = images[artworkIndex++];

      // Calculate image width based on longest dimension
      const imageWidth = image.isPortrait
        ? longestDimension
        : longestDimension * image.aspectRatio;

      // Add spacing if not the first artwork
      if (wall.artworks.length > 0) {
        wall.usedSpace += spaceBetween;
      }

      // Add the artwork to the wall
      wall.artworks.push({
        ...image,
        width: imageWidth,
        height: image.isPortrait
          ? longestDimension * image.aspectRatio
          : longestDimension,
      });

      wall.usedSpace += imageWidth;
    }
  }

  // Adjust longest dimension if any wall is overflowing
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

  // If we need to adjust sizes to fit walls
  if (needsAdjustment) {
    const scaledLongestDimension = longestDimension * maxOverflowRatio * 0.98; // 2% safety margin

    // Clear and redistribute with new dimension
    distribution.forEach((wall) => {
      wall.artworks = [];
      wall.usedSpace = 0;
    });

    // Re-distribute with adjusted dimension
    artworkIndex = 0;

    for (let wallIndex = 0; wallIndex < distribution.length; wallIndex++) {
      const wall = distribution[wallIndex];

      for (
        let i = 0;
        i < wall.targetCount && artworkIndex < images.length;
        i++
      ) {
        const image = images[artworkIndex++];

        // Calculate image width with adjusted dimension
        const imageWidth = image.isPortrait
          ? scaledLongestDimension
          : scaledLongestDimension * image.aspectRatio;

        // Add spacing if not the first artwork
        if (wall.artworks.length > 0) {
          wall.usedSpace += spaceBetween;
        }

        // Add the artwork to the wall
        wall.artworks.push({
          ...image,
          width: imageWidth,
          height: image.isPortrait
            ? scaledLongestDimension * image.aspectRatio
            : scaledLongestDimension,
        });

        wall.usedSpace += imageWidth;
      }
    }
  }

  return distribution;
}

// Display distribution results in the UI
function displayDistributionResults(
  distribution,
  wallLengths,
  longestDimension
) {
  // Clear previous results
  wallDistributionTable.innerHTML = "";

  // Create a row for each wall
  distribution.forEach((wall) => {
    const row = document.createElement("tr");
    row.className = wall.artworks.length > 0 ? "" : "text-gray-400";

    // Wall number
    const wallNumberCell = document.createElement("td");
    wallNumberCell.className = "py-3 px-4 border-b";
    wallNumberCell.textContent = wall.wallNumber;

    // Wall length
    const wallLengthCell = document.createElement("td");
    wallLengthCell.className = "py-3 px-4 border-b";
    wallLengthCell.textContent = `${wall.length.toFixed(0)} cm`;

    // Artworks count
    const artworksCountCell = document.createElement("td");
    artworksCountCell.className = "py-3 px-4 border-b";
    artworksCountCell.textContent = wall.artworks.length;

    // First artwork
    const firstArtworkCell = document.createElement("td");
    firstArtworkCell.className = "py-3 px-4 border-b";
    firstArtworkCell.textContent =
      wall.artworks.length > 0
        ? wall.artworks[0].name
        : languageService.translate("noArtworks");

    // Last artwork
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

  // Show distribution results
  distributionResults.classList.remove("hidden");
}

// Initialize the page
initEventListeners();
