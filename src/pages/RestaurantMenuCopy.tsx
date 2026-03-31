import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, ArrowRight, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FEATURES = [
  "10 new menu item descriptions per month",
  "Seasonal & trend-aware language",
  "Works for any cuisine type",
];

export default function RestaurantMenuCopy() {
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    cuisineType: "",
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
        "create-restaurant-menu-checkout",
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
            Your seasonal menu copy will arrive in your inbox every month. Check for onboarding
            details shortly.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Questions?{" "}
            <a href="mailto:matt@mattmichelstraining.com" className="text-orange-500">
              matt@mattmichelstraining.com
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
          <UtensilsCrossed size={16} className="text-orange-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-orange-500">
            Restaurant Menu Copywriting
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
          AI-Written Seasonal Menu Descriptions Every Month
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed mb-6">
          Fresh, appetizing menu copy delivered monthly &mdash; seasonal ingredients, vivid
          descriptions, zero writing required.
        </p>
        <p className="text-3xl font-black text-orange-500">
          $39<span className="text-sm font-normal text-slate-400">/mo</span>
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
                title: "Tell Us Your Cuisine",
                desc: "Italian, BBQ, American, fusion &mdash; we write in the right style and tone.",
              },
              {
                step: "2",
                title: "AI Writes 10 Descriptions",
                desc: "Seasonal, mouthwatering copy for 10 new or rotating menu items each month.",
              },
              {
                step: "3",
                title: "Copy & Update Your Menu",
                desc: "Drop the copy into your menu, website, or specials board. Done.",
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white font-black flex items-center justify-center mx-auto mb-3">
                  {s.step}
                </div>
                <p className="font-bold text-sm text-white mb-1">{s.title}</p>
                <p
                  className="text-[12px] text-slate-400"
                  dangerouslySetInnerHTML={{ __html: s.desc }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Sign-Up Form */}
        <Card className="bg-slate-800/50 border-slate-700 mb-10">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-white">
              Start Getting Menu Copy
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
                    placeholder="Tony Soprano"
                    className="bg-slate-900 border-slate-700 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Restaurant Name *
                  </Label>
                  <Input
                    required
                    value={form.businessName}
                    onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                    placeholder="Tony's Trattoria"
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
                    placeholder="you@restaurant.com"
                    className="bg-slate-900 border-slate-700 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Cuisine Type
                  </Label>
                  <Input
                    value={form.cuisineType}
                    onChange={(e) => setForm((f) => ({ ...f, cuisineType: e.target.value }))}
                    placeholder="e.g. Italian, American BBQ, Modern American"
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
                {loading ? "Redirecting to checkout..." : "Subscribe — $39/mo"}
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
          <a href="mailto:matt@mattmichelstraining.com" className="text-orange-500">
            matt@mattmichelstraining.com
          </a>
        </p>
      </div>
    </div>
  );
}
