import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, ArrowRight, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FEATURES = [
  "5-touch sequence: Day 2, 5, 10, 20, 30",
  "Handles common objections automatically",
  "Works for auto, home, life, commercial",
];

export default function InsuranceFollowUpDrip() {
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    insuranceType: "",
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
        "create-insurance-drip-checkout",
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
            Your weekly follow-up sequences will be ready every Monday. Check your inbox for
            onboarding details.
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
          <Shield size={16} className="text-orange-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-orange-500">
            Insurance Follow-Up Drip
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
          Never Let a Hot Insurance Lead Go Cold Again
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed mb-6">
          AI writes a fresh 5-touch follow-up sequence every week so you always have the right email
          ready at the right moment.
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

        {/* Cadence */}
        <div className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 text-center">
            The Follow-Up Cadence
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {["Day 2", "Day 5", "Day 10", "Day 20", "Day 30"].map((day) => (
              <div
                key={day}
                className="bg-slate-800/50 border border-slate-700 rounded p-3 text-center"
              >
                <p className="text-orange-500 font-black text-sm">{day}</p>
                <p className="text-slate-400 text-[11px] mt-1">Email send</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sign-Up Form */}
        <Card className="bg-slate-800/50 border-slate-700 mb-10">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-white">
              Start Following Up Automatically
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
                    Agency / Business Name *
                  </Label>
                  <Input
                    required
                    value={form.businessName}
                    onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                    placeholder="Smith Insurance Agency"
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
                    placeholder="you@agency.com"
                    className="bg-slate-900 border-slate-700 text-white mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Insurance Type
                  </Label>
                  <Input
                    value={form.insuranceType}
                    onChange={(e) => setForm((f) => ({ ...f, insuranceType: e.target.value }))}
                    placeholder="e.g. Home & Auto, Life Insurance"
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
          <a href="mailto:matt@mattmichelstraining.com" className="text-orange-500">
            matt@mattmichelstraining.com
          </a>
        </p>
      </div>
    </div>
  );
}
