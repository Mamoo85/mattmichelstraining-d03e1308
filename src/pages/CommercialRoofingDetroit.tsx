import SEOHead from "@/components/layout/SEOHead";
import { Link } from "react-router-dom";
import { Building2, TrendingUp, Phone, CheckCircle2 } from "lucide-react";

export default function CommercialRoofingDetroit() {
  return (
    <>
      <SEOHead
        title="Detroit Commercial Roofing Lead System | Detroit Web Agency"
        description="Daily leads on commercial roofing jobs in Detroit metro before your competitors hear about them. BSEED permit data + LinkedIn signals + AI outreach."
      />
      <main className="min-h-screen bg-[#0a1628] text-white">
        <section className="px-6 py-20 max-w-5xl mx-auto">
          <div className="inline-block bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
            Detroit Commercial Roofing
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
            New roofing jobs in Detroit hit your inbox <span className="text-[#00d4ff]">before</span> your phone rings.
          </h1>
          <p className="text-lg text-white/70 mt-6 max-w-2xl">
            We pull live BSEED permit data, cross-reference LinkedIn for property managers, and send you 5–15 qualified
            commercial roofing leads per week — every weekday at 7am ET.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link
              to="/contractor-leads"
              className="bg-[#00d4ff] text-[#0a1628] font-bold px-6 py-3 rounded-lg hover:bg-[#33dcff]"
            >
              See Pricing & Pilot Spots
            </Link>
            <a
              href="tel:+13139921219"
              className="border border-white/20 text-white font-bold px-6 py-3 rounded-lg hover:bg-white/5 flex items-center gap-2"
            >
              <Phone className="w-4 h-4" /> (313) 992-1219
            </a>
          </div>
        </section>

        <section className="px-6 py-16 bg-white/5 border-y border-white/10">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {[
              { icon: Building2, title: "BSEED permit firehose", body: "Every commercial roof permit pulled in Detroit, scored, and routed to you within 24h." },
              { icon: TrendingUp, title: "Property manager intel", body: "We surface the actual decision-maker on each property — not just the building owner." },
              { icon: CheckCircle2, title: "Manual outreach scripts", body: "AI drafts the cold call/email script based on the building's history. You make the call." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="border border-white/10 rounded-xl p-6 bg-white/5">
                <Icon className="w-8 h-8 text-[#00d4ff] mb-3" />
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-sm text-white/70">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 py-20 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-black mb-4">Pilot pricing: $399/mo</h2>
          <p className="text-white/70 mb-8">First 5 Detroit roofers only. Forever-locked rate. Cancel anytime.</p>
          <Link
            to="/contractor-leads"
            className="inline-block bg-[#00d4ff] text-[#0a1628] font-bold px-8 py-4 rounded-lg text-lg hover:bg-[#33dcff]"
          >
            Claim a Pilot Spot
          </Link>
        </section>
      </main>
    </>
  );
}
