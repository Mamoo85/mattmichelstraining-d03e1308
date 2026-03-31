import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FEATURES = [
  "Weekly AI-written testimonial request emails sent to your customer list",
  "Friendly, non-pushy copy that actually gets responses",
  "Perfect for service businesses — no tech setup needed",
];

export default function TestimonialHarvester() {
  const [form, setForm] = useState({ contactName: "", businessName: "", email: "", industry: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-testimonial-harvester-checkout", { body: form });
      if (fnError) throw fnError;
      if (data?.url) window.location.href = data.url;
      else setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-white mb-3">You're set!</h1>
          <p className="text-slate-400">Your weekly testimonial harvester is live. Testimonial requests go out every Thursday.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="px-6 py-16 text-center border-b border-slate-800">
        <span className="text-[11px] font-bold uppercase tracking-widest text-orange-500">Testimonial Harvester</span>
        <h1 className="text-3xl md:text-4xl font-black mt-3 mb-4 leading-tight">
          AI Collects Testimonials From Your Customers — Weekly
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-sm leading-relaxed mb-6">
          Every Thursday, AI writes and sends personalized testimonial request emails to your past clients. More 5-star reviews, more social proof, more sales.
        </p>
        <p className="text-3xl font-black text-orange-500">$39<span className="text-sm font-normal text-slate-400">/mo</span></p>
        <p className="text-slate-500 text-sm mt-1">Cancel anytime</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-12 space-y-3">
          {FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-3">
              <CheckCircle size={16} className="text-orange-500 flex-shrink-0" />
              <span className="text-sm text-slate-300">{f}</span>
            </div>
          ))}
        </div>

        <Card className="bg-slate-800/50 border-slate-700 mb-10">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-white">Start Collecting — $39/mo</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Your Name *", key: "contactName", placeholder: "Jane Smith", type: "text", required: true },
                  { label: "Business Name *", key: "businessName", placeholder: "Smith Plumbing", type: "text", required: true },
                  { label: "Email *", key: "email", placeholder: "you@business.com", type: "email", required: true },
                  { label: "Industry", key: "industry", placeholder: "e.g. Plumbing, HVAC, Cleaning", type: "text", required: false },
                ].map(({ label, key, placeholder, type, required }) => (
                  <div key={key}>
                    <Label className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</Label>
                    <Input
                      type={type}
                      required={required}
                      value={form[key as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="bg-slate-900 border-slate-700 text-white mt-1"
                    />
                  </div>
                ))}
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 font-bold text-sm uppercase tracking-widest">
                {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <ArrowRight size={14} className="mr-2" />}
                {loading ? "Redirecting..." : "Subscribe — $39/mo"}
              </Button>
              <p className="text-[11px] text-slate-500 text-center">Secure checkout via Stripe. Cancel anytime.</p>
            </form>
          </CardContent>
        </Card>

        <p className="text-[12px] text-slate-500 text-center">
          Questions? (313) 806-4952 &middot; <a href="mailto:matt@m2training.com" className="text-orange-500">matt@m2training.com</a>
        </p>
      </div>
    </div>
  );
}
