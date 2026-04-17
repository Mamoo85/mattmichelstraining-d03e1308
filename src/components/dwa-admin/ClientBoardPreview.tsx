import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, ExternalLink, Mail, Phone, Globe, DollarSign, Activity, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    id: string;
    business_name: string;
    owner_name?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    industry?: string | null;
    monthly_price?: number | null;
    status?: string | null;
    visitor_script_key?: string | null;
  } | null;
}

export default function ClientBoardPreview({ open, onOpenChange, client }: Props) {
  const { data: visitors, isLoading: vLoading } = useQuery({
    queryKey: ["client_board_visitors", client?.id],
    queryFn: async () => {
      if (!client) return [];
      const { data } = await (supabase as any)
        .from("crm_visitor_events")
        .select("id, page, company_name, city, state, created_at, lead_auto_created")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(15);
      return data || [];
    },
    enabled: !!client && open,
  });

  const { data: jobs, isLoading: jLoading } = useQuery({
    queryKey: ["client_board_jobs", client?.id],
    queryFn: async () => {
      if (!client) return [];
      const { data } = await (supabase as any)
        .from("field_service_jobs")
        .select("id, customer_name, status, created_at, scheduled_start")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!client && open,
  });

  if (!client) return null;
  const mrr = client.monthly_price ? `$${(client.monthly_price / 100).toFixed(0)}/mo` : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Eye size={18} /> View as Customer
          </SheetTitle>
          <SheetDescription>Snapshot of what {client.business_name} sees in their dashboard.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Identity card */}
          <Card className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black text-base">{client.business_name}</p>
                {client.owner_name && <p className="text-xs text-muted-foreground">{client.owner_name}</p>}
              </div>
              {client.status && <Badge variant={client.status === "active" ? "default" : "outline"}>{client.status}</Badge>}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t">
              {client.industry && <span className="capitalize">{client.industry.replace(/_/g, " ")}</span>}
              {client.phone && <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone size={11} />{client.phone}</a>}
              {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail size={11} />{client.email}</a>}
              {client.website && (
                <a href={client.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                  <Globe size={11} />{client.website.replace(/^https?:\/\//, "")}<ExternalLink size={9} />
                </a>
              )}
            </div>
          </Card>

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-3">
              <DollarSign size={14} className="text-emerald-500 mb-1" />
              <p className="font-black text-lg">{mrr}</p>
              <p className="text-[10px] text-muted-foreground uppercase">MRR</p>
            </Card>
            <Card className="p-3">
              <Eye size={14} className="text-blue-500 mb-1" />
              <p className="font-black text-lg">{visitors?.length ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Visitors</p>
            </Card>
            <Card className="p-3">
              <Activity size={14} className="text-orange-500 mb-1" />
              <p className="font-black text-lg">{jobs?.length ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Jobs</p>
            </Card>
          </div>

          {/* Visitor feed */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Visitor Intel (last 15)</p>
            <Card className="divide-y divide-border/40">
              {vLoading && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-1" /> Loading…</div>}
              {!vLoading && !visitors?.length && <div className="p-4 text-center text-sm text-muted-foreground">No tracked visitors yet.</div>}
              {visitors?.map((v: any) => (
                <div key={v.id} className="p-2.5 text-xs flex items-center gap-2">
                  <span className="font-medium truncate flex-1">{v.company_name || "Unknown company"}</span>
                  {v.lead_auto_created && <Badge variant="default" className="text-[9px]">Lead</Badge>}
                  <span className="text-muted-foreground truncate max-w-[140px]">{v.page?.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                  <span className="text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </Card>
          </div>

          {/* Recent jobs */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Recent Jobs</p>
            <Card className="divide-y divide-border/40">
              {jLoading && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin inline mr-1" /> Loading…</div>}
              {!jLoading && !jobs?.length && <div className="p-4 text-center text-sm text-muted-foreground">No jobs in their dispatch board.</div>}
              {jobs?.map((j: any) => (
                <div key={j.id} className="p-2.5 text-xs flex items-center gap-2">
                  <span className="font-medium truncate flex-1">{j.customer_name || "Unnamed customer"}</span>
                  <Badge variant="outline" className="text-[9px]">{j.status || "scheduled"}</Badge>
                  <span className="text-muted-foreground">{j.scheduled_start ? new Date(j.scheduled_start).toLocaleDateString() : new Date(j.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </Card>
          </div>

          {client.website && (
            <Button variant="outline" className="w-full" asChild>
              <a href={client.website} target="_blank" rel="noreferrer">
                <ExternalLink size={14} className="mr-1.5" /> Open their live website
              </a>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
