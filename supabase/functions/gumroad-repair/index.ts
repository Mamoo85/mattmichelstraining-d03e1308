// gumroad-repair — fixes two bugs in gumroad-uploader:
//   1. Products created but never published (wrong endpoint used)
//   2. PDF files not attached (wrong upload endpoint used)
//
// Fix: for each kdp_book with a gumroad_product_id:
//   a. Call PUT /v2/products/{id}/enable  ← correct publish endpoint
//   b. Generate a 10-year signed Supabase Storage URL for the PDF
//   c. Upload the PDF via multipart to /v2/products/{id}/product_files
//   d. Set the signed URL as the product's `url` field (fallback download)
//
// Accepts body: { limit?: number, offset?: number, dryRun?: boolean }
// Run repeatedly with increasing offset to process all books:
//   offset=0  → books 1-5
//   offset=5  → books 6-10
//   ...etc

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (msg: string, data?: unknown) =>
  console.log(`[GUMROAD-REPAIR] ${msg}${data !== undefined ? " — " + JSON.stringify(data) : ""}`);

const TEN_YEARS_SECS = 315_360_000;

async function enableProduct(productId: string, token: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`https://api.gumroad.com/v2/products/${productId}/enable`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: token }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const d = await res.json().catch(() => ({}));
  return { success: d.success === true, error: d.success ? undefined : JSON.stringify(d).slice(0, 300) };
}

async function uploadPdfToGumroad(
  productId: string, token: string,
  pdfBytes: Uint8Array, filename: string,
): Promise<{ success: boolean; error?: string }> {
  // Correct Gumroad file upload endpoint: POST /v2/products/{id}/product_files
  const form = new FormData();
  form.append("access_token", token);
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), filename);
  const res = await fetch(`https://api.gumroad.com/v2/products/${productId}/product_files`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  const d = await res.json().catch(() => ({}));
  if (!d.success) {
    log("PDF upload response (non-success)", { productId, status: res.status, body: JSON.stringify(d).slice(0, 300) });
  }
  return { success: d.success === true, error: d.success ? undefined : `HTTP ${res.status}: ${JSON.stringify(d).slice(0, 200)}` };
}

async function setProductUrl(productId: string, token: string, url: string): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`https://api.gumroad.com/v2/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: token, url }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const d = await res.json().catch(() => ({}));
  return { success: d.success === true, error: d.success ? undefined : JSON.stringify(d).slice(0, 200) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const GUMROAD_TOKEN = Deno.env.get("GUMROAD_ACCESS_TOKEN") ?? "";
  const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!GUMROAD_TOKEN) {
    return new Response(JSON.stringify({ error: "GUMROAD_ACCESS_TOKEN not set" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const limitParam  = Math.min(Number(body.limit  ?? 5), 10); // cap at 10 to avoid 150s wall-clock limit
  const offsetParam = Number(body.offset ?? 0);
  const dryRun = body.dryRun === true;

  log("Starting repair", { limit: limitParam, offset: offsetParam, dryRun });

  // Load gumroad_live books ordered ASC so offset advances forward through all records
  const { data: books, error } = await sb
    .from("kdp_books")
    .select("id, title, gumroad_product_id, file_path")
    .eq("status", "gumroad_live")
    .not("gumroad_product_id", "is", null)
    .not("file_path", "is", null)
    .neq("file_path", "error")
    .order("id", { ascending: true })
    .range(offsetParam, offsetParam + limitParam - 1);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  log(`Found ${books?.length ?? 0} books at offset ${offsetParam}`);

  const results: Array<{
    id: number; title: string;
    enabled: boolean; pdfUploaded: boolean; urlSet: boolean;
    enableError?: string; pdfError?: string; urlError?: string; error?: string;
  }> = [];

  for (const book of (books ?? []) as any[]) {
    const pid  = book.gumroad_product_id as string;
    const title = (book.title as string).slice(0, 60);
    log(`Repairing: ${title}`, { pid, id: book.id });

    const result = {
      id: book.id as number, title,
      enabled: false, pdfUploaded: false, urlSet: false,
    } as typeof results[0];

    if (dryRun) {
      results.push({ ...result, error: "dry-run" });
      continue;
    }

    try {
      // ── 1. Enable (publish) the product ─────────────────────────────────────
      const enableResult = await enableProduct(pid, GUMROAD_TOKEN);
      result.enabled = enableResult.success;
      if (!enableResult.success) result.enableError = enableResult.error;
      log(`Enable result: ${result.enabled}`, { pid });

      // ── 2. Generate signed Supabase URL for the PDF ──────────────────────────
      const { data: signed } = await sb.storage
        .from("kdp-books")
        .createSignedUrl(book.file_path as string, TEN_YEARS_SECS);

      if (signed?.signedUrl) {
        // ── 3. Try to upload PDF bytes directly to Gumroad ──────────────────
        const { data: pdfBlob } = await sb.storage
          .from("kdp-books")
          .download(book.file_path as string);

        if (pdfBlob) {
          const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
          const safeFilename = title.replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-") + ".pdf";
          const uploadResult = await uploadPdfToGumroad(pid, GUMROAD_TOKEN, pdfBytes, safeFilename);
          result.pdfUploaded = uploadResult.success;
          if (!uploadResult.success) result.pdfError = uploadResult.error;
          log(`PDF upload result: ${result.pdfUploaded}`, { pid });
        } else {
          result.pdfError = "Storage download returned no data";
          log("PDF storage download failed", { pid, path: book.file_path });
        }

        // ── 4. Set signed URL as fallback download link ──────────────────────
        const urlResult = await setProductUrl(pid, GUMROAD_TOKEN, signed.signedUrl);
        result.urlSet = urlResult.success;
        if (!urlResult.success) result.urlError = urlResult.error;
        log(`URL set result: ${result.urlSet}`, { pid });
      } else {
        result.pdfError = "Supabase signed URL generation failed";
        log("Failed to generate signed URL", { pid, path: book.file_path });
      }
    } catch (e) {
      result.error = String(e).slice(0, 200);
      log(`Error on ${title}`, { error: result.error });
    }

    results.push(result);
    await new Promise(r => setTimeout(r, 800)); // be nice to Gumroad API
  }

  const enabled    = results.filter(r => r.enabled).length;
  const withPdf    = results.filter(r => r.pdfUploaded).length;
  const withUrl    = results.filter(r => r.urlSet).length;
  const errored    = results.filter(r => r.error).length;

  log("Repair complete", { enabled, withPdf, withUrl, errored, total: results.length, offset: offsetParam });

  return new Response(JSON.stringify({
    ok: true,
    dryRun,
    total: results.length,
    offset: offsetParam,
    nextOffset: offsetParam + results.length,
    enabled,
    pdf_uploaded: withPdf,
    url_set: withUrl,
    errored,
    results,
  }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
