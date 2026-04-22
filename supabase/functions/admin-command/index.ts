// Admin Command Bar — DWA-only natural language agent
// 3-layer: Planner (Gemini Pro) → Tool executor (typed, whitelisted) → Draft generator (Gemini Flash)
// READ-ONLY against DB. Drafts route through email_reply_drafts approval gate. No auto-send.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const ADMIN_EMAILS = new Set([
  "matt@detroitwebagent.com",
  "matt@mattmichelstraining.com",
]);

const WHITELIST_TABLES = new Set([
  "contractor_leads", "contractor_clients", "contractor_lead_sites",
  "industry_pulse_signals",
  "hire_alert_candidates", "hire_alert_clients", "hire_alert_client_candidates",
  "medicare_intel_facilities",
  "prospect_contacts", "field_crm_clients", "business_listings_public",
  "system_comms_log", "dead_lead_contacts", "dead_lead_campaigns",
  "b2b_contacts", "missed_call_clients",
]);

const PRODUCTS = {
  demand_radar:     { name: "Demand Radar",     price: "$149/mo", angle: "Buy-side intent signals before competitors see them." },
  talent_radar:     { name: "Talent Radar",     price: "$149/mo", angle: "Licensed tradespeople entering the market — alerted within hours." },
  contractor_leads: { name: "Contractor Leads", price: "$399/mo", angle: "Exclusive PPL leads in your service area, locked to you." },
  fielddesk:        { name: "FieldDesk",        price: "$199/mo", angle: "Dispatch + GPS tech map + mobile tech app. Replaces eWay/FieldServio." },
  missed_call_catch:{ name: "Missed Call Catch",price: "$99/mo",  angle: "Auto-text every missed call within 30 seconds." },
};

// ─────────────────── helpers ───────────────────

const supa = createClient(SUPABASE_URL, SERVICE_KEY);

async function geminiJSON(model: string, system: string, user: string): Promise<any> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(content); } catch { return { _raw: content }; }
}

// ─────────────────── tool resolvers (READ-ONLY) ───────────────────

type ToolResult = { ok: boolean; rows?: any[]; count?: number; data?: any; error?: string };

function assertTable(t: string) {
  if (!WHITELIST_TABLES.has(t)) throw new Error(`Table "${t}" not whitelisted (DWA-only).`);
}

function applyFilters(q: any, filter: Record<string, any> = {}) {
  for (const [k, v] of Object.entries(filter)) {
    if (v === null) q = q.is(k, null);
    else if (typeof v === "object" && v !== null && "op" in v) {
      const { op, value } = v as { op: string; value: any };
      if (op === "gte") q = q.gte(k, value);
      else if (op === "lte") q = q.lte(k, value);
      else if (op === "gt")  q = q.gt(k, value);
      else if (op === "lt")  q = q.lt(k, value);
      else if (op === "ilike") q = q.ilike(k, value);
      else if (op === "in") q = q.in(k, value);
      else if (op === "neq") q = q.neq(k, value);
    } else {
      q = q.eq(k, v);
    }
  }
  return q;
}

