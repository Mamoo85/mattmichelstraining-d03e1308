import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle, MapPin, Search, FileText, ArrowRight,
  Loader2, Globe, TrendingUp, Star
} from "lucide-react";

const FEATURES = [
  {
    icon: MapPin,
    title: "10 Location-Specific Pages",
    desc: "Each page is written for a specific city, neighborhood, or service area your customers actually search.",
  },
  {
    icon: Search,
    title: "Local Keyword Targeting",
    desc: "Matt researches the exact search terms your local customers use — and builds pages around them.",
  },
  {
    icon: FileText,
    title: "Meta Tags + Schema Markup",
    desc: "Every page includes optimized title tags, meta descriptions, and local business schema for Google.",
  },
  {
    icon: Globe,
    title: "Submitted to Google Search Console",
    desc: "Pages are submitted for indexing immediately so Google finds them as fast as possible.",
  },
  {
    icon: TrendingUp,
    title: "Linked from Your Main Site",
    desc: "Pages are properly interlinked with your main site to build authority and pass ranking signals.",
  },
];

const HOW = [
  { step: "01", title: "You submit your business info", desc: "Business name, city, and industry. That's all Matt needs to get started." },
  { step: "02", title: "Matt researches your local keywords", desc: "He identifies the 10 highest-value local searches for your specific market and industry." },
  { step: "03", title: "10 pages get built and delivered", desc: "Each page is purpose-built for one keyword — titled, described, and formatted for Google." },
  { step: "04", title: "Pages go live on your site", desc: "Matt delivers the pages with instructions for adding them. Done within 24 hours of payment." },
];

const SeoPackage = () => {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  const [form, setForm] = useState({
    business_name: "",
    city: "",
    industry: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_name || !form.city || !form.industry || !form.email) {
      toast.error("Please fill in all fields.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-seo-package-checkout", {
        body: {
          business_name: form.business_name,
          city: form.city,
          industry: form.industry,
          email: form.email,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL returned.");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <>
        <SEOHead
          title="Order Confirmed — Local SEO Pages | Matt Michels"
          description="Your 10 local SEO pages are being built by Matt Michels and will be delivered within 24 hours."
          path="/seo-package"
        />
        <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center px-4">
          <div className="text-center max-w-lg">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h1 className="text-3xl font-black text-white mb-4">You're all set!</h1>
            <p className="text-lg text-gray-300 mb-6 leading-relaxed">
              Your 10 local SEO pages are being built and will be emailed to you within 24 hours.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Matt will research your local keywords and deliver finished pages ready to add to your site.
              Check your inbox — including spam — for a confirmation email.
            </p>
            <Link to="/web-design-services">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                ← Back to Web Design Services
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="10 Local SEO Pages — $299 | Matt Michels Web Design"
        description="Matt researches your local keywords and builds 10 dedicated SEO landing pages targeting the exact searches your customers use. One-time $299."
        path="/seo-package"
      />

      <div className="min-h-screen bg-[#0f0f1a] text-white">
        {/* Hero */}
        <section className="px-4 py-20 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#f97316]/10 border border-[#f97316]/30 rounded-full px-4 py-1.5 text-[#f97316] text-sm font-semibold mb-6">
            <Star size={14} />
            One-time purchase — no subscription
          </div>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-6">
            10 local SEO pages built for your business —{" "}
            <span className="text-[#f97316]">$299 one-time</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-8">
            Matt researches your local keywords and builds 10 dedicated pages targeting the exact
            searches your customers use — so Google sends them to you instead of your competitors.
          </p>
          <div className="flex flex-wrap gap-3 justify-center text-sm text-gray-400">
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-400" /> Delivered in 24 hours</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-400" /> No monthly fee</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-green-400" /> Metro Detroit expert</span>
          </div>
        </section>

        {/* What's included */}
        <section className="px-4 py-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-black text-center mb-10">
            What's included in your <span className="text-[#f97316]">10-page SEO package</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="bg-white/5 border-white/10">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-lg bg-[#f97316]/15 flex items-center justify-center mb-4">
                      <Icon size={18} className="text-[#f97316]" />
                    </div>
                    <h3 className="font-bold text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-16 bg-white/[0.02] border-y border-white/5">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black text-center mb-10">How it works</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {HOW.map((h) => (
                <div key={h.step} className="flex gap-4">
                  <div className="shrink-0 text-3xl font-black text-[#f97316]/30">{h.step}</div>
                  <div>
                    <h3 className="font-bold text-white mb-1">{h.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="px-4 py-20 max-w-xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black mb-3">Get your 10 SEO pages</h2>
            <p className="text-gray-400">
              Fill in your business details and you'll be redirected to secure checkout. Pages delivered within 24 hours.
            </p>
          </div>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="business_name" className="text-white text-sm font-semibold mb-1.5 block">
                    Business Name <span className="text-[#f97316]">*</span>
                  </Label>
                  <Input
                    id="business_name"
                    name="business_name"
                    value={form.business_name}
                    onChange={handleChange}
                    placeholder="e.g. Metro Detroit Plumbing"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus:border-[#f97316]"
                  />
                </div>

                <div>
                  <Label htmlFor="city" className="text-white text-sm font-semibold mb-1.5 block">
                    City / Service Area <span className="text-[#f97316]">*</span>
                  </Label>
                  <Input
                    id="city"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="e.g. Grosse Pointe, Sterling Heights"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus:border-[#f97316]"
                  />
                </div>

                <div>
                  <Label htmlFor="industry" className="text-white text-sm font-semibold mb-1.5 block">
                    Industry / Type of Business <span className="text-[#f97316]">*</span>
                  </Label>
                  <Input
                    id="industry"
                    name="industry"
                    value={form.industry}
                    onChange={handleChange}
                    placeholder="e.g. HVAC, Dentist, Law Firm, Restaurant"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus:border-[#f97316]"
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-white text-sm font-semibold mb-1.5 block">
                    Email Address <span className="text-[#f97316]">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@yourbusiness.com"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 focus:border-[#f97316]"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#f97316] hover:bg-[#ea6c0c] text-white font-black text-base py-6"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Redirecting to checkout...
                    </>
                  ) : (
                    <>
                      Get 10 SEO Pages — $299
                      <ArrowRight size={16} className="ml-2" />
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-gray-500">
                  Secure checkout via Stripe. Pages delivered to your email within 24 hours.
                </p>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-gray-500 mt-6">
            Looking for a full website instead?{" "}
            <Link to="/web-design-services" className="text-[#f97316] hover:underline">
              View web design services →
            </Link>
          </p>
        </section>
      </div>
    </>
  );
};

export default SeoPackage;
