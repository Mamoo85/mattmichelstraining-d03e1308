import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, Copy } from "lucide-react";

const PartnerProgram = () => {
  const [form, setForm] = useState({ name: "", email: "", payout_handle: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ code: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error("Name and email are required.");
      return;
    }
    setLoading(true);
    try {
      // Generate a unique referral code
      const code = form.name.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8).toUpperCase() + "-M2B";

      const { error } = await supabase.from("b2b_referral_partners").insert({
        name: form.name,
        email: form.email,
        referral_code: code,
        payout_handle: form.payout_handle || null,
      } as any);

      if (error) {
        if (error.code === "23505") {
          toast.error("You're already registered! Check your email for your referral code.");
        } else {
          throw error;
        }
        return;
      }

      setResult({ code });
      toast.success("Welcome to the partner program!");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (!result) return;
    navigator.clipboard.writeText(`https://www.mattmichelstraining.com/get-started?ref=${result.code}`);
    toast.success("Referral link copied!");
  };

  return (
    <>
      <SEOHead title="Partner Program | M² Development" description="Earn commissions by referring businesses to M² Development services." />
      <div className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-foreground mb-2">M² Partner Program</h1>
          <p className="text-muted-foreground mb-8">
            Earn $50 for every business you refer that becomes a paying customer. No cap on earnings.
          </p>

          {result ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center space-y-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold text-foreground">You're In!</h2>
              <p className="text-muted-foreground">Share your unique referral link:</p>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
                <code className="text-sm text-foreground flex-1 break-all">
                  mattmichelstraining.com/get-started?ref={result.code}
                </code>
                <button onClick={copyLink} className="p-2 hover:bg-background rounded-md transition-colors">
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                When someone signs up through your link and pays, you earn $50. We'll email you weekly payout reports.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Your Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" required />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" required />
              </div>
              <div>
                <Label>Venmo / PayPal Handle (for payouts)</Label>
                <Input value={form.payout_handle} onChange={(e) => setForm({ ...form, payout_handle: e.target.value })} placeholder="@jane-smith" />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Join Partner Program
              </button>
              <p className="text-xs text-muted-foreground text-center">
                By joining, you agree to our{" "}
                <a href="/legal/referral-terms" target="_blank" className="text-primary underline">Referral Program Terms</a>.
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default PartnerProgram;
