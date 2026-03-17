import { useState } from "react";
import { ShoppingBag, FileText, Loader2 } from "lucide-react";
import SectionHeader from "./SectionHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useContentMap } from "@/hooks/useSiteContent";

interface Product {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  priceId: string;
  tag: string;
  category: string;
  description: string;
  includes: string[];
}

const PRODUCTS: Product[] = [
  {
    id: "baseball-5",
    title: "Top 5 Exercises for Baseball Players",
    subtitle: "Rotational power, arm health, and explosiveness",
    price: "$9",
    priceId: "price_1TBWRjD52tPWee464JrSieCi",
    tag: "PDF GUIDE",
    category: "sport",
    description: "I've trained baseball players for two decades. These are the five movements that actually translate to the field — rotational power, arm health, hip mobility. Not the stuff you see on Instagram. The stuff that works.",
    includes: ["5 exercises with full breakdowns", "Sets, reps, and rest periods", "The WHY behind each movement", "Warm-up protocol included"],
  },
  {
    id: "football-5",
    title: "Top 5 Exercises for Football",
    subtitle: "Power, speed, and collision prep",
    price: "$9",
    priceId: "price_1TBWRzD52tPWee46IQxgPosm",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Football is about power off the line and a body that can take contact without breaking. These five exercises build explosive hips, a bulletproof core, and the kind of durability that keeps them on the field all season.",
    includes: ["Position-relevant exercises", "Power development focus", "The WHY behind each movement", "Injury prevention notes"],
  },
  {
    id: "basketball-5",
    title: "Top 5 Exercises for Basketball",
    subtitle: "Vertical power, knee health, and agility",
    price: "$9",
    priceId: "price_1TBWSgD52tPWee46vmwnXiHe",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Every basketball parent asks me about vertical. Here's the truth — you can't jump higher if your knees can't handle the landing. This guide builds elastic power AND protects the joints.",
    includes: ["Vertical power exercises", "Knee health protocols", "The WHY behind each movement", "In-season maintenance plan"],
  },
  {
    id: "hockey-5",
    title: "Hockey Strength Essentials",
    subtitle: "Edge work, hip power, and durability",
    price: "$9",
    priceId: "price_1TBWSxD52tPWee465QPmHaTK",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Hockey is the most physically demanding youth sport, period. This guide covers the posterior chain work, single-leg stability, and core bracing that turns skaters into forces.",
    includes: ["Sport-specific exercises", "In-season vs off-season guidance", "The WHY behind each movement", "Recovery protocol"],
  },
  {
    id: "soccer-5",
    title: "Top 5 Exercises for Soccer",
    subtitle: "Endurance, hip mobility, and single-leg power",
    price: "$9",
    priceId: "price_1TBWTFD52tPWee46fh1GttaO",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Soccer kids run for 90 minutes on one leg at a time — that's the reality. This guide is built around single-leg strength, hip mobility, and the endurance base that keeps them sharp in the 80th minute.",
    includes: ["Single-leg focused exercises", "Hip mobility work", "The WHY behind each movement", "Game-day prep protocol"],
  },
  {
    id: "lacrosse-5",
    title: "Top 5 Exercises for Lacrosse",
    subtitle: "Shoulder stability, speed, and contact prep",
    price: "$9",
    priceId: "price_1TBWTVD52tPWee46MSdo6gXX",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Lacrosse beats up shoulders and demands sprint speed in transition. These five exercises build shoulder durability for stick work, explosive change of direction, and a frame that handles contact.",
    includes: ["Shoulder stability work", "Sprint mechanics", "The WHY behind each movement", "Contact preparation"],
  },
  {
    id: "pregnancy-10",
    title: "Top 10 Exercises: Pre & Post Pregnancy",
    subtitle: "Safe strength for every stage",
    price: "$12",
    priceId: "price_1TBWTmD52tPWee46FaB1wcFz",
    tag: "PDF GUIDE",
    category: "wellness",
    description: "This one's personal. I wrote it for the moms who trained with me and asked 'what can I do now?' Ten exercises that are safe, effective, and backed by the kinesiology.",
    includes: ["10 exercises with trimester guidance", "Post-partum rebuilding protocol", "The WHY behind each movement", "What to avoid and when"],
  },
  {
    id: "youth-starter",
    title: "Youth Athlete Starter Guide",
    subtitle: "The foundation every young athlete needs",
    price: "$12",
    priceId: "price_1TBWU1D52tPWee46qnvE9Zrv",
    tag: "PDF GUIDE",
    category: "foundation",
    description: "This is the exact program I give every new young athlete who walks through my door. Movement quality first, then work capacity, then strength. Four weeks of building the foundation that prevents injuries for life.",
    includes: ["Full 4-week starter program", "Movement quality checklist", "The WHY behind the system", "Parent guide included"],
  },
  {
    id: "custom-program",
    title: "Your Custom Program",
    subtitle: "Matt reads your intake and builds it from scratch",
    price: "$20",
    priceId: "price_1TAvVYD52tPWee46eudNwrb6",
    tag: "CUSTOM · BUILT BY MATT",
    category: "custom",
    description: "You fill out the intake. I read every word. Then I build your program from scratch — your goals, your equipment, your level. No templates. No AI. Just me, a notebook, and 20 years of doing this.",
    includes: ["Fully custom program", "Coaching cues on every movement", "The WHY behind every choice", "Matt's guarantee: fix it or refund"],
  },
];

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "sport", label: "By Sport" },
  { key: "wellness", label: "Wellness" },
  { key: "foundation", label: "Foundation" },
  { key: "custom", label: "Custom" },
];

