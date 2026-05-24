import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Audience = {
  slug: string;
  headline: string;
  sub_headline: string | null;
  intro: string | null;
  tag_filters: string[];
  meta_title: string | null;
  meta_description: string | null;
  hero_emoji: string | null;
};
type Listing = {
  listing_id: number;
  title: string;
  price_cents: number | null;
  currency: string | null;
  url: string | null;
};

const fmt = (c: number | null, cc: string | null) =>
  c == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: cc || "USD" }).format(c / 100);

export default function GngAudienceLanding() {
  const { audience: slug = "" } = useParams<{ audience: string }>();
  const [audience, setAudience] = useState<Audience | null>(null);
  const [items, setItems] = useState<Listing[]>([]);
  const [images, setImages] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: aud } = await supabase
        .from("gng_seo_audiences")
        .select("slug,headline,sub_headline,intro,tag_filters,meta_title,meta_description,hero_emoji")
        .eq("slug", slug).eq("active", true).maybeSingle();
      setAudience(aud as Audience | null);

      if (aud?.tag_filters?.length) {
        const { data: prods } = await supabase
          .from("etsy_products")
          .select("listing_id,title,price_cents,currency,url,tags")
          .eq("state", "active")
          .overlaps("tags", aud.tag_filters)
          .order("etsy_updated_ts", { ascending: false })
          .limit(48);
        const list = (prods as any[]) ?? [];
        setItems(list);
        if (list.length) {
          const { data: imgs } = await supabase
            .from("etsy_product_images")
            .select("listing_id,url_570xn,rank")
            .in("listing_id", list.map(p => p.listing_id))
            .order("rank", { ascending: true });
          const map: Record<number, string> = {};
          for (const im of (imgs ?? []) as any[]) {
            if (!map[im.listing_id] && im.url_570xn) map[im.listing_id] = im.url_570xn;
          }
          setImages(map);
        }
      }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!audience) return;
    document.title = audience.meta_title ?? `${audience.headline} · Guilds & Grains`;
    const desc = audience.meta_description ?? audience.sub_headline ?? "";
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); (m as HTMLMetaElement).name = "description"; document.head.appendChild(m); }
    m.setAttribute("content", desc);
    // canonical
    let c = document.querySelector('link[rel="canonical"]');
    if (!c) { c = document.createElement("link"); (c as HTMLLinkElement).rel = "canonical"; document.head.appendChild(c); }
    c.setAttribute("href", `${window.location.origin}/gifts/for/${audience.slug}`);
  }, [audience]);

  if (loading) {
    return <div className="min-h-screen bg-[#fdf6ec] grid place-items-center"><Loader2 className="w-8 h-8 animate-spin text-[#7a3e1d]" /></div>;
  }
  if (!audience) {
    return (
      <main className="min-h-screen bg-[#fdf6ec] grid place-items-center text-[#3d2a1a] px-6 text-center">
        <div>
          <h1 className="font-serif text-3xl mb-3">Page not found</h1>
          <Link to="/gifts" className="underline text-[#7a3e1d]">← Browse the Gift Finder</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fdf6ec] text-[#3d2a1a]">
      <header className="border-b border-[#e8d8c0] sticky top-0 bg-[#fdf6ec]/90 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/gng" className="font-serif text-xl font-bold text-[#7a3e1d]">Guilds &amp; Grains</Link>
          <Link to="/gifts" className="text-sm text-[#7a3e1d] hover:underline">Gift Finder →</Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-16 pb-10 text-center">
        {audience.hero_emoji && <div className="text-5xl mb-4">{audience.hero_emoji}</div>}
        <h1 className="font-serif text-5xl md:text-6xl font-bold mb-4">{audience.headline}</h1>
        {audience.sub_headline && <p className="text-xl text-[#7a3e1d] mb-4">{audience.sub_headline}</p>}
        {audience.intro && <p className="text-[#5b4636] max-w-2xl mx-auto">{audience.intro}</p>}
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        {items.length === 0 ? (
          <p className="text-center text-[#7a6450] py-10">Restocking soon — check back this week or <Link to="/gifts" className="underline">browse the full Gift Finder</Link>.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {items.map(p => (
              <a key={p.listing_id} href={p.url ?? `/shop/etsy/${p.listing_id}`} target={p.url ? "_blank" : undefined} rel="noreferrer"
                 className="bg-white border border-[#e8d8c0] rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-[#f3ecdc]">
                  {images[p.listing_id]
                    ? <img src={images[p.listing_id]} alt={p.title} loading="lazy" className="w-full h-full object-cover" />
                    : <div className="w-full h-full grid place-items-center text-xs opacity-40">No image</div>}
                </div>
                <div className="p-3">
                  <h3 className="text-sm line-clamp-2 text-[#3d2a1a]">{p.title}</h3>
                  <p className="mt-2 font-bold text-[#7a3e1d]">{fmt(p.price_cents, p.currency)}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
