// Training Newsletter — Personalized "Your Week" hero banner
// Pulls per-subscriber stats and renders an email-safe HTML block.
// Witty, grunge, Midwestern. Inline styles only.

export interface WeeklyScorecard {
  hasAccount: boolean;
  name: string;
  pointsThisWeek: number;
  totalPoints: number;
  level: string;
  levelLabel: string;
  levelChanged: boolean;
  prevLevelLabel?: string;
  streak: number;
  rankNow: number | null;
  rankDelta: number | null; // positive = climbed
  totalRanked: number;
  topPercent: number | null;
  achievements: string[]; // labels for unlocks
  actionsThisWeek: number; // # of point_transactions
  quietWeek: boolean;
  comeback: boolean; // 14+ days dormant, now back
  trainingDaysAgo: number | null;
}

const LEVELS = [
  { key: "rookie", label: "Rookie", min: 0 },
  { key: "grinder", label: "Grinder", min: 500 },
  { key: "competitor", label: "Competitor", min: 1500 },
  { key: "beast", label: "Beast", min: 4000 },
  { key: "legend", label: "M2 Legend", min: 10000 },
];

function levelFor(points: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

const ACTION_LABELS: Record<string, string> = {
  studio_checkin: "Studio Check-In",
  workout_log: "Workout Logged",
  challenge_entry: "Challenge Entered",
  community_workout: "Community Workout",
  referral: "Referral Booked",
  program_purchase: "Program Purchased",
  membership_monthly: "Membership Active",
  merch_purchase: "Merch Cop",
  weekly_streak: "Streak Held",
  share_workout: "Workout Shared",
};

export async function getWeeklyScorecard(
  sb: any,
  userId: string,
  fallbackName: string,
): Promise<WeeklyScorecard> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [pointsRes, profileRes, txnsRes, lbRes] = await Promise.all([
    sb.from("user_points").select("total_points, level, weekly_streak").eq("user_id", userId).maybeSingle(),
    sb.from("profiles").select("athlete_name, full_name").eq("user_id", userId).maybeSingle(),
    sb.from("point_transactions").select("action, points, created_at").eq("user_id", userId).gte("created_at", twoWeeksAgo.toISOString()),
    sb.from("user_points").select("user_id, total_points").eq("is_public", true).order("total_points", { ascending: false }).limit(500),
  ]);

  const pts = pointsRes.data || { total_points: 0, level: "rookie", weekly_streak: 0 };
  const profile = profileRes.data || {};
  const txns = (txnsRes.data || []) as { action: string; points: number; created_at: string }[];
  const lb = (lbRes.data || []) as { user_id: string; total_points: number }[];

  const thisWeekTxns = txns.filter(t => new Date(t.created_at) >= weekAgo);
  const lastWeekTxns = txns.filter(t => new Date(t.created_at) < weekAgo);

  const pointsThisWeek = thisWeekTxns.reduce((s, t) => s + (t.points || 0), 0);
  const pointsLastWeek = lastWeekTxns.reduce((s, t) => s + (t.points || 0), 0);

  // Level change detection: compare current level vs level before this week's points
  const totalNow = pts.total_points || 0;
  const totalBeforeWeek = Math.max(0, totalNow - pointsThisWeek);
  const levelNow = levelFor(totalNow);
  const levelBefore = levelFor(totalBeforeWeek);
  const levelChanged = levelNow.key !== levelBefore.key;

  // Rank
  const rankIdx = lb.findIndex(r => r.user_id === userId);
  const rankNow = rankIdx >= 0 ? rankIdx + 1 : null;
  // Approximate "last week rank" by subtracting this-week points from each player & re-sorting
  const lbLastWeek = lb.map(r => ({ ...r, total_points: r.total_points - (r.user_id === userId ? pointsThisWeek : 0) }))
    .sort((a, b) => b.total_points - a.total_points);
  const prevRankIdx = lbLastWeek.findIndex(r => r.user_id === userId);
  const rankDelta = (rankNow && prevRankIdx >= 0) ? (prevRankIdx + 1) - rankNow : null; // positive = climbed
  const topPercent = (rankNow && lb.length > 0) ? Math.round((rankNow / lb.length) * 100) : null;

  // Achievements — unique action types this week (humanized)
  const actionSet = new Set(thisWeekTxns.map(t => t.action));
  const achievements = [...actionSet].map(a => ACTION_LABELS[a] || a.replace(/_/g, " ")).slice(0, 6);

  // Comeback detection: no txns in days 8-30 prior to this week, but txns this week
  const dormantWindow = txns.filter(t => {
    const d = new Date(t.created_at);
    return d < weekAgo && d >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  });
  const comeback = thisWeekTxns.length > 0 && dormantWindow.length === 0 && (pts.total_points || 0) > 0;

  // Last training timestamp
  const lastTxn = txns.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
  const trainingDaysAgo = lastTxn ? Math.floor((now.getTime() - new Date(lastTxn.created_at).getTime()) / (24 * 60 * 60 * 1000)) : null;

  const name = (profile.athlete_name || profile.full_name || fallbackName || "").split(" ")[0] || "";

  return {
    hasAccount: true,
    name,
    pointsThisWeek,
    totalPoints: totalNow,
    level: levelNow.key,
    levelLabel: levelNow.label,
    levelChanged,
    prevLevelLabel: levelChanged ? levelBefore.label : undefined,
    streak: pts.weekly_streak || 0,
    rankNow,
    rankDelta,
    totalRanked: lb.length,
    topPercent,
    achievements,
    actionsThisWeek: thisWeekTxns.length,
    quietWeek: thisWeekTxns.length === 0,
    comeback,
    trainingDaysAgo,
  };
}

