import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { ExitIntentPopup } from "@/components/gng/ExitIntentPopup";

interface EtsyProduct {
  listing_id: number;
  title: string;
  price_cents: number | null;
  currency: string | null;
  url: string | null;
  tags: string[] | null;
}
interface EtsyImage {
  listing_id: number;
  url_570xn: string | null;
  url_fullxfull: string | null;
  rank: number;
}

const fmt = (cents: number | null, ccy: string | null) =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD" }).format(cents / 100);

const GuildsAndGrains = () => {
  const [items, setItems] = useState<EtsyProduct[]>([]);
  const [images, setImages] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "price_low" | "price_high">("newest");

  useEffect(() => {
    (async () => {
      const { data: prods } = await supabase
        .from("etsy_products")
        .select("listing_id,title,price_cents,currency,url,tags")
        .eq("state", "active")
        .order("etsy_updated_ts", { ascending: false })
        .limit(500);
      setItems((prods as EtsyProduct[]) ?? []);
      const ids = (prods ?? []).map((p: any) => p.listing_id);
      if (ids.length) {
        const { data: imgs } = await supabase
          .from("etsy_product_images")
          .select("listing_id,url_570xn,url_fullxfull,rank")
          .in("listing_id", ids)
          .order("rank", { ascending: true });
        const first: Record<number, string> = {};
        (imgs as EtsyImage[] | null)?.forEach((i) => {
          if (!first[i.listing_id]) first[i.listing_id] = i.url_570xn || i.url_fullxfull || "";
        });
        setImages(first);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(q) || (p.tags || []).some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (sortBy === "price_low") list = [...list].sort((a, b) => (a.price_cents ?? 0) - (b.price_cents ?? 0));
    if (sortBy === "price_high") list = [...list].sort((a, b) => (b.price_cents ?? 0) - (a.price_cents ?? 0));
    return list;
  }, [items, query, sortBy]);

  return (
    <div className="min-h-screen" style={{ background: "#faf7f1", color: "#2a241d" }}>
      <SEOHead
        title="Guilds & Grains — Handcrafted Yarn Art, Gifts & Home Goods"
        description="Heirloom-quality handcrafted goods, knit gifts, and made-to-order home decor from the Guilds & Grains atelier. Over 500 pieces."
        path="/guild-and-grains"
      />
      {/* Hero */}
      <header className="border-b" style={{ borderColor: "#e8dfcf", background: "#f3ecdc" }}>
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-16 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] mb-3 opacity-60">A guild of makers</p>
          <h1 className="font-serif text-4xl md:text-6xl leading-tight" style={{ fontFamily: "Georgia, serif" }}>
            Guilds <span style={{ color: "#b45a3c" }}>&amp;</span> Grains
          </h1>
          <p className="mt-4 max-w-xl mx-auto text-sm md:text-base opacity-80">
            Handcrafted, made-to-last gifts and home goods. Shipped from our Michigan workshop.
          </p>
          <div className="mt-6 flex justify-center gap-3 text-xs uppercase tracking-widest">
            <Link to="/gifts" className="px-5 py-3 border" style={{ borderColor: "#2a241d" }}>Gift Finder →</Link>
            <a href="#shop" className="px-5 py-3" style={{ background: "#2a241d", color: "#faf7f1" }}>Shop the Collection</a>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div id="shop" className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-6">
          <h2 className="text-2xl font-serif" style={{ fontFamily: "Georgia, serif" }}>
            The Collection {items.length ? <span className="text-sm opacity-50">({filtered.length})</span> : null}
          </h2>
          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search gifts, colors, occasions…"
              className="px-3 py-2 text-sm border bg-transparent flex-1 md:w-64"
              style={{ borderColor: "#d4c8b0" }}
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-sm border bg-transparent"
              style={{ borderColor: "#d4c8b0" }}
            >
              <option value="newest">Newest</option>
              <option value="price_low">Price: Low → High</option>
              <option value="price_high">Price: High → Low</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center opacity-60">Gathering the makers…</div>
        ) : !filtered.length ? (
          <div className="py-20 text-center opacity-60">No items match. Try a different search.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((p) => (
              <Link
                key={p.listing_id}
                to={`/gift/${p.listing_id}`}
                className="group block bg-white border transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ borderColor: "#e8dfcf" }}
              >
                <div className="aspect-square overflow-hidden" style={{ background: "#f3ecdc" }}>
                  {images[p.listing_id] ? (
                    <img
                      src={images[p.listing_id]}
                      alt={p.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-xs opacity-40">No image</div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{p.title}</h3>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{fmt(p.price_cents, p.currency)}</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-50 group-hover:opacity-100">View →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t mt-12 py-10 text-center text-xs uppercase tracking-[0.2em] opacity-60" style={{ borderColor: "#e8dfcf" }}>
        Guilds &amp; Grains · Made in Michigan · Est. 2026
      </footer>
    </div>
  );
};

export default GuildsAndGrains;
