// patch-product-titles — fix specific product titles on Printify and re-publish to Etsy
// POST { patches: [{id: string, title: string}] }
const KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const SHOP = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";
const BASE = "https://api.printify.com/v1";

async function pFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
}

async function getShopId(): Promise<string> {
  if (SHOP) return SHOP;
  const r = await pFetch("/shops.json");
  const d = await r.json() as Array<{id: number}>;
  return String(d[0].id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const body = await req.json().catch(() => ({})) as { patches?: Array<{id: string; title: string}> };
  const patches = body.patches ?? [];
  if (!patches.length) return Response.json({ error: "No patches provided" }, { status: 400 });

  const shopId = await getShopId();
  const results: Array<{id: string; oldTitle?: string; newTitle: string; status: string; error?: string}> = [];

  for (const item of patches) {
    try {
      const detailRes = await pFetch(`/shops/${shopId}/products/${item.id}.json`);
      if (!detailRes.ok) throw new Error(`Detail ${detailRes.status}`);
      const detail = await detailRes.json() as {title: string; external?: {id?: string} | null};

      const putRes = await pFetch(`/shops/${shopId}/products/${item.id}.json`, {
        method: "PUT",
        body: JSON.stringify({ title: item.title }),
      });
      if (!putRes.ok) throw new Error(`PUT ${putRes.status}: ${(await putRes.text()).slice(0, 200)}`);

      if (detail.external?.id) {
        await new Promise(r => setTimeout(r, 2_000));
        const pubRes = await pFetch(`/shops/${shopId}/products/${item.id}/publish.json`, {
          method: "POST",
          body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }),
        });
        if (!pubRes.ok) throw new Error(`Publish ${pubRes.status}: ${(await pubRes.text()).slice(0, 200)}`);
        await new Promise(r => setTimeout(r, 5_000));
      }

      results.push({ id: item.id, oldTitle: detail.title, newTitle: item.title, status: "updated" });
    } catch (e) {
      results.push({ id: item.id, newTitle: item.title, status: "error", error: (e as Error).message });
    }
  }

  return Response.json({ results, succeeded: results.filter(r => r.status === "updated").length });
});
