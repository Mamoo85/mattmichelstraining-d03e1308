import { useState, lazy, Suspense, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle, X, Eye, Camera, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const SmartCamera = lazy(() => import("./SmartCamera"));

/* ─── Drag-and-drop upload zone ─── */
const DropZone = ({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
      );
      if (files.length) onFiles(files);
    },
    [disabled, onFiles]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onClick={() => {
        if (disabled) return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/*";
        input.multiple = true;
        input.onchange = () => {
          const files = Array.from(input.files || []);
          if (files.length) onFiles(files);
        };
        input.click();
      }}
      className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors
        ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <Upload size={28} className="text-muted-foreground" />
      <p className="text-sm text-muted-foreground text-center">
        Drag & drop images or video here, or <span className="text-primary underline">browse files</span>
      </p>
      <p className="text-xs text-muted-foreground">Front, side, and back profile shots or squat assessment video</p>
    </div>
  );
};

/* ─── Phase card for 3-phase display ─── */
const PhaseCard = ({ phase }: { phase: any }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="text-xs shrink-0">{phase.duration}</Badge>
      <span className="text-xs font-bold uppercase tracking-widest">{phase.phase_name}</span>
    </div>
    <p className="text-xs text-muted-foreground">{phase.focus}</p>
    <ul className="text-xs space-y-1 pl-4 list-disc">
      {phase.exercises?.map((ex: any, i: number) => (
        <li key={i}>
          <span className="font-medium">{ex.name}</span> — {ex.sets}×{ex.reps}
          {ex.notes && <span className="text-muted-foreground"> ({ex.notes})</span>}
        </li>
      ))}
    </ul>
  </div>
);

const AdminBiomechanics = () => {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFindings, setEditFindings] = useState("");
  const [editProgram, setEditProgram] = useState("");
  const [showCamera, setShowCamera] = useState(false);

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

  const handleUploadAndAnalyze = async (fileOrFiles: File | File[]) => {
    if (!selectedClient) {
      toast.error("Select a client first");
      return;
    }
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    if (!files.length) return;

    try {
      setUploading(true);
      const mediaUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${selectedClient}/${Date.now()}-${file.name}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("biomechanics_media").upload(path, file);
        if (uploadError) throw uploadError;
        const { data: signedData, error: signedError } = await supabase.storage
          .from("biomechanics_media")
          .createSignedUrl(path, 3600);
        if (signedError) throw signedError;
        mediaUrls.push(signedData.signedUrl);
      }

      setUploading(false);
      setAnalyzing(true);

      const { data, error } = await supabase.functions.invoke("analyze-biomechanics", {
        body: { mediaUrl: mediaUrls[0], mediaUrls, clientUserId: selectedClient },
      });
      if (error) throw error;
      toast.success(`Scan complete — ${files.length} angle(s) processed`);
      queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    } catch (e: any) {
      toast.error(e.message || "Upload/analysis failed");
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const startEdit = (assessment: any) => {
    setEditingId(assessment.id);
    setEditFindings(
      Array.isArray(assessment.ai_findings)
        ? assessment.ai_findings.join("\n")
        : JSON.stringify(assessment.ai_findings, null, 2)
    );
    setEditProgram(JSON.stringify(assessment.draft_program, null, 2));
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      let findingsPayload: string[];
      let programPayload: any;
      if (editingId === id) {
        findingsPayload = editFindings.split("\n").filter(Boolean);
        try { programPayload = JSON.parse(editProgram); } catch { throw new Error("Invalid JSON in program field"); }
      } else {
        const a = assessments?.find((a: any) => a.id === id);
        findingsPayload = a?.ai_findings as unknown as string[];
        programPayload = a?.draft_program;
      }
      const { error } = await supabase
        .from("client_assessments")
        .update({ status: "approved", ai_findings: findingsPayload, draft_program: programPayload })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assessment approved & assigned to client protocol");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["client-assessments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_assessments").update({ status: "rejected" }).eq("id", id);
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

  const renderProgram = (program: any) => {
    // Support both old (weeks) and new (phases) format
    const phases = program?.phases;
    if (phases?.length) {
      return (
        <div className="space-y-4">
          <p className="text-sm font-bold">{program.title}</p>
          {phases.map((phase: any, i: number) => (
            <PhaseCard key={i} phase={phase} />
          ))}
        </div>
      );
    }
    // Legacy weekly format fallback
    return (
      <div>
        <p className="text-xs font-bold uppercase text-muted-foreground mb-1">
          Program: {program?.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {program?.duration_weeks} weeks · {program?.weeks?.length} blocks
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest">
            Biomechanics & Posture AI Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue placeholder="Select target client..." />
            </SelectTrigger>
            <SelectContent>
              {profiles?.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.athlete_name || p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropZone
            disabled={!selectedClient || uploading || analyzing}
            onFiles={(files) => handleUploadAndAnalyze(files)}
          />

          <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={!selectedClient || uploading || analyzing}
              onClick={() => setShowCamera(true)}
              className="gap-2"
            >
              <Camera size={16} />
              Smart Capture
            </Button>
          </div>

          {(uploading || analyzing) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={16} />
              {uploading ? "Uploading media..." : "Scanning kinetic chain..."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assessments List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-widest">Assessments</CardTitle>
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
            <div className="space-y-6">
              {assessments.map((a: any) => (
                <div key={a.id} className="border border-border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{getClientName(a.client_user_id)}</span>
                      <Badge
                        variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}
                      >
                        {a.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Split-screen: Media left | Findings right */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">
                    {/* Left: Media */}
                    <div className="p-4 flex flex-col items-center justify-center gap-3 bg-muted/10 min-h-[200px]">
                      {a.media_url ? (
                        a.media_url.match(/\.(mp4|webm|mov)/i) ? (
                          <video src={a.media_url} controls className="max-h-64 rounded" />
                        ) : (
                          <img src={a.media_url} alt="Assessment media" className="max-h-64 rounded object-contain" />
                        )
                      ) : (
                        <ImageIcon size={48} className="text-muted-foreground/30" />
                      )}
                      <a
                        href={a.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary underline flex items-center gap-1"
                      >
                        <Eye size={12} /> Open full size
                      </a>
                    </div>

                    {/* Right: Findings + Program */}
                    <div className="p-4 space-y-4">
                      {editingId === a.id ? (
                        <>
                          <div>
                            <label className="text-xs font-bold uppercase text-muted-foreground">
                              Analysis Findings (one per line)
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
                              Corrective Protocol (JSON)
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
                                Analysis Findings
                              </p>
                              <ul className="list-disc list-inside text-xs space-y-0.5">
                                {(Array.isArray(a.ai_findings) ? a.ai_findings : []).map(
                                  (f: string, i: number) => (
                                    <li key={i}>{f}</li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                          {a.draft_program && renderProgram(a.draft_program)}
                        </>
                      )}

                      {a.status === "draft" && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                          {editingId !== a.id && (
                            <Button size="sm" variant="outline" onClick={() => startEdit(a)} className="text-xs">
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
                            Assign to Client Protocol
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
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-xs">
                              Cancel
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showCamera && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
              <Loader2 className="animate-spin text-white" size={32} />
            </div>
          }
        >
          <SmartCamera
            onCapture={(files) => {
              setShowCamera(false);
              handleUploadAndAnalyze(files);
            }}
            onClose={() => setShowCamera(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AdminBiomechanics;
