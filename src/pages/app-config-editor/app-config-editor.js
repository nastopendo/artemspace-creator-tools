import { languageService } from "../../services/languageService.js";

/**
 * @type {import('./types').Config}
 */
let configData = {
  languages: {
    supported: ["en", "pl", "de"],
    default: "en",
    persist: false,
  },
  analytics: {
    googleAnalytics: {
      enabled: false,
      tagId: "UA-XXXXX-Y",
    },
    facebookPixel: {
      enabled: false,
      pixelId: "XXXXXXXXXXXXXXX",
    },
    hotjar: {
      enabled: false,
      hjid: 1234567,
      hjsv: 6,
    },
    swetrix: {
      enabled: false,
      projectId: "",
    },
  },
  modelProperties: {
    galleryModelName: "Gallery.glb",
    galleryMobileModelName: "Gallery.glb",
    galleryNavMesh: "NavMesh.glb",
    galleryCollisionMesh: "CollisionMesh.glb",
    lights: {
      AmbientLight: {
        color: "#ffffff",
        intensity: 3,
        position: [0, 1, 0],
      },
      DirectionalLight: {
        color: "none",
        intensity: 1.6,
        castShadow: true,
        position: [0, 1, 0],
        target: [0, 0, 0],
      },
      HemisphereLight: {
        skyColor: "none",
        groundColor: "#808080",
        intensity: 2,
        position: [0, 1, 0],
      },
      PointLight: [
        {
          color: "#ffffff",
          intensity: 0.4,
          distance: 100.0,
          decay: 1.0,
          position: [10, 10, 5],
        },
      ],
      SpotLight: [],
      RectAreaLight: [],
    },
    backgroundTexture: "",
    reflectionCubeTextures: [
      "images/cubemaps/0001.jpg",
      "images/cubemaps/0002.jpg",
      "images/cubemaps/0003.jpg",
      "images/cubemaps/0004.jpg",
      "images/cubemaps/0005.jpg",
      "images/cubemaps/0006.jpg",
    ],
    environmentTexture: "",
    backgroundColor: "",
    backgroundCubeTextures: [],
    fog: {
      color: "",
      near: 30.0,
      far: 40,
    },
    CameraCollisionMeshes: "",
  },
  controlProperties: {
    dampingFactor: 0.1,
    rotateSpeed: -0.4,
    dollySpeed: 0.2,
    enableZoom: false,
    enablePan: false,
    enableDamping: false,
    enableJoystick: false,
    showRingHelperTeleportAnim: true,
    showObjectListModal: true,
    showARButtonOnScreen: true,
    moveUpDown: false,
    alignPolarAngleAfterMove: false,
    alignAzimuthAngleAfterMove: false,
    arrowKeyObjectNavigation: true,
    arrowsMapping: "moverotate",
    playerHeight: 1.6,
    startPoint: [-2.74934, 0.005, 2.49],
    startAzimuthAngle: 0,
  },
  audioProperties: {
    autostartAudioEnabled: true,
    objectAudioAutoplayDesktop: true,
    objectAudioAutoplayMobile: false,
    playObjectAudioOnly: true,
    backgroundAudio: {
      path: "audio/lxst-cxtury-type-atmospheric.wav",
      loop: true,
      volume: 0.25,
      playbackRate: 0.6,
    },
    transitionAudio: {
      path: "audio/whoosh-sound-2.wav",
      loop: false,
      volume: 0.3,
      playbackRate: 1,
    },
    vrTeleportAudio: {
      path: "audio/vr-teleport-sound.wav",
      loop: false,
      volume: 1,
      playbackRate: 1,
    },
    clickAudio: {
      path: "audio/wood-tap-click.wav",
      loop: false,
      volume: 0.3,
      playbackRate: 1,
    },
  },
};

const AVAILABLE_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polish" },
  { code: "de", name: "German" },
  { code: "by", name: "Belarusian" },
  { code: "es", name: "Spanish" },
];

const ARROWS_MAPPING_OPTIONS = {
  moverotate: "Move & Rotate",
  rotate: "Rotate Only",
  move: "Move Only",
  none: "None",
};

