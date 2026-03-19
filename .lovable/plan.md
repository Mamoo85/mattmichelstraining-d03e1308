

## Use Actual M² Logos on Install Page

### What Changes
Replace the generic `Smartphone` Lucide icon on the Install page with the actual M² Training logo (`m2-logo.jpg` from `src/assets/`), and reference the PWA icon (`/pwa-192x192.png`) where the "app icon" is mentioned.

### File: `src/pages/Install.tsx`

1. **Import the logo**: Add `import m2Logo from "@/assets/m2-logo.jpg";`
2. **Hero icon (line 54-55)**: Replace the `<Smartphone>` icon div with an `<img src={m2Logo}>` styled as a 20x20 rounded square — same as the navbar logo but larger
3. **"Check your home screen" text (line 84)**: Optionally mention the M² icon so users know what to look for

Small, focused change — one file, swap two elements.

