import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Reply {
  id: string;
  prospect_id: string | null;
  channel: "email" | "sms";
  from_address: string;
  subject: string | null;
  body: string;
  sentiment: string;
  actioned_at: string | null;
  created_at: string;
  prospect?: {
    business_name: string | null;
    owner_name: string | null;
  } | null;
}

const CALENDLY_URL = "https://calendly.com/detroitwebagency/discovery";

const PRODUCT_COLORS: Record<string, string> = {
  email: "bg-cyan-900 text-cyan-300",
  sms: "bg-purple-900 text-purple-300",
};

export default function AdminReplyInbox() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unactioned">("unactioned");

  const { data: replies, isLoading } = useQuery({
    queryKey: ["admin_reply_inbox", filter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("outreach_replies")
        .select(`
          id, prospect_id, channel, from_address, subject, body,
          sentiment, actioned_at, created_at,
          contractor_outreach_prospects (business_name, owner_name)
        `)
        .eq("sentiment", "positive")
        .order("created_at", { ascending: false })
        .limit(50);

      if (filter === "unactioned") q = q.is("actioned_at", null);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        prospect: r.contractor_outreach_prospects ?? null,
      })) as Reply[];
    },
    refetchInterval: 30000,
  });

  const markActioned = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any)
        .from("outreach_replies")
        .update({ actioned_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_reply_inbox"] }),
  });

  const snooze = useMutation({
    mutationFn: async (id: string) => {
      const snoozeUntil = new Date(Date.now() + 86400000).toISOString();
      await (supabase as any)
        .from("outreach_replies")
        .update({ actioned_at: snoozeUntil })
        .eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_reply_inbox"] }),
  });

  const unactionedCount = replies?.filter((r) => !r.actioned_at).length ?? 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Positive Reply Inbox</h2>
          <p className="text-sm text-slate-400">All products · Positive sentiment only</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filter === "unactioned" ? "default" : "outline"}
            onClick={() => setFilter("unactioned")}
            className={filter === "unactioned" ? "bg-cyan-600 hover:bg-cyan-700" : "border-slate-600 text-slate-300"}
          >
            Unactioned {unactionedCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 rounded-full">{unactionedCount}</span>}
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            className={filter === "all" ? "bg-cyan-600 hover:bg-cyan-700" : "border-slate-600 text-slate-300"}
          >
            All
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-slate-400 text-sm">Loading replies…</p>}

      {!isLoading && !replies?.length && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-4xl mb-3">📬</p>
          <p>No {filter === "unactioned" ? "unactioned " : ""}positive replies yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {(replies || []).map((r) => {
          const company = r.prospect?.business_name || r.from_address;
          const person = r.prospect?.owner_name || null;
          const isActioned = !!r.actioned_at && new Date(r.actioned_at) <= new Date();
          const calendarHref = `${CALENDLY_URL}?name=${encodeURIComponent(person || "")}&email=${encodeURIComponent(r.channel === "email" ? r.from_address : "")}`;

          return (
            <Card key={r.id} className={`bg-[#162236] border-slate-700 ${isActioned ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={PRODUCT_COLORS[r.channel] || "bg-slate-700 text-slate-300"}>
                        {r.channel}
                      </Badge>
                      <span className="text-white font-semibold text-sm truncate">{company}</span>
                      {person && <span className="text-slate-400 text-xs">· {person}</span>}
                      <span className="text-slate-500 text-xs ml-auto">
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {r.subject && <p className="text-slate-400 text-xs mb-1 italic">Re: {r.subject}</p>}
                    <p className="text-slate-300 text-sm line-clamp-2">{r.body.slice(0, 200)}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <a
                    href={calendarHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-cyan-700 hover:bg-cyan-600 text-white rounded-md transition-colors"
                  >
                    📅 Send Calendar Link
                  </a>
                  {!isActioned && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-green-700 text-green-400 hover:bg-green-900 h-7"
                        onClick={() => markActioned.mutate(r.id)}
                        disabled={markActioned.isPending}
                      >
                        ✅ Mark Won / Done
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs border-slate-600 text-slate-400 hover:bg-slate-800 h-7"
                        onClick={() => snooze.mutate(r.id)}
                        disabled={snooze.isPending}
                      >
                        💤 Snooze 24h
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
