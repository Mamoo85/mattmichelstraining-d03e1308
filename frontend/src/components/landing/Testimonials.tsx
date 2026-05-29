import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Testimonial {
  id: string;
  quote: string;
  author_name: string;
  author_role: string;
  author_initials: string;
  sport: string | null;
}

const FALLBACK = [
  {
    id: "f2",
    quote: "I've worked with online coaches before and they send you a PDF and disappear. Matt actually watches my videos, replies the same day, and adjusts my program. It's not even close to the same thing.",
    author_name: "Jake R.",
    author_role: "College Athlete · Remote",
    author_initials: "JR",
    sport: "Football",
  },
  {
    id: "f3",
    quote: "We were spending $200/month on a trainer who had our daughter doing the same exercises as adults. Matt's youth program is age-appropriate, affordable, and she actually enjoys it.",
    author_name: "Lisa & Tom K.",
    author_role: "Parents · St. Clair Shores",
    author_initials: "LT",
    sport: "Soccer",
  },
];

const Testimonials = ({ page = "home" }: { page?: string }) => {
  const { data: cmsTestimonials } = useQuery({
    queryKey: ["testimonials", page],
    queryFn: async () => {
      const { data } = await supabase
        .from("testimonials" as any)
        .select("id, quote, author_name, author_role, author_initials, sport")
        .eq("page", page)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return (data || []) as unknown as Testimonial[];
    },
    staleTime: 5 * 60_000,
  });

  const items = cmsTestimonials && cmsTestimonials.length > 0 ? cmsTestimonials : FALLBACK;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="mb-10"
    >
      <div className="mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
          What Parents & Athletes Say
        </span>
        <h2 className="text-lg md:text-xl font-bold text-foreground">
          Real results from real families
        </h2>
      </div>

      <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-3 md:gap-4">
        {items.map((t) => (
          <div key={t.id} className="bg-card shadow-m2 p-5 flex flex-col">
            <Quote size={18} className="text-primary/40 mb-2" />
            <p className="text-sm text-muted-foreground leading-relaxed flex-1 italic">
              "{t.quote}"
            </p>
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center gap-1 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={10} className="text-primary fill-primary" />
                ))}
              </div>
              <span className="text-xs font-bold text-foreground block">{t.author_name}</span>
              <span className="text-[10px] text-muted-foreground">{t.author_role}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default Testimonials;
