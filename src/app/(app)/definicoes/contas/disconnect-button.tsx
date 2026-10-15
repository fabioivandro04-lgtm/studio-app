'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { disconnectAccount } from '../actions';

export function DisconnectButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-muted-foreground underline hover:text-foreground disabled:opacity-50"
      onClick={() => {
        if (!confirm('Desligar esta conta? Os tokens de acesso são apagados.')) return;
        start(async () => {
          const r = await disconnectAccount(id);
          if (r.ok) toast.success('Conta desligada.');
          else toast.error(r.error);
        });
      }}
    >
      Desligar
    </button>
  );
}
