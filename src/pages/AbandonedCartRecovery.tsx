import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, ArrowRight, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FEATURES = [
  "3-touch sequence: 1hr, 24hr, 48hr",
  "Each email has a subject line + body",
  "Urgency, social proof, and discount tactics built in",
];

export default function AbandonedCartRecovery() {
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    ecommercePlatform: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.email || !form.name || !form.businessName) {
      setError("Name, business name, and email are required.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-abandoned-cart-checkout",
        { body: form }
      );
      if (fnError) throw fnError;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">You&apos;re signed up!</h1>
          <p className="text-slate-400 leading-relaxed">
            Your abandoned cart sequences will be delivered weekly. Check your inbox for next steps.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Questions?{" "}
            <a href="mailto:matt@m2training.com" className="text-orange-500">
              matt@m2training.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Hero */}
      <div className="bg-slate-900 px-6 py-16 text-center border-b border-slate-800">
        <div className="flex items-center justify-center gap-2 mb-4">
          <ShoppingCart size={16} className="text-orange-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-orange-500">
            Abandoned Cart Recovery
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
          Recover Lost Sales with AI-Written Cart Abandonment Emails
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed mb-6">
          A 3-email sequence automatically written each week, ready to load into Klaviyo, Mailchimp,
          or Shopify Email.
        </p>
        <p className="text-3xl font-black text-orange-500">
          $69<span className="text-sm font-normal text-slate-400">/mo</span>
        </p>
        <p className="text-slate-500 text-sm mt-1">Cancel anytime</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Features */}
        <div className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 text-center">
            What You Get
          </h2>
          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle size={16} className="text-orange-500 flex-shrink-0" />
                <span className="text-sm text-slate-300">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                step: "1",
                title: "Tell Us Your Store",
                desc: "Share your platform and product type. We handle the rest.",
              },
              {
                step: "2",
                title: "AI Writes Your Sequence",
                desc: "Fresh 3-email cart abandonment sequence written weekly and emailed to you.",
              },
              {
                step: "3",
                title: "Load & Send",
                desc: "Paste into Klaviyo, Mailchimp, or Shopify Email in minutes.",
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-black flex items-center justify-center mx-auto mb-3">
                  {s.step}
                </div>
                <p className="font-bold text-sm text-white mb-1">{s.title}</p>
                <p className="text-[12px] text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sign-Up Form */}
        <Card className="bg-slate-800/50 border-slate-700 mb-10">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-white">
              Start Recovering Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Your Name *
                  </Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="bg-slate-900 border-slate-700 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Business Name *
                  </Label>
                  <Input
                    required
                    value={form.businessName}
                    onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                    placeholder="My Awesome Store"
                    className="bg-slate-900 border-slate-700 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Email *
                  </Label>
                  <Input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@store.com"
                    className="bg-slate-900 border-slate-700 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    E-commerce Platform
                  </Label>
                  <Input
                    value={form.ecommercePlatform}
                    onChange={(e) => setForm((f) => ({ ...f, ecommercePlatform: e.target.value }))}
                    placeholder="e.g. Shopify, WooCommerce, BigCommerce"
                    className="bg-slate-900 border-slate-700 text-white mt-1"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 font-bold text-sm uppercase tracking-widest"
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin mr-2" />
                ) : (
                  <ArrowRight size={14} className="mr-2" />
                )}
                {loading ? "Redirecting to checkout..." : "Subscribe — $69/mo"}
              </Button>
              <p className="text-[11px] text-slate-500 text-center">
                Secure checkout via Stripe. Cancel anytime.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-[12px] text-slate-500 text-center">
          Questions? (313) 806-4952 &middot;{" "}
          <a href="mailto:matt@m2training.com" className="text-orange-500">
            matt@m2training.com
          </a>
        </p>
      </div>
    </div>
  );
}
