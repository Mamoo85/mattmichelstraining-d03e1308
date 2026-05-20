import { Link } from "react-router-dom";
import { computeVelocity } from "../state/useVelocityPrice";
import { seededReviews, seededSalesVelocity } from "../state/seededRandom";
import { Product } from "../data/products";

export default function ProductCard({ product }: { product: Product }) {
  const sold = seededSalesVelocity(product.id);
  const v = computeVelocity(product.basePrice, sold);
  const r = seededReviews(product.id);

  return (
    <Link to={`/guild-grain/product/${product.slug}`} className="group block" data-testid={`gg-card-${product.slug}`}>
      <div className="relative aspect-square overflow-hidden bg-[var(--gg-cream-2)]">
        <img src={product.image} alt={product.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {product.starSeller && (
          <span className="gg-badge gg-badge--forest absolute left-3 top-3">★ Star Seller</span>
        )}
        {v.tier === "penetration" && (
          <span className="gg-badge gg-badge--clay absolute right-3 top-3">−20%</span>
        )}
      </div>
      <div className="mt-3 px-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--gg-mute)]">{product.artisan}</p>
        <h3 className="gg-serif mt-0.5 text-lg leading-tight">{product.title}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold">${v.price.toFixed(2)}</span>
          {v.multiplier < 1 && <span className="text-xs text-[var(--gg-mute)] line-through">${product.basePrice.toFixed(2)}</span>}
        </div>
        <p className="mt-1 text-xs text-[var(--gg-mute)]">★ {r.avg.toFixed(1)} ({r.count.toLocaleString()})</p>
      </div>
    </Link>
  );
}
