import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppNavbar from "@/components/AppNavbar";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Camera, Upload, Loader2, Flame, Beef, Wheat, Droplets, Leaf, Trash2, CalendarDays } from "lucide-react";
import { format } from "date-fns";

interface FoodItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

interface AnalysisResult {
  items: FoodItem[];
  note?: string;
}

const MacroPill = ({ icon: Icon, label, value, unit, color }: { icon: any; label: string; value: number; unit: string; color: string }) => (
  <div className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 ${color}`}>
    <Icon size={16} className="opacity-80" />
    <span className="text-lg font-bold">{Math.round(value)}</span>
    <span className="text-[10px] uppercase tracking-wider opacity-70">{unit} {label}</span>
  </div>
);

const Nutrition = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch history
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["nutrition-logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nutrition_logs")
        .select("*")
        .eq("user_id", user!.id)
        .order("logged_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Today's totals
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayLogs = logs.filter((l: any) => l.logged_at?.startsWith(todayStr));
  const todayTotals = todayLogs.reduce(
    (acc: any, l: any) => ({
      calories: acc.calories + (l.total_calories || 0),
      protein: acc.protein + Number(l.total_protein_g || 0),
      carbs: acc.carbs + Number(l.total_carbs_g || 0),
      fat: acc.fat + Number(l.total_fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const handleImageSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);
      setAnalysis(null);
      setAnalyzing(true);

      try {
        const { data, error } = await supabase.functions.invoke("analyze-food", {
          body: { imageBase64: base64 },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        setAnalysis(data as AnalysisResult);
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to analyze image");
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!analysis || !user) throw new Error("No analysis to save");
      const totals = analysis.items.reduce(
        (acc, i) => ({
          cal: acc.cal + i.calories,
          p: acc.p + i.protein_g,
          c: acc.c + i.carbs_g,
          f: acc.f + i.fat_g,
          fi: acc.fi + i.fiber_g,
        }),
        { cal: 0, p: 0, c: 0, f: 0, fi: 0 }
      );

      const { error } = await supabase.from("nutrition_logs").insert({
        user_id: user.id,
        food_items: analysis.items as any,
        total_calories: Math.round(totals.cal),
        total_protein_g: Math.round(totals.p * 10) / 10,
        total_carbs_g: Math.round(totals.c * 10) / 10,
        total_fat_g: Math.round(totals.f * 10) / 10,
        total_fiber_g: Math.round(totals.fi * 10) / 10,
        notes: analysis.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meal logged!");
      queryClient.invalidateQueries({ queryKey: ["nutrition-logs"] });
      setPreview(null);
      setAnalysis(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nutrition_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry deleted");
      queryClient.invalidateQueries({ queryKey: ["nutrition-logs"] });
    },
  });

  const totalCalFromAnalysis = analysis
    ? analysis.items.reduce((s, i) => s + i.calories, 0)
    : 0;
  const totalProtein = analysis ? analysis.items.reduce((s, i) => s + i.protein_g, 0) : 0;
  const totalCarbs = analysis ? analysis.items.reduce((s, i) => s + i.carbs_g, 0) : 0;
  const totalFat = analysis ? analysis.items.reduce((s, i) => s + i.fat_g, 0) : 0;
  const totalFiber = analysis ? analysis.items.reduce((s, i) => s + i.fiber_g, 0) : 0;

  return (
    <>
      <SEOHead title="Nutrition Tracker | M² Training" description="Snap a photo of your food and get instant calorie and macro estimates powered by AI." />
      <AppNavbar />
      <main className="min-h-screen bg-background pt-16 pb-24">
        <div className="container max-w-lg mx-auto space-y-6 px-4">
          {/* Header */}
          <div className="text-center pt-4">
            <h1 className="text-2xl font-black tracking-tight">NUTRITION TRACKER</h1>
            <p className="text-sm text-muted-foreground mt-1">Snap a photo → get instant macro estimates</p>
          </div>

          {/* Today's summary */}
          {todayLogs.length > 0 && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays size={14} /> Today's Totals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  <MacroPill icon={Flame} label="cal" value={todayTotals.calories} unit="" color="bg-orange-500/10 text-orange-600" />
                  <MacroPill icon={Beef} label="pro" value={todayTotals.protein} unit="g" color="bg-red-500/10 text-red-600" />
                  <MacroPill icon={Wheat} label="carb" value={todayTotals.carbs} unit="g" color="bg-amber-500/10 text-amber-600" />
                  <MacroPill icon={Droplets} label="fat" value={todayTotals.fat} unit="g" color="bg-blue-500/10 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Camera / Upload */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2 border-dashed"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera size={24} />
              <span className="text-xs">Take Photo</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2 border-dashed"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={24} />
              <span className="text-xs">Upload Image</span>
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
            />
          </div>

          {/* Preview + Analysis */}
          {preview && (
            <Card>
              <CardContent className="pt-4 space-y-4">
                <img
                  src={preview}
                  alt="Food"
                  className="w-full rounded-lg max-h-64 object-cover"
                />

                {analyzing && (
                  <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-sm">Analyzing your meal…</span>
                  </div>
                )}

                {analysis && (
                  <div className="space-y-4">
                    {/* Macro summary */}
                    <div className="grid grid-cols-5 gap-2">
                      <MacroPill icon={Flame} label="cal" value={totalCalFromAnalysis} unit="" color="bg-orange-500/10 text-orange-600" />
                      <MacroPill icon={Beef} label="pro" value={totalProtein} unit="g" color="bg-red-500/10 text-red-600" />
                      <MacroPill icon={Wheat} label="carb" value={totalCarbs} unit="g" color="bg-amber-500/10 text-amber-600" />
                      <MacroPill icon={Droplets} label="fat" value={totalFat} unit="g" color="bg-blue-500/10 text-blue-600" />
                      <MacroPill icon={Leaf} label="fib" value={totalFiber} unit="g" color="bg-green-500/10 text-green-600" />
                    </div>

                    <Separator />

                    {/* Itemized list */}
                    <div className="space-y-2">
                      {analysis.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{item.name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">({item.portion})</span>
                          </div>
                          <Badge variant="secondary">{item.calories} cal</Badge>
                        </div>
                      ))}
                    </div>

                    {analysis.note && (
                      <p className="text-xs text-muted-foreground italic">{analysis.note}</p>
                    )}

                    <Button
                      className="w-full"
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="animate-spin mr-2" size={16} />
                      ) : (
                        <Flame className="mr-2" size={16} />
                      )}
                      Log This Meal
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* History */}
          <div>
            <h2 className="text-lg font-bold mb-3">Recent Meals</h2>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={20} />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No meals logged yet. Snap a photo to get started!
              </p>
            ) : (
              <div className="space-y-3">
                {logs.map((log: any) => {
                  const items = (log.food_items as FoodItem[]) || [];
                  return (
                    <Card key={log.id} className="overflow-hidden">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.logged_at), "MMM d, h:mm a")}
                            </p>
                            <p className="text-sm font-semibold mt-0.5">
                              {items.map((i) => i.name).join(", ") || "Meal"}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(log.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        <div className="flex gap-3 text-xs">
                          <span className="text-orange-600 font-medium">{log.total_calories} cal</span>
                          <span className="text-red-600">{Number(log.total_protein_g)}g P</span>
                          <span className="text-amber-600">{Number(log.total_carbs_g)}g C</span>
                          <span className="text-blue-600">{Number(log.total_fat_g)}g F</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default Nutrition;
