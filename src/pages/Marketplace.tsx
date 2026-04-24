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
import { Flame, Sun, Snowflake, Loader2, Search, ScrollText, Layers, Keyboard, PackageOpen, Bell, AlertTriangle } from "lucide-react";
import { BuyerEmailDialog } from "@/components/marketplace/BuyerEmailDialog";
import { LiveActivityTicker } from "@/components/marketplace/LiveActivityTicker";
import { HowItWorksSheet } from "@/components/marketplace/HowItWorksSheet";
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

function ProductChipRow({ product, onSelect }: { product: ProductKey; onSelect: (k: ProductKey) => void }) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [product]);
  return (
    <div className="relative mt-6 -mx-4 px-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
        {PRODUCTS.map((p) => {
          const active = p.key === product;
          return (
            <button
              key={p.key}
              ref={active ? activeRef : undefined}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(p.key)}
              className={`shrink-0 snap-center px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded border transition-colors ${
                active
                  ? "bg-intel-teal/15 border-intel-teal/50 text-intel-teal"
                  : "bg-card border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute left-0 top-0 bottom-1 w-6 bg-gradient-to-r from-background to-transparent md:hidden" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-background to-transparent md:hidden" />
    </div>
  );
}

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

  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [restockOpen, setRestockOpen] = useState(false);
  const [viewersMap, setViewersMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    Promise.allSettled([
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
    ]).then((results: any[]) => {
      if (cancelled) return;
      const [leadsRes, locksRes] = results;
      if (leadsRes.status === "fulfilled" && !leadsRes.value.error) {
        setLeads((leadsRes.value.data || []) as unknown as MarketplaceLead[]);
      } else {
        console.error("leads load failed", leadsRes);
        setLeads([]);
        setLoadError(true);
      }
      if (locksRes.status === "fulfilled" && !locksRes.value.error) {
        setSoldIds(((locksRes.value.data || []) as Array<{ lead_id: string }>).map((r) => r.lead_id));
      } else {
        console.warn("locks load failed (non-blocking)", locksRes);
        setSoldIds([]);
      }
      setFocusIdx(0);

      // ONE bulk track-views call instead of N per-card calls
      const leadIds = leadsRes.status === "fulfilled" && !leadsRes.value.error
        ? ((leadsRes.value.data || []) as Array<{ id: string }>).map((l) => l.id)
        : [];
      if (leadIds.length > 0) {
        const visitorHash = localStorage.getItem("mp_visitor") || crypto.randomUUID();
        localStorage.setItem("mp_visitor", visitorHash);
        supabase.functions.invoke("marketplace-track-views-bulk", {
          body: { lead_ids: leadIds, product, visitor_hash: visitorHash },
        }).then((res: any) => {
          if (cancelled) return;
          if (res?.data?.viewers) setViewersMap(res.data.viewers);
        }).catch(() => {});
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [product, reloadKey]);

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
      const { getOrCreateAnonId } = await import("@/lib/anonSession");
      const { data, error } = await supabase.functions.invoke("create-marketplace-lead-checkout", {
        body: { lead_id: lead.id, product, buyer_email: email, anon_session_id: getOrCreateAnonId() },
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
      const buyer_token = localStorage.getItem("mp_buyer_token");
      if (email && buyer_token) {
        supabase.functions.invoke("marketplace-watch-add", {
          body: { buyer_email: email, lead_id: lead.id, product, buyer_token },
        }).catch(() => {});
      }
    } else {
      // Removing from watch — also remove from server
      const email = buyerEmail || localStorage.getItem("mp_buyer_email");
      const buyer_token = localStorage.getItem("mp_buyer_token");
      if (email && buyer_token) {
        supabase.functions.invoke("marketplace-watch-add", {
          body: { buyer_email: email, lead_id: lead.id, product, action: "remove", buyer_token },
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
    <div className="min-h-screen bg-background text-foreground pb-24 md:pb-0">
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
              <LiveActivityTicker product={product} totalLeads={leads.length} hotCount={tierCounts.hot} />
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

          {/* Product switcher — horizontally scrollable on mobile with edge fades */}
          <ProductChipRow product={product} onSelect={(k) => setParams({ product: k })} />

          {/* Trust strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1"><span className="text-intel-teal">✓</span> Single-buyer guarantee</span>
            <span className="flex items-center gap-1"><span className="text-intel-teal">✓</span> Refund if uncontactable</span>
            <span className="flex items-center gap-1"><span className="text-intel-teal">✓</span> Cross-referenced sources</span>
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
          <div className="relative flex-shrink-0 max-w-full overflow-hidden">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pr-6">
              {(["all", "hot", "warm", "cool"] as TierFilter[]).map((t) => {
                const Icon = t === "hot" ? Flame : t === "warm" ? Sun : t === "cool" ? Snowflake : null;
                return (
                  <button
                    key={t}
                    onClick={() => setTierFilter(t)}
                    className={`shrink-0 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded border flex items-center gap-1 ${
                      tierFilter === t ? "bg-intel-teal/15 border-intel-teal/50 text-intel-teal" : "border-border/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {Icon && <Icon className="w-3 h-3" />}
                    {t} <span className="opacity-50">({tierCounts[t]})</span>
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background/95 to-transparent md:hidden" />
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
        ) : loadError ? (
          <div className="text-center py-20">
            <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-destructive" />
            <p className="text-muted-foreground mb-4">Couldn't load this marketplace. Network or server hiccup.</p>
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <PackageOpen className="w-10 h-10 mx-auto mb-3 text-intel-teal/70" />
            <h2 className="text-xl font-bold mb-2">Restocking {productMeta.label.toLowerCase()}</h2>
            <p className="text-muted-foreground text-sm mb-5">
              Fresh leads are being scored right now. New batches drop every 15 min for First Look subscribers, every 60 min for everyone else.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={() => setRestockOpen(true)} className="bg-intel-teal text-background hover:bg-intel-teal/90">
                <Bell className="w-4 h-4 mr-1" /> Notify me when stocked
              </Button>
              <Button variant="outline" onClick={() => setParams({ product: "mortgage" })}>
                Browse other verticals
              </Button>
            </div>
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
                      <LockedDossierCard lead={lead} onClaim={handleClaim} viewersNow={viewersMap[lead.id] || 0} />
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

      <BuyerEmailDialog
        open={restockOpen}
        onOpenChange={setRestockOpen}
        defaultEmail={buyerEmail}
        title={`Notify me when ${productMeta.label.toLowerCase()} are restocked`}
        description="We'll email you the moment new leads land in this vertical."
        onConfirm={async (email) => {
          localStorage.setItem("mp_buyer_email", email);
          setBuyerEmail(email);
          try {
            await supabase.functions.invoke("marketplace-watch-add", {
              body: { buyer_email: email, product, action: "restock_notify" },
            });
            toast.success("You're on the restock list.");
          } catch (e) {
            console.error(e);
            toast.error("Couldn't save — try again.");
          }
        }}
      />
    </div>
  );
}
