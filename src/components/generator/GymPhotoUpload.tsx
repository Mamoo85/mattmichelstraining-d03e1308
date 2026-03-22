import { useState, useRef, useCallback } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface GymPhotoUploadProps {
  onImageChange: (base64: string | null) => void;
}

const MAX_SIZE = 4 * 1024 * 1024; // 4MB

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix to get raw base64
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const GymPhotoUpload = ({ onImageChange }: GymPhotoUploadProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Image must be under 4MB.");
      return;
    }
    try {
      const b64 = await fileToBase64(file);
      setPreview(URL.createObjectURL(file));
      onImageChange(b64);
    } catch {
      setError("Failed to process image.");
    }
  }, [onImageChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleRemove = () => {
    setPreview(null);
    onImageChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block">
        📸 Snap Your Gym (Optional)
      </label>

      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-lg p-6 text-center transition-colors cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={32} className="mx-auto text-primary/40 group-hover:text-primary/70 transition-colors mb-2" />
            <p className="text-sm font-bold text-foreground mb-1">
              Snap a photo of your gym or equipment
            </p>
            <p className="text-[11px] text-muted-foreground mb-3">
              Drop an image here, click to browse, or use your camera
            </p>
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                <ImagePlus size={14} /> Browse
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
              >
                <Camera size={14} /> Camera
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative inline-block"
          >
            <img
              src={preview}
              alt="Gym equipment"
              className="w-32 h-32 object-cover rounded-lg border border-border"
            />
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/80 transition-colors shadow-md"
            >
              <X size={14} />
            </button>
            <p className="text-[10px] text-primary font-bold mt-1">✓ Gym photo attached</p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
      />
    </div>
  );
};

export default GymPhotoUpload;
