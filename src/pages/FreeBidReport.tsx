import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText, Search, TrendingUp, Loader2,
  CheckCircle, ArrowRight, MapPin, Hammer,
} from "lucide-react";

const BENEFITS = [
  { icon: Search, title: "Jobs You're Missing Right Now", desc: "We scan public bid boards, state procurement portals, and commercial listings for open jobs matching your trade and area." },
  { icon: MapPin, title: "Filtered to Your Service Area", desc: "No noise. Only bids within your drive radius — sorted by deadline and estimated value." },
  { icon: TrendingUp, title: "See What's Actually Out There", desc: "Most subs don't know how many jobs go uncontested in their area. This report shows you the opportunity gap." },
];

export default function FreeBidReport() {
  const [form, setForm] = useState({ businessName: "", email: "", trade: "", city: "Detroit", state: "MI" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email || !form.trade) {
      toast.error("Please fill in required fields");
      return;
    }
    setLoading(true);
    try {
      await supabase.from("web_design_leads" as any).insert({
        name: form.businessName,
        business: form.businessName,
        email: form.email,
        industry: form.trade,
        city: `${form.city}, ${form.state}`,
        status: "new",
        description: `Lead magnet: Free Bid Report. Trade: ${form.trade}. Area: ${form.city}, ${form.state}.`,
        notes: "Source: /free-bid-report lead magnet",
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
          <div className="w-20 h-20 rounded-full bg-[#e8621a]/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-[#e8621a]" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Report Requested!</h1>
          <p className="text-gray-400 mb-4">
            We're pulling open bids for <strong className="text-white">{form.trade}</strong> in <strong className="text-white">{form.city}, {form.state}</strong>. Your report will hit your inbox within 24 hours.
          </p>
          <p className="text-gray-500 text-sm">Check your email at <strong className="text-white">{form.email}</strong></p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Free Local Bid Report for Subcontractors — Open Jobs in Your Area"
        description="See what commercial and government bids are open in your trade and service area. Free AI-powered bid report — no credit card, no obligation."
      />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#e8621a]/10 border border-[#e8621a]/30 rounded-full px-4 py-1.5 mb-6">
              <Hammer size={14} className="text-[#e8621a]" />
              <span className="text-sm text-[#e8621a] font-medium">100% Free — Built for Subcontractors</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              How Many Jobs Are You<br />
              <span className="text-[#e8621a]">Not Bidding On?</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
              We'll scan public bid boards, state procurement portals, and commercial listings — then send you a report of every open job matching your trade and area. Free.
            </p>
            <a href="#report" className="inline-flex items-center gap-2 bg-[#e8621a] text-white px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-[#d45a17] transition-colors">
              Get My Free Report <ArrowRight size={18} />
            </a>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 px-4 border-y border-white/10">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="w-12 h-12 rounded-lg bg-[#e8621a]/15 flex items-center justify-center mb-4">
                  <b.icon size={22} className="text-[#e8621a]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What's in the Report */}
        <section className="py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">What's in Your Free Report</h2>
            <div className="space-y-3">
              {[
                "Open commercial bids matching your specific trade",
                "Government RFPs from state and local portals",
                "Estimated project value ranges",
                "Bid deadlines and submission requirements",
                "Contact info for general contractors posting jobs",
                "Competitive density score (how many subs are bidding)",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-[#e8621a] mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Form */}
        <section id="report" className="py-20 px-4 bg-white/[0.02]">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2">Request Your Free Bid Report</h2>
            <p className="text-gray-400 text-center mb-8 text-sm">Tell us your trade and area — we'll find the jobs.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-gray-300">Company Name *</Label>
                <Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Smith Electric LLC" />
              </div>
              <div>
                <Label className="text-gray-300">Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="you@smithelectric.com" />
              </div>
              <div>
                <Label className="text-gray-300">Your Trade *</Label>
                <Input value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Electrical, Plumbing, Concrete, HVAC..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300">City</Label>
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Detroit" />
                </div>
                <div>
                  <Label className="text-gray-300">State</Label>
                  <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="MI" />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[#e8621a] hover:bg-[#d45a17] text-white py-3 text-base font-semibold">
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Send Me My Free Bid Report →"}
              </Button>
              <p className="text-center text-xs text-gray-500">No credit card. No sales call. Just a list of jobs you can bid on today.</p>
            </form>
          </div>
        </section>

        <footer className="py-8 px-4 border-t border-white/10 text-center">
          <p className="text-gray-500 text-sm">M² Development · Grosse Pointe, MI · <a href="mailto:matt@mattmichelstraining.com" className="text-[#e8621a]">matt@mattmichelstraining.com</a></p>
        </footer>
      </div>
    </>
  );
}
