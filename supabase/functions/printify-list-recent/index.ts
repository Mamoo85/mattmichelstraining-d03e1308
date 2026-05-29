const KEY = Deno.env.get("PRINTIFY_API_TOKEN") ?? "";
const SHOP = Deno.env.get("PRINTIFY_SHOP_ID") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  const body = await req.json().catch(() => ({}));
  const page = typeof body.page === "number" ? body.page : 1;

  const shopRes = await fetch(`https://api.printify.com/v1/shops.json`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const shops = await shopRes.json();
  const shopId = SHOP || String((shops as Array<{id: number}>)[0]?.id);

  const res = await fetch(`https://api.printify.com/v1/shops/${shopId}/products.json?page=${page}&limit=20`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const data = await res.json() as Record<string, unknown>;
  const items = Array.isArray(data.data) ? data.data as Array<{id: string; title: string; blueprint_id: number; external?: {id?: string}}> : [];

  return Response.json({
    page,
    total: data.total,
    products: items.map((p) => ({ id: p.id, title: p.title, blueprint_id: p.blueprint_id, published: !!p.external?.id })),
  });
});
