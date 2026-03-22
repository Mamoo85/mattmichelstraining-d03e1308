import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import ReactMarkdown from "react-markdown";
import { Loader2, Dumbbell } from "lucide-react";
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

  return (
    <>
      <SEOHead
        title={page.page_title}
        description={page.meta_description}
        path={`/training/${page.slug}`}
      />

      <main className="min-h-screen bg-background">
        {/* Hero heading */}
        <section className="bg-primary text-primary-foreground py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-tight">
              {page.h1_heading}
            </h1>
            {page.target_audience && (
              <p className="mt-4 text-sm uppercase tracking-widest opacity-80">
                Built for: {page.target_audience}
              </p>
            )}
          </div>
        </section>

        {/* Main content */}
        <section className="max-w-3xl mx-auto px-4 py-12">
          <article className="prose prose-sm md:prose-base max-w-none text-foreground prose-headings:text-foreground prose-a:text-primary">
            <ReactMarkdown>{page.main_content}</ReactMarkdown>
          </article>
        </section>

        {/* AI Honeypot CTA */}
        <section className="border-t border-border bg-muted py-16 px-4">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <Dumbbell className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-foreground">
              Generate a Free Custom Routine for This Exact Goal
            </h2>
            <p className="text-muted-foreground text-sm max-w-lg mx-auto">
              Use Coach Matt's AI to build a personalized workout plan — tailored to your sport, age, equipment, and experience level. No account required.
            </p>
            <Link to="/free-ai-generator">
              <Button size="lg" className="text-sm font-bold uppercase tracking-widest px-8">
                Build My Free Workout Now
              </Button>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default SEOLandingPage;
