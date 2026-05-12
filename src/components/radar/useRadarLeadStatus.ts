// Loads the latest status/snooze/notes for a (client_id, signal_id, radar) tuple
// from radar_lead_actions, plus a logger that writes new actions.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LeadStatus = "new" | "contacted" | "proposal" | "won" | "lost";

const STATUS_ACTIONS = new Set([
  "status_new", "status_contacted", "status_proposal", "status_won", "status_lost",
]);
const SNOOZE_ACTIONS: Record<string, number> = {
  snooze_3d: 3 * 86_400_000,
  snooze_1w: 7 * 86_400_000,
  snooze_2w: 14 * 86_400_000,
};

export interface RadarLeadState {
  status: LeadStatus;
  statusChangedAt: string | null;
  snoozedUntil: number | null;
  notes: string;
  loading: boolean;
}

export interface RadarActionRow {
  id: string;
  action: string;
  notes: string | null;
  created_at: string;
}

export function useRadarLeadStatus(args: {
  signal_id: string;
  client_id: string;
  radar: "demand" | "buyer";
}) {
  const { signal_id, client_id, radar } = args;
  const [state, setState] = useState<RadarLeadState>({
    status: "new",
    statusChangedAt: null,
    snoozedUntil: null,
    notes: "",
    loading: true,
  });
  const [actions, setActions] = useState<RadarActionRow[]>([]);

  const load = useCallback(async () => {
    if (!signal_id || !client_id) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const { data } = await (supabase.from as any)("radar_lead_actions")
      .select("id, action, notes, created_at")
      .eq("signal_id", signal_id)
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows: RadarActionRow[] = (data as any) || [];
    setActions(rows);

    let status: LeadStatus = "new";
    let statusChangedAt: string | null = null;
    let snoozedUntil: number | null = null;
    let notes = "";
    for (const r of rows) {
      if (STATUS_ACTIONS.has(r.action) && !statusChangedAt) {
        status = r.action.replace("status_", "") as LeadStatus;
        statusChangedAt = r.created_at;
      }
      if (SNOOZE_ACTIONS[r.action] && snoozedUntil === null) {
        const until = new Date(r.created_at).getTime() + SNOOZE_ACTIONS[r.action];
        snoozedUntil = until;
      }
      if (r.action === "unsnooze" && snoozedUntil === null) {
        snoozedUntil = 0; // mark cleared
      }
      if (r.action === "note" && !notes && r.notes) notes = r.notes;
    }
    if (snoozedUntil !== null && snoozedUntil < Date.now()) snoozedUntil = null;
    setState({ status, statusChangedAt, snoozedUntil, notes, loading: false });
  }, [signal_id, client_id]);

  useEffect(() => { void load(); }, [load]);

  const log = useCallback(async (action: string, notes?: string) => {
    try {
      await supabase.functions.invoke("radar-action-log", {
        body: { signal_id, client_id, radar, action, notes: notes ?? null },
      });
      await load();
    } catch (e) {
      console.warn("[useRadarLeadStatus] log failed", e);
    }
  }, [signal_id, client_id, radar, load]);

  return { ...state, actions, log, reload: load };
}

// Pure helper for filtering & counts at the list level (avoids N hooks).
export interface BatchLeadStateMap {
  [signalId: string]: {
    status: LeadStatus;
    statusChangedAt: string | null;
    snoozedUntil: number | null;
  };
}

export async function loadRadarStates(
  client_id: string,
  signal_ids: string[],
): Promise<BatchLeadStateMap> {
  if (!client_id || signal_ids.length === 0) return {};
  const { data } = await (supabase.from as any)("radar_lead_actions")
    .select("signal_id, action, created_at")
    .eq("client_id", client_id)
    .in("signal_id", signal_ids)
    .order("created_at", { ascending: false })
    .limit(2000);
  const map: BatchLeadStateMap = {};
  for (const r of (data as any[]) || []) {
    const sid = r.signal_id;
    const entry = map[sid] || { status: "new" as LeadStatus, statusChangedAt: null, snoozedUntil: null };
    if (STATUS_ACTIONS.has(r.action) && !entry.statusChangedAt) {
      entry.status = r.action.replace("status_", "") as LeadStatus;
      entry.statusChangedAt = r.created_at;
    }
    if (SNOOZE_ACTIONS[r.action] && entry.snoozedUntil === null) {
      entry.snoozedUntil = new Date(r.created_at).getTime() + SNOOZE_ACTIONS[r.action];
    }
    if (r.action === "unsnooze" && entry.snoozedUntil === null) {
      entry.snoozedUntil = 0;
    }
    map[sid] = entry;
  }
  for (const k of Object.keys(map)) {
    if (map[k].snoozedUntil !== null && map[k].snoozedUntil! < Date.now()) {
      map[k].snoozedUntil = null;
    }
  }
  return map;
}

export function followupDueDays(statusChangedAt: string | null): number | null {
  if (!statusChangedAt) return null;
  const dueAt = new Date(statusChangedAt).getTime() + 3 * 86_400_000;
  const days = Math.ceil((dueAt - Date.now()) / 86_400_000);
  return days;
}
