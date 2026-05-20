import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import AppNavbar from "@/components/layout/AppNavbar";
import { supabase } from "@/integrations/supabase/client";

interface EtsyProductRow {
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
interface EtsyImageRow {
  image_id: number;
  rank: number;
  url_570xN: string | null;
  url_fullxfull: string | null;
  alt_text: string | null;
}

const formatPrice = (cents: number | null, ccy: string | null) =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD" }).format(cents / 100);

const EtsyProductDetail = () => {
  const { listingId } = useParams<{ listingId: string }>();
  const [product, setProduct] = useState<EtsyProductRow | null>(null);
  const [images, setImages] = useState<EtsyImageRow[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!listingId) return;
    let mounted = true;
    (async () => {
      try {
        const id = Number(listingId);
        const [{ data: p, error: pe }, { data: imgs }] = await Promise.all([
          supabase.from("etsy_products").select("*").eq("listing_id", id).maybeSingle(),
          supabase.from("etsy_product_images").select("*").eq("listing_id", id).order("rank", { ascending: true }),
        ]);
        if (pe) throw pe;
        if (!p) throw new Error("Listing not found");
        if (!mounted) return;
        setProduct(p as EtsyProductRow);
        setImages((imgs as EtsyImageRow[]) ?? []);
      } catch (e: any) {
        if (mounted) setErr(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [listingId]);

  const heroImg = images[activeIdx]?.url_fullxfull || images[activeIdx]?.url_570xN || "";
  const seoImage = images[0]?.url_fullxfull || images[0]?.url_570xN || undefined;

  const jsonLd = product ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: (product.description || "").slice(0, 500),
    image: images.map((i) => i.url_fullxfull || i.url_570xN).filter(Boolean),
    offers: product.price_cents != null ? {
      "@type": "Offer",
      priceCurrency: product.currency || "USD",
      price: (product.price_cents / 100).toFixed(2),
      availability: (product.quantity ?? 1) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: product.url || undefined,
    } : undefined,
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={product ? `${product.title} — Shop` : "Etsy listing"}
        description={product?.description?.slice(0, 155) || "Etsy product detail"}
        path={`/shop/etsy/${listingId}`}
        image={seoImage}
      />
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <AppNavbar />
      <div className="container pt-20 pb-16">
        <Link to="/shop" className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">← Back to shop</Link>

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading…</div>
        ) : err ? (
          <div className="py-20 text-center text-destructive">{err}</div>
        ) : !product ? null : (
          <div className="grid md:grid-cols-2 gap-8 mt-4">
            {/* Gallery */}
            <div>
              <div className="aspect-square bg-muted overflow-hidden border border-border">
                {heroImg ? (
                  <img src={heroImg} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-muted-foreground">No image</div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto">
                  {images.map((img, idx) => (
                    <button
                      key={img.image_id}
                      onClick={() => setActiveIdx(idx)}
                      className={`flex-shrink-0 w-16 h-16 border-2 overflow-hidden ${idx === activeIdx ? "border-primary" : "border-border"}`}
                    >
                      <img src={img.url_570xN || img.url_fullxfull || ""} alt={img.alt_text || ""} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl md:text-3xl font-bold">{product.title}</h1>
              <div className="text-2xl font-bold text-primary">{formatPrice(product.price_cents, product.currency)}</div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={product.url || `https://www.etsy.com/listing/${product.listing_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-primary text-primary-foreground px-6 py-3 font-bold uppercase tracking-widest text-sm text-center hover:opacity-90 transition-m2"
                >
                  Buy on Etsy →
                </a>
                <a
                  href={product.url || `https://www.etsy.com/listing/${product.listing_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-border px-6 py-3 font-bold uppercase tracking-widest text-sm text-center hover:border-primary transition-m2"
                >
                  View on Etsy
                </a>
              </div>

              {product.description && (
                <div className="prose prose-sm dark:prose-invert max-w-none mt-2 whitespace-pre-wrap">
                  {product.description}
                </div>
              )}

              {(product.materials?.length ?? 0) > 0 && (
                <div className="text-xs text-muted-foreground">
                  <strong className="uppercase tracking-widest">Materials:</strong> {product.materials!.join(", ")}
                </div>
              )}
              {(product.tags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {product.tags!.slice(0, 12).map((t) => (
                    <span key={t} className="text-[10px] uppercase tracking-wider bg-muted px-2 py-1">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EtsyProductDetail;
