/**
 * PostcardAssetDebugPanel
 *
 * Sits inside AdminPostcardCampaigns and gives the operator a single
 * source of truth for what's about to be mailed:
 *   1. Lists every asset URL (photo, badge, QR) with live HEAD-probe status
 *   2. Compares the admin UI's local URL list against the canonical list
 *      from the edge function (parity check) and flags drift in red
 *   3. "Preview Actual Mail" button — invokes the edge function with
 *      preview_html=true so the iframe shows the EXACT HTML Lob receives
 *
 * Why this exists: previously the admin preview hardcoded its own URLs
 * (initials/text circles) while the live mailer used different image
 * URLs, so what Matt saw never matched what was mailed. Single source +
 * parity check prevents that ever happening again.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, RefreshCw, Eye, ExternalLink, ShieldAlert } from "lucide-react";
import {
  POSTCARD_ASSETS_LOCAL,
  POSTCARD_ASSET_VERSION_LOCAL,
} from "@/lib/postcardAssets";

interface AssetProbe {
  label: string;
  candidates: string[];
  checked: { url: string; ok: boolean; status: number }[];
  resolved_url: string;
  used_fallback_index: number;
  used_placeholder: boolean;
}

interface CheckResponse {
  asset_version: string;
  assets: Record<string, AssetProbe>;
  checked_at: string;
}

interface Props {
  /** Optional campaign id — used so "Preview Actual Mail" pulls the
   *  campaign's overridden copy_front/copy_back the live mailer would use. */
  campaignId?: string;
  audience: string;
  city: string;
  recipient?: string;
}

