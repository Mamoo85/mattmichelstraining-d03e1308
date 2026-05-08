import AdminShell, { AdminPageHeader, KpiCard } from "./AdminShell";

interface Props {
  title: string;
  accent: string;
  description: string;
  kpis: { label: string; value: string; sub?: string; accent?: string }[];
  rows: { primary: string; secondary: string; right?: string; tag?: string }[];
}

/** Reusable Supabase/GitHub-style table view for each admin tab. */
export default function TabPlaceholder({ title, accent, description, kpis, rows }: Props) {
  return (
    <AdminShell>
      <AdminPageHeader title={title} subtitle={description} accent={accent} />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
        </div>

        <div className="bg-[#111d2b] border border-white/5 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 text-[10px] uppercase tracking-[0.3em] text-slate-500 flex items-center justify-between">
            <span>Recent activity</span>
            <span>{rows.length} records</span>
          </div>
          <div className="divide-y divide-white/5">
            {rows.map((r, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/5 transition cursor-pointer">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate flex items-center gap-2">
                    {r.tag && (
                      <span className="text-[9px] uppercase tracking-wider font-bold text-[#27CCC0] bg-[#27CCC0]/10 px-1.5 py-0.5 rounded">
                        {r.tag}
                      </span>
                    )}
                    {r.primary}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{r.secondary}</div>
                </div>
                {r.right && <div className="text-xs text-slate-400 shrink-0">{r.right}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
