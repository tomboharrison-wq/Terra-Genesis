/** Deterministic 32-bit PRNG (mulberry32). Same seed → same sequence on every JS engine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent sub-seed from a base seed and a salt (string or number). */
export function deriveSeed(seed: number, salt: string | number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  const s = String(salt);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
  }
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
