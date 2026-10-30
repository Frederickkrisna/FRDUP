import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

/**
 * Architecture boundaries (CLAUDE.md §5):
 *   types      -> nothing
 *   core       -> core, types            (pure TS: no React, no Firebase, no DOM)
 *   data       -> core, types
 *   state      -> core, types, data
 *   components -> types, styles, i18n    (props in, JSX out)
 *   features   -> everything but routes
 *   routes     -> everything
 */
const REACT_LIKE = ['react', 'react/*', 'react-dom', 'react-dom/*', 'react-router', 'react-router/*', 'motion', 'motion/*', 'lucide-react', 'recharts', 'zustand', 'zustand/*', 'i18next', 'react-i18next'];
const FIREBASE = ['firebase', 'firebase/*'];
const layer = (...names) => names.map((n) => `@/${n}`).concat(names.map((n) => `@/${n}/*`));

const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

const HEX_COLOR = {
  selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
  message: 'Hex colors live only in src/styles (design tokens). Use a CSS variable / Tailwind token.',
};
const RAW_JSX_TEXT = {
  selector: "JSXText[value=/[\\p{L}\\p{N}]/u]",
  message: 'No hardcoded UI text. Use t(...) from i18n (id.json).',
};

export default tseslint.config(
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'coverage/**', 'public/**', '.agents/**', '.claude/**', '.kiro/**', '.github/**', '.impeccable/**', '.vscode/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },

  /* ---- React layers ---- */
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },

  /* ---- Boundaries ---- */
  {
    files: ['src/types/**/*.ts'],
    rules: restrict([{ group: ['@/*', 'react', 'react/*', 'firebase', 'firebase/*'], message: 'src/types is dependency-free: relative imports of other type files only.' }]),
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      ...restrict([
        { group: [...REACT_LIKE, ...FIREBASE], message: 'src/core is pure TypeScript — no React, UI libs, or Firebase.' },
        { group: layer('data', 'state', 'features', 'components', 'routes', 'i18n', 'styles'), message: 'src/core may import only src/core and src/types.' },
      ]),
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'sessionStorage', 'navigator'],
      // Matchmaker/history matrices index records that are fully populated by construction; tsc
      // (noUncheckedIndexedAccess) still guards every other access. See docs/migration_web.md §5.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['src/data/**/*.ts'],
    rules: restrict([
      { group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'zustand', 'zustand/*'], message: 'src/data is framework-free.' },
      { group: layer('state', 'features', 'components', 'routes', 'i18n', 'styles'), message: 'src/data may import only src/core and src/types.' },
    ]),
  },
  {
    files: ['src/state/**/*.{ts,tsx}'],
    rules: restrict([{ group: layer('features', 'components', 'routes'), message: 'src/state may import only core, types, data.' }]),
  },
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: {
      ...restrict([
        { group: FIREBASE, message: 'Components do not talk to Firebase.' },
        { group: layer('data', 'state', 'features', 'routes'), message: 'src/components takes props and renders — no data/state/features imports.' },
      ]),
      'no-restricted-syntax': ['error', HEX_COLOR, RAW_JSX_TEXT],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      ...restrict([
        { group: FIREBASE, message: 'Use src/data repositories, not Firebase directly.' },
        { group: layer('routes'), message: 'src/features must not import routes.' },
      ]),
      'no-restricted-syntax': ['error', HEX_COLOR, RAW_JSX_TEXT],
    },
  },
  {
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      ...restrict([{ group: FIREBASE, message: 'Use src/data repositories, not Firebase directly.' }]),
      'no-restricted-syntax': ['error', HEX_COLOR, RAW_JSX_TEXT],
    },
  },

  {
    files: ['src/routes/dev/**/*.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  /* ---- Tests / tooling ---- */
  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'e2e/**/*.ts', '*.config.ts', '*.config.js'],
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-imports': 'off', '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
