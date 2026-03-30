import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, MessageSquare, Calendar, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "3-Text Sequence",
    desc: "Three different follow-up messages — not the same text three times. Varies tone and angle to maximize responses.",
  },
  {
    icon: Calendar,
    title: "5-Day Drip",
    desc: "Texts go out on day 1, day 3, and day 5. Enough to stay top-of-mind without annoying the prospect.",
  },
  {
    icon: Zap,
    title: "Fully Automated",
    desc: "You submit the phone number once. The sequence runs on its own. No reminders, no babysitting.",
  },
];

const HOW_IT_WORKS = [
  { step: "1", label: "You send a quote to a prospect" },
  { step: "2", label: "Submit their phone number to your portal" },
  { step: "3", label: "AI sends 3 follow-up texts over 5 days automatically" },
];

export default function QuoteFollowupSMS() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";

  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const { data, error } = await supabase.functions.invoke("create-quote-followup-checkout", {
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
          <h1 className="text-3xl font-black mb-3">You're Set Up!</h1>
          <p className="text-slate-400 leading-relaxed mb-4">
            Matt will reach out within 24 hours to get your portal live and your first follow-up sequence configured.
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
          Automated Quote Follow-Up
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          Stop Losing Jobs<br />After You Send the Quote
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed mb-6 max-w-xl mx-auto">
          When a prospect goes quiet after getting your quote, our AI automatically follows up with 3 texts over 5 days. Close 30% more jobs without lifting a finger.
        </p>
        <div className="inline-block bg-slate-800 border border-orange-500/30 rounded-xl px-6 py-3 mb-6">
          <p className="text-orange-400 font-semibold text-sm">
            The average contractor loses 40% of quotes to silence. This fixes that.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 mb-2">
          <span className="text-5xl font-black text-white">$49</span>
          <div className="text-left">
            <div className="text-slate-400 text-sm">/month</div>
            <div className="text-orange-400 text-xs font-semibold">7-day free trial</div>
          </div>
        </div>
        <p className="text-slate-500 text-sm">No contracts. Cancel anytime.</p>
      </section>

      {/* How It Works */}
      <section className="px-4 pb-16 max-w-3xl mx-auto">
        <h2 className="text-center text-xl font-bold text-slate-300 mb-6">How It Works</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map(({ step, label }) => (
            <div key={step} className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-center">
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-3 text-base font-black text-white">
                {step}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">{label}</p>
            </div>
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
            <p className="text-slate-400 text-sm">7 days free — then $49/mo. Cancel anytime.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Your Name</Label>
                <Input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Chris Hernandez"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Business Name <span className="text-orange-500">*</span></Label>
                <Input
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  placeholder="Hernandez Roofing"
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
                  placeholder="chris@hernandezroofing.com"
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Your Phone <span className="text-slate-500 font-normal">(optional)</span></Label>
                <Input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="(313) 555-1234"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 text-base mt-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin mr-2" /> Processing...</>
                ) : (
                  "Start Free Trial — $49/mo after"
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