const TOOLS: Record<string, (args: any) => Promise<ToolResult>> = {
  async count_records({ table, filter }) {
    assertTable(table);
    let q = supa.from(table).select("*", { count: "exact", head: true });
    q = applyFilters(q, filter || {});
    const { count, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, count: count ?? 0 };
  },

  async list_records({ table, filter, order_by, ascending = false, limit = 25, columns = "*" }) {
    assertTable(table);
    let q = supa.from(table).select(columns).limit(Math.min(Number(limit) || 25, 100));
    q = applyFilters(q, filter || {});
    if (order_by) q = q.order(order_by, { ascending: !!ascending, nullsFirst: false });
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [], count: (data || []).length };
  },

  async aggregate_records({ table, filter, group_by }) {
    assertTable(table);
    // Simple group-by via fetch + JS aggregation (RPC-free, safe).
    let q = supa.from(table).select(group_by).limit(1000);
    q = applyFilters(q, filter || {});
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    const counts: Record<string, number> = {};
    for (const row of (data || [])) {
      const key = String((row as any)[group_by] ?? "—");
      counts[key] = (counts[key] || 0) + 1;
    }
    const rows = Object.entries(counts)
      .map(([k, v]) => ({ [group_by]: k, count: v }))
      .sort((a: any, b: any) => b.count - a.count);
    return { ok: true, rows, count: rows.length };
  },

  async find_company_contact({ name }) {
    if (!name) return { ok: false, error: "name required" };
    const ilike = `%${name}%`;
    const sources = [
      { t: "field_crm_clients",       cols: "id, business_name, email, phone, website, city, state", col: "business_name" },
      { t: "contractor_clients",      cols: "id, business_name, email, phone, trade, city, state",   col: "business_name" },
      { t: "hire_alert_clients",      cols: "id, business_name, email, phone, target_roles, city",   col: "business_name" },
      { t: "business_listings_public",cols: "id, business_name, email, phone, website, city, state, industry", col: "business_name" },
      { t: "prospect_contacts",       cols: "id, business_name, email, phone, website, city, state, industry", col: "business_name" },
    ];
    const hits: any[] = [];
    for (const s of sources) {
      try {
        const { data } = await supa.from(s.t).select(s.cols).ilike(s.col, ilike).limit(5);
        if (data && data.length) hits.push(...data.map((d: any) => ({ ...d, _source: s.t })));
      } catch (_) { /* table may not exist; skip */ }
    }
    return { ok: true, rows: hits, count: hits.length };
  },

  async find_high_confidence_signals({ industry = null, city = null, min_confidence = 7, limit = 10 }) {
    let q = supa.from("industry_pulse_signals")
      .select("id, company_name, industry, city, state, signal_type, confidence, summary, source_url, created_at")
      .gte("confidence", Number(min_confidence) || 7)
      .order("confidence", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 10, 50));
    if (industry) q = q.ilike("industry", `%${industry}%`);
    if (city) q = q.ilike("city", `%${city}%`);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [], count: (data || []).length };
  },

  async find_unclaimed_leads({ trade = null, city = null, limit = 10 }) {
    let q = supa.from("contractor_leads")
      .select("id, trade, city, state, customer_name, customer_phone, customer_email, job_description, created_at, claimed_at")
      .is("claimed_at", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 10, 50));
    if (trade) q = q.ilike("trade", `%${trade}%`);
    if (city) q = q.ilike("city", `%${city}%`);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [], count: (data || []).length };
  },

  async find_buyers_in_area({ trade = null, city = null, limit = 20 }) {
    let q = supa.from("contractor_clients")
      .select("id, business_name, email, phone, trade, city, state, active")
      .eq("active", true)
      .limit(Math.min(Number(limit) || 20, 50));
    if (trade) q = q.ilike("trade", `%${trade}%`);
    if (city) q = q.ilike("city", `%${city}%`);
    const { data: clients, error } = await q;
    if (error) return { ok: false, error: error.message };
    let rows = clients || [];
    if (rows.length < (Number(limit) || 20)) {
      let q2 = supa.from("business_listings_public")
        .select("id, business_name, email, phone, website, city, state, industry")
        .limit((Number(limit) || 20) - rows.length);
      if (trade) q2 = q2.ilike("industry", `%${trade}%`);
      if (city) q2 = q2.ilike("city", `%${city}%`);
      const { data: extras } = await q2;
      if (extras) rows = [...rows, ...extras.map((e: any) => ({ ...e, _source: "business_listings" }))];
    }
    return { ok: true, rows, count: rows.length };
  },

  async find_hot_candidates_for_client({ client_id = null, role = null, min_score = 7, limit = 10 }) {
    let q = supa.from("hire_alert_candidates")
      .select("id, name, role, employer, city, state, score, contact_phone, contact_email, summary, created_at")
      .gte("score", Number(min_score) || 7)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 10, 50));
    if (role) q = q.ilike("role", `%${role}%`);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [], count: (data || []).length, data: { client_id } };
  },

  async find_stale_prospects({ days = 30, industry = null, limit = 25 }) {
    const cutoff = new Date(Date.now() - Number(days) * 86400_000).toISOString();
    let q = supa.from("business_listings_public")
      .select("id, business_name, email, phone, website, city, state, industry, created_at")
      .lte("created_at", cutoff)
      .limit(Math.min(Number(limit) || 25, 50));
    if (industry) q = q.ilike("industry", `%${industry}%`);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [], count: (data || []).length };
  },

  async find_owed_followups({ days = 14, limit = 25 }) {
    const cutoff = new Date(Date.now() - Number(days) * 86400_000).toISOString();
    const { data, error } = await supa.from("system_comms_log")
      .select("id, direction, contact_phone, contact_email, business_name, body, created_at, channel")
      .eq("direction", "inbound")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(Math.min(Number(limit) || 25, 50));
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: data || [], count: (data || []).length };
  },

  async web_research({ query, max_tokens = 800 }) {
    if (!query) return { ok: false, error: "query required" };
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/openrouter-research`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_tokens }),
      });
      const j = await res.json();
      if (!res.ok) return { ok: false, error: j?.error || `research ${res.status}` };
      return { ok: true, data: { content: j.content, citations: j.citations || [] } };
    } catch (e) {
      return { ok: false, error: String((e as Error).message) };
    }
  },

  async firecrawl_url({ url }) {
    if (!url) return { ok: false, error: "url required" };
    try {
      const { scrape } = await import("../_shared/scraper.ts");
      const r = await scrape(url, { formats: ["markdown"], onlyMainContent: true, maxChars: 4000 });
      if (!r.ok) return { ok: false, error: r.error || "scrape failed" };
      return { ok: true, data: { markdown: (r.markdown || "").slice(0, 4000) } };
    } catch (e) {
      return { ok: false, error: String((e as Error).message) };
    }
  },

  async generate_bulk_outreach({ recipients, product, tone = "direct", hook = null, channel = "email" }) {
    if (!Array.isArray(recipients) || recipients.length === 0) return { ok: false, error: "recipients required" };
    if (recipients.length > 25) recipients = recipients.slice(0, 25);
    const productInfo = (PRODUCTS as any)[product] || { name: product || "DWA service", angle: "" };
    const sys = `You are Matt Michels writing personal cold outreach for Detroit Web Agency (DWA).
Brand voice: industrial, direct, "Digital Engines / Bare Metal." NEVER use "AI", "artificial intelligence", or fitness/training language.
NEVER offer 5-minute calls. NEVER reference Matt Michels Training.
Sender: matt@detroitwebagent.com | Phone: (313) 992-1219
Product being pitched: ${productInfo.name} (${productInfo.price || ""}). Angle: ${productInfo.angle}.
Tone: ${tone}.
${hook ? `Hook context (real data — reference specifically): ${JSON.stringify(hook).slice(0, 1500)}` : ""}
Output STRICT JSON: { "drafts": [ { "to_email": "...", "to_name": "...", "subject": "...", "body": "..." } ] }
Each body: 4–7 short lines, no fluff, ends with one specific question or single CTA. Reference recipient's actual city/trade/business when present.`;
    const usr = `Generate ${recipients.length} personalized ${channel}s, one per recipient. Recipients:\n${JSON.stringify(recipients).slice(0, 4000)}`;
    try {
      const out = await geminiJSON("google/gemini-2.5-flash", sys, usr);
      const drafts = Array.isArray(out?.drafts) ? out.drafts : [];
      return { ok: true, rows: drafts, count: drafts.length, data: { product } };
    } catch (e) {
      return { ok: false, error: String((e as Error).message) };
    }
  },

  async generate_bulk_sms({ recipients, product, tone = "direct", hook = null }) {
    if (!Array.isArray(recipients) || recipients.length === 0) return { ok: false, error: "recipients required" };
    if (recipients.length > 25) recipients = recipients.slice(0, 25);
    const productInfo = (PRODUCTS as any)[product] || { name: product, angle: "" };
    const sys = `You are Matt at Detroit Web Agency drafting cold SMS. ≤160 chars per message.
NEVER mention "AI". Always end with: "Reply STOP to opt out."
From: (313) 992-1219. Product: ${productInfo.name}. Angle: ${productInfo.angle}. Tone: ${tone}.
${hook ? `Hook: ${JSON.stringify(hook).slice(0, 800)}` : ""}
Output STRICT JSON: { "drafts": [ { "to_phone": "...", "to_name": "...", "body": "..." } ] }`;
    const usr = `Generate ${recipients.length} SMS messages.\nRecipients:\n${JSON.stringify(recipients).slice(0, 3000)}`;
    try {
      const out = await geminiJSON("google/gemini-2.5-flash", sys, usr);
      const drafts = Array.isArray(out?.drafts) ? out.drafts : [];
      return { ok: true, rows: drafts, count: drafts.length, data: { product } };
    } catch (e) {
      return { ok: false, error: String((e as Error).message) };
    }
  },

  async draft_outreach({ recipient, product, tone = "direct", hook = null, channel = "email" }) {
    if (!recipient) return { ok: false, error: "recipient required" };
    return await TOOLS.generate_bulk_outreach({
      recipients: [recipient], product, tone, hook, channel,
    });
  },

  async regenerate_single_draft({ recipient, product, tone = "direct", angle = null, hook = null, channel = "email" }) {
    if (!recipient) return { ok: false, error: "recipient required" };
    const productInfo = (PRODUCTS as any)[product] || { name: product || "DWA service", angle: "" };
    const sys = `You are Matt Michels writing ONE personal cold ${channel} for Detroit Web Agency (DWA).
Brand voice: industrial, direct, "Digital Engines / Bare Metal." NEVER use "AI", "artificial intelligence", or fitness/training language.
NEVER offer 5-minute calls. NEVER reference Matt Michels Training.
Sender: matt@detroitwebagent.com | Phone: (313) 992-1219
Product: ${productInfo.name} (${productInfo.price || ""}). Angle: ${productInfo.angle}.
Tone: ${tone}.
${angle ? `Specific angle to lead with: ${String(angle).slice(0, 400)}` : ""}
${hook ? `Hook context (real data — reference specifically): ${JSON.stringify(hook).slice(0, 1500)}` : ""}
Output STRICT JSON: { "drafts": [ { "to_email": "...", "to_name": "...", "subject": "...", "body": "..." } ] }
Body: 4–7 short lines, no fluff, ends with one specific question or single CTA.`;
    const usr = `Generate ONE ${channel} for this recipient:\n${JSON.stringify(recipient).slice(0, 2000)}`;
    try {
      const out = await geminiJSON("google/gemini-2.5-flash", sys, usr);
      const drafts = Array.isArray(out?.drafts) ? out.drafts : [];
      return { ok: true, rows: drafts.slice(0, 1), count: Math.min(drafts.length, 1), data: { product } };
    } catch (e) {
      return { ok: false, error: String((e as Error).message) };
    }
  },
};

