import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  LifeBuoy, Loader2, Bot, CheckCircle, XCircle, RefreshCw,
  AlertTriangle, ArrowRight, User, Clock, ChevronDown, ChevronUp,
} from "lucide-react";

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  status: string;
  ai_suggestion: string | null;
  ai_actions: any[];
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  tier_change: "Change Subscription Tier",
  stripe_refund: "Issue Stripe Refund",
  extend_trial: "Extend Trial Period",
  send_email: "Send Email to User",
  manual_note: "Manual Action Required",
};

const ACTION_COLORS: Record<string, string> = {
  tier_change: "text-blue-400 bg-blue-500/10",
  stripe_refund: "text-amber-400 bg-amber-500/10",
  extend_trial: "text-green-400 bg-green-500/10",
  send_email: "text-purple-400 bg-purple-500/10",
  manual_note: "text-muted-foreground bg-muted",
};

const AdminSupportCopilot = () => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [triagingId, setTriagingId] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as SupportTicket[];
    },
  });

  // Fetch profiles for ticket users
  const userIds = [...new Set(tickets.map((t) => t.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["ticket-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email, subscription_tier")
        .in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap: Record<string, any> = {};
  profiles.forEach((p: any) => { profileMap[p.user_id] = p; });

  const runTriage = async (ticketId: string) => {
    setTriagingId(ticketId);
    try {
      const { data, error } = await supabase.functions.invoke("ai-support-triage", {
        body: { ticket_id: ticketId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "AI analysis complete" });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setExpandedId(ticketId);
    } catch (e: any) {
      toast({ title: "Triage failed", description: e.message, variant: "destructive" });
    } finally {
      setTriagingId(null);
    }
  };

  const executeActions = async (ticket: SupportTicket) => {
    try {
      // Execute proposed actions
      const actions = ticket.ai_actions || [];
      for (const action of actions) {
        if (action.type === "tier_change" && action.to) {
          await supabase
            .from("profiles")
            .update({ subscription_tier: action.to })
            .eq("user_id", ticket.user_id);
        }
        if (action.type === "extend_trial" && action.days) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("trial_started_at")
            .eq("user_id", ticket.user_id)
            .single();
          const base = prof?.trial_started_at ? new Date(prof.trial_started_at) : new Date();
          base.setDate(base.getDate() + action.days);
          await supabase
            .from("profiles")
            .update({ trial_started_at: base.toISOString() })
            .eq("user_id", ticket.user_id);
        }
        if (action.type === "stripe_refund") {
          await supabase.functions.invoke("issue-refund", {
            body: { user_id: ticket.user_id, amount_cents: action.amount_cents, reason: action.reason },
          });
        }
      }

      // Mark resolved
      await supabase
        .from("support_tickets" as any)
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      toast({ title: "Actions executed & ticket resolved ✓" });
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    } catch (e: any) {
      toast({ title: "Execution failed", description: e.message, variant: "destructive" });
    }
  };

  const discardTicket = async (ticketId: string) => {
    await supabase
      .from("support_tickets" as any)
      .update({ status: "discarded", updated_at: new Date().toISOString() })
      .eq("id", ticketId);
    toast({ title: "Ticket discarded" });
    queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
  };

  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "ai_reviewed");
  const closedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "discarded");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LifeBuoy size={16} className="text-primary" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">AI Support Copilot</h3>
            <p className="text-[10px] text-muted-foreground">Triage tickets, review AI suggestions, approve & execute</p>
          </div>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["support-tickets"] })}
          className="flex items-center gap-1.5 border border-border text-muted-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground hover:border-primary/40 transition-all"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      )}

      {!isLoading && openTickets.length === 0 && (
        <div className="bg-card border border-border p-8 text-center">
          <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
          <p className="text-sm font-bold text-foreground">All clear!</p>
          <p className="text-[11px] text-muted-foreground">No open support tickets.</p>
        </div>
      )}

      {/* Open Tickets */}
      {openTickets.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-widest text-foreground flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-500" />
            Open Tickets ({openTickets.length})
          </h4>
          {openTickets.map((ticket) => {
            const profile = profileMap[ticket.user_id];
            const isExpanded = expandedId === ticket.id;
            const isTriaging = triagingId === ticket.id;

            return (
              <div key={ticket.id} className="bg-card border border-border">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                      <User size={14} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {ticket.subject || "Support Request"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {profile?.athlete_name || profile?.full_name || "Unknown"} · {profile?.email} · {profile?.subscription_tier}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                      ticket.status === "ai_reviewed"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {ticket.status === "ai_reviewed" ? "AI Reviewed" : "New"}
                    </span>
                    <Clock size={10} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {/* User message */}
                    <div className="bg-muted p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">User Message</p>
                      <p className="text-sm text-foreground">{ticket.body}</p>
                    </div>

                    {/* AI Analysis */}
                    {ticket.status === "ai_reviewed" && ticket.ai_suggestion ? (
                      <div className="space-y-3">
                        <div className="bg-primary/5 border border-primary/20 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Bot size={14} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">AI Suggestion</span>
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{ticket.ai_suggestion}</p>
                        </div>

                        {/* Proposed Actions */}
                        {ticket.ai_actions && ticket.ai_actions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Proposed Actions</p>
                            {ticket.ai_actions.map((action: any, i: number) => (
                              <div key={i} className="flex items-start gap-3 bg-muted p-3">
                                <div className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 shrink-0 ${ACTION_COLORS[action.type] || "bg-muted text-muted-foreground"}`}>
                                  {ACTION_LABELS[action.type] || action.type}
                                </div>
                                <div className="text-xs text-foreground min-w-0">
                                  {action.type === "tier_change" && (
                                    <p>Change tier from <strong>{action.from}</strong> → <strong>{action.to}</strong></p>
                                  )}
                                  {action.type === "stripe_refund" && (
                                    <p>Refund <strong>${(action.amount_cents / 100).toFixed(2)}</strong> — {action.reason}</p>
                                  )}
                                  {action.type === "extend_trial" && (
                                    <p>Extend trial by <strong>{action.days} days</strong></p>
                                  )}
                                  {action.type === "send_email" && (
                                    <p>Email: <strong>{action.subject}</strong></p>
                                  )}
                                  {action.type === "manual_note" && (
                                    <p>{action.note}</p>
                                  )}
                                  {action.reason && action.type !== "stripe_refund" && (
                                    <p className="text-muted-foreground mt-0.5">{action.reason}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => discardTicket(ticket.id)}
                            className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center justify-center gap-1.5 transition-all"
                          >
                            <XCircle size={12} />
                            Discard
                          </button>
                          <button
                            onClick={() => executeActions(ticket)}
                            className="flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-1.5 transition-all"
                          >
                            <CheckCircle size={12} />
                            Approve & Execute
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Run AI Triage button */
                      <button
                        onClick={() => runTriage(ticket.id)}
                        disabled={isTriaging}
                        className="w-full py-3 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                      >
                        {isTriaging ? (
                          <><Loader2 size={12} className="animate-spin" /> Analyzing…</>
                        ) : (
                          <><Bot size={12} /> Run AI Triage</>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved Tickets */}
      {closedTickets.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <CheckCircle size={12} className="text-green-500" />
            Resolved / Discarded ({closedTickets.length})
          </h4>
          {closedTickets.slice(0, 10).map((ticket) => {
            const profile = profileMap[ticket.user_id];
            return (
              <div key={ticket.id} className="bg-card border border-border p-3 flex items-center justify-between opacity-60">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{ticket.subject || "Support Request"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {profile?.athlete_name || profile?.full_name || "Unknown"} · {new Date(ticket.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 ${
                  ticket.status === "resolved" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
                }`}>
                  {ticket.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSupportCopilot;
