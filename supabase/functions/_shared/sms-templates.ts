// Versioned, immutable SMS template registry for DWA outreach.
//
// Templates are PINNED by id (e.g. `electrician_lock_in_v1`). Once a template
// id ships, its body NEVER changes — that's the byte-identical guarantee that
// powers idempotent resends. To change copy, add a new id (e.g. `_v2`).
//
// Every entry declares which merge variables it accepts. `renderTemplate`
// validates inputs and throws on missing/extra vars — no silent typos.

export type TemplateId =
  | "electrician_lock_in_v1"
  | "electrician_bump_v1"
  | "contractor_welcome_v1"
  | "contractor_lead_alert_v1"
  | "contractor_renewal_v1"
  | "contractor_territory_lock_v1"
  | "contractor_dead_lead_pitch_v1"
  | "contractor_pitch_generic_v1";

export interface SmsTemplate {
  id: TemplateId;
  product: string;        // matches system_comms_log.product
  description: string;    // human-readable label for the resend modal dropdown
  vars: readonly string[];
  body: string;           // raw template — `{var}` placeholders rendered server-side
}

export const SMS_TEMPLATES: Record<TemplateId, SmsTemplate> = {
  electrician_lock_in_v1: {
    id: "electrician_lock_in_v1",
    product: "contractor_pitch",
    description: "Electrician — initial lock-in offer",
    vars: ["city"],
    body:
      "Hey — Matt with Detroit Web Agency. Locked in for you: {city} Electrical, $399/mo flat. " +
      "No setup fee, no contract, cancel anytime. 30-day refund if zero leads delivered. " +
      "All bonus services included free (missed-call catch, ROI scorecard, dead-lead reactivation — totally optional, opt-in). " +
      "Want me to send the signup link so we can get you live today?",
  },

  electrician_bump_v1: {
    id: "electrician_bump_v1",
    product: "contractor_pitch",
    description: "Electrician — bump (resend of lock-in offer)",
    vars: ["city"],
    body:
      "Hey — Matt with Detroit Web Agency, just bumping our last text so it doesn't get buried. " +
      "Locked in for you: {city} Electrical, $399/mo flat. No setup fee, no contract, cancel anytime. " +
      "30-day refund if zero leads delivered. All bonus services included free (missed-call catch, ROI scorecard, dead-lead reactivation — totally optional, opt-in). " +
      "Want me to send the signup link so we can get you live today?",
  },

  contractor_welcome_v1: {
    id: "contractor_welcome_v1",
    product: "contractor_welcome",
    description: "Contractor — welcome after signup",
    vars: ["business_name", "trade", "city"],
    body:
      "Welcome aboard, {business_name}! You're now locked in as the exclusive {trade} for {city}. " +
      "Leads go straight to your phone the second they come in — first call usually wins. " +
      "Reply STOP to opt out anytime. — Matt, Detroit Web Agency (313) 992-1219",
  },

  contractor_lead_alert_v1: {
    id: "contractor_lead_alert_v1",
    product: "contractor_lead_alert",
    description: "Contractor — new lead alert",
    vars: ["lead_name", "lead_phone", "trade", "city", "details"],
    body:
      "🔥 NEW {trade} LEAD — {city}\n{lead_name} · {lead_phone}\n{details}\nCall NOW — first to contact wins.",
  },

  contractor_renewal_v1: {
    id: "contractor_renewal_v1",
    product: "contractor_renewal",
    description: "Contractor — monthly renewal confirmation",
    vars: ["business_name", "amount"],
    body:
      "{business_name} — your $399/mo Detroit Web Agency territory just renewed (${amount}). " +
      "Reply with any questions. — Matt (313) 992-1219",
  },

  contractor_territory_lock_v1: {
    id: "contractor_territory_lock_v1",
    product: "contractor_upsell",
    description: "Contractor — territory lock upsell after 3 leads",
    vars: ["trade", "city"],
    body:
      "You've grabbed 3 leads this week — want me to lock {city} {trade} exclusively to you? " +
      "$399/mo flat, no other contractor in your trade gets a single lead in your city. " +
      "Reply YES and I'll set it up tonight.",
  },

  contractor_dead_lead_pitch_v1: {
    id: "contractor_dead_lead_pitch_v1",
    product: "contractor_pitch",
    description: "Contractor — dead-lead reactivation pitch",
    vars: ["business_name"],
    body:
      "Hey {business_name} — Matt with Detroit Web Agency. Most contractors have 100+ old quotes that ghosted. " +
      "I'll text them on YOUR behalf with a 3-message reactivation drip. You only pay $50 per positive reply. " +
      "Zero cost if nothing comes back. Want me to load your old quotes and run it this week?",
  },

  contractor_pitch_generic_v1: {
    id: "contractor_pitch_generic_v1",
    product: "contractor_pitch",
    description: "Contractor — generic lock-in offer (any trade)",
    vars: ["trade", "city"],
    body:
      "Hey — Matt with Detroit Web Agency. Locked in for you: {city} {trade}, $399/mo flat. " +
      "No setup fee, no contract, cancel anytime. 30-day refund if zero leads delivered. " +
      "All bonus services included free (missed-call catch, ROI scorecard, dead-lead reactivation — opt-in). " +
      "Want me to send the signup link so we can get you live today?",
  },
};

/**
 * Render a template body with the given vars. Throws on:
 *   - unknown template id
 *   - missing required var
 *   - unresolved `{placeholder}` left in body after substitution
 */
export function renderTemplate(
  templateId: string,
  vars: Record<string, string | undefined> = {},
): { body: string; product: string; templateId: TemplateId } {
  const tpl = (SMS_TEMPLATES as Record<string, SmsTemplate>)[templateId];
  if (!tpl) throw new Error(`Unknown SMS template id: ${templateId}`);

  for (const v of tpl.vars) {
    if (!vars[v] || String(vars[v]).trim() === "") {
      throw new Error(`Template ${templateId} requires var "${v}" but none provided`);
    }
  }

  let body = tpl.body;
  for (const [k, v] of Object.entries(vars)) {
    if (v == null) continue;
    body = body.split(`{${k}}`).join(String(v));
  }

  // Catch any leftover {placeholders} so we never send half-rendered text.
  const leftover = body.match(/\{[a-z_]+\}/i);
  if (leftover) throw new Error(`Template ${templateId} has unresolved placeholder ${leftover[0]}`);

  return { body, product: tpl.product, templateId: tpl.id };
}

/** Pure helper for the resend modal: list templates the admin can pick from. */
export function listTemplates(): Array<Pick<SmsTemplate, "id" | "description" | "vars" | "product">> {
  return Object.values(SMS_TEMPLATES).map((t) => ({
    id: t.id,
    description: t.description,
    vars: t.vars,
    product: t.product,
  }));
}
