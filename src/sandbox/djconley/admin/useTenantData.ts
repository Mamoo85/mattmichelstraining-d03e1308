import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TENANT_SLUG = "djconley";

// Stable client IDs seeded by 20260512_djconley_tenant_provision migration
export const DJC_CLIENT_IDS = {
  field_crm:   "d1c00910-9c0a-4d00-9c01-d1c0fd000001",
  missed_call: "d1c00910-9c0a-4d00-9c01-d1c0fd000002",
  hire_alert:  "d1c00910-9c0a-4d00-9c01-d1c0fd000003",
  contractor:  "d1c00910-9c0a-4d00-9c01-d1c0fd000004",
  trade_radar: "d1c00910-9c0a-4d00-9c01-d1c0fd000005",
} as const;

export const DJC_VERTICAL = "hvac";
export const DJC_ZIPS = ["48201","48202","48207","48226","48075","48084","48089","48091","48092"];

export function useTenantData<T>(loader: () => Promise<T>, deps: any[] = []): {
  data: T | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e?.message || String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

export { TENANT_SLUG };
export { supabase };
