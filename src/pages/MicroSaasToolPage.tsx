import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Shield, Zap, Clock } from "lucide-react";

interface MicroSaasTool {
  id: string;
  slug: string;
  h1_headline: string;
  seo_meta_title: string;
  seo_meta_description: string;
  target_audience: string;
  core_pain_point: string;
  monthly_price: number;
  stripe_checkout_url: string | null;
  stripe_price_id: string | null;
  features_json: string[];
  category: string;
}

const MicroSaasToolPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [tool, setTool] = useState<MicroSaasTool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTool = async () => {
      const { data, error } = await supabase
        .from("micro_saas_tools")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (!error && data) {
        setTool(data as unknown as MicroSaasTool);
      }
      setLoading(false);
    };
    if (slug) fetchTool();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-bold text-foreground">Service Not Found</h1>
        <p className="text-muted-foreground">This service is no longer available.</p>
        <Link to="/all-services">
          <Button>View All Services</Button>
        </Link>
      </div>
    );
  }

  const priceDisplay = tool.monthly_price > 0
    ? `$${(tool.monthly_price / 100).toFixed(0)}/mo`
    : "Free";

  const features = Array.isArray(tool.features_json) ? tool.features_json : [];

  return (
    <>
      <SEOHead
        title={tool.seo_meta_title}
        description={tool.seo_meta_description}
      />
      <div className="min-h-screen bg-[#0f172a] text-white">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#e8621a]/20 via-transparent to-[#1e293b]" />
          <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">
            <div className="inline-flex items-center gap-2 bg-[#e8621a]/10 border border-[#e8621a]/30 text-[#e8621a] px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              {tool.category.replace(/_/g, " ").toUpperCase()}
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-6">
              {tool.h1_headline}
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
              {tool.core_pain_point}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={tool.stripe_checkout_url || "/contact"}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="lg" className="bg-[#e8621a] hover:bg-[#d4570f] text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-[#e8621a]/25">
                  Start for {priceDisplay} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </a>
              <span className="text-slate-400 text-sm">Cancel anytime · No contracts</span>
            </div>
          </div>
        </section>

        {/* Pain Point */}
        <section className="bg-[#1e293b] py-16 border-y border-slate-700/50">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Who This Is For</h2>
            <p className="text-lg text-slate-300">{tool.target_audience}</p>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 md:py-24">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">What You Get</h2>
            <div className="space-y-4">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 bg-slate-800/50 border border-slate-700/50 rounded-xl p-5"
                >
                  <CheckCircle className="w-6 h-6 text-[#e8621a] flex-shrink-0 mt-0.5" />
                  <span className="text-lg text-slate-200">{String(feature)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="bg-[#1e293b] py-12 border-y border-slate-700/50">
          <div className="max-w-4xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Shield className="w-8 h-8 text-[#e8621a]" />
              <span className="font-semibold">No Contracts</span>
              <span className="text-sm text-slate-400">Cancel with one click</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Clock className="w-8 h-8 text-[#e8621a]" />
              <span className="font-semibold">Live in 24 Hours</span>
              <span className="text-sm text-slate-400">We set everything up for you</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Zap className="w-8 h-8 text-[#e8621a]" />
              <span className="font-semibold">Fully Automated</span>
              <span className="text-sm text-slate-400">Zero manual work required</span>
            </div>
          </div>
        </section>

        {/* Sticky CTA */}
        <section className="py-16 md:py-24">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-slate-300 mb-8">
              Join local businesses across Metro Detroit who are already using this service to grow.
            </p>
            <a
              href={tool.stripe_checkout_url || "/contact"}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="bg-[#e8621a] hover:bg-[#d4570f] text-white text-lg px-10 py-6 rounded-xl shadow-lg shadow-[#e8621a]/25">
                Start for {priceDisplay} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-[#0f172a] border-t border-slate-800 py-8">
          <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500">
            <p>M2 Development · Matt Michels · Grosse Pointe, MI · (313) 806-4952</p>
            <p className="mt-2">
              <Link to="/" className="text-slate-400 hover:text-white">Home</Link>
              {" · "}
              <Link to="/all-services" className="text-slate-400 hover:text-white">All Services</Link>
              {" · "}
              <a href="mailto:matt@mattmichelstraining.com" className="text-slate-400 hover:text-white">Contact</a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default MicroSaasToolPage;