const TOOL_NAMES = Object.keys(TOOLS);

// ─────────────────── planner ───────────────────

const PLANNER_SYSTEM = `You are the planner for the DWA Admin Command Bar. The admin types a natural-language request; you produce a multi-step plan using ONLY whitelisted tools.

DWA-ONLY: Refuse anything related to fitness, training, Matt Michels Training, M2, athletes, coaches, programs. If the request is M2-related, return { "abort": true, "reason": "M2 territory — not allowed." }.

Whitelisted tables: ${[...WHITELIST_TABLES].join(", ")}
Whitelisted products: ${Object.keys(PRODUCTS).join(", ")}

Available tools:
- count_records({ table, filter }) — count rows
- list_records({ table, filter, order_by, ascending, limit, columns }) — fetch rows
- aggregate_records({ table, filter, group_by }) — group + count
- find_company_contact({ name }) — search 5 contact tables
- find_high_confidence_signals({ industry?, city?, min_confidence?, limit? })
- find_unclaimed_leads({ trade?, city?, limit? })
- find_buyers_in_area({ trade?, city?, limit? })
- find_hot_candidates_for_client({ client_id?, role?, min_score?, limit? })
- find_stale_prospects({ days?, industry?, limit? })
- find_owed_followups({ days?, limit? })
- web_research({ query, max_tokens? }) — Perplexity-style web lookup
- firecrawl_url({ url }) — scrape a URL
- generate_bulk_outreach({ recipients, product, tone, hook?, channel? }) — N personalized emails (max 25)
- generate_bulk_sms({ recipients, product, tone, hook? }) — N SMS (max 25)
- draft_outreach({ recipient, product, tone, hook?, channel? }) — single draft

Step args may reference prior step results: "{{step_1.rows}}" or "{{step_1.count}}".

Output STRICT JSON:
{
  "reasoning": "1-2 sentences",
  "steps": [
    { "tool": "<name>", "args": { ... } }
  ],
  "output_format": "summary" | "table" | "single_draft" | "bulk_drafts"
}

Rules:
- Max 6 steps.
- For "find X and email/pitch them" requests, always end with generate_bulk_outreach (or draft_outreach for single).
- Pick product field from: ${Object.keys(PRODUCTS).join(", ")}.
- Filter values use plain {key: value} OR {key: {op: "ilike"|"gte"|"lte"|"in", value: ...}}.
- For null filter: use null literally (matches IS NULL).`;

