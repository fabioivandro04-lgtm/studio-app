'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendMagicLink, signInWithPassword, type LoginState } from './actions';

export function LoginForm({ next, passwordEnabled }: { next: string; passwordEnabled: boolean }) {
  const [linkState, linkAction, linkPending] = useActionState<LoginState, FormData>(sendMagicLink, {});
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(signInWithPassword, {});

  return (
    <div className="space-y-8">
      <form action={linkAction} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="o.seu@email.com" />
        <Button type="submit" className="w-full" disabled={linkPending}>
          {linkPending ? 'A enviar…' : 'Enviar link de acesso'}
        </Button>
        {linkState.message && <p role="status" className="text-sm text-muted-foreground">{linkState.message}</p>}
        {linkState.error && <p role="alert" className="text-sm text-destructive">{linkState.error}</p>}
      </form>

      {passwordEnabled && (
        <form action={pwAction} className="space-y-3 border-t pt-6">
          <input type="hidden" name="next" value={next} />
          <Label htmlFor="pw-email">Email</Label>
          <Input id="pw-email" name="email" type="email" required />
          <Label htmlFor="password">Palavra-passe</Label>
          <Input id="password" name="password" type="password" required />
          <Button type="submit" variant="secondary" className="w-full" disabled={pwPending}>
            Entrar com palavra-passe
          </Button>
          {pwState.error && <p role="alert" className="text-sm text-destructive">{pwState.error}</p>}
        </form>
      )}
    </div>
  );
}
