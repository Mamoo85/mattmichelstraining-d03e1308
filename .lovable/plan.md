

# Exercise Image Matching: Starting Strength + Supple Leopard → Both Libraries

## Scope
252 exercises (167 regular + 85 Fix It) need matched reference images from two books: *Starting Strength* (barbell/compound movements) and *Becoming a Supple Leopard* (mobility/soft tissue work). This is a multi-phase operation.

## Phase 1: Extract Starting Strength Images
- Run the same `pypdf` extraction script on the uploaded Starting Strength PDF
- Save all extracted images to `/mnt/documents/starting-strength-images/`
- Filter by size (skip icons/logos), keep exercise demonstration drawings and photos

## Phase 2: Database — Add `image_url` to `exercise_library`
- Migration: `ALTER TABLE exercise_library ADD COLUMN image_url TEXT;`
- This lets every exercise in both libraries carry a reference image

## Phase 3: Categorize and Match (the precision work)
Build a Python script that:
1. Loads all 252 exercise titles from the database
2. Groups them by likely source book:
   - **Starting Strength matches** (~60-80): Back Squat, Front Squat, Deadlift, Bench Press, Overhead Press, Power Clean, Hang Clean, Romanian Deadlift, and all barbell compound variations
   - **Supple Leopard matches** (~70-90): All foam rolling, lacrosse ball, banded distraction, couch stretch, joint mobilization, and soft tissue exercises
   - **Either/generic** (~80-100): Kettlebell work, bodyweight movements, accessory exercises — match to whichever book has the best visual
3. For each match, identify the specific extracted image by page number and content
4. Crop faces from photos (using PIL face-area detection or manual crop coordinates), keeping only the body mechanics
5. Preserve all drawings/illustrations in full (Starting Strength has excellent barbell form drawings)

## Phase 4: Upload to Storage + Update Database
- Upload each matched/cropped image to the `exercise_reference_images` bucket with structured naming: `{exercise-slug}.jpg`
- Run UPDATE queries to set `image_url` on each exercise record with the public storage URL

## Phase 5: UI Integration
Update these components to display the new `image_url`:

- **`ExerciseLibrary.tsx`** — Show thumbnail in collapsed card, full image in expanded view
- **`FixItLibrary.tsx`** — Same pattern, thumbnail + expanded image
- **`ProtocolTable.tsx`** — Already has image display (lightbox) from previous work, will now pull from exercise library images as fallback
- **`ExerciseCard.tsx`** — Add image display for workout builder context

### Drawing Usage Site-Wide
Starting Strength's barbell form drawings will also be wired into:
- `ActiveWorkoutZone.tsx` — show reference drawing during active sets
- `WorkoutLogger.tsx` — small thumbnail next to logged exercises
- `AiWorkoutSuggest.tsx` — display reference image in generated protocols

## Technical Notes
- The Starting Strength PDF contains detailed pen-and-ink drawings of all major lifts — these are the primary assets for barbell exercises
- Supple Leopard images are photos of mobilization positions — these map to Fix It and mobility exercises
- Face cropping applies only to photos, not drawings
- All images uploaded to the existing `exercise_reference_images` public bucket (already has proper RLS)
- No new edge functions needed — this is a data pipeline + UI update
- Estimated ~150-200 images will be matched (not all 252 exercises will have a book match; those remain without images until manually added)

## Files Modified
- `supabase/migrations/` — 1 new migration (add `image_url` column)
- `src/components/features/ExerciseLibrary.tsx` — add image display
- `src/components/features/FixItLibrary.tsx` — add image display
- `src/components/workout/ExerciseCard.tsx` — add thumbnail
- `src/components/workout/ActiveWorkoutZone.tsx` — reference image during sets
- `src/components/workout/WorkoutLogger.tsx` — thumbnail next to exercises
- `src/integrations/supabase/types.ts` — updated automatically

