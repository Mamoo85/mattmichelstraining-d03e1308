// @ts-nocheck
/**
 * Validate all 20 STL generators produce valid binary STL files and a valid ZIP.
 *
 * Run with:
 *   deno run --allow-net scripts/validate-stl-generators.ts
 *
 * Or test via Node (after npm install @jscad/modeling @jscad/stl-serializer fflate):
 *   node --input-type=module < scripts/validate-stl-generators.ts
 *
 * Exit 0 = all pass. Exit 1 = any failure.
 */

import { generateStl, buildStlZip, STL_TEMPLATE_IDS, STL_TEMPLATE_META } from "../supabase/functions/_shared/stl-generators.ts";

interface Result {
  id: string;
  ok: boolean;
  triangles?: number;
  kb?: string;
  error?: string;
}

function validateStlBytes(bytes: Uint8Array, id: string): number {
  if (bytes.length < 84) {
    throw new Error(`STL too small: ${bytes.length} bytes (need ≥ 84)`);
  }
  // Binary STL: bytes 80–83 = triangle count (uint32 LE)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triCount = view.getUint32(80, true);
  if (triCount === 0) {
    throw new Error("0 triangles — geometry is empty");
  }
  // Each triangle = 50 bytes (12-byte normal + 3×12-byte vertices + 2-byte attribute)
  const expected = 84 + triCount * 50;
  if (bytes.length !== expected) {
    throw new Error(`Size mismatch: got ${bytes.length} bytes, expected ${expected} (${triCount} triangles × 50 + 84)`);
  }
  return triCount;
}

async function main() {
  const results: Result[] = [];
  let pass = 0;
  let fail = 0;

  console.log(`\nValidating ${STL_TEMPLATE_IDS.length} STL generators...\n`);

  for (const id of STL_TEMPLATE_IDS) {
    try {
      // Generate STL
      const bytes = generateStl(id);
      const triCount = validateStlBytes(bytes, id);

      // Verify metadata has exactly 13 tags
      const meta = STL_TEMPLATE_META[id];
      if (!meta) throw new Error("Missing metadata entry");
      if (meta.tags.length !== 13) throw new Error(`Expected 13 tags, got ${meta.tags.length}`);
      if (!meta.title) throw new Error("Missing title");
      if (!meta.price_cents || meta.price_cents < 100) throw new Error(`Bad price: ${meta.price_cents}`);

      results.push({ id, ok: true, triangles: triCount, kb: (bytes.length / 1024).toFixed(1) });
      pass++;
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
      fail++;
    }
  }

  // Print results table
  const idW = 25;
  console.log(`  ${"ID".padEnd(idW)}  ${"TRIS".padStart(7)}  ${"SIZE".padStart(8)}  STATUS`);
  console.log(`  ${"─".repeat(idW)}  ${"─".repeat(7)}  ${"─".repeat(8)}  ──────`);
  for (const r of results) {
    if (r.ok) {
      console.log(`  ✅  ${r.id.padEnd(idW)}  ${String(r.triangles).padStart(7)}  ${(r.kb + " KB").padStart(8)}`);
    } else {
      console.log(`  ❌  ${r.id.padEnd(idW)}  ERROR: ${r.error}`);
    }
  }

  // ZIP validation
  console.log("\n📦 Building ZIP with all 20 files...");
  try {
    const zip = buildStlZip(STL_TEMPLATE_IDS);
    if (zip[0] !== 0x50 || zip[1] !== 0x4B) {
      throw new Error("ZIP magic bytes wrong — not a valid ZIP file");
    }
    console.log(`  ✅  ZIP valid: ${(zip.length / 1024).toFixed(1)} KB, ${STL_TEMPLATE_IDS.length} files`);
  } catch (e) {
    console.log(`  ❌  ZIP failed: ${e instanceof Error ? e.message : String(e)}`);
    fail++;
  }

  console.log(`\n${"─".repeat(55)}`);
  if (fail === 0) {
    console.log(`✅  ALL ${pass}/20 PASSED — STL generators are valid and ready to deploy.\n`);
    Deno.exit(0);
  } else {
    console.log(`❌  ${fail} FAILED, ${pass} passed. Fix errors above before deploying.\n`);
    Deno.exit(1);
  }
}

main();
