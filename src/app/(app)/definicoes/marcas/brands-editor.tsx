'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TIMEZONES } from '@/lib/brands/schema';
import { deleteBrand, saveBrand } from '../actions';

type BrandForm = { id?: string; name: string; color: string; timezone: string };
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
    <form onSubmit={submit} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto_1fr]" aria-label={isNew ? 'Nova marca' : `Marca ${initial.name}`}>
      <div className="space-y-1">
        <Label htmlFor={`name-${initial.id ?? 'nova'}`}>Nome</Label>
        <Input id={`name-${initial.id ?? 'nova'}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`color-${initial.id ?? 'nova'}`}>Cor</Label>
        <input
          id={`color-${initial.id ?? 'nova'}`}
          type="color"
          value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value })}
          className="h-9 w-14 cursor-pointer rounded-md border"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`tz-${initial.id ?? 'nova'}`}>Fuso horário</Label>
        <select
          id={`tz-${initial.id ?? 'nova'}`}
          value={form.timezone}
          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          {TIMEZONES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" disabled={pending}>
          {isNew ? 'Criar marca' : 'Guardar'}
        </Button>
        {!isNew && (
          <Button
            type="button"
            variant="ghost"
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
            Apagar
          </Button>
        )}
      </div>
    </form>
  );
}

export function BrandsEditor({ brands }: { brands: BrandForm[] }) {
  return (
    <div className="space-y-4">
      {brands.length === 0 && <p className="text-sm text-muted-foreground">Ainda não tem marcas. Crie a primeira abaixo.</p>}
      {brands.map((b) => (
        <BrandRow key={b.id} initial={b} />
      ))}
      <h2 className="pt-2 font-medium">Nova marca</h2>
      <BrandRow initial={EMPTY} />
    </div>
  );
}
