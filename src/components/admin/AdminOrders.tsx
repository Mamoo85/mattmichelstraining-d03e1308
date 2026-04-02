import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Clock, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const statusBadge = (status: string) => {
  switch (status) {
    case "delivered":
      return <Badge className="bg-green-600/20 text-green-400 border-green-600/30"><CheckCircle size={10} className="mr-1" /> Delivered</Badge>;
    case "processing":
      return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30"><Clock size={10} className="mr-1" /> Processing</Badge>;
    case "failed":
      return <Badge className="bg-red-600/20 text-red-400 border-red-600/30"><AlertTriangle size={10} className="mr-1" /> Failed</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground"><Clock size={10} className="mr-1" /> {status || "pending"}</Badge>;
  }
};

const OrderTable = ({ data, columns }: { data: any[]; columns: { key: string; label: string }[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border">
          {columns.map(c => <th key={c.key} className="text-left py-2 px-3 text-muted-foreground font-bold uppercase tracking-widest text-[10px]">{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr><td colSpan={columns.length} className="py-8 text-center text-muted-foreground">No orders yet</td></tr>
        ) : data.map((row, i) => (
          <tr key={row.id || i} className="border-b border-border/50 hover:bg-muted/30">
            {columns.map(c => (
              <td key={c.key} className="py-2 px-3">
                {c.key === "status" ? statusBadge(row[c.key]) :
                 c.key === "created_at" ? format(new Date(row[c.key]), "MMM d, h:mm a") :
                 <span className="text-foreground">{row[c.key] || "—"}</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const AdminOrders = () => {
  const [activeTab, setActiveTab] = useState("failures");

  const { data: failures = [], refetch: refetchFailures } = useQuery({
    queryKey: ["delivery-failures"],
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_failures" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: audits = [] } = useQuery({
    queryKey: ["admin-audit-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_orders" as any)
        .select("id, email, business_name, business_url, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: competitors = [] } = useQuery({
    queryKey: ["admin-competitor-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("competitor_reports" as any)
        .select("id, email, business_name, city, industry, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const { data: gbpPacks = [] } = useQuery({
    queryKey: ["admin-gbp-post-packs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gbp_post_packs" as any)
        .select("id, email, business_name, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const failureCount = failures.length;

  return (
    <div className="space-y-4">
      {failureCount > 0 && (
        <Card className="border-red-600/40 bg-red-950/20">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertTriangle size={14} /> {failureCount} Delivery Failure{failureCount !== 1 ? "s" : ""}
              <Button size="sm" variant="ghost" onClick={() => refetchFailures()} className="ml-auto h-6 text-[10px]">
                <RefreshCw size={10} className="mr-1" /> Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-2">
              {failures.slice(0, 5).map((f: any) => (
                <div key={f.id} className="text-xs bg-red-950/30 rounded p-2 border border-red-800/30">
                  <div className="flex justify-between">
                    <span className="font-bold text-red-300">{f.function_name}</span>
                    <span className="text-muted-foreground">{format(new Date(f.created_at), "MMM d, h:mm a")}</span>
                  </div>
                  <p className="text-red-400/80 mt-1">{f.error_message}</p>
                  {f.customer_email && <p className="text-muted-foreground mt-0.5">Customer: {f.customer_email}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package size={14} /> Product Orders
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-muted/50 mx-4 mb-2">
              <TabsTrigger value="failures" className="text-[10px]">
                Failures {failureCount > 0 && <Badge variant="destructive" className="ml-1 text-[8px] px-1 py-0">{failureCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="audits" className="text-[10px]">Audits ({audits.length})</TabsTrigger>
              <TabsTrigger value="competitors" className="text-[10px]">Competitor ({competitors.length})</TabsTrigger>
              <TabsTrigger value="gbp" className="text-[10px]">GBP Packs ({gbpPacks.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="failures" className="mt-0">
              <OrderTable data={failures} columns={[
                { key: "function_name", label: "Function" },
                { key: "customer_email", label: "Customer" },
                { key: "error_message", label: "Error" },
                { key: "created_at", label: "When" },
              ]} />
            </TabsContent>
            <TabsContent value="audits" className="mt-0">
              <OrderTable data={audits} columns={[
                { key: "email", label: "Email" },
                { key: "business_name", label: "Business" },
                { key: "status", label: "Status" },
                { key: "created_at", label: "When" },
              ]} />
            </TabsContent>
            <TabsContent value="competitors" className="mt-0">
              <OrderTable data={competitors} columns={[
                { key: "email", label: "Email" },
                { key: "business_name", label: "Business" },
                { key: "city", label: "City" },
                { key: "status", label: "Status" },
                { key: "created_at", label: "When" },
              ]} />
            </TabsContent>
            <TabsContent value="gbp" className="mt-0">
              <OrderTable data={gbpPacks} columns={[
                { key: "email", label: "Email" },
                { key: "business_name", label: "Business" },
                { key: "status", label: "Status" },
                { key: "created_at", label: "When" },
              ]} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOrders;
