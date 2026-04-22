import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bell, Zap, ShieldCheck, Clock } from "lucide-react";

export default function PulseAlerts() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    phone: "",
    businessName: "",
    vertical: "",
    city: "Detroit",
  });

  const params = new URLSearchParams(window.location.search);
  const success = params.get("status") === "success";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.phone) {
      toast.error("Email and phone are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-pulse-alerts-checkout", {
        body: form,
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Checkout failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Pulse Alerts — Same-Hour SMS for Metro Detroit Hiring Signals | DWA</title>
        <meta
          name="description"
          content="Get notified the moment a Metro Detroit manufacturer posts a hiring signal. $29/mo, same-hour SMS, first dossier free."
        />
      </Helmet>

      <div className="min-h-screen bg-[#0a1628] text-white">
        <section className="container mx-auto px-4 py-16 max-w-3xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm mb-6">
              <Zap className="w-4 h-4" /> First-Mover Advantage
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-300 to-cyan-500 bg-clip-text text-transparent">
              Pulse Alerts
            </h1>
            <p className="text-xl text-gray-300 mb-2">
              Same-hour SMS when Metro Detroit manufacturers start hiring.
            </p>
            <p className="text-cyan-400 font-semibold">$29/month · First dossier free · Cancel anytime</p>
          </div>

          {success ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-bold text-green-300 mb-2">✅ You're subscribed</h2>
              <p className="text-gray-300">
                Your first SMS will arrive within 24 hours when a high-confidence signal lands.
              </p>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-3 gap-4 mb-10">
                {[
                  { icon: Clock, title: "Same-hour speed", body: "First-mover wins. Your competitors are still reading newsletters." },
                  { icon: Bell, title: "Vertical filter", body: "Only get pinged for welding / HVAC / electrical — whatever you sell." },
                  { icon: ShieldCheck, title: "Free first dossier", body: "Every alert links to a free 1-page company brief. No card required." },
                ].map((b) => (
                  <div key={b.title} className="bg-white/5 border border-white/10 rounded-xl p-5">
                    <b.icon className="w-6 h-6 text-cyan-400 mb-3" />
                    <h3 className="font-semibold mb-1">{b.title}</h3>
                    <p className="text-sm text-gray-400">{b.body}</p>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleSubmit}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 space-y-4"
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email" className="text-gray-300">Work email *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="bg-white/5 border-white/10 mt-1"
                      placeholder="branch.manager@supplyhouse.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-gray-300">Mobile phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="bg-white/5 border-white/10 mt-1"
                      placeholder="(313) 555-0100"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessName" className="text-gray-300">Business name</Label>
                    <Input
                      id="businessName"
                      value={form.businessName}
                      onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                      className="bg-white/5 border-white/10 mt-1"
                      placeholder="Behler-Young — Warren branch"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vertical" className="text-gray-300">Vertical filter (optional)</Label>
                    <Input
                      id="vertical"
                      value={form.vertical}
                      onChange={(e) => setForm({ ...form, vertical: e.target.value })}
                      className="bg-white/5 border-white/10 mt-1"
                      placeholder="welding, hvac, electrical…"
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500">
                  By subscribing you agree to receive SMS alerts from Detroit Web Agency. Reply STOP to
                  opt out at any time. Msg & data rates may apply.
                </p>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-[#0a1628] font-bold text-lg py-6"
                >
                  {loading ? "Loading…" : "Start $29/mo — first dossier free"}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  );
}
