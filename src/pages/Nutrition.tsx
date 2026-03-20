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
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Camera, Loader2, Flame, Beef, Wheat, Droplets, Leaf,
  Trash2, Target, Pencil, Check, X, Printer,
} from "lucide-react";
import { format } from "date-fns";
import WeeklyMacroChart from "@/components/nutrition/WeeklyMacroChart";
import MacroDonut from "@/components/nutrition/MacroDonut";
import NutritionStats from "@/components/nutrition/NutritionStats";
import { printNutritionReport } from "@/components/nutrition/printNutritionReport";

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

interface MacroGoals {
  daily_calorie_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fat_goal: number;
}

const DEFAULT_GOALS: MacroGoals = {
  daily_calorie_goal: 2000,
  daily_protein_goal: 150,
  daily_carbs_goal: 250,
  daily_fat_goal: 65,
};

const MACRO_CONFIG = [
  { key: "daily_calorie_goal", icon: Flame, label: "Cal", totalKey: "calories" as const, unit: "", color: "text-orange-600" },
  { key: "daily_protein_goal", icon: Beef, label: "Pro", totalKey: "protein" as const, unit: "g", color: "text-red-600" },
  { key: "daily_carbs_goal", icon: Wheat, label: "Carb", totalKey: "carbs" as const, unit: "g", color: "text-amber-600" },
  { key: "daily_fat_goal", icon: Droplets, label: "Fat", totalKey: "fat" as const, unit: "g", color: "text-blue-600" },
];