// DOM Elements
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const jsonInput = document.getElementById("jsonInput");

// Initialize form values
function initializeForm() {
  initializeLanguageButtons();
  // Languages
  document.getElementById("supportedLanguages").value =
    configData.languages.supported.join(",");
  document.getElementById("defaultLanguage").value =
    configData.languages.default;
  document.getElementById("persistLanguage").checked =
    configData.languages.persist;

  // Analytics
  document.getElementById("gaEnabled").checked =
    configData.analytics.googleAnalytics.enabled;
  document.getElementById("gaTagId").value =
    configData.analytics.googleAnalytics.tagId;
  document.getElementById("fbEnabled").checked =
    configData.analytics.facebookPixel.enabled;
  document.getElementById("fbPixelId").value =
    configData.analytics.facebookPixel.pixelId;
  document.getElementById("hjEnabled").checked =
    configData.analytics.hotjar.enabled;
  document.getElementById("hjid").value = configData.analytics.hotjar.hjid;
  document.getElementById("hjsv").value = configData.analytics.hotjar.hjsv;
  document.getElementById("swEnabled").checked =
    configData.analytics.swetrix.enabled;
  document.getElementById("swProjectId").value =
    configData.analytics.swetrix.projectId;

  // Add event listeners for analytics fields
  document.getElementById("gaEnabled").addEventListener("change", (e) => {
    configData.analytics.googleAnalytics.enabled = e.target.checked;
  });
  document.getElementById("gaTagId").addEventListener("change", (e) => {
    configData.analytics.googleAnalytics.tagId = e.target.value;
  });
  document.getElementById("fbEnabled").addEventListener("change", (e) => {
    configData.analytics.facebookPixel.enabled = e.target.checked;
  });
  document.getElementById("fbPixelId").addEventListener("change", (e) => {
    configData.analytics.facebookPixel.pixelId = e.target.value;
  });
  document.getElementById("hjEnabled").addEventListener("change", (e) => {
    configData.analytics.hotjar.enabled = e.target.checked;
  });
  document.getElementById("hjid").addEventListener("change", (e) => {
    configData.analytics.hotjar.hjid = parseInt(e.target.value, 10);
  });
  document.getElementById("hjsv").addEventListener("change", (e) => {
    configData.analytics.hotjar.hjsv = parseInt(e.target.value, 10);
  });
  document.getElementById("swEnabled").addEventListener("change", (e) => {
    configData.analytics.swetrix.enabled = e.target.checked;
  });
  document.getElementById("swProjectId").addEventListener("change", (e) => {
    configData.analytics.swetrix.projectId = e.target.value;
  });

  // Model Properties
  document.getElementById("galleryModelName").value =
    configData.modelProperties.galleryModelName;
  document.getElementById("galleryMobileModelName").value =
    configData.modelProperties.galleryMobileModelName;
  document.getElementById("galleryNavMesh").value =
    configData.modelProperties.galleryNavMesh;
  document.getElementById("galleryCollisionMesh").value =
    configData.modelProperties.galleryCollisionMesh;

  // Add event listeners to update configData on change for model properties
  document
    .getElementById("galleryModelName")
    .addEventListener("change", (e) => {
      configData.modelProperties.galleryModelName = e.target.value;
    });
  document
    .getElementById("galleryMobileModelName")
    .addEventListener("change", (e) => {
      configData.modelProperties.galleryMobileModelName = e.target.value;
    });
  document.getElementById("galleryNavMesh").addEventListener("change", (e) => {
    configData.modelProperties.galleryNavMesh = e.target.value;
  });
  document
    .getElementById("galleryCollisionMesh")
    .addEventListener("change", (e) => {
      configData.modelProperties.galleryCollisionMesh = e.target.value;
    });

  // Initialize lights
  initializeLights();

  // Textures
  document.getElementById("backgroundTexture").value =
    configData.modelProperties.backgroundTexture;
  document.getElementById("environmentTexture").value =
    configData.modelProperties.environmentTexture;
  document.getElementById("backgroundColor").value =
    configData.modelProperties.backgroundColor;

  // Add event listeners for texture inputs
  document
    .getElementById("backgroundTexture")
    .addEventListener("change", (e) => {
      configData.modelProperties.backgroundTexture = e.target.value;
    });
  document
    .getElementById("environmentTexture")
    .addEventListener("change", (e) => {
      configData.modelProperties.environmentTexture = e.target.value;
    });
  document.getElementById("backgroundColor").addEventListener("change", (e) => {
    configData.modelProperties.backgroundColor = e.target.value;
  });

  // Initialize reflection and background textures
  initializeTextureArrays();

  // Fog
  document.getElementById("fogColor").value =
    configData.modelProperties.fog.color;
  document.getElementById("fogNear").value =
    configData.modelProperties.fog.near;
  document.getElementById("fogFar").value = configData.modelProperties.fog.far;

  // Add event listeners for fog inputs
  document.getElementById("fogColor").addEventListener("change", (e) => {
    configData.modelProperties.fog.color = e.target.value;
  });
  document.getElementById("fogNear").addEventListener("change", (e) => {
    configData.modelProperties.fog.near = parseFloat(e.target.value);
  });
  document.getElementById("fogFar").addEventListener("change", (e) => {
    configData.modelProperties.fog.far = parseFloat(e.target.value);
  });

  // Control Properties
  initializeControlProperties();

  // Add event listeners for control properties
  document.getElementById("dampingFactor").value =
    configData.controlProperties.dampingFactor;
  document.getElementById("rotateSpeed").value =
    configData.controlProperties.rotateSpeed;
  document.getElementById("dollySpeed").value =
    configData.controlProperties.dollySpeed;
  document.getElementById("playerHeight").value =
    configData.controlProperties.playerHeight;
  document.getElementById("startX").value =
    configData.controlProperties.startPoint[0];
  document.getElementById("startY").value =
    configData.controlProperties.startPoint[1];
  document.getElementById("startZ").value =
    configData.controlProperties.startPoint[2];
  document.getElementById("startAzimuthAngle").value =
    configData.controlProperties.startAzimuthAngle;
  document.getElementById("arrowsMapping").value =
    configData.controlProperties.arrowsMapping;

  // Add event listeners for control properties
  document.getElementById("dampingFactor").addEventListener("change", (e) => {
    configData.controlProperties.dampingFactor = parseFloat(e.target.value);
  });
  document.getElementById("rotateSpeed").addEventListener("change", (e) => {
    configData.controlProperties.rotateSpeed = parseFloat(e.target.value);
  });
  document.getElementById("dollySpeed").addEventListener("change", (e) => {
    configData.controlProperties.dollySpeed = parseFloat(e.target.value);
  });
  document.getElementById("playerHeight").addEventListener("change", (e) => {
    configData.controlProperties.playerHeight = parseFloat(e.target.value);
  });
  document.getElementById("startX").addEventListener("change", (e) => {
    configData.controlProperties.startPoint[0] = parseFloat(e.target.value);
  });
  document.getElementById("startY").addEventListener("change", (e) => {
    configData.controlProperties.startPoint[1] = parseFloat(e.target.value);
  });
  document.getElementById("startZ").addEventListener("change", (e) => {
    configData.controlProperties.startPoint[2] = parseFloat(e.target.value);
  });
  document
    .getElementById("startAzimuthAngle")
    .addEventListener("change", (e) => {
      configData.controlProperties.startAzimuthAngle = parseFloat(
        e.target.value
      );
    });
  document.getElementById("arrowsMapping").addEventListener("change", (e) => {
    configData.controlProperties.arrowsMapping = e.target.value;
  });

  // Audio Properties
  initializeAudioProperties();

  // Add event listeners for audio properties
  document
    .getElementById("autostartAudioEnabled")
    .addEventListener("change", (e) => {
      configData.audioProperties.autostartAudioEnabled = e.target.checked;
    });
  document
    .getElementById("objectAudioAutoplayDesktop")
    .addEventListener("change", (e) => {
      configData.audioProperties.objectAudioAutoplayDesktop = e.target.checked;
    });
  document
    .getElementById("objectAudioAutoplayMobile")
    .addEventListener("change", (e) => {
      configData.audioProperties.objectAudioAutoplayMobile = e.target.checked;
    });
  document
    .getElementById("playObjectAudioOnly")
    .addEventListener("change", (e) => {
      configData.audioProperties.playObjectAudioOnly = e.target.checked;
    });

  // Initialize audio sources
  ["background", "transition", "vrTeleport", "click"].forEach((type) => {
    const audio = configData.audioProperties[`${type}Audio`];
    document.getElementById(`${type}AudioPath`).value = audio.path;
    document.getElementById(`${type}AudioVolume`).value = audio.volume;
    document.getElementById(`${type}AudioPlaybackRate`).value =
      audio.playbackRate;
    document.getElementById(`${type}AudioLoop`).checked = audio.loop;

    // Add event listeners for audio sources
    document
      .getElementById(`${type}AudioPath`)
      .addEventListener("change", (e) => {
        configData.audioProperties[`${type}Audio`].path = e.target.value;
      });
    document
      .getElementById(`${type}AudioVolume`)
      .addEventListener("change", (e) => {
        configData.audioProperties[`${type}Audio`].volume = parseFloat(
          e.target.value
        );
      });
    document
      .getElementById(`${type}AudioPlaybackRate`)
      .addEventListener("change", (e) => {
        configData.audioProperties[`${type}Audio`].playbackRate = parseFloat(
          e.target.value
        );
      });
    document
      .getElementById(`${type}AudioLoop`)
      .addEventListener("change", (e) => {
        configData.audioProperties[`${type}Audio`].loop = e.target.checked;
      });
  });
}

