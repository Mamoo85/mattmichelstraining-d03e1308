import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, Mail, Calendar, Lightbulb, Target, Users } from "lucide-react";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping",
  "Auto Repair", "Restaurant", "Salon/Barbershop", "Gym/Fitness",
  "Real Estate", "Retail", "Consulting", "Other",
];

const FEATURES = [
  { icon: Target, title: "Industry-Specific Tips", desc: "AI pulls trends and insights from your exact industry — not generic business advice." },
  { icon: Calendar, title: "Every Monday Morning", desc: "Lands in your inbox before the work week kicks off so you can act on it immediately." },
  { icon: Lightbulb, title: "Actionable & Concise", desc: "Three tips you can actually implement. No fluff, no 20-minute reads." },
];

const SAMPLE_TIPS = [
  {
    number: "01",
    headline: "Follow up with every unsold estimate within 48 hours",
    body: "HVAC businesses that follow up on open estimates within 2 days close 31% more jobs. A short text -- 'Hey, just checking in on that quote we sent over' -- is all it takes.",
  },
  {
    number: "02",
    headline: "Ask for the Google review right after job completion",
    body: "The best time to request a review is within 30 minutes of finishing the job. Use a text template: 'So glad we could help! Mind leaving us a quick Google review? [link]' -- response rates are 4x higher in-person vs. email.",
  },
  {
    number: "03",
    headline: "Offer a maintenance plan to every new customer",
    body: "Recurring maintenance contracts average $180-$350/year per household. Mention it on every invoice: 'Ask us about our annual tune-up plan.' Converts 10-15% of one-time customers into recurring revenue.",
  },
];

export default function WeeklyBusinessDigest() {
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    industry: "",
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
          <h1 className="text-2xl font-black text-white mb-3">You're subscribed!</h1>
          <p className="text-slate-300 leading-relaxed">
            Your first Weekly Business Digest drops this Monday morning. Keep an eye on your inbox — and check your spam folder just in case.
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
      const { data, error: fnError } = await supabase.functions.invoke("create-weekly-digest-checkout", {
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
    <div className="min-h-screen bg-slate-900 text-white overflow-x-hidden">
      {/* Hero */}
      <section className="px-4 sm:px-6 py-12 sm:py-20 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-full mb-6 border border-orange-500/20">
          <Mail size={14} />
          Weekly AI Business Digest
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black leading-tight mb-4">
          Every Monday: <span className="text-orange-500">3 Tips to Grow</span> Your Business
        </h1>
        <p className="text-slate-300 text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-8">
          AI analyzes trends in your industry and emails you 3 actionable tips every Monday morning.
          Like having a business coach in your inbox.
        </p>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-400">
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> $29/mo</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> 7-day free trial</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> Cancel anytime</span>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 sm:px-6 pb-12 sm:pb-16 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-slate-800 rounded-xl p-4 sm:p-6 border border-slate-700">
              <Icon size={28} className="text-orange-500 mb-4" />
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sample digest */}
      <section className="px-4 sm:px-6 pb-12 sm:pb-16 max-w-3xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-black text-center mb-3">Sample Digest -- HVAC Edition</h2>
        <p className="text-slate-400 text-center text-xs sm:text-sm mb-6 sm:mb-8">This is what lands in your inbox every Monday morning.</p>
        <div className="bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-700 overflow-hidden">
          {/* Email header mock */}
          <div className="bg-slate-750 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0">M2</div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold">M² Performance Training</p>
              <p className="text-slate-400 text-xs truncate">matt@notify.m2training.com · Monday 8:00 AM</p>
            </div>
          </div>
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-1">Weekly Business Digest</p>
            <h3 className="text-white font-black text-lg mb-5">3 Tips to Grow Your HVAC Business This Week</h3>
            <div className="space-y-4 sm:space-y-6">
              {SAMPLE_TIPS.map(({ number, headline, body }) => (
                <div key={number} className="flex gap-3 sm:gap-4">
                  <span className="text-orange-500 font-black text-lg leading-none mt-0.5 shrink-0">{number}</span>
                  <div>
                    <h4 className="text-white font-bold mb-1 text-sm">{headline}</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-slate-700 text-xs text-slate-500">
              Personalized for your business by AI · M² Performance Training · Unsubscribe
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-20 max-w-lg mx-auto">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-xl font-black">Start Your Free Trial</CardTitle>
            <p className="text-slate-400 text-sm">$29/mo after 7 days. Your first digest arrives Monday.</p>
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
                <Label htmlFor="industry" className="text-slate-300 text-sm">Industry</Label>
                <select
                  id="industry"
                  name="industry"
                  value={form.industry}
                  onChange={handleChange}
                  className="w-full rounded-md bg-slate-700 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                >
                  <option value="">Select your industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-base"
              >
                {submitting ? <Loader2 size={18} className="animate-spin mr-2" /> : null}
                {submitting ? "Processing…" : "Get My First Digest Free →"}
              </Button>
              <p className="text-center text-xs text-slate-500">No credit card needed to start. $29/mo after 7 days.</p>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <section className="border-t border-slate-800 py-8 sm:py-10 px-4 sm:px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Users size={18} className="text-orange-500" />
          <span className="text-slate-400 text-sm">Built by Matt Michels — Grosse Pointe, MI</span>
        </div>
        <p className="text-slate-500 text-xs">Questions? <a href="tel:+13138064952" className="text-orange-500 hover:underline">(313) 806-4952</a> · <a href="mailto:matt@m2training.com" className="text-orange-500 hover:underline">matt@m2training.com</a></p>
      </section>
    </div>
  );
}
