import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, FileSearch, MapPin, Globe } from "lucide-react";

type OrderRow = {
  id: string;
  product: "Website Audit" | "GBP Post Pack" | "Competitor Report";
  email: string;
  business: string;
  detail: string;
  status: string;
  created_at: string;
};

type FailureRow = {
  id: string;
  function_name: string;
  customer_email: string | null;
  error_message: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  delivered: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

const PRODUCT_ICON: Record<string, React.ReactNode> = {
  "Website Audit": <Globe size={13} />,
  "GBP Post Pack": <MapPin size={13} />,
  "Competitor Report": <FileSearch size={13} />,
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [failures, setFailures] = useState<FailureRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [audits, gbp, comp, fails] = await Promise.all([
        supabase.from("audit_orders").select("id,email,business_name,status,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("gbp_post_packs").select("id,email,business_name,status,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("competitor_reports").select("id,email,business_name,city,industry,status,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("delivery_failures").select("id,function_name,customer_email,error_message,created_at").order("created_at", { ascending: false }).limit(10),
      ]);

      const rows: OrderRow[] = [
        ...(audits.data || []).map((r: any) => ({
          id: r.id,
          product: "Website Audit" as const,
          email: r.email,
          business: r.business_name || "—",
          detail: "",
          status: r.status,
          created_at: r.created_at,
        })),
        ...(gbp.data || []).map((r: any) => ({
          id: r.id,
          product: "GBP Post Pack" as const,
          email: r.email,
          business: r.business_name || "—",
          detail: "",
          status: r.status,
          created_at: r.created_at,
        })),
        ...(comp.data || []).map((r: any) => ({
          id: r.id,
          product: "Competitor Report" as const,
          email: r.email,
          business: r.business_name || "—",
          detail: [r.city, r.industry].filter(Boolean).join(" · "),
          status: r.status,
          created_at: r.created_at,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setOrders(rows);
      setFailures(fails.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const counts = {
    total: orders.length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    pending: orders.filter((o) => o.status === "pending").length,
    failed: orders.filter((o) => o.status === "failed").length,
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading orders…</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {/* Failure alerts */}
      {failures.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
          <div className="flex items-center gap-2 font-bold text-red-700 text-sm">
            <AlertTriangle size={15} />
            {failures.length} Delivery Failure{failures.length !== 1 ? "s" : ""} (last 10)
          </div>
          {failures.map((f) => (
            <div key={f.id} className="text-xs text-red-600 border-t border-red-100 pt-2">
              <span className="font-semibold">{f.function_name}</span>
              {f.customer_email && <> · {f.customer_email}</>}
              <> · {f.error_message || "unknown error"}</>
              <span className="text-red-400 ml-2">{new Date(f.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-slate-700" },
          { label: "Delivered", value: counts.delivered, color: "text-green-600" },
          { label: "Pending", value: counts.pending, color: "text-yellow-600" },
          { label: "Failed", value: counts.failed, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-white p-3 text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Product</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Email</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Business</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Status</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">No orders yet.</td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={`${o.product}-${o.id}`} className="hover:bg-slate-50">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-orange-50 text-orange-700 font-medium text-xs">
                    {PRODUCT_ICON[o.product]}
                    {o.product}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{o.email}</td>
                <td className="px-3 py-2 text-slate-600">
                  {o.business}
                  {o.detail && <span className="text-slate-400 ml-1">({o.detail})</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[o.status] || "bg-slate-100 text-slate-600"}`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                  {new Date(o.created_at).toLocaleDateString()} {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
