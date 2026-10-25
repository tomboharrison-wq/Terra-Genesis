import { describe, expect, it } from 'vitest';
import { TOOLS } from '../src/app/tools';

/** WCAG 2 contrast from the real stylesheet: tokens and rule colours (spec M accessibility). */
async function stylesheet() {
  // Vitest strips CSS imports, so read the file (no @types/node in this project).
  const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync(p: string, enc: string): string };
  return fs.readFileSync('src/app/styles.css', 'utf8');
}

type RGBA = [number, number, number, number];
function parseColour(v: string, vars: Record<string, string>): RGBA {
  v = v.trim();
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) return parseColour(vars[ref[1]], vars);
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((k) => parseInt(hex[1].slice(k, k + 2), 16) / 255).concat(1) as RGBA;
  const rgba = v.match(/^rgba?\(([^)]+)\)$/);
  if (rgba) {
    const p = rgba[1].split(',').map(Number);
    return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] ?? 1];
  }
  throw new Error(`Unparsed colour ${v}`);
}
const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map((k) => fg[k] * fg[3] + bg[k] * (1 - fg[3])).concat(1) as RGBA;
const lum = (c: RGBA) => {
  const l = c.slice(0, 3).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
};
const ratio = (a: RGBA, b: RGBA) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe('M11-C04 accessibility', () => {
  it('text and button colours meet WCAG AA (4.5:1) on their backgrounds', async () => {
    const css = await stylesheet();
    const vars: Record<string, string> = {};
    for (const m of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] ??= m[2];
    /** First declaration of `prop` in the rule whose selector is exactly `sel`. */
    const rule = (sel: string, prop: string) => {
      const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const m = css.match(new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`));
      return m?.[2].match(new RegExp(`(^|[;\\s])${prop}:\\s*([^;]+);`))?.[2];
    };
    const panel = parseColour(vars['--panel-solid'], vars);
    const text = parseColour(vars['--text'], vars);
    const c = (v: string | undefined, fallback: RGBA) => (v ? over(parseColour(v, vars), panel) : fallback);
    const pairs: [string, RGBA, RGBA][] = [
      ['body text on panel', text, panel],
      ['muted text on panel', over(parseColour(vars['--muted'], vars), panel), panel],
      ['section headings (pink) on panel', c(rule('.panel h3', 'color'), text), panel],
      ['yellow accent on panel', parseColour(vars['--scouts-yellow'], vars), panel],
      ['primary button text on Scouts blue', c(rule('button.primary', 'color'), text), parseColour(vars['--primary'], vars)],
      ['Play button text on Scouts green', c(rule('.timebar .play', 'color'), text), parseColour(vars['--scouts-green'], vars)],
      ['Pause button text on Scouts orange', c(rule('.timebar .play', 'color'), text), parseColour(vars['--scouts-orange'], vars)],
      ['active toggle text on yellow', c(rule('button.active-toggle', 'color'), text), parseColour(vars['--scouts-yellow'], vars)],
      ['segmented active text on yellow', c(rule('.seg button.active', 'color'), text), parseColour(vars['--scouts-yellow'], vars)],
    ];
    const fails = pairs.filter(([, fg, bg]) => ratio(fg, bg) < 4.5).map(([n, fg, bg]) => `${n}: ${ratio(fg, bg).toFixed(2)}:1`);
    expect(fails).toEqual([]);
  });

  it('every tool has a unique keyboard shortcut and a label', () => {
    const keys = TOOLS.map((t) => t.key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of TOOLS) expect(t.label.length).toBeGreaterThan(2);
    // Keys used by other shortcuts must not be taken by tools.
    for (const k of ['[', ']', 'f', 't', 'o', 'p', '.', 'n', '?']) expect(keys).not.toContain(k);
  });
});
