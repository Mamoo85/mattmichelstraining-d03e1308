import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Newspaper, MapPin, TrendingUp } from "lucide-react";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping",
  "Auto Repair", "Restaurant", "Retail", "Other",
];

const FEATURES = [
  {
    icon: Newspaper,
    title: "PR-Ready Format",
    desc: "Every press release follows AP style and the exact format editors and PR sites require — ready to submit as-is.",
  },
  {
    icon: MapPin,
    title: "Local SEO Boost",
    desc: "Your business name, city, and industry keywords woven throughout. Every submission builds local search authority.",
  },
  {
    icon: TrendingUp,
    title: "Monthly Consistency",
    desc: "One release per month, every month. Consistent coverage in local outlets compounds over time.",
  },
];

export default function AIPressRelease() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    city: "",
    industry: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email) {
      toast.error("Business name and email are required.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-press-release-checkout", {
        body: form,
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("No checkout URL returned.");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-orange-500" />
          </div>
          <h1 className="text-3xl font-black mb-3">Trial Started!</h1>
          <p className="text-slate-400 leading-relaxed mb-4">
            Matt will reach out within 24 hours to confirm your business details and get your first press release written.
          </p>
          <p className="text-sm text-slate-500">
            Questions? <a href="mailto:matt@m2training.com" className="text-orange-500">matt@m2training.com</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <section className="px-4 pt-20 pb-16 text-center max-w-3xl mx-auto">
        <div className="inline-block bg-orange-500/10 text-orange-400 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6 border border-orange-500/20">
          AI Press Release Service
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          Monthly Press Releases.<br />Written by AI. Ready to Submit.
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
          Get your business in local news and online publications. AI writes a professional press release every month — ready to submit to Google News, local papers, and PR sites.
        </p>
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-5xl font-black text-white">$39</span>
          <div className="text-left">
            <div className="text-slate-400 text-sm">/month</div>
            <div className="text-orange-400 text-xs font-semibold">7-day free trial</div>
          </div>
        </div>
        <p className="text-slate-500 text-sm">No contracts. Cancel anytime.</p>
      </section>

      {/* Where it gets submitted */}
      <section className="px-4 pb-12 max-w-2xl mx-auto">
        <p className="text-center text-slate-500 text-xs uppercase tracking-widest mb-4">Submitted to</p>
        <div className="flex flex-wrap justify-center gap-3">
          {["Google News", "PR.com", "PRLog", "Local Newspapers", "Business Journals", "Industry Blogs"].map((outlet) => (
            <span
              key={outlet}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-sm px-4 py-2 rounded-full"
            >
              {outlet}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-16 max-w-4xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center mb-3">
                  <Icon size={20} className="text-orange-500" />
                </div>
                <CardTitle className="text-white text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Form */}
      <section className="px-4 pb-24 max-w-lg mx-auto">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-xl">Start Your Free Trial</CardTitle>
            <p className="text-slate-400 text-sm">7 days free — then $39/mo. Cancel anytime.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Your Name</Label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Dave Torres"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Business Name <span className="text-orange-500">*</span></Label>
                <Input
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder="Torres HVAC"
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Email <span className="text-orange-500">*</span></Label>
                <Input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="dave@torreshvac.com"
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">City</Label>
                <Input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Detroit, MI"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Industry</Label>
                <select
                  name="industry"
                  value={form.industry}
                  onChange={handleChange}
                  className="w-full h-10 rounded-md bg-slate-700 border border-slate-600 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select your industry</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 text-base mt-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin mr-2" /> Processing...</>
                ) : (
                  "Start Free Trial — $39/mo after"
                )}
              </Button>
              <p className="text-center text-xs text-slate-500">
                Secure checkout via Stripe. No charge for 7 days.
              </p>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
