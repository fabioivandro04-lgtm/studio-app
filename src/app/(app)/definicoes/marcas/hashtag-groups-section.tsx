'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { callSafely } from '@/lib/ai/call-safely';
import type { HashtagGroup } from '@/lib/db/repo/hashtag-groups-repo';
import { deleteHashtagGroup, saveHashtagGroup } from '../actions';

type Draft = { id?: string; name: string; tags: string };

function GroupForm({ brandId, initial, onDone }: { brandId: string; initial: Draft; onDone(): void }) {
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const key = initial.id ?? `novo-${brandId}`;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await callSafely(() => saveHashtagGroup({ ...form, brandId }));
      if (r.ok) {
        toast.success('Grupo guardado.');
        onDone();
      } else toast.error(r.error);
    });
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border p-3" aria-label={initial.id ? `Editar grupo ${initial.name}` : 'Novo grupo de hashtags'}>
      <div className="space-y-1">
        <Label htmlFor={`gname-${key}`}>Nome do grupo</Label>
        <Input id={`gname-${key}`} value={form.name} maxLength={40} placeholder="Ex.: Bolsas Portugal" onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`gtags-${key}`}>Hashtags</Label>
        <textarea
          id={`gtags-${key}`}
          value={form.tags}
          rows={2}
          placeholder="#bolsas #estudarfora #portugal"
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          className="w-full rounded-md border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>Guardar grupo</Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onDone}>Cancelar</Button>
      </div>
    </form>
  );
}

/** "Grupos de hashtags" de uma marca: listar, criar, editar, apagar. */
export function HashtagGroupsSection({ brandId, groups }: { brandId: string; groups: HashtagGroup[] }) {
  const [editing, setEditing] = useState<string | 'novo' | null>(null);
  const [pending, start] = useTransition();
  const remove = (g: HashtagGroup) => {
    if (!confirm(`Apagar o grupo "${g.name}"?`)) return;
    start(async () => {
      const r = await callSafely(() => deleteHashtagGroup(g.id));
      if (r.ok) toast.success('Grupo apagado.');
      else toast.error(r.error);
    });
  };
  return (
    <fieldset className="space-y-2 rounded-xl border p-4">
      <legend className="px-1 text-sm font-medium">Grupos de hashtags</legend>
      <p className="text-xs text-muted-foreground">Conjuntos de hashtags que junta a um post com um toque (botão &quot;# Hashtags&quot; no post).</p>
      {groups.length === 0 && editing !== 'novo' && <p className="text-sm text-muted-foreground">Ainda sem grupos.</p>}
      <ul className="space-y-2">
        {groups.map((g) =>
          editing === g.id ? (
            <li key={g.id}><GroupForm brandId={brandId} initial={{ id: g.id, name: g.name, tags: g.tags.join(' ') }} onDone={() => setEditing(null)} /></li>
          ) : (
            <li key={g.id} className="flex flex-wrap items-start gap-2 rounded-lg border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{g.name}</p>
                <p className="break-words text-xs text-muted-foreground">{g.tags.join(' ')}</p>
              </div>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setEditing(g.id)} aria-label={`Editar ${g.name}`}>Editar</Button>
              <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => remove(g)} aria-label={`Apagar ${g.name}`}>Apagar</Button>
            </li>
          ),
        )}
      </ul>
      {editing === 'novo' ? (
        <GroupForm brandId={brandId} initial={{ name: '', tags: '' }} onDone={() => setEditing(null)} />
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing('novo')}>+ Novo grupo</Button>
      )}
    </fieldset>
  );
}
