import { useState } from "react";
import AdminShell, { AdminPageHeader } from "./AdminShell";
import { WIDGET_CATALOG, Widget } from "../widgets";
import { Sparkles, Check } from "lucide-react";

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>(WIDGET_CATALOG);
  const toggle = (id: string) =>
    setWidgets((w) => w.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));

  const byCat = widgets.reduce<Record<string, Widget[]>>((acc, w) => {
    (acc[w.category] = acc[w.category] || []).push(w);
    return acc;
  }, {});

  const enabledCount = widgets.filter((w) => w.enabled).length;

  return (
    <AdminShell>
      <AdminPageHeader
        title="Site Widgets & Gadgets"
        subtitle={`${enabledCount} of ${widgets.length} active on djconley.com · Toggle to deploy live in seconds`}
        accent="Sandbox Add-Ons"
      />
      <div className="p-6 space-y-6">
        {Object.entries(byCat).map(([cat, items]) => (
          <div key={cat}>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#27CCC0] mb-2">{cat}</div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((w) => (
                <button
                  key={w.id}
                  onClick={() => toggle(w.id)}
                  className={`text-left bg-[#111d2b] border rounded-lg p-4 transition ${
                    w.enabled
                      ? "border-[#27CCC0]/60 ring-1 ring-[#27CCC0]/30"
                      : "border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className={`h-4 w-4 shrink-0 ${w.enabled ? "text-[#27CCC0]" : "text-slate-500"}`} />
                      <div className="font-semibold text-white text-sm truncate">{w.name}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {w.recommended && (
                        <span className="text-[9px] uppercase tracking-wider font-bold text-[#c12a3b]">Rec.</span>
                      )}
                      <div
                        className={`w-9 h-5 rounded-full p-0.5 transition flex ${
                          w.enabled ? "bg-[#27CCC0] justify-end" : "bg-white/10 justify-start"
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                          {w.enabled && <Check className="h-3 w-3 text-[#27CCC0]" />}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{w.description}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
