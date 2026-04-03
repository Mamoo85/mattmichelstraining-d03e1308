import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Building2, Search, Bell, FileText, Calendar, MapPin } from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Agenda Monitoring Across All Boards",
    desc: "City council, planning commission, zoning board of appeals, county board of commissioners — every relevant body for your target cities, checked every week before meetings are held.",
  },
  {
    icon: Bell,
    title: "Keyword Alert System",
    desc: "Tell us what matters to your business: solar, roofing, parking, cannabis, rezoning, specific street names, permit types. Any agenda item matching your keywords triggers an immediate alert.",
  },
  {
    icon: FileText,
    title: "Weekly Intelligence Brief",
    desc: "A plain-English summary delivered every week: what's being considered, what was approved or denied, permit activity, zoning changes, and a risk/opportunity assessment for each item you should know about.",
  },
  {
    icon: Calendar,
    title: "Meeting Schedule Tracking",
    desc: "Know when every relevant board meets — regular sessions, special meetings, emergency sessions. Never miss a public comment period because you didn't know the meeting was happening.",
  },
  {
    icon: MapPin,
    title: "Multi-City Coverage",
    desc: "Operating across multiple municipalities? List every city and county you care about. One subscription covers all of them. One weekly brief covers everything that moved.",
  },
  {
    icon: Building2,
    title: "Permit Activity Monitoring",
    desc: "Beyond council meetings — AI tracks permit applications and approvals in your target areas. See what your competitors are building and where before anyone else does.",
  },
];

const COMPARISON = [
  { tool: "Government Relations Consultant", price: "$2,000–5,000/mo", what: "Human monitoring — expensive, relationship-dependent, not scalable" },
  { tool: "Capitol Clarity", price: "$500+/mo", what: "State-level legislative tracking only — doesn't cover local zoning and council meetings" },
  { tool: "Municode Search", price: "Free / Manual", what: "You manually search city websites, agendas, and meeting minutes — hours per week per city" },
  { tool: "Missing a vote", price: "Months of delay", what: "A zoning denial or permit hold you didn't see coming can set a project back 6–12 months" },
  { tool: "M² Gov Meeting Tracker", price: "$199/mo", what: "Weekly AI brief covering every city, every board, every keyword — 14-day trial", highlight: true },
];

const USE_CASES = [
  {
    industry: "Contractors & Developers",
    pain: "A zoning change you didn't see coming stops your project mid-build. Months of delays and legal costs.",
    win: "You get alerted when rezoning for your target area hits the agenda — before it's voted on. You can attend, comment, or adjust plans.",
  },
  {
    industry: "Cannabis Operators",
    pain: "A new ordinance limiting dispensary locations passes while you're in the middle of a lease negotiation.",
    win: "You know the moment it's proposed. You have weeks to respond, not days after it's already law.",
  },
  {
    industry: "Solar & Roofing Companies",
    pain: "A competitor locks up a commercial roofing contract through a city bid you never saw posted.",
    win: "Bid opportunities, permit activity, and contractor approvals all surface in your weekly brief.",
  },
];

export default function GovMeetingTracker() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", targetCities: "", keywords: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) {
      toast.error("Email and business name are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-gov-meeting-tracker-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">Monitoring starts now.</h1>
        <p className="text-muted-foreground">Matt will confirm your city list and keywords within 24 hours. Your first weekly intelligence brief will arrive before next week's council meetings. You'll never be caught off guard again.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Local Government Meeting Tracker — AI Monitoring for City Council & Zoning | $199/mo"
        description="AI monitors city council agendas, planning commission meetings, and zoning boards for your target cities weekly. Never miss a vote, permit, or decision that affects your business. 14-day trial."
        path="/gov-meeting-tracker"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Building2 size={11} /> Gov Meeting Tracker
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-6">
              Never Miss a Zoning Vote,<br />Permit Approval, or<br />
              <span className="text-primary">Council Decision Again.</span>
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
              Local government moves fast and without warning. A zoning change, a permit hold, a new ordinance — any one of these can set your project back months or kill a deal entirely. And they happen in meetings most business owners never knew occurred.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              M² monitors city council agendas, planning commissions, and zoning boards across all your target cities every week — and delivers a plain-English brief on everything that matters to your business.
            </p>
            <div className="flex flex-col items-center gap-2 mb-10">
              <div className="text-5xl font-black text-primary">$199<span className="text-2xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">14-day free trial · All cities included · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start 14-Day Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Use cases */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-3 uppercase tracking-tight">The Cost of Not Knowing</h2>
            <p className="text-center text-muted-foreground text-sm mb-10">A government decision you didn't see coming isn't just inconvenient. It's expensive.</p>
            <div className="space-y-4">
              {USE_CASES.map((uc) => (
                <div key={uc.industry} className="p-5 border border-border rounded-lg">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">{uc.industry}</div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Without M²</div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{uc.pain}</p>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">With M²</div>
                      <p className="text-sm text-foreground leading-relaxed">{uc.win}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-card border-b border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <f.icon size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-1">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-2 uppercase tracking-tight">What Others Charge</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">A government relations consultant costs $2,000–5,000/mo and still misses local zoning meetings. M² misses nothing.</p>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-4 border rounded-lg ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div>
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-lg font-black whitespace-nowrap ml-4 ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="py-16 px-4">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your 14-Day Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">
              Tell us which cities to watch and what keywords matter. First brief delivered within 7 days.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Apex Roofing & Solar" },
                { key: "name", label: "Your Name *", placeholder: "John Smith" },
                { key: "email", label: "Work Email *", placeholder: "john@apexroofing.com", type: "email" },
                { key: "phone", label: "Phone *", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input
                    type={f.type || "text"}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm"
                  />
                </div>
              ))}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Cities / Counties to Monitor *</label>
                <textarea
                  value={form.targetCities}
                  onChange={(e) => setForm((p) => ({ ...p, targetCities: e.target.value }))}
                  placeholder={"Detroit, MI\nGrosse Pointe, MI\nWarren, MI\nWayne County, MI"}
                  rows={4}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Which cities/counties to monitor? List them.</p>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Keywords to Watch *</label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => setForm((p) => ({ ...p, keywords: e.target.value }))}
                  placeholder="solar, roofing, parking, cannabis, rezoning"
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Keywords to watch for — e.g. solar, roofing, parking, cannabis, rezoning</p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded-sm transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                {loading ? "Redirecting…" : "Start Monitoring — $199/mo"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">14-day free trial · All cities included · Cancel anytime</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
