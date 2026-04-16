

# Restore Project After Accidental Blink Template Overwrite

## What happened
The commit `8a17f172` ("Update from Blink") replaced your entire app with a blank Blink starter template. Your App.tsx (812 lines, 298 routes) was overwritten with a 24-line boilerplate, and many other critical files were damaged or replaced. That's why the preview shows a generic "App > Home" page with developer instructions instead of your actual site.

## Fix (1 step, ~15 files)

Restore the following files from the previous working commit (`dadc8c01`):

| File | What was lost |
|------|--------------|
| `src/App.tsx` | All 298 routes, lazy imports, provider stack, route guards |
| `src/main.tsx` | Auth provider, query persistence, PWA setup |
| `index.html` | GA4, Meta Pixel, SiteRadar scripts, SEO meta tags |
| `package.json` | ~100+ dependencies, all build scripts |
| `vite.config.ts` | Vendor chunks, PWA config, proxy settings |
| `tsconfig.json` | Path aliases, compiler options |
| `tsconfig.node.json` | Node config |
| `src/index.css` | Full Tailwind config, custom theme variables |
| `src/lib/utils.ts` | Utility functions |

Also **delete** the Blink-only files that were added and don't belong:
- `src/Shell.tsx`, `src/layouts/shared-app-layout.tsx`, `src/components/AppSidebarShell.tsx`
- `src/App.css`, `src/style.css`, `src/counter.ts`, `src/main.ts`
- `postcss.config.cjs`, `tailwind.config.cjs`
- `src/assets/hero.png`, `src/assets/typescript.svg`, `src/assets/vite.svg`
- `public/favicon.svg`, `public/icons.svg`

Each file will be restored to its exact content from the last working commit using `git show dadc8c01:<path>`.

## Technical detail
This is a `git checkout` of specific files from the pre-Blink commit. No routes, components, or edge functions are being changed — just restoring what was overwritten. The build will work because all your pages and components are still intact in `src/pages/` and `src/components/`.

