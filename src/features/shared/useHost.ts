import { useEffect, useState } from 'react';
import type { Id } from '@/types/common';
import type { HostDoc } from '@/types/host';
import { hostRepo } from '@/data/hostRosterRepo';

/** Live host document (cache first). `undefined` while loading, `null` if it does not exist. */
export function useHost(hostId: Id | null): HostDoc | null | undefined {
  const [host, setHost] = useState<HostDoc | null | undefined>(undefined);
  useEffect(() => {
    if (!hostId) return;
    return hostRepo.observe(hostId).subscribe(setHost);
  }, [hostId]);
  return hostId ? host : null;
}
