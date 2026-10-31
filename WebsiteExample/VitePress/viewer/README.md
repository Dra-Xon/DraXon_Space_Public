# Site PDF viewer

`application.mjs` binds only the controls present in `public/pdfjs/web/viewer.html`.
The rendering, page navigation, zoom, layout, and presentation classes remain the
vendored PDF.js implementation. Toolbar CSS and `site-toolbar.mjs` retain the
site's existing layout, pinning, and idle behavior.

`scripts/build-pdf-viewer.mjs` bundles these classes from the upstream archive in
`vendor/pdfjs-viewer.mjs`, without the upstream application, search/sidebar,
secondary toolbar, editing UI initialization, printing, or dialog controllers.
The archive is outside `src/public` and is never copied to the website. The
upstream viewer source map is intentionally absent from the public directory.
The core library is also bundled without editor layer/manager, color-picker, or
signature-extractor exports; its original source map is not published either.

Only document loading and download/save are exposed to the outer Vue component.
The viewer and its event bus are module-private. Removing CSS rules or changing
HTML attributes cannot restore removed controls or their event handlers.

The PDF parsing/rendering library still handles existing PDF annotations and
forms. That is needed to display documents and preserve the retained save
behavior; it does not provide the removed site toolbar features. Rebuilding a
new interface from that library remains possible and is outside this boundary.
