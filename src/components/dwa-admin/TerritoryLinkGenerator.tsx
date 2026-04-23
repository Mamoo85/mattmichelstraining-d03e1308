import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link2, Copy, MessageSquare, Mail, ExternalLink, Clock, List } from "lucide-react";
import { toast } from "sonner";

const TRADES = [
  { value: "electrical", label: "Electrical", monthly: 399 },
  { value: "hvac", label: "HVAC", monthly: 399 },
  { value: "plumbing", label: "Plumbing", monthly: 399 },
  { value: "roofing", label: "Roofing", monthly: 399 },
  { value: "boiler", label: "Boiler / Mechanical", monthly: 399 },
  { value: "gutters", label: "Gutters", monthly: 299 },
  { value: "siding", label: "Siding", monthly: 299 },
];

const BASE_URL = "https://detroitwebagent.com/contractor-leads";
const TRACK_URL = "https://eauvubfpanpeuxsrqesu.supabase.co/functions/v1/track-prospect-link";

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

// Per-(link/token) cooldown to prevent accidental double-sends of the same generated SMS.
// Stored in localStorage so it survives navigation; key includes a short hash of the text so
// re-copying a *different* draft for the same link is allowed.
const SMS_COOLDOWN_MS = 60 * 1000; // 60 seconds
const SMS_COOLDOWN_PREFIX = "dwa_sms_cooldown_";

