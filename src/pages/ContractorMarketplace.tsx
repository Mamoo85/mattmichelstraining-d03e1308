import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Zap, Home, Clock, CheckCircle, Lock, Phone } from "lucide-react";
import { trackTrialEvent } from "@/lib/trialFunnel";

const MKT_PRODUCT_KEY = "contractor_marketplace";

const TRADES = ["All", "Electrical", "HVAC", "Plumbing", "Roofing", "Gutters", "Siding", "Boiler"];

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  hot:  { label: "Hot Lead",  color: "bg-red-500/20 text-red-400 border-red-500/30",    icon: "🔥" },
  warm: { label: "Warm Lead", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: "♨️" },
  cool: { label: "Cool Lead", color: "bg-blue-500/20 text-blue-400 border-blue-500/30",  icon: "🌊" },
};

interface Lead {
  id: string;
  trade: string;
  city: string;
  project_type: string | null;
  quality_score: number | null;
  lead_tier: string | null;
  estimated_home_value: number | null;
  ownership_years: number | null;
  identity_verified: boolean | null;
  email_deliverable: boolean | null;
  created_at: string;
  is_locked: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (m < 2) return "Just posted";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function LeadCard({ lead, onClaim }: { lead: Lead; onClaim: (lead: Lead) => void }) {
  const tier = TIER_CONFIG[lead.lead_tier ?? "cool"] ?? TIER_CONFIG.cool;
  const valueStr = lead.estimated_home_value
    ? `$${Math.round(lead.estimated_home_value / 1000)}k est. value`
    : null;

  return (
    <div className="bg-[#0f1e35] border border-white/10 rounded-xl p-5 flex flex-col gap-3 hover:border-[#00d4ff]/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold capitalize">{lead.trade}</span>
            <span className="text-white/50 text-sm">· {lead.city}, MI</span>
            {lead.is_locked && (
              <span className="flex items-center gap-1 text-yellow-400 text-xs">
                <Lock size={10} /> Someone viewing
              </span>
            )}
          </div>
          <p className="text-white/70 text-sm mt-1">{lead.project_type || "Home service inquiry"}</p>
        </div>
        <Badge variant="outline" className={`text-xs shrink-0 ${tier.color}`}>
          {tier.icon} {tier.label}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-white/50">
        {lead.identity_verified && (
          <span className="flex items-center gap-1 text-teal-400">
            <CheckCircle size={11} /> ID Verified
          </span>
        )}
        {lead.email_deliverable && (
          <span className="flex items-center gap-1 text-teal-400">
            <CheckCircle size={11} /> Email Good
          </span>
        )}
        {valueStr && (
          <span className="flex items-center gap-1">
            <Home size={11} /> {valueStr}
          </span>
        )}
        {lead.ownership_years != null && (
          <span>{lead.ownership_years}yr owner</span>
        )}
        {lead.quality_score != null && (
          <span>Score {lead.quality_score}/10</span>
        )}
        <span className="flex items-center gap-1 ml-auto">
          <Clock size={11} /> {timeAgo(lead.created_at)}
        </span>
      </div>

      <Button
        onClick={() => onClaim(lead)}
        className="w-full bg-[#00d4ff] hover:bg-[#00b8e0] text-[#0a1628] font-bold mt-1"
      >
        <Zap size={14} className="mr-1" /> Claim This Lead — $50
      </Button>
      <p className="text-center text-white/30 text-xs">Exclusive · You get name, phone & email · One buyer only</p>
    </div>
  );
}

export default function ContractorMarketplace() {
  const [trade, setTrade] = useState("All");
  const [claimLead, setClaimLead] = useState<Lead | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState("");
  const [notifySent, setNotifySent] = useState(false);

  useEffect(() => {
    trackTrialEvent("view", MKT_PRODUCT_KEY, { metadata: { page: "/contractor-marketplace" } });
  }, []);

  useEffect(() => {
    if (claimLead) {
      trackTrialEvent("form_focus", MKT_PRODUCT_KEY, {
        metadata: { lead_id: claimLead.id, trade: claimLead.trade, tier: claimLead.lead_tier },
      });
    }
  }, [claimLead]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["contractor_leads_marketplace"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contractor_leads_marketplace")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
    refetchInterval: 30000,
  });

  const filtered = trade === "All"
    ? leads
    : leads.filter(l => l.trade?.toLowerCase() === trade.toLowerCase());

  async function handleClaim() {
    if (!email || !claimLead) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-contractor-ppl-checkout", {
        body: { lead_id: claimLead.id, email },
      });
      if (error || !data?.url) throw new Error(error?.message || "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function handleNotify() {
    if (!notifyPhone) return;
    toast.success("Got it — we'll text you when a lead drops in this trade.");
    setNotifySent(true);
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0a1628]/95 backdrop-blur sticky top-0 z-20 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold">
              <span className="text-[#00d4ff]">Detroit</span> Contractor Lead Exchange
            </h1>
            <p className="text-white/50 text-sm">$50/lead · No subscription · Exclusive to one buyer</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Phone size={13} />
            <span>Questions? Call <a href="tel:+13139921219" className="text-[#00d4ff]">(313) 992-1219</a></span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Trade filter */}
        <div className="flex gap-2 flex-wrap">
          {TRADES.map(t => (
            <button
              key={t}
              onClick={() => setTrade(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                trade === t
                  ? "bg-[#00d4ff] text-[#0a1628]"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-sm text-white/50">
          <span><span className="text-white font-semibold">{filtered.length}</span> leads available</span>
          {filtered.filter(l => l.lead_tier === "hot").length > 0 && (
            <span className="text-red-400">🔥 {filtered.filter(l => l.lead_tier === "hot").length} hot</span>
          )}
          <span className="ml-auto text-xs">Updates every 30s</span>
        </div>

        {/* Lead grid */}
        {isLoading ? (
          <div className="text-white/40 text-sm py-12 text-center">Loading available leads…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#0f1e35] border border-white/10 rounded-xl p-10 text-center space-y-4">
            <p className="text-white/60">No {trade === "All" ? "" : trade + " "}leads available right now.</p>
            <p className="text-white/40 text-sm">Leave your number and we'll text you the moment one drops.</p>
            {!notifySent ? (
              <div className="flex gap-2 max-w-xs mx-auto">
                <Input
                  placeholder="Your cell number"
                  value={notifyPhone}
                  onChange={e => setNotifyPhone(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                />
                <Button onClick={handleNotify} className="bg-[#00d4ff] text-[#0a1628] font-bold shrink-0">
                  Notify Me
                </Button>
              </div>
            ) : (
              <p className="text-teal-400 text-sm">✓ You're on the list</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(lead => (
              <LeadCard key={lead.id} lead={lead} onClaim={setClaimLead} />
            ))}
          </div>
        )}
      </div>

      {/* Claim dialog */}
      <Dialog open={!!claimLead} onOpenChange={o => { if (!o) setClaimLead(null); }}>
        <DialogContent className="bg-[#0f1e35] border-white/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Claim This Lead — $50</DialogTitle>
          </DialogHeader>
          {claimLead && (
            <div className="space-y-4">
              <div className="bg-white/5 rounded-lg p-3 text-sm space-y-1">
                <div className="font-semibold capitalize">{claimLead.trade} · {claimLead.city}</div>
                <div className="text-white/60">{claimLead.project_type || "Home service inquiry"}</div>
                <div className="text-white/40 text-xs">You get: full name, phone number, email address</div>
              </div>
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleClaim()}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30"
                autoFocus
              />
              <Button
                onClick={handleClaim}
                disabled={loading || !email}
                className="w-full bg-[#00d4ff] hover:bg-[#00b8e0] text-[#0a1628] font-bold"
              >
                {loading ? "Redirecting…" : "Pay $50 & Claim Lead →"}
              </Button>
              <p className="text-center text-white/30 text-xs">
                Secured by Stripe · One buyer only · No refunds once contact info is revealed
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
