import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

type Bundle = Record<string, unknown>;

/**
 * Locale files are split per feature to avoid merge conflicts:
 *   locales/id.json            core namespaces (api_contract.md §9)
 *   locales/id.<part>.json     feature parts (e.g. id.export.json) — deep-merged into `id`
 * `id` is the default and the reference; `en` is a lagging fallback.
 */
// Eagerly bundles every locale file (base + feature parts).
const files = import.meta.glob<Bundle>('./locales/*.json', { eager: true, import: 'default' });

function deepMerge(target: Bundle, source: Bundle): Bundle {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && existing && typeof existing === 'object') {
      deepMerge(existing as Bundle, value as Bundle);
    } else {
      target[key] = value;
    }
  }
  return target;
}

const resources: Record<string, { translation: Bundle }> = {};
// Base file first (id.json), feature parts after it, so parts can refine/override base keys.
const isBase = (path: string) => /\/[a-z]{2}\.json$/.test(path);
const ordered = Object.entries(files).sort(([a], [b]) => Number(isBase(b)) - Number(isBase(a)) || a.localeCompare(b));
for (const [path, bundle] of ordered) {
  const lng = /\.\/locales\/([a-z]{2})(?:\.[\w-]+)?\.json$/.exec(path)?.[1];
  if (!lng) continue;
  resources[lng] ??= { translation: {} };
  deepMerge(resources[lng].translation, structuredClone(bundle));
}

void i18n.use(initReactI18next).init({
  resources,
  lng: 'id',
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
