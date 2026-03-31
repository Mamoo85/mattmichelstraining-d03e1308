import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, Gift, MessageSquare, Calendar, Sparkles, Users } from "lucide-react";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping",
  "Auto Repair", "Restaurant", "Salon/Barbershop", "Gym/Fitness",
  "Retail", "Real Estate", "Consulting", "Other",
];

const HOLIDAYS = [
  { emoji: "🎆", name: "New Year's Day", date: "January 1st" },
  { emoji: "💝", name: "Valentine's Day", date: "February 14th" },
  { emoji: "🪖", name: "Memorial Day", date: "Last Monday in May" },
  { emoji: "🇺🇸", name: "July 4th", date: "Independence Day" },
  { emoji: "🔨", name: "Labor Day", date: "First Monday in September" },
  { emoji: "🦃", name: "Thanksgiving", date: "Fourth Thursday in November" },
  { emoji: "🎄", name: "Christmas", date: "December 25th" },
];

const FEATURES = [
  { icon: Calendar, title: "8 Automated Blasts/Year", desc: "Set it once. Every holiday text goes out on time, every year, automatically." },
  { icon: Sparkles, title: "AI-Written Messages", desc: "Each text is personalized to your business and written in a friendly, natural tone." },
  { icon: MessageSquare, title: "Your Customer List", desc: "We send to the list you provide. No third-party platform required." },
];

export default function HolidaySMSBlast() {
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
          <h1 className="text-2xl font-black text-white mb-3">You're all set!</h1>
          <p className="text-slate-300 leading-relaxed">
            Your Holiday SMS Blast account is being set up. Matt will reach out within 24 hours to collect your customer list and confirm your first upcoming holiday.
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
      const { data, error: fnError } = await supabase.functions.invoke("create-holiday-sms-checkout", {
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
          <Gift size={14} />
          Holiday SMS Blast Automation
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          8 Holiday Texts Sent <span className="text-orange-500">Automatically</span> Every Year
        </h1>
        <p className="text-slate-300 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-8">
          New Year's, Valentine's Day, July 4th, Thanksgiving, Christmas and more — AI writes a personalized
          holiday text for your business and sends it to your customer list automatically.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-400">
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> $39/mo</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> 7-day free trial</span>
          <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-400" /> Cancel anytime</span>
        </div>
      </section>

      {/* Holidays covered */}
      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-3">Holidays Covered</h2>
        <p className="text-slate-400 text-center text-sm mb-8">Every text is written by AI to match your business voice. No generic "Happy Holidays" messages.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HOLIDAYS.map(({ emoji, name, date }) => (
            <div key={name} className="flex items-center gap-4 bg-slate-800 rounded-xl px-5 py-4 border border-slate-700">
              <span className="text-2xl shrink-0">{emoji}</span>
              <div>
                <p className="text-white font-bold text-sm">{name}</p>
                <p className="text-slate-400 text-xs">{date}</p>
              </div>
              <CheckCircle size={16} className="text-green-400 ml-auto shrink-0" />
            </div>
          ))}
          <div className="flex items-center gap-4 bg-slate-800/50 rounded-xl px-5 py-4 border border-dashed border-slate-600">
            <span className="text-2xl shrink-0">🎉</span>
            <div>
              <p className="text-slate-300 font-bold text-sm">+ 1 Bonus Blast</p>
              <p className="text-slate-500 text-xs">Your business anniversary or a date you choose</p>
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

      {/* Sample text preview */}
      <section className="px-6 pb-16 max-w-2xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-8">Sample AI-Written Texts</h2>
        <div className="space-y-4">
          {[
            {
              holiday: "Christmas — HVAC Company",
              message: "Merry Christmas from all of us at Smith Heating & Cooling! Staying warm this holiday season? If your furnace needs a tune-up before the new year, we've got a $49 special running through 12/31. Just reply YES and we'll get you scheduled. — John",
            },
            {
              holiday: "Valentine's Day — Salon",
              message: "Happy Valentine's Day from Riverside Salon! Treat yourself (or someone special) to a blowout or color refresh this week. Book online or reply to this text. Love from your salon team 💕",
            },
          ].map(({ holiday, message }) => (
            <div key={holiday} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-3">{holiday}</p>
              <div className="bg-slate-700 rounded-lg px-4 py-3">
                <p className="text-slate-200 text-sm leading-relaxed">{message}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Form */}
      <section className="px-6 pb-20 max-w-lg mx-auto">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-xl font-black">Start Your Free Trial</CardTitle>
            <p className="text-slate-400 text-sm">$39/mo after 7 days. 8 blasts per year, fully automated.</p>
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
                {submitting ? "Processing…" : "Automate My Holiday Texts →"}
              </Button>
              <p className="text-center text-xs text-slate-500">No credit card needed to start. $39/mo after 7 days.</p>
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
