// gumroad-uploader — runs every 30 min after kdp-book-generator
// Cleans up any old bad-titled products, then publishes new ready books to Gumroad.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, data?: unknown) =>
  console.log(`[GUMROAD] ${step}${data ? " — " + JSON.stringify(data) : ""}`);

const PRICE_CENTS = 499; // $4.99

async function gumroadDelete(productId: string, token: string): Promise<void> {
  const res = await fetch(`https://api.gumroad.com/v2/products/${productId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ access_token: token }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (data.success || res.status === 404) {
    log("Deleted old product from Gumroad", { productId });
  } else {
    log("Delete attempt (non-fatal)", { productId, status: res.status });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const GUMROAD_TOKEN = Deno.env.get("GUMROAD_ACCESS_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!GUMROAD_TOKEN) {
    return new Response(JSON.stringify({
      error: "GUMROAD_ACCESS_TOKEN not set. Get it from gumroad.com → Settings → Advanced → Access Token",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── Step 1: Clean up old bad-titled products (one-time, runs until all cleared) ──
  const { data: staleBooks } = await sb
    .from("kdp_books")
    .select("id, gumroad_old_product_id")
    .not("gumroad_old_product_id", "is", null)
    .limit(10);

  if (staleBooks && staleBooks.length > 0) {
    log("Cleaning up old Gumroad products", { count: staleBooks.length });
    for (const book of staleBooks as any[]) {
      await gumroadDelete(book.gumroad_old_product_id, GUMROAD_TOKEN);
      await sb.from("kdp_books")
        .update({ gumroad_old_product_id: null })
        .eq("id", book.id);
    }
  }

  // ── Step 2: Find ready books not yet on Gumroad ──────────────────────────────
  const { data: books, error: fetchErr } = await sb
    .from("kdp_books")
    .select("id, niche, title, description, keywords, file_path, cover_url")
    .eq("status", "ready")
    .is("gumroad_product_id", null)
    .order("created_at", { ascending: true })
    .limit(5);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!books || books.length === 0) {
    log("No books ready to upload");
    return new Response(
      JSON.stringify({ published: 0, message: "No books ready" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  log("Publishing books to Gumroad", { count: books.length });
  const published: string[] = [];

  for (const book of books as any[]) {
    try {
      // 1. Download PDF from Supabase Storage
      log("Downloading PDF", { path: book.file_path });
      const { data: fileBlob, error: dlErr } = await sb.storage
        .from("kdp-books")
        .download(book.file_path);
      if (dlErr || !fileBlob) throw new Error(`Storage download failed: ${dlErr?.message}`);

      const pdfBytes = new Uint8Array(await fileBlob.arrayBuffer());
      log("Downloaded PDF", { sizeKb: Math.round(pdfBytes.length / 1024) });

      // 2. Create Gumroad product (unpublished first so file upload can attach)
      const desc = [
        book.description || `A fun word search puzzle book themed around ${book.niche}.`,
        "",
        "20 themed puzzles with full answer key included.",
        "Perfect as a gift or personal activity!",
        "",
        `Tags: ${(book.keywords ?? []).join(", ")}`,
      ].join("\n").slice(0, 2000);

      const createBody: Record<string, string> = {
        access_token: GUMROAD_TOKEN,
        name: book.title,
        description: desc,
        price: String(PRICE_CENTS),
        published: "false",
      };
      // Pass cover image URL as preview if available
      if (book.cover_url) {
        createBody.preview_url = book.cover_url;
      }

      const createRes = await fetch("https://api.gumroad.com/v2/products", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(createBody).toString(),
        signal: AbortSignal.timeout(15_000),
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(`Gumroad create failed: ${JSON.stringify(createData).slice(0, 300)}`);

      const productId: string = createData.product.id;
      log("Product created", { productId, title: book.title.slice(0, 40) });

      // 3. Upload PDF file as multipart
      const safeFileName = book.title
        .slice(0, 60).replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-") + ".pdf";

      const formData = new FormData();
      formData.append("access_token", GUMROAD_TOKEN);
      formData.append("file", new Blob([pdfBytes], { type: "application/pdf" }), safeFileName);

      // Correct endpoint: POST /product_files (was wrong PUT /files)
      const uploadRes = await fetch(`https://api.gumroad.com/v2/products/${productId}/product_files`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(90_000),
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadData.success) {
        log("File upload issue (still publishing)", {
          status: uploadRes.status,
          body: JSON.stringify(uploadData).slice(0, 200),
        });
      } else {
        log("File uploaded", { productId });
      }

      // Also set signed URL as fallback download (10-year signed link)
      const { data: signed } = await sb.storage.from("kdp-books").createSignedUrl(book.file_path, 315_360_000);
      if (signed?.signedUrl) {
        await fetch(`https://api.gumroad.com/v2/products/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ access_token: GUMROAD_TOKEN, url: signed.signedUrl }).toString(),
          signal: AbortSignal.timeout(15_000),
        });
      }

      // 4. Publish the product — correct endpoint: PUT /enable
      const pubRes = await fetch(`https://api.gumroad.com/v2/products/${productId}/enable`, {
        method: "PUT",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: GUMROAD_TOKEN }).toString(),
        signal: AbortSignal.timeout(15_000),
      });
      const pubData = await pubRes.json().catch(() => ({}));
      const productUrl: string = pubData.product?.short_url ?? `https://gumroad.com/l/${productId}`;
      log("Product published", { productId, url: productUrl });

      // 5. Record in DB
      await sb.from("kdp_books").update({
        gumroad_product_id: productId,
        gumroad_url: productUrl,
        status: "gumroad_live",
      }).eq("id", book.id);

      published.push(book.title.slice(0, 60));
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      log("Error publishing book", { id: book.id, error: String(err).slice(0, 200) });
    }
  }

  log("Done", { published: published.length });
  return new Response(
    JSON.stringify({ published: published.length, titles: published }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
