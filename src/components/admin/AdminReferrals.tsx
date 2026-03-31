import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, CheckCircle, Gift } from "lucide-react";

const AdminReferrals = () => {
  const qc = useQueryClient();
  const [giftForm, setGiftForm] = useState({ email: "", session_type: "60_min", note: "" });
  const [giftLoading, setGiftLoading] = useState(false);

  // B2B Partners
  const { data: partners = [], isLoading: partnersLoading } = useQuery({
    queryKey: ["admin-b2b-partners"],
    queryFn: async () => {
      const { data } = await supabase.from("b2b_referral_partners").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // B2B Conversions
  const { data: conversions = [] } = useQuery({
    queryKey: ["admin-b2b-conversions"],
    queryFn: async () => {
      const { data } = await supabase.from("b2b_referral_conversions").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Session Referral Rewards
  const { data: sessionRewards = [] } = useQuery({
    queryKey: ["admin-session-rewards"],
    queryFn: async () => {
      const { data } = await supabase.from("session_referral_rewards").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Approve conversion
  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("b2b_referral_conversions").update({ status: "approved" } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-b2b-conversions"] }); toast.success("Conversion approved"); },
  });

  // Mark paid
  const markPaidMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("b2b_referral_conversions").update({ status: "paid", paid_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-b2b-conversions"] }); toast.success("Marked as paid"); },
  });

  // Manual gift session
  const handleGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftForm.email) { toast.error("Email required"); return; }
    setGiftLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("user_id").eq("email", giftForm.email).maybeSingle();
      if (!profile) { toast.error("No user found with that email"); return; }
      const { error } = await supabase.from("session_referral_rewards").insert({
        referrer_user_id: profile.user_id,
        referred_friend_email: "manual-gift",
        session_type: giftForm.session_type,
        status: "credited",
        note: giftForm.note || "Admin manual gift",
        credited_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      toast.success("Session credit awarded!");
      setGiftForm({ email: "", session_type: "60_min", note: "" });
      qc.invalidateQueries({ queryKey: ["admin-session-rewards"] });
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally {
      setGiftLoading(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === "approved") return "default";
    if (s === "paid" || s === "redeemed") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-8">
      {/* Manual Gift Section */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Gift size={14} /> Award Free Session Credit
        </h3>
        <form onSubmit={handleGift} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs">User Email</Label>
            <Input value={giftForm.email} onChange={(e) => setGiftForm({ ...giftForm, email: e.target.value })} placeholder="user@email.com" className="text-xs" />
          </div>
          <div>
            <Label className="text-xs">Session Type</Label>
            <select value={giftForm.session_type} onChange={(e) => setGiftForm({ ...giftForm, session_type: e.target.value })} className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs">
              <option value="60_min">1 Hour</option>
              <option value="30_min">30 Min</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Note</Label>
            <Input value={giftForm.note} onChange={(e) => setGiftForm({ ...giftForm, note: e.target.value })} placeholder="Referral reward" className="text-xs" />
          </div>
          <Button type="submit" size="sm" disabled={giftLoading}>
            {giftLoading ? <Loader2 size={12} className="animate-spin" /> : "Award"}
          </Button>
        </form>
      </div>

      {/* Session Rewards */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">Session Referral Rewards ({sessionRewards.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-2">Referrer</th>
              <th className="text-left p-2">Friend</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Note</th>
              <th className="text-left p-2">Date</th>
            </tr></thead>
            <tbody>
              {sessionRewards.map((r: any) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="p-2 font-mono text-[10px]">{r.referrer_user_id?.substring(0, 8)}...</td>
                  <td className="p-2">{r.referred_friend_email}</td>
                  <td className="p-2">{r.session_type}</td>
                  <td className="p-2"><Badge variant={statusColor(r.status)}>{r.status}</Badge></td>
                  <td className="p-2 max-w-[120px] truncate">{r.note || "—"}</td>
                  <td className="p-2">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {sessionRewards.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No rewards yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* B2B Partners */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">B2B Referral Partners ({partners.length})</h3>
        {partnersLoading ? <Loader2 size={14} className="animate-spin text-primary" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">Earned</th>
                <th className="text-left p-2">Payout</th>
                <th className="text-left p-2">Status</th>
              </tr></thead>
              <tbody>
                {partners.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="p-2">{p.name}<br/><span className="text-muted-foreground">{p.email}</span></td>
                    <td className="p-2 font-mono">{p.referral_code}</td>
                    <td className="p-2 font-bold">${(p.total_earned || 0).toFixed(0)}</td>
                    <td className="p-2">{p.payout_handle || "—"}</td>
                    <td className="p-2"><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></td>
                  </tr>
                ))}
                {partners.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No partners yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* B2B Conversions */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
          <DollarSign size={14} /> Referral Conversions ({conversions.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-muted-foreground">
              <th className="text-left p-2">Client</th>
              <th className="text-left p-2">Service</th>
              <th className="text-left p-2">Commission</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Actions</th>
            </tr></thead>
            <tbody>
              {conversions.map((c: any) => (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="p-2">{c.client_email}</td>
                  <td className="p-2">{c.service_type}</td>
                  <td className="p-2 font-bold">${(c.commission_amount || 0).toFixed(0)}</td>
                  <td className="p-2"><Badge variant={statusColor(c.status)}>{c.status}</Badge></td>
                  <td className="p-2 flex gap-1">
                    {c.status === "pending" && (
                      <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => approveMut.mutate(c.id)}>
                        <CheckCircle size={10} className="mr-1" /> Approve
                      </Button>
                    )}
                    {c.status === "approved" && (
                      <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => markPaidMut.mutate(c.id)}>
                        <DollarSign size={10} className="mr-1" /> Mark Paid
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {conversions.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No conversions yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReferrals;
