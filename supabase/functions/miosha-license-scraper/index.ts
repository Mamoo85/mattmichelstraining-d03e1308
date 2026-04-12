// miosha-license-scraper — scrapes Michigan LARA license database directly
// Uses Firecrawl to fetch actual LARA VAL pages (not web search — real DB pages)
// Upserts into hire_alert_candidates by license_number (dedup key)
// Called by hire-alert-scanner OR run standalone via cron/admin trigger.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

// Michigan LARA license type codes for trades we care about
// Source: https://w2.lara.state.mi.us/VAL/License/Search
const LARA_LICENSE_TYPES = [
  { code: "BOP",  label: "Boiler Operator 1st Class" },
  { code: "BOP2", label: "Boiler Operator 2nd Class" },
  { code: "SE",   label: "Steam Engineer" },
  { code: "HVAC", label: "HVAC Contractor" },
  { code: "PL",   label: "Plumbing Contractor" },
];

// Base URL for Michigan LARA VAL license search — sorted by issue date descending
// so we always pick up the newest licenses first
const LARA_SEARCH_URL = "https://w2.lara.state.mi.us/VAL/License/Search";

interface LicenseCandidate {
  full_name: string;
  license_type: string;
  license_number: string | null;
  license_expiry: string | null;
  city: string | null;
  source: "miosha";
}

async function scrapeLARAType(licenseCode: string, label: string): Promise<LicenseCandidate[]> {
  if (!FIRECRAWL_API_KEY) return [];

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Direct fetch of the LARA search results for this license type,
        // sorted by IssuedDate DESC so fresh licenses appear first.
        url: `${LARA_SEARCH_URL}?ltype=${licenseCode}&sort=issued&order=desc&page=1`,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000, // wait for JS table to render
        actions: [
          // Some LARA pages need a button click to run the search
          { type: "wait", milliseconds: 2000 },
        ],
      }),
    });
    clearTimeout(tid);

    if (!res.ok) {
      console.warn(`[miosha-scraper] Firecrawl HTTP ${res.status} for ${licenseCode}`);
      return [];
    }

    const data = await res.json();
    const markdown: string = data?.data?.markdown || "";

    if (!markdown || markdown.length < 100) {
      console.warn(`[miosha-scraper] Empty/short response for ${licenseCode} (${markdown.length} chars)`);
      return [];
    }

    // Parse the markdown table — LARA tables look like:
    // | Name | License # | Type | City | Issued | Expiry |
    return parseLARATable(markdown, label);
  } catch (e: unknown) {
    clearTimeout(tid);
    const isAbort = e instanceof Error && e.name === "AbortError";
    console.warn(`[miosha-scraper] ${isAbort ? "Timeout" : "Error"} scraping ${licenseCode}`);
    return [];
  }
}

function parseLARATable(markdown: string, licenseLabel: string): LicenseCandidate[] {
  const candidates: LicenseCandidate[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((s) => s.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    // Skip header rows
    const firstCell = cells[0].toLowerCase();
    if (firstCell === "name" || firstCell === "licensee" || firstCell.startsWith("-")) continue;

    // Heuristic: first cell is a name (contains letters, no digits run)
    // Second or third cell is a license number (alphanumeric)
    const nameCell = cells[0];
    if (!/[A-Za-z]{2,}/.test(nameCell)) continue;
    if (nameCell.length < 3 || nameCell.length > 60) continue;

    // Try to extract license number (pattern: letters+digits, e.g. BOP12345)
    const licNumCell = cells.find((c) => /^[A-Z]{1,5}\d{4,}$/i.test(c.replace(/\s/g, "")));

    // Try to find an expiry date (MM/DD/YYYY or YYYY-MM-DD)
    const datePattern = /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/;
    const expiryCell = cells.slice(2).find((c) => datePattern.test(c));
    let expiryISO: string | null = null;
    if (expiryCell) {
      const m = expiryCell.match(datePattern);
      if (m) {
        const raw = m[0];
        if (raw.includes("/")) {
          const [mm, dd, yyyy] = raw.split("/");
          expiryISO = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        } else {
          expiryISO = raw;
        }
      }
    }

    // Try to find a Michigan city in the cells
    const miCityCell = cells.find((c) =>
      /^[A-Za-z\s]{3,20}$/.test(c) && c !== nameCell && !/license|type|number|city|state/i.test(c)
    );

    candidates.push({
      full_name: nameCell,
      license_type: licenseLabel,
      license_number: licNumCell ? licNumCell.replace(/\s/g, "").toUpperCase() : null,
      license_expiry: expiryISO,
      city: miCityCell || null,
      source: "miosha",
    });
  }

  return candidates;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  try {
    for (const { code, label } of LARA_LICENSE_TYPES) {
      const candidates = await scrapeLARAType(code, label);
      console.log(`[miosha-scraper] ${code}: found ${candidates.length} candidates`);

      for (const c of candidates) {
        try {
          const row: Record<string, unknown> = {
            full_name: c.full_name,
            license_type: c.license_type,
            source: "miosha",
            last_seen_at: new Date().toISOString(),
          };
          if (c.license_number) row.license_number = c.license_number;
          if (c.license_expiry) row.license_expiry = c.license_expiry;
          if (c.city) row.city = c.city;

          if (c.license_number) {
            // Upsert by license_number — avoids re-alerting on the same person
            const { data: existing } = await sb
              .from("hire_alert_candidates")
              .select("id, status")
              .eq("license_number", c.license_number)
              .maybeSingle();

            if (existing) {
              await sb
                .from("hire_alert_candidates")
                .update({ last_seen_at: new Date().toISOString() })
                .eq("id", existing.id);
              updatedCount++;
            } else {
              await sb.from("hire_alert_candidates").insert({ ...row, status: "new", first_seen_at: new Date().toISOString() });
              newCount++;
            }
          } else {
            // No license number — check for duplicate by name + license_type
            const { data: existing } = await sb
              .from("hire_alert_candidates")
              .select("id")
              .eq("full_name", c.full_name)
              .eq("license_type", c.license_type)
              .eq("source", "miosha")
              .maybeSingle();

            if (!existing) {
              await sb.from("hire_alert_candidates").insert({ ...row, status: "new", first_seen_at: new Date().toISOString() });
              newCount++;
            } else {
              updatedCount++;
            }
          }
        } catch (e) {
          console.error(`[miosha-scraper] insert error for ${c.full_name}:`, e);
          errorCount++;
        }
      }
    }

    console.log(`[miosha-scraper] done: new=${newCount} updated=${updatedCount} errors=${errorCount}`);
    return new Response(
      JSON.stringify({ ok: true, new: newCount, updated: updatedCount, errors: errorCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[miosha-scraper] Fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
