/**
 * Shared Twilio SMS utility.
 * Uses TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN directly — no Lovable gateway needed.
 *
 * TCPA / 10DLC COMPLIANCE LAYERS (in order):
 *   1. E.164 validation — US numbers only (+1XXXXXXXXXX)
 *   2. sms_opt_outs scrub — STOP-replied numbers blocked instantly
 *   3. Quiet-hours gate — 8am–9pm recipient local time (FCC TCPA rule)
 *      - Bypass allowed ONLY for transactional products (missed_call,
 *        appointment_reminder, field_service, dead_lead_reply, test-sms)
 *   4. Demo-mode sinkhole — redirects to admin phone with [DEMO] prefix
 *
 * Every send/skip/fail is logged to system_comms_log.
 * Every block is logged to compliance_blocks.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "./error-log.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Admin phone — use env var, fall back to Matt's number
export const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE") ?? "+13138064952";

/**
 * Stable hash for dedup + idempotent resend.
 * Same recipient + body + product → same hash → same conversation slot.
 * Used by `dwa-resend-sms` to detect "we already sent this exact text in last 24h".
 */
export async function computeBodyHash(
  recipient: string,
  body: string,
  product: string | null,
): Promise<string> {
  const input = `${recipient}|${product ?? ""}|${body}`;
  const buf = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Products allowed to bypass quiet hours (transactional / inbound-reply only).
// Marketing, drip, blast, weekly_sms_blast, text_marketing, etc. NEVER bypass.
const QUIET_HOURS_BYPASS_PRODUCTS = new Set([
  "missed_call",
  "appointment_reminder",
  "field_service",
  "dead_lead_reply",
  "dwa_admin_reply",
  "test-sms",
  "test_sms",
]);

// E.164 US-only regex
const US_E164 = /^\+1\d{10}$/;

/**
 * Map US area code → IANA timezone.
 * Source: NANPA area code assignments. Conservative defaults used where
 * area codes span multiple timezones (picks the most populous zone).
 */
const AREA_CODE_TZ: Record<string, string> = {
  // Eastern
  "201": "America/New_York", "202": "America/New_York", "203": "America/New_York",
  "207": "America/New_York", "212": "America/New_York", "215": "America/New_York",
  "216": "America/New_York", "217": "America/Chicago",  "218": "America/Chicago",
  "224": "America/Chicago",  "225": "America/Chicago",  "227": "America/New_York",
  "228": "America/Chicago",  "229": "America/New_York", "231": "America/New_York",
  "234": "America/New_York", "239": "America/New_York", "240": "America/New_York",
  "248": "America/New_York", "251": "America/Chicago",  "252": "America/New_York",
  "253": "America/Los_Angeles", "254": "America/Chicago", "256": "America/Chicago",
  "260": "America/New_York", "262": "America/Chicago",  "267": "America/New_York",
  "269": "America/New_York", "270": "America/Chicago",  "272": "America/New_York",
  "274": "America/Chicago",  "276": "America/New_York", "281": "America/Chicago",
  "283": "America/New_York", "301": "America/New_York", "302": "America/New_York",
  "303": "America/Denver",   "304": "America/New_York", "305": "America/New_York",
  "307": "America/Denver",   "308": "America/Chicago",  "309": "America/Chicago",
  "310": "America/Los_Angeles", "312": "America/Chicago", "313": "America/New_York",
  "314": "America/Chicago",  "315": "America/New_York", "316": "America/Chicago",
  "317": "America/New_York", "318": "America/Chicago",  "319": "America/Chicago",
  "320": "America/Chicago",  "321": "America/New_York", "323": "America/Los_Angeles",
  "325": "America/Chicago",  "330": "America/New_York", "331": "America/Chicago",
  "334": "America/Chicago",  "336": "America/New_York", "337": "America/Chicago",
  "339": "America/New_York", "340": "America/Puerto_Rico", "346": "America/Chicago",
  "347": "America/New_York", "351": "America/New_York", "352": "America/New_York",
  "360": "America/Los_Angeles", "361": "America/Chicago", "364": "America/Chicago",
  "380": "America/New_York", "385": "America/Denver",   "386": "America/New_York",
  "401": "America/New_York", "402": "America/Chicago",  "404": "America/New_York",
  "405": "America/Chicago",  "406": "America/Denver",   "407": "America/New_York",
  "408": "America/Los_Angeles", "409": "America/Chicago", "410": "America/New_York",
  "412": "America/New_York", "413": "America/New_York", "414": "America/Chicago",
  "415": "America/Los_Angeles", "417": "America/Chicago", "419": "America/New_York",
  "423": "America/New_York", "424": "America/Los_Angeles", "425": "America/Los_Angeles",
  "430": "America/Chicago",  "432": "America/Chicago",  "434": "America/New_York",
  "435": "America/Denver",   "440": "America/New_York", "442": "America/Los_Angeles",
  "443": "America/New_York", "445": "America/New_York", "447": "America/Chicago",
  "458": "America/Los_Angeles", "463": "America/New_York", "464": "America/Chicago",
  "469": "America/Chicago",  "470": "America/New_York", "475": "America/New_York",
  "478": "America/New_York", "479": "America/Chicago",  "480": "America/Phoenix",
  "484": "America/New_York", "501": "America/Chicago",  "502": "America/New_York",
  "503": "America/Los_Angeles", "504": "America/Chicago", "505": "America/Denver",
  "507": "America/Chicago",  "508": "America/New_York", "509": "America/Los_Angeles",
  "510": "America/Los_Angeles", "512": "America/Chicago", "513": "America/New_York",
  "515": "America/Chicago",  "516": "America/New_York", "517": "America/New_York",
  "518": "America/New_York", "520": "America/Phoenix",  "530": "America/Los_Angeles",
  "531": "America/Chicago",  "534": "America/Chicago",  "539": "America/Chicago",
  "540": "America/New_York", "541": "America/Los_Angeles", "551": "America/New_York",
  "557": "America/Chicago",  "559": "America/Los_Angeles", "561": "America/New_York",
  "562": "America/Los_Angeles", "563": "America/Chicago", "564": "America/Los_Angeles",
  "567": "America/New_York", "570": "America/New_York", "571": "America/New_York",
  "573": "America/Chicago",  "574": "America/New_York", "575": "America/Denver",
  "580": "America/Chicago",  "585": "America/New_York", "586": "America/New_York",
  "601": "America/Chicago",  "602": "America/Phoenix",  "603": "America/New_York",
  "605": "America/Chicago",  "606": "America/New_York", "607": "America/New_York",
  "608": "America/Chicago",  "609": "America/New_York", "610": "America/New_York",
  "612": "America/Chicago",  "614": "America/New_York", "615": "America/Chicago",
  "616": "America/New_York", "617": "America/New_York", "618": "America/Chicago",
  "619": "America/Los_Angeles", "620": "America/Chicago", "623": "America/Phoenix",
  "626": "America/Los_Angeles", "628": "America/Los_Angeles", "629": "America/Chicago",
  "630": "America/Chicago",  "631": "America/New_York", "636": "America/Chicago",
  "640": "America/New_York", "641": "America/Chicago",  "646": "America/New_York",
  "650": "America/Los_Angeles", "651": "America/Chicago", "657": "America/Los_Angeles",
  "659": "America/Chicago",  "660": "America/Chicago",  "661": "America/Los_Angeles",
  "662": "America/Chicago",  "667": "America/New_York", "669": "America/Los_Angeles",
  "678": "America/New_York", "680": "America/New_York", "681": "America/New_York",
  "682": "America/Chicago",  "684": "Pacific/Pago_Pago", "689": "America/New_York",
  "701": "America/Chicago",  "702": "America/Los_Angeles", "703": "America/New_York",
  "704": "America/New_York", "706": "America/New_York", "707": "America/Los_Angeles",
  "708": "America/Chicago",  "712": "America/Chicago",  "713": "America/Chicago",
  "714": "America/Los_Angeles", "715": "America/Chicago", "716": "America/New_York",
  "717": "America/New_York", "718": "America/New_York", "719": "America/Denver",
  "720": "America/Denver",   "724": "America/New_York", "725": "America/Los_Angeles",
  "726": "America/Chicago",  "727": "America/New_York", "731": "America/Chicago",
  "732": "America/New_York", "734": "America/New_York", "737": "America/Chicago",
  "740": "America/New_York", "743": "America/New_York", "747": "America/Los_Angeles",
  "754": "America/New_York", "757": "America/New_York", "760": "America/Los_Angeles",
  "762": "America/New_York", "763": "America/Chicago",  "765": "America/New_York",
  "769": "America/Chicago",  "770": "America/New_York", "772": "America/New_York",
  "773": "America/Chicago",  "774": "America/New_York", "775": "America/Los_Angeles",
  "779": "America/Chicago",  "781": "America/New_York", "785": "America/Chicago",
  "786": "America/New_York", "787": "America/Puerto_Rico", "801": "America/Denver",
  "802": "America/New_York", "803": "America/New_York", "804": "America/New_York",
  "805": "America/Los_Angeles", "806": "America/Chicago", "808": "Pacific/Honolulu",
  "810": "America/New_York", "812": "America/New_York", "813": "America/New_York",
  "814": "America/New_York", "815": "America/Chicago",  "816": "America/Chicago",
  "817": "America/Chicago",  "818": "America/Los_Angeles", "820": "America/Los_Angeles",
  "828": "America/New_York", "830": "America/Chicago",  "831": "America/Los_Angeles",
  "832": "America/Chicago",  "835": "America/New_York", "843": "America/New_York",
  "845": "America/New_York", "847": "America/Chicago",  "848": "America/New_York",
  "850": "America/Chicago",  "854": "America/New_York", "856": "America/New_York",
  "857": "America/New_York", "858": "America/Los_Angeles", "859": "America/New_York",
  "860": "America/New_York", "862": "America/New_York", "863": "America/New_York",
  "864": "America/New_York", "865": "America/New_York", "870": "America/Chicago",
  "872": "America/Chicago",  "878": "America/New_York", "901": "America/Chicago",
  "903": "America/Chicago",  "904": "America/New_York", "906": "America/New_York",
  "907": "America/Anchorage", "908": "America/New_York", "909": "America/Los_Angeles",
  "910": "America/New_York", "912": "America/New_York", "913": "America/Chicago",
  "914": "America/New_York", "915": "America/Denver",   "916": "America/Los_Angeles",
  "917": "America/New_York", "918": "America/Chicago",  "919": "America/New_York",
  "920": "America/Chicago",  "925": "America/Los_Angeles", "928": "America/Phoenix",
  "929": "America/New_York", "930": "America/New_York", "931": "America/Chicago",
  "934": "America/New_York", "936": "America/Chicago",  "937": "America/New_York",
  "938": "America/Chicago",  "939": "America/Puerto_Rico", "940": "America/Chicago",
  "941": "America/New_York", "947": "America/New_York", "948": "America/New_York",
  "949": "America/Los_Angeles", "951": "America/Los_Angeles", "952": "America/Chicago",
  "954": "America/New_York", "956": "America/Chicago",  "959": "America/New_York",
  "970": "America/Denver",   "971": "America/Los_Angeles", "972": "America/Chicago",
  "973": "America/New_York", "975": "America/Chicago",  "978": "America/New_York",
  "979": "America/Chicago",  "980": "America/New_York", "984": "America/New_York",
  "985": "America/Chicago",  "986": "America/Denver",   "989": "America/New_York",
};

/**
 * Get IANA timezone for a US E.164 phone number.
 * Defaults to America/New_York (most conservative — earliest sunset, latest sunrise on east coast).
 */
export function getRecipientTimezone(phoneE164: string): string {
  if (!US_E164.test(phoneE164)) return "America/New_York";
  const areaCode = phoneE164.slice(2, 5);
  return AREA_CODE_TZ[areaCode] || "America/New_York";
}

/**
 * Check if current time is within FCC TCPA quiet hours for the recipient.
 * Quiet hours: BEFORE 8am OR AT/AFTER 9pm recipient local time.
 * Returns true if it is currently OK to send.
 */
export function isWithinAllowedHours(phoneE164: string): { allowed: boolean; localHour: number; tz: string } {
  const tz = getRecipientTimezone(phoneE164);
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === "hour")?.value ?? "0";
    const localHour = parseInt(hourPart, 10);
    const allowed = localHour >= 8 && localHour < 21;
    return { allowed, localHour, tz };
  } catch {
    // If timezone calc fails, default to BLOCK (fail-safe for compliance)
    return { allowed: false, localHour: -1, tz };
  }
}

export interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
  skipped?: boolean;
  twilio_code?: number;
}

export interface SMSOptions {
  /** Bypass quiet-hours gate. Only honored for transactional products. */
  bypassQuietHours?: boolean;
  /**
   * Pinned SMS template id (e.g. `electrician_lock_in_v1`) when the body was
   * server-rendered from the registry in `_shared/sms-templates.ts`. Logged
   * to `system_comms_log.metadata.template_id` so we can diagnose mismatches
   * (e.g. onboarding vs sales) by querying which template fired which send.
   */
  templateId?: string;
  /**
   * Optional Twilio StatusCallback URL — Twilio will POST delivery updates
   * (queued/sent/delivered/undelivered/failed) here. Used by prospect-nudge
   * lane to track deliverability and trigger duplicate-safe retries.
   */
  statusCallback?: string;
}

/**
 * Send an SMS via Twilio. Returns result object.
 *
 * Compliance order:
 *   1. Demo sinkhole (redirects to admin)
 *   2. Twilio creds check
 *   3. E.164 US-only validation
 *   4. sms_opt_outs scrub
 *   5. Quiet-hours gate (8am–9pm local) — bypassable only for transactional
 *   6. Send + log
 */
export async function sendSMS(
  to: string,
  from: string,
  body: string,
  product?: string,
  isDemoMode?: boolean,
  options?: SMSOptions
): Promise<SMSResult> {
  // 1. Demo sinkhole: redirect all SMS to admin phone with [DEMO] prefix
  if (isDemoMode) {
    const demoTo = ADMIN_PHONE;
    const demoBody = `[DEMO] ${body}`;
    console.log(`[SMS] DEMO MODE — redirecting to ${demoTo}`);
    return sendSMS(demoTo, from, demoBody, product, false, options);
  }

  // 2. Creds check
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("[SMS] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set");
    return { success: false, error: "Missing Twilio credentials" };
  }

  const sb = SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    : null;

  // Compute body_hash up-front — used by every comms-log insert below so we can
  // resend byte-identical messages later and dedup against this exact payload.
  const bodyHash = await computeBodyHash(to, body, product ?? null);
  const templateId = options?.templateId ?? null;

  // 3. E.164 US-only validation
  if (!US_E164.test(to)) {
    console.warn(`[SMS] Rejected non-US/non-E.164 number: ${to}`);
    if (sb) {
      Promise.resolve(sb.from("compliance_blocks").insert({
        phone: to,
        product: product ?? null,
        reason: "invalid_e164_us_only",
      })).catch(() => {});
      Promise.resolve(sb.from("system_comms_log").insert({
        channel: "sms",
        product: product ?? null,
        recipient: to,
        body_preview: body.slice(0, 200),
        body_full: body,
        body_hash: bodyHash,
        status: "skipped",
        error_message: "invalid_e164_us_only",
        metadata: { template_id: templateId },
      })).catch(() => {});
    }
    return { success: false, skipped: true, error: "invalid_e164_us_only" };
  }

  // 4. TCPA: opt-out scrub
  if (sb) {
    const { data: optOut } = await sb
      .from("sms_opt_outs")
      .select("id")
      .eq("phone", to)
      .maybeSingle();

    if (optOut) {
      console.log(`[SMS] ${to} is opted out — skipping`);
      if (product) {
        Promise.resolve(sb.from("compliance_blocks").insert({ phone: to, product, reason: "sms_opt_out" })).catch(() => {});
      }
      Promise.resolve(sb.from("system_comms_log").insert({
        channel: "sms",
        product: product ?? null,
        recipient: to,
        body_preview: body.slice(0, 200),
        body_full: body,
        body_hash: bodyHash,
        status: "skipped",
        error_message: "sms_opt_out",
        metadata: { template_id: templateId },
      })).catch(() => {});
      return { success: false, skipped: true };
    }
  }

  // 5. TCPA: quiet-hours gate (8am–9pm recipient local time)
  const bypassRequested = options?.bypassQuietHours === true;
  const bypassAllowed = bypassRequested && product != null && QUIET_HOURS_BYPASS_PRODUCTS.has(product);
  if (!bypassAllowed) {
    const { allowed, localHour, tz } = isWithinAllowedHours(to);
    if (!allowed) {
      const reason = `quiet_hours (local ${localHour}:00 ${tz})`;
      console.log(`[SMS] ${to} blocked — ${reason}`);
      if (sb) {
        Promise.resolve(sb.from("compliance_blocks").insert({
          phone: to,
          product: product ?? null,
          reason: "quiet_hours",
        })).catch(() => {});
        Promise.resolve(sb.from("system_comms_log").insert({
          channel: "sms",
          product: product ?? null,
          recipient: to,
          body_preview: body.slice(0, 200),
          body_full: body,
          body_hash: bodyHash,
          status: "skipped",
          error_message: reason,
          metadata: { local_hour: localHour, tz, bypass_requested: bypassRequested, template_id: templateId },
        })).catch(() => {});
      }
      return { success: false, skipped: true, error: "quiet_hours" };
    }
  } else if (bypassRequested) {
    console.log(`[SMS] Quiet-hours bypass granted for transactional product: ${product}`);
  }

  // 6. Send via Twilio
  try {
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const params: Record<string, string> = { To: to, From: from, Body: body };
    if (options?.statusCallback) params.StatusCallback = options.statusCallback;
    const res = await fetchWithRetry(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params),
        signal: AbortSignal.timeout(15_000),
      },
      { maxRetries: 2, baseDelayMs: 2_000, label: "Twilio" },
    );

    const data = await res.json();

    if (!res.ok) {
      console.error(`[SMS] Twilio error ${res.status}: ${JSON.stringify(data)}`);
      if (sb) {
        Promise.resolve(sb.from("system_comms_log").insert({
          channel: "sms",
          product: product ?? null,
          recipient: to,
          body_preview: body.slice(0, 200),
          body_full: body,
          body_hash: bodyHash,
          status: "failed",
          error_message: data?.message || `HTTP ${res.status}`,
          metadata: { twilio_code: data?.code, template_id: templateId },
        })).catch(() => {});
      }
      // Surface to error_logs so admin sees silent SMS failures
      logError({
        source: "twilio",
        function_name: product ?? "sendSMS",
        severity: "error",
        recipient: to,
        payload: { from, body_preview: body.slice(0, 120), product },
        error_message: data?.message || `Twilio HTTP ${res.status}`,
        http_status: res.status,
      }).catch(() => {});
      return { success: false, error: data?.message || "Twilio error", twilio_code: data?.code };
    }

    console.log(`[SMS] Sent to ${to} — SID: ${data.sid}`);
    if (sb) {
      Promise.resolve(sb.from("system_comms_log").insert({
        channel: "sms",
        product: product ?? null,
        recipient: to,
        body_preview: body.slice(0, 200),
        body_full: body,
        body_hash: bodyHash,
        status: "sent",
        provider_id: data.sid,
        metadata: { from, template_id: templateId },
      })).catch(() => {});
    }
    return { success: true, sid: data.sid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[SMS] Exception: ${msg}`);
    if (sb) {
      Promise.resolve(sb.from("system_comms_log").insert({
        channel: "sms",
        product: product ?? null,
        recipient: to,
        body_preview: body.slice(0, 200),
        body_full: body,
        body_hash: bodyHash,
        status: "failed",
        error_message: msg,
        metadata: { template_id: templateId },
      })).catch(() => {});
    }
    logError({
      source: "twilio",
      function_name: product ?? "sendSMS",
      severity: "error",
      recipient: to,
      payload: { from, body_preview: body.slice(0, 120), product },
      error_message: msg,
    }).catch(() => {});
    return { success: false, error: msg };
  }
}
