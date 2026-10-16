'use client';

import { Button } from '@/components/ui/button';
import type { PostingSlot } from '@/lib/schedule/slots';
import { SelectField } from '@/components/ui-x/select-field';
import { TimeField } from '@/components/ui-x/time-field';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Lista editável de horários fixos (dia da semana + hora). */
export function PostingSlotsField({ id, value, onChange }: { id: string; value: PostingSlot[]; onChange(next: PostingSlot[]): void }) {
  const set = (i: number, patch: Partial<PostingSlot>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <fieldset className="space-y-2" aria-describedby={`slots-help-${id}`}>
      <legend className="text-sm font-medium">Horários fixos</legend>
      <p id={`slots-help-${id}`} className="text-xs text-muted-foreground">
        Os dias e horas em que costuma publicar. O botão &apos;Próximo horário livre&apos; e o plano da semana usam-nos.
      </p>
      {value.map((s, i) => (
        <div key={i} className="flex items-center gap-2" data-testid="posting-slot">
          <SelectField aria-label={`Dia do horário ${i + 1}`} value={String(s.weekday)} onChange={(v) => set(i, { weekday: Number(v) })} options={DAYS.map((d, n) => ({ value: String(n), label: d }))} className="w-40" />
          <TimeField aria-label={`Hora do horário ${i + 1}`} value={s.time} onChange={(v) => set(i, { time: v })} className="w-28" />
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remover</Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { weekday: 1, time: '19:00' }])}>+ Adicionar horário</Button>
    </fieldset>
  );
}
