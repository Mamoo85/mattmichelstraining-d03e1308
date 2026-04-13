import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PhoneMissed, MessageSquare, Star, Zap, Loader2,
  CheckCircle, ArrowRight, DollarSign, Shield, TrendingUp,
} from "lucide-react";

const BUNDLE_FEATURES = [
  {
    icon: PhoneMissed,
    title: "Missed Call Text-Back",
    desc: "Customer calls while you're on a job? They get an instant text: \"Hey, I just missed your call — how can I help?\" No more lost leads.",
  },
  {
    icon: MessageSquare,
    title: "SMS Follow-Up Drips",
    desc: "After every estimate, job, or quote — automatic text sequences keep you top-of-mind without lifting a finger.",
  },
  {
    icon: Star,
    title: "Review Monitor & Alerts",
    desc: "Get notified the second a new Google review drops. Respond fast, build trust, rank higher.",
  },
];

const STATS = [
  { value: "62%", label: "of calls missed by contractors go unanswered" },
  { value: "$1,200", label: "average revenue lost per missed call" },
  { value: "< 5min", label: "to set up — no app, no hardware" },
];

const INCLUDED = [
  "Instant missed call text-back (under 10 seconds)",
  "3-step estimate follow-up drip",
  "After-job review request sequence",
  "Google review monitoring & alerts",
  "Custom messages per service type",
  "Works with any phone — mobile or landline",
  "Monthly performance report",
  "Cancel anytime — no contracts",
];

export default function RevenuePreventer() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";
  const [form, setForm] = useState({ businessName: "", email: "", phone: "", name: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email || !form.phone) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-revenue-preventer-checkout", {
        body: form,
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#22d3ee]/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-[#22d3ee]" />
          </div>
          <h1 className="text-3xl font-bold mb-3">You're All Set!</h1>
          <p className="text-gray-400 mb-6">
            We'll have your Revenue Preventer bundle live within 24 hours. You'll get a welcome email with next steps shortly.
          </p>
          <a href="/" className="text-[#22d3ee] hover:underline">← Back to homepage</a>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Revenue Preventer Bundle — Stop Losing $1,200 Per Missed Call"
        description="Missed Call Text-Back + SMS Follow-Up Drips + Review Monitor — all for $299/mo. Built for contractors who are too busy working to chase leads."
      />
      <div className="min-h-screen bg-[#0f0f1a] text-white">
        {/* Hero */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-[#22d3ee]/10 border border-[#22d3ee]/30 rounded-full px-4 py-1.5 mb-6">
              <Shield size={14} className="text-[#22d3ee]" />
              <span className="text-sm text-[#22d3ee] font-medium">Revenue Protection System</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Stop Losing Jobs<br />
              <span className="text-[#22d3ee]">Every Time You Miss a Call</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
              62% of contractor calls go unanswered. Each one costs you $1,200+ on average.
              The Revenue Preventer catches every lead, follows up automatically, and gets you more 5-star reviews — for $299/mo.
            </p>
            <a href="#signup" className="inline-flex items-center gap-2 bg-[#22d3ee] text-white px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-[#06b6d4] transition-colors">
              Get Started <ArrowRight size={18} />
            </a>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 border-y border-white/10">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 px-4 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-[#22d3ee] mb-1">{s.value}</div>
                <div className="text-sm text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* What's Included */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Three Tools. One Price. Zero Missed Revenue.</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {BUNDLE_FEATURES.map((f) => (
                <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="w-12 h-12 rounded-lg bg-[#22d3ee]/15 flex items-center justify-center mb-4">
                    <f.icon size={22} className="text-[#22d3ee]" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Full Feature List */}
        <section className="py-16 px-4 bg-white/[0.02]">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Everything in the $299/mo Bundle</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INCLUDED.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle size={16} className="text-[#22d3ee] mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-20 px-4">
          <div className="max-w-lg mx-auto text-center">
            <div className="bg-white/5 border border-[#22d3ee]/30 rounded-2xl p-8">
              <div className="text-sm text-[#22d3ee] font-medium mb-2">REVENUE PREVENTER BUNDLE</div>
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-5xl font-bold">$299</span>
                <span className="text-gray-400">/mo</span>
              </div>
              <p className="text-gray-400 text-sm mb-1">Saves if you buy separately: $392/mo</p>
              <p className="text-[#22d3ee] text-sm font-medium mb-6">You save $93/mo with the bundle</p>
              <div className="flex items-center gap-2 justify-center text-gray-400 text-sm">
                <DollarSign size={14} />
                <span>No setup fees. No contracts. Cancel anytime.</span>
              </div>
            </div>
          </div>
        </section>

        {/* Signup Form */}
        <section id="signup" className="py-20 px-4 bg-white/[0.02]">
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2">Get Started in Under 5 Minutes</h2>
            <p className="text-gray-400 text-center mb-8 text-sm">Fill this out and we'll get you set up within 24 hours.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-gray-300">Business Name *</Label>
                <Input
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Acme Plumbing"
                />
              </div>
              <div>
                <Label className="text-gray-300">Your Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <Label className="text-gray-300">Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="john@acmeplumbing.com"
                />
              </div>
              <div>
                <Label className="text-gray-300">Business Phone *</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="(313) 555-1234"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#22d3ee] hover:bg-[#06b6d4] text-white py-3 text-base font-semibold"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Start My Revenue Preventer →"}
              </Button>
              <p className="text-center text-xs text-gray-500">7-day free trial. $299/mo after. Cancel anytime.</p>
            </form>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-white/10 text-center">
          <p className="text-gray-500 text-sm">
            Detroit Web Agency · Grosse Pointe, MI · <a href="mailto:matt@mattmichelstraining.com" className="text-[#22d3ee]">matt@mattmichelstraining.com</a> · (313) 992-1219
          </p>
        </footer>
      </div>
    </>
  );
}
