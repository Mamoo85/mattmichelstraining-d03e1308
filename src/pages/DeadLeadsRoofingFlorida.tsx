import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DeadLeadROICalculator from "@/components/dead-leads/DeadLeadROICalculator";

const TRADE = "Roofing";
const GEO = "Florida";
const CONTACTS = 400;
const REPLY_RATE = 5;
const REPLIES = 20;
const AVG_JOB = 14000;
const POTENTIAL = REPLIES * AVG_JOB;
const COST = REPLIES * 50;

export default function DeadLeadsRoofingFlorida() {
  const [email, setEmail] = useState("");
  const [biz, setBiz] = useState("");
  const [loading, setLoading] = useState(false);

  const faq = [
    {
      q: "Florida has constant storm demand — why would I have dead leads?",
      a: "Storm season creates a flood of quote requests that contractors can't close fast enough. Homeowners who got a quote in June and didn't hear back by August hired someone else — or more often, just forgot. We re-contact them before the next season. Many are still on the fence.",
    },
    {
      q: "What exactly do you send them?",
      a: "A short, professional SMS from your business name: 'Hi [Name], this is [Your Company]. You requested a roofing estimate from us a while back — we have crews available this month. Still interested? Reply YES or call anytime.' Reads like a real follow-up, not a blast.",
    },
    {
      q: "What if I've already tried calling them?",
      a: "Calls get screened. Texts get read — 98% open rate within 3 minutes. The medium is the message. People who ignored your calls will reply to a text.",
    },
    {
      q: "How many leads do I need for this to be worth it?",
      a: "Minimum 50 contacts. Even at 50 contacts: 3 replies × $14,000 avg FL roof = $42,000 potential, $150 cost. If you close 1, you're at 93x ROI.",
    },
    {
      q: "What if nobody replies?",
      a: "You pay $1. Full stop. We only make money when you make money — that's the model.",
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
          <span className="text-[#ff6b35]">WEB AGENCY</span>
        </span>
        <a href="tel:+13139921219" className="text-sm text-white/60 hover:text-white">
          📞 (313) 992-1219
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-block bg-[#ff6b35]/10 border border-[#ff6b35]/30 rounded-full px-4 py-1.5 text-[#ff6b35] text-xs font-bold uppercase tracking-widest mb-6">
          {GEO} {TRADE} Contractors
        </div>
        <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4">
          <span className="text-[#ff6b35]">${POTENTIAL.toLocaleString()}</span> in Old{" "}
          <br />
          Florida Roofing Leads.
          <br />
          Prove It for $1.
        </h1>
        <p className="text-white/60 text-lg max-w-xl mx-auto mb-8">
          Florida storm season fills your pipeline fast. It also leaves hundreds of quotes that went quiet. We text every one of them — you pay $50 only when someone replies ready to talk.
        </p>
        <a
          href="#start"
          className="inline-block bg-[#ff6b35] text-white font-bold text-lg px-8 py-4 rounded-xl hover:bg-[#ff6b35]/90 transition-colors shadow-lg shadow-[#ff6b35]/20"
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
              { label: "Avg FL roofing job value", value: `$${AVG_JOB.toLocaleString()}` },
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
            <strong className="text-[#ff6b35]">{Math.round(POTENTIAL / COST)}x ROI</strong> on half-closes.
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
            { step: "1", title: "Send us your old quotes", desc: "Spreadsheet, CRM export, or even a pasted list. Any format. We clean it." },
            { step: "2", title: "We send personalized texts", desc: "From your business name. Short, professional, not spammy. Goes out within 24-48 hours." },
            { step: "3", title: "Pay only for real replies", desc: "$50 per interested reply. Zero cost if nobody responds. Your card isn't charged until replies come in." },
          ].map((s) => (
            <div key={s.step} className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="w-8 h-8 bg-[#ff6b35] rounded-full flex items-center justify-center text-white font-black text-sm mb-4">
                {s.step}
              </div>
              <h3 className="font-bold text-white mb-2">{s.title}</h3>
              <p className="text-white/50 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="bg-[#ff6b35]/5 border-y border-[#ff6b35]/20 py-10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-[#ff6b35] font-bold text-lg">
            "After the last hurricane season, I had 420 quotes that went nowhere. 21 replied when you texted them. 5 signed contracts. That was $91,000 I almost left on the table."
          </p>
          <p className="text-white/40 text-sm mt-3">— Roofing contractor, South Florida</p>
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
            We'll text your old Florida roofing leads this week. $50/reply. $0 if nobody responds.
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
              className="w-full bg-[#ff6b35] text-white font-bold py-4 rounded-xl text-base hover:bg-[#ff6b35]/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Redirecting to checkout…" : "🚀 Start for $1"}
            </button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-white/30 text-xs mb-3">— or —</p>
            <a href="tel:+13139921219" className="text-[#ff6b35] font-semibold text-sm hover:underline">
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
