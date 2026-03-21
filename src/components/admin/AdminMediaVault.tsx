import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, Trash2, Image, Video, Music, Filter, CheckSquare, Wand2, Loader2, X } from "lucide-react";
import AiMediaStudio from "./AiMediaStudio";

interface MediaFile {
  id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  tags: string[];
  created_at: string;
}

const FILE_TYPE_ICONS: Record<string, typeof Image> = { image: Image, video: Video, audio: Music };
const FILE_TYPE_FILTERS = ["all", "image", "video", "audio"];

const AdminMediaVault = () => {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("all");
  const [showStudio, setShowStudio] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["admin-media-files", filter],
    queryFn: async () => {
      let q = supabase.from("admin_media_files" as any).select("*").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("file_type", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as MediaFile[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const toDelete = files.filter(f => ids.includes(f.id));
      for (const f of toDelete) {
        await supabase.storage.from("admin_media").remove([f.file_path]);
      }
      for (const id of ids) {
        await supabase.from("admin_media_files" as any).delete().eq("id", id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-media-files"] });
      setSelectedIds(new Set());
      toast.success("Deleted successfully");
    },
    onError: () => toast.error("Delete failed"),
  });

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files;
    if (!inputFiles?.length) return;
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      for (const file of Array.from(inputFiles)) {
        const fileType = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";
        const filePath = `${user.id}/${Date.now()}_${file.name}`;

        const { error: uploadErr } = await supabase.storage.from("admin_media").upload(filePath, file, { upsert: true });
        if (uploadErr) { toast.error(`Failed to upload ${file.name}`); continue; }

        await supabase.from("admin_media_files" as any).insert({
          file_path: filePath,
          file_name: file.name,
          file_type: fileType,
          file_size: file.size,
          uploaded_by: user.id,
          tags: [],
          metadata: { contentType: file.type },
        });
      }

      qc.invalidateQueries({ queryKey: ["admin-media-files"] });
      toast.success(`Uploaded ${inputFiles.length} file(s)`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [qc]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === files.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(files.map(f => f.id)));
  };

  const getPublicUrl = (path: string) =>
    supabase.storage.from("admin_media").getPublicUrl(path).data.publicUrl;

  const selectedFiles = files.filter(f => selectedIds.has(f.id));

  if (showStudio) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setShowStudio(false)} className="gap-1">
          <X size={14} /> Back to Vault
        </Button>
        <AiMediaStudio
          selectedFiles={selectedFiles.map(f => ({ id: f.id, url: getPublicUrl(f.file_path), name: f.file_name, type: f.file_type }))}
          onClose={() => setShowStudio(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer">
          <input type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          <Button asChild variant="default" size="sm" disabled={uploading}>
            <span className="gap-1.5">{uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload Media</span>
          </Button>
        </label>

        <div className="flex gap-1 ml-auto">
          {FILE_TYPE_FILTERS.map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="text-[10px] uppercase tracking-wider h-7 px-2">
              {f === "all" ? <Filter size={12} /> : null} {f}
            </Button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-md border">
          <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
          <Button size="sm" variant="default" className="gap-1 text-xs h-7" onClick={() => setShowStudio(true)}>
            <Wand2 size={12} /> AI Studio
          </Button>
          <Button size="sm" variant="destructive" className="gap-1 text-xs h-7" onClick={() => deleteMut.mutate(Array.from(selectedIds))}>
            <Trash2 size={12} /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={selectAll}>
            <CheckSquare size={12} /> {selectedIds.size === files.length ? "Deselect All" : "Select All"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : files.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Upload size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No media yet</p>
          <p className="text-xs">Upload photos, videos, or audio to get started</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {files.map(file => {
            const isSelected = selectedIds.has(file.id);
            const Icon = FILE_TYPE_ICONS[file.file_type] || Image;
            const url = getPublicUrl(file.file_path);
            return (
              <div
                key={file.id}
                onClick={() => toggleSelect(file.id)}
                className={`relative group cursor-pointer border-2 rounded-md overflow-hidden aspect-square transition-all ${
                  isSelected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                }`}
              >
                {file.file_type === "image" ? (
                  <img src={url} alt={file.file_name} className="w-full h-full object-cover" loading="lazy" />
                ) : file.file_type === "video" ? (
                  <video src={url} className="w-full h-full object-cover" muted preload="metadata" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Icon size={32} className="text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-1 left-1">
                  <Checkbox checked={isSelected} className="bg-background/80 border-border" />
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                  <p className="text-[9px] text-white truncate font-medium">{file.file_name}</p>
                </div>
                <div className="absolute top-1 right-1">
                  <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4 bg-background/80">
                    <Icon size={8} className="mr-0.5" />{file.file_type}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminMediaVault;
