import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async () => {
  const key = Deno.env.get("OPENAI_API_KEY") ?? "";
  const results: Record<string, unknown> = {};

  for (const model of ["dall-e-3", "dall-e-2", "gpt-image-1"]) {
    const body = model === "dall-e-2"
      ? JSON.stringify({ model, prompt: "A red circle", size: "512x512", n: 1 })
      : JSON.stringify({ model, prompt: "A simple red circle on white background", size: "1024x1024", quality: "standard", n: 1 });

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(60000),
    }).catch(e => null);

    if (!res) { results[model] = "timeout/network error"; continue; }
    const text = await res.text();
    results[model] = { status: res.status, body: text.slice(0, 200) };
    if (res.ok) break; // stop on first success
  }

  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
});
