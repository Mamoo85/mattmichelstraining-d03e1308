import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, FileText, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LegalDoc {
  type: string;
  title: string;
  description: string;
  exists: boolean;
  id: string | null;
  version: number;
  status: string;
  lastReviewed: string | null;
  nextReview: string | null;
}

export default function AdminLegalCompliance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["legal-documents"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-lawyer-jess", {
        body: { action: "list" },
      });
      if (error) throw error;
      return (data?.documents || []) as LegalDoc[];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (documentType: string) => {
      setGeneratingType(documentType);
      const { data, error } = await supabase.functions.invoke("ai-lawyer-jess", {
        body: { action: "generate", documentType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Document Generated", description: "Jess created a new draft. Review and approve it." });
      if (data?.content) setPreviewContent(data.content);
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
      setGeneratingType(null);
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
      setGeneratingType(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (documentType: string) => {
      const { data, error } = await supabase.functions.invoke("ai-lawyer-jess", {
        body: { action: "approve", documentType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Document Approved" });
      queryClient.invalidateQueries({ queryKey: ["legal-documents"] });
    },
  });

  const statusBadge = (doc: LegalDoc) => {
    if (!doc.exists) return <Badge variant="destructive" className="text-[9px]">MISSING</Badge>;
    if (doc.status === "approved") return <Badge className="bg-green-600 text-[9px]">APPROVED</Badge>;
    if (doc.status === "draft") return <Badge variant="secondary" className="text-[9px]">DRAFT</Badge>;
    return <Badge variant="outline" className="text-[9px]">{doc.status}</Badge>;
  };

  const needsReview = (doc: LegalDoc) => {
    if (!doc.nextReview) return false;
    return new Date(doc.nextReview) < new Date();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  const missing = documents?.filter(d => !d.exists).length || 0;
  const drafts = documents?.filter(d => d.status === "draft").length || 0;
  const approved = documents?.filter(d => d.status === "approved").length || 0;
  const reviewDue = documents?.filter(d => needsReview(d)).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="text-primary" size={20} />
        <div>
          <h2 className="text-lg font-bold">Legal & Compliance — Jess AI</h2>
          <p className="text-xs text-muted-foreground">AI-generated legal documents for all M² services</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Missing", value: missing, color: "text-red-400" },
          { label: "Drafts", value: drafts, color: "text-yellow-400" },
          { label: "Approved", value: approved, color: "text-green-400" },
          { label: "Review Due", value: reviewDue, color: "text-orange-400" },
        ].map(s => (
          <Card key={s.label} className="border-border/40 bg-card/50">
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <FileText size={14} /> All Legal Documents ({documents?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {documents?.map(doc => (
              <div key={doc.type} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                {doc.exists && doc.status === "approved" ? (
                  <CheckCircle size={14} className="text-green-400 shrink-0" />
                ) : (
                  <AlertTriangle size={14} className={doc.exists ? "text-yellow-400" : "text-red-400"} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">{doc.title}</div>
                  <div className="text-[10px] text-muted-foreground">{doc.description}</div>
                  {doc.lastReviewed && (
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      v{doc.version} — reviewed {new Date(doc.lastReviewed).toLocaleDateString()}
                      {needsReview(doc) && <span className="text-orange-400 ml-1">• Review overdue</span>}
                    </div>
                  )}
                </div>
                {statusBadge(doc)}
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] px-2"
                    disabled={generatingType === doc.type}
                    onClick={() => generateMutation.mutate(doc.type)}
                  >
                    {generatingType === doc.type ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                    <span className="ml-1">{doc.exists ? "Regenerate" : "Generate"}</span>
                  </Button>
                  {doc.exists && doc.status === "draft" && (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] px-2"
                      onClick={() => approveMutation.mutate(doc.type)}
                    >
                      Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {previewContent && (
        <Card className="border-border/40">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">Document Preview</CardTitle>
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setPreviewContent(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none max-h-[500px] overflow-y-auto text-xs" dangerouslySetInnerHTML={{ __html: previewContent }} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
