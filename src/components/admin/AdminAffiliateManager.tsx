import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, DollarSign, Users, TrendingUp, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminAffiliateManager = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [marking, setMarking] = useState(false);
  const [runningCalc, setRunningCalc] = useState(false);
  const [runningReport, setRunningReport] = useState(false);

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ["admin-affiliate-commissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliate_commissions" as any)
        .select("*, profiles:referrer_user_id(email, full_name)")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["admin-affiliate-batches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("affiliate_payout_batches" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
  });

  const pendingCommissions = commissions.filter((c: any) => c.status === "pending");
  const approvedCommissions = commissions.filter((c: any) => c.status === "approved");
  const totalPending = pendingCommissions.reduce((s: number, c: any) => s + (c.commission_amount_cents || 0), 0);
  const totalApproved = approvedCommissions.reduce((s: number, c: any) => s + (c.commission_amount_cents || 0), 0);

  const uniqueAffiliates = new Set(commissions.map((c: any) => c.referrer_user_id)).size;

  const markPaid = async (ids: string[]) => {
    setMarking(true);
    try {
      await supabase
        .from("affiliate_commissions" as any)
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", ids);
      toast({ title: "Commissions marked as paid" });
      qc.invalidateQueries({ queryKey: ["admin-affiliate-commissions"] });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setMarking(false);
    }
  };

  const runCalculate = async () => {
    setRunningCalc(true);
    try {
      const { error } = await supabase.functions.invoke("calculate-affiliate-commissions");
      if (error) throw error;
      toast({ title: "Commissions calculated" });
      qc.invalidateQueries({ queryKey: ["admin-affiliate-commissions"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRunningCalc(false);
    }
  };

  const runReport = async () => {
    setRunningReport(true);
    try {
      const { error } = await supabase.functions.invoke("send-affiliate-payout-report");
      if (error) throw error;
      toast({ title: "Payout report sent", description: "Check your email" });
      qc.invalidateQueries({ queryKey: ["admin-affiliate-batches"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setRunningReport(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-1">Affiliate Commissions</h2>
          <p className="text-xs text-muted-foreground">{commissions.length} total commissions · {uniqueAffiliates} affiliates</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={runCalculate} disabled={runningCalc}>
            {runningCalc ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
            Calculate New
          </Button>
          <Button size="sm" variant="outline" onClick={runReport} disabled={runningReport}>
            {runningReport ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
            Send Payout Report
          </Button>
          {approvedCommissions.length > 0 && (
            <Button
              size="sm"
              onClick={() => markPaid(approvedCommissions.map((c: any) => c.id))}
              disabled={marking}
            >
              {marking ? <Loader2 size={12} className="animate-spin mr-1" /> : <CheckCircle size={12} className="mr-1" />}
              Mark All Approved as Paid
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Commissions", value: commissions.length, icon: TrendingUp, color: "text-primary" },
          { label: "Affiliates", value: uniqueAffiliates, icon: Users, color: "text-blue-500" },
          { label: "Pending Payout", value: `$${(totalPending / 100).toFixed(2)}`, icon: DollarSign, color: "text-yellow-500" },
          { label: "Approved (Owed)", value: `$${(totalApproved / 100).toFixed(2)}`, icon: CheckCircle, color: "text-green-500" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border p-4">
              <Icon size={14} className={`${s.color} mb-2`} />
              <div className="text-xl font-black text-foreground">{s.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Commissions Table */}
      {commissions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No commissions yet.</div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Affiliate</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Tier</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c: any) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/10">
                  <td className="px-3 py-2">
                    <div className="text-foreground font-medium">{c.profiles?.full_name || "Unknown"}</div>
                    <div className="text-muted-foreground">{c.profiles?.email || c.referrer_user_id}</div>
                  </td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{c.tier?.replace("_", " ")}</td>
                  <td className="px-3 py-2 font-black text-green-500">${(c.commission_amount_cents / 100).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={c.status === "paid" ? "secondary" : c.status === "approved" ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    {c.status === "approved" && (
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => markPaid([c.id])}>
                        Mark Paid
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payout Batches */}
      {batches.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Payout History</h3>
          <div className="space-y-2">
            {batches.map((b: any) => (
              <div key={b.id} className="flex justify-between items-center py-2 border-b border-border text-xs">
                <span className="text-muted-foreground">{b.month}</span>
                <span className="text-foreground">{b.affiliates_count} affiliates</span>
                <span className="font-bold text-green-500">${((b.total_commissions_cents || 0) / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAffiliateManager;
