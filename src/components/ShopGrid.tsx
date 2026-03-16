import { ShoppingBag, Lock } from "lucide-react";
import SectionHeader from "./SectionHeader";

const products = [
  {
    title: "12-Week Deadlift Specialist",
    type: "PROGRAM",
    price: "$79",
    description: "Competition-focused periodization. Includes accessory work, deload protocols, and peaking strategy.",
    locked: false,
  },
  {
    title: "Squat Every Day — 8 Week Block",
    type: "PROGRAM",
    price: "$59",
    description: "High-frequency squatting with autoregulated intensity. For intermediate to advanced lifters.",
    locked: false,
  },
  {
    title: "M2 Training — Competition Tee",
    type: "MERCH",
    price: "$35",
    description: "Heavyweight cotton. Machined fit. Safety Orange branding on black.",
    locked: false,
  },
  {
    title: "M2 Gift Card",
    type: "GIFT CARD",
    price: "$25 — $200",
    description: "Give the gift of structured training. Redeemable on all programs and merchandise.",
    locked: false,
  },
  {
    title: "Full Competition Prep — 16 Weeks",
    type: "PREMIUM PROGRAM",
    price: "$149",
    description: "Complete meet prep with coach check-ins, video review, and custom programming.",
    locked: true,
  },
];

const ShopGrid = () => (
  <div>
    <SectionHeader title="Shop" timestamp="4 programs · 1 merch · gift cards" />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {products.map((product, i) => (
        <div
          key={i}
          className={`bg-m2-surface shadow-m2 p-4 transition-m2 relative ${
            product.locked ? "opacity-60" : "hover:bg-m2-surface-hover cursor-pointer"
          }`}
        >
          {product.locked && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center">
                <Lock size={20} className="text-primary mx-auto mb-2" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  Subscribers Only
                </span>
              </div>
            </div>
          )}
          <div className="flex items-start justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{product.type}</span>
            <span className="text-sm font-mono font-bold text-foreground">{product.price}</span>
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">{product.title}</h3>
          <p className="text-xs text-muted-foreground text-balance">{product.description}</p>
          {!product.locked && (
            <button className="mt-3 flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2">
              <ShoppingBag size={12} />
              Add to Cart
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
);

export default ShopGrid;