async function plan(prompt: string): Promise<any> {
  return await geminiJSON("google/gemini-2.5-pro", PLANNER_SYSTEM, prompt);
}

// ─────────────────── executor ───────────────────

function resolveRefs(args: any, results: any[]): any {
  if (args == null) return args;
  if (typeof args === "string") {
    const m = args.match(/^\{\{step_(\d+)\.(\w+)\}\}$/);
    if (m) {
      const idx = parseInt(m[1], 10) - 1;
      const key = m[2];
      return results[idx]?.[key];
    }
    return args;
  }
  if (Array.isArray(args)) return args.map((a) => resolveRefs(a, results));
  if (typeof args === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(args)) out[k] = resolveRefs(v, results);
    return out;
  }
  return args;
}

async function executePlan(planObj: any) {
  const stepResults: ToolResult[] = [];
  const stepLog: any[] = [];
  const steps = (planObj?.steps || []).slice(0, 6);
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const tool = step.tool;
    if (!TOOL_NAMES.includes(tool)) {
      stepLog.push({ step: i + 1, tool, ok: false, error: `Unknown tool "${tool}"` });
      stepResults.push({ ok: false, error: `Unknown tool "${tool}"` });
      continue;
    }
    const args = resolveRefs(step.args || {}, stepResults);
    try {
      const result = await TOOLS[tool](args);
      stepResults.push(result);
      stepLog.push({
        step: i + 1, tool, ok: result.ok,
        count: result.count ?? (result.rows?.length ?? 0),
        error: result.error,
        preview: result.rows?.slice(0, 3),
      });
      if (!result.ok) break; // partial result return
    } catch (e) {
      const error = String((e as Error).message);
      stepResults.push({ ok: false, error });
      stepLog.push({ step: i + 1, tool, ok: false, error });
      break;
    }
  }
  return { stepResults, stepLog };
}

