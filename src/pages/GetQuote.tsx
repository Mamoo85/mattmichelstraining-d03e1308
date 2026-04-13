// GetQuote — homeowner lead capture page, templated by trade + city
// Routes: /get-quote/:trade/:city (e.g. /get-quote/plumber/detroit)
// Inserts to contractor_leads via edge function, notifies active contractor.

import { useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Phone, Clock, Shield } from "lucide-react";

const TRADE_CONFIG: Record<string, { label: string; emoji: string; headline: string; subhead: string; placeholder: string }> = {
  plumber:     { label: "Plumber",            emoji: "🔧", headline: "Get a Free Plumbing Quote in Detroit", subhead: "Licensed plumbers respond within 2 hours.", placeholder: "Describe the issue — leaky pipe, water heater, drain backup, etc." },
  plumbing:    { label: "Plumber",            emoji: "🔧", headline: "Get a Free Plumbing Quote in Detroit", subhead: "Licensed plumbers respond within 2 hours.", placeholder: "Describe the issue — leaky pipe, water heater, drain backup, etc." },
  hvac:        { label: "HVAC Tech",          emoji: "❄️", headline: "Get a Free HVAC Quote in Detroit",    subhead: "Heating & cooling experts respond within 2 hours.", placeholder: "AC not working? Furnace issues? Describe the problem." },
  roofing:     { label: "Roofer",             emoji: "🏠", headline: "Get a Free Roofing Quote in Detroit", subhead: "Licensed roofers respond within 2 hours.", placeholder: "Roof leak, storm damage, replacement? Tell us more." },
  roof:        { label: "Roofer",             emoji: "🏠", headline: "Get a Free Roofing Quote in Detroit", subhead: "Licensed roofers respond within 2 hours.", placeholder: "Roof leak, storm damage, replacement? Tell us more." },
  electrician: { label: "Electrician",        emoji: "⚡", headline: "Get a Free Electrical Quote in Detroit", subhead: "Licensed electricians respond within 2 hours.", placeholder: "Panel upgrade, outlet issue, EV charger install?" },
  electrical:  { label: "Electrician",        emoji: "⚡", headline: "Get a Free Electrical Quote in Detroit", subhead: "Licensed electricians respond within 2 hours.", placeholder: "Panel upgrade, outlet issue, EV charger install?" },
  boiler:      { label: "Boiler Technician",  emoji: "🔥", headline: "Get a Free Boiler Quote in Detroit",  subhead: "Certified boiler techs respond within 2 hours.", placeholder: "No heat, boiler leaking, annual service?" },
};

const CITY_CONFIG: Record<string, string> = {
  detroit: "Detroit, MI",
  dearborn: "Dearborn, MI",
  warren: "Warren, MI",
  livonia: "Livonia, MI",
  troy: "Troy, MI",
  "sterling-heights": "Sterling Heights, MI",
  "royal-oak": "Royal Oak, MI",
  "farmington-hills": "Farmington Hills, MI",
  pontiac: "Pontiac, MI",
};

