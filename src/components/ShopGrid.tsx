import { useState } from "react";
import { ShoppingBag, FileText, Loader2 } from "lucide-react";
import SectionHeader from "./SectionHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useContentMap } from "@/hooks/useSiteContent";
import CheckoutConfirmationModal, { type CheckoutProductType } from "./CheckoutConfirmationModal";

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
    id: "baseball-program",
    title: "Baseball Strength Program (4 weeks)",
    subtitle: "Rotational power, arm health, and explosiveness",
    price: "$20",
    priceId: "price_1TBWRjD52tPWee464JrSieCi",
    tag: "4-WEEK PROGRAM",
    category: "sport",
    description: "Two decades of training baseball players distilled into a 4-week program — rotational power, arm care, hip mobility. Downloadable and printable as a PDF.",
    includes: ["Full 4-week program", "Sets, reps, and rest periods", "The WHY behind each movement", "Warm-up protocol included", "Download & print as PDF"],
  },
  {
    id: "football-program",
    title: "Football Strength Program (4 weeks)",
    subtitle: "Power, speed, and collision prep",
    price: "$20",
    priceId: "price_1TBWRzD52tPWee46IQxgPosm",
    tag: "4-WEEK PROGRAM",
    category: "sport",
    description: "Explosive hips, bulletproof core, and durability that keeps them on the field all season. Position-relevant programming for every level.",
    includes: ["Full 4-week program", "Position-relevant exercises", "The WHY behind each movement", "Injury prevention protocols", "Download & print as PDF"],
  },
  {
    id: "basketball-program",
    title: "Basketball Strength Program (4 weeks)",
    subtitle: "Vertical power, knee health, and agility",
    price: "$20",
    priceId: "price_1TBWSgD52tPWee46vmwnXiHe",
    tag: "4-WEEK PROGRAM",
    category: "sport",
    description: "You can't jump higher if your knees can't handle the landing. This program builds elastic power AND protects the joints.",
    includes: ["Full 4-week program", "Vertical power exercises", "Knee health protocols", "The WHY behind each movement", "Download & print as PDF"],
  },
  {
    id: "hockey-program",
    title: "Hockey Strength Program (4 weeks)",
    subtitle: "Edge work, hip power, and durability",
    price: "$20",
    priceId: "price_1TBWSxD52tPWee465QPmHaTK",
    tag: "4-WEEK PROGRAM",
    category: "sport",
    description: "Posterior chain work, single-leg stability, and core bracing that turns skaters into forces. Designed around your ice schedule.",
    includes: ["Full 4-week program", "Sport-specific exercises", "In-season vs off-season guidance", "The WHY behind each movement", "Download & print as PDF"],
  },
  {
    id: "soccer-program",
    title: "Soccer Strength Program (4 weeks)",
    subtitle: "Endurance, hip mobility, and single-leg power",
    price: "$20",
    priceId: "price_1TBWTFD52tPWee46fh1GttaO",
    tag: "4-WEEK PROGRAM",
    category: "sport",
    description: "Single-leg strength, hip mobility, and the endurance base that keeps them sharp in the 80th minute.",
    includes: ["Full 4-week program", "Single-leg focused exercises", "Hip mobility work", "The WHY behind each movement", "Download & print as PDF"],
  },
  {
    id: "lacrosse-program",
    title: "Lacrosse Strength Program (4 weeks)",
    subtitle: "Shoulder stability, speed, and contact prep",
    price: "$20",
    priceId: "price_1TBWTVD52tPWee46MSdo6gXX",
    tag: "4-WEEK PROGRAM",
    category: "sport",
    description: "Shoulder durability for stick work, explosive change of direction, and a frame that handles contact.",
    includes: ["Full 4-week program", "Shoulder stability work", "Sprint mechanics", "The WHY behind each movement", "Download & print as PDF"],
  },
  {
    id: "pregnancy-program",
    title: "Pre & Post Pregnancy Program (4 weeks)",
    subtitle: "Safe strength for every stage",
    price: "$20",
    priceId: "price_1TBWTmD52tPWee46FaB1wcFz",
    tag: "4-WEEK PROGRAM",
    category: "wellness",
    description: "Safe, effective exercises backed by kinesiology. Written for the moms who asked 'what can I do now?'",
    includes: ["Full 4-week program", "Trimester guidance", "Post-partum rebuilding protocol", "The WHY behind each movement", "Download & print as PDF"],
  },
  {
    id: "youth-starter",
    title: "Youth Athlete Starter Program (4 weeks)",
    subtitle: "The foundation every young athlete needs",
    price: "$20",
    priceId: "price_1TBWU1D52tPWee46qnvE9Zrv",
    tag: "4-WEEK PROGRAM",
    category: "foundation",
    description: "The exact program Matt gives every new young athlete. Movement quality first, then work capacity, then strength. The foundation that prevents injuries for life.",
    includes: ["Full 4-week program", "Movement quality checklist", "The WHY behind the system", "Parent resource included", "Download & print as PDF"],
  },
  {
    id: "custom-program",
    title: "Your Custom Program",
    subtitle: "Matt reads your intake and builds it from scratch",
    price: "$20",
    priceId: "price_1TAvVYD52tPWee46eudNwrb6",
    tag: "CUSTOM · BUILT BY MATT",
    category: "custom",
    description: "You fill out the intake. Matt reads every word. Then he builds your program from scratch — your goals, your equipment, your level. No templates. No AI. Downloadable and printable as a PDF.",
    includes: ["Fully custom program", "Coaching cues on every movement", "The WHY behind every choice", "Download & print as PDF", "Matt's guarantee: fix it or refund"],
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

  // Modal state
  const [modalProduct, setModalProduct] = useState<Product | null>(null);

  const filtered = showCustomOnly
    ? PRODUCTS.filter((p) => p.category === "custom")
    : selectedCategory === "all"
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === selectedCategory);

  const openModal = (product: Product) => {
    if (!user) {
      window.location.href = `/auth?redirect=/shop`;
      return;
    }
    setModalProduct(product);
  };

  const handleConfirmedBuy = async () => {
    if (!modalProduct) return;
    setBuyingId(modalProduct.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-guide-payment", {
        body: { priceId: modalProduct.priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setBuyingId(null);
      setModalProduct(null);
    }
  };

  const getProductType = (product: Product): CheckoutProductType => {
    if (product.category === "custom") return "custom";
    return "program";
  };

  return (
    <div>
      {!showCustomOnly && (
        <>
          <SectionHeader title="M² Programs" timestamp="20+ years of knowledge · Download & print as PDF" />

          <div className="bg-primary/10 border border-primary/20 shadow-m2 p-4 mb-6">
            <p className="text-sm text-foreground text-balance leading-relaxed">
              <span className="font-bold">"</span>{cms.value_hook || "I can only train so many athletes in person. But I can share what I know. Every plan teaches the WHY — not just what to do. When they understand why, they do it better. 100% of the time."}<span className="font-bold">"</span>
            </p>
            <span className="text-[10px] font-mono text-primary mt-2 block">— Matt Michels, M² Training</span>
          </div>

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
        </>
      )}

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
                  onClick={(e) => { e.stopPropagation(); openModal(product); }}
                  disabled={buyingId === product.id}
                  className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-1.5 w-full justify-center disabled:opacity-50"
                >
                  {buyingId === product.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <FileText size={12} />
                  )}
                  Buy Program · {product.price}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <CustomProgramIntake onBuy={openModal} buying={buyingId === "custom-program"} />

      <div className="bg-muted p-4 mt-4 text-center">
        <p className="text-xs text-foreground font-bold mb-1">{cms.affordable_title || "Why are these so affordable?"}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md mx-auto">
          {cms.affordable_text || "Matt charges $100+/hour in person and can only see so many athletes a week. These programs are how he shares 20+ years of knowledge with athletes he can't reach in person. Same system. Same coaching. No overhead markup."}
        </p>
      </div>

      {/* Checkout confirmation modal */}
      <CheckoutConfirmationModal
        open={!!modalProduct}
        onClose={() => setModalProduct(null)}
        onConfirm={handleConfirmedBuy}
        loading={!!buyingId}
        productName={modalProduct?.title || ""}
        productPrice={modalProduct?.price || ""}
        productType={modalProduct ? getProductType(modalProduct) : "program"}
      />
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
