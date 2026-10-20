'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';

/** Volta a pedir as mensagens ao Instagram. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => start(() => router.refresh())}>
      <RefreshCw className={pending ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden /> Atualizar
    </Button>
  );
}