// ----- Voice pool — Matt's grunge Midwestern voice. Picked semi-randomly per recipient. -----

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return h;
}

function quietWeekLine(seed: number) {
  return pick([
    "Zero points this week. Not mad. Disappointed. The barbell misses you.",
    "Goose egg. Even a 10-minute walk would've counted. Just sayin'.",
    "Nothing logged. Detroit weather isn't an excuse — neither is your couch.",
    "0 pts. We'll pretend we didn't notice. This time.",
    "Quiet week. Mondays are for restarting, not regretting.",
  ], seed);
}

function streakLine(streak: number, seed: number) {
  if (streak >= 12) return pick([
    `${streak}-week streak. At this point skipping would feel weird.`,
    `${streak} weeks. You're not training anymore — it's just who you are.`,
  ], seed);
  if (streak >= 4) return pick([
    `${streak}-week streak. Don't be the guy who breaks it for a Tigers game.`,
    `${streak} weeks in a row. Momentum is the cheat code.`,
  ], seed);
  return pick([
    `${streak}-week streak going. Keep stacking.`,
    `Week ${streak} in the book. Two more and it becomes a habit.`,
  ], seed);
}

function pointsLine(pts: number, actions: number, level: string, seed: number) {
  if (pts >= 200) return pick([
    `Banked ${pts} pts across ${actions} sessions. Not bad, ${level}.`,
    `${pts} pts this week. The math is starting to math.`,
    `${pts} pts, ${actions} actions. You showed up. The guy who hates Mondays got 2.`,
  ], seed);
  if (pts >= 50) return pick([
    `${pts} pts. Solid. Not flashy. The kind that adds up.`,
    `${pts} pts this week. Better than 90% of people who said they'd start Monday.`,
  ], seed);
  return pick([
    `${pts} pts. A start. Now do it again next week.`,
    `${pts} pts on the board. Tiny wins compound.`,
  ], seed);
}

