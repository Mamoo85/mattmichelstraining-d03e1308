import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Hash, Share2, Calendar } from "lucide-react";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping",
  "Auto Repair", "Restaurant", "Retail", "Other",
];

const PLATFORM_OPTIONS = ["Facebook", "Instagram", "LinkedIn", "TikTok"];

const FEATURES = [
  {
    icon: Calendar,
    title: "30 Captions Monthly",
    desc: "30 ready-to-post captions delivered at the start of every month. That's every day covered.",
  },
  {
    icon: Share2,
    title: "All Platforms",
    desc: "Captions written and formatted for Facebook, Instagram, LinkedIn, and TikTok — each platform's style respected.",
  },
  {
    icon: Hash,
    title: "Hashtags Included",
    desc: "Relevant, researched hashtags included with every caption. No guessing what to tag.",
  },
];

export default function AISocialCaptionPack() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    industry: "",
  });
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName || !form.email) {
      toast.error("Business name and email are required.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-social-captions-checkout", {
        body: { ...form, platforms },
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
          <h1 className="text-3xl font-black mb-3">Captions Coming Your Way!</h1>
          <p className="text-slate-400 leading-relaxed mb-4">
            Matt will reach out within 24 hours to confirm your platforms and business voice. Your first 30 captions will be ready within 48 hours.
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
          AI Social Media Captions
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          30 Social Media Captions.<br />Every Month. $29.
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
          AI writes 30 ready-to-post captions with hashtags every month — for Facebook, Instagram, and LinkedIn. Just copy, paste, post.
        </p>
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-5xl font-black text-white">$29</span>
          <div className="text-left">
            <div className="text-slate-400 text-sm">/month</div>
            <div className="text-orange-400 text-xs font-semibold">7-day free trial</div>
          </div>
        </div>
        <p className="text-slate-500 text-sm">No contracts. Cancel anytime.</p>
      </section>

      {/* Value props */}
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

      {/* What you get callout */}
      <section className="px-4 pb-16 max-w-2xl mx-auto">
        <div className="bg-slate-800 border border-orange-500/20 rounded-2xl p-6 text-center">
          <p className="text-slate-400 text-sm uppercase tracking-widest mb-4">What you get every month</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {["30 Captions", "With Hashtags", "Your Industry", "Every Platform"].map((item) => (
              <div key={item} className="flex flex-col items-center gap-1">
                <CheckCircle size={18} className="text-orange-500" />
                <span className="text-white text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="px-4 pb-24 max-w-lg mx-auto">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-xl">Start Your Free Trial</CardTitle>
            <p className="text-slate-400 text-sm">7 days free — then $29/mo. Cancel anytime.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Your Name</Label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Sarah Williams"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Business Name <span className="text-orange-500">*</span></Label>
                <Input
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder="Williams Electric"
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
                  placeholder="sarah@williamselectric.com"
                  required
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
              <div className="space-y-2">
                <Label className="text-slate-300 text-sm">Platforms <span className="text-slate-500 font-normal">(select all that apply)</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORM_OPTIONS.map((platform) => {
                    const selected = platforms.includes(platform);
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => togglePlatform(platform)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          selected
                            ? "bg-orange-500/10 border-orange-500 text-orange-400"
                            : "bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          selected ? "bg-orange-500 border-orange-500" : "border-slate-500"
                        }`}>
                          {selected && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        {platform}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 text-base mt-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin mr-2" /> Processing...</>
                ) : (
                  "Start Free Trial — $29/mo after"
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
