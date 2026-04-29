// scripts/orphan-scan.ts
// CI script: scans src/App.tsx for lazy imports of pages, cross-references src/pages/
// to find orphaned route files. Optionally writes results to orphan_scan_results table.
//
// Run locally:  npx tsx scripts/orphan-scan.ts
// Run in CI:    npx tsx scripts/orphan-scan.ts --write   (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const APP_TSX = join(ROOT, "src/App.tsx");
const PAGES_DIR = join(ROOT, "src/pages");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

function extractImportedPages(appSrc: string): Set<string> {
  // Matches:  lazyRetry(() => import("./pages/Foo"))   or   import("@/pages/Foo")
  const refs = new Set<string>();
  const re = /import\(\s*["'](?:@\/|\.\/)pages\/([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(appSrc)) !== null) {
    refs.add(m[1].replace(/\.(tsx|ts)$/, ""));
  }
  return refs;
}

function pageRelativePath(absolute: string): string {
  return relative(PAGES_DIR, absolute).replace(/\.(tsx|ts)$/, "").replaceAll("\\", "/");
}

const appSrc = readFileSync(APP_TSX, "utf8");
const imported = extractImportedPages(appSrc);
const allPages = walk(PAGES_DIR).map(pageRelativePath);

const orphans = allPages.filter((p) => !imported.has(p));
const summary = {
  scanned_at: new Date().toISOString(),
  total_pages: allPages.length,
  imported_pages: imported.size,
  orphan_count: orphans.length,
  orphans,
};

console.log(JSON.stringify(summary, null, 2));

if (process.argv.includes("--write")) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[orphan-scan] --write requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }
  const res = await fetch(`${url}/rest/v1/orphan_scan_results`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      scanned_at: summary.scanned_at,
      total_pages: summary.total_pages,
      orphan_count: summary.orphan_count,
      orphans: summary.orphans,
    }),
  });
  if (!res.ok) {
    console.error("[orphan-scan] write failed:", res.status, await res.text());
    process.exit(3);
  }
  console.log("[orphan-scan] wrote results to orphan_scan_results");
}

// Non-zero exit on orphans so CI surfaces the issue but does NOT block deploy
// (advisory only — flip to process.exit(1) once all orphans are resolved).
if (orphans.length > 0) {
  console.warn(`[orphan-scan] ⚠️  ${orphans.length} orphaned page(s) found`);
}
