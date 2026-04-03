import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileText, Users, Clock, Send, Archive } from "lucide-react";

const FEATURES = [
  {
    icon: FileText,
    title: "Raw Notes In. Professional Minutes Out.",
    desc: "Submit your meeting notes in any format — voice memo transcript, bullet points, rough text. Within 10 minutes you receive formatted, Robert's Rules-compliant minutes ready to distribute.",
  },
  {
    icon: Send,
    title: "Auto-Emailed to All Members",
    desc: "Approved minutes are emailed to your entire homeowner list automatically. No mail merge, no BCC lists, no manual forwarding. Every member gets a clean PDF within minutes of your approval.",
  },
  {
    icon: CheckCircle,
    title: "Action Items Extracted and Tracked",
    desc: "Every task, follow-up, and commitment from the meeting is pulled out, assigned to the right board member, and included in a separate action item summary. Nothing falls through the cracks.",
  },
  {
    icon: Clock,
    title: "Next Meeting Agenda Generated",
    desc: "Based on open action items and recurring agenda points, a draft agenda for your next meeting is created automatically. One less thing for the board to argue about.",
  },
  {
    icon: Users,
    title: "Full Meeting History Stored",
    desc: "Every set of minutes is stored and searchable. When a homeowner disputes a decision made three years ago, you have the record in seconds — not in a filing cabinet somewhere.",
  },
  {
    icon: Archive,
    title: "Works for Any HOA Size",
    desc: "Whether you have 20 homeowners or 400, the system handles it. Scales without extra cost, works for self-managed and professionally managed communities alike.",
  },
];

const COMPARISON = [
  { tool: "HOA management company secretary", price: "$200–500/mo", what: "Bundled service, slow turnaround, not dedicated to your HOA" },
  { tool: "Professional HOA secretary service", price: "$150–300/meeting", what: "Per-meeting billing, scheduling headaches, human error" },
  { tool: "Board members doing it themselves", price: "3-4 hrs/meeting", what: "Volunteer burnout, inconsistent format, delayed distribution" },
  { tool: "M² HOA Secretary AI", price: "$149/mo", what: "10-minute turnaround, auto-distributed, action items tracked", highlight: true },
];

export default function HOASecretary() {
  const [form, setForm] = useState({ email: "", name: "", hoaName: "", phone: "", memberCount: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.hoaName) {
      toast.error("Email and HOA name are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-hoa-secretary-checkout", { body: form });
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
        <h1 className="text-2xl font-black text-foreground mb-3">Your board is covered.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Matt will reach out within 24 hours to configure your homeowner email list and meeting format preferences. Submit your next set of notes and minutes come back in 10 minutes.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Questions? Call or text{" "}
          <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead
        title="HOA Board Secretary AI — Meeting Minutes in 10 Minutes | $149/mo"
        description="Submit raw meeting notes, get professional minutes back in 10 minutes. Auto-emailed to all members. Action items tracked. $149/mo, 14-day free trial."
        path="/hoa-secretary"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <FileText size={11} /> HOA Secretary AI
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Meeting Notes In.<br />
              <span className="text-primary">Professional Minutes Out.</span><br />
              Members Notified — Automatically.
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Your board volunteers already have jobs. Making them format meeting minutes, distribute PDFs, and track action items on top of everything else is how you lose good board members. Let AI handle the paperwork.
            </p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">
                $149<span className="text-xl text-muted-foreground font-normal">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground">Unlimited meetings · 14-day free trial · Cancel anytime</p>
            </div>
            <button
              onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Start Free Trial <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Pain Bridge */}
        <section className="py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-lg text-muted-foreground leading-relaxed">
              The typical HOA board meeting is followed by{" "}
              <span className="text-foreground font-bold">3-4 hours of secretary work</span>{" "}
              — formatting, editing, emailing, and filing. That's time your volunteers don't have, which is why minutes often sit{" "}
              <span className="text-foreground font-bold">weeks before they're distributed</span>.
            </p>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
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
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-2 uppercase tracking-tight">What the Alternatives Cost</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Most boards are paying far more — in time or money — than they realize.</p>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div
                  key={c.tool}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    c.highlight ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex-1 pr-4">
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-sm font-black whitespace-nowrap ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>
                    {c.price}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Signup */}
        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Your 14-Day Free Trial</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">
              No charge today. Submit your next meeting notes and see the result yourself.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "hoaName", label: "HOA Name *", placeholder: "Maple Ridge HOA" },
                { key: "name", label: "Your Name *", placeholder: "Jane Smith" },
                { key: "email", label: "Email Address *", placeholder: "jane@mapleridgehoa.com", type: "email" },
                { key: "phone", label: "Phone Number", placeholder: "(313) 555-0100", type: "tel" },
                { key: "memberCount", label: "Approx. Number of Homeowners", placeholder: "85", type: "number" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                    {f.label}
                  </label>
                  <input
                    type={f.type || "text"}
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded transition-opacity"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {loading ? "Redirecting…" : "Start Free Trial — $149/mo After"}
              </button>
              <p className="text-center text-xs text-muted-foreground pt-1">14-day free trial. No card charged today.</p>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
