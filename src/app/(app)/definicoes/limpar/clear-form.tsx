'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateField } from '@/components/ui-x/date-field';
import { SelectField } from '@/components/ui-x/select-field';
import { callSafely } from '@/lib/ai/call-safely';
import { clearCalendar, previewClear } from './actions';

type Preview = { drafts: number; scheduled: number; cancelled: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ClearForm({ brands, defaultBrandId, today }: { brands: { id: string; name: string }[]; defaultBrandId: string | null; today: string }) {
  const [brandId, setBrandId] = useState(defaultBrandId ?? brands[0]?.id ?? '');
  const [from, setFrom] = useState(today);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!brandId || !from) return;
    let live = true;
    previewClear({ brandId, from }).then((r) => {
      if (!live) return;
      if (r.ok) setPreview(r);
      else toast.error(r.error);
    });
    return () => { live = false; };
  }, [brandId, from]);

  const total = preview ? preview.drafts + preview.scheduled + preview.cancelled : 0;

  const run = () => {
    if (!confirm(`Apagar ${plural(total, 'post', 'posts')} do calendário? Não dá para desfazer.`)) return;
    start(async () => {
      const r = await callSafely(() => clearCalendar({ brandId, from }));
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${plural(r.removed, 'post apagado', 'posts apagados')}.`);
      setPreview({ drafts: 0, scheduled: 0, cancelled: 0 });
    });
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {brands.length > 1 && (
          <div className="space-y-1">
            <Label htmlFor="cl-brand">Marca</Label>
            <SelectField id="cl-brand" value={brandId} onChange={setBrandId} options={brands.map((b) => ({ value: b.id, label: b.name }))} />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="cl-from">A partir de</Label>
          <DateField id="cl-from" value={from} onChange={setFrom} />
        </div>
      </div>
      <p className="text-sm" aria-live="polite">
        {preview === null
          ? 'A contar…'
          : total === 0
            ? 'Não há nada para apagar a partir desta data.'
            : `Vai apagar ${plural(preview.drafts, 'rascunho', 'rascunhos')}, ${plural(preview.scheduled, 'agendado', 'agendados')} (são cancelados primeiro) e ${plural(preview.cancelled, 'cancelado', 'cancelados')}.`}
      </p>
      <Button type="button" variant="destructive" disabled={pending || total === 0} onClick={run}>
        {pending ? 'A apagar…' : `Apagar ${plural(total, 'post', 'posts')}`}
      </Button>
    </div>
  );
}
