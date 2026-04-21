import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SchemaValidation } from "@/lib/validateSchema";
import { toast } from "sonner";

interface Props {
  validation: SchemaValidation;
  onRetry?: () => void;
  componentName: string;
}

/**
 * Reusable rose-themed error panel for schema mismatch failures.
 * Logs the failure once per mount to `schema_validation_failures`.
 */
export function SchemaErrorPanel({ validation, onRetry, componentName }: Props) {
  const [showReturned, setShowReturned] = useState(false);
  const loggedRef = useRef(false);

  useEffect(() => {
    if (loggedRef.current) return;
    if (validation.ok) return;
    loggedRef.current = true;

    // Fire-and-forget — never block the UI on logging.
    void supabase
      .from("schema_validation_failures" as any)
      .insert({
        component: componentName,
        table_name: validation.tableName,
        select_fields: validation.selectFields,
        reason: validation.reason,
        missing: validation.missing,
        forbidden: validation.forbidden,
        raw_error: validation.rawError ?? null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        route: typeof window !== "undefined" ? window.location.pathname : null,
      })
      .then(({ error }) => {
        if (error) console.warn("[SchemaErrorPanel] failed to log mismatch:", error.message);
      });
  }, [componentName, validation]);

  const copyDebug = async () => {
    const blob = {
      component: componentName,
      table: validation.tableName,
      select: validation.selectFields,
      reason: validation.reason,
      missing: validation.missing,
      forbidden: validation.forbidden,
      sampleKeys: validation.sampleKeys,
      rawError: validation.rawError,
      route: typeof window !== "undefined" ? window.location.pathname : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      timestamp: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(blob, null, 2));
      toast.success("Debug info copied to clipboard");
    } catch {
      toast.error("Could not copy — clipboard blocked");
    }
  };

  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-rose-200 font-bold text-sm">
            Data model mismatch in {componentName}
          </div>
          <div className="text-white/70 text-xs leading-relaxed mt-1">{validation.reason}</div>
        </div>
      </div>

      {(validation.missing.length > 0 || validation.forbidden.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-rose-300/70 font-bold mb-1.5">
              Missing columns
            </div>
            {validation.missing.length === 0 ? (
              <div className="text-white/40 text-xs italic">none</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {validation.missing.map((c) => (
                  <span
                    key={c}
                    className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-200 text-[11px] font-mono border border-rose-500/30"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-amber-300/70 font-bold mb-1.5">
              Forbidden columns
            </div>
            {validation.forbidden.length === 0 ? (
              <div className="text-white/40 text-xs italic">none</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {validation.forbidden.map((c) => (
                  <span
                    key={c}
                    className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200 text-[11px] font-mono border border-amber-500/30"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2 text-xs">
        <div>
          <span className="text-white/40 uppercase tracking-wide text-[10px] font-bold">
            Queried table:
          </span>{" "}
          <span className="font-mono text-white/85">{validation.tableName}</span>
        </div>
        <div>
          <div className="text-white/40 uppercase tracking-wide text-[10px] font-bold mb-1">
            Selected fields
          </div>
          <pre className="rounded bg-black/30 border border-white/10 p-2 text-[11px] font-mono text-white/80 whitespace-pre-wrap break-all">
            {validation.selectFields}
          </pre>
        </div>

        {validation.sampleKeys.length > 0 && (
          <details
            open={showReturned}
            onToggle={(e) => setShowReturned((e.target as HTMLDetailsElement).open)}
            className="rounded border border-white/10 bg-black/20"
          >
            <summary className="cursor-pointer select-none px-2 py-1.5 text-white/60 text-[11px] font-bold uppercase tracking-wide flex items-center gap-1">
              {showReturned ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Returned columns ({validation.sampleKeys.length})
            </summary>
            <div className="p-2 pt-0 flex flex-wrap gap-1">
              {validation.sampleKeys.map((k) => (
                <span
                  key={k}
                  className="px-1.5 py-0.5 rounded bg-white/5 text-white/70 text-[11px] font-mono border border-white/10"
                >
                  {k}
                </span>
              ))}
            </div>
          </details>
        )}

        {validation.rawError && (
          <div>
            <div className="text-white/40 uppercase tracking-wide text-[10px] font-bold mb-1">
              Raw Postgres error
            </div>
            <pre className="rounded bg-black/30 border border-white/10 p-2 text-[11px] font-mono text-rose-200/80 whitespace-pre-wrap break-all">
              {validation.rawError}
            </pre>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap pt-1">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-md bg-[#00d4ff]/15 hover:bg-[#00d4ff]/25 border border-[#00d4ff]/40 text-[#00d4ff] text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Refresh data
          </button>
        )}
        <button
          onClick={copyDebug}
          className="px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-xs font-semibold flex items-center gap-1.5"
        >
          <Copy className="w-3 h-3" /> Copy debug info
        </button>
      </div>
    </div>
  );
}
