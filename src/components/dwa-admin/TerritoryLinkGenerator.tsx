import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link2, Copy, MessageSquare, Mail } from "lucide-react";
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

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

export default function TerritoryLinkGenerator() {
  const [trade, setTrade] = useState("");
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [knownCities, setKnownCities] = useState<string[]>([]);

  // Pull existing cities from contractor_lead_sites for autocomplete suggestions.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("contractor_lead_sites")
        .select("city")
        .limit(200);
      if (data) {
        const unique = Array.from(new Set(data.map((r: any) => r.city).filter(Boolean))).sort();
        setKnownCities(unique as string[]);
      }
    })();
  }, []);

  const tradeMeta = TRADES.find(t => t.value === trade);
  const monthly = tradeMeta?.monthly || 399;
  const tradeLabel = tradeMeta?.label || "";

  const link = (() => {
    if (!trade || !city.trim()) return "";
    const params = new URLSearchParams();
    params.set("trade", trade);
    params.set("city", city.trim());
    if (email.trim()) params.set("prefilled_email", email.trim());
    if (name.trim()) params.set("name", name.trim());
    if (businessName.trim()) params.set("business_name", businessName.trim());
    if (phone.trim()) params.set("phone", phone.trim());
    return `${BASE_URL}?${params.toString()}`;
  })();

  const smsDraft = link
    ? `Hey${name ? ` ${name.split(" ")[0]}` : ""} — direct signup link for the ${city} ${tradeLabel.toLowerCase()} territory:\n\n${link}\n\n(${tradeLabel} + ${city} preselected, $${monthly}/mo, cancel anytime.)\n\n— Matt`
    : "";

  const apologyDraft = link
    ? `Sorry — I sent you the generic signup page by mistake. Here's the direct link for the ${city} ${tradeLabel.toLowerCase()} territory:\n\n${link}\n\nThat page will have ${tradeLabel} + ${city} selected already so you can lock it in fast.\n\n— Matt`
    : "";

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Territory Signup Link Generator</h3>
        {tradeMeta && (
          <span className="ml-auto text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
            ${monthly}/mo
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Build a one-tap signup URL with trade + city preselected. Paste into SMS/email so prospects skip the picker.
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Prospect name (optional)"
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

      {link && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div>
            <label className="block text-[10px] text-muted-foreground font-semibold mb-1 uppercase">Generated Link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 bg-background border border-border px-2 py-1.5 text-xs text-foreground font-mono focus:outline-none rounded"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={() => copy(link, "Link")}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => copy(smsDraft, "SMS draft")}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded border border-border bg-background hover:bg-accent"
            >
              <MessageSquare size={12} /> Copy SMS Draft
            </button>
            <button
              type="button"
              onClick={() => copy(apologyDraft, "Apology draft")}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded border border-border bg-background hover:bg-accent"
            >
              <Mail size={12} /> Copy Apology Draft
            </button>
          </div>

          <details className="text-[11px]">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Preview SMS draft</summary>
            <pre className="mt-2 p-2 bg-background border border-border rounded whitespace-pre-wrap font-sans text-foreground">{smsDraft}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
