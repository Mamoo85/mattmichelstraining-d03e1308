

# Add Search, Trade Chips, Sort, and CSV Export to MyTechAlert

## What changes

Four additive features to the candidate list in `src/pages/MyTechAlert.tsx`. No existing logic removed.

### New state variables (near line 104)
- `searchQuery` (string)
- `tradeFilter` (string: "all" | "boiler" | "hvac" | "plumber" | "electrician" | "healthcare")
- `sortMode` (string: "score" | "newest" | "license" | "contact")

### 1. Rewrite `filteredCandidates` useMemo (lines 313-324)
Compose all four filters + sort:
- **Search**: case-insensitive match across `full_name`, `city`, `license_type`, `current_employer`
- **Trade chip**: match `license_type` containing the trade keyword; "healthcare" matches CNA/RN/LPN/Nurse
- **Score filter**: existing hot/medium/all logic (unchanged)
- **Sort**: "score" = cross-ref first then score desc (current behavior), "newest" = `first_seen_at` desc (missing field — will use `alerted_at`), "license" = has `license_number` first, "contact" = has phone/email first

### 2. UI additions (between score filter buttons at line 513 and candidate list at line 515)

**Search bar**: `<Input>` with placeholder "Search by name, city, or trade…", full width, dark-themed

**Trade chips row**: Six pill buttons (All, Boiler Operator, HVAC, Plumber, Electrician, Healthcare). Active = teal bg, others = outline. Single-select.

**Sort dropdown + Export button row**: 
- `<Select>` with four options alongside the existing score filter area
- Teal "⬇ Export" button that generates CSV Blob from current `filteredCandidates`

### 3. CSV Export function
Plain JS: build CSV string from `filteredCandidates`, create Blob, trigger download via temporary anchor element. Columns: Name, License Type, License Number, City, Phone, Email, Score, First Seen.

## Files changed
- `src/pages/MyTechAlert.tsx` — add imports (Input, Select components, Download icon), 3 state vars, updated useMemo, new UI block, CSV function

## Files NOT changed
- No backend, no migrations, no other components

