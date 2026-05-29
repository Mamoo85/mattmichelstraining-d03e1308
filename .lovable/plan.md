I’ll fix this at the asset-source level instead of trying another overwrite of the same filenames.

Plan:

1. Create a new canonical M2 logo source
- Add a hand-authored orange-on-black SVG under `public/` with no external image dependency.
- Use simple vector/CSS shapes/text so the splash cannot render as a broken white raster box.
- Use the M2 orange on solid black, matching the current dark theme.

2. Generate a fully versioned icon set from that source
- Create new cache-busted filenames, e.g. `m2-icon-v20260529-192.png`, `m2-icon-v20260529-512.png`, `m2-apple-touch-v20260529.png`, `m2-favicon-v20260529.png`, `m2-og-v20260529.png`.
- Include Android adaptive/maskable-safe versions with a real black background and safe-area padding so Android launchers do not put it on a white plate.
- Regenerate `favicon.ico` from the new black/orange favicon so `/favicon.ico` cannot override the PNG.

3. Update all M2 logo entry points to versioned URLs
- Replace the splash image in `index.html` with the SVG or new versioned SVG URL plus query/version if needed.
- Update default favicon, Apple touch icon, manifest icons, and maskable icon references.
- Update M2 `og:image` and `twitter:image` to the new versioned social preview image.
- Update `SEOHead` default image so routed M2 pages also use the new asset.

4. Fix the manifest/cache behavior
- Make the M2 manifest use the new versioned files instead of stable overwritten filenames.
- Keep the existing DWA/DJ Conley manifests/icons untouched.
- Add version query params only where browsers respect them; use hashed/versioned filenames for install icons because home-screen caches are stubborn.

5. Verify the output
- Inspect the generated PNG/ICO pixels to confirm black corners and orange center.
- Search the codebase again for stale M2 references like `/m2-logo.jpg`, `/pwa-512x512.png`, `/apple-touch-icon.png`, and old OG image references.
- Confirm the splash uses the new vector file and no longer depends on the old raster logo path.

Technical notes:
- I’ll avoid changing backend/business logic.
- I’ll edit `index.html` because this is specifically head tags, manifest, splash, favicon, and social preview metadata.
- Existing installed PWAs may still require reinstalling because Android/iOS pin manifest icon metadata at install time, but using brand-new filenames prevents the browser from reusing the old cached image during reinstall.