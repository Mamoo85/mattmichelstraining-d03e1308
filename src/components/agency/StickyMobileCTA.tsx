import { useState, useEffect } from "react";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

const StickyMobileCTA = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("agency-hero");
    if (!hero) { setVisible(true); return; }

    const obs = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(hero);
    return () => obs.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden p-3 flex gap-2" style={{ background: "rgba(10,10,15,0.97)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(34,211,238,0.15)" }}>
      <Button asChild className="flex-1 py-5 font-bold text-sm rounded-lg" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617" }}>
        <a href="tel:+13138064952">
          <Phone className="mr-2 h-4 w-4" /> Call Now
        </a>
      </Button>
      <Button asChild className="flex-1 py-5 font-bold text-sm rounded-lg" style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)" }}>
        <a href="#get-quote">
          Get a Quote <ArrowRight className="ml-1 h-4 w-4" />
        </a>
      </Button>
    </div>
  );
};

export default StickyMobileCTA;
