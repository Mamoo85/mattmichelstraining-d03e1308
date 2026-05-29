import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  ArrowRight,
  Zap,
  Clock,
  Shield,
  TrendingUp,
  Star,
  Bot,
  Package,
  BarChart2,
  ChevronDown,
} from "lucide-react";

const TIERS = [
  {
    name: "Starter",
    price: 99,
    description: "Perfect for new Etsy sellers who want to test automation",
    features: [
      "3 new products published every day",
      "Wall art & print niches",
      "AI-generated images + SEO titles",
      "13 Etsy tags per listing",
      "Weekly tag refresh",
      "Email support",
    ],
    cta: "Start Automating",
    highlighted: false,
  },
  {
    name: "Growth",
    price: 199,
    description: "For established sellers ready to scale without lifting a finger",
    features: [
      "5 new products published every day",
      "All product types: mugs, shirts, hoodies, tumblers, and more",
      "AI trend scanner picks winning niches",
      "Visual quality check on every product",
      "Weekly SEO refresh on live listings",
      "Priority email + chat support",
    ],
    cta: "Get Growth Plan",
    highlighted: true,
    badge: "Most Popular",
  },
  {
    name: "Pro",
    price: 299,
    description: "Full-store automation with digital downloads and monthly review",
    features: [
      "Everything in Growth",
      "Digital download products (printables, planners, checklists)",
      "Competitor scout — AI finds what's selling this week",
      "Monthly store performance audit",
      "Bestseller expander clones your winning products",
      "Dedicated Slack channel",
    ],
    cta: "Go Pro",
    highlighted: false,
  },
];

const HOW_IT_WORKS = [
  {
    icon: TrendingUp,
    step: "1",
    title: "AI Scans What's Trending",
    description:
      "Every morning our system scans Etsy search trends, seasonal demand, and competitor gaps to pick the exact niches that are selling right now.",
  },
  {
    icon: Bot,
    step: "2",
    title: "Products Are Created Automatically",
    description:
      "AI generates the product image, writes an SEO-optimized title and description, selects all 13 tags, and queues everything for publishing — zero input from you.",
  },
  {
    icon: Package,
    step: "3",
    title: "Listings Go Live on Etsy",
    description:
      "Each product is created in Printify, published to your connected Etsy shop, and immediately visible to buyers. New listings appear while you sleep.",
  },
  {
    icon: BarChart2,
    step: "4",
    title: "Store Grows on Autopilot",
    description:
      "The system monitors what sells, refreshes tags weekly for better search ranking, and automatically clones your best-performing products into new variants.",
  },
];

const FAQ = [
  {
    q: "Do I need any design or technical skills?",
    a: "None. The system handles design, writing, tagging, and publishing. You just connect your Etsy shop and Printify account — we do the rest.",
  },
  {
    q: "What does the setup process look like?",
    a: "After you subscribe, we schedule a 30-minute onboarding call. We connect your Etsy OAuth, set up your Printify account (if needed), and have new products publishing within 24 hours.",
  },
  {
    q: "Is there any inventory risk?",
    a: "Zero. Every product is print-on-demand via Printify. Products are only manufactured after a buyer purchases — no upfront inventory cost ever.",
  },
  {
    q: "What kinds of products does the system create?",
    a: "Mugs, t-shirts, hoodies, sweatshirts, tumblers, socks, hats, posters, coasters, ornaments, onesies, and digital downloads (on Pro plan). All shipped directly to your buyer by Printify.",
  },
  {
    q: "Will my Etsy shop look like other AutoPOD stores?",
    a: "No. Every product is generated fresh from trend data. The AI picks unique niches, writes custom descriptions, and generates original images — your store won't look like anyone else's.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no cancellation fees. Cancel before your next billing date and you won't be charged again.",
  },
];

