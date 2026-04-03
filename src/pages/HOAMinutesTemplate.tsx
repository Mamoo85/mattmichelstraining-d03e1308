import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, FileText, Download } from "lucide-react";

const CHECKLIST = [
  "Call to order format",
  "Attendance & quorum verification",
  "Motion + vote recording",
  "Action item tracker",
  "Treasurer's report section",
  "Executive session notes",
  "Adjournment language",
];

const TRUST = [
  { icon: Download, label: "Instant email delivery" },
  { icon: CheckCircle, label: "No credit card" },
  { icon: FileText, label: "Used by real HOA boards" },
];

export default function HOAMinutesTemplate() {
  const [form, setForm] = useState({ email: "", name: "", hoaName: "", homeCount: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) {
      toast.error("Email address is required");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("hoa-lead-magnet-capture", {
        body: { email: form.email, name: form.name, hoaName: form.hoaName, homeCount: form.homeCount },
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-foreground mb-3">Check your inbox —</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            the template is on its way. Most boards complete their first set of minutes in under 15 minutes using it.
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Questions? Call or text{" "}
            <a href="tel:+13138064952" className="text-primary font-bold">(313) 806-4952</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Free HOA Meeting Minutes Template — Download Instantly"
        description="Free HOA meeting minutes template used by 200+ boards. Robert's Rules format, legally sound, fills in under 20 minutes. Download instantly."
        path="/hoa-minutes-template"
      />
      <div className="min-h-screen bg-background text-foreground">

        {/* Hero + Form */}
        <section className="pt-20 pb-16 px-4 border-b border-border">
          <div className="max-w-3xl mx-auto">
            {/* Badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold tracking-widest uppercase">
                <Download size={11} /> Free Download
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black leading-tight text-center mb-5">
              The HOA Meeting Minutes Template<br />
              <span className="text-primary">Attorneys Actually Approve</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
              Used by 200+ HOA boards. Copy-paste format that meets Robert's Rules, satisfies state disclosure laws, and takes under 20 minutes to fill out.
            </p>

            <div className="grid sm:grid-cols-2 gap-12 items-start">
              {/* Form */}
              <div className="bg-card border border-border rounded-xl p-6">
                <h2 className="text-lg font-black mb-1">Get the Free Template</h2>
                <p className="text-xs text-muted-foreground mb-5">Delivered to your inbox instantly. No strings attached.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="jane@mapleridgehoa.com"
                      className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Jane Smith"
                      className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                      HOA Name
                    </label>
                    <input
                      type="text"
                      value={form.hoaName}
                      onChange={(e) => setForm((p) => ({ ...p, hoaName: e.target.value }))}
                      placeholder="Maple Ridge HOA"
                      className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                      Number of Homes
                    </label>
                    <select
                      value={form.homeCount}
                      onChange={(e) => setForm((p) => ({ ...p, homeCount: e.target.value }))}
                      className="w-full bg-background border border-border px-3 py-2.5 text-sm focus:ring-1 focus:ring-primary outline-none rounded text-foreground"
                    >
                      <option value="">Select range</option>
                      <option value="1-50">1–50</option>
                      <option value="51-200">51–200</option>
                      <option value="201-500">201–500</option>
                      <option value="500+">500+</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 mt-1 rounded transition-opacity"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {loading ? "Sending…" : "Send Me the Free Template"}
                  </button>
                </form>

                {/* Trust signals */}
                <div className="flex flex-wrap justify-center gap-4 mt-5 pt-4 border-t border-border">
                  {TRUST.map((t) => (
                    <div key={t.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <t.icon size={12} className="text-primary" />
                      {t.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">What's Included</h3>
                <ul className="space-y-3">
                  {CHECKLIST.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle size={16} className="text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Soft CTA */}
                <div className="mt-8 p-4 bg-card border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Want AI to write your minutes automatically?{" "}
                    <a
                      href="/hoa-secretary"
                      className="text-primary font-bold inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      See HOA Secretary AI <ArrowRight size={11} />
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
