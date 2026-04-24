import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ReceiptStatus = "pending" | "paid" | "fulfilled" | "failed" | "unknown";

export interface ReceiptInfo {
  status: ReceiptStatus;
  productType?: string | null;
  fulfilledAt?: string | null;
  error?: string | null;
}

/**
 * Polls get-receipt-status for a Stripe session_id until fulfilled/failed
 * or a timeout (default 60s) is reached. Returns the latest known state.
 *
 * Usage: read `?session_id=cs_test_...` from the success-page URL and pass it.
 * If sessionId is null/undefined the hook is idle.
 */
export function useReceiptStatus(sessionId: string | null | undefined, opts?: {
  intervalMs?: number;
  timeoutMs?: number;
}): ReceiptInfo & { polling: boolean } {
  const intervalMs = opts?.intervalMs ?? 2500;
  const timeoutMs = opts?.timeoutMs ?? 60_000;

  const [info, setInfo] = useState<ReceiptInfo>({ status: "unknown" });
  const [polling, setPolling] = useState<boolean>(false);

  useEffect(() => {
    if (!sessionId) {
      setInfo({ status: "unknown" });
      setPolling(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    setPolling(true);

    const tick = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-receipt-status", {
          body: { session_id: sessionId },
        });

        if (cancelled) return;

        if (error) {
          setInfo({ status: "unknown", error: error.message });
        } else if (data) {
          setInfo({
            status: (data.status as ReceiptStatus) ?? "unknown",
            productType: data.product_type ?? null,
            fulfilledAt: data.fulfilled_at ?? null,
          });

          if (data.status === "fulfilled" || data.status === "failed") {
            setPolling(false);
            return;
          }
        }
      } catch (err) {
        if (cancelled) return;
        setInfo((prev) => ({ ...prev, error: (err as Error).message }));
      }

      if (Date.now() - startedAt >= timeoutMs) {
        setPolling(false);
        return;
      }
      timer = setTimeout(tick, intervalMs);
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setPolling(false);
    };
  }, [sessionId, intervalMs, timeoutMs]);

  return { ...info, polling };
}
