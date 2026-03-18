import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Users, TrendingUp, MoreHorizontal, Loader2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Transaction {
  id: string;
  user_id: string | null;
  stripe_charge_id: string | null;
  stripe_subscription_id: string | null;
  amount: number;
  item_name: string;
  item_type: string;
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  created_at: string;
}

const AdminFinancials = () => {
  const queryClient = useQueryClient();
  const [actionRow, setActionRow] = useState<Transaction | null>(null);
  const [actionType, setActionType] = useState<"refund" | "cancel" | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Metrics
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const completedTxns = transactions.filter((t) => t.status === "completed");
  const last30 = completedTxns.filter((t) => new Date(t.created_at) >= thirtyDaysAgo);

  const totalSales30 = last30.reduce((sum, t) => sum + t.amount, 0);
  const subscriptionTxns = last30.filter((t) => t.item_type === "subscription");
  const mrr = subscriptionTxns.reduce((sum, t) => sum + t.amount, 0);
  const activeSubs = transactions.filter(
    (t) => t.item_type === "subscription" && t.status === "completed"
  ).length;

  const refundMutation = useMutation({
    mutationFn: async (row: Transaction) => {
      const { data, error } = await supabase.functions.invoke("issue-refund", {
        body: { transaction_id: row.id, charge_id: row.stripe_charge_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      toast({ title: "Refund issued successfully" });
      setActionRow(null);
      setActionType(null);
    },
    onError: (err: Error) =>
      toast({ title: "Refund failed", description: err.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (row: Transaction) => {
      const { data, error } = await supabase.functions.invoke("cancel-user-subscription", {
        body: {
          transaction_id: row.id,
          subscription_id: row.stripe_subscription_id,
          customer_email: row.customer_email,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      toast({ title: "Subscription cancelled" });
      setActionRow(null);
      setActionType(null);
    },
    onError: (err: Error) =>
      toast({ title: "Cancellation failed", description: err.message, variant: "destructive" }),
  });

  const formatAmount = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const displayName = (t: Transaction | null) => t?.customer_name || t?.customer_email || "Unknown";

  const statusColor = (s: string) => {
    if (s === "completed") return "text-green-500";
    if (s === "refunded") return "text-red-400";
    if (s === "cancelled") return "text-muted-foreground";
    return "text-foreground";
  };

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card shadow-m2 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">MRR</p>
          </div>
          <p className="text-xl font-mono font-bold text-foreground">{formatAmount(mrr)}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={12} className="text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">30-Day Sales</p>
          </div>
          <p className="text-xl font-mono font-bold text-foreground">{formatAmount(totalSales30)}</p>
        </div>
        <div className="bg-card shadow-m2 p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={12} className="text-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Subs</p>
          </div>
          <p className="text-xl font-mono font-bold text-foreground">{activeSubs}</p>
        </div>
      </div>

      {/* Refresh */}
      <div className="flex justify-between items-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Transaction Ledger</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-transactions"] })}
          className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-1 transition-m2"
        >
          <RefreshCw size={10} /> Refresh
        </button>
      </div>

      {/* Ledger Table */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="text-primary animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-card shadow-m2 p-8 text-center">
          <p className="text-sm text-foreground font-bold">No transactions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Transactions will appear here as sales come in</p>
        </div>
      ) : (
        <div className="bg-card shadow-m2 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[80px_1fr_1fr_70px_70px_36px] gap-2 px-3 py-2 bg-muted text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>Date</span>
            <span>Client</span>
            <span>Item</span>
            <span className="text-right">Amount</span>
            <span className="text-center">Status</span>
            <span></span>
          </div>

          {/* Rows */}
          {transactions.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[80px_1fr_1fr_70px_70px_36px] gap-2 px-3 py-2.5 border-b border-border items-center hover:bg-secondary/30 transition-m2 relative"
            >
              <span className="text-[11px] text-muted-foreground font-mono">
                {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span className="text-xs text-foreground font-semibold truncate">{displayName(t)}</span>
              <span className="text-xs text-muted-foreground truncate">{t.item_name}</span>
              <span className="text-xs font-mono text-foreground text-right">{formatAmount(t.amount)}</span>
              <span className={`text-[10px] font-bold uppercase tracking-widest text-center ${statusColor(t.status)}`}>
                {t.status}
              </span>
              <div className="relative">
                {t.status === "completed" && (
                  <button
                    onClick={() => setOpenDropdown(openDropdown === t.id ? null : t.id)}
                    className="text-muted-foreground hover:text-foreground transition-m2 p-1"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                )}
                {openDropdown === t.id && (
                  <div className="absolute right-0 top-7 z-50 bg-card border border-border shadow-lg min-w-[140px]">
                    {t.item_type !== "subscription" && t.stripe_charge_id && (
                      <button
                        onClick={() => {
                          setActionRow(t);
                          setActionType("refund");
                          setOpenDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-muted transition-m2"
                      >
                        Issue Refund
                      </button>
                    )}
                    {t.item_type === "subscription" && (
                      <button
                        onClick={() => {
                          setActionRow(t);
                          setActionType("cancel");
                          setOpenDropdown(null);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-muted transition-m2"
                      >
                        Cancel Subscription
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!actionRow && !!actionType} onOpenChange={() => { setActionRow(null); setActionType(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "refund" ? "Issue Refund" : "Cancel Subscription"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "refund"
                ? `Are you sure you want to refund ${formatAmount(actionRow?.amount || 0)} to ${displayName(actionRow!)}? This action cannot be undone.`
                : `Are you sure you want to cancel ${displayName(actionRow!)}'s subscription? They will immediately lose portal access.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!actionRow) return;
                if (actionType === "refund") refundMutation.mutate(actionRow);
                else cancelMutation.mutate(actionRow);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionType === "refund" ? "Confirm Refund" : "Confirm Cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminFinancials;
