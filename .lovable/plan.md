

# Fix Build Error: Missing `build:dev` Script

## Problem
The Lovable build system expects a `build:dev` script in `package.json`, but it only has `build`. A previous edit removed or never added this script. The GitHub conflict branch in the screenshot suggests config files got out of sync.

## Fix (1 change)

**`package.json`** — Add the missing `build:dev` script:
```json
"build:dev": "vite build --mode development",
```

This goes in the `scripts` block alongside the existing `build` entry. The Lovable build runner calls `build:dev` for preview builds. Adding it resolves the error immediately.

No other files need changes — `vite.config.ts`, `tsconfig.json`, and `tsconfig.node.json` all look correct.

