import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import AppNavbar from "@/components/layout/AppNavbar";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHECKLIST = [
  "Professional copywriting for every page",
  "Mobile-first responsive design",
  "Custom contact / quote request form",
  "Google Business Profile optimization",
  "Google Maps embed with your location",
  "Click-to-call & click-to-text buttons",
  "SSL certificate & fast hosting included",
  "Domain connection — you keep your domain",
  "SEO meta tags & Google indexing",
  "1 round of revisions after launch",
  "Site live in 7 days or less",
  "$49/mo ongoing — hosting, updates, text & image changes",
];

const WebDesignIncluded = () => (
  <>
    <SEOHead
      title="What's Included for $499 | M2 Web Design Detroit"
      description="Exactly what you get when you hire Matt Michels to build your local business website. Copywriting, mobile design, hosting, SEO, and more — all for $499 flat."
      path="/whats-included"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "What's Included — M2 Web Design",
        description: "Full breakdown of the $499 web design package for local businesses in Metro Detroit.",
        url: "https://www.mattmichelstraining.com/whats-included",
      }}
    />
    <AppNavbar />

    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-widest uppercase mb-6">
            No Hidden Fees
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-[1.1] mb-4">
            Here's Exactly What You Get{" "}
            <span className="text-primary">for $499.</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
            One flat fee. One local developer. Everything your business needs to start getting leads online.
          </p>
        </div>
      </section>

      {/* Checklist */}
      <section className="px-4 pb-20">
        <div className="max-w-xl mx-auto space-y-4">
          {CHECKLIST.map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 p-4 border border-border/40 bg-card/60 rounded-lg"
            >
              <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm font-medium text-foreground leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Ready? Let's talk.</h2>
          <p className="text-muted-foreground text-sm mb-6">
            No contracts. No pressure. Just a conversation about your business.
          </p>
          <Button asChild size="lg" className="px-8 py-6 text-base rounded-xl shadow-lg shadow-primary/20">
            <Link to="/detroit-web-design">
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8 px-4 text-center">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Matt Michels · Grosse Pointe, MI</p>
      </footer>
    </div>
  </>
);

export default WebDesignIncluded;
