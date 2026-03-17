import { useState } from "react";
import { FileText, Loader2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Guide {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  priceId: string;
  description: string;
  includes: string[];
}

const GUIDES: Guide[] = [
  {
    id: "baseball-5",
    title: "Top 5 Exercises for Baseball Players",
    subtitle: "Rotational power, arm health, and explosiveness",
    price: "$9",
    priceId: "price_1TBWRjD52tPWee464JrSieCi",
    description: "I've trained baseball players for two decades. These are the five movements that actually translate to the field — rotational power, arm health, hip mobility.",
    includes: ["5 exercises with full breakdowns", "Sets, reps, and rest periods", "The WHY behind each movement", "Warm-up protocol included"],
  },
  {
    id: "football-5",
    title: "Top 5 Exercises for Football",
    subtitle: "Power, speed, and collision prep",
    price: "$9",
    priceId: "price_1TBWRzD52tPWee46IQxgPosm",
    description: "Football is about power off the line and a body that can take contact without breaking. These five exercises build explosive hips, a bulletproof core, and durability.",
    includes: ["Position-relevant exercises", "Power development focus", "The WHY behind each movement", "Injury prevention notes"],
  },
  {
    id: "basketball-5",
    title: "Top 5 Exercises for Basketball",
    subtitle: "Vertical power, knee health, and agility",
    price: "$9",
    priceId: "price_1TBWSgD52tPWee46vmwnXiHe",
    description: "Every basketball parent asks about vertical. Here's the truth — you can't jump higher if your knees can't handle the landing. This guide builds elastic power AND protects the joints.",
    includes: ["Vertical power exercises", "Knee health protocols", "The WHY behind each movement", "In-season maintenance plan"],
  },
  {
    id: "hockey-5",
    title: "Hockey Strength Essentials",
    subtitle: "Edge work, hip power, and durability",
    price: "$9",
    priceId: "price_1TBWSxD52tPWee465QPmHaTK",
    description: "Hockey is the most demanding youth sport. This guide covers posterior chain work, single-leg stability, and core bracing that turns skaters into forces.",
    includes: ["Sport-specific exercises", "In-season vs off-season guidance", "The WHY behind each movement", "Recovery protocol"],
  },
  {
    id: "soccer-5",
    title: "Top 5 Exercises for Soccer",
    subtitle: "Endurance, hip mobility, and single-leg power",
    price: "$9",
    priceId: "price_1TBWTFD52tPWee46fh1GttaO",
    description: "Soccer kids run for 90 minutes on one leg at a time. This guide is built around single-leg strength, hip mobility, and the endurance base for the 80th minute.",
    includes: ["Single-leg focused exercises", "Hip mobility work", "The WHY behind each movement", "Game-day prep protocol"],
  },
  {
    id: "lacrosse-5",
    title: "Top 5 Exercises for Lacrosse",
    subtitle: "Shoulder stability, speed, and contact prep",
    price: "$9",
    priceId: "price_1TBWTVD52tPWee46MSdo6gXX",
    description: "Lacrosse beats up shoulders and demands sprint speed. These exercises build shoulder durability, explosive change of direction, and a frame that handles contact.",
    includes: ["Shoulder stability work", "Sprint mechanics", "The WHY behind each movement", "Contact preparation"],
  },
  {
    id: "pregnancy-10",
    title: "Top 10 Exercises: Pre & Post Pregnancy",
    subtitle: "Safe strength for every stage",
    price: "$12",
    priceId: "price_1TBWTmD52tPWee46FaB1wcFz",
    description: "Ten exercises that are safe, effective, and backed by the kinesiology — for every trimester and beyond.",
    includes: ["10 exercises with trimester guidance", "Post-partum rebuilding protocol", "The WHY behind each movement", "What to avoid and when"],
  },
  {
    id: "youth-starter",
    title: "Youth Athlete Starter Guide",
    subtitle: "The foundation every young athlete needs",
    price: "$12",
    priceId: "price_1TBWU1D52tPWee46qnvE9Zrv",
    description: "Movement quality first, then work capacity, then strength. Four weeks of building the foundation that prevents injuries for life.",
    includes: ["Full 4-week starter program", "Movement quality checklist", "The WHY behind the system", "Parent guide included"],
  },
];

const PdfGuides = () => {
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleBuy = async (guide: Guide) => {
    if (!user) {
      window.location.href = `/auth?redirect=/shop`;
      return;
    }
    setBuyingId(guide.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-guide-payment", {
        body: { priceId: guide.priceId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div>
      {/* Description */}
      <div className="bg-primary/10 border border-primary/20 p-4 mb-6">
        <p className="text-sm text-foreground leading-relaxed">
          Quick-hit, $9 foundational blueprints. These are static PDF guides designed to teach you the WHY behind specific movements and give you a standalone arsenal of exercises.
        </p>
      </div>

      {/* Guide grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {GUIDES.map((guide) => (
          <div
            key={guide.id}
            className="bg-card shadow-m2 p-4 flex flex-col hover:bg-accent/50 transition-m2 cursor-pointer"
            onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">PDF Guide</span>
              <span className="text-lg font-mono font-bold text-primary">{guide.price}</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">{guide.title}</h3>
            <p className="text-[11px] text-muted-foreground mb-2">{guide.subtitle}</p>

            {expandedGuide === guide.id && (
              <div className="mt-2 pt-2 border-t border-border space-y-2">
                <p className="text-xs text-foreground leading-relaxed">{guide.description}</p>
                <div className="space-y-1">
                  {guide.includes.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="text-primary font-bold mt-0.5">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-3">
              <button
                onClick={(e) => { e.stopPropagation(); handleBuy(guide); }}
                disabled={buyingId === guide.id}
                className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-1.5 w-full justify-center disabled:opacity-50"
              >
                {buyingId === guide.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileText size={12} />
                )}
                Buy Guide · {guide.price}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PdfGuides;
