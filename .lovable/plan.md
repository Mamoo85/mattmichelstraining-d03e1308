

# SITEWIDE DOMAIN FIX: `detroitwebagency.com` → `detroitwebagent.com`

## The Problem

Two files in the live codebase use the **wrong domain** `detroitwebagency.com` instead of the correct `detroitwebagent.com`. The canonical config in `domainConfig.ts` is correct — these are stragglers.

## Files With Wrong Domain (CODE — must fix)

### 1. `src/components/layout/AnnouncementBanner.tsx` (line 6)
**Wrong:**
```
["detroitwebagency.com", "www.detroitwebagency.com"]
```
**Fix to:**
```
["detroitwebagent.com", "www.detroitwebagent.com"]
```

### 2. `src/pages/MyTechAlert.tsx` (line 458)
**Wrong:**
```
href="https://detroitwebagency.com/contractor-leads"
```
**Fix to:**
```
href="https://www.detroitwebagent.com/contractor-leads"
```

## Files With Wrong Domain (DOCS — cosmetic, fix for consistency)

### 3. `.lovable/plan.md` (line 86)
Change `detroitwebagency.com/contractor-leads` → `detroitwebagent.com/contractor-leads`

### 4. `CLAUDE.md` (lines 132, 492)
- Line 132: "hidden on detroitwebagency.com domain" → "hidden on detroitwebagent.com domain"
- Line 492: "Domain: detroitwebagency.com" → "Domain: detroitwebagent.com"

### 5. `knowledge/M2_Product_Catalog.md` (line 332)
`detroitwebagency.com` → `detroitwebagent.com`

## Non-Issues (safe to ignore)

- `supabase/functions/free-breach-scanner/index.ts` — uses `DetroitWebAgency-BreachScanner` as a **User-Agent string**, not a domain. This is just a label, not a URL. No fix needed.

## Summary

| File | Type | Impact |
|------|------|--------|
| `AnnouncementBanner.tsx` | **Production code** | Banner logic broken on real domain — never hides |
| `MyTechAlert.tsx` | **Production code** | Upsell link goes to wrong/dead domain |
| `.lovable/plan.md` | Plan doc | Cosmetic |
| `CLAUDE.md` | Dev doc | Cosmetic |
| `M2_Product_Catalog.md` | Knowledge | Cosmetic |

Two production code fixes + three documentation fixes. That's the complete list across the entire codebase.

