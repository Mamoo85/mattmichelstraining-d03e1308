import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { safeLocalStorage } from "@/lib/browserStorage";

interface QueuedAction {
  id: string;
  table: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

interface OfflineSyncContextType {
  isOnline: boolean;
  queueCount: number;
  enqueue: (table: string, payload: Record<string, unknown>) => void;
}

const OfflineSyncContext = createContext<OfflineSyncContextType>({
  isOnline: true,
  queueCount: 0,
  enqueue: () => {},
});

const QUEUE_KEY = "m2_offline_queue";

function loadQueue(): QueuedAction[] {
  try {
    return JSON.parse(safeLocalStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  safeLocalStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export const OfflineSyncProvider = ({ children }: { children: ReactNode }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueuedAction[]>(loadQueue);
  const { user } = useAuth();

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const enqueue = useCallback((table: string, payload: Record<string, unknown>) => {
    const action: QueuedAction = {
      id: crypto.randomUUID(),
      table,
      payload,
      timestamp: Date.now(),
    };
    setQueue((prev) => {
      const next = [...prev, action];
      saveQueue(next);
      return next;
    });
  }, []);

  // Flush queue when back online
  useEffect(() => {
    if (!isOnline || queue.length === 0 || !user) return;

    const flush = async () => {
      const pending = [...queue];
      const failed: QueuedAction[] = [];

      for (const action of pending) {
        try {
          const { error } = await (supabase.from(action.table as any) as any).insert(action.payload);
          if (error) {
            // offline sync retry
            failed.push(action);
          }
        } catch {
          failed.push(action);
        }
      }

      setQueue(failed);
      saveQueue(failed);

      if (failed.length === 0 && pending.length > 0) {
        toast({ title: "Synced!", description: `${pending.length} offline action(s) pushed successfully.` });
      }
    };

    flush();
  }, [isOnline, user]);

  return (
    <OfflineSyncContext.Provider value={{ isOnline, queueCount: queue.length, enqueue }}>
      {children}
    </OfflineSyncContext.Provider>
  );
};

export const useOfflineSync = () => useContext(OfflineSyncContext);
