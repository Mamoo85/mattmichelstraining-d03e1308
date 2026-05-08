// One-click outreach bar shown on every radar lead card and inside the drawer.
// 6 actions: Email draft, SMS draft, LinkedIn search, Call, Add to CRM, Mark contacted.
// Every click logs to radar_lead_actions for "✓ You called this 2 days ago" history.

import { useState } from "react";
import { Mail, MessageSquare, Linkedin, Phone, Plus, CheckCircle2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OutreachContext {
  signal_id: string;
  client_id: string;
  radar: "demand" | "buyer";
  company_name?: string | null;
  industry?: string | null;
  location?: string | null;
  signal_type?: string | null;
  suggested_opener?: string | null;
  target_buyer_titles?: string[] | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  sender_email?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
}

function buildSubject(ctx: OutreachContext) {
  const co = ctx.company_name || "your team";
  const sig = ctx.signal_type ? ctx.signal_type.replace(/_/g, " ") : "growth";
  return `Quick note re: ${co} — ${sig}`.slice(0, 100);
}

function buildBody(ctx: OutreachContext) {
  const opener = (ctx.suggested_opener || "").trim();
  const sig = (ctx.sender_name || ctx.sender_email || "")
    ? `\n\n— ${ctx.sender_name || ""}${ctx.sender_phone ? `\n${ctx.sender_phone}` : ""}${ctx.sender_email ? `\n${ctx.sender_email}` : ""}`
    : "";
  return `${opener}${sig}`.trim();
}

function linkedinSearchUrl(ctx: OutreachContext) {
  const titles = (ctx.target_buyer_titles || []).slice(0, 2).join(" OR ") || "owner OR director";
  const co = ctx.company_name || "";
  const q = encodeURIComponent(`${titles} ${co}`.trim());
  return `https://www.linkedin.com/search/results/people/?keywords=${q}`;
}

async function logAction(ctx: OutreachContext, action: string) {
  try {
    await supabase.functions.invoke("radar-action-log", {
      body: {
        signal_id: ctx.signal_id,
        client_id: ctx.client_id,
        radar: ctx.radar,
        action,
      },
    });
  } catch {
    // non-fatal
  }
}

interface Props {
  ctx: OutreachContext;
  onActionLogged?: (action: string) => void;
  compact?: boolean;
}

export default function OutreachActionBar({ ctx, onActionLogged, compact = false }: Props) {
  const [marked, setMarked] = useState(false);
  const [copied, setCopied] = useState(false);

  const subject = buildSubject(ctx);
  const body = buildBody(ctx);
  const mailto = `mailto:${ctx.contact_email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const sms = ctx.contact_phone ? `sms:${ctx.contact_phone}?body=${encodeURIComponent(body)}` : null;
  const tel = ctx.contact_phone ? `tel:${ctx.contact_phone}` : null;
  const linkedin = linkedinSearchUrl(ctx);

  const fire = (action: string) => {
    void logAction(ctx, action);
    onActionLogged?.(action);
  };

  const copyOpener = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(body || ctx.suggested_opener || "");
      setCopied(true);
      toast.success("Opener copied");
      fire("copied_opener");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const addToCrm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await (supabase as any)
        .from("outreach_leads")
        .insert({
          business_name: ctx.company_name || "Unknown",
          city: ctx.location || null,
          industry: ctx.industry || null,
          phone: ctx.contact_phone || null,
          source: `${ctx.radar}_radar`,
          pipeline_stage: "new",
        });
      if (error && !error.message?.includes("duplicate")) throw error;
      toast.success("Added to outreach pipeline");
      fire("crm");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't add to CRM");
    }
  };

  const markContacted = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMarked(true);
    fire("called");
    toast.success("Marked as contacted");
  };

  const btn =
    "flex items-center justify-center gap-1.5 rounded-md border text-[11px] font-bold uppercase tracking-wider transition-colors px-2.5 py-2";
  const primary = "border-[#00d4ff]/40 text-[#00d4ff] hover:bg-[#00d4ff]/10";
  const ghost = "border-[#1e3a5f] text-[#94a3b8] hover:text-white hover:border-[#00d4ff]/40";

  return (
    <div
      className={`grid ${compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6"} gap-1.5`}
      onClick={(e) => e.stopPropagation()}
    >
      <a
        href={mailto}
        onClick={() => fire("emailed")}
        className={`${btn} ${primary}`}
        title={ctx.contact_email ? `Email ${ctx.contact_email}` : "Open email draft"}
      >
        <Mail className="w-3.5 h-3.5" /> Email
      </a>
      {sms ? (
        <a href={sms} onClick={() => fire("sms")} className={`${btn} ${primary}`} title="SMS draft">
          <MessageSquare className="w-3.5 h-3.5" /> SMS
        </a>
      ) : (
        <button onClick={copyOpener} className={`${btn} ${ghost}`} title="Copy opener">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
      {tel ? (
        <a href={tel} onClick={() => fire("called")} className={`${btn} ${primary}`} title="Call now">
          <Phone className="w-3.5 h-3.5" /> Call
        </a>
      ) : (
        <button onClick={markContacted} className={`${btn} ${ghost}`} title="No phone — mark called">
          <Phone className="w-3.5 h-3.5" /> Call
        </button>
      )}
      <a
        href={linkedin}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => fire("linkedin")}
        className={`${btn} ${ghost}`}
        title="LinkedIn buyer search"
      >
        <Linkedin className="w-3.5 h-3.5" /> LinkedIn
      </a>
      <button onClick={addToCrm} className={`${btn} ${ghost}`} title="Add to outreach pipeline">
        <Plus className="w-3.5 h-3.5" /> CRM
      </button>
      <button
        onClick={markContacted}
        disabled={marked}
        className={`${btn} ${marked ? "border-emerald-500/40 text-emerald-400" : ghost}`}
        title="Mark as contacted"
      >
        <CheckCircle2 className="w-3.5 h-3.5" /> {marked ? "Done" : "Mark"}
      </button>
    </div>
  );
}
