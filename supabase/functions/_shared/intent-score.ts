/**
 * Intent Score Engine — pure math, no I/O.
 * Used by compute-intent-score and intent-score-recompute.
 *
 * Formula:
 *   per-signal value = weight * 0.5^(age_days / half_life_days)   // exponential decay
 *   stacking_multiplier = if signals from >=3 categories within 30d:
 *      1 + 0.15 * categoryCount, capped at 1.75
 *   final = min(100, sum(decayed) * stacking_multiplier)
 */

export interface SignalRow {
  id: string;
  signal_type: string;
  detected_at: string; // ISO
  confidence?: number | null;
}

export interface WeightRow {
  signal_type: string;
  weight: number;
  half_life_days: number;
  category: string;
  display_label?: string | null;
}

export interface ContributingSignal {
  id: string;
  signal_type: string;
  category: string;
  display_label: string;
  base_weight: number;
  age_days: number;
  half_life_days: number;
  decayed_value: number;
  detected_at: string;
}

export interface IntentScoreResult {
  score: number;
  tier: 'buying_now' | 'hot' | 'warming' | 'watching' | 'cold';
  signal_count: number;
  category_count: number;
  stacking_multiplier: number;
  contributing_signals: ContributingSignal[];
  is_surging: boolean;       // requires trajectory; computed externally
  is_at_risk: boolean;       // requires trajectory; computed externally
  is_budget_released: boolean;
}

const STACKING_BASE = 1.0;
const STACKING_PER_CATEGORY = 0.15;
const STACKING_CAP = 1.75;
const STACKING_MIN_CATEGORIES = 3;
const STACKING_LOOKBACK_DAYS = 30;
const BUDGET_CATEGORIES = new Set(['budget']);

export function computeIntentScore(
  signals: SignalRow[],
  weights: WeightRow[],
  now: Date = new Date(),
): IntentScoreResult {
  const weightMap = new Map<string, WeightRow>();
  for (const w of weights) weightMap.set(w.signal_type, w);

  const contributing: ContributingSignal[] = [];
  let baseSum = 0;
  const categoriesRecent = new Set<string>();
  let hasBudgetRecent = false;

  for (const s of signals) {
    const w = weightMap.get(s.signal_type);
    if (!w) continue; // unknown signal type → skip (graceful)

    const ageMs = now.getTime() - new Date(s.detected_at).getTime();
    const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
    const decay = Math.pow(0.5, ageDays / w.half_life_days);
    const decayed = w.weight * decay;

    if (decayed < 0.5) continue; // negligible — drop to keep table clean

    contributing.push({
      id: s.id,
      signal_type: s.signal_type,
      category: w.category,
      display_label: w.display_label || s.signal_type,
      base_weight: w.weight,
      age_days: Math.round(ageDays * 10) / 10,
      half_life_days: w.half_life_days,
      decayed_value: Math.round(decayed * 100) / 100,
      detected_at: s.detected_at,
    });

    baseSum += decayed;

    if (ageDays <= STACKING_LOOKBACK_DAYS) {
      categoriesRecent.add(w.category);
      if (BUDGET_CATEGORIES.has(w.category)) hasBudgetRecent = true;
    }
  }

  const categoryCount = categoriesRecent.size;
  const stacking =
    categoryCount >= STACKING_MIN_CATEGORIES
      ? Math.min(STACKING_CAP, STACKING_BASE + STACKING_PER_CATEGORY * categoryCount)
      : 1.0;

  const score = Math.min(100, baseSum * stacking);

  let tier: IntentScoreResult['tier'] = 'cold';
  if (score >= 90) tier = 'buying_now';
  else if (score >= 70) tier = 'hot';
  else if (score >= 50) tier = 'warming';
  else if (score >= 30) tier = 'watching';

  return {
    score: Math.round(score * 100) / 100,
    tier,
    signal_count: contributing.length,
    category_count: categoryCount,
    stacking_multiplier: Math.round(stacking * 100) / 100,
    contributing_signals: contributing.sort((a, b) => b.decayed_value - a.decayed_value),
    is_surging: false, // set by caller using trajectory delta
    is_at_risk: false,
    is_budget_released: hasBudgetRecent,
  };
}

export function accountKey(company: string | null, location: string | null): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `${norm(company || 'unknown')}|${norm(location || '')}`;
}