export default function PostcardAssetDebugPanel({ campaignId, audience, city, recipient }: Props) {
  const [check, setCheck] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ photo_url: string; badge_url: string; photo_used_placeholder: boolean; badge_used_placeholder: boolean } | null>(null);

  // QR URL is deterministic — show it so Matt can verify the landing page
  // before mailing 500 cards.
  const qrUrl = useMemo(() => {
    const cid = campaignId || "preview";
    return `https://detroitwebagent.com/postcard?audience=${audience}&utm_campaign=${cid}&city=${city.toLowerCase().replace(/\s+/g, "-")}`;
  }, [campaignId, audience, city]);

  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runCheck = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("send-postcards", {
      body: { check_assets: true },
    });
    setLoading(false);
    if (error) {
      toast.error("Asset check failed: " + error.message);
      return;
    }
    setCheck(data as CheckResponse);
  };

  const previewActualMail = async () => {
    setPreviewing(true);
    const { data, error } = await supabase.functions.invoke("send-postcards", {
      body: {
        preview_html: true,
        preview_audience: audience,
        preview_city: city,
        preview_recipient: recipient || "",
        ...(campaignId ? { campaign_id: campaignId } : {}),
      },
    });
    setPreviewing(false);
    if (error) {
      toast.error("Preview failed: " + error.message);
      return;
    }
    setPreviewHtml(data?.html || null);
    setPreviewMeta(data?.resolved || null);
    if (data?.resolved?.photo_used_placeholder || data?.resolved?.badge_used_placeholder) {
      toast.warning("Live mailer is using a placeholder for at least one asset — see resolved URLs below.");
    } else {
      toast.success("Showing exact HTML the live mailer would send.");
    }
  };

  // Parity check: compare local URL list against canonical edge-function list.
  const parity = useMemo(() => {
    if (!check) return null;
    const issues: string[] = [];
    if (check.asset_version !== POSTCARD_ASSET_VERSION_LOCAL) {
      issues.push(`Version drift: edge=${check.asset_version} vs admin=${POSTCARD_ASSET_VERSION_LOCAL}`);
    }
    for (const key of Object.keys(POSTCARD_ASSETS_LOCAL) as Array<keyof typeof POSTCARD_ASSETS_LOCAL>) {
      const local = POSTCARD_ASSETS_LOCAL[key].candidates;
      const remote = check.assets[key]?.candidates || [];
      if (JSON.stringify(local) !== JSON.stringify(remote)) {
        issues.push(`${key}: candidate list does not match between admin UI and live mailer`);
      }
    }
    return { ok: issues.length === 0, issues };
  }, [check]);

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Postcard Asset Debug
            </h3>
            <p className="text-white/50 text-xs mt-1">
              Live verification that what you see in the preview is what Lob will actually mail.
              Asset registry version: <code className="text-cyan-400">{POSTCARD_ASSET_VERSION_LOCAL}</code>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runCheck} disabled={loading} className="text-xs h-8">
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Checking…" : "Re-check assets"}
            </Button>
            <Button
              size="sm"
              onClick={previewActualMail}
              disabled={previewing}
              className="text-xs h-8 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
            >
              <Eye className={`w-3 h-3 mr-1 ${previewing ? "animate-pulse" : ""}`} />
              {previewing ? "Rendering…" : "Preview Actual Mail"}
            </Button>
          </div>
        </div>

        {/* Parity status */}
        {parity && (
          <div
            className={`rounded-md border p-3 text-xs ${
              parity.ok
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {parity.ok ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  ✅ Parity OK — admin asset URLs match the live mailer exactly.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Parity broken — DO NOT MAIL until fixed.</strong>
                  <ul className="mt-1 list-disc list-inside text-red-200 space-y-0.5">
                    {parity.issues.map((i, idx) => (
                      <li key={idx}>{i}</li>
                    ))}
                  </ul>
                  <div className="mt-1 text-[11px] text-red-200/80">
                    Update <code>src/lib/postcardAssets.ts</code> and{" "}
                    <code>supabase/functions/_shared/postcard-assets.ts</code> together.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Asset rows */}
        {check && (
          <div className="space-y-3">
            {(Object.keys(check.assets) as Array<keyof typeof check.assets>).map((key) => {
              const a = check.assets[key];
              return (
                <div key={key as string} className="bg-black/30 border border-white/5 rounded-md p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="text-white text-xs font-semibold">{a.label}</div>
                    {a.used_placeholder ? (
                      <Badge className="bg-red-500/20 text-red-300 text-[10px]">Placeholder fallback</Badge>
                    ) : a.used_fallback_index > 0 ? (
                      <Badge className="bg-amber-500/20 text-amber-300 text-[10px]">
                        Using fallback #{a.used_fallback_index + 1}
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px]">Primary OK</Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    {a.checked.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        {c.ok ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                        )}
                        <span className={c.ok ? "text-emerald-300" : "text-red-300"}>
                          {c.status || "ERR"}
                        </span>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener"
                          className="text-cyan-400 hover:underline truncate flex-1 font-mono"
                        >
                          {c.url}
                        </a>
                        <ExternalLink className="w-3 h-3 text-white/30" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* QR URL row */}
            <div className="bg-black/30 border border-white/5 rounded-md p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-white text-xs font-semibold">QR code target URL</div>
                <Badge className="bg-cyan-500/20 text-cyan-300 text-[10px]">Generated at send time</Badge>
              </div>
              <a
                href={qrUrl}
                target="_blank"
                rel="noopener"
                className="text-[11px] text-cyan-400 hover:underline font-mono break-all"
              >
                {qrUrl}
              </a>
              <div className="text-[10px] text-white/40 mt-1">
                The QR is rendered as a data-URI by the edge function (no external dependency).
              </div>
            </div>
          </div>
        )}

        {/* Actual-mail preview iframe */}
        {previewHtml && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
              <span className="text-white/60">
                <Eye className="w-3 h-3 inline mr-1" />
                Below is the <strong className="text-emerald-300">exact HTML</strong> the live mailer renders.
              </span>
              {previewMeta && (
                <span className="text-white/40">
                  Photo: {previewMeta.photo_used_placeholder ? "⚠️ placeholder" : "✅"} ·{" "}
                  Badge: {previewMeta.badge_used_placeholder ? "⚠️ placeholder" : "✅"}
                </span>
              )}
            </div>
            <div className="bg-[#1a1a1a] rounded-lg p-4 overflow-auto">
              <iframe
                srcDoc={previewHtml}
                style={{ width: "6.5in", height: "4.5in", border: "none", background: "#fff" }}
                title="Actual mail preview"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
