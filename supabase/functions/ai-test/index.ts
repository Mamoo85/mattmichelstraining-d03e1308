import "jsr:@supabase/functions-js/edge-runtime.d.ts";
Deno.serve(async () => {
  const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

  const prompt = "Say hello in 5 words.";

  // Test Anthropic
  let anthropicResult = "";
  let anthropicStatus = 0;
  if (ANTHROPIC_KEY) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 50, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(15000),
    });
    anthropicStatus = r.status;
    const body = await r.text();
    if (r.ok) anthropicResult = JSON.parse(body)?.content?.[0]?.text ?? "";
    else anthropicResult = body.slice(0, 200);
  }

  // Test OpenAI (gpt-4o-mini to avoid model-not-found issues)
  let openaiResult = "";
  let openaiStatus = 0;
  if (OPENAI_KEY) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 50, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(15000),
    });
    openaiStatus = r.status;
    const body = await r.text();
    if (r.ok) openaiResult = JSON.parse(body)?.choices?.[0]?.message?.content ?? "";
    else openaiResult = body.slice(0, 200);
  }

  return new Response(JSON.stringify({
    anthropic: { keyPresent: ANTHROPIC_KEY.length > 0, status: anthropicStatus, result: anthropicResult },
    openai: { keyPresent: OPENAI_KEY.length > 0, status: openaiStatus, result: openaiResult },
    lovable: { keyPresent: LOVABLE_KEY.length > 0 },
  }), { headers: { "Content-Type": "application/json" } });
});
