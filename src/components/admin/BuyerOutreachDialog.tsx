import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Mail, Send, MessageSquare, Printer, Mailbox, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Channel = "email" | "sms" | "fax" | "postcard";

interface Buyer {
  id: string;
  vertical: string;
  company: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  fax: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  enrichment_status: string | null;
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
  hvac: "HVAC", electrical: "Electrical", plumbing: "Plumbing",
  building_materials: "Building Materials", welding_cnc: "Welding / CNC / MRO",
};

const CHANNEL_META: Record<Channel, { label: string; icon: any; cost: number; field: keyof Buyer }> = {
  email:    { label: "Email",    icon: Mail,           cost: 0,    field: "email" },
  sms:      { label: "SMS",      icon: MessageSquare,  cost: 1,    field: "phone" },
  fax:      { label: "Fax",      icon: Printer,        cost: 7,    field: "fax" },
  postcard: { label: "Postcard", icon: Mailbox,        cost: 85,   field: "address" },
};

function suggestVerticals(signal: Signal): string[] {
  const text = `${signal.industry || ""} ${(signal.predicted_needs || []).join(" ")}`.toLowerCase();
  const out = new Set<string>();
  if (/hvac|heating|cooling|boiler|furnace|chiller|ductwork|refrigerat/.test(text)) out.add("hvac");
  if (/electric|electrical|wiring|panel|conduit|switchgear/.test(text)) out.add("electrical");
  if (/plumb|pipe|pvf|valve|fitting|water|drain/.test(text)) out.add("plumbing");
  if (/building material|concrete|aggregate|lumber|roof|masonry|construction/.test(text)) out.add("building_materials");
  if (/weld|cnc|machin|cutting tool|fastener|mro|industrial supply|consumable|equipment/.test(text)) out.add("welding_cnc");
  return out.size > 0 ? Array.from(out) : Object.keys(VERTICAL_LABELS);
}

