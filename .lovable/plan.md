

# Healthcare License Scanning — Gap Analysis & Fix Plan

## What's Working ✅
1. **Frontend** — `HireAlert.tsx` has CNA, RN, LPN, Director of Nursing in `ROLE_OPTIONS`
2. **Healthcare Landing Page** — `HealthcareHireAlert.tsx` has CNA, RN, LPN, DON, Home Health Aide
3. **Admin** — `AdminHireAlertClients.tsx` has all 5 healthcare roles in `ROLE_LABELS` + `HEALTHCARE_ROLES` filter
4. **Database** — `hire_alert_clients.target_roles` is `text[]`, accepts any string — no migration needed

## What's Broken 🔴

### Gap 1: Scanner ROLE_KEYWORDS missing ALL healthcare roles
**File:** `supabase/functions/hire-alert-scanner/index.ts`, line 759-768

The `ROLE_KEYWORDS` map only has trades (boiler, HVAC, plumber, etc.). Healthcare roles `cna`, `rn`, `lpn`, `director_of_nursing`, `home_health_aide` are completely missing.

**Impact:** When a healthcare client subscribes with `target_roles: ["cna", "rn"]`, the `candidateMatchesRoles()` function falls back to `(ROLE_KEYWORDS[role] || [role])` — meaning it tries to match the literal string `"cna"` against candidate `license_type`. This *might* partially work if the scraped `license_type` contains "cna", but it won't match "Certified Nursing Assistant", "Nurse Aide", etc.

**Fix:** Add healthcare entries to `ROLE_KEYWORDS`:
```
cna: ["cna", "certified nursing assistant", "nurse aide", "nursing assistant"]
rn: ["rn", "registered nurse"]
lpn: ["lpn", "licensed practical nurse", "practical nurse"]
director_of_nursing: ["director of nursing", "don", "nursing director"]
home_health_aide: ["home health aide", "home health", "hha"]
```

### Gap 2: Apollo search titles missing healthcare roles
**File:** `supabase/functions/hire-alert-scanner/index.ts`, line 190-199

`tradeTitles` array only has trades — no CNA, RN, LPN, etc. Apollo will never find healthcare candidates.

**Fix:** Add healthcare titles to `tradeTitles`:
```
"Certified Nursing Assistant", "CNA", "Registered Nurse", "LPN", "Licensed Practical Nurse", "Home Health Aide"
```

### Gap 3: MIOSHA scraper has zero healthcare queries
**File:** `supabase/functions/miosha-license-scraper/index.ts`, lines 22-41

`TRADE_QUERIES` only has Boiler/HVAC/Plumber/Electrician. No nursing license queries.

**Fix:** Add 2 healthcare queries:
- "Search Michigan LARA licensing database for recently licensed CNAs and certified nursing assistants..."
- "Search Michigan LARA licensing database for recently licensed RNs and LPNs..."

### Gap 4: `home_health_aide` missing from HireAlert.tsx ROLE_OPTIONS
The healthcare landing page has it, but the main TechAlert signup at `/hire-alert` does NOT offer `home_health_aide` as a selectable role. A healthcare client going through the main page can't select it.

**Fix:** Add `{ key: "home_health_aide", label: "Home Health Aide" }` to `ROLE_OPTIONS` in `HireAlert.tsx`.

### Gap 5: `pressure_vessel` and `industrial_mechanic` missing from Admin ROLE_LABELS
Minor — these trade roles exist in the frontend signup but not in the admin label map. Admin would show raw keys.

**Fix:** Add `pressure_vessel: "PVI"` and `industrial_mechanic: "Ind. Mech"` to `ROLE_LABELS`.

## Summary

| Component | Trades | Healthcare | Status |
|-----------|--------|------------|--------|
| HireAlert.tsx (signup) | ✅ 8 roles | ⚠️ 4/5 (missing home_health_aide) | Fix |
| HealthcareHireAlert.tsx | N/A | ✅ 5/5 | Good |
| Admin ROLE_LABELS | ⚠️ missing 2 | ✅ 5/5 | Fix |
| Scanner ROLE_KEYWORDS | ✅ 8 roles | ❌ 0/5 | **Critical** |
| Apollo tradeTitles | ✅ 8 titles | ❌ 0/5 | **Critical** |
| MIOSHA TRADE_QUERIES | ✅ 4 queries | ❌ 0 queries | **Critical** |
| Database tables | ✅ | ✅ | Good |

## Implementation (4 file edits)

1. **`hire-alert-scanner/index.ts`** — Add 5 healthcare entries to `ROLE_KEYWORDS` + add 6 healthcare titles to `tradeTitles`
2. **`miosha-license-scraper/index.ts`** — Add 2 nursing license queries to `TRADE_QUERIES`
3. **`HireAlert.tsx`** — Add `home_health_aide` to `ROLE_OPTIONS`
4. **`AdminHireAlertClients.tsx`** — Add `pressure_vessel` and `industrial_mechanic` to `ROLE_LABELS`

