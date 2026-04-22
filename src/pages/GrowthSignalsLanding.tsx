import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, Building2, Hammer, Zap, ShieldCheck, Star, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/gtag";

const SIGNALS = [
  {
    icon: Building2,
    vertical: "Industrial Boiler",
    region: "█████████, MI 48███",
    headline: "Mid-size manufacturer posted 3 boiler tech roles in 9 days",
    detail: "Permit pulled for $█.█M facility expansion. Hiring spike + capex = inbound buying window.",
    confidence: 9,
    age: "2 days ago",
  },
  {
    icon: Hammer,
    vertical: "Commercial HVAC",
    region: "████ ██████, MI 482██",
    headline: "GC won $█.█M school district retrofit — needs 4 subs in 30 days",
    detail: "MIOSHA license filed last week, no in-house HVAC crew. Sub-bid window opens █/██.",
    confidence: 8,
    age: "5 days ago",
  },
  {
    icon: Zap,
    vertical: "Electrical / Solar",
    region: "███████, MI 481██",
    headline: "Property mgmt firm acquired 6 buildings — needs panel upgrades",
    detail: "DTE service-upgrade applications on file for all 6. No preferred electrician relationship found.",
    confidence: 8,
    age: "1 day ago",
  },
];

const TESTIMONIALS = [
  { quote: "Closed a $42K boiler retrofit from one signal. Paid for the year in week one.", name: "R. Kowalski", role: "Owner, Detroit Mechanical" },
  { quote: "We were cold-calling. Now we're calling people who already pulled permits.", name: "M. Singh", role: "Sales Lead, Metro HVAC Group" },
  { quote: "Three signals → two scoped meetings → one signed MSA in 11 days.", name: "T. Brennan", role: "BD Director, Industrial Co." },
];

export default function GrowthSignalsLanding() {
  const [utm, setUtm] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source") || "direct";
    const utmMedium = params.get("utm_medium") || "landing";
    const utmCampaign = params.get("utm_campaign") || "growth_signals";
    const utmContent = params.get("utm_content") || "";
    const utmTerm = params.get("utm_term") || "";

    const qs = new URLSearchParams({
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      ...(utmContent && { utm_content: utmContent }),
      ...(utmTerm && { utm_term: utmTerm }),
    }).toString();
    setUtm(qs);

    trackEvent("growth_signals_landing_view", { utm_source: utmSource, utm_campaign: utmCampaign });
  }, []);

  const checkoutUrl = useMemo(() => `/industrial-pulse?unlock=1${utm ? `&${utm}` : ""}`, [utm]);
  const sampleUrl = useMemo(() => `/industrial-pulse${utm ? `?${utm}` : ""}`, [utm]);

  const handleCheckoutClick = (cta: string) => {
    trackEvent("growth_signals_cta_click", { cta, destination: "industrial_pulse_checkout" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Growth Signals — Detroit Industrial Buying Intent | Detroit Web Agency</title>
        <meta
          name="description"
          content="Permit, hiring, and capex signals from Metro Detroit industrial buyers. See 3 live anonymized signals — unlock full contact data from $99."
        />
        <link rel="canonical" href="https://detroitwebagent.com/growth-signals" />
      </Helmet>

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-16 md:py-24 text-center">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            <TrendingUp className="mr-1 h-3 w-3" /> Metro Detroit · Updated weekly
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">
            Stop cold-calling. <span className="text-primary">Start showing up where money is moving.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            We surface permit pulls, hiring spikes, and capex signals from Metro Detroit industrial buyers
            — before your competitors know they're in market.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-primary hover:bg-primary/90" onClick={() => handleCheckoutClick("hero_unlock")}>
              <Link to={checkoutUrl}>
                Unlock this week's signals — $99 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" onClick={() => handleCheckoutClick("hero_sample")}>
              <Link to={sampleUrl}>See free sample</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            <ShieldCheck className="inline h-3 w-3 mr-1" /> One-time snapshot. No subscription required.
          </p>
        </div>
      </section>

      {/* 3 Anonymized Signals */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">3 live signals from this week</h2>
          <p className="text-muted-foreground">Names and addresses redacted. Unlock to see full contact + decision-maker.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {SIGNALS.map((s, i) => {
            const Icon = s.icon;
            return (
              <Card key={i} className="p-6 relative overflow-hidden hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                    Confidence {s.confidence}/10
                  </Badge>
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  {s.vertical} · {s.age}
                </div>
                <h3 className="font-semibold text-lg mb-2 leading-snug">{s.headline}</h3>
                <p className="text-sm text-muted-foreground mb-4">{s.detail}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-3">
                  <Lock className="h-3 w-3" /> Region: {s.region}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90" onClick={() => handleCheckoutClick("signals_unlock")}>
            <Link to={checkoutUrl}>
              Unlock all 3 + 12 more this week <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-y border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-primary text-primary" />
              ))}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">Detroit operators are already closing</h2>
            <p className="text-muted-foreground">A few who've turned signals into signed contracts.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <Card key={i} className="p-6 bg-background">
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm mb-4 leading-relaxed">"{t.quote}"</p>
                <div className="text-sm">
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-muted-foreground text-xs">{t.role}</div>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-primary" /> Sourced from public records</span>
            <span>·</span>
            <span>Built in Grosse Pointe, MI</span>
            <span>·</span>
            <span>500+ signals processed weekly</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="text-3xl md:text-5xl font-bold mb-4">Your competitors are guessing. You don't have to.</h2>
        <p className="text-lg text-muted-foreground mb-8">
          One snapshot. 15+ signals. Full company names, decision-makers, phone, and email.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90" onClick={() => handleCheckoutClick("footer_unlock")}>
            <Link to={checkoutUrl}>
              Unlock this week — $99 <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" onClick={() => handleCheckoutClick("footer_firehose")}>
            <Link to={`/industrial-pulse?tier=firehose${utm ? `&${utm}` : ""}`}>
              Daily firehose — $199/mo
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          Questions? Text Matt directly: <a href="sms:+13139921219" className="text-primary hover:underline">(313) 992-1219</a>
        </p>
      </section>
    </div>
  );
}
