// Pure helper: urgency_score = base × e^(-days_since_first_seen / 14)
// Item #23 from the 50-item revenue ops list. Read-only, no side effects.

export function computeUrgencyScore(baseScore: number, firstSeenAt: string | Date | null): number {
  if (!firstSeenAt) return baseScore;
  const seenDate = typeof firstSeenAt === "string" ? new Date(firstSeenAt) : firstSeenAt;
  if (isNaN(seenDate.getTime())) return baseScore;
  const daysSince = (Date.now() - seenDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 0) return baseScore;
  const decayed = baseScore * Math.exp(-daysSince / 14);
  return Math.round(decayed * 100) / 100;
}

export function readinessWindow(firstSeenAt: string | Date | null): { from: number; to: number } {
  // Returns estimated actionable window in days from today
  if (!firstSeenAt) return { from: 7, to: 21 };
  const seenDate = typeof firstSeenAt === "string" ? new Date(firstSeenAt) : firstSeenAt;
  const daysSince = Math.max(0, (Date.now() - seenDate.getTime()) / (1000 * 60 * 60 * 24));
  // As candidate ages, window shrinks
  const from = Math.max(3, Math.round(14 - daysSince));
  const to = Math.max(from + 5, Math.round(28 - daysSince));
  return { from, to };
}
