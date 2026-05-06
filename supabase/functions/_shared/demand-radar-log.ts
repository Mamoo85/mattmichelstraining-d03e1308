// Shared logger for demand-radar scanners. Wraps a serve handler and records
// each invocation into public.demand_radar_runs so the admin Live Log can tail it.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Handler = (req: Request) => Promise<Response> | Response;

function pickNum(obj: any, keys: string[]): number {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "number") return v;
  }
  return 0;
}

export function withRunLog(source: string, handler: Handler): Handler {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return handler(req);
    const started = Date.now();
    let response: Response;
    let status: "ok" | "error" | "empty" = "ok";
    let signalsFound = 0;
    let signalsNew = 0;
    let errors: string | null = null;

    try {
      response = await handler(req);
      const cloned = response.clone();
      try {
        const body = await cloned.json();
        signalsFound = pickNum(body, ["signals_found", "total", "scanned", "total_pulled", "leads_total"]);
        signalsNew = pickNum(body, ["signals_new", "inserted", "new", "high_confidence"]);
        if (body?.error) {
          status = "error";
          errors = String(body.error).slice(0, 500);
        } else if (signalsFound === 0 && signalsNew === 0) {
          status = "empty";
        }
      } catch {
        // non-JSON response — treat as ok if HTTP ok
        if (!response.ok) status = "error";
      }
      if (!response.ok && status === "ok") status = "error";
    } catch (e) {
      status = "error";
      errors = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      response = new Response(JSON.stringify({ error: errors }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fire-and-forget log insert (don't block response)
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_KEY);
      sb.from("demand_radar_runs").insert({
        source,
        signals_found: signalsFound,
        signals_new: signalsNew,
        status,
        errors,
        duration_ms: Date.now() - started,
      }).then(() => {}, () => {});
    } catch {/* swallow */}

    return response;
  };
}
