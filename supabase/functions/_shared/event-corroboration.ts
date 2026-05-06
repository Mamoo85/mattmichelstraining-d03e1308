// Agent 3 (corroboration helper): Cross-source event corroboration.
// Records corroborations for a (lead, event) pair. Returns count of distinct sources.

import { createClient } from "npm:@supabase/supabase-js@2";

type SB = ReturnType<typeof createClient>;

export interface CorroborationInput {
  sb: SB;
  lead_id: string;
  event_kind: string;        // e.g. 'fsbo_listing', 'foreclosure_notice'
  source_label: string;      // e.g. 'zillow', 'wayne_legal_news'
  source_url?: string;
  source_excerpt?: string;
  extractor_run_id?: string;
}

export async function recordCorroboration(input: CorroborationInput): Promise<number> {
  try {
    await (input.sb.from as any)("lead_event_corroborations").upsert({
      lead_id: input.lead_id,
      event_kind: input.event_kind,
      source_label: input.source_label,
      source_url: input.source_url || null,
      source_excerpt: input.source_excerpt?.slice(0, 1000) || null,
      extractor_run_id: input.extractor_run_id || null,
    }, { onConflict: "lead_id,event_kind,source_label" });

    const { data } = await (input.sb.from as any)("lead_event_corroborations")
      .select("source_label")
      .eq("lead_id", input.lead_id)
      .eq("event_kind", input.event_kind);
    const distinct = new Set((data || []).map((r: any) => r.source_label));
    return distinct.size;
  } catch (e) {
    console.warn("[event-corroboration]", e instanceof Error ? e.message : String(e));
    return 0;
  }
}
