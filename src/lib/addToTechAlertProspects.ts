import { supabase } from "@/integrations/supabase/client";

export interface ProspectInput {
  company_name: string;
  city?: string | null;
  state?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  is_boiler?: boolean;
  score?: number;
  source_url?: string | null;
  source_label?: string;
  notes?: string | null;
}

export async function addToTechAlertProspects(input: ProspectInput) {
  const { data, error } = await supabase.functions.invoke("add-to-techalert-prospects", { body: input });
  if (error) throw error;
  return data as { ok: boolean; id: string; action: "inserted" | "updated" };
}
