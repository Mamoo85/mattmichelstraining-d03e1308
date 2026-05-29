import { useState } from "react";
import { CheckCircle, Clock, Zap, Mail, Users, TrendingUp, ArrowRight, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const HOW_IT_WORKS = [
  {
    icon: TrendingUp,
    step: "1",
    title: "Hiring signals found at 6am",
    description:
      "Every morning the system scans job boards, licensing databases, and 50+ data sources to find businesses in your target market that are actively growing — the exact signal that they need help.",
  },
  {
    icon: Mail,
    step: "2",
    title: "Owner email found and verified",
    description:
      "A 10-stage waterfall (Apollo → Hunter → Snov → PDL → RDAP + more) tracks down the owner's direct email. Not a contact form — the actual decision-maker.",
  },
  {
    icon: Bot,
    step: "3",
    title: "Personalized cold email sent",
    description:
      "A plain, human-looking email goes out with your pitch — proof-before-pitch style that gets 3x the reply rate of marketing templates. Reads like a person wrote it.",
  },
  {
    icon: Clock,
    step: "4",
    title: "D3 / D7 / D14 follow-ups fire automatically",
    description:
      "Anyone who doesn't reply gets two more follow-ups over two weeks. The D14 touch offers a phone call. Then the sequence closes — no spam, no endless drip.",
  },
];

const FAQ = [
  {
    q: "What industries does this work for?",
    a: "Any B2B company that sells to businesses that hire — trades (HVAC, plumbing, electrical, auto), healthcare, staffing, software, equipment leasing, insurance. We detect hiring signals as the trigger. If your buyer hires people, this works.",
  },
  {
    q: "How many emails go out per day?",
    a: "Up to 50 emails/day on the standard plan. Each email is personalized with the company name, role they're hiring for, and your custom pitch copy.",
  },
  {
    q: "What does the 14-day trial include?",
    a: "Full access — the system runs for you every day during the trial. You'll see real prospects found, real emails sent, and real replies before you're ever charged.",
  },
  {
    q: "What do I need to provide?",
    a: "Your target industry, target geography, and a short pitch (2–3 sentences on what you do and why they should care). We handle everything else.",
  },
  {
    q: "Can I see what's being sent before it goes out?",
    a: "You get a live dashboard showing every prospect found, every email sent, every open and reply — updated every 30 seconds. You can pause at any time.",
  },
  {
    q: "What's the cancellation policy?",
    a: "Cancel anytime, no contract. If you cancel before your trial ends, you're never charged.",
  },
];

export default function SDRProduct() {
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [industry, setIndustry] = useState("");
  const [geography, setGeography] = useState("");
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function handleStart() {
    if (!company.trim() || !email.trim()) {
      toast.error("Company name and email are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-checkout", {
        body: {
          company_name: company.trim(),
          contact_email: email.trim(),
          industry: industry.trim() || undefined,
          geography: geography.trim() || undefined,
          trial: true,
        },
      });
      if (error || !data?.url) throw new Error(error?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      <SEOHead
        title="Autonomous SDR — Detroit Web Agency"
        description="300 cold emails/day to your target market. Automated follow-up. Real replies in your inbox. $997/month — cancel anytime."
      />
      <div className="min-h-screen bg-[#0a1628] text-white">

        {/* Nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 max-w-6xl mx-auto">
          <span className="font-black text-lg tracking-tight">DETROIT WEB AGENCY</span>
          <a href="https://detroitwebagent.com" className="text-sm text-white/60 hover:text-white transition-colors">← All Products</a>
        </div>

        {/* Hero */}
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-block bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            14-day free trial — no card required to start
          </div>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
            Your competitor is already<br />
            <span className="text-[#00d4ff]">automating this.</span>
          </h1>
          <p className="text-xl text-white/70 mb-4 max-w-2xl mx-auto">
            Every morning at 6am: prospects found, owner emails tracked down, cold emails sent, follow-ups scheduled.
            All before you've had coffee.
          </p>
          <p className="text-lg text-white/50 mb-12">
            A junior SDR costs $3,500/month + benefits + training + turnover.<br />
            This costs <strong className="text-white">$997/month</strong> and doesn't call in sick.
          </p>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-16">
            {[
              { n: "47", label: "prospects found" },
              { n: "23", label: "emails sent" },
              { n: "2", label: "replies today" },
            ].map(({ n, label }) => (
              <div key={label} className="bg-white/5 border border-white/10 rounded-xl py-5">
                <div className="text-3xl font-black text-[#00d4ff]">{n}</div>
                <div className="text-sm text-white/50 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* CTA form */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-lg mx-auto text-left">
            <h2 className="text-xl font-bold mb-6 text-center">Start your free 14-day trial</h2>
            <div className="space-y-3">
              <Input
                placeholder="Company name"
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Input
                placeholder="Target industry (e.g. HVAC, dental, staffing)"
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Input
                placeholder="Target geography (e.g. Metro Detroit)"
                value={geography}
                onChange={e => setGeography(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Button
                onClick={handleStart}
                disabled={loading}
                className="w-full bg-[#00d4ff] hover:bg-[#00b8e0] text-[#0a1628] font-black text-base py-6"
              >
                {loading ? "Setting up…" : "Start free trial — $0 today"}
                {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
              </Button>
              <p className="text-xs text-white/40 text-center">No card required. $997/month after trial. Cancel anytime.</p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white/[0.02] border-y border-white/10 py-20">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl font-black text-center mb-3">What runs every day</h2>
            <p className="text-white/50 text-center mb-12">Four steps. Fully automated. Zero human input required.</p>
            <div className="grid md:grid-cols-2 gap-6">
              {HOW_IT_WORKS.map(({ icon: Icon, step, title, description }) => (
                <div key={step} className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 flex items-center justify-center text-[#00d4ff] text-sm font-bold">
                      {step}
                    </div>
                    <Icon className="h-5 w-5 text-[#00d4ff]" />
                    <span className="font-bold">{title}</span>
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison */}
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-black text-center mb-12">SDR vs. this system</h2>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-white/50 font-medium"></th>
                  <th className="px-6 py-4 text-white/50 font-medium text-center">Junior SDR</th>
                  <th className="px-6 py-4 text-[#00d4ff] font-bold text-center bg-[#00d4ff]/5">This system</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Monthly cost", "$3,500 + benefits", "$997"],
                  ["Emails per day", "50–80 (good day)", "Up to 300"],
                  ["Sick days / PTO", "Yes", "Never"],
                  ["Ramp time", "60–90 days", "24 hours"],
                  ["Follow-up consistency", "Varies", "Always"],
                  ["Works on Sunday at 6am", "No", "Yes"],
                  ["Cancellation", "2-week notice + severance", "Cancel anytime"],
                ].map(([feature, human, system]) => (
                  <tr key={feature} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-6 py-4 text-white/70">{feature}</td>
                    <td className="px-6 py-4 text-white/40 text-center">{human}</td>
                    <td className="px-6 py-4 text-white font-semibold text-center bg-[#00d4ff]/[0.03]">{system}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* What you get */}
        <div className="bg-white/[0.02] border-y border-white/10 py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-black text-center mb-12">Everything included at $997/month</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                "Daily prospect hunt — hiring signal detection across 50+ sources",
                "10-stage owner email waterfall (Apollo, Hunter, Snov, PDL, RDAP + more)",
                "Up to 50 personalized cold emails per day",
                "D3 / D7 / D14 follow-up sequences — automatic",
                "LinkedIn connection requests alongside email",
                "Live client dashboard — see every prospect, email, open, and reply",
                "Custom pitch copy for your industry and geography",
                "Pause, adjust targeting, or cancel anytime",
              ].map(feature => (
                <div key={feature} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-[#00d4ff] shrink-0 mt-0.5" />
                  <span className="text-white/80 text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-black text-center mb-12">Common questions</h2>
          <div className="space-y-3">
            {FAQ.map(({ q, a }, i) => (
              <div key={i} className="border border-white/10 rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-6 py-4 flex items-center justify-between font-semibold hover:bg-white/5 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {q}
                  <span className="text-[#00d4ff] text-lg ml-4">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-white/60 text-sm leading-relaxed border-t border-white/10 pt-4">{a}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-[#00d4ff]/5 border-t border-[#00d4ff]/20 py-20">
          <div className="max-w-xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-black mb-4">Start your 14-day free trial</h2>
            <p className="text-white/60 mb-8">
              The system runs every day during your trial. See real prospects, real emails, real replies — before you're ever charged.
            </p>
            <div className="space-y-3">
              <Input
                placeholder="Company name"
                value={company}
                onChange={e => setCompany(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <Button
                onClick={handleStart}
                disabled={loading}
                className="w-full bg-[#00d4ff] hover:bg-[#00b8e0] text-[#0a1628] font-black text-base py-6"
              >
                {loading ? "Setting up…" : "Start free trial — $0 today"}
                {!loading && <ArrowRight className="ml-2 h-5 w-5" />}
              </Button>
              <p className="text-xs text-white/40">$997/month after 14 days. Cancel anytime.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 py-8 text-center text-white/30 text-sm">
          © {new Date().getFullYear()} Detroit Web Agency · <a href="mailto:matt@detroitwebagent.com" className="hover:text-white/60">(313) 992-1219</a>
        </div>

      </div>
    </>
  );
}
