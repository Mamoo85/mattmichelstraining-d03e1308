import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Check, X, ArrowRight, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BUCKET_BASE = "https://zmyczlfuufhngzovkjdh.supabase.co/storage/v1/object/public/exercise_reference_images/";

// Known page-number images from the bucket
const PAGE_IMAGES = [
  "page0045_Im341_450x482.jpg","page0085_Im653_450x466.jpg","page0102_Im787_504x500.jpg",
  "page0120_Im941_242x843.jpg","page0121_Im941_242x843.jpg","page0131_Im1030_450x511.jpg",
  "page0150_Im1193_450x495.jpg","page0152_Im1209_450x464.jpg","page0171_Im1366_407x550.jpg",
  "page0172_Im1373_344x550.jpg","page0203_Im1685_524x337.jpg","page0207_Im1721_497x410.jpg",
  "page0212_Im1762_437x381.jpg","page0225_Im1859_396x550.jpg","page0251_Im2103_450x495.jpg",
  "page0256_Im2144_383x406.jpg","page0262_Im2186_450x434.jpg","page0318_Im2690_392x528.jpg",
  "page0333_Im2853_450x417.jpg","page0347_Im3013_400x473.jpg","page0351_Im3045_550x390.jpg",
  "page0366_Im3182_531x450.jpg","page237_R1632_1000x519.jpg","page237_R1633_1000x494.jpg",
  "page239_R1650_1000x374.jpg","page241_R1662_1000x496.jpg","page242_R1669_1000x362.jpg",
  "page264_R1816_1000x399.jpg","page265_R1823_1000x373.jpg","page281_R1922_1000x370.jpg",
  "page281_R1923_1000x371.jpg","page282_R1930_1000x378.jpg","page282_R1932_1000x355.jpg",
  "page346_R2331_1000x485.jpg","page346_R2332_1000x465.jpg","page391_R2600_1000x591.jpg",
  "page392_R2608_1000x450.jpg","page392_R2609_1000x539.jpg","page393_R2616_1000x470.jpg",
  "page394_R2623_1000x467.jpg","page399_R2651_1000x462.jpg","page399_R2652_1000x357.jpg",
  "page401_R2669_1000x368.jpg","page402_R2676_1000x532.jpg","page411_R2730_1000x355.jpg",
  "page412_R2739_1000x380.jpg","page447_R2961_1000x356.jpg","page448_R2967_1000x379.jpg",
  "page456_R3021_1000x360.jpg","page457_R3029_1000x372.jpg","page457_R3030_1000x338.jpg",
  "page457_R3031_1000x369.jpg","page468_R3097_1000x372.jpg","page469_R3104_1000x365.jpg",
  "page469_R3106_1000x344.jpg","page470_R3113_1000x356.jpg","page470_R3114_1000x364.jpg",
  "page476_R3149_1000x494.jpg","page477_R3159_1000x361.jpg","page478_R3167_1000x399.jpg",
  "page481_R3186_1000x722.jpg","page482_R3193_1000x516.jpg","page646_R4180_1000x363.jpg",
  "page647_R4187_1000x357.jpg","page656_R4242_1000x359.jpg","page743_R4805_1000x370.jpg",
  "page764_R4951_1000x380.jpg","page765_R4958_1000x389.jpg","page766_R4965_1000x388.jpg",
];

interface Exercise {
  id: string;
  title: string;
  image_url: string | null;
}