export default function GetQuote() {
  const { trade = "plumber", city = "detroit" } = useParams<{ trade: string; city: string }>();
  const config = TRADE_CONFIG[trade.toLowerCase()] || TRADE_CONFIG.plumber;
  const cityLabel = CITY_CONFIG[city.toLowerCase()] || `${city.charAt(0).toUpperCase() + city.slice(1)}, MI`;

  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "", contact_preference: "call" as "call" | "text" | "email" });
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setState("submitting");

    try {
      // Normalize trade slug → canonical DB trade value
      const TRADE_NORMALIZE: Record<string, string> = {
        plumber: "plumbing", plumbing: "plumbing",
        hvac: "hvac",
        roofing: "roofing", roof: "roofing",
        electrician: "electrical", electrical: "electrical",
        boiler: "boiler",
      };
      const normalizedTrade = TRADE_NORMALIZE[trade.toLowerCase()] || trade.toLowerCase();

      // Find the matching lead site for this trade + city (ilike = case-insensitive exact match)
      const { data: site } = await (supabase as any)
        .from("contractor_lead_sites")
        .select("id")
        .ilike("trade", normalizedTrade)
        .ilike("city", `%${city.replace("-", " ")}%`)
        .limit(1)
        .maybeSingle();

      const { error } = await (supabase as any).from("contractor_leads").insert({
        site_id: site?.id || null,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        message: form.message.trim() || null,
        project_type: config.label,
        contact_preference: form.contact_preference,
        status: "new",
      });

      if (error) throw error;

      // Trigger contractor-lead-notify edge function to SMS the active contractor
      supabase.functions.invoke("contractor-lead-notify").catch(() => {});
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Request Received!</h1>
          <p className="text-slate-400 mb-6">
            A licensed {config.label.toLowerCase()} in {cityLabel} will contact you within 2 hours.
            Keep your phone nearby.
          </p>
          <p className="text-slate-500 text-sm">
            Powered by{" "}
            <a href="https://detroitwebagent.com" className="text-[#00d4ff] hover:underline">
              Detroit Web Agency
            </a>
          </p>
        </div>
      </div>
    );
  }

  const headline = config.headline.replace("Detroit", cityLabel.split(",")[0]);

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Header */}
      <div className="bg-[#0a1628] border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <span className="text-[#00d4ff] font-bold text-sm tracking-wide">
          {config.emoji} Detroit Lead Network
        </span>
        <a href="tel:+13139921219" className="flex items-center gap-1.5 text-white text-sm font-medium">
          <Phone size={14} />
          (313) 992-1219
        </a>
      </div>

      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-full px-3 py-1 mb-4">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-semibold">Contractors available in {cityLabel}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-tight mb-3">{headline}</h1>
          <p className="text-slate-400">{config.subhead}</p>
        </div>

        {/* Trust signals */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Clock, label: "2-Hr Response" },
            { icon: Shield, label: "Licensed & Insured" },
            { icon: CheckCircle, label: "Free Quote" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="bg-slate-800/50 rounded-lg p-3 text-center">
              <Icon size={18} className="text-[#00d4ff] mx-auto mb-1" />
              <span className="text-slate-300 text-xs font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Your Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="First and last name"
              required
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Phone Number *</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(313) 000-0000"
              type="tel"
              required
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Email (optional)</label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@email.com"
              type="email"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-1.5">Describe the Job</label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder={config.placeholder}
              rows={3}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
            />
          </div>

          {/* Contact preference */}
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">How should we contact you?</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "call", label: "📞 Call Me", },
                { value: "text", label: "💬 Text Me", },
                { value: "email", label: "📧 Email Me", },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, contact_preference: value })}
                  className={`py-2.5 px-3 rounded-lg text-sm font-semibold border transition-all ${
                    form.contact_preference === value
                      ? "bg-[#00d4ff]/20 border-[#00d4ff] text-[#00d4ff]"
                      : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {state === "error" && (
            <p className="text-red-400 text-sm">Something went wrong. Call (313) 992-1219 directly.</p>
          )}

          <Button
            type="submit"
            disabled={state === "submitting" || !form.name.trim() || !form.phone.trim()}
            className="w-full h-13 bg-[#e8621a] hover:bg-[#d4571a] text-white font-bold text-base py-3 rounded-xl"
          >
            {state === "submitting" ? "Sending..." : `Get My Free ${config.label} Quote →`}
          </Button>

          <p className="text-slate-500 text-xs text-center">
            No spam. A licensed contractor in {cityLabel} contacts you directly.
          </p>
        </form>

        <p className="text-center text-slate-600 text-xs mt-8">
          Powered by{" "}
          <a href="https://detroitwebagent.com" className="text-slate-500 hover:text-slate-400">
            Detroit Lead Network
          </a>
        </p>
      </div>
    </div>
  );
}
