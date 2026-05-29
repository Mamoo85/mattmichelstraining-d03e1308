import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async () => {
  const keystring = Deno.env.get("ETSY_API_KEY") ?? "";
  const sharedSecret = Deno.env.get("ETSY_SHARED_SECRET") ?? "";
  const apiKey = sharedSecret ? `${keystring}:${sharedSecret}` : keystring;
  const url = "https://openapi.etsy.com/v3/application/listings/active?keywords=funny+nurse+mug&sort_on=score&limit=5";
  const res = await fetch(url, { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(15000) });
  const body = await res.text();
  return new Response(JSON.stringify({ status: res.status, keyPresent: apiKey.length > 0, body: body.slice(0, 800) }), {
    headers: { "Content-Type": "application/json" }
  });
});
