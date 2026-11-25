/** The fields product search looks at. Real products satisfy this shape. */
export interface Searchable {
  name: string;
  tagline: string;
  category: string;
  ingredients: string;
  concerns: string[];
  skinTypes: string[];
}

/** What shoppers type -> the words our catalogue uses (e.g. "acne" -> "blemishes"). */
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  blemishes: ['acne', 'spots', 'spot', 'pimples', 'pimple', 'breakouts', 'breakout', 'zits', 'blackheads', 'whiteheads'],
  dark: ['hyperpigmentation', 'pigmentation', 'discoloration', 'discolouration', 'marks', 'scars', 'melasma'],
  dryness: ['dry', 'dehydrated', 'flaky', 'flakiness', 'tight', 'parched'],
  dullness: ['dull', 'glow', 'glowing', 'brighten', 'brightening', 'radiance', 'tired'],
  redness: ['red', 'irritation', 'irritated', 'rosacea', 'calm', 'soothe', 'soothing'],
  pores: ['pore', 'blackhead', 'congestion'],
  oil: ['oily', 'greasy', 'shiny', 'shine', 'sebum'],
  dehydration: ['hydration', 'hydrate', 'hydrating', 'moisture', 'moisturise', 'moisturize', 'thirsty'],
  sun: ['spf', 'sunscreen', 'sunblock', 'uv', 'suncream'],
  cleansing: ['cleanse', 'cleanser', 'wash', 'makeup', 'remover'],
};

const STOP_WORDS = new Set(['skin', 'for', 'the', 'and', 'of', 'my', 'with', 'to', 'best', 'a', 'an', 'in', 'on', 'face']);

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

const words = (s: string) => normalise(s).split(/\s+/).filter(Boolean);

/** Edit distance where swapping two neighbouring letters counts as one edit (the commonest typo). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return Math.max(m, n);
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

const maxEdits = (len: number) => (len <= 3 ? 0 : len <= 7 ? 1 : 2);

/**
 * What a typed word can mean: itself, plus the catalogue word it is a synonym of ("acne" -> "blemishes").
 * Deliberately one-way: expanding to the whole synonym group would make "acne" also match "dark spots".
 */
function alternatives(token: string): string[] {
  const alts = new Set([token]);
  for (const [canonical, syns] of Object.entries(SEARCH_SYNONYMS)) if (syns.includes(token)) alts.add(canonical);
  return [...alts];
}

interface Indexed<T> {
  item: T;
  name: string[];
  tagline: string[];
  tags: string[]; // concerns, skin types, category
  ingredients: string[];
}

const startsWith = (list: string[], w: string) => list.some((x) => x === w || (w.length >= 3 && x.startsWith(w)));

function scoreFor<T>(p: Indexed<T>, alts: string[]): number {
  let best = 0;
  for (const a of alts) {
    if (startsWith(p.name, a)) best = Math.max(best, 6);
    if (startsWith(p.tags, a)) best = Math.max(best, 5);
    if (startsWith(p.tagline, a)) best = Math.max(best, 3);
    if (startsWith(p.ingredients, a)) best = Math.max(best, 2);
  }
  return best;
}

export interface SearchResult<T> {
  results: T[];
  /** Set when we fixed a typo: the query we actually searched for. */
  correctedQuery?: string;
}

/**
 * Forgiving product search: understands concern words ("acne"), prefixes ("niac"), small typos
 * ("niacinimide") and ignores filler ("for dry skin"). Results are ranked, best first.
 */
export function searchProducts<T extends Searchable>(products: T[], query: string): SearchResult<T> {
  let tokens = words(query).filter((t) => !STOP_WORDS.has(t));
  if (tokens.length > 1) tokens = tokens.filter((t) => t.length > 1);
  if (!tokens.length) return { results: products };

  const index: Indexed<T>[] = products.map((item) => ({
    item,
    name: words(item.name),
    tagline: words(item.tagline),
    tags: [...item.concerns, ...item.skinTypes, item.category].flatMap(words),
    ingredients: words(item.ingredients),
  }));

  const vocabulary = new Set<string>();
  for (const p of index) [...p.name, ...p.tagline, ...p.tags, ...p.ingredients].forEach((w) => w.length >= 3 && vocabulary.add(w));
  for (const [k, v] of Object.entries(SEARCH_SYNONYMS)) [k, ...v].forEach((w) => w.length >= 3 && vocabulary.add(w));

  // Fix typos: a word we have never seen is replaced by its nearest known word (if close enough).
  let corrected = false;
  const fixed = tokens.map((t) => {
    if (vocabulary.has(t) || [...vocabulary].some((v) => v.startsWith(t))) return t;
    const limit = maxEdits(t.length);
    if (!limit) return t;
    let best: string | undefined;
    let bestD = limit + 1;
    for (const v of vocabulary) {
      const d = editDistance(t, v);
      if (d < bestD) (bestD = d), (best = v);
    }
    if (best) corrected = true;
    return best ?? t;
  });

  const scoreAll = (mode: 'all' | 'any') =>
    index
      .map((p) => {
        const scores = fixed.map((t) => scoreFor(p, alternatives(t)));
        const ok = mode === 'all' ? scores.every((s) => s > 0) : scores.some((s) => s > 0);
        return { p, score: ok ? scores.reduce((a, b) => a + b, 0) : 0 };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

  let ranked = scoreAll('all');
  if (!ranked.length && fixed.length > 1) ranked = scoreAll('any');

  return {
    results: ranked.map((r) => r.p.item),
    ...(corrected && ranked.length ? { correctedQuery: fixed.join(' ') } : {}),
  };
}

/** Distinct concerns across the catalogue, most common first, for "shop by concern". */
export function concernCounts(products: { concerns: string[] }[]): { concern: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of products) for (const c of p.concerns) map.set(c, (map.get(c) ?? 0) + 1);
  return [...map.entries()].map(([concern, count]) => ({ concern, count })).sort((a, b) => b.count - a.count || a.concern.localeCompare(b.concern));
}
