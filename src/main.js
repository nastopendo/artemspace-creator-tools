import "./style.css";
import homepageHtml from "./pages/homepage/index.html?raw";
import imageResizerHtml from "./pages/image-resizer/index.html?raw";
import imageOrganizerHtml from "./pages/image-organizer/index.html?raw";
import gltfConfigEditorHtml from "./pages/gltf-config-editor/index.html?raw";
import appConfigEditorHtml from "./pages/app-config-editor/index.html?raw";
import imageDimensionsHtml from "./pages/image-dimensions/index.html?raw";
import { languageService } from "./services/languageService";

const routes = {
  "/": {
    template: homepageHtml,
  },
  "/image-resizer": {
    template: imageResizerHtml,
    script: () => import("./pages/image-resizer/image-resizer.js"),
  },
  "/image-organizer": {
    template: imageOrganizerHtml,
    script: () => import("./pages/image-organizer/image-organizer.js"),
  },
  "/gltf-config-editor": {
    template: gltfConfigEditorHtml,
    script: () => import("./pages/gltf-config-editor/gltf-config-editor.js"),
  },
  "/app-config-editor": {
    template: appConfigEditorHtml,
    script: () => import("./pages/app-config-editor/app-config-editor.js"),
  },
  "/image-dimensions": {
    template: imageDimensionsHtml,
    script: () => import("./pages/image-dimensions/image-dimensions.js"),
  },
};

const app = document.getElementById("app");

// Add language switcher to all pages
function addLanguageSwitcher() {
  const header = document.querySelector("header");
  if (!header) return;

  const switcher = document.createElement("div");
  switcher.className = "absolute top-4 right-4 flex gap-2";
  switcher.innerHTML = `
    <button class="lang-btn px-2 py-1 rounded" data-lang="en">EN</button>
    <button class="lang-btn px-2 py-1 rounded" data-lang="pl">PL</button>
  `;

  header.appendChild(switcher);

  // Update button styles
  const updateButtons = () => {
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      if (btn.dataset.lang === languageService.currentLanguage) {
        btn.classList.add("bg-blue-500", "text-white");
        btn.classList.remove("bg-gray-200");
      } else {
        btn.classList.remove("bg-blue-500", "text-white");
        btn.classList.add("bg-gray-200");
      }
    });
  };

  // Add click handlers
  switcher.addEventListener("click", (e) => {
    if (e.target.classList.contains("lang-btn")) {
      languageService.setLanguage(e.target.dataset.lang);
      updateButtons();
    }
  });

  updateButtons();
}

const loadRoute = async () => {
  // Get the path without the domain
  const fullPath = window.location.pathname;
  const path = fullPath === "" ? "/" : fullPath;
  const route = routes[path] || routes["/"];

  try {
    app.innerHTML = route.template;
    addLanguageSwitcher();
    languageService.updatePageTranslations();

    if (route.script) {
      await route.script();
    }
  } catch (error) {
    console.error("Error loading route:", error);
    app.innerHTML = "<h1>Page not found</h1>";
  }
};

// Load the initial route
window.addEventListener("load", loadRoute);

// Handle navigation
window.addEventListener("popstate", loadRoute);

// Handle navigation links
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-link]")) {
    e.preventDefault();
    const href = e.target.getAttribute("href");
    history.pushState(null, null, href);
    loadRoute();
  }
});
