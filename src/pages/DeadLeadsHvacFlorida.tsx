import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DeadLeadROICalculator from "@/components/dead-leads/DeadLeadROICalculator";

const TRADE = "HVAC";
const GEO = "Florida";
const CONTACTS = 350;
const REPLY_RATE = 6;
const REPLIES = 21;
const AVG_JOB = 4500;
const POTENTIAL = REPLIES * AVG_JOB;
const COST = REPLIES * 50;

export default function DeadLeadsHvacFlorida() {
  const [email, setEmail] = useState("");
  const [biz, setBiz] = useState("");
  const [loading, setLoading] = useState(false);

  const faq = [
    {
      q: "Florida runs HVAC year-round — why do I have dead leads?",
      a: "Season shifts are the #1 killer. A customer who called in July during a breakdown but got 3 quotes and stalled is still sitting on a degraded system. When we re-text them in October before the next heat wave, they're ready to act.",
    },
    {
      q: "What do the texts say?",
      a: "Short, personal, from your business name: 'Hi [Name], this is [Company]. You reached out about your AC a while back — we have a technician available this week if you're still having issues. Reply YES or call us anytime.' No spam. No scripts that feel robotic.",
    },
    {
      q: "What counts as a 'reply'?",
      a: "A genuine expression of interest — 'yes', 'still interested', 'can you call me', 'what's the price'. Not unsubscribes, not wrong numbers, not 'stop'. You define what's worth paying for.",
    },
    {
      q: "How long does it take to set up?",
      a: "Send us your contact list and we're texting within 24-48 hours. No integration required. Spreadsheet, CRM export, or even a copied list works.",
    },
    {
      q: "What if I only have 50 old leads?",
      a: "Still worth it. Even 50 contacts × 6% = 3 replies × $4,500 avg HVAC job = $13,500 potential. You'd pay $150. That's 90x ROI if you close them.",
    },
  ];

  async function startPilot(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { toast.error("Enter your email to continue"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("dead-lead-billing-setup", {
        body: { pilot_mode: true, email, business_name: biz || undefined },
      });
      if (error) throw error;
      if (data?.pilot_url) {
        window.location.href = data.pilot_url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong — call (313) 992-1219");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <span className="font-black text-lg tracking-tight">
          <span className="text-white">DETROIT</span>{" "}
          <span className="text-[#00d4ff]">WEB AGENCY</span>
        </span>
        <a href="tel:+13139921219" className="text-sm text-white/60 hover:text-white">
          📞 (313) 992-1219
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-block bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-full px-4 py-1.5 text-[#00d4ff] text-xs font-bold uppercase tracking-widest mb-6">
          {GEO} {TRADE} Contractors
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          Your Old{" "}
          <span className="text-[#00d4ff]">HVAC Leads</span>
          <br />
          Are Worth{" "}
          <span className="text-[#00d4ff]">${POTENTIAL.toLocaleString()}</span>.
          <br />
          We Prove It for $1.
        </h1>
        <p className="text-white/60 text-lg max-w-xl mx-auto mb-8">
          Florida HVAC owners sit on hundreds of old quotes that went quiet. We text every single one. You pay $50 only when someone replies with interest. Nothing if nobody responds.
        </p>
        <a
          href="#start"
          className="inline-block bg-[#00d4ff] text-[#0a0f1a] font-bold text-lg px-8 py-4 rounded-xl hover:bg-[#00d4ff]/90 transition-colors shadow-lg shadow-[#00d4ff]/20"
        >
          Start for $1 — No Monthly Fee
        </a>
        <p className="text-white/30 text-xs mt-3">
          No subscription. No setup fee. $0 if nobody replies.
        </p>
      </section>

      {/* The Math */}
      <section className="bg-white/5 border-y border-white/10 py-12">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest text-center mb-8">
            The Math — {GEO} {TRADE}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Avg old contacts in your CRM", value: `~${CONTACTS}` },
              { label: `Reply rate (${REPLY_RATE}% avg)`, value: `${REPLIES} replies` },
              { label: "Avg FL HVAC job value", value: `$${AVG_JOB.toLocaleString()}` },
              { label: "Revenue potential", value: `$${POTENTIAL.toLocaleString()}` },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                <p className="text-2xl font-black text-white mb-1">{s.value}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-white/40 text-sm mt-6">
            You pay $50/reply = <strong className="text-white">${COST.toLocaleString()} total cost</strong> →{" "}
            <strong className="text-[#00d4ff]">{Math.round(POTENTIAL / COST)}x ROI</strong> on half-closes.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest text-center mb-10">
          How It Works — 3 Steps
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { step: "1", title: "Share your contacts", desc: "Old quote list, CRM export, spreadsheet — any format. We clean and deduplicate it." },
            { step: "2", title: "We text them for you", desc: "Personalized SMS from your business name within 24-48 hours. No spam, no blasts." },
            { step: "3", title: "Pay only for real replies", desc: "$50 per interested reply. If zero people respond, you pay nothing beyond the $1 pilot." },
          ].map((s) => (
            <div key={s.step} className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="w-8 h-8 bg-[#00d4ff] rounded-full flex items-center justify-center text-[#0a0f1a] font-black text-sm mb-4">
                {s.step}
              </div>
              <h3 className="font-bold text-white mb-2">{s.title}</h3>
              <p className="text-white/50 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-[#00d4ff]/5 border-y border-[#00d4ff]/20 py-10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-[#00d4ff] font-bold text-lg">
            "350 old HVAC contacts. 22 replied. 8 became jobs. We collected $36,000 from people we'd written off."
          </p>
          <p className="text-white/40 text-sm mt-3">— HVAC contractor, Tampa Bay area</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest text-center mb-8">Common Questions</p>
        <div className="space-y-4">
          {faq.map((item) => (
            <div key={item.q} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="font-semibold text-white mb-2">{item.q}</p>
              <p className="text-white/60 text-sm">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="start" className="max-w-xl mx-auto px-6 pb-20">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-2xl font-black text-center mb-2">Start Your $1 Pilot</h2>
          <p className="text-white/50 text-sm text-center mb-6">
            We text your old HVAC leads this week. $50/reply. $0 if nobody responds.
          </p>
          <form onSubmit={startPilot} className="space-y-4">
            <input
              type="email"
              required
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm"
            />
            <input
              type="text"
              placeholder="Business name (optional)"
              value={biz}
              onChange={(e) => setBiz(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00d4ff] text-[#0a0f1a] font-bold py-4 rounded-xl text-base hover:bg-[#00d4ff]/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Redirecting to checkout…" : "🚀 Start for $1"}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-white/30 text-xs mb-3">— or —</p>
            <a href="tel:+13139921219" className="text-[#00d4ff] font-semibold text-sm hover:underline">
              📞 Call Matt directly: (313) 992-1219
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-white/30 text-xs">
        <p>Detroit Web Agency · matt@detroitwebagent.com · (313) 992-1219</p>
        <p className="mt-1">Grosse Pointe, MI · Serving {TRADE} Contractors Nationwide</p>
      </footer>
    </div>
  );
}
