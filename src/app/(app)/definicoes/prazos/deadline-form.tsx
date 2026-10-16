'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteDeadline, saveDeadline } from './actions';
import { SelectField } from '@/components/ui-x/select-field';
import { DateField } from '@/components/ui-x/date-field';

const EMPTY = { title: '', dueDate: '', country: '', institution: '', url: '', notes: '' };

export function DeadlineForm({ brands, defaultBrandId }: { brands: { id: string; name: string }[]; defaultBrandId: string | null }) {
  const [f, setF] = useState({ ...EMPTY, brandId: defaultBrandId ?? brands[0]?.id ?? '' });
  const [pending, start] = useTransition();
  const field = (k: keyof typeof EMPTY, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`dl-${k}`}>{label}</Label>
      <Input id={`dl-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );
  return (
    <form
      aria-label="Novo prazo"
      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveDeadline(f);
          if (r.ok) {
            toast.success('Prazo guardado.');
            setF({ ...EMPTY, brandId: f.brandId });
          } else toast.error(r.error);
        });
      }}
    >
      {brands.length > 1 && (
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="dl-brand">Marca</Label>
          <SelectField id="dl-brand" value={f.brandId} onChange={(v) => setF({ ...f, brandId: v })} options={brands.map((b) => ({ value: b.id, label: b.name }))} />
        </div>
      )}
      {field('title', 'Nome do prazo')}
      <div className="space-y-1">
        <Label htmlFor="dl-dueDate">Data</Label>
        <DateField id="dl-dueDate" value={f.dueDate} onChange={(v) => setF({ ...f, dueDate: v })} />
      </div>
      {field('country', 'País')}
      {field('institution', 'Instituição')}
      {field('url', 'Link')}
      {field('notes', 'Notas')}
      <Button type="submit" disabled={pending} className="sm:col-span-2 sm:w-fit">Adicionar prazo</Button>
    </form>
  );
}

export function DeleteDeadline({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="text-sm text-muted-foreground underline" onClick={() => start(async () => {
      const r = await deleteDeadline(id);
      if (!r.ok) toast.error(r.error);
    })}>Apagar</button>
  );
}
