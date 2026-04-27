import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Buyer {
  id: string;
  vertical: string;
  company: string;
  contact_name: string | null;
  email: string;
  city: string | null;
}

interface Signal {
  id: string;
  company_name: string;
  industry: string | null;
  predicted_needs: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  signal: Signal | null;
}

const VERTICAL_LABELS: Record<string, string> = {
  hvac: "HVAC",
  electrical: "Electrical",
  plumbing: "Plumbing",
  building_materials: "Building Materials",
  welding_cnc: "Welding / CNC / MRO",
};

// Map a signal's predicted needs / industry → which buyer verticals to surface
function suggestVerticals(signal: Signal): string[] {
  const text = `${signal.industry || ""} ${(signal.predicted_needs || []).join(" ")}`.toLowerCase();
  const out = new Set<string>();
  if (/hvac|heating|cooling|boiler|furnace|chiller|ductwork|refrigerat/.test(text)) out.add("hvac");
  if (/electric|electrical|wiring|panel|conduit|switchgear/.test(text)) out.add("electrical");
  if (/plumb|pipe|pvf|valve|fitting|water|drain/.test(text)) out.add("plumbing");
  if (/building material|concrete|aggregate|lumber|roof|masonry|construction/.test(text)) out.add("building_materials");
  if (/weld|cnc|machin|cutting tool|fastener|mro|industrial supply|consumable|equipment/.test(text)) out.add("welding_cnc");
  // If no match, show all so Matt can still pick
  return out.size > 0 ? Array.from(out) : Object.keys(VERTICAL_LABELS);
}

export default function BuyerOutreachDialog({ open, onOpenChange, signal }: Props) {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [activeVertical, setActiveVertical] = useState<string>("all");

  const suggested = useMemo(() => (signal ? suggestVerticals(signal) : []), [signal]);

  useEffect(() => {
    if (!open || !signal) return;
    setSelected(new Set());
    setActiveVertical("all");
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("industrial_supply_buyers")
        .select("id, vertical, company, contact_name, email, city")
        .in("vertical", suggested)
        .eq("active", true)
        .order("vertical")
        .order("company");
      if (error) toast.error("Failed to load buyers: " + error.message);
      setBuyers(data || []);
      // Pre-select all on first open — Matt can deselect
      setSelected(new Set((data || []).map((b: Buyer) => b.id)));
      setLoading(false);
    })();
  }, [open, signal, suggested.join(",")]);

  const filtered = useMemo(
    () => (activeVertical === "all" ? buyers : buyers.filter((b) => b.vertical === activeVertical)),
    [buyers, activeVertical]
  );

  const verticalsPresent = useMemo(() => Array.from(new Set(buyers.map((b) => b.vertical))), [buyers]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (filtered.every((b) => selected.has(b.id))) {
      setSelected((prev) => { const n = new Set(prev); filtered.forEach((b) => n.delete(b.id)); return n; });
    } else {
      setSelected((prev) => { const n = new Set(prev); filtered.forEach((b) => n.add(b.id)); return n; });
    }
  }

  async function sendBatch() {
    if (!signal || selected.size === 0) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("dossier-cold-outreach-bulk", {
        body: { signal_id: signal.id, buyer_ids: Array.from(selected) },
      });
      if (error) throw error;
      const d = data as any;
      toast.success(
        `${d.queued} queued · ${d.skipped} skipped · ${d.failed} failed. SMS preview sent — cancel within 10 min.`,
        { duration: 7000 }
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Batch send failed: " + (e.message || "unknown"));
    } finally {
      setSending(false);
    }
  }

  if (!signal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0a1628] border-[#00d4ff]/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-400" />
            Cold Email — pitch {signal.company_name} to supply-house buyers
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Each selected buyer gets a personalized 4-sentence email + the dossier PDF on {signal.company_name}.
            Queued with a 10-min ghost delay — one SMS preview to your phone with cancel-all link.
          </DialogDescription>
        </DialogHeader>

        {/* Vertical filter chips */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={activeVertical === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setActiveVertical("all")}
          >
            All ({buyers.length})
          </Badge>
          {verticalsPresent.map((v) => (
            <Badge
              key={v}
              variant={activeVertical === v ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveVertical(v)}
            >
              {VERTICAL_LABELS[v] || v} ({buyers.filter((b) => b.vertical === v).length})
            </Badge>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/50">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading buyers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-white/50 text-sm">
            No buyers seeded for this vertical yet.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-white/60 px-1">
              <button onClick={toggleAll} className="hover:text-[#00d4ff]">
                {filtered.every((b) => selected.has(b.id)) ? "Deselect all" : "Select all"}
              </button>
              <span>{selected.size} selected</span>
            </div>
            <ScrollArea className="h-[340px] rounded border border-white/10">
              <div className="divide-y divide-white/5">
                {filtered.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(b.id)}
                      onCheckedChange={() => toggle(b.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{b.company}</div>
                      <div className="text-xs text-white/50 truncate">
                        {b.email}{b.city ? ` · ${b.city}` : ""}{b.contact_name ? ` · ${b.contact_name}` : ""}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{VERTICAL_LABELS[b.vertical] || b.vertical}</Badge>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-[11px] text-white/40">
            30-day dedup per recipient. PDF link valid 30 days. All cancellable from your phone.
          </p>
          <Button
            onClick={sendBatch}
            disabled={sending || selected.size === 0}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send to {selected.size} buyer{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
