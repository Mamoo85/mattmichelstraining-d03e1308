import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Loader2, Phone, Mail, ArrowRight, Star, ChevronDown, ChevronUp, Shield, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface PageData {
  title: string;
  metaDescription: string;
  heroHeadline: string;
  heroSubtext: string;
  serviceBullets: string[];
  faqs: { q: string; a: string }[];
  ctaText: string;
}

const ContractorSeoPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["contractor-seo", slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seo_page_configs")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; trade: string; city: string; slug: string; page_data: PageData } | null;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold text-foreground">Page Not Found</h1>
        <p className="text-muted-foreground">This service page doesn't exist yet.</p>
        <Link to="/web-design-services"><Button variant="outline">View Our Services</Button></Link>
      </div>
    );
  }

  const d = page.page_data;
  const phoneNumber = "(313) 806-4952";
  const emailAddress = "matt@mattmichelstraining.com";
  const category = (page as any).category || "contractor";

  const ctaLinks: Record<string, { primary: string; label: string }> = {
    contractor: { primary: "/web-design-services", label: "View Pricing" },
    webdesign: { primary: "/web-design-services", label: "View Packages" },
    personal_training: { primary: "/programs", label: "View Programs" },
    coaching: { primary: "/performance-coaching", label: "Start Coaching" },
  };
  const cta = ctaLinks[category] || ctaLinks.contractor;

  const whyCards: Record<string, { icon: string; title: string; desc: string }[]> = {
    contractor: [
      { icon: "🚀", title: "AI-Powered Websites", desc: "We build high-converting sites with AI automation — your website works 24/7 generating leads." },
      { icon: "📍", title: `Local ${page.city} Expertise`, desc: `We understand the ${page.city} market and build sites that rank for local "${page.trade}" searches.` },
      { icon: "💰", title: "ROI-Focused", desc: "Every site comes with SEO, lead capture forms, and optional add-ons like review management and Google Ads." },
    ],
    webdesign: [
      { icon: "🎨", title: "Industry-Specific Design", desc: `Custom templates built for ${page.trade.toLowerCase()} businesses — not generic cookie-cutter sites.` },
      { icon: "📱", title: "Mobile-First", desc: "Over 70% of local searches happen on mobile. Every site we build is responsive and fast." },
      { icon: "🔍", title: "Built-In SEO", desc: `Rank higher in ${page.city} for "${page.trade}" searches with our SEO-optimized architecture.` },
    ],
    personal_training: [
      { icon: "💪", title: "Evidence-Based Methods", desc: "Programs built on sports science and biomechanics — not trends." },
      { icon: "📊", title: "Progress Tracking", desc: "Track every rep, every set, every PR with our built-in logging system." },
      { icon: "🏆", title: "Proven Results", desc: `Athletes and clients across ${page.city} are getting stronger, faster, and more resilient.` },
    ],
    coaching: [
      { icon: "🎯", title: "Goal-Driven Framework", desc: "Structured accountability with weekly check-ins and measurable milestones." },
      { icon: "💻", title: "100% Virtual", desc: "Coaching via video calls and async messaging — fits your schedule, anywhere." },
      { icon: "🔥", title: "Real Transformation", desc: `Helping ${page.city} professionals break through plateaus and level up.` },
    ],
  };
  const cards = whyCards[category] || whyCards.contractor;

  return (
    <>
      <SEOHead
        title={d.title}
        description={d.metaDescription}
        path={`/services/${page.slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: `${page.trade} Web Design in ${page.city}`,
          description: d.metaDescription,
          provider: {
            "@type": "Organization",
            name: "M2 Development",
            url: "https://www.mattmichelstraining.com",
            telephone: phoneNumber,
            email: emailAddress,
            areaServed: page.city,
          },
          areaServed: { "@type": "City", name: page.city },
        }}
      />

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-[#1e293b] to-[#0f172a] text-white py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6">
              <MapPin className="h-4 w-4 text-[#e8621a]" />
              <span>{page.city}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">{d.heroHeadline}</h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">{d.heroSubtext}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={`tel:${phoneNumber.replace(/\D/g, "")}`}>
                <Button size="lg" className="bg-[#e8621a] hover:bg-[#d4570f] text-white text-lg px-8 py-6 w-full sm:w-auto">
                  <Phone className="h-5 w-5 mr-2" /> {d.ctaText || "Get a Free Quote"}
                </Button>
              </a>
              <a href={`mailto:${emailAddress}`}>
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6 w-full sm:w-auto">
                  <Mail className="h-5 w-5 mr-2" /> Email Us
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="bg-[#e8621a] py-4">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-6 md:gap-12 text-white text-sm font-medium px-4">
            <div className="flex items-center gap-2"><Shield className="h-4 w-4" /> Licensed & Insured</div>
            <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> Fast Turnaround</div>
            <div className="flex items-center gap-2"><Star className="h-4 w-4" /> 5-Star Rated</div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Serving {page.city}</div>
          </div>
        </section>

        {/* Services */}
        {d.serviceBullets?.length > 0 && (
          <section className="py-16 px-4 bg-muted/30">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-10">
                {category === "contractor" ? `${page.trade} Services We Build Websites For` :
                 category === "webdesign" ? `Web Design for ${page.trade} Businesses` :
                 category === "personal_training" ? `${page.trade} Training Services` :
                 `${page.trade} Services`}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {d.serviceBullets.map((bullet, i) => (
                  <div key={i} className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <ArrowRight className="h-5 w-5 text-[#e8621a] mt-0.5 shrink-0" />
                      <span className="text-foreground">{bullet}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Why M2 */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-6">
              {category === "contractor" ? `Why ${page.city} ${page.trade} Businesses Choose M2` :
               category === "webdesign" ? `Why ${page.trade} Businesses in ${page.city} Choose M2` :
               category === "personal_training" ? `Why ${page.city} Clients Choose M2 Training` :
               `Why ${page.city} Clients Choose M2 Coaching`}
            </h2>
            <div className="grid gap-6 sm:grid-cols-3 mt-10">
              {cards.map((item, i) => (
                <div key={i} className="text-center p-6 rounded-xl bg-card border border-border">
                  <span className="text-4xl block mb-4">{item.icon}</span>
                  <h3 className="font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        {d.faqs?.length > 0 && (
          <section className="py-16 px-4 bg-muted/30">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-10">
                Frequently Asked Questions
              </h2>
              <div className="space-y-3">
                {d.faqs.map((faq, i) => (
                  <div key={i} className="border border-border rounded-lg overflow-hidden bg-card">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between p-4 text-left font-medium text-foreground hover:bg-muted/50"
                    >
                      {faq.q}
                      {openFaq === i ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    </button>
                    {openFaq === i && (
                      <div className="px-4 pb-4 text-sm text-muted-foreground">{faq.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Final CTA */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#1e293b] to-[#0f172a] text-white text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              {category === "personal_training" ? `Ready to Transform Your Fitness in ${page.city}?` :
               category === "coaching" ? `Ready to Level Up in ${page.city}?` :
               `Ready to Dominate ${page.city} Online?`}
            </h2>
            <p className="text-lg text-white/80 mb-8">
              {category === "personal_training" ? `Start your ${page.trade.toLowerCase()} journey with a certified trainer today.` :
               category === "coaching" ? `Book your free ${page.trade.toLowerCase()} discovery call today.` :
               `Get a professional website that generates leads for your ${page.trade.toLowerCase()} business — starting at $499.`}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href={`tel:${phoneNumber.replace(/\D/g, "")}`}>
                <Button size="lg" className="bg-[#e8621a] hover:bg-[#d4570f] text-white text-lg px-8 py-6 w-full sm:w-auto">
                  <Phone className="h-5 w-5 mr-2" /> Call {phoneNumber}
                </Button>
              </a>
              <Link to={cta.primary}>
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6 w-full sm:w-auto">
                  {cta.label}
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-6 px-4 text-center text-xs text-muted-foreground bg-muted/20">
          <p>© {new Date().getFullYear()} M2 Development — Web Design & AI Marketing for Local Businesses</p>
          <p className="mt-1">
            <Link to="/web-design-services" className="text-[#e8621a] hover:underline">Web Design Services</Link>
            {" · "}
            <Link to="/all-services" className="text-[#e8621a] hover:underline">All Services</Link>
            {" · "}
            <Link to="/" className="text-[#e8621a] hover:underline">Home</Link>
          </p>
        </footer>
      </div>
    </>
  );
};

export default ContractorSeoPage;
