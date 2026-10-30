import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/EmptyState';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-[560px] items-center justify-center">
      <EmptyState
        art="search"
        title={t('error.notFound.title')}
        body={t('error.notFound.body')}
        action={
          <Link to="/" className="pressable inline-flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-5 font-semibold text-primary-on">
            {t('error.notFound.cta')}
          </Link>
        }
      />
    </main>
  );
}
