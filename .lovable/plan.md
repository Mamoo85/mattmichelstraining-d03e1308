

# Admin Media Vault with AI Creative Studio

## What We're Building

A new admin tab called **"Media Vault"** — a storage system where you upload photos, videos, and audio of you and your clients. An AI bot sits on top of this vault and generates new images (composites, branded social posts, promo graphics) from the uploaded media.

### Honest Capabilities Assessment

**What works today:**
- Full media upload/management (images, videos, audio) via Lovable Cloud storage — free with your current plan
- AI image generation and editing using your uploaded photos (composites, branded graphics, social media posts, before/after collages)
- Multi-select files to feed into AI as context
- Parameter controls (style, aspect ratio, text overlays, brand colors)

**What does not exist yet in any available model:**
- AI video generation from uploaded clips (no model available can create new video from your footage)
- AI "learning" and remembering patterns across sessions (current models are stateless)

**Workaround for video:** I can build a Remotion-based montage/reel maker that cuts, transitions, and brands your existing clips into polished promo reels. Not AI-generated, but produces great results.

## Storage — Free

Lovable Cloud storage buckets are included. We'll create an `admin_media` bucket. No extra cost for reasonable usage.

## Architecture

### Database
- `admin_media_files` table — tracks uploads (file path, type, tags, metadata, created_at)
- `ai_media_jobs` table — tracks AI generation requests and results

### Storage
- `admin_media` bucket — stores uploaded files (images, video, audio)
- `ai_generated_media` bucket — stores AI-created outputs

### Edge Function
- `ai-media-studio` — accepts selected file URLs + generation parameters, calls Lovable AI image generation/editing, stores results

### Frontend (new admin components)
1. **AdminMediaVault.tsx** — Upload zone (drag-and-drop, multi-file), gallery grid with multi-select, file type filters, tag management
2. **AiMediaStudio.tsx** — The creative bot interface: select media → choose parameters (style, format, text, branding) → generate → preview → save/download
3. Add "Media Vault" sub-tab to the **Site Content** master tab in Admin

### AI Parameters the Admin Can Control
- Output type: social post, promo banner, composite, branded graphic
- Aspect ratio: 1:1, 16:9, 9:16, 4:5
- Style: clean/minimal, bold/energetic, dark/cinematic
- Text overlay content and placement
- Brand color application
- Which uploaded photos to use as source material

### Generation Flow
1. Admin selects 1-5 photos from the vault
2. Picks a generation preset or writes a custom prompt
3. Edge function sends photos + prompt to Lovable AI (Gemini image model)
4. Result saved to `ai_generated_media` bucket
5. Admin previews, downloads, or regenerates

## Files to Create/Edit
- **New**: `supabase/functions/ai-media-studio/index.ts`
- **New**: `src/components/admin/AdminMediaVault.tsx`
- **New**: `src/components/admin/AiMediaStudio.tsx`
- **Migration**: Create `admin_media_files` table, `ai_media_jobs` table, two storage buckets with RLS
- **Edit**: `src/pages/Admin.tsx` — add Media Vault tab under Site Content

