import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { useAppStore } from '@/state/appStore';
import { useSessionStore } from '@/state/sessionStore';
import { AppShell } from './AppShell';
import { NotFound } from './NotFound';
import { RouteError } from './RouteError';

/** `/` -> onboarding on first run, an active session if one is live, otherwise home. */
function RootRedirect() {
  const onboarded = useAppStore((s) => s.onboardingComplete && s.hostId !== null);
  const live = useSessionStore((s) => (s.session && (s.session.status === 'live' || s.session.status === 'paused') ? s.session.id : null));
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  if (live) return <Navigate to={`/session/${live}/courts`} replace />;
  return <Navigate to="/home" replace />;
}

const screen = <T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T): RouteObject['lazy'] => async () => {
  const mod = await load();
  return { Component: mod[name] as React.ComponentType };
};

/** Every screen is its own chunk: the initial bundle holds only the shell. */
export const routes: RouteObject[] = [
  { path: '/', Component: RootRedirect },
  { path: '/onboarding', lazy: screen(() => import('./screens/OnboardingScreen'), 'OnboardingScreen'), ErrorBoundary: RouteError },
  {
    Component: AppShell,
    ErrorBoundary: RouteError,
    children: [
      { path: '/home', lazy: screen(() => import('./screens/HomeScreen'), 'HomeScreen') },
      { path: '/roster', lazy: screen(() => import('./screens/RosterScreen'), 'RosterScreen') },
      { path: '/roster/:playerId', lazy: screen(() => import('./screens/PlayerProfileScreen'), 'PlayerProfileScreen') },
      { path: '/history', lazy: screen(() => import('./screens/HistoryScreen'), 'HistoryScreen') },
      { path: '/history/:sessionId', lazy: screen(() => import('./screens/HistoryDetailScreen'), 'HistoryDetailScreen') },
      { path: '/leaderboard/:sportId?', lazy: screen(() => import('./screens/LeaderboardScreen'), 'LeaderboardScreen') },
      { path: '/settings', lazy: screen(() => import('./screens/SettingsScreen'), 'SettingsScreen') },
    ],
  },
  { path: '/session/setup', lazy: screen(() => import('./screens/SessionSetupScreen'), 'SessionSetupScreen'), ErrorBoundary: RouteError },
  {
    path: '/session/:sessionId',
    lazy: screen(() => import('./session/SessionLayout'), 'SessionLayout'),
    ErrorBoundary: RouteError,
    children: [
      { index: true, element: <Navigate to="courts" replace /> },
      { path: 'courts', lazy: screen(() => import('./session/CourtsScreen'), 'CourtsScreen') },
      { path: 'standings', lazy: screen(() => import('./session/StandingsScreen'), 'StandingsScreen') },
      // Old links/bookmarks: rounds now live on the courts screen.
      { path: 'rounds', element: <Navigate to="../courts" replace /> },
      { path: 'bill', lazy: screen(() => import('./session/BillScreen'), 'BillScreen') },
    ],
  },
  { path: '/session/:sessionId/join-code', lazy: screen(() => import('./session/JoinCodeScreen'), 'JoinCodeScreen'), ErrorBoundary: RouteError },
  { path: '/session/:sessionId/finish', lazy: screen(() => import('./session/FinishScreen'), 'FinishScreen'), ErrorBoundary: RouteError },
  { path: '/board/:boardId', lazy: screen(() => import('./screens/PublicBoardScreen'), 'PublicBoardScreen'), ErrorBoundary: RouteError },
  { path: '/join/:code?', lazy: screen(() => import('./screens/JoinScreen'), 'JoinScreen'), ErrorBoundary: RouteError },
  ...(import.meta.env.DEV
    ? [{ path: '/__dev/export', lazy: screen(() => import('./dev/ExportDemo'), 'ExportDemo') } satisfies RouteObject, { path: '/__dev/analytics', lazy: screen(() => import('./dev/AnalyticsDemo'), 'AnalyticsDemo') } satisfies RouteObject]
    : []),
  { path: '*', Component: NotFound },
];

export const router = createBrowserRouter(routes);
