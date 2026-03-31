import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileText, DollarSign, ArrowRight, CheckCircle, Loader2, Shield, Clock, Target } from "lucide-react";
import { trackLeadCapture } from "@/lib/gtag";

const SAMPLE_GRANTS = [
  { name: "SBA Community Advantage Loan", amount: "$50K–$250K", deadline: "Rolling", match: "92%", type: "Federal" },
  { name: "USDA Rural Business Grant", amount: "$10K–$500K", deadline: "Mar 31", match: "88%", type: "Federal" },
  { name: "State MEDC Small Biz Grant", amount: "$5K–$50K", deadline: "Apr 15", match: "85%", type: "State" },
  { name: "████████████████████", amount: "$███K", deadline: "███ ██", match: "??%", type: "🔒" },
  { name: "████████████████████", amount: "$███K", deadline: "███ ██", match: "??%", type: "🔒" },
];

export default function FreeGrantDigest() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Enter your email"); return; }
    setSubmitting(true);
    try {
      await supabase.from("marketing_leads").upsert({
        email,
        first_name: name || null,
        industry: industry || null,
        source: "free_grant_digest",
        service_interested: "grant_funding_digest",
      }, { onConflict: "email" });

      await supabase.from("newsletter_subscribers").upsert({
        email,
        source: "free_grant_digest",
      }, { onConflict: "email" });

      await supabase.functions.invoke("deliver-sample-report", {
        body: { email, name, report_type: "grant_digest", industry },
      });

      setSubmitted(true);
      toast.success("Check your inbox!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Free AI Grant & Funding Report — Find Grants for Your Business"
        description="Get a free AI-curated grant and funding report matched to your industry. Discover federal, state, and private grants you qualify for. No credit card required."
        path="/free-grant-digest"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: "AI Grant & Funding Digest — Free Sample",
          description: "AI-curated grants matched to your business industry and size.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-16 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/20 p-3 rounded-xl">
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">Free Sample Report</p>
          <h1 className="text-3xl font-black mb-4 leading-tight">
            Free Money Exists.<br />Most Businesses Never Apply.
          </h1>
          <p className="text-slate-300 text-base max-w-xl mx-auto leading-relaxed">
            Our AI matches <strong className="text-white">grants, loans, and funding programs</strong> to your business — federal, state, and private.
            See 3 matches free, get 15+ weekly with a subscription.
          </p>
        </div>

        {/* Sample Preview */}
        <div className="max-w-2xl mx-auto px-6 py-10">
          <h2 className="text-xl font-black text-foreground mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Sample Grant Matches
          </h2>
          <div className="space-y-3">
            {SAMPLE_GRANTS.map((g, i) => (
              <div key={i} className={`border border-border rounded-xl p-4 bg-card ${i >= 3 ? "opacity-40 blur-[2px] select-none" : ""}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-foreground">{g.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {g.type} · Deadline: {g.deadline}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-primary text-sm">{g.amount}</p>
                    <p className="text-xs text-emerald-400 font-bold">Match: {g.match}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Full digest includes 15+ matched opportunities with application links, eligibility details, and deadlines.
          </p>
        </div>

        {/* Email Capture */}
        <div className="bg-muted/30 px-6 py-12" id="signup">
          <div className="max-w-md mx-auto text-center">
            {submitted ? (
              <div className="space-y-4">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-xl font-black text-foreground">Check Your Inbox!</h3>
                <p className="text-muted-foreground text-sm">Your free grant digest is on its way. Want the full 15+ matches every week?</p>
                <a href="/get-started?service=grant_digest" className="inline-block bg-primary text-white px-6 py-3 font-bold text-sm rounded-lg hover:opacity-90">
                  Unlock Full Digest — $29/mo →
                </a>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-black text-foreground mb-2">Get Your Free Grant Report</h3>
                <p className="text-muted-foreground text-sm mb-6">Tell us your industry and we'll match you to available grants.</p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="bg-card" />
                  <Input placeholder="Your email *" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-card" />
                  <Input placeholder="Your industry (e.g., Construction, Restaurant)" value={industry} onChange={(e) => setIndustry(e.target.value)} className="bg-card" />
                  <Button type="submit" disabled={submitting} className="w-full font-bold">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Send My Free Grant Report
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Trust Signals */}
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
          <h3 className="text-lg font-black text-foreground text-center">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <Target className="w-5 h-5" />, title: "AI Matching", desc: "Our engine scans 500+ grant databases and matches to your industry, size, and location." },
              { icon: <Clock className="w-5 h-5" />, title: "Weekly Updates", desc: "New grants open every week. We surface them before deadlines pass." },
              { icon: <Shield className="w-5 h-5" />, title: "No Spam", desc: "Just your grant digest. Unsubscribe anytime with one click." },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="text-primary mb-2 flex justify-center">{f.icon}</div>
                <p className="font-bold text-sm text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Footer */}
        <div className="bg-[#1e293b] text-white px-6 py-10 text-center">
          <p className="text-sm text-slate-400 mb-2">Don't miss another funding opportunity</p>
          <a href="/get-started?service=grant_digest" className="inline-block bg-primary text-white px-8 py-3 font-bold rounded-lg hover:opacity-90 transition-all">
            Get Full Weekly Digest — $29/mo
          </a>
          <p className="text-xs text-slate-500 mt-3">Cancel anytime. No contracts.</p>
        </div>
      </div>
    </>
  );
}
