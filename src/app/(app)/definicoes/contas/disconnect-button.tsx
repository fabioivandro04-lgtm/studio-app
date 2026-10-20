'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { disconnectAccount, disconnectAdAccount } from '../actions';

export function DisconnectButton({ id, kind = 'social' }: { id: string; kind?: 'social' | 'ads' }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-muted-foreground underline hover:text-foreground disabled:opacity-50"
      onClick={() => {
        if (!confirm(kind === 'ads' ? 'Desligar esta conta de anúncios? O acesso é apagado.' : 'Desligar esta conta? Os tokens de acesso são apagados.')) return;
        start(async () => {
          const r = await (kind === 'ads' ? disconnectAdAccount(id) : disconnectAccount(id));
          if (r.ok) toast.success('Conta desligada.');
          else toast.error(r.error);
        });
      }}
    >
      Desligar
    </button>
  );
}
