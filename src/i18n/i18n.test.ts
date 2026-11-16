// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { listSports } from '@/core/sports/registry';
import { i18n } from './index';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name) && !/demoData\.ts$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Static keys: t('a.b'), t("a.b"), t(`a.b`), and *Key: 'a.b' fields (plugin labelKeys etc.). */
function staticKeys(): Array<{ key: string; file: string }> {
  const found: Array<{ key: string; file: string }> = [];
  const call = /\bt\(\s*(['"`])([A-Za-z][\w.]*)\1/g;
  const field = /\b(?:labelKey|nameKey|courtLabelKey)\s*:\s*(['"`])([A-Za-z][\w.]*)\1/g;
  const arr = /\b(?:key|label|aria):\s*(['"`])((?:nav|session|bill|error|rank|sport)\.[\w.]+)\1/g;
  for (const file of walk(SRC)) {
    const text = readFileSync(file, 'utf8');
    for (const re of [call, field, arr]) {
      re.lastIndex = 0;
      for (let m = re.exec(text); m; m = re.exec(text)) {
        if (m[2]) found.push({ key: m[2], file: relative(SRC, file) });
      }
    }
  }
  return found;
}

const has = (key: string) => i18n.exists(key, { lng: 'id' }) || i18n.exists(key, { lng: 'id', count: 1 }) || i18n.exists(key, { lng: 'id', count: 2 });

describe('i18n (id is the reference locale)', () => {
  it('every static t() key used in source exists in id', () => {
    const missing = staticKeys().filter((k) => !has(k.key));
    const unique = [...new Map(missing.map((m) => [m.key, m])).values()];
    expect(unique.map((m) => `${m.key}  (${m.file})`)).toEqual([]);
  });

  it('keys built dynamically exist for every value they can take', () => {
    const tiers = ['warrior', 'elite', 'master', 'grandmaster', 'epic', 'legend', 'mythic'];
    const statuses = ['scheduled', 'inProgress', 'completed', 'voided'];
    const dynamic = [
      ...tiers.map((k) => `rank.tier.${k}`),
      ...['idle', 'syncing', 'offline', 'error'].map((k) => `sync.${k}`),
      ...statuses.map((k) => `session.court.status.${k}`),
      ...['unsettled', 'insufficient_players', 'limit', 'no_session', 'readonly'].map((k) => `session.court.nextError.${k}`),
      ...['court_fee', 'shared', 'rental', 'individual'].flatMap((k) => [`bill.itemKind.${k}`, `bill.itemKindHint.${k}`]),
      ...['americano', 'mexicano'].flatMap((k) => [`session.setup.format.${k}`, `session.setup.format.${k}Desc`]),
      'session.court.blocker.voided',
      'session.court.blocker.noScore',
      'session.court.blocker.invalid',
      'session.court.blocker.notDecided',
      'error.score.negative',
      'error.score.fixedSumMismatch',
      'error.score.exceedsCap',
      'error.score.exceedsTarget',
      'error.score.matchAlreadyDecided',
      'bill.error.noPayers',
      'bill.error.invalidAmount',
      'bill.error.invalidQuantity',
      'bill.rounding.100',
      'bill.rounding.500',
      'bill.rounding.1000',
    ];
    expect(dynamic.filter((k) => !has(k)).join('\n')).toBe('');
  });

  it('every sport plugin has its name, court noun and setting labels', () => {
    const keys = listSports().flatMap((p) => [p.nameKey, p.courtLabelKey, ...p.settings.flatMap((s) => [s.labelKey, ...(s.options ?? []).map((o) => o.labelKey)])]);
    expect(keys.filter((k) => !has(k)).join('\n')).toBe('');
  });

  it('en never has a key that id lacks (id is the superset)', () => {
    const flatten = (o: unknown, prefix = ''): string[] =>
      o && typeof o === 'object' ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k)) : [prefix];
    // Plural suffixes differ by language (id has only other), so compare base keys.
    const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '');
    const id = new Set(flatten(i18n.getResourceBundle('id', 'translation')).map(base));
    const extra = flatten(i18n.getResourceBundle('en', 'translation')).map(base).filter((k) => !id.has(k));
    expect(extra.join('\n')).toBe('');
  });

  it('no emoji in UI strings (icons come from the icon set)', () => {
    const emoji = /\p{Extended_Pictographic}/u;
    const bundle = JSON.stringify(i18n.getResourceBundle('id', 'translation'));
    // WhatsApp message templates are content, not UI chrome, and live in core/billing.
    expect(emoji.test(bundle)).toBe(false);
  });
});
