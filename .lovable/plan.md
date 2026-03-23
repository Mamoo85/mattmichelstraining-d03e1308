

# Remove All Mentions of "Kinesiology" Sitewide

## Summary
Remove every reference to the word "kinesiology" across the entire codebase — frontend components, admin templates, and backend edge function prompts.

## Changes

### 1. `src/components/features/ShopGrid.tsx` (line ~97)
- Change: `"Safe, effective exercises backed by kinesiology."` → `"Safe, effective exercises backed by 20+ years of coaching experience."`

### 2. `src/components/features/ExerciseLibrary.tsx` (lines ~97-98)
- Change: `"the kinesiology and physics behind the movement"` → `"the biomechanics and physics behind the movement"`

### 3. `src/components/admin/AdminNewsletterComposer.tsx` (line ~17)
- Change: `"Why It Happens (The Kinesiology):"` → `"Why It Happens (The Science):"`

### 4. `supabase/functions/ai-admin-assist/index.ts`
- Line ~93 (newsletter prompt): `"You reference kinesiology, biomechanics"` → `"You reference biomechanics"`
- Line ~171 (blog_draft prompt): `"biomechanics, kinesiology"` → `"biomechanics, movement science"`

