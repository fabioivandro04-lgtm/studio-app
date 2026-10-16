'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TIMEZONES } from '@/lib/brands/schema';
import { deleteBrand, saveBrand } from '../actions';
import { BrandAiSection, type BrandAiForm } from './brand-ai-section';
import { HashtagGroupsSection } from './hashtag-groups-section';
import type { HashtagGroup } from '@/lib/db/repo/hashtag-groups-repo';
import { SelectField } from '@/components/ui-x/select-field';

type BrandForm = { id?: string; name: string; color: string; timezone: string };
const PALETTE = ['#0B1F45', '#1D4ED8', '#0E7490', '#15803D', '#F0A93B', '#C2410C', '#BE123C', '#7E22CE'];
const EMPTY: BrandForm = { name: '', color: '#0B1F45', timezone: 'Africa/Maputo' };

function BrandRow({ initial, onDone }: { initial: BrandForm; onDone?: () => void }) {
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const isNew = !initial.id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveBrand(form);
      if (r.ok) {
        toast.success(isNew ? 'Marca criada.' : 'Marca guardada.');
        if (isNew) setForm(EMPTY);
        onDone?.();
      } else toast.error(r.error);
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-card p-4 shadow-xs sm:grid-cols-[1fr_auto_1fr]" aria-label={isNew ? 'Nova marca' : `Marca ${initial.name}`}>
      <div className="space-y-1">
        <Label htmlFor={`name-${initial.id ?? 'nova'}`}>Nome</Label>
        <Input id={`name-${initial.id ?? 'nova'}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`color-${initial.id ?? 'nova'}`}>Cor</Label>
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Cor da marca">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={form.color.toLowerCase() === c.toLowerCase()}
              aria-label={`Cor ${c}`}
              onClick={() => setForm({ ...form, color: c })}
              className="size-7 rounded-full ring-offset-2 ring-offset-card aria-checked:ring-2 aria-checked:ring-primary"
              style={{ background: c }}
            />
          ))}
          <label className="flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border text-[10px] text-muted-foreground" title="Outra cor">
            <span className="sr-only">Outra cor</span>
            <input id={`color-${initial.id ?? 'nova'}`} type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="size-10 cursor-pointer opacity-0" />
          </label>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`tz-${initial.id ?? 'nova'}`}>Fuso horário</Label>
        <SelectField id={`tz-${initial.id ?? 'nova'}`} value={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} options={TIMEZONES.map((t) => ({ value: t.id, label: t.label }))} />
      </div>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {isNew ? 'Criar marca' : 'Guardar'}
        </Button>
        {!isNew && (
          <Button
            type="button"
            variant="outline"
            className="ml-auto border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Apagar a marca "${initial.name}" e todo o seu conteúdo?`)) return;
              start(async () => {
                const r = await deleteBrand(initial.id!);
                if (r.ok) toast.success('Marca apagada.');
                else toast.error(r.error);
              });
            }}
          >
            Apagar marca
          </Button>
        )}
      </div>
    </form>
  );
}

export function BrandsEditor({ brands }: { brands: (BrandForm & { ai: BrandAiForm; groups: HashtagGroup[] })[] }) {
  return (
    <div className="space-y-4">
      {brands.length === 0 && <p className="text-sm text-muted-foreground">Ainda não tem marcas. Crie a primeira abaixo.</p>}
      {brands.map(({ ai, groups, ...b }) => (
        <div key={b.id} className="space-y-2">
          <BrandRow initial={b} />
          <BrandAiSection initial={ai} />
          <HashtagGroupsSection brandId={b.id!} groups={groups} />
        </div>
      ))}
      <h2 className="pt-2 font-medium">Nova marca</h2>
      <BrandRow initial={EMPTY} />
    </div>
  );
}
