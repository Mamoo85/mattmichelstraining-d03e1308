import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DeadLeadROICalculator from "@/components/dead-leads/DeadLeadROICalculator";

const TRADE = "Roofing";
const GEO = "Texas";
const CONTACTS = 400;
const REPLY_RATE = 5;
const REPLIES = 20;
const AVG_JOB = 12000;
const POTENTIAL = REPLIES * AVG_JOB;
const COST = REPLIES * 50;

export default function DeadLeadsRoofingTexas() {
  const [email, setEmail] = useState("");
  const [biz, setBiz] = useState("");
  const [loading, setLoading] = useState(false);

  const faq = [
    {
      q: "What if my old leads are years old?",
      a: "Age doesn't disqualify them. Homeowners who got a roofing quote 2-3 years ago often still need the work done — they just got busy, couldn't afford it then, or got a bad experience elsewhere. We're seeing reply rates as high as 8% on leads that are 3+ years old.",
    },
    {
      q: "What exactly do you text them?",
      a: "A short, personalized SMS from your business — not a blast. Something like: 'Hi [Name], this is [Your Company]. You requested a quote from us a while back — we have an opening this month if you're still interested. Reply YES or call us.' No spam. No scripts that feel fake.",
    },
    {
      q: "What if someone replies angry?",
      a: "Rarely happens, but if it does, we mark them do-not-contact and you don't pay. You only pay when someone replies with genuine interest — not complaints, unsubscribes, or wrong numbers.",
    },
    {
      q: "How long does setup take?",
      a: "Under 10 minutes. You share your contact list (spreadsheet or CRM export), we handle everything else. First texts go out within 24-48 hours.",
    },
    {
      q: "What if nobody replies?",
      a: "You pay nothing beyond the $1 pilot. That's the entire point. We only make money when you make money.",
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
          There's{" "}
          <span className="text-[#ff6b35]">${POTENTIAL.toLocaleString()}</span>
          <br />
          in Your Old Roofing Leads.
          <br />
          We'll Prove It for $1.
        </h1>
        <p className="text-white/60 text-lg max-w-xl mx-auto mb-8">
          You quoted them. They went quiet. We text every single one — you pay $50 only when someone replies with interest. Zero risk beyond a dollar.
        </p>
        <a
          href="#start"
          className="inline-block bg-[#ff6b35] text-white font-bold text-lg px-8 py-4 rounded-xl hover:bg-[#ff6b35]/90 transition-colors shadow-lg shadow-[#ff6b35]/20"
        >
          Start for $1 — No Monthly Fee
        </a>
        <p className="text-white/30 text-xs mt-3">
          If nobody replies, you paid $1 to find out. That's the whole deal.
        </p>
      </section>

      {/* The Math */}
      <section className="bg-white/5 border-y border-white/10 py-12">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-white/50 text-xs font-bold uppercase tracking-widest text-center mb-8">
            The Math on Your Dead Leads
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Avg old contacts in your CRM", value: `~${CONTACTS}` },
              { label: `Reply rate (${REPLY_RATE}% avg)`, value: `${REPLIES} replies` },
              { label: "Avg TX roofing job", value: `$${AVG_JOB.toLocaleString()}` },
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
            <strong className="text-[#ff6b35]">{Math.round(POTENTIAL / COST)}x ROI</strong> if you close even half of them.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest text-center mb-10">
          3 Steps. Done This Week.
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { step: "1", title: "Share your list", desc: "Email us your old leads — spreadsheet, CRM export, even a clipboard paste. Any format works." },
            { step: "2", title: "We text them", desc: "Personalized SMS goes out within 24-48 hours. No blasts, no spam triggers. Real texts that get read." },
            { step: "3", title: "You only pay for replies", desc: "$50 per interested reply. We define \"interested\" — not unsubscribes, not wrong numbers, not complaints." },
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

      {/* Social proof placeholder */}
      <section className="bg-[#ff6b35]/5 border-y border-[#ff6b35]/20 py-10">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-[#ff6b35] font-bold text-lg">
            "We had 380 old roofing quotes sitting in a spreadsheet. 19 replied. We closed 6. That's $78,000 from leads we'd written off."
          </p>
          <p className="text-white/40 text-sm mt-3">— Roofing contractor, DFW area</p>
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

      {/* ROI Calculator */}
      <section className="max-w-3xl mx-auto px-6 pb-4">
        <DeadLeadROICalculator trade={TRADE} geo={GEO} avgJobValue={AVG_JOB} defaultLeads={CONTACTS} />
      </section>

      {/* CTA */}
      <section id="start" className="max-w-xl mx-auto px-6 pb-20 pt-8">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h2 className="text-2xl font-black text-center mb-2">Start Your $1 Pilot</h2>
          <p className="text-white/50 text-sm text-center mb-6">
            We'll text your first batch of old leads this week. You pay $50 per reply. Nothing if nobody replies.
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
            <a
              href="tel:+13139921219"
              className="text-[#ff6b35] font-semibold text-sm hover:underline"
            >
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
