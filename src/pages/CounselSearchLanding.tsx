import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { getCounselVariant, trackCounselCheckoutStarted } from "@/lib/counselSearchAB";

const TIERS = [
  {
    key: "solo" as const,
    name: "Solo",
    price: "$49/mo",
    desc: "Unlimited searches for one Michigan attorney.",
    features: [
      "Federal court (PACER/CourtListener) — Eastern + Western Districts of MI",
      "MI county dockets — 36th District (Detroit), Wayne, Oakland, Macomb",
      "MDOC offender lookup + NSOPW + FBI most-wanted",
      "Wayne / Oakland / Macomb assessor + parcel sales history",
      "Detroit blight tickets + vacant property registrations",
      "AI-corroborated web research (every cite HEAD-checked)",
      "Case-matter tagging on every search (audit trail)",
    ],
  },
  {
    key: "monitoring" as const,
    name: "Monitoring",
    price: "$79/mo",
    desc: "Solo + 25 saved subjects re-checked weekly.",
    features: [
      "Everything in Solo",
      "Save up to 25 subjects (with aliases)",
      "Weekly re-scan; email alert when new hits land",
      "PDF export per search (for case file)",
      "Priority support — direct line to Matt",
    ],
    featured: true,
  },
];

export default function CounselSearchLanding() {
  const [variant, setVariant] = useState<"highlight_solo" | "highlight_monitoring">("highlight_monitoring");
  const [tier, setTier] = useState<"solo" | "monitoring">("monitoring");
  const [form, setForm] = useState({ email: "", contact_name: "", firm_name: "", bar_number: "", phone: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const v = getCounselVariant();
    setVariant(v);
    setTier(v === "highlight_solo" ? "solo" : "monitoring");
  }, []);

  const featuredKey = variant === "highlight_solo" ? "solo" : "monitoring";

  const checkout = async () => {
    if (!form.email) {
      toast.error("Email required");
      return;
    }
    setLoading(true);
    try {
      trackCounselCheckoutStarted(tier);
      const { data, error } = await supabase.functions.invoke("create-counsel-search-checkout", {
        body: { ...form, tier },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Checkout failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <Helmet>
        <title>Counsel Records Search — MI Litigation Intel for Attorneys | DWA</title>
        <meta name="description" content="Federal + Michigan court dockets, MDOC, county parcels, blight tickets, AI-corroborated web research — one click, every cite verified. $49/mo, 7 free searches." />
        <link rel="canonical" href="https://detroitwebagent.com/counsel-search" />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <p className="text-[#00d4ff] text-xs font-extrabold tracking-[4px] mb-3">⚖️ COUNSEL RECORDS SEARCH</p>
          <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
            One click. Federal court, MI dockets, MDOC, county parcels, AI research — every cite verified.
          </h1>
          <p className="text-[#94a3b8] text-lg max-w-2xl mx-auto">
            Built for Michigan litigators. Cheaper than TLO. Deeper than Perplexity. <strong className="text-white">7 free searches</strong> — no card.
          </p>
          <div className="mt-6">
            <Link to="/counsel-search/console" className="inline-block bg-[#00d4ff] text-black font-bold px-8 py-3 rounded-lg text-sm hover:bg-[#00b8e0]">Start 7 Free Searches →</Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {TIERS.map((t) => (
            <Card
              key={t.key}
              className={`bg-[#0a1628] border-2 cursor-pointer transition ${
                tier === t.key ? "border-[#00d4ff]" : "border-[#1e3a5f]"
              } ${t.featured ? "relative" : ""}`}
              onClick={() => setTier(t.key)}
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00d4ff] text-black text-[10px] font-bold px-3 py-1 rounded-full">RECOMMENDED</div>
              )}
              <CardContent className="p-6">
                <h3 className="text-xl font-bold">{t.name}</h3>
                <p className="text-3xl font-extrabold text-[#00d4ff] my-2">{t.price}</p>
                <p className="text-[#94a3b8] text-sm mb-4">{t.desc}</p>
                <ul className="space-y-2 text-sm text-[#cbd5e1]">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2"><span className="text-[#00d4ff]">✓</span><span>{f}</span></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-[#0a1628] border-[#1e3a5f] max-w-xl mx-auto">
          <CardContent className="p-6 space-y-3">
            <h3 className="text-lg font-bold mb-2">Start your subscription — {TIERS.find((t) => t.key === tier)?.name}</h3>
            <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="Your name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="Firm name" value={form.firm_name} onChange={(e) => setForm({ ...form, firm_name: e.target.value })} />
            <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="MI Bar #" value={form.bar_number} onChange={(e) => setForm({ ...form, bar_number: e.target.value })} />
            <input className="w-full bg-[#030711] border border-[#1e3a5f] rounded px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Button className="w-full bg-[#00d4ff] text-black hover:bg-[#00b8e0]" disabled={loading} onClick={checkout}>
              {loading ? "Redirecting…" : `Subscribe — ${TIERS.find((t) => t.key === tier)?.price}`}
            </Button>
            <p className="text-[10px] text-[#64748b] text-center">
              Not a Consumer Reporting Agency. For permissible litigation, fraud-investigation, and bona-fide legal-research purposes only. Not for FCRA-permissible employment, housing, or credit decisions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
