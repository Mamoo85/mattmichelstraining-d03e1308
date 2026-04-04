import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, FileText, Search, Zap } from "lucide-react";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping",
  "Auto Repair", "Restaurant", "Retail", "Other",
];

const FEATURES = [
  {
    icon: FileText,
    title: "Fresh Content Weekly",
    desc: "4 new blog posts delivered every month — one per week — written specifically for your industry.",
  },
  {
    icon: Search,
    title: "SEO Optimized",
    desc: "Every post is written with keywords, headers, and structure that Google loves.",
  },
  {
    icon: Zap,
    title: "Done-For-You",
    desc: "Posts arrive as ready-to-publish HTML. Paste and go. No editing, no hiring writers.",
  },
];

export default function AIBlogPostService() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    website: "",
    industry: "",
    cmsType: "",
    cmsUrl: "",
    cmsUsername: "",
    cmsAppPassword: "",
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
      const { data, error } = await supabase.functions.invoke("create-blog-post-checkout", {
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
            Matt will reach out within 24 hours to confirm your industry and get your first 4 posts scheduled. Check your inbox.
          </p>
          <p className="text-sm text-slate-500">
            Questions? <a href="mailto:matt@mattmichelstraining.com" className="text-orange-500">matt@mattmichelstraining.com</a>
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
          AI Blog Writing Service
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          4 New Blog Posts.<br />Every Month. Done.
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
          AI writes SEO-friendly blog posts for your business every week — emailed as ready-to-publish HTML. No writer needed.
        </p>
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-5xl font-black text-white">$79</span>
          <div className="text-left">
            <div className="text-slate-400 text-sm">/month</div>
            <div className="text-orange-400 text-xs font-semibold">7-day free trial</div>
          </div>
        </div>
        <p className="text-slate-500 text-sm">No contracts. Cancel anytime.</p>
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
            <p className="text-slate-400 text-sm">7 days free — then $79/mo. Cancel anytime.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Your Name</Label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Jane Smith"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Business Name <span className="text-orange-500">*</span></Label>
                <Input
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder="Smith Roofing LLC"
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
                  placeholder="jane@smithroofing.com"
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Website</Label>
                <Input
                  name="website"
                  value={form.website}
                  onChange={handleChange}
                  placeholder="https://smithroofing.com"
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

              {/* CMS Auto-Publishing */}
              <div className="border-t border-slate-700 pt-4 mt-4">
                <p className="text-slate-300 text-sm font-semibold mb-2">🚀 Auto-Publish to Your Website (Optional)</p>
                <p className="text-slate-500 text-xs mb-3">If you use WordPress or Wix, we can publish posts directly to your blog — no copy-paste needed.</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-slate-300 text-sm">CMS Platform</Label>
                    <select
                      name="cmsType"
                      value={form.cmsType}
                      onChange={handleChange}
                      className="w-full h-10 rounded-md bg-slate-700 border border-slate-600 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">None — email me the posts</option>
                      <option value="wordpress">WordPress</option>
                      <option value="wix">Wix</option>
                    </select>
                  </div>
                  {form.cmsType && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-slate-300 text-sm">
                          {form.cmsType === "wordpress" ? "WordPress Site URL" : "Wix Site URL"}
                        </Label>
                        <Input
                          name="cmsUrl"
                          value={form.cmsUrl}
                          onChange={handleChange}
                          placeholder={form.cmsType === "wordpress" ? "https://yoursite.com" : "https://yoursite.wixsite.com/blog"}
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-slate-300 text-sm">
                          {form.cmsType === "wordpress" ? "WordPress Username" : "Wix API Key"}
                        </Label>
                        <Input
                          name="cmsUsername"
                          value={form.cmsUsername}
                          onChange={handleChange}
                          placeholder={form.cmsType === "wordpress" ? "admin" : "Your Wix API key"}
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-slate-300 text-sm">
                          {form.cmsType === "wordpress" ? "Application Password" : "Wix Site ID"}
                        </Label>
                        <Input
                          name="cmsAppPassword"
                          type="password"
                          value={form.cmsAppPassword}
                          onChange={handleChange}
                          placeholder={form.cmsType === "wordpress" ? "xxxx xxxx xxxx xxxx" : "Your Wix site ID"}
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                        />
                        {form.cmsType === "wordpress" && (
                          <p className="text-slate-500 text-[11px]">
                            WordPress → Users → Your Profile → Application Passwords → Generate one for "M2 Blog Service"
                          </p>
                        )}
                      </div>
                    </>
                  )}
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
                  "Start Free Trial — $79/mo after"
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
