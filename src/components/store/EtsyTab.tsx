import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
  url_570xN: string | null;
  url_fullxfull: string | null;
  rank: number;
}

const formatPrice = (cents: number | null, ccy: string | null) => {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD" }).format(cents / 100);
};

const EtsyTab = () => {
  const [items, setItems] = useState<EtsyProduct[]>([]);
  const [images, setImages] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: prods, error } = await supabase
          .from("etsy_products")
          .select("listing_id,title,price_cents,currency,url,tags")
          .eq("state", "active")
          .order("etsy_updated_ts", { ascending: false })
          .limit(60);
        if (error) throw error;
        if (!mounted) return;
        setItems((prods as EtsyProduct[]) ?? []);

        const ids = (prods ?? []).map((p: any) => p.listing_id);
        if (ids.length) {
          const { data: imgs } = await supabase
            .from("etsy_product_images")
            .select("listing_id,url_570xN,url_fullxfull,rank")
            .in("listing_id", ids)
            .order("rank", { ascending: true });
          const first: Record<number, string> = {};
          (imgs as EtsyImage[] | null)?.forEach((i) => {
            if (!first[i.listing_id]) first[i.listing_id] = i.url_570xN || i.url_fullxfull || "";
          });
          if (mounted) setImages(first);
        }
      } catch (e: any) {
        if (mounted) setErr(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading Etsy shop…</div>;
  if (err) return <div className="py-12 text-center text-destructive">{err}</div>;
  if (!items.length) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No active Etsy listings yet. <a className="underline" href="https://www.etsy.com/shop/MattMichelsStore" target="_blank" rel="noreferrer">Visit shop ↗</a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((p) => (
        <Link
          key={p.listing_id}
          to={`/shop/etsy/${p.listing_id}`}
          className="group bg-card border border-border hover:border-primary/50 transition-m2 overflow-hidden flex flex-col"
        >
          <div className="aspect-square bg-muted overflow-hidden">
            {images[p.listing_id] ? (
              <img
                src={images[p.listing_id]}
                alt={p.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-xs text-muted-foreground">No image</div>
            )}
          </div>
          <div className="p-3 flex flex-col gap-1 flex-1">
            <h3 className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem]">{p.title}</h3>
            <div className="mt-auto pt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-primary">{formatPrice(p.price_cents, p.currency)}</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground group-hover:text-primary">View →</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default EtsyTab;
