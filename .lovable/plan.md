

# Plan: Fix Instagram URLs + Add Facebook Links

## Problem
- `AppNavbar.tsx` and `BottomTabBar.tsx` use wrong Instagram handle (`m2training` → should be `mattmichelstraining`)
- Facebook is missing from both nav components and the `InstagramSocialBox` homepage section

## Changes

### 1. Fix Instagram URL in nav (2 files)
Update `INSTAGRAM_URL` in both `AppNavbar.tsx` (line 14) and `BottomTabBar.tsx` (line 21) from `https://www.instagram.com/m2training` to `https://www.instagram.com/mattmichelstraining/`

### 2. Add Facebook to AppNavbar desktop nav
Add a Facebook icon link next to the existing Instagram icon in the desktop nav, linking to `https://www.facebook.com/mattmichelstraining`. Use the `Facebook` icon from lucide-react.

### 3. Add Facebook to BottomTabBar "More" sheet
Add a Facebook link below the existing Instagram link in the More sheet, same style, linking to `https://www.facebook.com/mattmichelstraining`.

### 4. Add Facebook to InstagramSocialBox on homepage
Rename or extend the "Follow Along" section. Add a Facebook card/link below the Instagram feed grid linking to `https://www.facebook.com/mattmichelstraining` with description text like "Workout of the Week series — real exercises, real coaching cues."

## Files Changed

| File | Change |
|------|--------|
| `src/components/layout/AppNavbar.tsx` | Fix Instagram URL, add Facebook icon |
| `src/components/layout/BottomTabBar.tsx` | Fix Instagram URL, add Facebook link in More sheet |
| `src/components/landing/InstagramSocialBox.tsx` | Add Facebook link/card below Instagram grid |

No database changes needed.

