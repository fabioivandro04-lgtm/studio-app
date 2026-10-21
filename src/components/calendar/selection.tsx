'use client';

import { CheckSquare, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deletePosts } from '@/app/(app)/calendario/actions';
import { Button } from '@/components/ui/button';
import { callSafely } from '@/lib/ai/call-safely';
import type { CalendarPost } from './calendar-view';

type Selection = {
  active: boolean;
  selected: Set<string>;
  toggle: (id: string) => void;
  remove: (ids: string[], question: string) => void;
  pending: boolean;
};

const Ctx = createContext<Selection>({ active: false, selected: new Set(), toggle: () => {}, remove: () => {}, pending: false });
export const useSelection = () => useContext(Ctx);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Escolher posts no calendário para os apagar (um a um ou vários de uma vez). */
export function CalendarSelection({ posts, children }: { posts: CalendarPost[]; children: React.ReactNode }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const removable = posts.filter((p) => p.deletable);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const remove = (ids: string[], question: string) => {
    if (!ids.length || !confirm(question)) return;
    start(async () => {
      const r = await callSafely(() => deletePosts(ids));
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${plural(r.removed, 'post apagado', 'posts apagados')}${r.skipped ? `; ${plural(r.skipped, 'ficou', 'ficaram')} (a publicar).` : '.'}`);
      setSelected(new Set());
      setActive(false);
      router.refresh();
    });
  };

  const close = () => { setActive(false); setSelected(new Set()); };
  const chosen = posts.filter((p) => selected.has(p.id));
  const published = chosen.filter((p) => p.status !== 'draft' && p.status !== 'scheduled' && p.status !== 'cancelled').length;
  const question = `Apagar ${plural(chosen.length, 'post', 'posts')} do Estúdio?${published ? ` ${plural(published, 'já foi publicado', 'já foram publicados')}: sai do histórico e das métricas do Estúdio, mas fica nas redes.` : ''} Não dá para desfazer.`;

  return (
    <Ctx.Provider value={{ active, selected, toggle, remove, pending }}>
      <div className="flex flex-wrap items-center gap-2" data-testid="calendar-selection">
        {!active ? (
          <Button type="button" size="sm" variant="outline" disabled={removable.length === 0} onClick={() => setActive(true)}>
            <CheckSquare className="size-4" aria-hidden /> Selecionar
          </Button>
        ) : (
          <>
            <span className="text-sm font-medium">{plural(selected.size, 'selecionado', 'selecionados')}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(selected.size === removable.length ? new Set() : new Set(removable.map((p) => p.id)))}>
              {selected.size === removable.length ? 'Limpar seleção' : `Todos os visíveis (${removable.length})`}
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={pending || selected.size === 0} onClick={() => remove([...selected], question)}>
              <Trash2 className="size-4" aria-hidden /> {pending ? 'A apagar…' : 'Apagar'}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={close} aria-label="Sair da seleção">
              <X className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </div>
      {children}
    </Ctx.Provider>
  );
}
