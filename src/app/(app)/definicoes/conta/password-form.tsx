'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword, type PasswordState } from './actions';

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, {});
  return (
    <form action={action} className="space-y-3 rounded-xl border p-4">
      <h2 className="font-medium">Mudar palavra-passe</h2>
      <Label htmlFor="password">Nova palavra-passe</Label>
      <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      <Label htmlFor="confirm">Repetir nova palavra-passe</Label>
      <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      <Button type="submit" disabled={pending}>{pending ? 'A guardar…' : 'Guardar palavra-passe'}</Button>
      {state.ok && <p role="status" className="text-sm text-green-700">Palavra-passe mudada.</p>}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
