import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";

interface Product {
  listing_id: number;
  title: string;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  url: string | null;
  tags: string[] | null;
  materials: string[] | null;
  quantity: number | null;
}
interface Img {
  listing_id: number;
  url_570xn: string | null;
  url_fullxfull: string | null;
  rank: number;
  alt_text: string | null;
}

const fmt = (cents: number | null, ccy: string | null) =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD" }).format(cents / 100);

const GiftShare = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const [p, setP] = useState<Product | null>(null);
  const [imgs, setImgs] = useState<Img[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!listingId) return;
    (async () => {
      const id = Number(listingId);
      const { data: prod } = await supabase
        .from("etsy_products")
        .select("listing_id,title,description,price_cents,currency,url,tags,materials,quantity")
        .eq("listing_id", id)
        .maybeSingle();
      if (!prod) { setNotFound(true); setLoading(false); return; }
      setP(prod as Product);
      const { data: imgs } = await supabase
        .from("etsy_product_images")
        .select("listing_id,url_570xn,url_fullxfull,rank,alt_text")
        .eq("listing_id", id)
        .order("rank", { ascending: true });
      setImgs((imgs as Img[]) ?? []);
      setLoading(false);
    })();
  }, [listingId]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center" style={{ background: "#faf7f1" }}>Loading…</div>;
  }
  if (notFound || !p) {
    return (
      <div className="min-h-screen px-6 py-20 text-center" style={{ background: "#faf7f1", color: "#2a241d" }}>
        <p>This piece is no longer available.</p>
        <Link to="/guild-and-grains" className="underline mt-4 inline-block">Browse the collection →</Link>
      </div>
    );
  }

  const heroImg = imgs[active]?.url_fullxfull || imgs[active]?.url_570xn || "";

  return (
    <div className="min-h-screen" style={{ background: "#faf7f1", color: "#2a241d" }}>
      <SEOHead
        title={`${p.title} — Guilds & Grains`}
        description={(p.description || "").slice(0, 155)}
        path={`/gift/${p.listing_id}`}
        ogImage={heroImg || undefined}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: p.title,
          description: p.description?.slice(0, 500),
          image: imgs.map((i) => i.url_fullxfull || i.url_570xn).filter(Boolean),
          offers: {
            "@type": "Offer",
            price: ((p.price_cents ?? 0) / 100).toFixed(2),
            priceCurrency: p.currency || "USD",
            availability: (p.quantity ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: p.url,
          },
        }),
      }} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link to="/guild-and-grains" className="text-[11px] uppercase tracking-[0.3em] opacity-60 hover:opacity-100">
          ← Guilds &amp; Grains
        </Link>

        <div className="grid md:grid-cols-2 gap-10 mt-6">
          {/* Gallery */}
          <div>
            <div className="aspect-square overflow-hidden border" style={{ background: "#f3ecdc", borderColor: "#e8dfcf" }}>
              {heroImg ? <img src={heroImg} alt={p.title} className="w-full h-full object-cover" /> : null}
            </div>
            {imgs.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {imgs.slice(0, 10).map((i, idx) => (
                  <button
                    key={i.rank}
                    onClick={() => setActive(idx)}
                    className={`aspect-square overflow-hidden border ${idx === active ? "ring-2" : ""}`}
                    style={{ borderColor: "#d4c8b0" }}
                  >
                    <img src={i.url_570xn || ""} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] opacity-60">Guilds &amp; Grains · Handmade</p>
            <h1 className="font-serif text-3xl md:text-4xl mt-2" style={{ fontFamily: "Georgia, serif" }}>{p.title}</h1>
            <div className="mt-4 text-2xl font-semibold">{fmt(p.price_cents, p.currency)}</div>

            <div className="mt-6 flex flex-col gap-3">
              <a
                href={p.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-3 text-center text-xs uppercase tracking-widest"
                style={{ background: "#2a241d", color: "#faf7f1" }}
              >
                Buy on Etsy ↗
              </a>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: p.title, url: window.location.href });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
                className="px-5 py-3 text-center text-xs uppercase tracking-widest border"
                style={{ borderColor: "#2a241d" }}
              >
                Share this gift
              </button>
            </div>

            {p.materials?.length ? (
              <div className="mt-8">
                <p className="text-[11px] uppercase tracking-[0.3em] opacity-60 mb-2">Materials</p>
                <p className="text-sm">{p.materials.join(" · ")}</p>
              </div>
            ) : null}

            {p.description && (
              <div className="mt-8">
                <p className="text-[11px] uppercase tracking-[0.3em] opacity-60 mb-2">The story</p>
                <p className="text-sm leading-relaxed whitespace-pre-line opacity-90">{p.description.slice(0, 1200)}</p>
              </div>
            )}

            {p.tags?.length ? (
              <div className="mt-8 flex flex-wrap gap-2">
                {p.tags.slice(0, 12).map((t) => (
                  <span key={t} className="text-[10px] uppercase tracking-widest px-2 py-1 border" style={{ borderColor: "#d4c8b0" }}>{t}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftShare;