function initializeLanguageButtons() {
  const buttons = document.querySelectorAll("#languageButtons button");
  const supportedLangs = configData.languages.supported;

  buttons.forEach((button) => {
    const lang = button.dataset.lang;
    const isSelected = supportedLangs.includes(lang);
    updateButtonState(button, isSelected);

    button.addEventListener("click", () => {
      const isCurrentlySelected = button.classList.contains("bg-blue-500");
      updateButtonState(button, !isCurrentlySelected);
      updateSupportedLanguages();
    });
  });

  // Initialize default language dropdown
  document.getElementById("defaultLanguage").value =
    configData.languages.default;
  document.getElementById("persistLanguage").checked =
    configData.languages.persist;

  // Add event listener for default language
  document.getElementById("defaultLanguage").addEventListener("change", (e) => {
    configData.languages.default = e.target.value;
  });

  // Add event listener for persist language
  document.getElementById("persistLanguage").addEventListener("change", (e) => {
    configData.languages.persist = e.target.checked;
  });
}

function updateButtonState(button, isSelected) {
  if (isSelected) {
    button.classList.remove("bg-white", "hover:bg-gray-50", "text-gray-700");
    button.classList.add("bg-blue-500", "text-white", "hover:bg-blue-600");
  } else {
    button.classList.remove("bg-blue-500", "text-white", "hover:bg-blue-600");
    button.classList.add("bg-white", "hover:bg-gray-50", "text-gray-700");
  }
}

