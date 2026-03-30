import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, MessageSquare, TrendingUp, DollarSign, Users } from "lucide-react";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping",
  "Auto Repair", "Restaurant", "Salon/Barbershop", "Gym/Fitness", "Other",
];

const STATS = [
  { icon: MessageSquare, value: "98%", label: "SMS open rate" },
  { icon: TrendingUp, value: "15–20%", label: "Win-back rate" },
  { icon: DollarSign, value: "$0", label: "Ad spend" },
];

export default function WinBackSMS() {
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    phone: "",
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
          <h1 className="text-2xl font-black text-white mb-3">You're in!</h1>
          <p className="text-slate-300 leading-relaxed">
            Your Win-Back campaign is being set up. Matt will reach out within 24 hours to import your first customer list.
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
      const { data, error: fnError } = await supabase.functions.invoke("create-winback-sms-checkout", {
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
          <MessageSquare size={14} />
          AI-Powered Win-Back SMS
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          Reactivate Sleeping Customers <span className="text-orange-500">Every Month</span>
        </h1>
        <p className="text-slate-300 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-8">
          AI sends a personalized "we miss you" text to your lapsed customers on the 5th of every month.
          On average, 15–20% reply and book again.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-400 mb-2">
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> $49/mo</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> 7-day free trial</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> Cancel anytime</span>
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="bg-slate-800 rounded-xl p-6 text-center border border-slate-700">
              <Icon size={28} className="text-orange-500 mx-auto mb-3" />
              <div className="text-3xl font-black text-white mb-1">{value}</div>
              <div className="text-slate-400 text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-8">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { step: "1", title: "You sign up", desc: "We collect your customer list (we'll help you export it)." },
            { step: "2", title: "AI writes the text", desc: "On the 5th of each month, AI crafts a personalized message for your business." },
            { step: "3", title: "Customers come back", desc: "15–20% reply and book. You make money without lifting a finger." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-black text-sm mb-4">{step}</div>
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
            <p className="text-slate-400 text-sm">$49/mo after 7 days. Cancel anytime.</p>
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
                <Label htmlFor="phone" className="text-slate-300 text-sm">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="(313) 555-0100"
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
                {submitting ? "Processing…" : "Start My Free Trial →"}
              </Button>
              <p className="text-center text-xs text-slate-500">No credit card needed to start. Billed at $49/mo after 7 days.</p>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Social proof */}
      <section className="border-t border-slate-800 py-10 px-6 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Users size={18} className="text-orange-500" />
          <span className="text-slate-400 text-sm">Built by Matt Michels — Grosse Pointe, MI</span>
        </div>
        <p className="text-slate-500 text-xs">Questions? <a href="tel:+13138064952" className="text-orange-500 hover:underline">(313) 806-4952</a> · <a href="mailto:matt@m2training.com" className="text-orange-500 hover:underline">matt@m2training.com</a></p>
      </section>
    </div>
  );
}
