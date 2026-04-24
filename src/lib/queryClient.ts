import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function handleAuthError(error: unknown) {
  const e = error as any;
  if (e?.status === 401 || e?.code === "PGRST301") {
    supabase.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleAuthError }),
  mutationCache: new MutationCache({ onError: handleAuthError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});
