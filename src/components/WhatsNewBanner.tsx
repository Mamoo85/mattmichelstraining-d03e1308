/**
 * Wave B3 — What's New banner for the Owner Dashboard.
 *
 * Reads the last 30 days of public product_changelog entries and shows them
 * as a dismissible carousel. Each item is tagged "Included in your Forever
 * Pricing" so clients see the value of the lock every time they log in.
 *
 * Dismissal is per-id via localStorage so new entries always reappear.
 */
import { useEffect, useMemo, useState } from "react";
import { Sparkles, X, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Entry {
  id: string;
  ship_date: string;
  product: string | null;
  title: string;
  body: string;
  tags: string[] | null;
}

const STORAGE_KEY = "dwa.whats-new.dismissed.v1";
const LOOKBACK_DAYS = 30;

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

export function WhatsNewBanner({ className }: { className?: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("product_changelog")
        .select("id, ship_date, product, title, body, tags")
        .eq("is_public", true)
        .gte("ship_date", since)
        .order("ship_date", { ascending: false })
        .limit(20);
      if (!cancelled) {
        if (!error && data) setEntries(data as Entry[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => entries.filter((e) => !dismissed.has(e.id)), [entries, dismissed]);
  const current = visible[index];

  if (loading || visible.length === 0 || !current) return null;

  const dismiss = () => {
    const next = new Set(dismissed);
    next.add(current.id);
    saveDismissed(next);
    setDismissed(next);
    setIndex(0);
  };

  return (
    <Card className={`border-primary/40 bg-gradient-to-br from-primary/5 to-primary/10 p-5 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-5 w-5 text-primary shrink-0" aria-hidden />
          <div className="text-xs font-extrabold uppercase tracking-wider text-primary">
            What's new · {visible.length} update{visible.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {visible.length > 1 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setIndex((i) => (i - 1 + visible.length) % visible.length)}
                aria-label="Previous update"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-1">
                {index + 1}/{visible.length}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setIndex((i) => (i + 1) % visible.length)}
                aria-label="Next update"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={dismiss}
            aria-label="Dismiss this update"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-base md:text-lg font-bold leading-tight">{current.title}</h3>
        {current.product && (
          <div className="text-xs text-muted-foreground mt-1">
            {current.product} · shipped {new Date(current.ship_date).toLocaleDateString()}
          </div>
        )}
        <p className="text-sm text-foreground/80 mt-2 leading-relaxed">{current.body}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1.5">
          <ShieldCheck className="h-3 w-3" />
          Included in your Forever Pricing
        </Badge>
        <Link
          to="/changelog"
          className="text-xs font-semibold text-primary hover:underline ml-auto"
        >
          View full changelog →
        </Link>
      </div>
    </Card>
  );
}

export default WhatsNewBanner;
