import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "How much does a website cost?", a: "Our standard sites start at $499, professional at $1,499, and full business systems at $3,499. Monthly retainers range from $49-$199/mo depending on services. Every project includes a free diagnostic first so you know exactly what you're paying for.", cat: "Pricing" },
  { q: "Are there any contracts or lock-ins?", a: "No. Every service is month-to-month. Cancel anytime with zero penalties. We keep your business by delivering results, not by trapping you in fine print.", cat: "Pricing" },
  { q: "How long until I see results?", a: "Most clients see their first leads within 2-4 weeks of launch. SEO improvements typically show measurable gains within 60-90 days. Our automation products (call routing, SMS, review management) work from day one.", cat: "Timeline" },
  { q: "How long does it take to build my site?", a: "Standard sites: 5-7 business days. Professional sites: 10-14 business days. Full business systems: 2-3 weeks. We move fast because our engineering process is systematized.", cat: "Timeline" },
  { q: "Do I need to do anything on my end?", a: "Very little. We need 30 minutes of your time for an initial call, then we handle everything — design, development, content, SEO setup, and automation configuration. You focus on running your business.", cat: "Effort" },
  { q: "Will I need to learn any technical tools?", a: "No. Everything we build runs on autopilot. You'll get a simple dashboard to see your leads and results, but there's nothing technical to manage. If something needs attention, we handle it.", cat: "Effort" },
  { q: "What makes you different from other web agencies?", a: "We're not web designers — we're full-stack engineers who started in hardware repair. We build websites as automated lead systems, not just pretty pages. Plus, we're local to Grosse Pointe — not a faceless overseas shop.", cat: "General" },
  { q: "What if I'm not happy with the results?", a: "We offer a local guarantee. If your system isn't performing, we fix it — in person if needed. Matt Michels, our lead agent, is based in Grosse Pointe and personally oversees every project.", cat: "General" },
];

const AgencyFAQ = () => {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20" style={{ background: "#0d1117", borderTop: "1px solid rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
      <div className="container max-w-3xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
            Common Questions
          </h2>
          <p style={{ color: "#64748b" }}>Straight answers. No jargon.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl overflow-hidden" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded" style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee" }}>{faq.cat}</span>
                  <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{faq.q}</span>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 ml-2 transition-transform ${open === i ? "rotate-180" : ""}`} style={{ color: "#64748b" }} />
              </button>
              {open === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AgencyFAQ;
