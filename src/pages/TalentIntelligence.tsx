import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Zap, Shield, Lock, TrendingUp, CheckCircle2 } from "lucide-react";
import ROICalculator from "@/components/talent-intel/ROICalculator";
import TerritoryScarcity from "@/components/talent-intel/TerritoryScarcity";
import CaseStudyBlock from "@/components/talent-intel/CaseStudyBlock";

const COUNTIES = ["Wayne", "Oakland", "Macomb", "Washtenaw", "Livingston", "Genesee", "St. Clair", "Monroe"];

export default function TalentIntelligence() {
  const [params] = useSearchParams();
  const canceled = params.get("canceled") === "1";
  const [form, setForm] = useState({
    agency_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    vertical: "industrial" as "industrial" | "healthcare",
    territory_counties: ["Wayne", "Oakland", "Macomb"],
    pricing_model: "performance" as "performance" | "annual_prepay",
  });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.agency_name || !form.contact_email) {
      toast.error("Agency name and contact email required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-agency-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message || "Failed to start checkout");
    } finally {
      setLoading(false);
    }
  };

  const toggleCounty = (c: string) => {
    setForm(f => ({
      ...f,
      territory_counties: f.territory_counties.includes(c)
        ? f.territory_counties.filter(x => x !== c)
        : [...f.territory_counties, c],
    }));
  };

  return (
    <>
      <SEOHead title="Pre-Market Talent Intelligence | Detroit Web Agency" description="Proprietary talent signal engine for specialized recruiters. First-mover access to skilled trade and licensed healthcare candidates 48 hours before they reach open job boards." />
      <div className="min-h-screen" style={{ background: "#0a1628" }}>
        {canceled && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-center py-2 text-sm">
            Checkout canceled — no charge made.
          </div>
        )}

        {/* Hero */}
        <section className="px-6 pt-20 pb-16 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-xs font-semibold tracking-wider uppercase mb-6">
            Invitation-Only · Metro Detroit
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white max-w-4xl mx-auto leading-tight">
            Get the candidate's phone number
            <br />
            <span className="text-[#00d4ff]">48 hours before Indeed does.</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mt-6">
            We surface licensed industrial and healthcare candidates the moment their license posts,
            their LinkedIn flips to #OpenToWork, or their employer files a WARN notice.
            You call them first. That's the whole pitch.
          </p>
        </section>

        {/* Three-tier pricing */}
        <section className="px-6 pb-16 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Proof Drop */}
            <div className="bg-[#0f1f35] border border-white/10 rounded-2xl p-8">
              <div className="text-[#94a3b8] text-xs uppercase tracking-wider font-semibold mb-3">Free · 1 candidate, on us</div>
              <div className="text-white text-3xl font-bold mb-1">FREE</div>
              <div className="text-slate-500 text-sm mb-6">One pre-vetted candidate. No card.</div>
              <ul className="space-y-3 text-slate-300 text-sm mb-8">
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />One free candidate matched to your active roles</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />Keep the full placement fee — zero owed to us</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />No contract, no card required</li>
              </ul>
              <a href="#request-form" className="block text-center py-3 rounded-lg border border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff]/5 transition-colors text-sm font-semibold">Request Free Candidate →</a>
            </div>

            {/* Performance */}
            <div className="bg-[#0f1f35] border-2 border-[#00d4ff] rounded-2xl p-8 relative shadow-[0_0_40px_rgba(0,212,255,0.15)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00d4ff] text-[#0a1628] text-xs font-bold px-3 py-1 rounded-full">RECOMMENDED START</div>
              <div className="text-[#00d4ff] text-xs uppercase tracking-wider font-semibold mb-3">Pay-per-interview</div>
              <div className="text-white text-3xl font-bold mb-1">$250</div>
              <div className="text-slate-500 text-sm mb-6">Per interview that actually happens · Zero monthly</div>
              <ul className="space-y-3 text-slate-300 text-sm mb-8">
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />Daily candidate feed in your portal</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />$250 only when the candidate shows up. Ghosts and reschedules are free.</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />One-click Fast-Track Interview button</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />Cancel anytime — pure performance</li>
              </ul>
              <button onClick={() => { setForm(f => ({ ...f, pricing_model: "performance" })); document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth" }); }} className="block w-full text-center py-3 rounded-lg bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 transition-colors text-sm font-bold">Start with Performance →</button>
            </div>

            {/* Territory Lock */}
            <div className="bg-[#0f1f35] border border-white/10 rounded-2xl p-8">
              <div className="text-[#94a3b8] text-xs uppercase tracking-wider font-semibold mb-3">Lock your territory</div>
              <div className="text-white text-3xl font-bold mb-1">$25K<span className="text-base text-slate-500">/yr</span></div>
              <div className="text-slate-500 text-sm mb-6">Annual prepay · Save $17K vs monthly</div>
              <ul className="space-y-3 text-slate-300 text-sm mb-8">
                <li className="flex gap-2"><Lock className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />Exclusive feed for your vertical + counties</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />Unlimited interviews — no per-booking fee</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />Custom ATS sync (Bullhorn, Greenhouse, Workable)</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5 flex-shrink-0" />Priority candidate routing in your territory</li>
              </ul>
              <button onClick={() => { setForm(f => ({ ...f, pricing_model: "annual_prepay" })); document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth" }); }} className="block w-full text-center py-3 rounded-lg border border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff]/5 transition-colors text-sm font-semibold">Lock My Territory →</button>
            </div>
          </div>
        </section>

        {/* Territory scarcity */}
        <section className="px-6 py-12 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <TerritoryScarcity />
          </div>
        </section>

        {/* ROI Calculator */}
        <section className="px-6 py-12 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-white text-2xl md:text-3xl font-bold mb-2">Run your own numbers.</h2>
              <p className="text-slate-400 text-sm">No sales call needed. Plug in your placements — see the math.</p>
            </div>
            <ROICalculator />
          </div>
        </section>

        {/* Case studies */}
        <section className="px-6 py-12 border-t border-white/5">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-white text-2xl md:text-3xl font-bold mb-2">Recent placements.</h2>
              <p className="text-slate-400 text-sm">Outcomes only. Agency names withheld for territorial protection.</p>
            </div>
            <CaseStudyBlock />
          </div>
        </section>

        {/* Why pre-market */}
        <section className="px-6 py-16 border-t border-white/5">
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            <div>
              <Zap className="w-8 h-8 text-[#00d4ff] mb-3" />
              <h3 className="text-white font-bold mb-2">48-Hour Window</h3>
              <p className="text-slate-400 text-sm">Pre-market candidates flagged before they post a resume. Your competitors are still searching the same recycled job boards.</p>
            </div>
            <div>
              <Shield className="w-8 h-8 text-[#00d4ff] mb-3" />
              <h3 className="text-white font-bold mb-2">Black Box Methodology</h3>
              <p className="text-slate-400 text-sm">Our talent signal engine combines behavioral, certification, and intent signals. Methods are proprietary and never disclosed to clients.</p>
            </div>
            <div>
              <TrendingUp className="w-8 h-8 text-[#00d4ff] mb-3" />
              <h3 className="text-white font-bold mb-2">One-Click Fast-Track</h3>
              <p className="text-slate-400 text-sm">Click ⚡ Fast-Track in the portal. Candidate is contacted, interview booked on your calendar in 24h.</p>
            </div>
          </div>
        </section>

        {/* Request form */}
        <section id="request-form" className="px-6 py-16 border-t border-white/5">
          <div className="max-w-xl mx-auto bg-[#0f1f35] border border-white/10 rounded-2xl p-8">
            <h2 className="text-white text-2xl font-bold mb-2">Apply for Access</h2>
            <p className="text-slate-400 text-sm mb-6">Limited to 3 industrial + 3 healthcare agencies in Metro Detroit. Matt personally reviews each application.</p>

            <div className="space-y-4">
              <div>
                <label className="text-slate-300 text-xs uppercase tracking-wider mb-1.5 block">Agency Name *</label>
                <Input value={form.agency_name} onChange={e => setForm({ ...form, agency_name: e.target.value })} className="bg-[#0a1628] border-white/10 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 text-xs uppercase tracking-wider mb-1.5 block">Your Name</label>
                  <Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} className="bg-[#0a1628] border-white/10 text-white" />
                </div>
                <div>
                  <label className="text-slate-300 text-xs uppercase tracking-wider mb-1.5 block">Phone</label>
                  <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} className="bg-[#0a1628] border-white/10 text-white" />
                </div>
              </div>
              <div>
                <label className="text-slate-300 text-xs uppercase tracking-wider mb-1.5 block">Email *</label>
                <Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} className="bg-[#0a1628] border-white/10 text-white" />
              </div>
              <div>
                <label className="text-slate-300 text-xs uppercase tracking-wider mb-1.5 block">Vertical</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["industrial", "healthcare"] as const).map(v => (
                    <button key={v} onClick={() => setForm({ ...form, vertical: v })} className={`py-2.5 rounded-lg border text-sm font-semibold capitalize transition-colors ${form.vertical === v ? "bg-[#00d4ff] text-[#0a1628] border-[#00d4ff]" : "bg-[#0a1628] text-slate-300 border-white/10 hover:border-[#00d4ff]/40"}`}>
                      {v === "industrial" ? "🔧 Industrial / Trades" : "🏥 Healthcare"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-300 text-xs uppercase tracking-wider mb-1.5 block">Territory Counties</label>
                <div className="flex flex-wrap gap-2">
                  {COUNTIES.map(c => (
                    <button key={c} onClick={() => toggleCounty(c)} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${form.territory_counties.includes(c) ? "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/40" : "bg-[#0a1628] text-slate-400 border-white/10"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={submit} disabled={loading} className="w-full bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0a1628] font-bold py-6 text-base">
                  {loading ? "Processing..." : form.pricing_model === "annual_prepay" ? "Continue to $25K Prepay →" : "Save Card & Activate Performance Feed →"}
                </Button>
                <p className="text-slate-500 text-xs text-center mt-3">
                  {form.pricing_model === "performance" ? "No charge today. Card saved for $250 per-interview billing." : "Annual prepay — full year of exclusive territory access."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="text-center py-8 pb-28 md:pb-8 text-slate-600 text-xs border-t border-white/5">
          Detroit Web Agency · Proprietary Talent Signal Engine · matt@detroitwebagent.com
        </footer>

        {/* Sticky mobile CTA bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a1628]/95 backdrop-blur-lg border-t border-[#00d4ff]/30 px-4 py-3 flex gap-2">
          <a href="#request-form" className="flex-1 text-center py-3 rounded-lg border border-[#00d4ff]/40 text-[#00d4ff] text-xs font-bold uppercase tracking-wider">Free Candidate</a>
          <button
            onClick={() => { setForm(f => ({ ...f, pricing_model: "performance" })); document.getElementById("request-form")?.scrollIntoView({ behavior: "smooth" }); }}
            className="flex-1 py-3 rounded-lg bg-[#00d4ff] text-[#0a1628] text-xs font-bold uppercase tracking-wider"
          >
            Start $250/Interview
          </button>
        </div>
      </div>
    </>
  );
}
