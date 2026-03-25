import { M2_LOGO_BASE64 } from "@/components/workout/m2LogoBase64";

interface PrintExercise {
  name: string;
  setsReps: string;
  instructions?: string;
}

interface PrintDay {
  day: number;
  exercises: PrintExercise[];
}

interface PrintWeek {
  week: number;
  days: PrintDay[];
}

interface PrintProgramData {
  title: string;
  sport?: string | null;
  category?: string;
  weeks: PrintWeek[];
  isFixIt?: boolean;
}

const FIX_IT_DISCLAIMER_HTML = `
<div style="margin:10px 0;padding:8px 12px;border:1px solid #ddd;background:#f9f9f9;font-size:8px;line-height:1.5;color:#555;">
  <strong style="color:#111;font-size:9px;">Coach Matt's note:</strong>
  These are the exact protocols I use with my in-person clients — but it's always trial and error. Pain and soreness are two different things — don't be a wimp, but don't be an idiot either. Use the Flag Matt system if anything needs adjusting. There's never one path to any goal. We find what works for <em>you</em>.
  <span style="display:block;margin-top:3px;font-family:monospace;color:#333;font-size:7px;">— Good on ya, legend. Now get after it. 🤙</span>
</div>`;

const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

const LOG_ROWS = 3;

export const printWorkoutLog = (program: PrintProgramData) => {
  const win = window.open("", "_blank");
  if (!win) return;

  const exerciseRows = (exercises: PrintExercise[]) =>
    exercises
      .map(
        (ex) => `
        <tr class="exercise-header">
          <td colspan="5">
            <strong>${esc(ex.name)}</strong>
            <span class="sets-reps">${esc(ex.setsReps)}</span>
            ${ex.instructions ? `<div class="instructions">${esc(ex.instructions)}</div>` : ""}
          </td>
        </tr>
        ${Array.from({ length: LOG_ROWS })
          .map(
            (_, i) => `
          <tr class="log-row">
            <td class="set-num">${i + 1}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>`
          )
          .join("")}
      `
      )
      .join("");

  const meta = [program.category, program.sport].filter(Boolean).map(s => esc(s as string)).join(" · ");

  const dayPages = program.weeks.flatMap((week) =>
    week.days.map(
      (day) => `
      <div class="day-page">
        <div class="page-header">
          <img src="${M2_LOGO_BASE64}" alt="M²" class="page-logo" />
          <div>
            <div class="page-title">${esc(program.title)}</div>
            <div class="page-meta">Week ${week.week} · Day ${day.day}${meta ? ` · ${meta}` : ""}</div>
          </div>
        </div>
        <div class="name-date">
          <div><label>Athlete Name</label><div class="field"></div></div>
          <div><label>Date</label><div class="field"></div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th class="set-col">Set</th>
              <th>Weight (lbs)</th>
              <th>Reps</th>
              <th>RPE</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${exerciseRows(day.exercises)}
          </tbody>
        </table>
        <div class="page-footer">M² Training · www.mattmichelstraining.com</div>
      </div>
    `
    )
  );

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${program.title} — Workout Log</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #111;
      background: #fff;
    }
    .day-page {
      padding: 20px;
      page-break-after: always;
    }
    .day-page:last-child { page-break-after: auto; }
    .page-header {
      display: flex; align-items: center; gap: 12px;
      padding-bottom: 10px; margin-bottom: 12px; border-bottom: 3px solid #111;
    }
    .page-logo { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
    .page-title { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
    .page-meta { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
    .page-footer { text-align: center; margin-top: 24px; font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 2px; }
    .name-date {
      display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 11px;
    }
    .name-date label { font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 8px; display: block; margin-bottom: 3px; }
    .name-date .field { border-bottom: 1px solid #ccc; min-width: 180px; height: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 8px; border-bottom: 2px solid #111; color: #555; }
    .set-col { width: 40px; }
    .exercise-header td {
      padding: 6px 8px 2px; background: #fafafa; border-top: 1px solid #ddd;
    }
    .exercise-header strong { font-size: 12px; }
    .sets-reps { font-size: 10px; color: #666; margin-left: 8px; font-family: monospace; }
    .instructions { font-size: 10px; color: #888; font-style: italic; margin-top: 2px; }
    .log-row td { padding: 5px 8px; border-bottom: 1px solid #eee; height: 22px; }
    .set-num { color: #999; font-family: monospace; font-size: 10px; }
    .print-btn {
      position: fixed; top: 12px; right: 12px; background: #111; color: #fff; border: none;
      padding: 8px 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; cursor: pointer;
    }
    .print-btn:hover { background: #333; }
    @media print {
      .print-btn { display: none; }
      body { padding: 0; }
      .day-page { padding: 14px; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  ${dayPages.join("")}
</body>
</html>`);
  win.document.close();
};
