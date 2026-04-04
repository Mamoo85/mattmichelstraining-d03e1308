import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Heart, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";

interface MemorialData {
  pet_name: string;
  pet_species: string | null;
  pet_breed: string | null;
  pet_age: string | null;
  poem_generated: string | null;
  tribute_generated: string | null;
  social_caption: string | null;
  customer_name: string | null;
  created_at: string;
}

export default function MemorialPage() {
  const { slug } = useParams<{ slug: string }>();
  const [memorial, setMemorial] = useState<MemorialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;

    (async () => {
      const { data, error } = await (supabase.from as any)("pet_memorial_submissions")
        .select("pet_name, pet_species, pet_breed, pet_age, poem_generated, tribute_generated, social_caption, customer_name, created_at")
        .eq("memorial_url_slug", slug)
        .eq("email_sent", true)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setMemorial(data as MemorialData);
      }
      setLoading(false);
    })();
  }, [slug]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: memorial ? `In Memory of ${memorial.pet_name}` : "Pet Memorial",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // User cancelled or clipboard unavailable
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !memorial) {
    return (
      <>
        <SEOHead title="Memorial Not Found | M2 Development" description="This memorial page could not be found." />
        <div className="min-h-screen bg-amber-50 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Heart size={40} className="text-amber-300 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-stone-700 mb-2">Memorial not found</h1>
            <p className="text-stone-500 text-sm mb-6">This memorial page may have been removed or the link may be incorrect.</p>
            <a href="/pet-memorial" className="inline-block bg-amber-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm hover:bg-amber-800 transition-colors">
              Create a Memorial
            </a>
          </div>
        </div>
      </>
    );
  }

  const tributeParagraphs = memorial.tribute_generated
    ? memorial.tribute_generated.split(/\n\n+/).filter(Boolean)
    : [];

  const poemLines = memorial.poem_generated
    ? memorial.poem_generated.split(/\n/).filter(Boolean)
    : [];

  const metaDesc = memorial.tribute_generated
    ? memorial.tribute_generated.slice(0, 155)
    : `A memorial tribute for ${memorial.pet_name}.`;

  return (
    <>
      <SEOHead
        title={`In Memory of ${memorial.pet_name} | Pet Memorial`}
        description={metaDesc}
      />
      <div className="min-h-screen bg-amber-50">

        {/* Header */}
        <div className="bg-stone-800 text-amber-50 px-6 py-12 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-700/30 border border-amber-600/40 rounded-full px-4 py-1 mb-5">
            <Heart size={12} className="text-amber-400" />
            <span className="text-amber-300 text-xs font-bold uppercase tracking-widest">In Loving Memory</span>
          </div>
          <h1 className="text-4xl font-black font-serif text-amber-50 mb-3">
            {memorial.pet_name}
          </h1>
          {(memorial.pet_breed || memorial.pet_species) && (
            <p className="text-amber-300 text-sm mb-1">
              {[memorial.pet_breed, memorial.pet_species].filter(Boolean).join(" · ")}
            </p>
          )}
          {memorial.pet_age && (
            <p className="text-amber-400/70 text-xs">{memorial.pet_age}</p>
          )}
          <button
            onClick={handleShare}
            className="mt-6 inline-flex items-center gap-2 border border-amber-600/40 text-amber-300 text-xs font-bold px-4 py-2 rounded-full hover:bg-amber-700/20 transition-colors"
          >
            <Share2 size={12} />
            {copied ? "Link copied!" : "Share this memorial"}
          </button>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">

          {/* Poem */}
          {poemLines.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-5 flex items-center gap-2">
                <span className="w-6 h-px bg-amber-400 inline-block" />
                A Poem from {memorial.pet_name}
                <span className="w-6 h-px bg-amber-400 inline-block" />
              </h2>
              <blockquote className="bg-white border-l-4 border-amber-500 rounded-r-xl px-6 py-6 shadow-sm">
                {poemLines.map((line, i) => (
                  <p
                    key={i}
                    className="font-serif italic text-stone-700 text-base leading-loose mb-0"
                  >
                    {line}
                  </p>
                ))}
              </blockquote>
            </section>
          )}

          {/* Tribute */}
          {tributeParagraphs.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-5 flex items-center gap-2">
                <span className="w-6 h-px bg-amber-400 inline-block" />
                A Tribute to {memorial.pet_name}
                <span className="w-6 h-px bg-amber-400 inline-block" />
              </h2>
              <div className="space-y-4">
                {tributeParagraphs.map((para, i) => (
                  <p key={i} className="text-stone-700 text-base leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          )}

          {/* Social Caption */}
          {memorial.social_caption && (
            <section className="bg-amber-100 border border-amber-200 rounded-xl px-6 py-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-amber-700 mb-3">
                Share on Social Media
              </h3>
              <p className="text-stone-700 text-sm leading-relaxed">{memorial.social_caption}</p>
            </section>
          )}

          {/* Share CTA */}
          <div className="text-center pt-2 pb-8">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 bg-stone-800 text-amber-50 font-bold px-6 py-3 rounded-lg hover:bg-stone-700 transition-colors text-sm"
            >
              <Share2 size={15} />
              {copied ? "Link copied to clipboard!" : `Share ${memorial.pet_name}'s Memorial`}
            </button>
            <p className="text-xs text-stone-400 mt-3">
              Created with love by{" "}
              <a href="/pet-memorial" className="text-amber-600 hover:underline">
                M2 Pet Memorial Service
              </a>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