export default function AutoPodLanding() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    try {
      await supabase.from("autopod_waitlist").insert({ email, source: "landing" });
      setSubmitted(true);
    } catch {
      // still show success — don't block on DB error
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="AutoPOD by Detroit Web Agency — Your Etsy Store, Fully Automated by AI"
        description="5 new Etsy products published every day — AI designs, writes SEO titles, and lists everything automatically. Zero design skills needed. Cancel anytime."
      />
      <div className="min-h-screen bg-[#0f172a] text-white font-sans">

        {/* Nav */}
        <nav className="border-b border-slate-800 py-4 px-6 flex items-center justify-between max-w-6xl mx-auto">
          <span className="text-[#22d3ee] font-bold text-lg tracking-tight">
            Auto<span className="text-white">POD</span>
          </span>
          <span className="text-slate-400 text-sm hidden sm:block">by Detroit Web Agency</span>
          <a href="#pricing">
            <Button size="sm" className="bg-[#22d3ee] hover:bg-[#06b6d4] text-white rounded-lg">
              See Pricing
            </Button>
          </a>
        </nav>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#22d3ee]/10 via-transparent to-[#1e293b]" />
          <div className="relative max-w-4xl mx-auto px-4 py-24 md:py-32 text-center">
            <div className="inline-flex items-center gap-2 bg-[#22d3ee]/10 border border-[#22d3ee]/30 text-[#22d3ee] px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Print-on-Demand · Fully Automated
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6">
              Your Etsy Store,{" "}
              <span className="text-[#22d3ee]">Fully Run by AI</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto mb-4">
              5 new products published every single day — AI designs them, writes the SEO, and lists them on Etsy while you do literally anything else.
            </p>
            <p className="text-slate-400 mb-10 text-base">
              Zero design skills · Zero inventory risk · Cancel anytime
            </p>

            {/* Waitlist / CTA */}
            {submitted ? (
              <div className="inline-flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 px-6 py-4 rounded-xl text-lg font-medium">
                <CheckCircle className="w-6 h-6" />
                You're on the list! We'll be in touch within 24 hours.
              </div>
            ) : (
              <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12 rounded-xl flex-1"
                />
                <Button
                  type="submit"
                  disabled={submitting}
                  size="lg"
                  className="bg-[#22d3ee] hover:bg-[#06b6d4] text-white px-8 h-12 rounded-xl shadow-lg shadow-[#22d3ee]/25 flex-shrink-0"
                >
                  {submitting ? "Joining..." : "Get Early Access"} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            )}
            <p className="text-slate-500 text-sm mt-4">
              Free onboarding call included · First 10 subscribers get locked-in pricing forever
            </p>
          </div>
        </section>

        {/* Social proof bar */}
        <section className="bg-[#1e293b] border-y border-slate-700/50 py-8">
          <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-center gap-8 text-center">
            <div>
              <div className="text-2xl font-bold text-[#22d3ee]">150+</div>
              <div className="text-slate-400 text-sm">products/month</div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-700" />
            <div>
              <div className="text-2xl font-bold text-[#22d3ee]">13</div>
              <div className="text-slate-400 text-sm">SEO tags per listing</div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-700" />
            <div>
              <div className="text-2xl font-bold text-[#22d3ee]">24hr</div>
              <div className="text-slate-400 text-sm">live after onboarding</div>
            </div>
            <div className="hidden sm:block w-px h-8 bg-slate-700" />
            <div>
              <div className="text-2xl font-bold text-[#22d3ee]">$0</div>
              <div className="text-slate-400 text-sm">inventory risk</div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              How AutoPOD Works
            </h2>
            <p className="text-slate-400 text-center mb-14 max-w-xl mx-auto">
              Once you're connected, the system runs every morning without any input from you.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {HOW_IT_WORKS.map((item) => (
                <div
                  key={item.step}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-7 flex gap-5"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#22d3ee]/10 border border-[#22d3ee]/20 flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-[#22d3ee]" />
                  </div>
                  <div>
                    <div className="text-xs text-[#22d3ee] font-semibold mb-1 tracking-widest uppercase">
                      Step {item.step}
                    </div>
                    <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What AI Creates */}
        <section className="bg-[#1e293b] py-16 border-y border-slate-700/50">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
              What Gets Created For You Every Day
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                "Mugs", "T-Shirts", "Hoodies", "Sweatshirts",
                "Tumblers", "Socks", "Hats", "Posters",
                "Coasters", "Ornaments", "Baby Onesies", "Digital Downloads*",
              ].map((product) => (
                <div
                  key={product}
                  className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3"
                >
                  <CheckCircle className="w-4 h-4 text-[#22d3ee] flex-shrink-0" />
                  <span className="text-sm text-slate-200">{product}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs text-center mt-4">* Digital Downloads available on Pro plan</p>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-slate-400 text-center mb-14 max-w-xl mx-auto">
              No setup fees · No contracts · Cancel anytime with one click
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative rounded-2xl border p-8 flex flex-col ${
                    tier.highlighted
                      ? "bg-[#22d3ee]/5 border-[#22d3ee]/40 shadow-xl shadow-[#22d3ee]/10"
                      : "bg-slate-800/40 border-slate-700/50"
                  }`}
                >
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#22d3ee] text-white text-xs font-bold px-4 py-1 rounded-full">
                      {tier.badge}
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
                    <div className="flex items-end gap-1 mb-3">
                      <span className="text-4xl font-extrabold">${tier.price}</span>
                      <span className="text-slate-400 mb-1">/mo</span>
                    </div>
                    <p className="text-slate-400 text-sm">{tier.description}</p>
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-[#22d3ee] flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-300">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a href="mailto:matt@detroitwebagency.com?subject=AutoPOD%20Inquiry">
                    <Button
                      size="lg"
                      className={`w-full rounded-xl font-semibold ${
                        tier.highlighted
                          ? "bg-[#22d3ee] hover:bg-[#06b6d4] text-white shadow-lg shadow-[#22d3ee]/25"
                          : "bg-slate-700 hover:bg-slate-600 text-white"
                      }`}
                    >
                      {tier.cta} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </a>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-sm text-center mt-6">
              All plans include a free 30-minute onboarding call and 7-day money-back guarantee.
            </p>
          </div>
        </section>

        {/* Trust bar */}
        <section className="bg-[#1e293b] py-14 border-y border-slate-700/50">
          <div className="max-w-4xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <Shield className="w-9 h-9 text-[#22d3ee]" />
              <span className="font-semibold text-lg">No Contracts</span>
              <span className="text-sm text-slate-400">Cancel anytime — one click, no questions</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Clock className="w-9 h-9 text-[#22d3ee]" />
              <span className="font-semibold text-lg">Live in 24 Hours</span>
              <span className="text-sm text-slate-400">We onboard you and connect everything</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Star className="w-9 h-9 text-[#22d3ee]" />
              <span className="font-semibold text-lg">Built by Detroit</span>
              <span className="text-sm text-slate-400">Real agency, real humans, real support</span>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 md:py-28">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <div
                  key={i}
                  className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left"
                  >
                    <span className="font-semibold text-slate-100">{item.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 flex-shrink-0 ml-4 transition-transform ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-5 text-slate-400 text-sm leading-relaxed border-t border-slate-700/50 pt-4">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-24">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Put Your Etsy Store on Autopilot?
            </h2>
            <p className="text-slate-300 mb-8 text-lg">
              Join the waitlist — first 10 sellers get grandfathered pricing locked in forever.
            </p>
            {submitted ? (
              <div className="inline-flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 px-6 py-4 rounded-xl text-lg font-medium">
                <CheckCircle className="w-6 h-6" />
                You're on the list! We'll reach out within 24 hours.
              </div>
            ) : (
              <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 h-12 rounded-xl flex-1"
                />
                <Button
                  type="submit"
                  disabled={submitting}
                  size="lg"
                  className="bg-[#22d3ee] hover:bg-[#06b6d4] text-white px-8 h-12 rounded-xl shadow-lg shadow-[#22d3ee]/25 flex-shrink-0"
                >
                  {submitting ? "Joining..." : "Get Early Access"} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-[#0f172a] border-t border-slate-800 py-10">
          <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500">
            <p className="font-semibold text-slate-400 mb-2">AutoPOD by Detroit Web Agency</p>
            <p>Matt Michels · Grosse Pointe, MI · (313) 992-1219</p>
            <p className="mt-2">
              <a href="mailto:matt@detroitwebagency.com" className="text-slate-400 hover:text-white">matt@detroitwebagency.com</a>
              {" · "}
              <Link to="/" className="text-slate-400 hover:text-white">M2 Training</Link>
              {" · "}
              <a href="https://detroitwebagency.com" className="text-slate-400 hover:text-white">Detroit Web Agency</a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