function updateSupportedLanguages() {
  const selectedButtons = document.querySelectorAll(
    "#languageButtons button.bg-blue-500"
  );
  const selectedLangs = Array.from(selectedButtons).map(
    (button) => button.dataset.lang
  );
  configData.languages.supported = selectedLangs;

  // Update hidden input (if needed for compatibility)
  document.getElementById("supportedLanguages").value = selectedLangs.join(",");

  // Ensure default language is one of the supported languages
  const defaultLangSelect = document.getElementById("defaultLanguage");
  if (!selectedLangs.includes(configData.languages.default)) {
    configData.languages.default = selectedLangs[0] || "en";
    defaultLangSelect.value = configData.languages.default;
  }

  // Update default language dropdown options
  Array.from(defaultLangSelect.options).forEach((option) => {
    option.disabled = !selectedLangs.includes(option.value);
  });
}

function initializeLights() {
  const lightsContainer = document.getElementById("lightsContainer");
  lightsContainer.innerHTML = ""; // Clear existing content

  // Add light controls for each light type
  Object.entries(configData.modelProperties.lights).forEach(
    ([lightType, lightData]) => {
      if (Array.isArray(lightData)) {
        // Handle array of lights (PointLight, SpotLight, RectAreaLight)
        const lightArrayContainer = createLightArrayContainer(
          lightType,
          lightData
        );
        lightsContainer.appendChild(lightArrayContainer);
      } else {
        // Handle single light objects
        const lightContainer = createLightContainer(lightType, lightData);
        lightsContainer.appendChild(lightContainer);
      }
    }
  );
}

