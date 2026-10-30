# FRDUP

Mobile-first PWA for recreational sports sessions in Indonesia: pick players from a roster, auto-generate fair Americano/Mexicano rounds, score live, track per-sport rank tiers, split the bill, and export an Instagram-ready leaderboard (4:5 and 9:16).

Opened by link on Android Chrome / iOS Safari, installable to the home screen. No login.

Rules and architecture: [`CLAUDE.md`](./CLAUDE.md) and [`docs/`](./docs). `docs/progress.md` is the source of truth for status.

## Requirements

- Node 22.12+
- A Firebase project (Firestore + Anonymous Auth). Copy `.env.example` to `.env.local` and fill the `VITE_*` values.
- JDK 21+ only for the Firebase emulators (rules tests and E2E)

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (LAN-visible, open on your phone) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, architecture boundaries enforced |
| `npm run test` | Vitest |
| `npm run build` | typecheck + production build into `dist/` |
| `npm run verify` | typecheck, lint, test, build |
| `npm run emulators` | Firestore + Auth emulators |
| `npm run test:rules` | Firestore rules tests (emulator) |
| `npm run test:e2e` | Playwright on Chromium + WebKit (emulator) |

## Layout

```
src/core/        pure TS domain logic: sports, matchmaking, ranking, billing, standings
src/types/       shared DTOs (mirror docs/api_contract.md)
src/data/        Firebase web client + repositories
src/state/       Zustand stores + sync
src/features/    feature logic and components
src/components/  UI primitives
src/routes/      router, app shell, screens
src/i18n/        id (default) + en
src/styles/      tokens.css, global.css
e2e/             Playwright specs
```
