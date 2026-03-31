import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, Globe, Search, RefreshCw, FileText, Users, TrendingDown } from "lucide-react";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping",
  "Construction", "Auto Repair", "Dental", "Medical/Healthcare",
  "Real Estate", "Restaurant", "Salon/Barbershop", "Gym/Fitness",
  "Law Firm", "Accounting", "Consulting", "Other",
];

const FEATURES = [
  { icon: FileText, title: "Homepage Hero Copy", desc: "A new headline, subheadline, and CTA — written to convert visitors into leads." },
  { icon: Search, title: "FAQ Section", desc: "6 updated FAQs targeting the exact questions your customers search for." },
  { icon: Globe, title: "SEO Keywords Included", desc: "Every rewrite is seeded with local and industry keywords to boost rankings." },
];

const MONTHLY_DELIVERABLES = [
  "Hero headline + subheadline",
  "3 value propositions (updated)",
  "6 FAQs — refreshed and keyword-rich",
  "Meta description suggestion",
  "1 blog post outline (bonus)",
];

export default function AIWebsiteCopy() {
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    website: "",
    industry: "",
    city: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const success = new URLSearchParams(window.location.search).get("status") === "success";

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">You're in!</h1>
          <p className="text-slate-300 leading-relaxed">
            Your AI Website Copy subscription is active. Your first batch of fresh copy will be delivered to your email within 48 hours.
          </p>
          <p className="mt-6 text-sm text-slate-400">
            Questions? <a href="tel:+13138064952" className="text-orange-500 hover:underline">(313) 806-4952</a>
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.businessName || !form.email) {
      setError("Business name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-website-copy-checkout", {
        body: form,
      });
      if (fnError) throw fnError;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 text-sm font-semibold px-4 py-1.5 rounded-full mb-6 border border-orange-500/20">
          <Globe size={14} />
          AI Website Copy Service
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          Fresh Website Copy <span className="text-orange-500">Every Month</span>
        </h1>
        <p className="text-slate-300 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-8">
          Stale website copy kills conversions. AI rewrites your homepage and FAQ section every month —
          keeping it fresh, keyword-rich, and high-converting. Just copy and paste.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-400">
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> $49/mo</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> 7-day free trial</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> Cancel anytime</span>
        </div>
      </section>

      {/* Problem callout */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-8 py-6 flex items-start gap-5">
          <TrendingDown size={32} className="text-red-400 shrink-0 mt-1" />
          <div>
            <p className="text-white font-bold text-lg mb-1">The problem with "set it and forget it" websites</p>
            <p className="text-slate-300 text-sm leading-relaxed">
              Google rewards fresh, regularly updated content. Most small business websites haven't changed in 2–3 years —
              which means Google is slowly ranking you lower while your competitor's newer content climbs. Monthly copy updates
              signal to Google that your site is active and relevant.
            </p>
          </div>
        </div>
      </section>

      {/* What you get each month */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-8">What You Get Each Month</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <RefreshCw size={24} className="text-orange-500 mb-4" />
            <h3 className="text-white font-bold text-lg mb-4">Monthly Deliverables</h3>
            <ul className="space-y-3">
              {MONTHLY_DELIVERABLES.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-3">Sample Hero Copy — HVAC</p>
            <div className="space-y-3">
              <div>
                <p className="text-slate-500 text-xs mb-1">Headline</p>
                <p className="text-white font-black text-lg leading-snug">"Detroit's Most Trusted HVAC — Same-Day Service, Fair Pricing, No Surprises"</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1">Subheadline</p>
                <p className="text-slate-300 text-sm leading-relaxed">"Serving Metro Detroit homeowners since 2011. Licensed, insured, and backed by 400+ 5-star reviews. Call before noon — we'll be there today."</p>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <p className="text-slate-500 text-xs mb-1.5">Value Props</p>
                <div className="flex flex-wrap gap-2">
                  {["Same-Day Available", "Flat-Rate Pricing", "10-Year Guarantee"].map(v => (
                    <span key={v} className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-1 rounded-full">{v}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <Icon size={28} className="text-orange-500 mb-4" />
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Form */}
      <section className="px-6 pb-20 max-w-lg mx-auto">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-xl font-black">Start Your Free Trial</CardTitle>
            <p className="text-slate-400 text-sm">$49/mo after 7 days. First copy batch delivered within 48 hours.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-slate-300 text-sm">Your Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="John Smith"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="businessName" className="text-slate-300 text-sm">Business Name <span className="text-orange-500">*</span></Label>
                <Input
                  id="businessName"
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder="Smith HVAC LLC"
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-slate-300 text-sm">Email <span className="text-orange-500">*</span></Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="john@smithhvac.com"
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="website" className="text-slate-300 text-sm">Website URL</Label>
                <Input
                  id="website"
                  name="website"
                  type="url"
                  value={form.website}
                  onChange={handleChange}
                  placeholder="https://smithhvac.com"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="industry" className="text-slate-300 text-sm">Industry</Label>
                  <select
                    id="industry"
                    name="industry"
                    value={form.industry}
                    onChange={handleChange}
                    className="w-full rounded-md bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city" className="text-slate-300 text-sm">City</Label>
                  <Input
                    id="city"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Detroit"
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-base"
              >
                {submitting ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                {submitting ? "Processing…" : "Get My First Month Free →"}
              </Button>
              <p className="text-center text-xs text-slate-500">No credit card needed to start. $49/mo after 7 days.</p>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <section className="border-t border-slate-800 py-10 px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Users size={18} className="text-orange-500" />
          <span className="text-slate-400 text-sm">Built by Matt Michels — Grosse Pointe, MI</span>
        </div>
        <p className="text-slate-500 text-xs">Questions? <a href="tel:+13138064952" className="text-orange-500 hover:underline">(313) 806-4952</a> · <a href="mailto:matt@mattmichelstraining.com" className="text-orange-500 hover:underline">matt@mattmichelstraining.com</a></p>
      </section>
    </div>
  );
}
