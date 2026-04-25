import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ReceiptStatus = "pending" | "paid" | "fulfilled" | "failed" | "unknown";

export interface ReceiptInfo {
  status: ReceiptStatus;
  productType?: string | null;
  fulfilledAt?: string | null;
  email?: string | null;
  error?: string | null;
}

export interface ReceiptStatusResult extends ReceiptInfo {
  polling: boolean;
  /** True once the polling window elapsed without reaching fulfilled/failed. */
  timedOut: boolean;
  /** Manual retry — restarts the poll window. Capped at MAX_RETRIES. */
  retry: () => void;
  /** How many manual retries the user has burned through. */
  retries: number;
}

const MAX_RETRIES = 3;

/**
 * Polls get-receipt-status for a Stripe session_id until fulfilled/failed
 * or a timeout (default 60s) is reached. Returns the latest known state plus
 * a `retry` action so the UI can offer the user a fresh polling window.
 */
export function useReceiptStatus(
  sessionId: string | null | undefined,
  opts?: { intervalMs?: number; timeoutMs?: number }
): ReceiptStatusResult {
  const intervalMs = opts?.intervalMs ?? 2500;
  const timeoutMs = opts?.timeoutMs ?? 60_000;

  const [info, setInfo] = useState<ReceiptInfo>({ status: "unknown" });
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [retries, setRetries] = useState(0);
  const [pollEpoch, setPollEpoch] = useState(0); // bump to restart effect

  const cancelRef = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setInfo({ status: "unknown" });
      setPolling(false);
      setTimedOut(false);
      return;
    }

    cancelRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    setPolling(true);
    setTimedOut(false);

    const tick = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-receipt-status", {
          body: { session_id: sessionId },
        });

        if (cancelRef.current) return;

        if (error) {
          setInfo((prev) => ({ ...prev, error: error.message }));
        } else if (data) {
          setInfo({
            status: (data.status as ReceiptStatus) ?? "unknown",
            productType: data.product_type ?? null,
            fulfilledAt: data.fulfilled_at ?? null,
            email: data.email ?? null,
          });

          if (data.status === "fulfilled" || data.status === "failed") {
            setPolling(false);
            return;
          }
        }
      } catch (err) {
        if (cancelRef.current) return;
        setInfo((prev) => ({ ...prev, error: (err as Error).message }));
      }

      if (Date.now() - startedAt >= timeoutMs) {
        setPolling(false);
        setTimedOut(true);
        return;
      }
      timer = setTimeout(tick, intervalMs);
    };

    tick();

    return () => {
      cancelRef.current = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, intervalMs, timeoutMs, pollEpoch]);

  const retry = useCallback(() => {
    if (retries >= MAX_RETRIES) return;
    setRetries((n) => n + 1);
    setTimedOut(false);
    setPollEpoch((n) => n + 1);
  }, [retries]);

  return { ...info, polling, timedOut, retry, retries };
}