// ─────────────────── main handler ───────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let adminEmail = "";
    if (token) {
      try {
        const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data } = await userClient.auth.getUser();
        adminEmail = data?.user?.email || "";
      } catch (_) { /* ignore */ }
    }
    if (!ADMIN_EMAILS.has(adminEmail)) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cost cap (>$5 in 24h)
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();
    const { data: costRows } = await supa.from("admin_command_log")
      .select("total_cost_usd").eq("admin_email", adminEmail).gte("created_at", dayAgo);
    const dailyCost = (costRows || []).reduce((s: number, r: any) => s + Number(r.total_cost_usd || 0), 0);
    if (dailyCost > 5) {
      return new Response(JSON.stringify({ error: "Daily cost cap exceeded ($5). Try again tomorrow." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action = "run", prompt = "", queue_drafts = null, log_id = null } = body;

    // ── Queue drafts to email_reply_drafts (approval gate) ──
    if (action === "queue") {
      if (!Array.isArray(queue_drafts) || queue_drafts.length === 0) {
        return new Response(JSON.stringify({ error: "No drafts to queue" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sendAfter = new Date(Date.now() + 10 * 60_000).toISOString(); // 10-min ghost delay
      const inserts = queue_drafts.slice(0, 25).map((d: any) => ({
        lead_email: d.to_email || d.lead_email,
        draft_subject: d.subject || "",
        draft_body: d.body || "",
        category: "admin_command_dwa",
        send_after: sendAfter,
        sent: false,
        cancelled: false,
      })).filter((d: any) => !!d.lead_email && !!d.draft_body);

      if (inserts.length === 0) {
        return new Response(JSON.stringify({ error: "No valid drafts (need lead_email + body)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: insErr } = await supa.from("email_reply_drafts").insert(inserts);
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (log_id) {
        await supa.from("admin_command_log").update({ user_action: `queued_${inserts.length}` }).eq("id", log_id);
      }
      return new Response(JSON.stringify({ ok: true, queued: inserts.length, send_after: sendAfter }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Run command ──
    if (!prompt || prompt.length < 3) {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Plan
    let planObj: any;
    try {
      planObj = await plan(prompt);
    } catch (e) {
      return new Response(JSON.stringify({ error: `Planner failed: ${(e as Error).message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (planObj?.abort) {
      const { data: logRow } = await supa.from("admin_command_log").insert({
        admin_email: adminEmail, prompt, plan_json: planObj, user_action: "aborted_m2", error_message: planObj.reason,
      }).select("id").single();
      return new Response(JSON.stringify({
        ok: false, aborted: true, reason: planObj.reason || "M2 territory", log_id: logRow?.id,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Execute
    const { stepResults, stepLog } = await executePlan(planObj);

    // Build response
    const lastResult = stepResults[stepResults.length - 1] || {};
    const drafts = (lastResult.rows && stepLog[stepLog.length - 1]?.tool?.includes("outreach")) || stepLog[stepLog.length - 1]?.tool?.includes("sms")
      ? lastResult.rows
      : null;
    const dataRows: any[] = [];
    for (const r of stepResults) if (r.ok && r.rows) dataRows.push(...r.rows);

    const totalCost = 0.01 + (planObj.steps?.length || 0) * 0.001;
    const toolsUsed = (planObj.steps || []).map((s: any) => s.tool);
    const webCalls = toolsUsed.filter((t: string) => t === "web_research" || t === "firecrawl_url").length;

    const { data: logRow } = await supa.from("admin_command_log").insert({
      admin_email: adminEmail,
      prompt,
      plan_json: planObj,
      steps: stepLog,
      tools_used: toolsUsed,
      rows_returned: dataRows.length,
      web_calls: webCalls,
      total_cost_usd: totalCost,
      draft_output: drafts ? { drafts } : null,
    }).select("id").single();

    return new Response(JSON.stringify({
      ok: true,
      log_id: logRow?.id,
      reasoning: planObj.reasoning || "",
      output_format: planObj.output_format || "summary",
      steps: stepLog,
      data_rows: dataRows.slice(0, 50),
      drafts,
      partial: stepResults.some((r) => !r.ok),
      cost_usd: totalCost,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[admin-command] error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
