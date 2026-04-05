/**
 * AdminPurchaseAlert — "Someone Just Bought" panic button.
 * Shows a persistent banner on admin home when new purchases need onboarding.
 * Pulls step-by-step guides from shared fulfillment-guides module.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getGuide, productLabel } from "@/lib/fulfillment-guides";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Mail, Clock, Zap, ArrowRight, Phone, Sparkles,
} from "lucide-react";

interface PendingClient {
  sub_id: string;
  client_id: string;
  email: string;
  business_name: string;
  phone: string | null;
  service_type: string;
  fulfillment_stage: string;
  monthly_price: number | null;
  started_at: string;
}

export default function AdminPurchaseAlert() {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const { data: pending = [] } = useQuery({
    queryKey: ["admin-pending-purchases"],
    queryFn: async () => {
      // Get service_subscriptions that need action, joined with b2b_clients
      const { data: subs } = await (supabase as any)
        .from("service_subscriptions")
        .select("id, client_id, service_type, fulfillment_stage, monthly_price, started_at")
        .not("fulfillment_stage", "ilike", "%Active%")
        .order("started_at", { ascending: false })
        .limit(20);

      if (!subs || subs.length === 0) return [];

      // Get client details
      const clientIds = [...new Set(subs.map((s: any) => s.client_id))];
      const { data: clients } = await (supabase as any)
        .from("b2b_clients")
        .select("id, business_name, email, phone")
        .in("id", clientIds);

      const clientMap = new Map((clients as any[] || []).map((c: any) => [c.id, c]));

      return subs
        .map((s: any) => {
          const client = clientMap.get(s.client_id);
          if (!client) return null;
          return {
            sub_id: s.id,
            client_id: s.client_id,
            email: client.email,
            business_name: client.business_name,
            phone: client.phone,
            service_type: s.service_type,
            fulfillment_stage: s.fulfillment_stage || "New Lead - Action Required",
            monthly_price: s.monthly_price,
            started_at: s.started_at,
          } as PendingClient;
        })
        .filter(Boolean) as PendingClient[];
    },
    staleTime: 15000,
    refetchInterval: 15000,
  });

  // Split into "action required" (new) vs "in progress"
  const actionRequired = pending.filter(
    (p) => p.fulfillment_stage.includes("New Lead") || p.fulfillment_stage.includes("Action Required")
  );
  const inProgress = pending.filter(
    (p) => !p.fulfillment_stage.includes("New Lead") && !p.fulfillment_stage.includes("Action Required")
  );

  if (pending.length === 0) return null;

  return (
    <div className="space-y-3 mb-5">
      {/* ── URGENT BANNER — New purchases ──────────────────────── */}
      {actionRequired.length > 0 && (
        <div className="rounded-2xl border-2 border-orange-500/40 bg-orange-500/5 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative">
              <AlertCircle size={18} className="text-orange-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                {actionRequired.length} new purchase{actionRequired.length !== 1 ? "s" : ""} need your attention
              </p>
              <p className="text-[10px] text-muted-foreground">
                Don't worry — follow the steps below and you're good
              </p>
            </div>
          </div>

          <div className="px-3 pb-3 space-y-2">
            {actionRequired.map((client) => (
              <ClientCard
                key={client.sub_id}
                client={client}
                isExpanded={expandedClient === client.sub_id}
                onToggle={() =>
                  setExpandedClient(expandedClient === client.sub_id ? null : client.sub_id)
                }
                isUrgent
              />
            ))}
          </div>
        </div>
      )}

      {/* ── IN PROGRESS — Onboarding underway ─────────────────── */}
      {inProgress.length > 0 && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <Clock size={14} className="text-blue-400" />
            <p className="text-xs font-bold text-foreground">
              {inProgress.length} client{inProgress.length !== 1 ? "s" : ""} onboarding
            </p>
          </div>

          <div className="px-3 pb-3 space-y-2">
            {inProgress.map((client) => (
              <ClientCard
                key={client.sub_id}
                client={client}
                isExpanded={expandedClient === client.sub_id}
                onToggle={() =>
                  setExpandedClient(expandedClient === client.sub_id ? null : client.sub_id)
                }
                isUrgent={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Client Card with expandable steps ─────────────────────── */
function ClientCard({
  client,
  isExpanded,
  onToggle,
  isUrgent,
}: {
  client: PendingClient;
  isExpanded: boolean;
  onToggle: () => void;
  isUrgent: boolean;
}) {
  const guide = getGuide(client.service_type);
  const label = productLabel(client.service_type);
  const price = client.monthly_price
    ? `$${(client.monthly_price / 100).toFixed(0)}/mo`
    : "";
  const timeAgo = getTimeAgo(client.started_at);

  // Figure out which step they're on based on fulfillment_stage
  const currentStepIndex = guide.steps.findIndex(
    (s) => s.nextStage === client.fulfillment_stage
  );
  const completedSteps = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;

  return (
    <div
      className={`rounded-xl border transition-all ${
        isUrgent
          ? "border-orange-500/20 bg-background/80"
          : "border-blue-500/10 bg-background/60"
      }`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/10 transition rounded-xl"
      >
        <span className="text-lg">{guide.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate">
            {client.business_name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {label} {price && `· ${price}`} · {timeAgo}
          </p>
        </div>
        {guide.needsSetup ? (
          <Badge
            variant="outline"
            className={`text-[8px] shrink-0 ${
              isUrgent
                ? "border-orange-500/30 text-orange-400"
                : "border-blue-500/30 text-blue-400"
            }`}
          >
            {completedSteps}/{guide.steps.length} steps
          </Badge>
        ) : (
          <Badge className="bg-green-600 text-[8px] shrink-0">Auto</Badge>
        )}
        {isExpanded ? (
          <ChevronUp size={12} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown size={12} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded: Steps + Timeline + Automated info */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* What's automated */}
          {guide.automatedSteps && guide.automatedSteps.length > 0 && (
            <div className="rounded-lg bg-green-500/5 border border-green-500/15 p-2.5">
              <p className="text-[10px] font-bold text-green-400 flex items-center gap-1.5 mb-1">
                <Sparkles size={10} /> What's automated (no action needed)
              </p>
              {guide.automatedSteps.map((step, i) => (
                <p key={i} className="text-[10px] text-green-300/70 pl-4">
                  · {step}
                </p>
              ))}
            </div>
          )}

          {/* Timeline */}
          {guide.timeline && guide.timeline.length > 0 && (
            <div className="rounded-lg bg-muted/20 p-2.5">
              <p className="text-[10px] font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                <Clock size={10} /> Timeline
              </p>
              <div className="space-y-1">
                {guide.timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[9px] font-mono text-primary w-16 shrink-0 text-right">
                      {t.delay}
                    </span>
                    <ArrowRight size={8} className="text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-[10px] text-muted-foreground">{t.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step-by-step actions */}
          {guide.steps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-foreground">
                Your steps ({completedSteps}/{guide.steps.length} done)
              </p>
              {guide.steps.map((step, i) => {
                const isDone = i < completedSteps;
                const isCurrent = i === completedSteps;
                const mailtoHref =
                  step.action === "send_email" && step.emailSubject
                    ? `mailto:${client.email}?subject=${encodeURIComponent(
                        step.emailSubject
                      )}&body=${encodeURIComponent(
                        (step.emailBody ?? "").replace("[NAME]", client.business_name)
                      )}`
                    : null;

                return (
                  <div
                    key={i}
                    className={`flex gap-2 p-2 rounded-lg transition-all ${
                      isDone
                        ? "opacity-40"
                        : isCurrent
                        ? "bg-primary/5 border border-primary/20"
                        : "opacity-60"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <span className="w-[13px] h-[13px] rounded-full border border-muted-foreground/30 mt-0.5 shrink-0 flex items-center justify-center text-[8px] text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-foreground">
                        {step.label}
                      </p>
                      <p className="text-[9px] text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                      {isCurrent && mailtoHref && (
                        <a
                          href={mailtoHref}
                          className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition"
                        >
                          <Mail size={10} /> Send Email
                        </a>
                      )}
                      {isCurrent && step.action === "manual_check" && step.checkUrl && (
                        <a
                          href={step.checkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-md bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition"
                        >
                          {step.checkText || "Open"} <ArrowRight size={8} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick contact */}
          <div className="flex gap-2 pt-1">
            <a
              href={`mailto:${client.email}`}
              className="flex items-center gap-1 px-2 py-1 rounded bg-muted/30 text-[9px] text-muted-foreground hover:text-foreground transition"
            >
              <Mail size={9} /> {client.email}
            </a>
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-1 px-2 py-1 rounded bg-muted/30 text-[9px] text-muted-foreground hover:text-foreground transition"
              >
                <Phone size={9} /> {client.phone}
              </a>
            )}
          </div>

          {/* Go to full fulfillment */}
          <a
            href="/admin#fulfillment"
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(
                new CustomEvent("navigate-admin", { detail: "fulfillment" })
              );
            }}
            className="block text-center text-[10px] text-primary hover:underline pt-1"
          >
            Open full Fulfillment Tracker →
          </a>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
