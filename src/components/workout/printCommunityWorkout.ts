interface PrintExerciseData {
  name: string;
  sets: string;
  reps: string;
  notes: string;
}

interface PrintCommunityWorkoutData {
  title: string;
  creatorName: string;
  description?: string;
  exercises: PrintExerciseData[];
}

const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

export const printCommunityWorkout = (data: PrintCommunityWorkoutData) => {
  const win = window.open("", "_blank");
  if (!win) return;

  const exerciseRows = data.exercises
    .map(
      (ex, i) => `
      <tr class="exercise-row">
        <td class="num">${i + 1}</td>
        <td class="name"><strong>${esc(ex.name)}</strong>${ex.notes ? `<div class="notes">${esc(ex.notes)}</div>` : ""}</td>
        <td class="center">${ex.sets}</td>
        <td class="center">${ex.reps}</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
      ${Array.from({ length: Math.max(parseInt(ex.sets) || 3, 1) - 1 })
        .map(
          () => `
        <tr class="extra-row">
          <td></td>
          <td></td>
          <td></td>
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

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${data.title} — Mattletes Workout</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 24px;
      color: #111;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 3px solid #111;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .header .creator {
      font-size: 11px;
      color: #666;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .header .desc {
      font-size: 12px;
      color: #555;
      margin-top: 8px;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
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
      padding: 6px 8px;
      border-bottom: 2px solid #111;
      color: #555;
    }
    th.center, td.center { text-align: center; }
    .num { width: 30px; color: #999; font-family: monospace; }
    .name { font-size: 12px; }
    .notes { font-size: 10px; color: #888; font-style: italic; margin-top: 2px; }
    .exercise-row td {
      padding: 8px;
      border-top: 1px solid #ddd;
      background: #fafafa;
    }
    .extra-row td {
      padding: 6px 8px;
      border-bottom: 1px solid #eee;
      height: 24px;
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
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  <div class="header">
    <h1>${esc(data.title)}</h1>
    <div class="creator">Created by ${esc(data.creatorName)} · Mattletes Community</div>
    ${data.description ? `<div class="desc">${esc(data.description)}</div>` : ""}
    <div class="brand">M² Training — Mattletes Workout Bank</div>
  </div>
  <div class="name-date">
    <div><label>Athlete Name</label><div class="field"></div></div>
    <div><label>Date</label><div class="field"></div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Exercise</th>
        <th class="center">Sets</th>
        <th class="center">Reps</th>
        <th class="center">Weight</th>
        <th class="center">RPE</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${exerciseRows}
    </tbody>
  </table>
  <div style="text-align:center; margin-top:32px; font-size:10px; color:#999; text-transform:uppercase; letter-spacing:2px;">
    Built by M² Training · m2training.lovable.app
  </div>
</body>
</html>`);
  win.document.close();
};