const ShopGrid = ({ showCustomOnly = false }: { showCustomOnly?: boolean }) => {
  const [selectedCategory, setSelectedCategory] = useState(showCustomOnly ? "custom" : "all");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { content: cms } = useContentMap("shop_products");

  const filtered = showCustomOnly
    ? PRODUCTS.filter((p) => p.category === "custom")
    : selectedCategory === "all"
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === selectedCategory);

  const handleBuy = async (product: Product) => {
    if (!user) {
      window.location.href = `/auth?redirect=/shop`;
      return;
    }
    setBuyingId(product.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-guide-payment", {
        body: { priceId: product.priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div>
      <SectionHeader title="M² Guides & Programs" timestamp="20+ years of knowledge · No camera required" />

      {/* Value hook */}
      <div className="bg-primary/10 border border-primary/20 shadow-m2 p-4 mb-6">
        <p className="text-sm text-foreground text-balance leading-relaxed">
          <span className="font-bold">"</span>{cms.value_hook || "I can only train so many athletes in person. But I can share what I know. Every guide teaches the WHY — not just what to do. When they understand why, they do it better. 100% of the time."}<span className="font-bold">"</span>
        </p>
        <span className="text-[10px] font-mono text-primary mt-2 block">— Matt Michels, M² Training</span>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setSelectedCategory(c.key)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
              selectedCategory === c.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="bg-card shadow-m2 p-4 flex flex-col hover:bg-m2-surface-hover transition-m2 cursor-pointer"
            onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{product.tag}</span>
              <span className="text-lg font-mono font-bold text-primary">{product.price}</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">{product.title}</h3>
            <p className="text-[11px] text-muted-foreground mb-2">{product.subtitle}</p>

            {expandedProduct === product.id && (
              <div className="mt-2 pt-2 border-t border-border space-y-2">
                <p className="text-xs text-foreground leading-relaxed">{product.description}</p>
                <div className="space-y-1">
                  {product.includes.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="text-primary font-bold mt-0.5">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-3">
              {product.category === "custom" ? (
                <span className="text-[10px] text-primary font-bold">Fill out intake below ↓</span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleBuy(product); }}
                  disabled={buyingId === product.id}
                  className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-1.5 w-full justify-center disabled:opacity-50"
                >
                  {buyingId === product.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <FileText size={12} />
                  )}
                  Buy Guide · {product.price}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Custom program intake */}
      <CustomProgramIntake onBuy={handleBuy} buying={buyingId === "custom-program"} />

      {/* Why $20 */}
      <div className="bg-muted p-4 mt-4 text-center">
        <p className="text-xs text-foreground font-bold mb-1">{cms.affordable_title || "Why are these so affordable?"}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md mx-auto">
          {cms.affordable_text || "Matt charges $100+/hour in person and can only see so many athletes a week. These guides are how he shares 20+ years of knowledge with the athletes he can't reach in person. Same system. Same methodology. Written, not filmed — because results come from understanding, not watching."}
        </p>
      </div>
    </div>
  );
};

const CustomProgramIntake = ({ onBuy, buying }: { onBuy: (p: Product) => void; buying: boolean }) => {
  const customProduct = PRODUCTS.find(p => p.id === "custom-program")!;

  return (
    <div className="bg-card shadow-m2 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-foreground">Custom Program Intake</h2>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-mono font-bold text-primary">$20</span>
          <span className="text-[10px] text-muted-foreground line-through">$100+/hr</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Matt reads every field. The more you share about your athlete, the better the program.
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Parent Name *</label>
            <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Your name" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
            <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="you@email.com" type="email" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Athlete's Name *</label>
            <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="Your athlete's name" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Age & Sport *</label>
            <input className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. 15, Hockey" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Goals, Injuries & Current Training *</label>
          <textarea className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-24" placeholder="What's your athlete working toward? Any injuries? What does their current training look like?" />
        </div>
        <button
          onClick={() => onBuy(customProduct)}
          disabled={buying}
          className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 w-full justify-center disabled:opacity-50"
        >
          {buying ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
          Get Your Custom Program · $20
        </button>
        <p className="text-[10px] text-muted-foreground text-center">
          Secure checkout via Stripe. Matt builds the program personally after payment.
        </p>
      </div>
    </div>
  );
};

export default ShopGrid;
