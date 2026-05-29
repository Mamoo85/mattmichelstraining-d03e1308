import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield, AlertTriangle, FileSearch, Loader2,
  CheckCircle, ArrowRight, Clock, Building2,
} from "lucide-react";

const PAIN_POINTS = [
  { icon: AlertTriangle, title: "EPA Fines Up to $105,000/Day", desc: "Missing a single filing deadline can trigger penalties that cripple a small manufacturer." },
  { icon: Clock, title: "Consultants Charge $3K–$15K/Year", desc: "Most manufacturers overpay for basic compliance monitoring that AI handles in seconds." },
  { icon: FileSearch, title: "Regulations Change Constantly", desc: "OSHA, EPA, and state agencies update rules quarterly. One missed notice = one audit risk." },
];

export default function FreeComplianceScan() {
  const [form, setForm] = useState({ businessName: "", email: "", industry: "", state: "MI" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email) {
      toast.error("Please fill in required fields");
      return;
    }
    setLoading(true);
    try {
      await supabase.from("web_design_leads" as any).insert({
        name: form.businessName,
        business: form.businessName,
        email: form.email,
        industry: form.industry || "manufacturing",
        city: form.state,
        status: "new",
        description: `Lead magnet: Free Compliance Scan. Industry: ${form.industry}. State: ${form.state}.`,
        notes: "Source: /free-compliance-scan lead magnet",
      });
      // Also insert into prospect_businesses so Neo can follow up automatically
      await supabase.from("prospect_businesses" as any).insert({
        business_name: form.businessName,
        email: form.email,
        industry: form.industry || "manufacturing",
        state: form.state,
        tier: "A",
        outreach_status: "new",
        source: "lead_magnet_compliance_scan",
        notes: `Inbound lead from /free-compliance-scan. Industry: ${form.industry}.`,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#22d3ee]/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-[#22d3ee]" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Scan Submitted!</h1>
          <p className="text-gray-400 mb-4">
            We'll run your compliance scan and email you the results within 24 hours. If we find anything urgent, we'll flag it immediately.
          </p>
          <p className="text-gray-500 text-sm">Check your email at <strong className="text-white">{form.email}</strong></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Free Compliance Scan for Manufacturers — EPA, OSHA, State"
        description="Get a free AI-powered compliance scan for your manufacturing business. We check EPA, OSHA, and state regulatory filings so you don't get blindsided by an audit."
      />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-full px-4 py-1.5 mb-6">
              <Shield size={14} className="text-red-400" />
              <span className="text-sm text-red-400 font-medium">100% Free — No Credit Card Required</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Is Your Plant<br />
              <span className="text-[#22d3ee]">Audit-Ready Right Now?</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
              We'll scan federal and state registers for your specific industry and tell you exactly which filings you might be missing — before an inspector does.
            </p>
            <a href="#scan" className="inline-flex items-center gap-2 bg-[#22d3ee] text-white px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-[#06b6d4] transition-colors">
              Get My Free Scan <ArrowRight size={18} />
            </a>
          </div>
        </section>

        {/* Pain Points */}
        <section className="py-16 px-4 border-y border-white/10">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {PAIN_POINTS.map((p) => (
              <div key={p.title} className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="w-12 h-12 rounded-lg bg-red-500/15 flex items-center justify-center mb-4">
                  <p.icon size={22} className="text-red-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{p.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What You Get */}
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">What's in Your Free Scan</h2>
            <div className="space-y-3">
              {[
                "Federal register check for your SIC/NAICS codes",
                "State-level environmental filing requirements",
                "OSHA reporting obligations based on industry",
                "Upcoming deadline calendar for the next 90 days",
                "Risk score: Low / Medium / High audit exposure",
                "Recommended next steps (no obligation)",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-[#22d3ee] mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Form */}
        <section id="scan" className="py-20 px-4 bg-white/[0.02]">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2">Request Your Free Scan</h2>
            <p className="text-gray-400 text-center mb-8 text-sm">Takes 30 seconds. Results delivered to your inbox within 24 hours.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-gray-300">Company Name *</Label>
                <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Acme Manufacturing" />
              </div>
              <div>
                <Label className="text-gray-300">Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="you@acmemfg.com" />
              </div>
              <div>
                <Label className="text-gray-300">Industry / What You Manufacture</Label>
                <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Metal fabrication, chemicals, food processing..." />
              </div>
              <div>
                <Label className="text-gray-300">State</Label>
                <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="MI" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[#22d3ee] hover:bg-[#06b6d4] text-white py-3 text-base font-semibold">
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Run My Free Compliance Scan →"}
              </Button>
              <p className="text-center text-xs text-gray-500">No credit card. No obligation. Just answers.</p>
            </form>
          </div>
        </section>

        <footer className="py-8 px-4 border-t border-white/10 text-center">
          <p className="text-gray-500 text-sm">Detroit Web Agency · Grosse Pointe, MI · <a href="mailto:matt@mattmichelstraining.com" className="text-[#22d3ee]">matt@mattmichelstraining.com</a></p>
        </footer>
      </div>
    </>
  );
}
