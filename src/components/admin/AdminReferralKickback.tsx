// Channel 10 — Referral kickback admin tool.
// Lists active PPL contractors. One-click "Send referral SMS" generates the draft into
// sms_reply_drafts (existing approval flow — Matt approves with Y/A in inbound-sms-relay).
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, Loader2, RefreshCw, Send, CheckCircle2 } from "lucide-react";

interface Contractor {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  phone: string | null;
  trade: string | null;
  city: string | null;
}

interface Kickback {
  id: string;
  contractor_id: string | null;
  status: string;
  created_at: string;
}

export default function AdminReferralKickback() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [history, setHistory] = useState<Kickback[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: h }] = await Promise.all([
      (supabase as any)
        .from("contractor_clients")
        .select("id,business_name,contact_name,phone,trade,city")
        .eq("subscription_status", "active")
        .not("phone", "is", null)
        .limit(50),
      (supabase as any)
        .from("referral_kickback")
        .select("id,contractor_id,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setContractors(c || []);
    setHistory(h || []);
    setLoading(false);
  }

  const sentMap = useMemo(() => {
    const m: Record<string, Kickback> = {};
    history.forEach(h => { if (h.contractor_id && !m[h.contractor_id]) m[h.contractor_id] = h; });
    return m;
  }, [history]);

  function smsBody(c: Contractor): string {
    const trade = c.trade || "trade";
    const supplyMap: Record<string, string> = {
      hvac: "HVAC supply rep at Behler-Young or Standard Supply",
      plumbing: "plumbing supply rep at Ferguson",
      electrical: "electrical supply rep at Madison or Standard Electric",
      roofing: "roofing supply rep at ABC Supply",
    };
    const supplyHook = supplyMap[trade.toLowerCase()] || "supply rep you talk to most";
    return `Hey ${c.contact_name?.split(" ")[0] || ""} — Matt at DWA. Quick favor: know your ${supplyHook}? I built a tool they'd want. Refer them, you get $50 off next month if they buy. Reply YES + their name & # and I'll handle it. Stop = opt out.`;
  }

  async function sendReferral(c: Contractor) {
    if (!c.phone) return;
    setSendingId(c.id);
    try {
      const body = smsBody(c);
      const { error } = await (supabase as any).from("sms_reply_drafts").insert({
        phone: c.phone,
        draft_body: body,
        status: "pending",
        metadata: {
          source: "referral_kickback",
          contractor_id: c.id,
          template: "ppl_supplier_referral",
        },
      });
      if (error) throw error;
      const { error: kbError } = await (supabase as any).from("referral_kickback").insert({
        contractor_id: c.id,
        contractor_phone: c.phone,
        status: "draft_pending",
      });
      if (kbError) throw kbError;
      toast.success("Draft queued — approve in SMS Drafts tab");
      await load();
    } catch (e: any) {
      toast.error("Failed: " + (e.message || "unknown"));
    } finally {
      setSendingId(null);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00d4ff]" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Gift className="h-5 w-5 text-[#00d4ff]" /> Referral Kickback ($50/refer)
          </h2>
          <p className="text-white/40 text-xs mt-1">SMS active PPL contractors · they refer their supply rep · you get $50 off next month if rep buys</p>
        </div>
        <Button size="sm" onClick={load} className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30">
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-3 text-[11px] text-emerald-300/80">
        Drafts route through your existing SMS approval flow — confirm with <strong>Y</strong> in the SMS Drafts tab before they send.
      </div>

      <div className="space-y-2">
        {contractors.length === 0 && (
          <Card className="bg-[#0f1f35] border-white/10"><CardContent className="py-8 text-center text-white/40 text-sm">No active PPL contractors with phone numbers.</CardContent></Card>
        )}
        {contractors.map(c => {
          const sent = sentMap[c.id];
          return (
            <Card key={c.id} className="bg-[#0f1f35] border-white/10">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{c.business_name || c.contact_name || "—"}</p>
                  <p className="text-white/40 text-xs">{[c.trade, c.city, c.phone].filter(Boolean).join(" · ")}</p>
                </div>
                {sent ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] shrink-0">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> {sent.status}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={sendingId === c.id}
                    onClick={() => sendReferral(c)}
                    className="bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/20 shrink-0"
                  >
                    {sendingId === c.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                    Queue Draft
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
