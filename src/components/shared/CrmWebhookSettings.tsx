import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lets a customer paste a webhook URL (Zapier / Make / n8n / Salesforce / Jobber /
 * Greenhouse / Lever) so every new lead/candidate is POSTed to their own CRM/ATS.
 * Optional shared secret enables HMAC-SHA256 signature verification (X-DWA-Signature).
 *
 * Used by Mortgage Radar, Trade Radar, and TechAlert customer portals.
 */
export default function CrmWebhookSettings({
  table,
  clientId,
  brand = "dwa",
}: {
  table: "mortgage_radar_clients" | "trade_radar_clients" | "hire_alert_clients";
  clientId: string;
  brand?: "dwa" | "m2";
}) {
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from as any)(table)
        .select("crm_webhook_url, crm_webhook_secret")
        .eq("id", clientId)
        .maybeSingle();
      if (data) {
        setUrl(data.crm_webhook_url || "");
        setSecret(data.crm_webhook_secret || "");
      }
      setLoading(false);
    })();
  }, [table, clientId]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const { error } = await (supabase.from as any)(table)
      .update({
        crm_webhook_url: url.trim() || null,
        crm_webhook_secret: secret.trim() || null,
      })
      .eq("id", clientId);
    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : "Saved ✓");
    setTimeout(() => setMsg(null), 3000);
  };

  if (loading) return null;

  const accent = brand === "dwa" ? "#00d4ff" : "#e8621a";

  return (
    <div className="border border-white/10 bg-white/[0.02] rounded-lg p-4">
      <h3 className="text-sm font-bold text-white mb-1">📡 Send leads to your CRM</h3>
      <p className="text-xs text-white/60 mb-3">
        We'll POST each new lead to this URL. Works with Zapier, Make, n8n, Salesforce, Jobber, Greenhouse, Lever — anything that accepts a webhook.
      </p>
      <label className="block text-[11px] text-white/50 uppercase mb-1">Webhook URL</label>
      <input
        type="url"
        placeholder="https://hooks.zapier.com/..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white mb-3"
      />
      <label className="block text-[11px] text-white/50 uppercase mb-1">Shared secret (optional)</label>
      <input
        type="text"
        placeholder="Used to sign payloads (X-DWA-Signature: sha256=...)"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white mb-3"
      />
      <button
        onClick={save}
        disabled={saving}
        className="px-4 py-2 text-xs font-bold rounded disabled:opacity-50"
        style={{ background: accent, color: "#000" }}
      >
        {saving ? "Saving..." : "Save webhook"}
      </button>
      {msg && <span className="ml-3 text-xs text-white/70">{msg}</span>}
    </div>
  );
}
