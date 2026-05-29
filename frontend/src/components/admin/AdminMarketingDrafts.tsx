import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { FileCheck, Trash2, Check, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";

interface Draft {
  id: string;
  title: string;
  body: string;
  draft_type: string;
  status: string;
  generated_by: string;
  approved_by: string | null;
  approved_at: string | null;
  admin_notes: string | null;
  created_at: string;
}

const AdminMarketingDrafts = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [genTarget, setGenTarget] = useState("parents");
  const [genFocus, setGenFocus] = useState("membership plans");

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["marketing-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_drafts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Draft[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_drafts").update({
        status: "approved",
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-drafts"] }); toast.success("Approved & published"); },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_drafts").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-drafts"] }); toast.success("Rejected"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("marketing_drafts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-drafts"] }); toast.success("Deleted"); },
  });

  const generateAd = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-admin-assist", {
        body: { type: "generate_ad", context: { target: genTarget, focus: genFocus, platform: "website" } },
      });
      if (error) throw error;

      // The result is queued — but also try to save as a marketing_draft
      if (data?.result) {
        try {
          const parsed = JSON.parse(data.result);
          await supabase.from("marketing_drafts").insert({
            title: parsed.title || "AI Ad Draft",
            body: parsed.body || data.result,
            draft_type: "ad",
            status: "pending",
            generated_by: "ai",
          });
        } catch {
          await supabase.from("marketing_drafts").insert({
            title: "AI Ad Draft",
            body: data.result,
            draft_type: "ad",
            status: "pending",
            generated_by: "ai",
          });
        }
      }

      qc.invalidateQueries({ queryKey: ["marketing-drafts"] });
      toast.success(data?.queued ? "Ad generated and queued for review" : "Ad draft created");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const pending = drafts.filter((d) => d.status === "pending");
  const approved = drafts.filter((d) => d.status === "approved");
  const rejected = drafts.filter((d) => d.status === "rejected");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileCheck size={18} className="text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Marketing Drafts — Approve Before Publishing</h3>
      </div>

      {/* Generator */}
      <div className="bg-muted p-4 space-y-3 border border-border">
        <p className="text-xs font-bold text-foreground">Generate AI Ad Copy (prices enforced from Service Catalog)</p>
        <div className="flex gap-2">
          <Input placeholder="Target audience" value={genTarget} onChange={(e) => setGenTarget(e.target.value)} className="text-sm" />
          <Input placeholder="Focus (e.g. membership plans)" value={genFocus} onChange={(e) => setGenFocus(e.target.value)} className="text-sm" />
        </div>
        <Button size="sm" onClick={generateAd} disabled={generating}>
          {generating ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Sparkles size={14} className="mr-1" />}
          Generate Ad
        </Button>
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-bold text-foreground mb-2">Pending Review ({pending.length})</p>
          <div className="space-y-2">
            {pending.map((d) => (
              <DraftCard key={d.id} draft={d} onApprove={() => approve.mutate(d.id)} onReject={() => reject.mutate(d.id)} onDelete={() => remove.mutate(d.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <div>
          <p className="text-xs font-bold text-foreground mb-2">Approved ({approved.length})</p>
          <div className="space-y-2">
            {approved.map((d) => (
              <DraftCard key={d.id} draft={d} onDelete={() => remove.mutate(d.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <div>
          <p className="text-xs font-bold text-foreground mb-2">Rejected ({rejected.length})</p>
          <div className="space-y-2">
            {rejected.map((d) => (
              <DraftCard key={d.id} draft={d} onDelete={() => remove.mutate(d.id)} />
            ))}
          </div>
        </div>
      )}

      {!isLoading && drafts.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-8">No drafts yet. Generate one above.</p>
      )}
    </div>
  );
};

function DraftCard({ draft, onApprove, onReject, onDelete }: { draft: Draft; onApprove?: () => void; onReject?: () => void; onDelete: () => void }) {
  const statusColor = draft.status === "approved" ? "text-green-500" : draft.status === "rejected" ? "text-destructive" : "text-yellow-500";

  return (
    <div className="bg-card border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-foreground">{draft.title}</span>
          <span className={`text-[10px] ml-2 font-bold uppercase ${statusColor}`}>{draft.status}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{new Date(draft.created_at).toLocaleDateString()}</span>
      </div>
      <div className="prose prose-sm text-xs text-muted-foreground max-h-40 overflow-y-auto">
        <ReactMarkdown>{draft.body}</ReactMarkdown>
      </div>
      <div className="flex gap-2">
        {onApprove && draft.status === "pending" && (
          <Button size="sm" variant="default" onClick={onApprove}><Check size={12} className="mr-1" /> Approve & Publish</Button>
        )}
        {onReject && draft.status === "pending" && (
          <Button size="sm" variant="outline" onClick={onReject}><X size={12} className="mr-1" /> Reject</Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 size={12} /></Button>
      </div>
    </div>
  );
}

export default AdminMarketingDrafts;
