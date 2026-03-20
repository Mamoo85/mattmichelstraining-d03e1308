import { M2_LOGO_BASE64 } from "@/components/workout/m2LogoBase64";
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

interface NutritionLog {
  logged_at: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  food_items: FoodItem[];
}

interface Goals {
  daily_calorie_goal: number;
  daily_protein_goal: number;
  daily_carbs_goal: number;
  daily_fat_goal: number;
}

interface PrintOptions {
  logs: NutritionLog[];
  goals: Goals;
  userName?: string;
}

export function printNutritionReport({ logs, goals, userName }: PrintOptions) {
  const today = format(new Date(), "MMMM d, yyyy");
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayLogs = logs.filter((l) => l.logged_at?.startsWith(todayKey));

  const todayTotals = todayLogs.reduce(
    (acc, l) => ({
      cal: acc.cal + (l.total_calories || 0),
      pro: acc.pro + Number(l.total_protein_g || 0),
      carbs: acc.carbs + Number(l.total_carbs_g || 0),
      fat: acc.fat + Number(l.total_fat_g || 0),
      fiber: acc.fiber + Number(l.total_fiber_g || 0),
    }),
    { cal: 0, pro: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  // Build 7-day summary
  const dayMap = new Map<string, { cal: number; pro: number; carbs: number; fat: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = format(d, "yyyy-MM-dd");
    dayMap.set(key, { cal: 0, pro: 0, carbs: 0, fat: 0 });
  }
  logs.forEach((l) => {
    const key = l.logged_at?.substring(0, 10);
    if (dayMap.has(key)) {
      const entry = dayMap.get(key)!;
      entry.cal += l.total_calories || 0;
      entry.pro += Number(l.total_protein_g || 0);
      entry.carbs += Number(l.total_carbs_g || 0);
      entry.fat += Number(l.total_fat_g || 0);
    }
  });

  const weeklyRows = Array.from(dayMap.entries())
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${format(new Date(k + "T12:00:00"), "EEE, MMM d")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${Math.round(v.cal)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${Math.round(v.pro)}g</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${Math.round(v.carbs)}g</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${Math.round(v.fat)}g</td>
      </tr>`
    )
    .join("");

  const mealRows = todayLogs
    .map((l) => {
      const items = (l.food_items || []) as FoodItem[];
      return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${format(new Date(l.logged_at), "h:mm a")}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${items.map((i) => i.name).join(", ") || "—"}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${l.total_calories}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${Number(l.total_protein_g)}g</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${Number(l.total_carbs_g)}g</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${Number(l.total_fat_g)}g</td>
      </tr>`;
    })
    .join("");

  const pctCal = Math.min(Math.round((todayTotals.cal / goals.daily_calorie_goal) * 100), 100);
  const pctPro = Math.min(Math.round((todayTotals.pro / goals.daily_protein_goal) * 100), 100);
  const pctCarbs = Math.min(Math.round((todayTotals.carbs / goals.daily_carbs_goal) * 100), 100);
  const pctFat = Math.min(Math.round((todayTotals.fat / goals.daily_fat_goal) * 100), 100);

  const barHtml = (label: string, pct: number, current: number, goal: number, unit: string, color: string) => `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
        <span style="font-weight:600;color:${color}">${label}</span>
        <span>${Math.round(current)}${unit} / ${goal}${unit} (${pct}%)</span>
      </div>
      <div style="background:#eee;border-radius:6px;height:10px;overflow:hidden;">
        <div style="background:${color};height:100%;width:${pct}%;border-radius:6px;"></div>
      </div>
    </div>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Nutrition Report — ${today}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; padding: 32px; max-width: 800px; margin: auto; }
    h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    h2 { font-size: 16px; font-weight: 700; margin: 24px 0 10px; border-bottom: 2px solid #111; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #333; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; border-bottom: 3px solid #111; padding-bottom: 8px; }
    .subtitle { font-size: 13px; color: #666; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <img src="${M2_LOGO_BASE64}" alt="M² Training" style="width:50px;height:50px;border-radius:50%;object-fit:cover;margin-bottom:8px;" />
      <h1>M² NUTRITION REPORT</h1>
      <p class="subtitle">${userName || "Athlete"} — ${today}</p>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:8px 20px;background:#111;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Print / Save PDF</button>
  </div>

  <h2>Today's Goal Progress</h2>
  ${barHtml("Calories", pctCal, todayTotals.cal, goals.daily_calorie_goal, "", "#ea580c")}
  ${barHtml("Protein", pctPro, todayTotals.pro, goals.daily_protein_goal, "g", "#dc2626")}
  ${barHtml("Carbs", pctCarbs, todayTotals.carbs, goals.daily_carbs_goal, "g", "#d97706")}
  ${barHtml("Fat", pctFat, todayTotals.fat, goals.daily_fat_goal, "g", "#2563eb")}

  <h2>Today's Meals</h2>
  ${todayLogs.length === 0 ? '<p style="font-size:13px;color:#888;">No meals logged today.</p>' : `
  <table>
    <thead><tr><th>Time</th><th>Foods</th><th style="text-align:right">Cal</th><th style="text-align:right">Pro</th><th style="text-align:right">Carbs</th><th style="text-align:right">Fat</th></tr></thead>
    <tbody>${mealRows}</tbody>
  </table>`}

  <h2>7-Day Summary</h2>
  <table>
    <thead><tr><th>Day</th><th style="text-align:right">Calories</th><th style="text-align:right">Protein</th><th style="text-align:right">Carbs</th><th style="text-align:right">Fat</th></tr></thead>
    <tbody>${weeklyRows}</tbody>
  </table>

  <div class="footer">Generated by M² Training — www.mattmichelstraining.com</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