const AdminImageMatcher = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("exercise_library")
        .select("id, title, image_url")
        .order("title");
      if (data) setExercises(data as Exercise[]);
      setLoading(false);
    };
    load();
  }, []);

  const unmatchedExercises = useMemo(
    () => exercises.filter((e) => !e.image_url),
    [exercises]
  );

  const remainingImages = useMemo(
    () => PAGE_IMAGES.filter((img) => !assigned[img] && !skipped.has(img) && !brokenImages.has(img)),
    [assigned, skipped, brokenImages]
  );

  const currentImage = remainingImages[0] || null;

  const filtered = useMemo(
    () =>
      unmatchedExercises.filter((e) =>
        e.title.toLowerCase().includes(search.toLowerCase())
      ),
    [unmatchedExercises, search]
  );

  const assignImage = async (exerciseId: string, exerciseTitle: string) => {
    if (!currentImage) return;
    setSaving(true);
    const imageUrl = BUCKET_BASE + currentImage;
    const { error } = await supabase
      .from("exercise_library")
      .update({ image_url: imageUrl })
      .eq("id", exerciseId);

    if (error) {
      toast({ title: "Failed to assign", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Assigned!", description: `${currentImage} → ${exerciseTitle}` });
      setAssigned((prev) => ({ ...prev, [currentImage]: exerciseTitle }));
      setExercises((prev) =>
        prev.map((e) => (e.id === exerciseId ? { ...e, image_url: imageUrl } : e))
      );
      setSearch("");
    }
    setSaving(false);
  };

  const skipImage = () => {
    if (!currentImage) return;
    setSkipped((prev) => new Set([...prev, currentImage]));
    setSearch("");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  const totalDone = Object.keys(assigned).length + skipped.size + brokenImages.size;
  const totalImages = PAGE_IMAGES.length;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ImageIcon size={16} className="text-primary" />
            Image Matcher
          </h3>
          <span className="text-xs text-muted-foreground">
            {Object.keys(assigned).length} assigned · {skipped.size} skipped · {remainingImages.length} remaining
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
            style={{ width: `${(totalDone / totalImages) * 100}%` }}
          />
        </div>
      </div>

      {!currentImage ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-2">
          <Check size={32} className="mx-auto text-primary" />
          <p className="text-sm font-bold text-foreground">All done!</p>
          <p className="text-xs text-muted-foreground">
            {Object.keys(assigned).length} images assigned, {skipped.size} skipped.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {/* Image preview */}
          <div className="bg-black/40 flex items-center justify-center p-4 min-h-[280px]">
            <img
              src={BUCKET_BASE + currentImage}
              alt="Unmatched exercise reference"
              className="max-h-[260px] max-w-full object-contain rounded-lg"
              onError={() => {
                setBrokenImages((prev) => new Set([...prev, currentImage]));
              }}
            />
          </div>

          <div className="p-4 space-y-3">
            <p className="text-[11px] font-mono text-muted-foreground truncate">{currentImage}</p>

            {/* Search */}
            <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-3 h-11">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Search exercise to match…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>

            {/* Exercise list */}
            <div className="max-h-[200px] overflow-y-auto divide-y divide-border rounded-xl border border-border">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 text-center">No unmatched exercises found</p>
              ) : (
                filtered.slice(0, 30).map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => assignImage(ex.id, ex.title)}
                    disabled={saving}
                    className={cn(
                      "w-full text-left p-3 text-sm text-foreground hover:bg-primary/10 transition-colors",
                      "flex items-center justify-between min-h-[44px]"
                    )}
                  >
                    <span className="truncate">{ex.title}</span>
                    <ArrowRight size={14} className="text-primary shrink-0 ml-2" />
                  </button>
                ))
              )}
            </div>

            {/* Skip button */}
            <button
              onClick={skipImage}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            >
              <X size={14} />
              Skip — Can't identify
            </button>
          </div>
        </div>
      )}

      {/* Recent assignments */}
      {Object.keys(assigned).length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Recent Assignments</h4>
          <div className="space-y-1 max-h-[150px] overflow-y-auto">
            {Object.entries(assigned).reverse().slice(0, 10).map(([img, title]) => (
              <div key={img} className="flex items-center gap-2 text-xs">
                <Check size={12} className="text-primary shrink-0" />
                <span className="text-foreground truncate">{title}</span>
                <span className="text-muted-foreground/50 truncate ml-auto text-[10px]">{img}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminImageMatcher;
