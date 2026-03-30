import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function AIPhoneAnswering() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const searchParams = new URLSearchParams(window.location.search);
  const status = searchParams.get("status");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-phone-answering-checkout", {
        body: form,
      });
      if (fnErr || !data?.url) throw fnErr || new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (status === "success") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <Card className="max-w-md w-full bg-slate-800 border-slate-700 text-center">
          <CardContent className="pt-8 pb-8">
            <div className="text-5xl mb-4">📞</div>
            <h2 className="text-2xl font-bold text-white mb-3">You're in!</h2>
            <p className="text-slate-300">
              Your 7-day free trial has started. Matt will reach out within 24 hours to set up your
              custom greeting and get your calls routing through the AI.
            </p>
            <p className="text-slate-400 mt-4 text-sm">Questions? Text (313) 806-4952</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Hero */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-orange-500/10 text-orange-400 text-sm font-semibold px-4 py-2 rounded-full mb-6">
            AI Phone Answering
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Never Miss a Call.<br />Never Lose a Lead.
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            AI answers every call to your business 24/7 — greets callers, answers common questions,
            takes detailed messages, and sends you an instant transcript. You only call back the warm leads.
          </p>
          <div className="text-3xl font-bold text-orange-400 mb-2">$149/mo</div>
          <p className="text-slate-400 mb-8">7-day free trial — cancel anytime</p>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 px-4 bg-slate-800/50">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
          {[
            { icon: "🕐", title: "24/7 Coverage", desc: "Evenings, weekends, holidays — no call goes to voicemail." },
            { icon: "🤖", title: "AI-Powered", desc: "Claude AI understands context and responds naturally to callers." },
            { icon: "📋", title: "Instant Transcripts", desc: "Every call transcript hits your email and phone within seconds." },
          ].map((b) => (
            <div key={b.title} className="text-center">
              <div className="text-4xl mb-3">{b.icon}</div>
              <h3 className="text-lg font-bold text-white mb-2">{b.title}</h3>
              <p className="text-slate-400">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-10">How It Works</h2>
          <div className="space-y-6">
            {[
              { step: "1", title: "Sign up & get your number", desc: "We assign you a local phone number that your AI answers." },
              { step: "2", title: "Forward your calls", desc: "Set your business line to forward unanswered calls to your AI number — takes 2 minutes." },
              { step: "3", title: "AI answers & transcribes", desc: "Every call gets a professional AI greeting. Caller's message is emailed and texted to you instantly." },
              { step: "4", title: "You call back the hot ones", desc: "Review transcripts, prioritize, call back. No more playing voicemail tag." },
            ].map((s) => (
              <div key={s.step} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center flex-shrink-0">
                  {s.step}
                </div>
                <div>
                  <h4 className="text-white font-semibold">{s.title}</h4>
                  <p className="text-slate-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sign up form */}
      <section className="py-16 px-4 bg-slate-800/50">
        <div className="max-w-md mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">Start Your Free Trial</h2>
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-center">7 Days Free — No Card Required Until Trial Ends</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">Your Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="John Smith"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Business Name *</Label>
                  <Input
                    required
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Smith Plumbing LLC"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Email *</Label>
                  <Input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="john@smithplumbing.com"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Business Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(313) 555-0100"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-lg"
                >
                  {loading ? "Redirecting..." : "Start Free Trial — $149/mo"}
                </Button>
                <p className="text-xs text-slate-500 text-center">
                  7-day free trial. Cancel anytime. Setup assistance included.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
