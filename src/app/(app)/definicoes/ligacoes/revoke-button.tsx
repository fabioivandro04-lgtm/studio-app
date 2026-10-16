'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { callSafely } from '@/lib/ai/call-safely';
import { revokeClaudeGrant } from './actions';

export function RevokeButton({ clientId, name }: { clientId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Cortar o acesso de ${name} ao Estúdio?`)) return;
        start(async () => {
          const r = await callSafely(() => revokeClaudeGrant(clientId));
          if (r.ok) toast.success('Acesso cortado.');
          else toast.error(r.error);
        });
      }}
    >
      Cortar acesso
    </Button>
  );
}
