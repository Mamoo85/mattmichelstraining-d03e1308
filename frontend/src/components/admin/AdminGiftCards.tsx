import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Gift, CheckCircle, Clock, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AdminGiftCards = () => {
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["admin-gift-cards"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gift_cards" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const totalPurchased = cards.reduce((s: number, c: any) => s + (c.original_amount || 0), 0);
  const totalRedeemed = cards.reduce((s: number, c: any) => s + ((c.original_amount || 0) - (c.remaining_balance || 0)), 0);
  const activeCount = cards.filter((c: any) => c.is_active && c.remaining_balance > 0).length;
  const redeemedCount = cards.filter((c: any) => !c.is_active || c.remaining_balance === 0).length;

  const statCards = [
    { label: "Total Sold", value: `$${totalPurchased.toFixed(0)}`, icon: DollarSign, color: "text-primary" },
    { label: "Total Redeemed", value: `$${totalRedeemed.toFixed(0)}`, icon: CheckCircle, color: "text-green-500" },
    { label: "Active Cards", value: String(activeCount), icon: Gift, color: "text-blue-500" },
    { label: "Fully Used", value: String(redeemedCount), icon: Clock, color: "text-muted-foreground" },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-foreground mb-1">Gift Cards</h2>
        <p className="text-xs text-muted-foreground">{cards.length} total issued</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-card border border-border p-4">
              <Icon size={16} className={`${s.color} mb-2`} />
              <div className="text-xl font-black text-foreground">{s.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      {cards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No gift cards yet.</div>
      ) : (
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Code</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Remaining</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Purchaser</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Recipient</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c: any) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/10">
                  <td className="px-3 py-2 font-mono text-foreground">{c.code}</td>
                  <td className="px-3 py-2 font-bold text-foreground">${c.original_amount}</td>
                  <td className="px-3 py-2 text-green-600">${(c.remaining_balance || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.purchaser_email || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.recipient_email || "—"}</td>
                  <td className="px-3 py-2">
                    {c.is_active && c.remaining_balance > 0 ? (
                      <Badge variant="default" className="text-[10px]">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Used</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminGiftCards;
