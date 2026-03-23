

## Plan: Tetris-Style Splash Screen Logo Animation

### What It Does

When a user opens the app, a full-screen splash animation plays for ~3 seconds. The M² Training logo image breaks into grid tiles that fall into place like Tetris pieces — dropping from random positions/rotations and snapping into a grid to reveal the complete logo. Once assembled, a shine/gloss effect sweeps across, then the splash fades away to reveal the app.

### How It Works

1. **New component: `src/components/layout/SplashScreen.tsx`**
   - Full-screen black overlay (`z-[9999]`) covering the entire viewport
   - Displays the actual `m2-logo.jpg` image, but the animation is done by showing it through a CSS clip-path grid (or via a canvas approach)
   - **Simpler approach**: Use a grid of ~25 `div` tiles (5x5), each showing a portion of the logo via `background-image` + `background-position`. Each tile starts off-screen at a random position/rotation, then animates into its correct