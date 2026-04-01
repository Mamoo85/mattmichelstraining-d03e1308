import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const INDUSTRIES = [
  "HVAC", "Plumbing", "Roofing", "Electrical", "Landscaping",
  "Auto Repair", "Restaurant", "Salon / Barbershop", "Gym / Fitness",
  "Dental / Medical", "Real Estate", "Retail", "Other",
];

export default function TextMessageMarketing() {
  const [form, setForm] = useState({ email: "", name: "", businessName: "", phone: "", industry: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const searchParams = new URLSearchParams(window.location.search);
  const status = searchParams.get("status");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-text-marketing-checkout", {
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
            <div className="text-5xl mb-4">📱</div>
            <h2 className="text-2xl font-bold text-white mb-3">Welcome aboard!</h2>
            <p className="text-slate-300">
              Your 7-day free trial has started. Matt will reach out within 24 hours to set up
              your dedicated SMS number and get your first contact list imported.
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
            Text Message Marketing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            SMS Marketing.<br />Done For You.
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            We write it. We send it. Every month, AI crafts a personalized SMS campaign for your customer
            list and sends it automatically. 98% open rates. Zero effort on your end.
          </p>
          <div className="text-3xl font-bold text-orange-400 mb-2">$79/mo</div>
          <p className="text-slate-400 mb-8">7-day free trial — cancel anytime</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 bg-slate-800/50">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8 text-center">
          {[
            { stat: "98%", label: "SMS open rate vs 20% for email" },
            { stat: "45%", label: "Average click-through rate on SMS" },
            { stat: "3×", label: "More revenue per customer with SMS" },
          ].map((s) => (
            <div key={s.stat}>
              <div className="text-4xl font-bold text-orange-400 mb-2">{s.stat}</div>
              <p className="text-slate-300">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-10">What You Get</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { icon: "✍️", title: "AI-Written Campaigns", desc: "AI writes custom SMS copy for your business every month — no templates, no fluff." },
              { icon: "📤", title: "Automated Sending", desc: "Campaigns go out on the 1st of every month automatically. Set it and forget it." },
              { icon: "📊", title: "Delivery Reports", desc: "Monthly email report shows exactly how many messages were sent and delivered." },
              { icon: "🚫", title: "Opt-Out Management", desc: "STOP replies are handled automatically. Stay CAN-SPAM compliant without lifting a finger." },
              { icon: "📱", title: "Dedicated Number", desc: "Your own local SMS number — customers see a real local area code, not a short code." },
              { icon: "📋", title: "Easy List Management", desc: "Send us a spreadsheet of customer numbers and we handle the rest." },
            ].map((f) => (
              <div key={f.title} className="flex gap-4 p-4 bg-slate-800 rounded-lg">
                <div className="text-2xl">{f.icon}</div>
                <div>
                  <h4 className="text-white font-semibold mb-1">{f.title}</h4>
                  <p className="text-slate-400 text-sm">{f.desc}</p>
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
              <CardTitle className="text-white text-center">7 Days Free — First Campaign Included</CardTitle>
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
                  <Label className="text-slate-300">Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="(313) 555-0100"
                    className="bg-slate-700 border-slate-600 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Industry</Label>
                  <Select onValueChange={(val) => setForm({ ...form, industry: val })}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                      <SelectValue placeholder="Select your industry" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind} value={ind} className="text-white hover:bg-slate-600">{ind}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 text-lg"
                >
                  {loading ? "Redirecting..." : "Start Free Trial — $79/mo"}
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
