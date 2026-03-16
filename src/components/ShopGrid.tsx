import { useState } from "react";
import { ShoppingBag, FileText, Lightbulb, DollarSign } from "lucide-react";
import SectionHeader from "./SectionHeader";

interface Product {
  id: string;
  title: string;
  subtitle: string;
  price: string;
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
    tag: "PDF GUIDE",
    category: "sport",
    description: "The exact exercises Matt uses to build rotational power and protect throwing arms. Every exercise includes the WHY — so your athlete does it right.",
    includes: ["5 exercises with full breakdowns", "Sets, reps, and rest periods", "The WHY behind each movement", "Warm-up protocol included"],
  },
  {
    id: "hockey-5",
    title: "Hockey Strength Essentials",
    subtitle: "Edge work, hip power, and durability",
    price: "$9",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Built for the demands of hockey — lateral power, hip stability, and the kind of durability that keeps them on the ice all season.",
    includes: ["Sport-specific exercises", "In-season vs off-season guidance", "The WHY behind each movement", "Recovery protocol"],
  },
  {
    id: "football-5",
    title: "Top 5 Exercises for Football",
    subtitle: "Power, speed, and collision prep",
    price: "$9",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Explosive power, speed off the line, and a body that can absorb contact without breaking down. Built from 20+ years of training football athletes.",
    includes: ["Position-relevant exercises", "Power development focus", "The WHY behind each movement", "Injury prevention notes"],
  },
  {
    id: "basketball-5",
    title: "Top 5 Exercises for Basketball",
    subtitle: "Vertical power, knee health, and agility",
    price: "$9",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Jump higher, land safer, and move faster. Every exercise chosen to protect the knees and build the elastic power basketball demands.",
    includes: ["Vertical power exercises", "Knee health protocols", "The WHY behind each movement", "In-season maintenance plan"],
  },
  {
    id: "soccer-5",
    title: "Top 5 Exercises for Soccer",
    subtitle: "Endurance, hip mobility, and single-leg power",
    price: "$9",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Built for the unique demands of soccer — 90 minutes of running, cutting, and kicking. Single-leg strength and hip health are everything.",
    includes: ["Single-leg focused exercises", "Hip mobility work", "The WHY behind each movement", "Game-day prep protocol"],
  },
  {
    id: "lacrosse-5",
    title: "Top 5 Exercises for Lacrosse",
    subtitle: "Shoulder stability, speed, and contact prep",
    price: "$9",
    tag: "PDF GUIDE",
    category: "sport",
    description: "Shoulder durability for stick work, explosive speed for transitions, and a body that handles contact. The lacrosse-specific guide.",
    includes: ["Shoulder stability work", "Sprint mechanics", "The WHY behind each movement", "Contact preparation"],
  },
  {
    id: "pregnancy-10",
    title: "Top 10 Exercises: Pre & Post Pregnancy",
    subtitle: "Safe strength for every stage",
    price: "$12",
    tag: "PDF GUIDE",
    category: "wellness",
    description: "Safe, effective strength training for before and after pregnancy. Core stability, pelvic floor awareness, and building back strength the right way.",
    includes: ["10 exercises with trimester guidance", "Post-partum rebuilding protocol", "The WHY behind each movement", "What to avoid and when"],
  },
  {
    id: "youth-starter",
    title: "Youth Athlete Starter Guide",
    subtitle: "The foundation every young athlete needs",
    price: "$12",
    tag: "PDF GUIDE",
    category: "foundation",
    description: "The exact starting program Matt gives every new young athlete. Movement quality, work capacity, and building the habits that prevent injuries for life.",
    includes: ["Full 4-week starter program", "Movement quality checklist", "The WHY behind the system", "Parent guide included"],
  },
  {
    id: "custom-program",
    title: "Your Custom Program",
    subtitle: "Matt reads your intake and builds it from scratch",
    price: "$20",
    tag: "CUSTOM · BUILT BY MATT",
    category: "custom",
    description: "Fill out the intake. Matt reads every word, then builds a program specifically for your athlete. Not a template. Not AI-generated. 20+ years of knowledge, custom-built.",
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

const ShopGrid = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const filtered = selectedCategory === "all"
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === selectedCategory);

  return (
    <div>
      <SectionHeader title="M² Guides & Programs" timestamp="20+ years of knowledge · No camera required" />

      {/* Value hook */}
      <div className="bg-primary/10 border border-primary/20 shadow-m2 p-4 mb-6">
        <p className="text-sm text-foreground text-balance leading-relaxed">
          <span className="font-bold">"I can only train so many athletes in person.</span> But I can share what I know.
          Every guide teaches the <span className="text-primary font-bold">WHY</span> — not just what to do.
          When they understand why, they do it better. 100% of the time."
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
                <button className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-1.5 w-full justify-center">
                  <FileText size={12} />
                  Buy Guide · {product.price}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Custom program intake */}
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
          <button className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 w-full justify-center">
            <ShoppingBag size={14} />
            Get Your Custom Program · $20
          </button>
          <p className="text-[10px] text-muted-foreground text-center">
            Secure checkout via Stripe. Matt builds the program personally after payment.
          </p>
        </div>
      </div>

      {/* Why $20 */}
      <div className="bg-muted p-4 mt-4 text-center">
        <p className="text-xs text-foreground font-bold mb-1">Why are these so affordable?</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md mx-auto">
          Matt charges $100+/hour in person and can only see so many athletes a week.
          These guides are how he shares 20+ years of knowledge with the athletes he can't reach in person.
          Same system. Same methodology. Written, not filmed — because results come from understanding, not watching.
        </p>
      </div>
    </div>
  );
};

export default ShopGrid;