const MacroPill = ({ icon: Icon, label, value, unit, color }: { icon: any; label: string; value: number; unit: string; color: string }) => (
  <div className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 ${color} min-w-0`}>
    <Icon size={14} className="opacity-80 shrink-0" />
    <span className="text-lg font-bold">{Math.round(value)}</span>
    <span className="text-[10px] uppercase tracking-wider opacity-70">{unit} {label}</span>
  </div>
);

const Nutrition = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [editableItems, setEditableItems] = useState<FoodItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});

  const { data: profile } = useQuery({
    queryKey: ["profile-nutrition-goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("daily_calorie_goal, daily_protein_goal, daily_carbs_goal, daily_fat_goal, full_name")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const goals: MacroGoals = {
    daily_calorie_goal: (profile as any)?.daily_calorie_goal ?? DEFAULT_GOALS.daily_calorie_goal,
    daily_protein_goal: (profile as any)?.daily_protein_goal ?? DEFAULT_GOALS.daily_protein_goal,
    daily_carbs_goal: (profile as any)?.daily_carbs_goal ?? DEFAULT_GOALS.daily_carbs_goal,
    daily_fat_goal: (profile as any)?.daily_fat_goal ?? DEFAULT_GOALS.daily_fat_goal,
  };

  const updateGoalMutation = useMutation({
    mutationFn: async (updates: Record<string, number>) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates as any)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Goals updated!");
      queryClient.invalidateQueries({ queryKey: ["profile-nutrition-goals"] });
      setEditingGoals(false);
    },
    onError: (e: any) => toast.error(e.message || "Failed to update goals"),
  });

  const handleSaveAllGoals = () => {
    const updates: Record<string, number> = {};
    for (const m of MACRO_CONFIG) {
      const val = parseInt(goalInputs[m.key] || String((goals as any)[m.key]));
      if (!val || val <= 0) { toast.error("All goals must be greater than 0"); return; }
      updates[m.key] = val;
    }
    updateGoalMutation.mutate(updates);
  };

  const startEditingGoals = () => {
    setGoalInputs(Object.fromEntries(MACRO_CONFIG.map(m => [m.key, String((goals as any)[m.key])])));
    setEditingGoals(true);
  };

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
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setPreview(base64);
      setAnalysis(null);
      setAnalyzing(true);
      try {
        const { data, error } = await supabase.functions.invoke("analyze-food", { body: { imageBase64: base64 } });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setAnalysis(data as AnalysisResult);
        setEditableItems((data as AnalysisResult).items.map(item => ({ ...item })));
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
      if (!editableItems.length || !user) throw new Error("No analysis to save");
      const totals = editableItems.reduce(
        (acc, i) => ({ cal: acc.cal + i.calories, p: acc.p + i.protein_g, c: acc.c + i.carbs_g, f: acc.f + i.fat_g, fi: acc.fi + i.fiber_g }),
        { cal: 0, p: 0, c: 0, f: 0, fi: 0 }
      );
      const { error } = await supabase.from("nutrition_logs").insert({
        user_id: user.id,
        food_items: editableItems as any,
        total_calories: Math.round(totals.cal),
        total_protein_g: Math.round(totals.p * 10) / 10,
        total_carbs_g: Math.round(totals.c * 10) / 10,
        total_fat_g: Math.round(totals.f * 10) / 10,
        total_fiber_g: Math.round(totals.fi * 10) / 10,
        notes: analysis?.note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Meal logged!");
      queryClient.invalidateQueries({ queryKey: ["nutrition-logs"] });
      setPreview(null);
      setAnalysis(null);
      setEditableItems([]);
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

  const totalCalFromAnalysis = editableItems.reduce((s, i) => s + i.calories, 0);
  const totalProtein = editableItems.reduce((s, i) => s + i.protein_g, 0);
  const totalCarbs = editableItems.reduce((s, i) => s + i.carbs_g, 0);
  const totalFat = editableItems.reduce((s, i) => s + i.fat_g, 0);
  const totalFiber = editableItems.reduce((s, i) => s + i.fiber_g, 0);

  const updateItem = (index: number, field: keyof FoodItem, value: number) => {
    setEditableItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: Math.max(0, value) } : item
    ));
  };

  const handlePrint = () => {
    printNutritionReport({
      logs: logs as any,
      goals,
      userName: (profile as any)?.full_name || undefined,
    });
  };

  return (
    <>
      <SEOHead title="Nutrition Tracker | M² Training" description="Snap a photo of your food and get instant calorie and macro estimates — built into your M² dashboard." path="/nutrition" />
      <AppNavbar />
      <main className="min-h-screen bg-background pt-16 pb-12">
        <div className="container max-w-lg mx-auto space-y-5 px-4">
          {/* Header */}
          <div className="text-center pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black tracking-tight">NUTRITION TRACKER</h1>
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={handlePrint} title="Print Report">
                <Printer size={16} />
              </Button>
            </div>
            <Button className="w-full gap-2" size="lg" onClick={() => fileInputRef.current?.click()}>
              <Camera size={18} /> Snap or Upload a Meal Photo
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])} />
          </div>

          {/* Quick Stats */}
          <NutritionStats logs={logs as any} />

          {/* Daily Goals */}
          <Card className="border-primary/20">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target size={14} /> Today's Progress
                </CardTitle>
                {editingGoals ? (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveAllGoals} disabled={updateGoalMutation.isPending}>
                      <Check size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingGoals(false)}>
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={startEditingGoals}>
                    <Pencil size={12} />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 pb-4">
              {MACRO_CONFIG.map(({ key, icon: Icon, label, totalKey, unit, color }) => {
                const current = todayTotals[totalKey];
                const goal = (goals as any)[key];
                const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
                const reached = current >= goal;
                return (
                  <div key={key} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`flex items-center gap-1 font-medium ${color}`}>
                        <Icon size={12} /> {label}
                      </span>
                      {editingGoals ? (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{Math.round(current)}{unit} /</span>
                          <Input
                            type="number"
                            value={goalInputs[key] || ""}
                            onChange={(e) => setGoalInputs(prev => ({ ...prev, [key]: e.target.value }))}
                            className="w-14 h-5 text-xs px-1 py-0"
                            min={1}
                          />
                          <span className="text-muted-foreground">{unit}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {Math.round(current)}{unit} / {goal}{unit} {reached && "✓"}
                        </span>
                      )}
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Macro Breakdown Donut */}
          {(todayTotals.protein > 0 || todayTotals.carbs > 0 || todayTotals.fat > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Today's Macro Split</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <MacroDonut protein={todayTotals.protein} carbs={todayTotals.carbs} fat={todayTotals.fat} />
              </CardContent>
            </Card>
          )}

          {/* 7-Day Trend Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">7-Day Trend</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <WeeklyMacroChart logs={logs as any} calorieGoal={goals.daily_calorie_goal} />
              {!logs.some((l: any) => l.total_calories > 0) && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Log meals to see your weekly trends
                </p>
              )}
            </CardContent>
          </Card>

          {/* Preview + Analysis */}
          {preview && (
            <Card>
              <CardContent className="pt-4 space-y-4">
                <img src={preview} alt="Food" className="w-full rounded-lg max-h-64 object-cover" />
                {analyzing && (
                  <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="text-sm">Analyzing your meal…</span>
                  </div>
                )}
                {analysis && editableItems.length > 0 && (
                  <div className="space-y-4">
                    {/* Live totals */}
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      <MacroPill icon={Flame} label="cal" value={totalCalFromAnalysis} unit="" color="bg-orange-500/10 text-orange-600" />
                      <MacroPill icon={Beef} label="pro" value={totalProtein} unit="g" color="bg-red-500/10 text-red-600" />
                      <MacroPill icon={Wheat} label="carb" value={totalCarbs} unit="g" color="bg-amber-500/10 text-amber-600" />
                      <MacroPill icon={Droplets} label="fat" value={totalFat} unit="g" color="bg-blue-500/10 text-blue-600" />
                      <MacroPill icon={Leaf} label="fib" value={totalFiber} unit="g" color="bg-green-500/10 text-green-600" />
                    </div>

                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary font-bold">
                      <Pencil size={10} />
                      Tap any number to adjust before saving
                    </div>

                    <Separator />

                    {/* Editable food items */}
                    <div className="space-y-3">
                      {editableItems.map((item, i) => (
                        <div key={i} className="bg-muted/50 border border-border rounded-md p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-bold text-foreground">{item.name}</span>
                              <span className="text-muted-foreground ml-2 text-xs">({item.portion})</span>
                            </div>
                            <button
                              onClick={() => setEditableItems(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            <div className="space-y-0.5">
                              <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Cal</label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                value={item.calories || ""}
                                onChange={(e) => updateItem(i, "calories", parseInt(e.target.value) || 0)}
                                className="h-8 text-xs text-center font-mono px-1"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Pro</label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={item.protein_g || ""}
                                onChange={(e) => updateItem(i, "protein_g", parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs text-center font-mono px-1"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Carb</label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={item.carbs_g || ""}
                                onChange={(e) => updateItem(i, "carbs_g", parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs text-center font-mono px-1"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Fat</label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={item.fat_g || ""}
                                onChange={(e) => updateItem(i, "fat_g", parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs text-center font-mono px-1"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <label className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Fib</label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={item.fiber_g || ""}
                                onChange={(e) => updateItem(i, "fiber_g", parseFloat(e.target.value) || 0)}
                                className="h-8 text-xs text-center font-mono px-1"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {analysis.note && <p className="text-xs text-muted-foreground italic">{analysis.note}</p>}
                    <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" size={16} /> : <Flame className="mr-2" size={16} />}
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
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(log.id)}>
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
