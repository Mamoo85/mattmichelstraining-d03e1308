# Restore Point — Pre-Redesign Backup
**Created:** 2026-03-23
**Purpose:** Document all files modified during the premium app-style redesign.

## Files Modified
| File | Change |
|------|--------|
| `src/components/layout/AppNavbar.tsx` | Stripped mobile to logo + icons, removed hamburger |
| `src/components/layout/BottomTabBar.tsx` | **NEW** — Mobile bottom nav with 5 tabs + More sheet |
| `src/components/features/HeroSection.tsx` | Full-bleed hero, removed grid bg, removed AthleteResults, simplified CTAs |
| `src/components/landing/AudienceSelector.tsx` | Horizontal scroll image cards, removed expand/collapse |
| `src/components/landing/SportPicker.tsx` | Horizontal scroll row |
| `src/components/landing/M2Difference.tsx` | Horizontal scroll row |
| `src/pages/Dashboard.tsx` | Pill-style tab switcher |
| `src/pages/About.tsx` | Added AthleteResults data to testimonials section |
| `src/pages/Index.tsx` | Minor layout adjustments |
| `src/App.tsx` | Added BottomTabBar globally |

## How to Restore
Revert each file listed above to the git commit prior to this redesign. The BottomTabBar.tsx file can simply be deleted.
