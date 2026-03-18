import { Quote } from "lucide-react";

/* ─────────────────────────────────────────────
   Editable testimonial — swap quote, author,
   and location when Matt has a real one ready.
   ───────────────────────────────────────────── */
const TESTIMONIAL = {
  quote:
    "Coach Matt didn't just make my son stronger for hockey season; he completely fixed the knee pain we'd been dealing with for two years. This isn't just a workout app; it's an insurance policy for your kid's athletic career.",
  author: "Sarah M.",
  location: "Grosse Pointe Parent",
};

const ParentTestimonialCard = () => (
  <div className="bg-card border border-border shadow-m2 p-6 md:p-8 relative">
    <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/20" />
    <p className="text-sm md:text-base text-foreground-soft leading-relaxed italic mb-4 pr-8">
      "{TESTIMONIAL.quote}"
    </p>
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs">
        {TESTIMONIAL.author.charAt(0)}
      </div>
      <div>
        <p className="text-xs font-bold text-foreground">{TESTIMONIAL.author}</p>
        <p className="text-[10px] text-muted-foreground">{TESTIMONIAL.location}</p>
      </div>
    </div>
  </div>
);

export default ParentTestimonialCard;
