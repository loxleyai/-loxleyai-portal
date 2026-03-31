import { scoreTarget } from '../lib/scoring';

export function runAgent() {
  const base = [
    { id: 'A', land: 28 },
    { id: 'B', land: 22 }
  ];

  const enriched = base.map(t => ({
    ...t,
    geo: 15 + Math.random() * 10,
    water: Math.random() * 20,
    competition: 10 + Math.random() * 5,
    logistics: 5 + Math.random() * 5
  }));

  return enriched
    .map(t => ({ ...t, score: scoreTarget(t) }))
    .sort((a, b) => b.score - a.score);
}
