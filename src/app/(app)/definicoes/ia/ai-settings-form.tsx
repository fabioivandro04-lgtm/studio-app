'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { callSafely } from '@/lib/ai/call-safely';
import { saveAiSettings } from '@/app/(app)/ai/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AI_MODELS } from '@/lib/ai/types';

const OTHER = 'outro';

export function AiSettingsForm({ initial }: { initial: { model: string; limitUsd: number } }) {
  const known = AI_MODELS.some((m) => m.id === initial.model);
  const [choice, setChoice] = useState<string>(known ? initial.model : OTHER);
  const [custom, setCustom] = useState(known ? '' : initial.model);
  const [limit, setLimit] = useState(String(initial.limitUsd));
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await callSafely(() => saveAiSettings({ model: choice === OTHER ? custom.trim() : choice, limitUsd: limit.trim() === '' ? Number.NaN : Number(limit.replace(',', '.')) }));
      if (r.ok) toast.success('Definições da IA guardadas.');
      else toast.error(r.error);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border p-4" aria-label="Definições da IA">
      <div className="space-y-1">
        <Label htmlFor="ai-model">Motor</Label>
        <select id="ai-model" value={choice} onChange={(e) => setChoice(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
          <option value={OTHER}>Outro (id do OpenRouter)</option>
        </select>
        <p className="text-xs text-muted-foreground">Normal ≈ 2 cêntimos por geração · Económico ≈ 0,2 cêntimos.</p>
      </div>
      {choice === OTHER && (
        <div className="space-y-1">
          <Label htmlFor="ai-model-custom">Id do modelo</Label>
          <Input id="ai-model-custom" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ex.: google/gemini-2.5-flash" />
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="ai-limit">Limite mensal (USD)</Label>
        <Input id="ai-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} className="max-w-32" />
        <p className="text-xs text-muted-foreground">Ao chegar a este valor, a IA pausa até ao mês seguinte.</p>
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'A guardar…' : 'Guardar'}</Button>
    </form>
  );
}
