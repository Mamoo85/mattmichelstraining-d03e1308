import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export default function CareAlert() {
  const [email, setEmail] = useState("");
  const [facility, setFacility] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setSubmitting(true);
    try {
      const magicToken = crypto.randomUUID();
      const { error } = await supabase.from("radar_trials").insert({
        email: email.toLowerCase().trim(),
        business_name: facility.trim() || null,
        product: "carealert",
        magic_token: magicToken,
        source: "carealert_landing",
        state: "MI",
      });
      if (error) throw error;

      // Fire-and-forget SMS alert to Matt
      void supabase.functions.invoke("notify-admin-sms", {
        body: {
          message: `🏥 NEW CareAlert signup: ${email}${facility ? ` (${facility})` : ""}. Call now.`,
        },
      }).catch(() => {});

      setSuccess(true);
    } catch (err: any) {
      if (String(err?.message || "").includes("duplicate")) {
        toast.success("You're already on the list — Matt will reach out shortly.");
        setSuccess(true);
      } else {
        toast.error("Something went wrong. Email matt@detroitwebagent.com.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a1628] text-white">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="text-[#00d4ff] text-xs font-bold uppercase tracking-[3px] mb-4">
          CareAlert · A Detroit Web Agency Product
        </div>
        <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">
          Get alerted the moment a new CNA or RN gets licensed in your county.
        </h1>
        <p className="text-white/70 text-lg mb-10">
          We monitor Michigan's state nursing license database in real time. The moment a new CNA, LPN, or RN
          gets their license — you get their name, contact info, and county. Before any staffing agency does.
        </p>

        <ul className="space-y-3 mb-10">
          {[
            "Same-day alerts when a new nurse is licensed in your county",
            "Direct contact info — call them before agencies do",
            "$149/month · cancel anytime · no credit card to start",
            "Free trial: see this week's available nurses now",
          ].map((b) => (
            <li key={b} className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00d4ff] mt-0.5 shrink-0" />
              <span className="text-white/85">{b}</span>
            </li>
          ))}
        </ul>

        {success ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-6">
            <div className="text-emerald-400 font-bold text-lg mb-2">✓ You're in.</div>
            <p className="text-white/80">
              Matt will call or email you within the next few hours with this week's licensed-nurse list.
              No credit card needed yet.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-white/50 mb-1.5 block">
                Facility name (optional)
              </label>
              <Input
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                placeholder="Sunrise Senior Living, Detroit"
                className="bg-[#0a1628] border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-white/50 mb-1.5 block">
                Your facility email
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@facility.com"
                className="bg-[#0a1628] border-white/10 text-white"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 font-bold h-12 text-base"
            >
              {submitting ? "Sending…" : "See this week's available nurses →"}
            </Button>
            <p className="text-white/40 text-xs text-center">
              No credit card. No account. Just your email.
            </p>
          </form>
        )}

        <p className="text-white/40 text-sm mt-12">
          Questions? Text Matt directly: <a href="sms:+13139921219" className="text-[#00d4ff]">(313) 992-1219</a>
        </p>
      </div>
    </main>
  );
}