function hashText(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function cooldownKey(idKey: string, text: string): string {
  return `${SMS_COOLDOWN_PREFIX}${idKey}_${hashText(text)}`;
}

/** Returns ms remaining if still in cooldown, else 0. */
function cooldownRemaining(idKey: string, text: string): number {
  try {
    const raw = localStorage.getItem(cooldownKey(idKey, text));
    if (!raw) return 0;
    const sentAt = Number(raw);
    if (!Number.isFinite(sentAt)) return 0;
    const remaining = SMS_COOLDOWN_MS - (Date.now() - sentAt);
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

function markSent(idKey: string, text: string) {
  try {
    localStorage.setItem(cooldownKey(idKey, text), String(Date.now()));
  } catch { /* localStorage unavailable */ }
}

/**
 * Copy an SMS draft with a per-link cooldown. If the same link+text was copied
 * within SMS_COOLDOWN_MS, block by default and require a second click to override.
 * Returns true if the copy actually happened.
 */
function copySmsDraftGuarded(opts: {
  text: string;
  idKey: string; // unique per generated link (prefer token, fall back to URL)
  label: string;
  forceOverride?: boolean;
  onBlocked?: (secondsLeft: number) => void;
}): boolean {
  const remaining = cooldownRemaining(opts.idKey, opts.text);
  if (remaining > 0 && !opts.forceOverride) {
    const seconds = Math.ceil(remaining / 1000);
    opts.onBlocked?.(seconds);
    toast.warning(
      `You already sent this exact SMS for this link ${Math.round((SMS_COOLDOWN_MS - remaining) / 1000)}s ago. Wait ${seconds}s or click again to override.`,
    );
    return false;
  }
  navigator.clipboard.writeText(opts.text).then(() => {
    markSent(opts.idKey, opts.text);
    toast.success(opts.forceOverride ? `${opts.label} copied (override)` : `${opts.label} copied`);
  });
  return true;
}

function buildLink(opts: {
  trade: string;
  city: string;
  email?: string;
  name?: string;
  businessName?: string;
  phone?: string;
}): string {
  if (!opts.trade || !opts.city.trim()) return "";
  const params = new URLSearchParams();
  params.set("trade", opts.trade);
  params.set("city", opts.city.trim());
  if (opts.email?.trim()) params.set("prefilled_email", opts.email.trim());
  if (opts.name?.trim()) params.set("name", opts.name.trim());
  if (opts.businessName?.trim()) params.set("business_name", opts.businessName.trim());
  if (opts.phone?.trim()) params.set("phone", opts.phone.trim());
  return `${BASE_URL}?${params.toString()}`;
}

function buildSmsDraft(o: { name?: string; tradeLabel: string; city: string; link: string; monthly: number; expires: boolean }) {
  const greetingName = o.name?.trim() ? o.name.split(" ")[0] : "{customer_name}";
  const expiryNote = o.expires ? "\n\n(Link expires in 24 hours.)" : "";
  return `Hey ${greetingName} — direct signup link for the ${o.city} ${o.tradeLabel.toLowerCase()} territory:\n\n${o.link}\n\n(${o.tradeLabel} + ${o.city} preselected, $${o.monthly}/mo, cancel anytime.)${expiryNote}\n\n— Matt`;
}

function buildApologyDraft(o: { name?: string; tradeLabel: string; city: string; link: string; monthly: number; expires: boolean }) {
  const greetingName = o.name?.trim() ? `, ${o.name.split(" ")[0]}` : " {customer_name}";
  const expiryNote = o.expires ? "\n\n(Heads up: this link expires in 24 hours so I can keep your spot reserved.)" : "";
  return `Sorry${greetingName} — I sent you the generic signup page by mistake. Here's the direct link for the ${o.city} ${o.tradeLabel.toLowerCase()} territory ($${o.monthly}/mo):\n\n${o.link}\n\nThat page will have ${o.tradeLabel} + ${o.city} selected already so you can lock it in fast.${expiryNote}\n\n— Matt`;
}

type BulkRow = {
  city: string;
  link: string;
  trackedLink: string;
  token: string | null;
  error?: string;
};

export default function TerritoryLinkGenerator() {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [trade, setTrade] = useState("");
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [expires24h, setExpires24h] = useState(false);
  const [knownCities, setKnownCities] = useState<string[]>([]);

  // Persistence + tracking output
  const [persistedToken, setPersistedToken] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);

  // Bulk mode
  const [bulkCities, setBulkCities] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  // Stats strip
  const [stats, setStats] = useState({ generated: 0, clicked: 0, signedUp: 0 });

  // Per-button cooldown override flags. Key = "sms" | "apology" | `bulk:<token-or-link>`.
  // When a guarded copy is blocked by cooldown, we flip that key to true so the next click overrides.
  const [overrideKeys, setOverrideKeys] = useState<Record<string, boolean>>({});

  // Pull existing territory cities (filtered by trade if one is selected)
  const [siteRows, setSiteRows] = useState<Array<{ city: string; trade: string }>>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("contractor_lead_sites")
        .select("city, trade")
        .limit(500);
      if (data) {
        setSiteRows(data as Array<{ city: string; trade: string }>);
        const unique = Array.from(new Set(data.map((r: any) => r.city).filter(Boolean))).sort();
        setKnownCities(unique as string[]);
      }
    })();
  }, []);

  // Cities available for the currently-selected trade (falls back to all if no trade picked)
  const citiesForTrade = (() => {
    if (!trade) return knownCities;
    const filtered = Array.from(
      new Set(siteRows.filter(r => r.trade === trade).map(r => r.city).filter(Boolean))
    ).sort();
    return filtered.length > 0 ? filtered : knownCities;
  })();

  const loadStats = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [gen, clk, paid] = await Promise.all([
      supabase.from("prospect_nudges").select("id", { count: "exact", head: true }).eq("generated_by_admin", true).gte("created_at", since),
      supabase.from("prospect_nudges").select("id", { count: "exact", head: true }).eq("generated_by_admin", true).gte("created_at", since).not("clicked_at", "is", null),
      supabase.from("prospect_nudges").select("id", { count: "exact", head: true }).eq("generated_by_admin", true).gte("created_at", since).not("paid_at", "is", null),
    ]);
    setStats({
      generated: gen.count ?? 0,
      clicked: clk.count ?? 0,
      signedUp: paid.count ?? 0,
    });
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const tradeMeta = TRADES.find(t => t.value === trade);
  const monthly = tradeMeta?.monthly || 399;
  const tradeLabel = tradeMeta?.label || "";

  // Reset persisted token + override flags when inputs change
  useEffect(() => {
    setPersistedToken(null);
    setOverrideKeys({});
  }, [trade, city, name, businessName, email, phone, expires24h]);

  const rawLink = buildLink({ trade, city, email, name, businessName, phone });
  const trackedLink = persistedToken ? `${TRACK_URL}?token=${persistedToken}` : "";
  const linkForCopy = trackedLink || rawLink;

  const smsDraft = rawLink
    ? buildSmsDraft({ name, tradeLabel, city: city.trim(), link: linkForCopy, monthly, expires: expires24h })
    : "";

  const apologyDraft = rawLink
    ? buildApologyDraft({ name, tradeLabel, city: city.trim(), link: linkForCopy, monthly, expires: expires24h })
    : "";

  // Persist a prospect_nudges row so we can track clicks/conversions/expiry
  async function persistNudge(opts: {
    trade: string;
    city: string;
    name?: string;
    businessName?: string;
    phone?: string;
  }): Promise<{ token: string | null; error?: string }> {
    // Phone is required by the table — use a placeholder if not provided so admin still gets tracking.
    const phoneVal = opts.phone?.trim() || "+10000000000";
    const expiresAt = expires24h ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
    const { data, error } = await supabase
      .from("prospect_nudges")
      .insert({
        phone: phoneVal,
        name: opts.name?.trim() || null,
        business: opts.businessName?.trim() || null,
        city: opts.city.trim(),
        trade: opts.trade,
        generated_by_admin: true,
        expires_at: expiresAt,
        status: "active",
      })
      .select("link_token")
      .single();
    if (error || !data) return { token: null, error: error?.message };
    return { token: data.link_token };
  }

  async function handleGenerate() {
    if (!trade || !city.trim()) {
      toast.error("Pick a trade and city first");
      return;
    }
    setPersisting(true);
    const { token, error } = await persistNudge({ trade, city, name, businessName, phone });
    setPersisting(false);
    if (token) {
      setPersistedToken(token);
      toast.success("Tracked link generated");
      loadStats();
    } else {
      toast.error(`Could not save tracking: ${error || "unknown error"} — using untracked link`);
    }
  }

  async function handleBulkGenerate() {
    if (!trade) { toast.error("Pick a trade first"); return; }
    const cities = bulkCities
      .split(/[,\n]/)
      .map(c => c.trim())
      .filter(Boolean);
    if (cities.length === 0) { toast.error("Enter at least one city"); return; }
    setBulkRunning(true);
    const out: BulkRow[] = [];
    for (const c of cities) {
      const link = buildLink({ trade, city: c, email, name, businessName, phone });
      const { token, error } = await persistNudge({ trade, city: c, name, businessName, phone });
      out.push({
        city: c,
        link,
        trackedLink: token ? `${TRACK_URL}?token=${token}` : link,
        token,
        error,
      });
    }
    setBulkRows(out);
    setBulkRunning(false);
    loadStats();
    toast.success(`Generated ${out.length} territory link${out.length === 1 ? "" : "s"}`);
  }

  function copyAllBulk() {
    if (bulkRows.length === 0) return;
    const text = bulkRows
      .map(r => `${r.city}: ${r.trackedLink}`)
      .join("\n");
    copy(text, "All links");
  }

  function bulkSmsForRow(r: BulkRow) {
    return buildSmsDraft({
      name,
      tradeLabel,
      city: r.city,
      link: r.trackedLink,
      monthly,
      expires: expires24h,
    });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Link2 size={16} className="text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Territory Signup Link Generator</h3>
        {tradeMeta && (
          <span className="text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
            ${monthly}/mo
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`px-2 py-1 rounded font-semibold uppercase tracking-wider ${mode === "single" ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:text-foreground"}`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`px-2 py-1 rounded font-semibold uppercase tracking-wider flex items-center gap-1 ${mode === "bulk" ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:text-foreground"}`}
          >
            <List size={10} /> Bulk
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-3 text-[11px] bg-background/50 border border-border/60 rounded px-3 py-1.5">
        <span className="text-muted-foreground">Last 30 days:</span>
        <span className="text-foreground font-semibold">Links: <span className="text-primary">{stats.generated}</span></span>
        <span className="text-foreground font-semibold">Clicked: <span className="text-primary">{stats.clicked}</span></span>
        <span className="text-foreground font-semibold">Signed up: <span className="text-primary">{stats.signedUp}</span></span>
      </div>

      <p className="text-xs text-muted-foreground">
        Build a one-tap signup URL with trade + city preselected. Tracked links also record clicks + conversions.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-muted-foreground font-semibold mb-1 uppercase">Profession *</label>
          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="w-full bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary rounded"
          >
            <option value="">Select trade…</option>
            {TRADES.map(t => <option key={t.value} value={t.value}>{t.label} (${t.monthly}/mo)</option>)}
          </select>
        </div>
        {mode === "single" ? (
          <div>
            <label className="block text-[10px] text-muted-foreground font-semibold mb-1 uppercase">City / Territory *</label>
            <input
              list="known-cities"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Livonia"
              className="w-full bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary rounded"
            />
            <datalist id="known-cities">
              {knownCities.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        ) : (
          <div>
            <label className="block text-[10px] text-muted-foreground font-semibold mb-1 uppercase">Cities (comma or newline)</label>
            <textarea
              value={bulkCities}
              onChange={(e) => setBulkCities(e.target.value)}
              placeholder="Livonia, Redford, Westland"
              rows={2}
              className="w-full bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary rounded"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Prospect name (optional — uses {customer_name} if blank)"
          className="w-full bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary rounded"
        />
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Business name (optional)"
          className="w-full bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary rounded"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Prospect email (optional, prefills checkout)"
          className="w-full bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary rounded"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Prospect phone (optional)"
          className="w-full bg-background border border-border px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary rounded"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={expires24h}
          onChange={(e) => setExpires24h(e.target.checked)}
          className="accent-primary"
        />
        <Clock size={12} className="text-muted-foreground" />
        One-time use — link expires in 24 hours
      </label>

      {mode === "single" && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!trade || !city.trim() || persisting}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              <Link2 size={12} /> {persisting ? "Generating…" : persistedToken ? "Regenerate Tracked Link" : "🔗 Generate Tracked Link"}
            </button>
            {rawLink && (
              <a
                href={rawLink}
                target="_blank"
                rel="noopener noreferrer"
                title="Opens the deep link with NO tracking token — safe for verifying preselects without burning a one-time link."
                className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded border border-border bg-background hover:bg-accent text-foreground"
              >
                <ExternalLink size={12} /> 🔍 Test Link
              </a>
            )}
          </div>

          {linkForCopy && (
            <>
              <div>
                <label className="block text-[10px] text-muted-foreground font-semibold mb-1 uppercase">
                  {persistedToken ? "Tracked Link" : "Untracked Preview (click Generate to track)"}
                </label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={linkForCopy}
                    className="flex-1 bg-background border border-border px-2 py-1.5 text-xs text-foreground font-mono focus:outline-none rounded"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => copy(linkForCopy, "Link")}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const idKey = persistedToken || `untracked:${linkForCopy}`;
                    const isOverride = !!overrideKeys["sms"];
                    const ok = copySmsDraftGuarded({
                      text: smsDraft,
                      idKey,
                      label: "SMS draft",
                      forceOverride: isOverride,
                      onBlocked: () => setOverrideKeys(o => ({ ...o, sms: true })),
                    });
                    if (ok) setOverrideKeys(o => ({ ...o, sms: false }));
                  }}
                  className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded border bg-background hover:bg-accent text-foreground ${overrideKeys["sms"] ? "border-yellow-500 text-yellow-600" : "border-border"}`}
                >
                  <MessageSquare size={12} /> {overrideKeys["sms"] ? "Click again to override" : "Copy SMS Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idKey = persistedToken || `untracked:${linkForCopy}`;
                    const isOverride = !!overrideKeys["apology"];
                    const ok = copySmsDraftGuarded({
                      text: apologyDraft,
                      idKey,
                      label: "Apology draft",
                      forceOverride: isOverride,
                      onBlocked: () => setOverrideKeys(o => ({ ...o, apology: true })),
                    });
                    if (ok) setOverrideKeys(o => ({ ...o, apology: false }));
                  }}
                  className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded border bg-background hover:bg-accent text-foreground ${overrideKeys["apology"] ? "border-yellow-500 text-yellow-600" : "border-border"}`}
                >
                  <Mail size={12} /> {overrideKeys["apology"] ? "Click again to override" : "Copy Apology Draft"}
                </button>
              </div>

              <details className="text-[11px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Preview SMS draft</summary>
                <pre className="mt-2 p-2 bg-background border border-border rounded whitespace-pre-wrap font-sans text-foreground">{smsDraft}</pre>
              </details>
            </>
          )}
        </div>
      )}

      {mode === "bulk" && (
        <div className="space-y-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleBulkGenerate}
            disabled={!trade || !bulkCities.trim() || bulkRunning}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            <List size={12} /> {bulkRunning ? "Generating…" : "Generate All"}
          </button>

          {bulkRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase">{bulkRows.length} link{bulkRows.length === 1 ? "" : "s"}</span>
                <button
                  type="button"
                  onClick={copyAllBulk}
                  className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded border border-border bg-background hover:bg-accent text-foreground"
                >
                  <Copy size={10} /> Copy All as List
                </button>
              </div>
              <div className="border border-border rounded overflow-hidden">
                {bulkRows.map((r, i) => (
                  <div key={`${r.city}-${i}`} className="flex flex-col sm:flex-row gap-2 px-2 py-2 border-b border-border last:border-b-0 bg-background">
                    <div className="text-xs font-bold text-foreground sm:w-28 truncate" title={r.city}>{r.city}</div>
                    <input
                      readOnly
                      value={r.trackedLink}
                      className="flex-1 bg-card border border-border px-2 py-1 text-[11px] text-foreground font-mono focus:outline-none rounded min-w-0"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => copy(r.trackedLink, `${r.city} link`)} className="px-2 py-1 text-[11px] font-semibold rounded bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1">
                        <Copy size={10} /> Copy
                      </button>
                      <button
                        onClick={() => {
                          const idKey = r.token || `untracked:${r.trackedLink}`;
                          const stateKey = `bulk:${idKey}`;
                          const isOverride = !!overrideKeys[stateKey];
                          const ok = copySmsDraftGuarded({
                            text: bulkSmsForRow(r),
                            idKey,
                            label: `${r.city} SMS`,
                            forceOverride: isOverride,
                            onBlocked: () => setOverrideKeys(o => ({ ...o, [stateKey]: true })),
                          });
                          if (ok) setOverrideKeys(o => ({ ...o, [stateKey]: false }));
                        }}
                        className={`px-2 py-1 text-[11px] font-semibold rounded border bg-background hover:bg-accent text-foreground flex items-center gap-1 ${overrideKeys[`bulk:${r.token || `untracked:${r.trackedLink}`}`] ? "border-yellow-500 text-yellow-600" : "border-border"}`}
                      >
                        <MessageSquare size={10} /> {overrideKeys[`bulk:${r.token || `untracked:${r.trackedLink}`}`] ? "Override?" : "SMS"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
