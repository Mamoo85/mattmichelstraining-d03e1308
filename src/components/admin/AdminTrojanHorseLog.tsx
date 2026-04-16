import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Target, Mail, MessageSquare, CheckCircle, Clock, TrendingUp } from "lucide-react";

interface TrojanEntry {
  id: string;
  company_name: string;
  email: string;
  phone: string | null;
  days_since_signup: number;
  sms_sent: boolean;
  email_sent: boolean;
  template_day: number;
  converted: boolean;
  converted_at: string | null;
  sent_at: string;
}

export default function AdminTrojanHorseLog() {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["trojan-horse-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trojan_horse_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100);
      return (data || []) as TrojanEntry[];
    },
    refetchInterval: 60_000,
  });

  const totalSent = entries?.length || 0;
  const converted = entries?.filter(e => e.converted).length || 0;
  const conversionRate = totalSent > 0 ? Math.round((converted / totalSent) * 100) : 0;
  const uniqueCompanies = new Set(entries?.map(e => e.company_name)).size;
  const last7Days = entries?.filter(e => {
    const d = new Date(e.sent_at);
    return d.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
  }).length || 0;

  if (isLoading) {
    return <div className="p-6 text-center text-white/40 text-sm">Loading cross-sell data...</div>;
  }

  if (!entries?.length) {
    return (
      <div className="p-6 text-center text-white/40">
        <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No upsells sent yet. Trojan Horse runs daily at 10am ET.</p>
        <p className="text-xs text-white/20 mt-1">Targets TechAlert clients 30+ days old without FieldDesk.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Upsells Sent", value: totalSent, color: "#00d4ff", icon: Target },
          { label: "This Week", value: last7Days, color: "#8b5cf6", icon: Clock },
          { label: "Companies", value: uniqueCompanies, color: "#f97316", icon: TrendingUp },
          { label: "Converted", value: converted, color: "#22c55e", icon: CheckCircle },
          { label: "Conv. Rate", value: `${conversionRate}%`, color: converted > 0 ? "#22c55e" : "#64748b", icon: TrendingUp },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: k.color }} />
              <div className="text-lg font-black" style={{ color: k.color }}>{k.value}</div>
              <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider">{k.label}</div>
            </div>
          );
        })}
      </div>

      {/* Log Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/30 border-b border-white/10">
              <th className="text-left py-2 px-2 font-semibold">Date</th>
              <th className="text-left py-2 px-2 font-semibold">Company</th>
              <th className="text-center py-2 px-2 font-semibold">Day</th>
              <th className="text-center py-2 px-2 font-semibold">SMS</th>
              <th className="text-center py-2 px-2 font-semibold">Email</th>
              <th className="text-center py-2 px-2 font-semibold">Template</th>
              <th className="text-center py-2 px-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-2 px-2 text-white/40 font-mono">
                  {new Date(entry.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>
                <td className="py-2 px-2 text-white/70 font-semibold truncate max-w-[160px]">
                  {entry.company_name}
                </td>
                <td className="py-2 px-2 text-center text-white/50">
                  D{entry.days_since_signup}
                </td>
                <td className="py-2 px-2 text-center">
                  {entry.sms_sent ? (
                    <MessageSquare className="w-3.5 h-3.5 mx-auto text-green-400" />
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                </td>
                <td className="py-2 px-2 text-center">
                  {entry.email_sent ? (
                    <Mail className="w-3.5 h-3.5 mx-auto text-blue-400" />
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                </td>
                <td className="py-2 px-2 text-center">
                  <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-bold text-white/40">
                    D{entry.template_day}
                  </span>
                </td>
                <td className="py-2 px-2 text-center">
                  {entry.converted ? (
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold text-[10px]">
                      CONVERTED
                    </span>
                  ) : (
                    <span className="bg-white/5 text-white/20 px-2 py-0.5 rounded text-[10px]">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
