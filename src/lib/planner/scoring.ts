import type { Candidate } from "./plan-types";
import type { AdultAge, Occasion, PlannerDraft } from "./types";

// Which place groups each traveller profile tends to enjoy (small boosts, not filters).
const AGE_AFFINITY: Record<AdultAge, string[]> = {
  "18-22": ["view", "sea", "market", "kids", "mountain"],
  "23-30": ["view", "sea", "nature", "market", "local"],
  "31-45": ["kids", "farm", "nature", "museum", "sea"],
  "46-59": ["temple", "history", "local", "spa", "farm"],
};
const SENIOR_AFFINITY = ["temple", "history", "spa", "market", "local"];
const CHILD_AFFINITY = ["kids", "farm", "sea", "museum"];
const OCCASION_AFFINITY: Record<Occasion, string[]> = {
  couple: ["view", "sea", "spa", "local"],
  friends: ["nature", "mountain", "market", "view"],
  family: ["kids", "farm", "sea", "museum"],
  parents: ["temple", "history", "local", "spa"],
  solo: ["museum", "history", "local", "nature"],
};

/** Travellers who need easy walking: seniors, or trips taking parents along. */
export function needsEasyPace(d: PlannerDraft) {
  return d.travelers.seniors > 0 || d.occasion === "parents";
}

/** Score an attraction for this group of travellers; higher is better. */
export function scoreCandidate(c: Omit<Candidate, "score">, d: PlannerDraft): number {
  let score = 1;
  const g = c.groupKey;

  if (d.interests.length > 0) {
    if (d.interests.includes(g)) score += 3;
    else score -= 1.5;
  }
  if (d.interestTypes.includes(c.attType)) score += 1.5;

  for (const age of d.travelers.adultAges) if (AGE_AFFINITY[age].includes(g)) score += 0.6;
  if (d.travelers.seniors > 0 && SENIOR_AFFINITY.includes(g)) score += 0.8;
  if (d.travelers.children > 0 && CHILD_AFFINITY.includes(g)) score += 0.8;
  if (d.occasion && OCCASION_AFFINITY[d.occasion].includes(g)) score += 1;

  // Keep plans walkable for older travellers and small kids.
  if (needsEasyPace(d)) score -= c.effort === 2 ? 2.5 : c.effort === 1 ? 0.5 : 0;
  else if (d.travelers.children > 0 && c.effort === 2) score -= 1;

  // Route style: community/mixed routes favour local life, scenic ones nature.
  if (
    (d.routeStyle === "community" || d.routeStyle === "mixed") &&
    ["local", "market", "farm"].includes(g)
  ) {
    score += d.routeStyle === "community" ? 1.5 : 1;
  }
  if (d.routeStyle === "scenic" && ["view", "nature", "mountain", "sea"].includes(g)) score += 1;

  if (c.isSecondaryCity) score += 0.5;
  // "Other" (convention centres, border checkpoints…) rarely makes a good stop.
  if (g === "other") score -= 0.5;
  // Prefer places close to the road.
  score -= Math.min(2, c.distanceM / 10000);
  // Records with opening hours tend to be better maintained.
  if (c.openingHours) score += 0.2;

  return Math.round(score * 100) / 100;
}

/**
 * Pick up to `limit` places: best score first, but when balanced no group takes more
 * than a quarter of the picks and the same group doesn't appear twice in a row.
 */
export function pickBalanced(cands: Candidate[], limit: number, balanced: boolean): Candidate[] {
  const sorted = [...cands].sort((a, b) => b.score - a.score);
  if (!balanced) return sorted.slice(0, limit);
  const maxPerGroup = Math.max(1, Math.ceil(limit / 4));
  const count = new Map<string, number>();
  const out: Candidate[] = [];
  for (const c of sorted) {
    if (out.length >= limit) break;
    if ((count.get(c.groupKey) ?? 0) >= maxPerGroup) continue;
    out.push(c);
    count.set(c.groupKey, (count.get(c.groupKey) ?? 0) + 1);
  }
  // Fill up if the caps left gaps.
  for (const c of sorted) {
    if (out.length >= limit) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** Reorders so the same group doesn't sit next to itself when avoidable. */
export function avoidAdjacentSameGroup<T extends { groupKey?: string | null }>(items: T[]): T[] {
  const out = [...items];
  for (let i = 1; i < out.length; i++) {
    if (out[i].groupKey && out[i].groupKey === out[i - 1].groupKey) {
      const j = out.findIndex((x, k) => k > i && x.groupKey !== out[i - 1].groupKey);
      if (j > i) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}
