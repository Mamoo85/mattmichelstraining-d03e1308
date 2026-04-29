import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Power, PowerOff, MapPin, Filter } from "lucide-react";

type Target = {
  id: string;
  city: string;
  state: string;
  trade: string;
  active: boolean;
  updated_at: string | null;
};

const ACCENT = "#00d4ff";
const BG = "#030711";
const CARD = "#0a1628";
const BORDER = "#1e3a5f";

export default function AdminMarketTargeting() {
  const [rows, setRows] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [tradeFilter, setTradeFilter] = useState<string>("ALL");
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [bulkBusyState, setBulkBusyState] = useState<string | null>(null);

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows() {
    setLoading(true);
    const { data, error } = await supabase
      .from("prospector_targets")
      .select("id, city, state, trade, active, updated_at")
      .order("state", { ascending: true })
      .order("city", { ascending: true })
      .order("trade", { ascending: true });
    if (error) {
      toast.error(`Failed to load targets: ${error.message}`);
      setLoading(false);
      return;
    }
    setRows((data || []) as Target[]);
    setLoading(false);
  }

  const states = useMemo(
    () => Array.from(new Set(rows.map((r) => r.state))).sort(),
    [rows],
  );
  const trades = useMemo(
    () => Array.from(new Set(rows.map((r) => r.trade))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (stateFilter !== "ALL" && r.state !== stateFilter) return false;
      if (tradeFilter !== "ALL" && r.trade !== tradeFilter) return false;
      if (showInactiveOnly && r.active) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.city.toLowerCase().includes(q) &&
          !r.trade.toLowerCase().includes(q) &&
          !r.state.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, stateFilter, tradeFilter, showInactiveOnly, search]);

  const totalActive = rows.filter((r) => r.active).length;
  const filteredActive = filtered.filter((r) => r.active).length;
  const stateActiveCounts = useMemo(() => {
    const counts = new Map<string, { active: number; total: number }>();
    for (const r of rows) {
      const cur = counts.get(r.state) || { active: 0, total: 0 };
      cur.total++;
      if (r.active) cur.active++;
      counts.set(r.state, cur);
    }
    return counts;
  }, [rows]);

  async function toggle(row: Target) {
    const next = !row.active;
    setSavingIds((s) => new Set(s).add(row.id));
    // Optimistic
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: next } : r)));
    const { error } = await supabase
      .from("prospector_targets")
      .update({ active: next })
      .eq("id", row.id);
    setSavingIds((s) => {
      const n = new Set(s);
      n.delete(row.id);
      return n;
    });
    if (error) {
      // Rollback
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: !next } : r)));
      toast.error(`Couldn't toggle ${row.city} / ${row.trade}: ${error.message}`);
      return;
    }
    toast.success(
      `${next ? "Activated" : "Paused"} ${row.city}, ${row.state} · ${row.trade}`,
    );
  }

  async function bulkSetState(state: string, active: boolean) {
    if (bulkBusyState) return;
    setBulkBusyState(state);
    const targetRows = rows.filter((r) => r.state === state && r.active !== active);
    if (targetRows.length === 0) {
      toast.info(`All ${state} markets already ${active ? "active" : "paused"}.`);
      setBulkBusyState(null);
      return;
    }
    const ids = targetRows.map((r) => r.id);
    // Optimistic
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, active } : r)));
    const { error } = await supabase
      .from("prospector_targets")
      .update({ active })
      .in("id", ids);
    setBulkBusyState(null);
    if (error) {
      // Rollback
      setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, active: !active } : r)));
      toast.error(`Bulk update failed: ${error.message}`);
      return;
    }
    toast.success(
      `${active ? "Activated" : "Paused"} ${ids.length} ${state} ${ids.length === 1 ? "market" : "markets"}.`,
    );
  }

  return (
    <>
      <Helmet>
        <title>Market Targeting — DWA Admin</title>
      </Helmet>
      <div style={{ minHeight: "100vh", background: BG, fontFamily: "-apple-system,sans-serif", color: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px 96px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
            <div>
              <p style={{ color: ACCENT, fontSize: 11, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", margin: "0 0 8px" }}>
                <MapPin size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
                Channel Prospector
              </p>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1.1 }}>Market Targeting</h1>
              <p style={{ color: "#94a3b8", fontSize: 14, margin: "8px 0 0", maxWidth: 640 }}>
                Toggle cities + trades on or off for the channel prospector. Changes take effect on the
                next prospector run — zero deploys. Inactive rows stay seeded so you can flip them on instantly.
              </p>
            </div>
            <div style={statBox}>
              <p style={{ ...labelStyle, margin: 0 }}>Active markets</p>
              <p style={{ color: ACCENT, fontSize: 32, fontWeight: 800, margin: "4px 0 0", lineHeight: 1 }}>
                {totalActive}
                <span style={{ color: "#475569", fontSize: 16, fontWeight: 600 }}> / {rows.length}</span>
              </p>
            </div>
          </div>

          {/* State summary chips */}
          {!loading && states.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {states.map((s) => {
                const c = stateActiveCounts.get(s)!;
                const isFilter = stateFilter === s;
                const allOn = c.active === c.total;
                const allOff = c.active === 0;
                return (
                  <button
                    key={s}
                    onClick={() => setStateFilter(isFilter ? "ALL" : s)}
                    style={{
                      background: isFilter ? `${ACCENT}22` : CARD,
                      border: `1px solid ${isFilter ? ACCENT : BORDER}`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{s}</span>
                    <span style={{
                      color: allOn ? "#34d399" : allOff ? "#64748b" : "#fbbf24",
                      fontSize: 12,
                      fontWeight: 600,
                    }}>
                      {c.active}/{c.total}
                    </span>
                  </button>
                );
              })}
              {stateFilter !== "ALL" && (
                <button onClick={() => setStateFilter("ALL")} style={ghostBtn}>Clear state filter</button>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 16 }}>
            <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
              <Filter size={14} style={{ position: "absolute", left: 12, top: 12, color: "#64748b" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search city, state, trade…"
                style={{ width: "100%", background: CARD, border: `1px solid ${BORDER}`, color: "#fff", borderRadius: 8, padding: "10px 12px 10px 34px", fontSize: 14, boxSizing: "border-box" }}
              />
            </div>
            <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">All trades</option>
              {trades.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showInactiveOnly}
                onChange={(e) => setShowInactiveOnly(e.target.checked)}
                style={{ accentColor: ACCENT }}
              />
              Inactive only
            </label>
            {stateFilter !== "ALL" && (
              <div style={{ display: "inline-flex", gap: 8, marginLeft: "auto" }}>
                <button
                  onClick={() => bulkSetState(stateFilter, true)}
                  disabled={bulkBusyState === stateFilter}
                  style={{ ...primaryBtn, opacity: bulkBusyState === stateFilter ? 0.6 : 1 }}
                >
                  <Power size={14} /> Activate all {stateFilter}
                </button>
                <button
                  onClick={() => bulkSetState(stateFilter, false)}
                  disabled={bulkBusyState === stateFilter}
                  style={{ ...dangerBtn, opacity: bulkBusyState === stateFilter ? 0.6 : 1 }}
                >
                  <PowerOff size={14} /> Pause all {stateFilter}
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>
                <Loader2 className="animate-spin" size={20} style={{ display: "inline-block", marginRight: 8, verticalAlign: "-4px" }} />
                Loading markets…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#64748b" }}>
                No markets match your filters.
              </div>
            ) : (
              <>
                <div style={tableHeader}>
                  <span>State</span>
                  <span>City</span>
                  <span>Trade</span>
                  <span style={{ textAlign: "right" }}>Last toggle</span>
                  <span style={{ textAlign: "right" }}>Active</span>
                </div>
                {filtered.map((r) => (
                  <div key={r.id} style={tableRow}>
                    <span style={{ fontWeight: 700, color: ACCENT, fontSize: 13 }}>{r.state}</span>
                    <span style={{ color: "#e2e8f0", fontSize: 14 }}>{r.city}</span>
                    <span style={{ color: "#94a3b8", fontSize: 13 }}>{r.trade}</span>
                    <span style={{ color: "#64748b", fontSize: 12, textAlign: "right" }}>
                      {r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "—"}
                    </span>
                    <span style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                      {savingIds.has(r.id) && <Loader2 size={12} className="animate-spin" style={{ color: "#64748b" }} />}
                      <Switch checked={r.active} onCheckedChange={() => toggle(r)} disabled={savingIds.has(r.id)} />
                    </span>
                  </div>
                ))}
                <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, color: "#64748b", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                  <span>{filtered.length} {filtered.length === 1 ? "row" : "rows"} shown</span>
                  <span>{filteredActive} active in view</span>
                </div>
              </>
            )}
          </div>

          <p style={{ color: "#475569", fontSize: 11, margin: "16px 4px 0", lineHeight: 1.5 }}>
            Toggling a market only updates the prospector queue — it does not enroll new clients or trigger backfills.
            The channel-prospector cron picks up active rows on its next run.
          </p>
        </div>
      </div>
    </>
  );
}

const labelStyle = { color: "#94a3b8", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: 1.5, fontWeight: 700 };
const statBox = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 18px", minWidth: 160 };
const selectStyle = { background: CARD, border: `1px solid ${BORDER}`, color: "#fff", borderRadius: 8, padding: "10px 12px", fontSize: 14 } as const;
const ghostBtn = { background: "transparent", border: `1px solid ${BORDER}`, color: "#94a3b8", borderRadius: 8, padding: "8px 12px", fontSize: 12, cursor: "pointer" } as const;
const primaryBtn = { background: ACCENT, color: "#0a1628", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 } as const;
const dangerBtn = { background: "transparent", border: "1px solid #7f1d1d", color: "#fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 } as const;
const tableHeader = {
  display: "grid",
  gridTemplateColumns: "60px 1fr 1.4fr 140px 100px",
  gap: 12,
  padding: "12px 16px",
  borderBottom: `1px solid ${BORDER}`,
  background: "#06101e",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};
const tableRow = {
  display: "grid",
  gridTemplateColumns: "60px 1fr 1.4fr 140px 100px",
  gap: 12,
  padding: "14px 16px",
  borderBottom: `1px solid ${BORDER}`,
  alignItems: "center" as const,
};
