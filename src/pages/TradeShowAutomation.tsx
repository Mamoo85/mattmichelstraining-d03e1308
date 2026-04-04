import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Upload, Users, MessageSquare, TrendingUp, Zap, Clock } from "lucide-react";

const FEATURES = [
  {
    icon: Upload,
    title: "CSV Upload → Instant Intelligence",
    desc: "Drop in your badge-scan export. AI cross-references each contact against LinkedIn, company websites, and public databases to build a complete profile: role, company size, recent news, buying signals.",
  },
  {
    icon: Users,
    title: "Personalized at Scale",
    desc: "Every follow-up sequence is written from scratch for each contact. Not a mail-merge. AI references their specific role, company, and what they likely cared about at your booth.",
  },
  {
    icon: MessageSquare,
    title: "3-Touch Sequence Over 7 Days",
    desc: "Day 1 intro, Day 3 value add, Day 7 soft ask. Each email is distinct — not 'just following up.' Sequences follow proven B2B cadences that get responses.",
  },
  {
    icon: TrendingUp,
    title: "Response Tracking Dashboard",
    desc: "See open rates, reply rates, and which contacts are engaging. Know exactly who to prioritize for a live call before you ever pick up the phone.",
  },
  {
    icon: Zap,
    title: "Launches in Hours, Not Weeks",
    desc: "Upload Monday morning. First emails land Monday afternoon. By Friday, every contact from the show has heard from you — without you writing a single message.",
  },
  {
    icon: Clock,
    title: "You Get Your 100 Hours Back",
    desc: "200 contacts × 30 minutes of manual follow-up = 100 hours of work. You'd never actually do it all. Now you don't have to choose who gets followed up with.",
  },
];

const COMPARISON = [
  { tool: "Outreach.io", price: "$100+/seat/mo", what: "Sales engagement platform — built for full sales teams" },
  { tool: "Salesloft", price: "$125+/seat/mo", what: "Enterprise sales cadence tool — complex, expensive" },
  { tool: "Manual follow-up", price: "100+ hours", what: "30 min/contact × 200 contacts — most never get done" },
  { tool: "M2 Trade Show Automation", price: "$99/mo", what: "AI-researched, personalized sequences for every contact — first campaign free", highlight: true },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Upload your CSV", desc: "Export badge scans from any event platform. Drop the file in your dashboard." },
  { step: "02", title: "AI researches each contact", desc: "Within hours, every contact has a full profile: company, role, news, LinkedIn, and likely pain points." },
  { step: "03", title: "Review and approve sequences", desc: "Browse the generated sequences. Edit any message you want, or approve them all in one click." },
  { step: "04", title: "Emails launch on your schedule", desc: "Sequences go out over 7 days. You watch the response tracking. Call the ones who engage." },
];

export default function TradeShowAutomation() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "" });
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
      const { data, error } = await supabase.functions.invoke("create-trade-show-automation-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">You're in.</h1>
        <p className="text-muted-foreground">Matt will reach out within 24 hours to get your first campaign set up. Bring your badge-scan CSV from your next show — or your last one. We'll start following up immediately.</p>
        <p className="mt-4 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="Trade Show Follow-Up Automation — AI Sequences for Every Contact | $99/mo"
        description="Upload your badge-scan CSV. AI researches every contact, writes personalized 3-touch follow-up sequences, and launches them over 7 days. First campaign free."
        path="/trade-show-automation"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-24 pb-20 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <Zap size={11} /> Trade Show Automation
            </div>
            <h1 className="text-4xl sm:text-6xl font-black leading-tight mb-6">
              Upload Your Badge Scans Monday.<br />
              <span className="text-primary">AI Follows Up With Every Contact by Friday.</span>
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
              You spent $5,000 on the trade show floor. You came back with 200 badge scans. And you followed up with maybe 15 of them — because doing it right takes 30 minutes per contact.
            </p>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              M2 researches every single contact and generates a personalized 3-email sequence for each one. All 200 get a real follow-up. You just approve and launch.
            </p>
            <div className="flex flex-col items-center gap-2 mb-10">
              <div className="text-5xl font-black text-primary">$99<span className="text-2xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">First campaign free · No contracts · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start My First Campaign Free <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Pain section */}
        <section className="py-16 px-4 border-b border-border">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-black mb-6">The Trade Show Math Nobody Talks About</h2>
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              {[
                { number: "200", label: "Contacts from a typical show" },
                { number: "30 min", label: "To research and write one real follow-up" },
                { number: "100 hrs", label: "To follow up with everyone — you never will" },
              ].map((stat) => (
                <div key={stat.label} className="p-6 border border-border rounded-lg">
                  <div className="text-3xl font-black text-primary mb-2">{stat.number}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-muted-foreground">
              Your competitors are doing the same thing — following up with 10% of their leads and hoping for the best. M2 gives you systematic follow-up for 100% of them.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 px-4 bg-card border-b border-border">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">How It Works</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {HOW_IT_WORKS.map((step) => (
                <div key={step.step} className="flex gap-4">
                  <div className="text-3xl font-black text-primary/20 flex-shrink-0 leading-none">{step.step}</div>
                  <div>
                    <p className="font-bold text-sm mb-1">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 border-b border-border">
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
        <section className="py-16 px-4 bg-card border-b border-border">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-2 uppercase tracking-tight">What Others Charge</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Enterprise tools are built for 50-person sales teams. You need results from a single show.</p>
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
            <h2 className="text-2xl font-black text-center mb-2">Run Your First Campaign Free</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">
              No credit card required for your first campaign. After that, $99/mo for every show you attend.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "businessName", label: "Business Name *", placeholder: "Acme Industrial" },
                { key: "name", label: "Your Name *", placeholder: "John Smith" },
                { key: "email", label: "Work Email *", placeholder: "john@acmeindustrial.com", type: "email" },
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
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded-sm transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {loading ? "Redirecting…" : "Start My First Campaign Free"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">$99/mo after first campaign · Cancel anytime</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
