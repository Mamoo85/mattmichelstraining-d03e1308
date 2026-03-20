/**
 * Generates a printable workout log document in a new window.
 * Works for both interactive programs (with workout data from DB)
 * and purchased custom programs (with exercise arrays).
 */
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
}

const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

export const printWorkoutLog = (program: PrintProgramData) => {
  const win = window.open("", "_blank");
  if (!win) return;

  const exerciseRows = (exercises: PrintExercise[], logRows = 5) =>
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
        ${Array.from({ length: logRows })
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

  const weekBlocks = program.weeks
    .map(
      (week) => `
      <div class="week-block">
        <h2>Week ${week.week}</h2>
        ${week.days
          .map(
            (day) => `
          <div class="day-block">
            <h3>Day ${day.day}</h3>
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
          </div>
        `
          )
          .join("")}
      </div>
    `
    )
    .join("");

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${program.title} — Workout Log</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 20px;
      color: #111;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 3px solid #111;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .header .meta {
      font-size: 11px;
      color: #666;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .header .brand {
      font-size: 10px;
      color: #999;
      margin-top: 8px;
      letter-spacing: 2px;
    }
    .name-date {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      font-size: 12px;
    }
    .name-date label {
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: 9px;
      display: block;
      margin-bottom: 4px;
    }
    .name-date .field {
      border-bottom: 1px solid #ccc;
      min-width: 200px;
      height: 20px;
    }
    .week-block {
      page-break-inside: avoid;
      margin-bottom: 24px;
    }
    .week-block h2 {
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 2px;
      background: #111;
      color: #fff;
      padding: 6px 12px;
      margin-bottom: 0;
    }
    .day-block {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .day-block h3 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      background: #f0f0f0;
      padding: 5px 12px;
      border-left: 3px solid #111;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      text-align: left;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 8px;
      border-bottom: 2px solid #111;
      color: #555;
    }
    .set-col { width: 40px; }
    .exercise-header td {
      padding: 8px 8px 2px;
      background: #fafafa;
      border-top: 1px solid #ddd;
    }
    .exercise-header strong {
      font-size: 12px;
    }
    .sets-reps {
      font-size: 10px;
      color: #666;
      margin-left: 8px;
      font-family: monospace;
    }
    .instructions {
      font-size: 10px;
      color: #888;
      font-style: italic;
      margin-top: 2px;
    }
    .log-row td {
      padding: 6px 8px;
      border-bottom: 1px solid #eee;
      height: 24px;
    }
    .set-num {
      color: #999;
      font-family: monospace;
      font-size: 10px;
    }
    .print-btn {
      position: fixed;
      top: 12px;
      right: 12px;
      background: #111;
      color: #fff;
      border: none;
      padding: 8px 20px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
    }
    .print-btn:hover { background: #333; }
    @media print {
      .print-btn { display: none; }
      body { padding: 10px; }
      .week-block { page-break-before: auto; }
      .day-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>

  <div class="header">
    <h1>${esc(program.title)}</h1>
    <div class="meta">${[program.category, program.sport].filter(Boolean).map(s => esc(s as string)).join(" · ")}</div>
    <div class="brand">M² Training — Matt Michels</div>
  </div>

  <div class="name-date">
    <div>
      <label>Athlete Name</label>
      <div class="field"></div>
    </div>
    <div>
      <label>Start Date</label>
      <div class="field"></div>
    </div>
  </div>

  ${weekBlocks}

  <div style="text-align:center; margin-top:32px; font-size:10px; color:#999; text-transform:uppercase; letter-spacing:2px;">
    Built by M² Training · m2training.lovable.app
  </div>
</body>
</html>`);
  win.document.close();
};
