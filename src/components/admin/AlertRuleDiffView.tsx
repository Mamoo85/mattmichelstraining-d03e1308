import { useMemo } from "react";
import { Card } from "@/components/ui/card";

interface Props {
  liveConfig: Record<string, unknown> | null;
  testConfig: Record<string, unknown> | null;
}

type DiffRow = { key: string; live: unknown; test: unknown; status: "added" | "removed" | "changed" | "same" };

function flatten(obj: any, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || typeof obj !== "object") {
    out[prefix || "(root)"] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) flatten(v, path, out);
    else out[path] = v;
  }
  return out;
}

export default function AlertRuleDiffView({ liveConfig, testConfig }: Props) {
  const rows: DiffRow[] = useMemo(() => {
    const a = flatten(liveConfig || {});
    const b = flatten(testConfig || {});
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
    return keys.map((key) => {
      const inA = key in a, inB = key in b;
      if (inA && !inB) return { key, live: a[key], test: undefined, status: "removed" };
      if (!inA && inB) return { key, live: undefined, test: b[key], status: "added" };
      const same = JSON.stringify(a[key]) === JSON.stringify(b[key]);
      return { key, live: a[key], test: b[key], status: same ? "same" : "changed" };
    });
  }, [liveConfig, testConfig]);

  const changed = rows.filter((r) => r.status !== "same");

  return (
    <Card className="p-4">
      <div className="text-sm font-semibold mb-2">Diff: Live vs Test config</div>
      {changed.length === 0 ? (
        <p className="text-xs text-muted-foreground">No differences.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border/40">
              <th className="py-1">Field</th>
              <th className="py-1">Live</th>
              <th className="py-1">Test</th>
            </tr>
          </thead>
          <tbody>
            {changed.map((r) => (
              <tr key={r.key} className="border-b border-border/20">
                <td className="py-1 font-mono">{r.key}</td>
                <td className={`py-1 ${r.status === "added" ? "text-muted-foreground italic" : "text-rose-300"}`}>
                  {r.live === undefined ? "—" : JSON.stringify(r.live)}
                </td>
                <td className={`py-1 ${r.status === "removed" ? "text-muted-foreground italic" : "text-emerald-300"}`}>
                  {r.test === undefined ? "—" : JSON.stringify(r.test)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