export default function BuyerOutreachDialog({ open, onOpenChange, signal }: Props) {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [activeVertical, setActiveVertical] = useState<string>("all");
  const [channels, setChannels] = useState<Set<Channel>>(new Set(["email"]));

  const suggested = useMemo(() => (signal ? suggestVerticals(signal) : []), [signal]);

  async function loadBuyers() {
    if (!signal) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("industrial_supply_buyers")
      .select("id, vertical, company, contact_name, email, phone, fax, address, city, zip, enrichment_status")
      .in("vertical", suggested)
      .eq("active", true)
      .order("vertical")
      .order("company");
    if (error) toast.error("Failed to load buyers: " + error.message);
    setBuyers(data || []);
    setSelected(new Set((data || []).map((b: Buyer) => b.id)));
    setLoading(false);
  }

  useEffect(() => {
    if (!open || !signal) return;
    setChannels(new Set(["email"]));
    setActiveVertical("all");
    loadBuyers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signal, suggested.join(",")]);

  const filtered = useMemo(
    () => (activeVertical === "all" ? buyers : buyers.filter((b) => b.vertical === activeVertical)),
    [buyers, activeVertical]
  );
  const verticalsPresent = useMemo(() => Array.from(new Set(buyers.map((b) => b.vertical))), [buyers]);

  const reachableCounts = useMemo(() => {
    const sel = buyers.filter((b) => selected.has(b.id));
    return {
      email: sel.filter((b) => !!b.email).length,
      sms: sel.filter((b) => !!b.phone).length,
      fax: sel.filter((b) => !!b.fax).length,
      postcard: sel.filter((b) => !!b.address && !!b.zip).length,
    };
  }, [buyers, selected]);

  const totalCost = useMemo(() => {
    let c = 0;
    for (const ch of channels) c += reachableCounts[ch] * CHANNEL_META[ch].cost;
    return c;
  }, [channels, reachableCounts]);

  const totalSends = useMemo(() => {
    let n = 0;
    for (const ch of channels) n += reachableCounts[ch];
    return n;
  }, [channels, reachableCounts]);

  function toggle(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    if (filtered.every((b) => selected.has(b.id))) {
      setSelected((p) => { const n = new Set(p); filtered.forEach((b) => n.delete(b.id)); return n; });
    } else {
      setSelected((p) => { const n = new Set(p); filtered.forEach((b) => n.add(b.id)); return n; });
    }
  }
  function toggleChannel(ch: Channel) {
    setChannels((p) => { const n = new Set(p); n.has(ch) ? n.delete(ch) : n.add(ch); return n; });
  }

  async function enrichMissing() {
    setEnriching(true);
    try {
      const ids = buyers.filter((b) => !b.phone || !b.address).map((b) => b.id);
      if (ids.length === 0) { toast.info("All buyers already enriched"); return; }
      const { data, error } = await supabase.functions.invoke("enrich-supply-buyers", { body: { buyer_ids: ids } });
      if (error) throw error;
      const d = data as any;
      toast.success(`Enriched ${d.enriched} · partial ${d.partial} · failed ${d.failed}`);
      await loadBuyers();
    } catch (e: any) {
      toast.error("Enrich failed: " + (e.message || "unknown"));
    } finally { setEnriching(false); }
  }

  async function sendBatch() {
    if (!signal || selected.size === 0 || channels.size === 0) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("signal-channel-blast", {
        body: { signal_id: signal.id, buyer_ids: Array.from(selected), channels: Array.from(channels) },
      });
      if (error) throw error;
      const d = data as any;
      const t = d.totals || {};
      toast.success(
        `${t.queued || 0} sent · ${t.skipped || 0} skipped · ${t.failed || 0} failed · $${((t.cost_cents || 0)/100).toFixed(2)} spent`,
        { duration: 8000 }
      );
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Batch send failed: " + (e.message || "unknown"));
    } finally { setSending(false); }
  }

  if (!signal) return null;

  const needsEnrichment = buyers.some((b) => !b.phone || !b.address);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0a1628] border-[#00d4ff]/20 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-400" />
            Multi-Channel Blast — {signal.company_name}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Pitch the {signal.company_name} signal across email, SMS, fax & postcard. 30-day per-channel dedup, daily caps enforced, all cancellable from your phone.
          </DialogDescription>
        </DialogHeader>

        {/* Channel toggle row */}
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => {
            const meta = CHANNEL_META[ch];
            const Icon = meta.icon;
            const active = channels.has(ch);
            const count = reachableCounts[ch];
            return (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`p-3 rounded border text-left transition ${
                  active
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-300"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-semibold">{meta.label}</span>
                </div>
                <div className="text-[11px] opacity-80">{count} ready · {meta.cost === 0 ? "free" : `${meta.cost}¢ ea`}</div>
              </button>
            );
          })}
        </div>

        {/* Enrich button */}
        {needsEnrichment && (
          <Button
            variant="outline"
            size="sm"
            onClick={enrichMissing}
            disabled={enriching}
            className="border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff]/10"
          >
            {enriching ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Sparkles className="w-3 h-3 mr-2" />}
            Enrich missing phone/fax/address (Google Places)
          </Button>
        )}

        {/* Vertical filter chips */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={activeVertical === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setActiveVertical("all")}>
            All ({buyers.length})
          </Badge>
          {verticalsPresent.map((v) => (
            <Badge key={v} variant={activeVertical === v ? "default" : "outline"} className="cursor-pointer" onClick={() => setActiveVertical(v)}>
              {VERTICAL_LABELS[v] || v} ({buyers.filter((b) => b.vertical === v).length})
            </Badge>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/50">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading buyers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-white/50 text-sm">No buyers seeded for this vertical yet.</div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-white/60 px-1">
              <button onClick={toggleAll} className="hover:text-[#00d4ff]">
                {filtered.every((b) => selected.has(b.id)) ? "Deselect all" : "Select all"}
              </button>
              <span>{selected.size} selected</span>
            </div>
            <ScrollArea className="h-[300px] rounded border border-white/10">
              <div className="divide-y divide-white/5">
                {filtered.map((b) => (
                  <label key={b.id} className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer">
                    <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{b.company}</div>
                      <div className="text-xs text-white/50 truncate">
                        {b.email}{b.city ? ` · ${b.city}` : ""}{b.contact_name ? ` · ${b.contact_name}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Mail className={`w-3 h-3 ${b.email ? "text-emerald-400" : "text-white/15"}`} />
                      <MessageSquare className={`w-3 h-3 ${b.phone ? "text-emerald-400" : "text-white/15"}`} />
                      <Printer className={`w-3 h-3 ${b.fax ? "text-emerald-400" : "text-white/15"}`} />
                      <Mailbox className={`w-3 h-3 ${b.address && b.zip ? "text-emerald-400" : "text-white/15"}`} />
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <p className="text-[11px] text-white/40">
            30-day dedup · daily caps · TCPA quiet-hours · 10-min SMS/email cancel
          </p>
          <Button
            onClick={sendBatch}
            disabled={sending || selected.size === 0 || channels.size === 0 || totalSends === 0}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send {totalSends} {totalSends === 1 ? "message" : "messages"} · ${(totalCost/100).toFixed(2)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