function createLightContainer(lightType, lightData) {
  const container = document.createElement("div");
  container.className = "mb-4 p-4 border rounded-lg";

  const title = document.createElement("h4");
  title.className = "text-lg font-medium mb-3";
  title.textContent = lightType;

  container.appendChild(title);

  // Create inputs for light properties
  Object.entries(lightData).forEach(([prop, value]) => {
    if (Array.isArray(value)) {
      // Handle position/target arrays
      const arrayContainer = createVectorInput(lightType, prop, value);
      container.appendChild(arrayContainer);
    } else {
      // Handle simple properties
      const input = createLightPropertyInput(lightType, prop, value);
      container.appendChild(input);
    }
  });

  return container;
}

function createLightArrayContainer(lightType, lights) {
  const container = document.createElement("div");
  container.className = "mb-4";

  const header = document.createElement("div");
  header.className = "flex justify-between items-center mb-2";

  const title = document.createElement("h4");
  title.className = "text-lg font-medium";
  title.textContent = lightType;

  const addButton = document.createElement("button");
  addButton.className = "text-blue-500 hover:text-blue-700";
  addButton.textContent = "+ Add Light";
  addButton.onclick = () => addNewLight(lightType);

  header.appendChild(title);
  header.appendChild(addButton);
  container.appendChild(header);

  // Add existing lights
  lights.forEach((light, index) => {
    const lightElement = createLightElement(lightType, light, index);
    container.appendChild(lightElement);
  });

  return container;
}

// Export functionality
exportBtn.addEventListener("click", () => {
  const jsonString = JSON.stringify(configData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "config.json";
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
      initializeForm();
    } catch (error) {
      console.error("Error importing JSON:", error);
      alert("Failed to import JSON file");
    }
  }
});

// Add event listeners for form changes
function addFormEventListeners() {
  // Add event listeners for all form inputs that update configData
  document
    .getElementById("supportedLanguages")
    .addEventListener("change", (e) => {
      configData.languages.supported = e.target.value
        .split(",")
        .map((lang) => lang.trim());
    });

  // Add more event listeners for other form elements...
}

initializeForm();

