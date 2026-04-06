import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileText, Clock, AlertTriangle, Calendar, Zap, Shield } from "lucide-react";

const FEATURES = [
  { icon: FileText, title: "Key Dates Extracted Automatically", desc: "Lease expiration, renewal deadlines, rent escalation dates, and option windows — all pulled from your lease and put on a calendar you can actually use." },
  { icon: AlertTriangle, title: "Obligation Alerts Before They're Due", desc: "30, 60, and 90-day warnings before critical deadlines. No more missing a renewal window because it was buried in section 14(b)(iii)." },
  { icon: Shield, title: "Clause Risk Summary", desc: "AI flags high-risk clauses — personal guarantees, exclusivity restrictions, CAM audit rights — and explains them in plain English." },
  { icon: Calendar, title: "Monthly Lease Health Report", desc: "Every month you get a clean summary: upcoming obligations, rent schedule, landlord responsibilities, and any clauses worth renegotiating." },
  { icon: Clock, title: "Multi-Location Support", desc: "Managing 3 locations or 30, every lease gets the same rigorous extraction. Add new leases any time." },
  { icon: Zap, title: "Works on Any Lease Format", desc: "Upload a PDF, Word doc, or scanned image. AI handles the rest — no templates, no manual entry." },
];

const COMPARISON = [
  { tool: "Real estate attorney review", price: "$500–2,000/lease", what: "One-time review, no ongoing alerts, hourly rate adds up fast" },
  { tool: "Paralegal services", price: "$150–300/hr", what: "Manual work, turnaround measured in days, not minutes" },
  { tool: "Calendar reminders (manual)", price: "Free but risky", what: "You still have to read the lease and set everything yourself" },
  { tool: "M2 Commercial Lease Abstractor", price: "$149/mo", what: "AI extraction, ongoing deadline alerts, monthly summaries — all locations", highlight: true },
];

export default function CommercialLease() {
  const [form, setForm] = useState({ email: "", name: "", company_name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const success = new URLSearchParams(window.location.search).get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.company_name) { toast.error("Email and company name are required"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-commercial-lease-checkout", { body: form });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">You're set.</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">Matt will reach out within 24 hours to collect your lease documents and complete setup. First extraction runs within 48 hours.</p>
        <p className="mt-6 text-sm text-muted-foreground">Questions? <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a></p>
      </div>
    </div>
  );

  return (
    <>
      <SEOHead title="Commercial Lease Abstractor — $149/mo | M2 Training" description="AI extracts key dates, deadlines, and risk clauses from your commercial leases. Monthly summaries + automated alerts. Never miss a renewal window again." path="/commercial-lease" />
      <div className="min-h-screen bg-background text-foreground">
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase mb-6">
              <FileText size={11} /> Commercial Lease Intelligence
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">Your Lease Has<br /><span className="text-primary">Deadlines You've Forgotten.</span></h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">Most commercial tenants miss renewal windows, pay avoidable CAM charges, and violate use clauses — not from negligence, but because their lease is 40 pages of legalese. AI reads it so you don't have to.</p>
            <div className="flex flex-col items-center gap-1 mb-8">
              <div className="text-4xl font-black text-primary">$149<span className="text-xl text-muted-foreground font-normal">/mo</span></div>
              <p className="text-sm text-muted-foreground">All locations included · Cancel anytime</p>
            </div>
            <button onClick={() => document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-opacity">
              Get Started <ArrowRight size={14} />
            </button>
          </div>
        </section>

        <section className="py-16 px-4 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-black text-center mb-10 uppercase tracking-tight">What You Get</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0"><f.icon size={16} className="text-primary" /></div>
                  <div><p className="font-bold text-sm mb-1">{f.title}</p><p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-black text-center mb-8 uppercase tracking-tight">The Alternatives Are Expensive</h2>
            <div className="space-y-3">
              {COMPARISON.map((c) => (
                <div key={c.tool} className={`flex items-center justify-between p-4 border rounded-lg ${c.highlight ? "border-primary bg-primary/5" : "border-border"}`}>
                  <div className="flex-1 pr-4">
                    <p className={`font-bold text-sm ${c.highlight ? "text-primary" : "text-foreground"}`}>{c.tool}</p>
                    <p className="text-xs text-muted-foreground">{c.what}</p>
                  </div>
                  <div className={`text-sm font-black whitespace-nowrap ${c.highlight ? "text-primary" : "text-muted-foreground"}`}>{c.price}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="signup" className="py-16 px-4 bg-card border-t border-border">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-black text-center mb-2">Start Abstracting Your Leases</h2>
            <p className="text-center text-muted-foreground text-sm mb-8">Submit your info and Matt will collect your lease documents within 24 hours.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { key: "company_name", label: "Company Name *", placeholder: "Michels Holdings LLC" },
                { key: "name", label: "Your Name *", placeholder: "John Smith" },
                { key: "email", label: "Email Address *", placeholder: "john@company.com", type: "email" },
                { key: "phone", label: "Phone Number", placeholder: "(313) 555-0100", type: "tel" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{f.label}</label>
                  <input type={f.type || "text"} value={(form as any)[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded" />
                </div>
              ))}
              <button type="submit" disabled={loading} className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 rounded transition-opacity">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                {loading ? "Redirecting…" : "Get Started — $149/mo"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
