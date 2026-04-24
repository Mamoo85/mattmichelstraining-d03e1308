import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { LockedDossierCard } from "@/components/marketplace/LockedDossierCard";
import { SoldDossierCard } from "@/components/marketplace/SoldDossierCard";
import { FirstLookUpsellGate } from "@/components/marketplace/FirstLookUpsellGate";
import { CompareDrawer } from "@/components/marketplace/CompareDrawer";
import { WatchedLeadsRail } from "@/components/marketplace/WatchedLeadsRail";
import type { MarketplaceLead } from "@/components/marketplace/GoldenTicketCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Flame, Sun, Snowflake, Loader2, Search, ScrollText, Layers, Keyboard } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useSwipeable } from "react-swipeable";
import { cn } from "@/lib/utils";

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

function SwipeRow({
  lead,
  onWatch,
  onDismiss,
  children,
}: {
  lead: MarketplaceLead;
  onWatch: (l: MarketplaceLead) => void;
  onDismiss: (id: string) => void;
  children: React.ReactNode;
}) {
  const handlers = useSwipeable({
    onSwipedLeft: () => onDismiss(lead.id),
    onSwipedRight: () => onWatch(lead),
    trackMouse: false,
    preventScrollOnSwipe: true,
    delta: 50,
  });
  return <div {...handlers}>{children}</div>;
}

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
  const [watched, setWatched] = useState<string[]>(() => JSON.parse(localStorage.getItem("mp_watched") || "[]"));
  const [soldIds, setSoldIds] = useState<string[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<number>(() => Number(localStorage.getItem("mp_last_seen") || "0"));
  const [buyerEmail, setBuyerEmail] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem("mp_buyer_email") || "" : ""
  );

  const productMeta = PRODUCTS.find((p) => p.key === product) || PRODUCTS[0];
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Mark visit on mount: capture previous timestamp for NEW-badge comparison,
  // then immediately stamp current visit. Also ping server for reengagement tracking.
  useEffect(() => {
    const prev = Number(localStorage.getItem("mp_last_seen") || "0");
    setLastSeenAt(prev);
    const now = Date.now();
    localStorage.setItem("mp_last_seen", String(now));
    const email = localStorage.getItem("mp_buyer_email");
    if (email) {
      (supabase as any)
        .from("marketplace_buyer_visits")
        .upsert(
          { buyer_email: email.toLowerCase().trim(), last_seen_at: new Date().toISOString() },
          { onConflict: "buyer_email" },
        )
        .then(() => {})
        .catch?.(() => {});
    }
  }, [product]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase
        .from("unified_lead_marketplace_view" as any)
        .select("*")
        .eq("product", product)
        .order("score", { ascending: false })
        .limit(60),
      (supabase as any)
        .from("marketplace_lead_locks")
        .select("lead_id")
        .eq("product", product)
        .eq("status", "sold"),
    ]).then(([leadsRes, locksRes]: any[]) => {
      if (cancelled) return;
      if (leadsRes.error) {
        toast.error("Could not load leads");
        console.error(leadsRes.error);
      }
      setLeads((leadsRes.data || []) as unknown as MarketplaceLead[]);
      setSoldIds(((locksRes.data || []) as Array<{ lead_id: string }>).map((r) => r.lead_id));
      setLoading(false);
      setFocusIdx(0);
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
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [pendingClaimLead, setPendingClaimLead] = useState<MarketplaceLead | null>(null);

  const startCheckout = async (lead: MarketplaceLead, email: string) => {
    localStorage.setItem("mp_buyer_email", email);
    setBuyerEmail(email);
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

  const handleClaim = async (lead: MarketplaceLead) => {
    const stored = localStorage.getItem("mp_buyer_email") || buyerEmail || "";
    if (stored && stored.includes("@")) {
      await startCheckout(lead, stored);
      return;
    }
    setPendingClaimLead(lead);
    setEmailDialogOpen(true);
  };

  const toggleWatch = (lead: MarketplaceLead) => {
    setWatched((prev) => {
      const next = prev.includes(lead.id) ? prev.filter((x) => x !== lead.id) : [...prev, lead.id];
      localStorage.setItem("mp_watched", JSON.stringify(next));
      return next;
    });
    if (!watched.includes(lead.id)) {
      toast.success("Added to watch list");
      const email = buyerEmail || localStorage.getItem("mp_buyer_email");
      if (email) {
        supabase.functions.invoke("marketplace-watch-add", {
          body: { buyer_email: email, lead_id: lead.id, product },
        }).catch(() => {});
      }
    } else {
      // Removing from watch — also remove from server
      const email = buyerEmail || localStorage.getItem("mp_buyer_email");
      if (email) {
        supabase.functions.invoke("marketplace-watch-add", {
          body: { buyer_email: email, lead_id: lead.id, product, action: "remove" },
        }).catch(() => {});
      }
    }
  };

  const dismissLead = (id: string) => {
    setDismissed((prev) => {
      const next = [...prev, id];
      localStorage.setItem("mp_dismissed", JSON.stringify(next));
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast.error("Compare up to 3 leads at once");
        return prev;
      }
      return [...prev, id];
    });
  };

  // Keyboard shortcuts: J/K nav · Enter open · C compare · B buy · W watch · X dismiss · Esc close · ? help
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const lead = filtered[focusIdx];
      switch (e.key.toLowerCase()) {
        case "j":
          e.preventDefault();
          setFocusIdx((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "k":
          e.preventDefault();
          setFocusIdx((i) => Math.max(i - 1, 0));
          break;
        case "enter":
          if (lead) window.open(`/lead/${lead.id}`, "_blank");
          break;
        case "c":
          if (lead) toggleCompare(lead.id);
          break;
        case "b":
          if (lead && !soldIds.includes(lead.id)) handleClaim(lead);
          break;
        case "w":
          if (lead) toggleWatch(lead);
          break;
        case "x":
          if (lead) dismissLead(lead.id);
          break;
        case "escape":
          setCompareOpen(false);
          setShowShortcuts(false);
          break;
        case "?":
          setShowShortcuts((v) => !v);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, focusIdx, soldIds, watched]);

  // Scroll focused card into view
  useEffect(() => {
    const lead = filtered[focusIdx];
    if (!lead) return;
    cardRefs.current[lead.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusIdx, filtered]);

  const compareLeads = useMemo(
    () => compareIds.map((id) => leads.find((l) => l.id === id)).filter(Boolean) as MarketplaceLead[],
    [compareIds, leads]
  );

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
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-intel-teal mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-intel-teal animate-pulse" />
                Live Marketplace · Refreshed continuously
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{productMeta.label}</h1>
              <p className="text-muted-foreground max-w-2xl">{productMeta.tagline}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShortcuts((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-intel-teal/50"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="w-3.5 h-3.5" /> ?
              </button>
              <Link
                to="/marketplace/receipts"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded border border-border/40 text-muted-foreground hover:text-foreground hover:border-intel-teal/50 transition-colors"
              >
                <ScrollText className="w-3.5 h-3.5" /> My Receipts
              </Link>
            </div>
          </div>

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

      {/* Shortcuts panel */}
      {showShortcuts && (
        <div className="border-b border-intel-teal/30 bg-card/80">
          <div className="container max-w-7xl mx-auto px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
            <span><kbd className="text-intel-teal">J</kbd>/<kbd className="text-intel-teal">K</kbd> navigate</span>
            <span><kbd className="text-intel-teal">Enter</kbd> open</span>
            <span><kbd className="text-intel-teal">B</kbd> buy</span>
            <span><kbd className="text-intel-teal">C</kbd> compare</span>
            <span><kbd className="text-intel-teal">W</kbd> watch</span>
            <span><kbd className="text-intel-teal">X</kbd> dismiss</span>
            <span><kbd className="text-intel-teal">Esc</kbd> close</span>
          </div>
        </div>
      )}

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

          {compareIds.length > 0 && (
            <button
              onClick={() => setCompareOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono uppercase tracking-wider rounded bg-intel-teal/15 border border-intel-teal/50 text-intel-teal hover:bg-intel-teal/25"
            >
              <Layers className="w-3 h-3" /> Compare ({compareIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Watched leads rail */}
      {buyerEmail && <WatchedLeadsRail buyerEmail={buyerEmail} />}

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
            {filtered.map((lead, idx) => {
              const isNew = lastSeenAt > 0 && new Date(lead.created_at).getTime() > lastSeenAt;
              const isFocused = idx === focusIdx;
              const isCompared = compareIds.includes(lead.id);
              const isWatched = watched.includes(lead.id);

              return (
                <div
                  key={lead.id}
                  ref={(el) => { cardRefs.current[lead.id] = el; }}
                  className={cn(
                    "relative transition-all",
                    isFocused && "ring-2 ring-intel-teal/50 rounded-lg",
                  )}
                >
                  {isNew && (
                    <span className="absolute -top-2 -left-2 z-20 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500 text-background shadow-lg">
                      NEW
                    </span>
                  )}
                  <div className="absolute top-2 right-2 z-20 flex gap-1">
                    <button
                      onClick={() => toggleCompare(lead.id)}
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded border transition-colors",
                        isCompared
                          ? "bg-intel-teal/20 border-intel-teal/50 text-intel-teal"
                          : "bg-card/80 border-border/40 text-muted-foreground hover:text-foreground"
                      )}
                      title="Compare (C)"
                    >
                      ⇄
                    </button>
                    <button
                      onClick={() => toggleWatch(lead)}
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded border transition-colors",
                        isWatched
                          ? "bg-seal-gold/20 border-seal-gold/50 text-seal-gold"
                          : "bg-card/80 border-border/40 text-muted-foreground hover:text-foreground"
                      )}
                      title="Watch (W)"
                    >
                      ★
                    </button>
                  </div>
                  <SwipeRow lead={lead} onWatch={toggleWatch} onDismiss={dismissLead}>
                    {soldIds.includes(lead.id) ? (
                      <SoldDossierCard lead={lead} />
                    ) : (
                      <LockedDossierCard lead={lead} onClaim={handleClaim} />
                    )}
                  </SwipeRow>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground mt-10">
          Showing {filtered.length} of {leads.length} live leads · Updated continuously
          <span className="md:hidden block mt-1 opacity-70">Swipe right = watch · left = dismiss</span>
        </p>
      </div>

      <CompareDrawer
        open={compareOpen}
        onOpenChange={setCompareOpen}
        leads={compareLeads}
        onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
        onClaim={handleClaim}
      />

      <FirstLookUpsellGate product={product} leads={leads as any} />
    </div>
  );
}
