import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// This function checks if Oz (and other critical agents) have run recently.
// If any agent has missed its expected window, it alerts Matt.

const AGENT_SCHEDULES = [
  { name: "Oz", table: "agent_heartbeats", maxMinutes: 30 },
  { name: "Shield", table: "agent_heartbeats", maxMinutes: 1500 }, // ~25h
  { name: "Cashier", table: "agent_heartbeats", maxMinutes: 1500 },
  { name: "Tom", table: "agent_heartbeats", maxMinutes: 1500 },
  { name: "Pulse", table: "agent_heartbeats", maxMinutes: 300 }, // 5h
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const missing: string[] = [];

    for (const agent of AGENT_SCHEDULES) {
      const { data } = await sb
        .from("agent_heartbeats")
        .select("last_beat")
        .eq("agent_name", agent.name)
        .single();

      if (!data) {
        missing.push(`${agent.name}: NO HEARTBEAT RECORD`);
        continue;
      }

      const lastBeat = new Date(data.last_beat);
      const minutesAgo = (Date.now() - lastBeat.getTime()) / 60000;

      if (minutesAgo > agent.maxMinutes) {
        missing.push(`${agent.name}: last beat ${Math.round(minutesAgo)} min ago (expected every ${agent.maxMinutes} min)`);
      }
    }

    if (missing.length > 0 && RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "System Alert <matt@mattmichelstraining.com>",
          to: ["matthewmichels4@gmail.com"],
          subject: `🚨 ${missing.length} Agent(s) DOWN — Heartbeat Alert`,
          html: `<div style="font-family:sans-serif;max-width:640px;margin:auto;padding:20px;background:#7f1d1d;color:#fecaca;border-radius:12px;">
            <h2>⚠️ Agent Heartbeat Failure</h2>
            <p>The following agents have missed their expected run windows:</p>
            <ul>${missing.map(m => `<li><strong>${m}</strong></li>`).join("")}</ul>
            <p>Check edge function logs for errors.</p>
          </div>`,
        }),
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      missing_agents: missing,
      all_healthy: missing.length === 0,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[HEARTBEAT]", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
  }
});
