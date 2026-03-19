import { useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle, X, Eye, Camera } from "lucide-react";
import { toast } from "sonner";

const SmartCamera = lazy(() => import("./SmartCamera"));

const AdminBiomechanics = () => {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFindings, setEditFindings] = useState("");
  const [editProgram, setEditProgram] = useState("");
  const [showCamera, setShowCamera] = useState(false);

  // Fetch profiles for client selector
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-biomechanics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch assessments
  const { data: assessments, isLoading: loadingAssessments } = useQuery({
    queryKey: ["client-assessments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_assessments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Upload + analyze
  const handleUploadAndAnalyze = async (file: File) => {
    if (!selectedClient) {
      toast.error("Select a client first");
      return;
    }

    try {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${selectedClient}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("biomechanics_media")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("biomechanics_media")
        .getPublicUrl(path);

      // Since bucket is private, we need a signed URL for AI
      const { data: signedData, error: signedError } = await supabase.storage
        .from("biomechanics_media")
        .createSignedUrl(path, 3600);
      if (signedError) throw signedError;

      const mediaUrl = signedData.signedUrl;
      setUploading(false);
      setAnalyzing(true);

      const { data, error } = await supabase.functions.invoke("analyze-biomechanics", {
        body: { mediaUrl, clientUserId: selectedClient },
      });

      if (error) throw error;
      toast.success("Analysis complete — draft saved");
      queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    } catch (e: any) {
      toast.error(e.message || "Upload/analysis failed");
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  // Start editing a draft
  const startEdit = (assessment: any) => {
    setEditingId(assessment.id);
    setEditFindings(
      Array.isArray(assessment.ai_findings)
        ? assessment.ai_findings.join("\n")
        : JSON.stringify(assessment.ai_findings, null, 2)
    );
    setEditProgram(JSON.stringify(assessment.draft_program, null, 2));
  };

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      let findingsPayload: string[];
      let programPayload: any;

      if (editingId === id) {
        findingsPayload = editFindings.split("\n").filter(Boolean);
        try {
          programPayload = JSON.parse(editProgram);
        } catch {
          throw new Error("Invalid JSON in program field");
        }
      } else {
        const a = assessments?.find((a: any) => a.id === id);
        findingsPayload = a?.ai_findings as unknown as string[];
        programPayload = a?.draft_program;
      }

      const { error } = await supabase
        .from("client_assessments")
        .update({
          status: "approved",
          ai_findings: findingsPayload,
          draft_program: programPayload,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assessment approved & assigned");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_assessments")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assessment rejected");
      queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getClientName = (userId: string) => {
    const p = profiles?.find((p) => p.user_id === userId);
    return p?.athlete_name || p?.full_name || p?.email || userId.slice(0, 8);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest">
            New Biomechanics Assessment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue placeholder="Select athlete..." />
            </SelectTrigger>
            <SelectContent>
              {profiles?.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.athlete_name || p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="file"
                accept="image/*,video/*"
                disabled={!selectedClient || uploading || analyzing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadAndAnalyze(file);
                }}
              />
            </div>
            <Button
              variant="outline"
              disabled={!selectedClient || uploading || analyzing}
              onClick={() => {
                if (!selectedClient) {
                  toast.error("Select a client first");
                  return;
                }
                setShowCamera(true);
              }}
              className="gap-2 shrink-0"
            >
              <Camera size={16} />
              Smart Capture
            </Button>
          </div>

          {(uploading || analyzing) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={16} />
              {uploading ? "Uploading media..." : "AI analyzing biomechanics..."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drafts / Assessments List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest">
            Assessments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAssessments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={20} />
            </div>
          ) : !assessments?.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No assessments yet. Upload media above to start.
            </p>
          ) : (
            <div className="space-y-4">
              {assessments.map((a: any) => (
                <div key={a.id} className="border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {getClientName(a.client_user_id)}
                      </span>
                      <Badge
                        variant={
                          a.status === "approved"
                            ? "default"
                            : a.status === "rejected"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Media preview link */}
                  <a
                    href={a.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline flex items-center gap-1"
                  >
                    <Eye size={12} /> View Media
                  </a>

                  {editingId === a.id ? (
                    <>
                      <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground">
                          Findings (one per line)
                        </label>
                        <Textarea
                          value={editFindings}
                          onChange={(e) => setEditFindings(e.target.value)}
                          rows={6}
                          className="mt-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground">
                          Program (JSON)
                        </label>
                        <Textarea
                          value={editProgram}
                          onChange={(e) => setEditProgram(e.target.value)}
                          rows={10}
                          className="mt-1 text-xs font-mono"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {a.ai_findings && (
                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground mb-1">
                            Findings
                          </p>
                          <ul className="list-disc list-inside text-xs space-y-0.5">
                            {(Array.isArray(a.ai_findings)
                              ? a.ai_findings
                              : []
                            ).map((f: string, i: number) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {a.draft_program && (
                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground mb-1">
                            Program: {(a.draft_program as any)?.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(a.draft_program as any)?.duration_weeks} weeks ·{" "}
                            {(a.draft_program as any)?.weeks?.length} blocks
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {a.status === "draft" && (
                    <div className="flex gap-2 pt-2">
                      {editingId !== a.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(a)}
                          className="text-xs"
                        >
                          Edit Draft
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate(a.id)}
                        disabled={approveMutation.isPending}
                        className="text-xs active:scale-95 transition-transform duration-100 hover:brightness-110"
                      >
                        <CheckCircle size={14} className="mr-1" />
                        Approve & Assign
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMutation.mutate(a.id)}
                        disabled={rejectMutation.isPending}
                        className="text-xs"
                      >
                        <X size={14} className="mr-1" />
                        Reject
                      </Button>
                      {editingId === a.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Smart Camera overlay */}
      {showCamera && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={32} />
            </div>
          }
        >
          <SmartCamera
            onCapture={(file) => {
              setShowCamera(false);
              handleUploadAndAnalyze(file);
            }}
            onClose={() => setShowCamera(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AdminBiomechanics;
