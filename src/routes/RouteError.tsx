import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';

import { Button } from '@/components/Button';
import { logger } from '@/core/utils/logger';

/** Per-route-group error boundary: a crash never blanks the app, and the live session survives it. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();
  const navigate = useNavigate();
  logger.error('route error', error);
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlert size={40} className="text-warning" aria-hidden="true" />
      <h1 className="text-[22px] font-bold">{notFound ? t('error.notFound.title') : t('error.route.title')}</h1>
      <p className="text-[15px] text-ink-muted">{t('error.route.body')}</p>
      <Button fullWidth onClick={() => window.location.reload()}>
        {t('common.retry')}
      </Button>
      <Button fullWidth variant="ghost" onClick={() => void navigate('/', { replace: true })}>
        {t('error.route.home')}
      </Button>
    </main>
  );
}
