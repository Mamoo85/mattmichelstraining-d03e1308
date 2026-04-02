import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, CheckCircle } from "lucide-react";

interface WaitlistGateProps {
  productName: string;
  description: string;
  price?: string;
}

export default function WaitlistGate({ productName, description, price }: WaitlistGateProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("newsletter_subscribers")
        .upsert({ email, is_active: true, source: `waitlist_${productName}` }, { onConflict: "email" });
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-2">
        <CheckCircle size={28} className="mx-auto text-green-600" />
        <p className="font-bold text-green-800">You're on the list.</p>
        <p className="text-sm text-green-700">We'll email you the moment this launches.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold px-2.5 py-1 shrink-0 mt-0.5">
          <Bell size={11} />
          COMING SOON
        </span>
        {price && (
          <span className="inline-block rounded-full bg-slate-200 text-slate-600 text-xs font-semibold px-2.5 py-1">
            Launching at {price}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-600">{description}</p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[#e8621a] text-white px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "…" : "Notify Me →"}
        </button>
      </form>
    </div>
  );
}
