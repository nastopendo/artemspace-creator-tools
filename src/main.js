import "./style.css";
import homepageHtml from "./pages/homepage/index.html?raw";
import imageResizerHtml from "./pages/image-resizer/index.html?raw";
import imageOrganizerHtml from "./pages/image-organizer/index.html?raw";
import gltfConfigEditorHtml from "./pages/gltf-config-editor/index.html?raw";
import appConfigEditorHtml from "./pages/app-config-editor/index.html?raw";
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
};

const app = document.getElementById("app");

const loadRoute = async () => {
  // Get the path without the domain
  const fullPath = window.location.pathname;
  const path = fullPath === "" ? "/" : fullPath;
  const route = routes[path] || routes["/"];

  try {
    app.innerHTML = route.template;

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
