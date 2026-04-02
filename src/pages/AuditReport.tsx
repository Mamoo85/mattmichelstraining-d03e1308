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
  CheckCircle, Zap, Search, Smartphone, MousePointer,
  ArrowRight, Loader2, BarChart3, Star
} from "lucide-react";

const WHAT_YOU_GET = [
  { icon: Zap, title: "Speed & Performance", desc: "Page load time, Core Web Vitals, hosting grade — with specific fixes ranked by impact." },
  { icon: Search, title: "SEO & Local Visibility", desc: "Keyword gaps, missing local signals, Google Business Profile alignment." },
  { icon: Smartphone, title: "Mobile Usability", desc: "Tap targets, text size, layout shifts — tested on real device dimensions." },
  { icon: MousePointer, title: "Conversion Rate Issues", desc: "Are your CTAs visible? Is your phone number clickable? Is the form above the fold?" },
  { icon: BarChart3, title: "Prioritized Fix List", desc: "Top 5 things to fix, ranked by how much they'll move the needle for your business." },
];

export default function AuditReport() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  const [form, setForm] = useState({ business_name: "", city: "", website_url: "", email: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_name || !form.city || !form.email) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-audit-checkout", {
        body: form,
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-[#f97316]/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-[#f97316]" />
          </div>
          <h1 className="text-2xl font-black mb-3">Audit Report Ordered</h1>
          <p className="text-[#aaa] text-sm leading-relaxed mb-6">
            Your website audit report is being prepared and will be emailed to you within 24 hours. You'll get a detailed breakdown of speed, SEO, mobile experience, and a prioritized fix list.
          </p>
          <Link to="/detroit-web-design">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
              Back to Main Site
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Website Audit Report — $9 | Matt Michels Web Design"
        description="Get a full website audit in 24 hours. Speed, SEO, mobile, conversion issues, and a prioritized fix list. $9 flat — no upsell."
        path="/audit-report"
      />
      <div className="min-h-screen bg-[#0f0f1a] text-white">

        {/* Hero */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6">
              <BarChart3 size={11} /> Website Audit · Metro Detroit
            </div>
            <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-5">
              Find Out Exactly<br />
              <span className="text-[#f97316]">Why Your Site Isn't Working.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#aaa] max-w-2xl mx-auto mb-8 leading-relaxed">
              For $9, Matt Michels runs a full website audit and emails you a plain-English report with exactly what's wrong and how to fix it. Used by 50+ Metro Detroit businesses.
            </p>
            <Button
              size="lg"
              className="bg-[#f97316] hover:bg-[#ea6c10] text-white text-base px-8 py-5 font-bold rounded-xl"
              onClick={() => document.getElementById("audit-form")?.scrollIntoView({ behavior: "smooth" })}
            >
              Get My Audit — $9 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-[#666] mt-4">Report emailed within 24 hours · No upsell · No subscription</p>
          </div>
        </section>

        {/* What's Included */}
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-center mb-10">What's in Your Audit Report</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {WHAT_YOU_GET.map((item) => (
                <div key={item.title} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-5">
                  <div className="w-9 h-9 rounded-lg bg-[#f97316]/15 flex items-center justify-center mb-3">
                    <item.icon size={16} className="text-[#f97316]" />
                  </div>
                  <h3 className="font-bold text-sm mb-1.5">{item.title}</h3>
                  <p className="text-xs text-[#888] leading-relaxed">{item.desc}</p>
                </div>
              ))}
              <div className="bg-[#1a1a2e] border border-[#f97316]/30 rounded-xl p-5">
                <div className="w-9 h-9 rounded-lg bg-[#f97316]/15 flex items-center justify-center mb-3">
                  <Star size={16} className="text-[#f97316]" />
                </div>
                <h3 className="font-bold text-sm mb-1.5">Delivered in 24 Hours</h3>
                <p className="text-xs text-[#888] leading-relaxed">Plain-English report emailed to you. No jargon, no fluff — just what to fix.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Form */}
        <section id="audit-form" className="px-4 pb-24">
          <div className="max-w-lg mx-auto">
            <Card className="bg-[#1a1a2e] border-white/10">
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-xl font-bold mb-1">Order Your Audit — $9</h2>
                <p className="text-sm text-[#888] mb-6">Fill in your info below. Your report will be emailed within 24 hours.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[#aaa] text-xs">Business Name *</Label>
                      <Input
                        value={form.business_name}
                        onChange={e => setForm(f => ({...f, business_name: e.target.value}))}
                        placeholder="Smith Plumbing LLC"
                        className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[#aaa] text-xs">City *</Label>
                      <Input
                        value={form.city}
                        onChange={e => setForm(f => ({...f, city: e.target.value}))}
                        placeholder="Grosse Pointe, MI"
                        className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[#aaa] text-xs">Website URL (if you have one)</Label>
                    <Input
                      value={form.website_url}
                      onChange={e => setForm(f => ({...f, website_url: e.target.value}))}
                      placeholder="https://smithplumbing.com"
                      className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                    />
                    <p className="text-[10px] text-[#555] mt-1">No website? I'll audit your Google Business Profile instead.</p>
                  </div>
                  <div>
                    <Label className="text-[#aaa] text-xs">Email Address *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({...f, email: e.target.value}))}
                      placeholder="you@yourbusiness.com"
                      className="bg-white/5 border-white/15 text-white placeholder:text-[#555]"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#f97316] hover:bg-[#ea6c10] text-white font-bold py-5 text-base rounded-xl"
                    disabled={loading}
                  >
                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Get My Audit Report — $9 →"}
                  </Button>
                  <p className="text-[10px] text-center text-[#555]">Secure payment via Stripe. Report emailed within 24 hours.</p>
                </form>
              </CardContent>
            </Card>

            <div className="mt-6 text-center">
              <p className="text-xs text-[#666]">
                Want to check your score for free first?{" "}
                <Link to="/local-business-score" className="text-[#f97316] hover:underline">
                  Try the free Business Score Tool →
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
