import { Link } from "react-router-dom";
import hero from "../assets/hero.jpg";
import { AESTHETICS } from "../data/aesthetics";
import { PRODUCTS } from "../data/products";
import ProductCard from "../components/ProductCard";

export default function GGHome() {
  const trending = [...PRODUCTS].filter((p) => p.trending).sort((a, b) => (a.trending! - b.trending!)).slice(0, 5);
  const starSeller = PRODUCTS.find((p) => p.starSeller)!;
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--gg-cream-2)]">
        <div className="grid items-center gap-6 md:grid-cols-2">
          <div className="p-6 md:p-12">
            <span className="gg-badge gg-badge--clay">New · Autumn Collection</span>
            <h1 className="gg-serif mt-4 text-4xl leading-[1.05] md:text-6xl">Heirlooms, hand-made, just for them.</h1>
            <p className="mt-4 max-w-md text-[var(--gg-mute)]">A vetted guild of artisans crafting personalized gifts and aesthetic home goods you'll want to keep forever.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/guild-grain/shop" className="gg-btn gg-btn--clay">Shop the Collection</Link>
              <Link to={`/guild-grain/product/${starSeller.slug}`} className="gg-btn gg-btn--ghost">Star Seller</Link>
            </div>
          </div>
          <div className="relative aspect-[16/10] md:aspect-auto md:h-[520px]">
            <img src={hero} alt="Engraved walnut board and beeswax candle" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Aesthetic grid */}
      <section>
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="gg-serif text-3xl">Shop by Aesthetic</h2>
          <Link to="/guild-grain/shop" className="text-xs uppercase tracking-[0.18em] text-[var(--gg-mute)] hover:text-[var(--gg-ink)]">View all →</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {AESTHETICS.map((a) => (
            <Link key={a.id} to={`/guild-grain/shop?aesthetic=${a.id}`} className="group relative aspect-[4/5] overflow-hidden">
              <img src={a.image} alt={a.label} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-[var(--gg-cream)]">
                <h3 className="gg-serif text-2xl">{a.label}</h3>
                <p className="mt-1 text-xs text-white/80">{a.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending */}
      <section>
        <h2 className="gg-serif mb-6 text-3xl">Trending This Week</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
          {trending.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Star Seller spotlight */}
      <section className="grid items-center gap-8 bg-[var(--gg-forest)] p-6 text-[var(--gg-cream)] md:grid-cols-2 md:p-12">
        <img src={starSeller.image} alt={starSeller.title} loading="lazy" className="aspect-square w-full object-cover" />
        <div>
          <span className="gg-badge gg-badge--cream">★ Star Seller</span>
          <h2 className="gg-serif mt-3 text-4xl">{starSeller.title}</h2>
          <p className="mt-3 text-white/80">{starSeller.description}</p>
          <Link to={`/guild-grain/product/${starSeller.slug}`} className="gg-btn gg-btn--clay mt-6 inline-flex">Personalize Yours</Link>
        </div>
      </section>
    </div>
  );
}
