import { Helmet } from "react-helmet-async";
import { Gift, CheckCircle, ArrowRight } from "lucide-react";
import AppNavbar from "@/components/layout/AppNavbar";
import GiftCardSection from "@/components/store/GiftCardSection";

const FAQS = [
  {
    q: "How does the recipient redeem it?",
    a: "After purchase you'll receive a unique code. Your recipient enters it at checkout when signing up for any M2 membership to apply the full balance toward their first payment.",
  },
  {
    q: "Does the gift card expire?",
    a: "No expiration date. The balance stays on the card until it's used.",
  },
  {
    q: "Can I buy one for someone who already has a membership?",
    a: "Yes — the balance applies to their next renewal. They'll enter the code in their profile and it automatically credits their account.",
  },
  {
    q: "What plans can it be used on?",
    a: "Any M2 membership — Foundation, Guided, Pro, or Elite. One-time program purchases too.",
  },
  {
    q: "Can I choose any amount?",
    a: "Choose from $25, $50, $100, or $150. The full amount goes directly toward training.",
  },
];

const REASONS = [
  "Instant email delivery — no shipping, no waiting",
  "Works for all M2 membership tiers and programs",
  "No expiration date — they use it when they're ready",
  "Personally delivered from you to them",
];

const GiftCard = () => (
  <div className="min-h-screen bg-background">
    <Helmet>
      <title>Give the Gift of Athletic Training — M2 Gift Cards</title>
      <meta name="description" content="M2 Training gift cards — the perfect gift for any athlete. Instantly emailed, works on any membership tier. $25, $50, $100, or $150." />
    </Helmet>

    <AppNavbar />

    <div className="pt-20 pb-16">
      {/* Hero */}
      <div className="bg-primary/10 border-b border-primary/20 py-14">
        <div className="container max-w-2xl text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 mb-4">
            <Gift size={26} className="text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight mb-3">
            Give the Gift of Athletic Training
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            Whether it's a birthday, holiday, or "because I believe in you" — an M2 gift card puts professional training in their hands instantly.
          </p>
        </div>
      </div>

      <div className="container max-w-2xl py-12 space-y-12">
        {/* Why It Works */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">Why It Works</h2>
          <ul className="space-y-3">
            {REASONS.map((r) => (
              <li key={r} className="flex items-start gap-3">
                <CheckCircle size={16} className="text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Gift Card Purchase Widget */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">Choose an Amount</h2>
          <GiftCardSection />
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Common Questions</h2>
          <div className="space-y-6">
            {FAQS.map((faq) => (
              <div key={faq.q} className="border-b border-border pb-6 last:border-0">
                <p className="text-sm font-semibold text-foreground mb-1">{faq.q}</p>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA bottom */}
        <div className="bg-card border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Not sure about a gift card? Browse membership plans instead.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest hover:underline"
          >
            View Membership Plans <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  </div>
);

export default GiftCard;
