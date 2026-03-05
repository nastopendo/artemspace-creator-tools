# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (Vite)
npm run build    # Build for production (outputs to dist/)
npm run preview  # Preview production build
```

No test suite is configured.

## Architecture

This is a **single-page application** built with Vite + vanilla JavaScript + Tailwind CSS. It is a collection of creator tools for the Artemspace virtual gallery platform.

### Routing

The app uses a custom client-side router in `src/main.js`. Routes are defined as a map of path strings to `{ template, script }` objects. Each route loads its HTML template as a raw string (imported with `?raw`) and dynamically imports its JS module on navigation. Navigation uses the History API; links must have `data-link` attribute to be intercepted.

### Adding a new tool

1. Create `src/pages/<tool-name>/index.html` and `src/pages/<tool-name>/<tool-name>.js`
2. Import the HTML in `src/main.js` with `?raw` and add a route entry
3. Add the tool card to `src/pages/homepage/index.html`
4. Add all UI strings to both `en` and `pl` translation objects in `src/translations.js`

### Internationalization

All UI text must go through the i18n system:
- In HTML templates, use `data-i18n="keyName"` attributes — `languageService.updatePageTranslations()` fills these in on load
- In JS, use `languageService.translate("keyName")` for dynamic strings
- Translations live in `src/translations.js` (both `en` and `pl` must be kept in sync)
- `languageService` is a singleton from `src/services/languageService.js`; it persists the language choice in `localStorage`

### Key dependencies

- **three.js** — used in `gltf-config-editor` (GLTFLoader) and `photo-360-viewer` (equirectangular panorama rendering)
- **Quill** — rich text editor used in `gltf-config-editor` for exhibition descriptions
- **SortableJS** — drag-and-drop reordering in `image-organizer` and `gltf-config-editor`
- **JSZip** — ZIP export in `image-organizer`

### Tool responsibilities

| Route | Purpose |
|---|---|
| `/image-organizer` | Drag-reorder images, batch rename, export as ZIP |
| `/image-resizer` | Batch resize images, set output format/quality |
| `/image-dimensions` | Assign physical dimensions (cm) to images, export JSON |
| `/gallery-wall-planner` | Distribute artworks across walls with optimal spacing |
| `/gltf-config-editor` | Edit Artemspace GLTF exhibition config (artworks, metadata) |
| `/app-config-editor` | Edit global Artemspace app config (lights, controls, audio, analytics) |
| `/photo-360-viewer` | View equirectangular 360 images interactively |
