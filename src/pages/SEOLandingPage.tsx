import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Loader2, Dumbbell, ArrowLeft, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const SEOLandingPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["seo-landing", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seo_landing_pages")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
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
        <p className="text-muted-foreground text-center">This training page doesn't exist yet.</p>
        <Link to="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    );
  }

  /* Strip markdown code fences the AI sometimes wraps HTML in */
  let content = (page.main_content || "").trim();
  if (content.startsWith("```html")) content = content.replace(/^```html\s*/, "");
  if (content.startsWith("```")) content = content.replace(/^```\s*/, "");
  if (content.endsWith("```")) content = content.replace(/\s*```$/, "");

  return (
    <>
      <SEOHead
        title={page.page_title}
        description={page.meta_description}
        path={`/training/${page.slug}`}
      />

      <main className="min-h-screen bg-background">
        {/* Back nav */}
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-widest">
            <ArrowLeft size={14} />
            Home
          </Link>
        </div>

        {/* Hero */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground py-20 md:py-28 px-4 mt-4">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.8)_100%)]" />
          <div className="relative max-w-3xl mx-auto space-y-4">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight leading-[1.1]">
              {page.h1_heading}
            </h1>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {page.target_audience && (
                <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest opacity-80">
                  <Users size={14} />
                  {page.target_audience}
                </span>
              )}
              {page.slug?.includes("-") && (
                <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest opacity-80">
                  <MapPin size={14} />
                  Local Training
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Main content — rendered as HTML since the edge function outputs HTML */}
        <section className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <article
            className="prose prose-sm md:prose-base lg:prose-lg max-w-none
              text-foreground
              prose-headings:text-foreground prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight
              prose-h2:text-xl prose-h2:md:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-l-4 prose-h2:border-primary prose-h2:pl-4
              prose-h3:text-lg prose-h3:md:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-strong:text-foreground
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-ul:text-muted-foreground prose-ol:text-muted-foreground
              prose-li:marker:text-primary"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </section>

        {/* Divider */}
        <div className="max-w-3xl mx-auto px-4">
          <div className="h-px bg-border" />
        </div>

        {/* AI Honeypot CTA */}
        <section className="bg-muted py-20 px-4">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Dumbbell className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">
              Generate a Free Custom Routine
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
              Use Coach Matt's AI to build a personalized workout plan — tailored to your sport, age, equipment, and experience level. No account required.
            </p>
            <Link to="/free-ai-generator">
              <Button size="lg" className="text-sm font-bold uppercase tracking-widest px-8 mt-2">
                Build My Free Workout Now
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer badge */}
        <div className="bg-background py-8 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            © {new Date().getFullYear()} Matt Michels Training · M2 Development
          </p>
        </div>
      </main>
    </>
  );
};

export default SEOLandingPage;