// Initialize form when page loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize language service first
  languageService.updatePageTranslations();

  // Add event listeners
  addFormEventListeners();

  // Export functionality
  document.getElementById("exportBtn").addEventListener("click", () => {
    const jsonString = JSON.stringify(configData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // Import functionality
  const jsonInput = document.getElementById("jsonInput");
  document
    .getElementById("importBtn")
    .addEventListener("click", () => jsonInput.click());

  jsonInput.addEventListener("change", async () => {
    const file = jsonInput.files[0];
    if (file) {
      try {
        const text = await file.text();
        configData = JSON.parse(text);
        initializeForm();
      } catch (error) {
        console.error("Error importing JSON:", error);
        alert("Failed to import JSON file");
      }
    }
  });
});

function createLightPropertyInput(lightType, prop, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "mb-3";

  const label = document.createElement("label");
  label.className = "block text-sm font-medium text-gray-700 mb-1";
  label.textContent = formatPropertyName(prop);

  const input = document.createElement("input");
  input.className =
    "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2";

  if (prop === "color" || prop === "skyColor" || prop === "groundColor") {
    input.type = "text";
    input.value = value;
    input.placeholder = "#FFFFFF";
  } else if (typeof value === "boolean") {
    input.type = "checkbox";
    input.checked = value;
    input.className =
      "rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500";
  } else if (typeof value === "number") {
    input.type = "number";
    input.value = value;
    input.step = "0.1";
  }

  input.addEventListener("change", (e) => {
    const newValue =
      input.type === "checkbox"
        ? e.target.checked
        : input.type === "number"
        ? parseFloat(e.target.value)
        : e.target.value;
    updateLightProperty(lightType, prop, newValue);
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

function createVectorInput(lightType, prop, values) {
  const wrapper = document.createElement("div");
  wrapper.className = "mb-3";

  const label = document.createElement("label");
  label.className = "block text-sm font-medium text-gray-700 mb-1";
  label.textContent = formatPropertyName(prop);
  wrapper.appendChild(label);

  const inputContainer = document.createElement("div");
  inputContainer.className = "grid grid-cols-3 gap-2";

  ["X", "Y", "Z"].forEach((axis, index) => {
    const input = document.createElement("input");
    input.type = "number";
    input.value = values[index];
    input.step = "0.1";
    input.className =
      "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2";
    input.placeholder = axis;

    input.addEventListener("change", (e) => {
      const newValues = [...values];
      newValues[index] = parseFloat(e.target.value);
      updateLightProperty(lightType, prop, newValues);
    });

    inputContainer.appendChild(input);
  });

  wrapper.appendChild(inputContainer);
  return wrapper;
}

function updateLightProperty(lightType, prop, value) {
  if (Array.isArray(configData.modelProperties.lights[lightType])) {
    // Handle array-based lights (PointLight, SpotLight, RectAreaLight)
    // Implementation depends on how you want to handle array updates
  } else {
    // Handle single light objects
    configData.modelProperties.lights[lightType][prop] = value;
  }
}

function formatPropertyName(prop) {
  return prop
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
}

function addNewLight(lightType) {
  let defaultLight;

  switch (lightType) {
    case "PointLight":
      defaultLight = {
        color: "#ffffff",
        intensity: 1,
        distance: 100.0,
        decay: 1.0,
        position: [0, 0, 0],
      };
      break;
    case "SpotLight":
      defaultLight = {
        color: "#ffffff",
        intensity: 1,
        distance: 100.0,
        angle: 0.5,
        penumbra: 0.1,
        decay: 1.0,
        castShadow: false,
        position: [0, 0, 0],
        lookAt: [0, 0, 0],
      };
      break;
    case "RectAreaLight":
      defaultLight = {
        color: "#ffffff",
        intensity: 1,
        width: 10,
        height: 10,
        position: [0, 0, 0],
        lookAt: [0, 0, 0],
      };
      break;
  }

  configData.modelProperties.lights[lightType].push(defaultLight);
  initializeLights();
}

function createLightElement(lightType, light, index) {
  const element = document.createElement("div");
  element.className = "mb-4 p-4 border rounded-lg";

  const header = document.createElement("div");
  header.className = "flex justify-between items-center mb-3";

  const title = document.createElement("h5");
  title.className = "text-md font-medium";
  title.textContent = `${lightType} ${index + 1}`;

  const deleteButton = document.createElement("button");
  deleteButton.className = "text-red-500 hover:text-red-700";
  deleteButton.textContent = "Delete";
  deleteButton.onclick = () => {
    configData.modelProperties.lights[lightType].splice(index, 1);
    initializeLights();
  };

  header.appendChild(title);
  header.appendChild(deleteButton);
  element.appendChild(header);

  // Add inputs for light properties
  Object.entries(light).forEach(([prop, value]) => {
    if (Array.isArray(value)) {
      const arrayContainer = createVectorInput(
        `${lightType}[${index}]`,
        prop,
        value
      );
      element.appendChild(arrayContainer);
    } else {
      const input = createLightPropertyInput(
        `${lightType}[${index}]`,
        prop,
        value
      );
      element.appendChild(input);
    }
  });

  return element;
}

function initializeTextureArrays() {
  // Initialize reflection cube textures
  const reflectionContainer = document.getElementById(
    "reflectionTexturesContainer"
  );
  reflectionContainer.innerHTML = "";
  configData.modelProperties.reflectionCubeTextures.forEach(
    (texture, index) => {
      reflectionContainer.appendChild(
        createTextureInput("reflection", texture, index)
      );
    }
  );

  // Initialize background cube textures
  const backgroundContainer = document.getElementById(
    "backgroundTexturesContainer"
  );
  backgroundContainer.innerHTML = "";
  configData.modelProperties.backgroundCubeTextures.forEach(
    (texture, index) => {
      backgroundContainer.appendChild(
        createTextureInput("background", texture, index)
      );
    }
  );
}

function createTextureInput(type, value, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "flex gap-2";

  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.className =
    "flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2";

  const deleteButton = document.createElement("button");
  deleteButton.className = "text-red-500 hover:text-red-700 px-2";
  deleteButton.textContent = "×";

  input.addEventListener("change", (e) => {
    if (type === "reflection") {
      configData.modelProperties.reflectionCubeTextures[index] = e.target.value;
    } else {
      configData.modelProperties.backgroundCubeTextures[index] = e.target.value;
    }
  });

  deleteButton.addEventListener("click", () => {
    if (type === "reflection") {
      configData.modelProperties.reflectionCubeTextures.splice(index, 1);
    } else {
      configData.modelProperties.backgroundCubeTextures.splice(index, 1);
    }
    initializeTextureArrays();
  });

  wrapper.appendChild(input);
  wrapper.appendChild(deleteButton);
  return wrapper;
}

// Add event listeners for texture buttons
document
  .getElementById("addReflectionTexture")
  .addEventListener("click", () => {
    configData.modelProperties.reflectionCubeTextures.push("");
    initializeTextureArrays();
  });

document
  .getElementById("addBackgroundTexture")
  .addEventListener("click", () => {
    configData.modelProperties.backgroundCubeTextures.push("");
    initializeTextureArrays();
  });

function initializeControlProperties() {
  // Initialize numeric inputs
  ["dampingFactor", "rotateSpeed", "dollySpeed", "playerHeight"].forEach(
    (prop) => {
      document.getElementById(prop).value = configData.controlProperties[prop];
    }
  );

  // Initialize checkboxes
  [
    "enableZoom",
    "enablePan",
    "enableDamping",
    "enableJoystick",
    "showRingHelperTeleportAnim",
    "showObjectListModal",
    "showARButtonOnScreen",
    "moveUpDown",
  ].forEach((prop) => {
    document.getElementById(prop).checked = configData.controlProperties[prop];
  });

  // Initialize start position
  document.getElementById("startX").value =
    configData.controlProperties.startPoint[0];
  document.getElementById("startY").value =
    configData.controlProperties.startPoint[1];
  document.getElementById("startZ").value =
    configData.controlProperties.startPoint[2];
  document.getElementById("startAzimuthAngle").value =
    configData.controlProperties.startAzimuthAngle;

  // Initialize arrows mapping
  const arrowsMappingSelect = document.getElementById("arrowsMapping");
  arrowsMappingSelect.value = configData.controlProperties.arrowsMapping;

  // Add event listener for arrows mapping
  arrowsMappingSelect.addEventListener("change", (e) => {
    configData.controlProperties.arrowsMapping = e.target.value;
  });
}

function initializeAudioProperties() {
  // Initialize global audio settings
  [
    "autostartAudioEnabled",
    "objectAudioAutoplayDesktop",
    "objectAudioAutoplayMobile",
    "playObjectAudioOnly",
  ].forEach((prop) => {
    document.getElementById(prop).checked = configData.audioProperties[prop];
  });

  // Initialize audio sources
  ["background", "transition", "vrTeleport", "click"].forEach((type) => {
    const audio = configData.audioProperties[`${type}Audio`];
    document.getElementById(`${type}AudioPath`).value = audio.path;
    document.getElementById(`${type}AudioVolume`).value = audio.volume;
    document.getElementById(`${type}AudioPlaybackRate`).value =
      audio.playbackRate;
    document.getElementById(`${type}AudioLoop`).checked = audio.loop;
  });
}
