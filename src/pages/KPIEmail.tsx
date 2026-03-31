import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, BarChart3, Brain, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping", "Auto Repair",
  "Restaurant", "Salon/Barbershop", "Gym/Fitness", "Dental/Medical", "Real Estate",
  "Retail", "Construction", "Legal", "Accounting", "Other",
];

const BENEFITS = [
  { icon: BarChart3, title: "Weekly Performance Snapshot", desc: "Every Monday you get a clear summary of your key business metrics." },
  { icon: Brain, title: "AI Recommendations", desc: "Not just data — actionable suggestions to improve each metric." },
  { icon: TrendingUp, title: "Track Trends Over Time", desc: "See what's improving, what's slipping, and where to focus next." },
  { icon: Zap, title: "Zero Manual Work", desc: "No dashboards to check. No spreadsheets to update. Just read your email." },
];

export default function KPIEmail() {
  const [form, setForm] = useState({ name: "", businessName: "", email: "", industry: "", website: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const success = new URLSearchParams(window.location.search).get("success") === "1";

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">You're all set!</h1>
          <p className="text-slate-400 leading-relaxed">Your 7-day free trial is active. Your first KPI report will arrive next Monday.</p>
          <p className="mt-4 text-sm text-slate-500">Questions? <a href="mailto:matt@mattmichelstraining.com" className="text-orange-500">matt@mattmichelstraining.com</a></p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.businessName) {
      toast.error("Business name and email are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-kpi-email-checkout", {
        body: { ...form },
      });
      if (fnError) throw fnError;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <div className="bg-slate-900 px-6 py-16 text-center border-b border-slate-800">
        <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-orange-500 bg-orange-500/10 px-3 py-1 rounded-full mb-4">
          Business KPI Weekly Email
        </span>
        <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
          Know your numbers without lifting a finger.
        </h1>
        <p className="text-2xl font-black text-orange-500 mb-2">$49<span className="text-sm font-normal text-slate-400">/mo</span></p>
        <p className="text-slate-400 text-sm">7-day free trial — cancel anytime</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="bg-slate-800/50 border-slate-700 p-5">
              <Icon size={20} className="text-orange-500 mb-3" />
              <p className="font-bold text-sm text-white mb-1">{title}</p>
              <p className="text-[12px] text-slate-400">{desc}</p>
            </Card>
          ))}
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Connect Your Data", desc: "Website, Google Analytics, or manual KPIs — we pull the numbers." },
              { step: "2", title: "AI Analyzes Weekly", desc: "Every Monday, AI crunches your metrics and spots trends." },
              { step: "3", title: "Read & Act", desc: "A clean email with your KPIs, trends, and AI recommendations." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-black flex items-center justify-center mx-auto mb-3">{s.step}</div>
                <p className="font-bold text-sm text-white mb-1">{s.title}</p>
                <p className="text-[12px] text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sign-Up Form */}
        <Card className="bg-slate-800/50 border-slate-700 p-6 mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-white mb-4">Start Your Free Trial</h2>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Your Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Matt Michels" className="bg-slate-900 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Business Name *</Label>
                <Input required value={form.businessName} onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))} placeholder="Smith Plumbing Co." className="bg-slate-900 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Email *</Label>
                <Input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@business.com" className="bg-slate-900 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Industry</Label>
                <Select value={form.industry} onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white mt-1">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Website</Label>
                <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://yourbusiness.com" className="bg-slate-900 border-slate-700 text-white mt-1" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 font-bold text-sm uppercase tracking-widest">
              {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <ArrowRight size={14} className="mr-2" />}
              {loading ? "Redirecting to checkout..." : "Start Free Trial — $49/mo"}
            </Button>
            <p className="text-[11px] text-slate-500 text-center">Secure checkout via Stripe. 7-day free trial. Cancel anytime.</p>
          </form>
        </Card>

        {/* Footer */}
        <p className="text-[12px] text-slate-500 text-center">
          Questions? Email <a href="mailto:matt@mattmichelstraining.com" className="text-orange-500">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" className="text-orange-500">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );
}
