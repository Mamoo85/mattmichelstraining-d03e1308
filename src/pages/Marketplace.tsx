import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { LockedDossierCard } from "@/components/marketplace/LockedDossierCard";
import { SoldDossierCard } from "@/components/marketplace/SoldDossierCard";
import { FirstLookUpsellGate } from "@/components/marketplace/FirstLookUpsellGate";
import type { MarketplaceLead } from "@/components/marketplace/GoldenTicketCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flame, Sun, Snowflake, Loader2, Search, ScrollText } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const PRODUCTS = [
  { key: "mortgage", label: "Mortgage Leads", tagline: "Refi-ready homeowners with verified equity signals." },
  { key: "talent", label: "Talent Leads", tagline: "Newly licensed tradespeople, healthcare workers, available now." },
  { key: "demand", label: "Demand Leads", tagline: "Wholesale buying signals: storms, permits, expansions." },
  { key: "growth", label: "Growth Leads", tagline: "B2B accounts hiring, expanding, or signaling intent." },
  { key: "supply", label: "Supply Leads", tagline: "Government contracts and bulk-supply RFQs." },
] as const;

type ProductKey = typeof PRODUCTS[number]["key"];
type SortKey = "score" | "freshness" | "tier";
type TierFilter = "all" | "hot" | "warm" | "cool";

export default function Marketplace() {
  const [params, setParams] = useSearchParams();
  const pathProduct = (typeof window !== "undefined" ? window.location.pathname.replace("/", "").replace("-leads", "") : "") as ProductKey;
  const product = (params.get("product") as ProductKey) || (PRODUCTS.some((p) => p.key === pathProduct) ? pathProduct : "mortgage");
  const [leads, setLeads] = useState<MarketplaceLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("score");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [search, setSearch] = useState("");
  const [dismissed, setDismissed] = useState<string[]>(() => JSON.parse(localStorage.getItem("mp_dismissed") || "[]"));
  const [soldIds, setSoldIds] = useState<string[]>([]);

  const productMeta = PRODUCTS.find((p) => p.key === product) || PRODUCTS[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("unified_lead_marketplace_view" as any)
      .select("*")
      .eq("product", product)
      .order("score", { ascending: false })
      .limit(60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Could not load leads");
          console.error(error);
        }
        setLeads((data || []) as unknown as MarketplaceLead[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [product]);

  const filtered = useMemo(() => {
    let arr = leads.filter((l) => !dismissed.includes(l.id));
    if (tierFilter !== "all") arr = arr.filter((l) => l.signal_strength_tier === tierFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((l) =>
        (l.city || "").toLowerCase().includes(q) ||
        (l.zip || "").includes(q) ||
        (l.signal_type || "").toLowerCase().includes(q) ||
        (l.buyer_type || "").toLowerCase().includes(q)
      );
    }
    if (sort === "score") arr = [...arr].sort((a, b) => (b.score || 0) - (a.score || 0));
    if (sort === "freshness") arr = [...arr].sort((a, b) => (a.days_on_radar || 99) - (b.days_on_radar || 99));
    if (sort === "tier") {
      const order = { hot: 0, warm: 1, cool: 2 } as const;
      arr = [...arr].sort((a, b) => (order[a.signal_strength_tier || "cool"] - order[b.signal_strength_tier || "cool"]));
    }
    return arr;
  }, [leads, dismissed, tierFilter, search, sort]);

  const [claiming, setClaiming] = useState<string | null>(null);
  const handleClaim = async (lead: MarketplaceLead) => {
    const stored = localStorage.getItem("mp_buyer_email") || "";
    const email = window.prompt(
      "Enter your email to receive the unlocked dossier:",
      stored
    );
    if (!email || !email.includes("@")) return;
    localStorage.setItem("mp_buyer_email", email);
    setClaiming(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-marketplace-lead-checkout", {
        body: { lead_id: lead.id, product, buyer_email: email },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No checkout URL");
      window.location.href = url;
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes("already_sold")) toast.error("That lead just sold to someone else.");
      else if (msg.includes("locked_by_other")) toast.error("Another buyer has a 10-min hold on this lead.");
      else toast.error("Checkout failed — try again.");
      console.error(e);
    } finally {
      setClaiming(null);
    }
  };

  const tierCounts = useMemo(() => ({
    all: leads.length,
    hot: leads.filter((l) => l.signal_strength_tier === "hot").length,
    warm: leads.filter((l) => l.signal_strength_tier === "warm").length,
    cool: leads.filter((l) => l.signal_strength_tier === "cool").length,
  }), [leads]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{productMeta.label} Marketplace · Detroit Web Agency</title>
        <meta name="description" content={`Live ${productMeta.label.toLowerCase()} for Metro Detroit. ${productMeta.tagline}`} />
        <link rel="canonical" href={`https://detroitwebagent.com/${product}-leads`} />
      </Helmet>

      {/* Header */}
      <div className="border-b border-border/40 bg-gradient-to-b from-card to-background">
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-intel-teal mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-intel-teal animate-pulse" />
            Live Marketplace · Refreshed continuously
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{productMeta.label}</h1>
          <p className="text-muted-foreground max-w-2xl">{productMeta.tagline}</p>

          {/* Product switcher */}
          <div className="flex flex-wrap gap-2 mt-6">
            {PRODUCTS.map((p) => (
              <button
                key={p.key}
                onClick={() => setParams({ product: p.key })}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded border transition-colors ${
                  p.key === product
                    ? "bg-intel-teal/15 border-intel-teal/50 text-intel-teal"
                    : "bg-card border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-b border-border/40 sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {(["all", "hot", "warm", "cool"] as TierFilter[]).map((t) => {
              const Icon = t === "hot" ? Flame : t === "warm" ? Sun : t === "cool" ? Snowflake : null;
              return (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded border flex items-center gap-1 ${
                    tierFilter === t ? "bg-intel-teal/15 border-intel-teal/50 text-intel-teal" : "border-border/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {t} <span className="opacity-50">({tierCounts[t]})</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search city, ZIP, signal…"
              className="pl-8 h-8 text-xs font-mono bg-card border-border/40"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-card border border-border/40 text-foreground text-xs font-mono px-2 py-1.5 rounded h-8"
          >
            <option value="score">Sort: Score ↓</option>
            <option value="freshness">Sort: Freshness</option>
            <option value="tier">Sort: Tier</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="container max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading leads…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">No leads match your filters.</p>
            <Button variant="outline" onClick={() => { setTierFilter("all"); setSearch(""); }}>Clear filters</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((lead) =>
              soldIds.includes(lead.id) ? (
                <SoldDossierCard key={lead.id} lead={lead} />
              ) : (
                <LockedDossierCard key={lead.id} lead={lead} onClaim={handleClaim} />
              )
            )}
          </div>
        )}

        <p className="text-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-10">
          Showing {filtered.length} of {leads.length} live leads · Updated continuously
        </p>
      </div>
    </div>
  );
}
