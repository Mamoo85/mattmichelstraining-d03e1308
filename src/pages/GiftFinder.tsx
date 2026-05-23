import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";

interface P {
  listing_id: number;
  title: string;
  price_cents: number | null;
  currency: string | null;
  tags: string[] | null;
}

const OCCASIONS = [
  { id: "birthday", label: "Birthday", keywords: ["birthday", "gift"] },
  { id: "wedding", label: "Wedding / Anniversary", keywords: ["wedding", "anniversary", "couple"] },
  { id: "baby", label: "Baby / Nursery", keywords: ["baby", "nursery", "shower", "newborn"] },
  { id: "housewarming", label: "Housewarming", keywords: ["home", "house", "decor", "kitchen"] },
  { id: "holiday", label: "Holiday", keywords: ["christmas", "holiday", "ornament", "winter"] },
  { id: "justbecause", label: "Just because", keywords: [] },
];
const RECIPIENTS = [
  { id: "her", label: "For her", keywords: ["her", "women", "mom", "mother", "sister"] },
  { id: "him", label: "For him", keywords: ["him", "men", "dad", "father"] },
  { id: "kids", label: "For kids", keywords: ["kid", "child", "baby", "toddler"] },
  { id: "home", label: "For the home", keywords: ["home", "kitchen", "decor", "blanket"] },
];
const BUDGETS = [
  { id: "under25", label: "Under $25", max: 2500 },
  { id: "25to50", label: "$25 – $50", min: 2500, max: 5000 },
  { id: "50plus", label: "$50+", min: 5000 },
] as const;

const fmt = (cents: number | null, ccy: string | null) =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: ccy || "USD" }).format(cents / 100);

const GiftFinder = () => {
  const [step, setStep] = useState(0);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [items, setItems] = useState<P[]>([]);
  const [images, setImages] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step !== 3) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("etsy_products")
        .select("listing_id,title,price_cents,currency,tags")
        .eq("state", "active")
        .limit(500);
      setItems((data as P[]) ?? []);
      const ids = (data ?? []).map((p: any) => p.listing_id);
      if (ids.length) {
        const { data: imgs } = await supabase
          .from("etsy_product_images")
          .select("listing_id,url_570xn,url_fullxfull,rank")
          .in("listing_id", ids)
          .order("rank", { ascending: true });
        const first: Record<number, string> = {};
        (imgs as any[] | null)?.forEach((i) => {
          if (!first[i.listing_id]) first[i.listing_id] = i.url_570xn || i.url_fullxfull || "";
        });
        setImages(first);
      }
      setLoading(false);
    })();
  }, [step]);

  const matches = useMemo(() => {
    if (!items.length) return [];
    const occ = OCCASIONS.find((o) => o.id === occasion);
    const rec = RECIPIENTS.find((r) => r.id === recipient);
    const bud = BUDGETS.find((b) => b.id === budget);
    const kws = [...(occ?.keywords ?? []), ...(rec?.keywords ?? [])].map((k) => k.toLowerCase());
    return items
      .filter((p) => {
        const price = p.price_cents ?? 0;
        if (bud && "min" in bud && bud.min != null && price < bud.min) return false;
        if (bud && "max" in bud && bud.max != null && price > bud.max) return false;
        if (!kws.length) return true;
        const hay = (p.title + " " + (p.tags || []).join(" ")).toLowerCase();
        return kws.some((k) => hay.includes(k));
      })
      .slice(0, 24);
  }, [items, occasion, recipient, budget]);

  const wrap = "min-h-screen px-6 py-10";
  const styleBg = { background: "#faf7f1", color: "#2a241d" };

  const ChoiceGrid = ({ options, value, onPick }: { options: { id: string; label: string }[]; value: string | null; onPick: (id: string) => void }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => { onPick(o.id); setStep((s) => s + 1); }}
          className={`p-5 text-left border transition-all hover:-translate-y-0.5 ${value === o.id ? "ring-2" : ""}`}
          style={{ borderColor: "#d4c8b0", background: value === o.id ? "#f3ecdc" : "white" }}
        >
          <span className="text-sm">{o.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className={wrap} style={styleBg}>
      <SEOHead
        title="Gift Finder — Guilds & Grains"
        description="Find the perfect handmade gift in under 30 seconds. Curated by occasion, recipient, and budget."
        path="/gifts"
      />
      <div className="max-w-3xl mx-auto">
        <Link to="/guild-and-grains" className="text-[11px] uppercase tracking-[0.3em] opacity-60 hover:opacity-100">
          ← Guilds &amp; Grains
        </Link>
        <h1 className="font-serif text-4xl md:text-5xl mt-3" style={{ fontFamily: "Georgia, serif" }}>
          The Gift Finder
        </h1>
        <p className="opacity-70 mt-2 text-sm">Three quick questions. Heirloom-quality answers.</p>

        <div className="mt-6 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-1 flex-1" style={{ background: i <= step ? "#b45a3c" : "#e8dfcf" }} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h2 className="mt-8 text-lg">What's the occasion?</h2>
            <ChoiceGrid options={OCCASIONS} value={occasion} onPick={setOccasion} />
          </>
        )}
        {step === 1 && (
          <>
            <h2 className="mt-8 text-lg">Who is it for?</h2>
            <ChoiceGrid options={RECIPIENTS} value={recipient} onPick={setRecipient} />
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="mt-8 text-lg">What's the budget?</h2>
            <ChoiceGrid options={BUDGETS.map((b) => ({ id: b.id, label: b.label }))} value={budget} onPick={setBudget} />
          </>
        )}
        {step === 3 && (
          <>
            <h2 className="mt-8 text-lg">Curated for you</h2>
            <p className="text-sm opacity-60 mt-1">
              {matches.length} matches{" "}
              <button onClick={() => setStep(0)} className="underline">Start over</button>
            </p>
            {loading ? (
              <div className="py-20 text-center opacity-60">Curating…</div>
            ) : !matches.length ? (
              <div className="py-12 text-center">
                <p className="opacity-70">No exact matches. <Link to="/guild-and-grains" className="underline">Browse the full collection →</Link></p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                {matches.map((p) => (
                  <Link
                    key={p.listing_id}
                    to={`/gift/${p.listing_id}`}
                    className="group block bg-white border hover:shadow-lg transition-all"
                    style={{ borderColor: "#e8dfcf" }}
                  >
                    <div className="aspect-square overflow-hidden" style={{ background: "#f3ecdc" }}>
                      {images[p.listing_id] ? (
                        <img src={images[p.listing_id]} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm line-clamp-2 min-h-[2.5rem]">{p.title}</h3>
                      <div className="mt-2 text-sm font-semibold">{fmt(p.price_cents, p.currency)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GiftFinder;
