

# Plan: Instagram Feed + Content Generator

## Part 1 — Instagram Feed (Supabase-backed)

### Database Migration

Create `instagram_posts` table:
```sql
CREATE TABLE public.instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  caption TEXT,
  post_url TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  posted_at TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active posts" ON public.instagram_posts FOR SELECT USING (active = true);
CREATE POLICY "Admins full access" ON public.instagram_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

Create `content_queue` table (for Prompt 6):
```sql
CREATE TABLE public.content_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  caption TEXT NOT NULL,
  hashtags TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.content_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins full access" ON public.content_queue FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

### Upgrade InstagramSocialBox

**Modify `src/components/landing/InstagramSocialBox.tsx`**:
- Fetch from `instagram_posts` (active, ordered by `posted_at desc`, limit 6)
- Fall back to existing hardcoded posts if no DB data
- Keep existing grid layout (3-col, hover overlay with caption truncated to 100 chars)
- Each card links to `post_url` in new tab

### Admin Instagram Manager

**New file: `src/components/admin/AdminInstagramPosts.tsx`**:
- Form to add posts (image_url, caption, post_url, posted_at)
- List existing posts with active/inactive toggle
- Delete button

### Admin Integration

**Modify `src/pages/Admin.tsx`**:
- Add `AdminInstagramPosts` as a sub-tab under "Site Content" (after Media Vault)

### Homepage & Results Integration

Already done — `InstagramSocialBox` is already used on the Results page. Add it to `Index.tsx` as a "Follow Along" section near the bottom of the content area.

---

## Part 2 — Instagram Content Generator (Admin Tool)

### Edge Function

**New file: `supabase/functions/generate-instagram-content/index.ts`**:
- Accepts `{ content_type, inputs? }` — uses Lovable AI Gateway
- 5 system prompts mapped to content types: `authority`, `client_win`, `youth_athlete`, `app_feature`, `studio_community`
- `client_win` accepts inputs: exercise, before, after, weeks, clientType
- `app_feature` accepts input: featureName
- Returns `{ caption, hashtags }`

### Admin Content Tab

**New file: `src/components/admin/AdminContentGenerator.tsx`**:
- 5 content type buttons (Authority Post, Client Win, Youth Athlete, App Feature, Studio/Community)
- Client Win shows input form before generating (exercise, before/after weight, weeks, type)
- App Feature shows dropdown (AI Generator, PR Tracking, Form Checks, etc.)
- Generated output shows in Instagram-style preview card
- Two actions: "Copy Caption" (clipboard) and "Save to Queue" (inserts into `content_queue`)
- Below: Queue view listing all drafts with "Mark as Posted" button

### Admin Integration

**Modify `src/pages/Admin.tsx`**:
- Add to the "Growth" master tab as new sub-tabs: "Content Generator" and "Instagram"

---

## Files Summary

| File | Action |
|------|--------|
| Migration SQL | Create `instagram_posts` + `content_queue` tables with RLS |
| `src/components/landing/InstagramSocialBox.tsx` | Modify — fetch from DB with hardcoded fallback |
| `src/pages/Index.tsx` | Add InstagramSocialBox section |
| `src/components/admin/AdminInstagramPosts.tsx` | Create — CRUD for instagram posts |
| `src/components/admin/AdminContentGenerator.tsx` | Create — AI content generator + queue |
| `supabase/functions/generate-instagram-content/index.ts` | Create — Lovable AI edge function |
| `src/pages/Admin.tsx` | Add Instagram + Content Generator sub-tabs to Growth |