function rankLine(rankNow: number, rankDelta: number | null, topPercent: number | null, seed: number) {
  if (rankDelta !== null && rankDelta >= 5) return pick([
    `Climbed ${rankDelta} spots to #${rankNow}. The guy ahead of you logged one more session. Just sayin'.`,
    `Up ${rankDelta} on the board to #${rankNow}. Keep stepping on necks.`,
  ], seed);
  if (rankDelta !== null && rankDelta <= -5) return pick([
    `Slid ${Math.abs(rankDelta)} spots to #${rankNow}. Someone passed you while you were "resting."`,
    `Down ${Math.abs(rankDelta)} to #${rankNow}. The leaderboard doesn't sleep.`,
  ], seed);
  if (topPercent !== null && topPercent <= 10) return pick([
    `#${rankNow} on the board. Top ${topPercent}%. Stay there.`,
    `Top ${topPercent}% — don't get cocky. Off-season is when people fold.`,
  ], seed);
  return `Sitting at #${rankNow}. Plenty of room to climb.`;
}

function levelUpLine(prev: string, now: string, seed: number) {
  return pick([
    `You hit ${now.toUpperCase()}. Welcome to the part where it actually starts working.`,
    `Bumped ${prev} → ${now}. Earned, not given.`,
    `${now.toUpperCase()} unlocked. The next tier hurts more. Fair warning.`,
  ], seed);
}

function comebackLine(days: number | null, seed: number) {
  return pick([
    `Welcome back. We didn't delete your account.`,
    `Comeback logged. ${days ? `${days}` : "Some"} days off, and the bar still loaded itself? Didn't think so.`,
    `You're back. The first week back is the hardest. You did it.`,
  ], seed);
}

// ----- Renderer -----

const SLATE = "#1e293b";
const SLATE_DEEP = "#0f172a";
const ORANGE = "#e8621a";
const ORANGE_DIM = "#f59e0b";
const TEXT = "#f1f5f9";
const MUTED = "#94a3b8";

function statCard(label: string, value: string, accent = ORANGE) {
  return `<td width="50%" valign="top" style="padding:8px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid ${accent};border-radius:8px;">
      <tr><td style="padding:14px 16px;">
        <div style="font-family:'SF Mono',Menlo,monospace;font-size:9px;letter-spacing:2.5px;color:${MUTED};text-transform:uppercase;margin-bottom:6px;">${label}</div>
        <div style="font-size:26px;font-weight:900;color:${TEXT};line-height:1;">${value}</div>
      </td></tr>
    </table>
  </td>`;
}

function dottedRule() {
  return `<div style="border-top:1px dotted rgba(232,98,26,0.4);margin:14px 0;"></div>`;
}

