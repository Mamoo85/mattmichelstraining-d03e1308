import { Quote } from "lucide-react";
import { useContentMap } from "@/hooks/useSiteContent";

/* ─────────────────────────────────────────────
   Default testimonial — overridden by CMS when
   Matt updates via Admin → System & Referrals.
   ───────────────────────────────────────────── */
const DEFAULT_QUOTE =
  "Coach Matt didn't just make my son stronger for hockey season; he completely fixed the knee pain we'd been dealing with for two years. This isn't just a workout app; it's an insurance policy for your kid's athletic career.";
const DEFAULT_AUTHOR = "Sarah M., Grosse Pointe Parent";

const ParentTestimonialCard = () => {
  const { content: cms } = useContentMap("welcome_page");
  const quote = cms.testimonial_quote || DEFAULT_QUOTE;
  const author = cms.testimonial_author || DEFAULT_AUTHOR;
  const authorInitial = author.charAt(0);
  const [name, location] = author.includes(",") ? author.split(",").map((s: string) => s.trim()) : [author, ""];

  return (
    <div className="bg-card border border-border shadow-m2 p-6 md:p-8 relative">
      <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/20" />
      <p className="text-sm md:text-base text-foreground-soft leading-relaxed italic mb-4 pr-8">
        "{quote}"
      </p>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs">
          {authorInitial}
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">{name}</p>
          {location && <p className="text-[10px] text-muted-foreground">{location}</p>}
        </div>
      </div>
    </div>
  );
};

export default ParentTestimonialCard;
