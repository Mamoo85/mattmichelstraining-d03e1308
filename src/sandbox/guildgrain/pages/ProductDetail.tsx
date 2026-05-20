import { useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { findProduct } from "../data/products";
import { computeVelocity } from "../state/useVelocityPrice";
import { seededSalesVelocity, seededReviews } from "../state/seededRandom";
import LivePreviewCanvas from "../components/LivePreviewCanvas";
import VelocityBadge from "../components/VelocityBadge";
import ReviewBreakdown from "../components/ReviewBreakdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGGCart } from "../state/CartContext";

export default function GGProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const product = slug ? findProduct(slug) : undefined;
  const { add } = useGGCart();

  const sold = product ? seededSalesVelocity(product.id) : 0;
  const reviews = product ? seededReviews(product.id) : null;

  const [text, setText] = useState("");
  const [material, setMaterial] = useState(product?.personalization?.materials[0].id ?? "");
  const [font, setFont] = useState(product?.personalization?.fonts[0].id ?? "");
  const [galleryIdx, setGalleryIdx] = useState(0);

  if (!product) return <Navigate to="/guild-grain/shop" replace />;

  const materialObj = product.personalization?.materials.find((m) => m.id === material);
  const fontObj = product.personalization?.fonts.find((f) => f.id === font);
  const materialDelta = materialObj?.priceDelta ?? 0;
  const v = computeVelocity(product.basePrice + materialDelta, sold);

  const onAdd = () => {
    add({
      key: `${product.id}:${material}:${font}:${text.trim().toLowerCase()}`,
      productId: product.id,
      title: product.title,
      image: product.image,
      unitPrice: v.price,
      qty: 1,
      personalization: product.customizable ? { text: text.trim(), font: fontObj?.label ?? "", material: materialObj?.label ?? "" } : undefined,
    });
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Gallery / live preview */}
      <div>
        <div className="aspect-square overflow-hidden bg-[var(--gg-cream-2)]">
          {product.customizable && fontObj ? (
            <LivePreviewCanvas image={product.gallery[galleryIdx]} text={text} fontFamily={fontObj.family} tint={materialObj?.tint} />
          ) : (
            <img src={product.gallery[galleryIdx]} alt={product.title} className="h-full w-full object-cover" />
          )}
        </div>
        {product.gallery.length > 1 && (
          <div className="mt-3 flex gap-2">
            {product.gallery.map((g, i) => (
              <button key={i} onClick={() => setGalleryIdx(i)} className={`h-16 w-16 overflow-hidden border ${i === galleryIdx ? "border-[var(--gg-ink)]" : "border-[var(--gg-line)]"}`}>
                <img src={g} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--gg-mute)]">{product.artisan}</p>
        <h1 className="gg-serif mt-1 text-4xl">{product.title}</h1>
        {reviews && <p className="mt-2 text-sm text-[var(--gg-mute)]">★ {reviews.avg.toFixed(1)} ({reviews.count.toLocaleString()} reviews)</p>}

        <div className="mt-5 flex items-baseline gap-3">
          <span className="gg-serif text-3xl" data-testid="gg-pdp-price">${v.price.toFixed(2)}</span>
          {v.multiplier < 1 && <span className="text-[var(--gg-mute)] line-through">${(product.basePrice + materialDelta).toFixed(2)}</span>}
        </div>
        <div className="mt-3"><VelocityBadge v={v} /></div>

        {product.customizable && product.personalization && (
          <div className="mt-6 space-y-4 border-t border-[var(--gg-line)] pt-6" data-testid="gg-personalize">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--gg-mute)]">Your Text ({product.personalization.maxChars} char max)</label>
              <input value={text} maxLength={product.personalization.maxChars} onChange={(e) => setText(e.target.value)} placeholder="Type a name, date, or word..." className="gg-input" data-testid="gg-personalize-text" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--gg-mute)]">Material</label>
                <select value={material} onChange={(e) => setMaterial(e.target.value)} className="gg-input" data-testid="gg-personalize-material">
                  {product.personalization.materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}{m.priceDelta ? ` (${m.priceDelta > 0 ? "+" : ""}$${m.priceDelta})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-[var(--gg-mute)]">Font</label>
                <select value={font} onChange={(e) => setFont(e.target.value)} className="gg-input" data-testid="gg-personalize-font">
                  {product.personalization.fonts.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <button onClick={onAdd} className="gg-btn gg-btn--clay mt-6 w-full md:w-auto" data-testid="gg-add-to-cart">Add to Cart — ${v.price.toFixed(2)}</button>

        <Tabs defaultValue="desc" className="mt-8">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="desc" className="data-[state=active]:bg-[var(--gg-ink)] data-[state=active]:text-[var(--gg-cream)]">Description</TabsTrigger>
            <TabsTrigger value="ship" className="data-[state=active]:bg-[var(--gg-ink)] data-[state=active]:text-[var(--gg-cream)]">Shipping</TabsTrigger>
            <TabsTrigger value="rev" className="data-[state=active]:bg-[var(--gg-ink)] data-[state=active]:text-[var(--gg-cream)]">Reviews</TabsTrigger>
          </TabsList>
          <TabsContent value="desc" className="pt-4 text-sm leading-relaxed text-[var(--gg-mute)]">{product.description}</TabsContent>
          <TabsContent value="ship" className="pt-4 text-sm text-[var(--gg-mute)]">{product.shippingDays}. Ships from a small studio — please allow extra time around holidays.</TabsContent>
          <TabsContent value="rev" className="pt-4"><ReviewBreakdown productId={product.id} /></TabsContent>
        </Tabs>

        <Link to="/guild-grain/shop" className="mt-8 inline-block text-xs uppercase tracking-[0.16em] text-[var(--gg-mute)] hover:text-[var(--gg-ink)]">← Back to collection</Link>
      </div>
    </div>
  );
}