export function buildPersonalizedBanner(s: WeeklyScorecard): string {
  const seed = hashSeed(s.name + s.totalPoints);
  const weekStr = `WK ${getISOWeek(new Date())}/${new Date().getFullYear().toString().slice(-2)}`;

  if (!s.hasAccount) {
    return buildGenericJoinBanner();
  }

  // Pick voice line — priority: levelUp > comeback > quiet > points
  let mainLine = "";
  if (s.levelChanged && s.prevLevelLabel) mainLine = levelUpLine(s.prevLevelLabel, s.levelLabel, seed);
  else if (s.comeback) mainLine = comebackLine(s.trainingDaysAgo, seed);
  else if (s.quietWeek) mainLine = quietWeekLine(seed);
  else mainLine = pointsLine(s.pointsThisWeek, s.actionsThisWeek, s.levelLabel, seed);

  // Secondary line
  let secondary = "";
  if (s.streak > 0 && !s.quietWeek) secondary = streakLine(s.streak, seed + 1);
  else if (s.rankNow) secondary = rankLine(s.rankNow, s.rankDelta, s.topPercent, seed + 1);

  // Achievement ticker
  const ticker = s.achievements.length
    ? s.achievements.map(a => a.toUpperCase()).join("&nbsp;&nbsp;·&nbsp;&nbsp;")
    : null;

  const greet = s.name ? `${s.name},` : "Hey,";

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;">
  <tr><td style="background:linear-gradient(135deg,${SLATE} 0%,${SLATE_DEEP} 100%);padding:0;border-radius:10px 10px 0 0;overflow:hidden;">

    <!-- Stamp / corner mark -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:18px 24px 0;">
          <span style="display:inline-block;border:1px solid ${ORANGE};color:${ORANGE};padding:3px 8px;font-family:'SF Mono',Menlo,monospace;font-size:9px;letter-spacing:2.5px;font-weight:700;">${weekStr} · YOUR WEEK</span>
        </td>
        <td align="right" style="padding:18px 24px 0;">
          <span style="font-family:'SF Mono',Menlo,monospace;font-size:9px;letter-spacing:2px;color:${MUTED};text-transform:uppercase;">${s.levelLabel}</span>
        </td>
      </tr>
    </table>

    <!-- Headline -->
    <div style="padding:14px 24px 0;">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:${ORANGE};text-transform:uppercase;margin-bottom:6px;">${greet}</div>
      <div style="font-size:22px;font-weight:900;color:${TEXT};line-height:1.25;letter-spacing:-0.3px;">${escapeHtml(mainLine)}</div>
    </div>

    ${dottedRule().replace("margin:14px 0", "margin:18px 24px 8px")}

    <!-- Stat grid -->
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:0 16px;">
      <tr>
        ${statCard("PTS THIS WEEK", `${s.pointsThisWeek}`, ORANGE)}
        ${statCard(s.streak > 0 ? "STREAK 🔥" : "WEEKLY STREAK", `${s.streak} ${s.streak === 1 ? "wk" : "wks"}`, s.streak > 0 ? ORANGE : ORANGE_DIM)}
      </tr>
      <tr>
        ${statCard("TOTAL PTS", `${s.totalPoints.toLocaleString()}`, "rgba(232,98,26,0.4)")}
        ${statCard("RANK", s.rankNow ? `#${s.rankNow}${s.rankDelta && s.rankDelta > 0 ? ` ▲${s.rankDelta}` : s.rankDelta && s.rankDelta < 0 ? ` ▼${Math.abs(s.rankDelta)}` : ""}` : "—", "rgba(232,98,26,0.4)")}
      </tr>
    </table>

    ${ticker ? `
    <div style="padding:14px 24px 6px;">
      <div style="font-family:'SF Mono',Menlo,monospace;font-size:10px;letter-spacing:1.5px;color:${ORANGE};font-weight:700;text-transform:uppercase;line-height:1.6;">${ticker}</div>
    </div>` : ""}

    ${secondary ? `
    <div style="padding:6px 24px 18px;">
      <div style="font-size:14px;color:${MUTED};font-style:italic;line-height:1.5;border-left:2px solid ${ORANGE};padding-left:12px;">${escapeHtml(secondary)}</div>
    </div>` : `<div style="height:18px;"></div>`}

    <!-- Bottom rule -->
    <div style="height:4px;background:${ORANGE};"></div>
  </td></tr>
</table>
`;
}

export function buildGenericJoinBanner(): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;">
  <tr><td style="background:linear-gradient(135deg,${SLATE} 0%,${SLATE_DEEP} 100%);padding:24px;border-radius:10px 10px 0 0;">
    <span style="display:inline-block;border:1px solid ${ORANGE};color:${ORANGE};padding:3px 8px;font-family:'SF Mono',Menlo,monospace;font-size:9px;letter-spacing:2.5px;font-weight:700;">YOUR WEEK</span>
    <div style="font-size:22px;font-weight:900;color:${TEXT};line-height:1.25;margin:14px 0 8px;">No scorecard yet. Want one?</div>
    <div style="font-size:14px;color:${MUTED};line-height:1.6;margin-bottom:16px;">Members get a personal weekly card: points, streak, leaderboard rank, achievement unlocks. Plus the app, programs, and direct line to Matt.</div>
    <a href="https://www.mattmichelstraining.com/auth?redirect=/trial-welcome" style="display:inline-block;background:${ORANGE};color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:700;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;">Start Free Trial →</a>
    <div style="height:4px;background:${ORANGE};margin-top:20px;margin-left:-24px;margin-right:-24px;"></div>
  </td></tr>
</table>
`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getISOWeek(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
