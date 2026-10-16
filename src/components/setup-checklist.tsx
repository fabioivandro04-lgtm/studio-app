import { CheckCircle2, Circle } from 'lucide-react';
import Link from 'next/link';
import { setupMode } from '@/lib/ui/setup-mode';
import { SetupCompact } from './setup-compact';

export interface SetupProgress {
  brands: number;
  accounts: number;
  media: number;
  posts: number;
}

const STEPS = [
  { key: 'brands', label: 'Criar as suas marcas', href: '/definicoes/marcas' },
  { key: 'accounts', label: 'Ligar Instagram, TikTok ou YouTube', href: '/definicoes/contas' },
  { key: 'media', label: 'Carregar fotos ou vídeos na Biblioteca', href: '/biblioteca' },
  { key: 'posts', label: 'Agendar o primeiro post', href: '/posts/novo' },
] as const;

/** "Primeiros passos": cartão completo no início, uma linha quando falta 1 passo, nada quando acabou ou foi fechado. */
export function SetupChecklist({ progress, dismissed = false }: { progress: SetupProgress; dismissed?: boolean }) {
  const done = STEPS.filter((s) => progress[s.key] > 0).length;
  const mode = setupMode(done, STEPS.length, dismissed);
  if (mode === 'hidden') return null;
  const next = STEPS.find((s) => progress[s.key] === 0)!;
  if (mode === 'compact') return <SetupCompact label={next.label} href={next.href} />;
  return (
    <section aria-label="Primeiros passos" className="rounded-xl border bg-gradient-to-br from-brand-navy to-[#16306a] p-4 text-white shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Primeiros passos</h2>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{done} de {STEPS.length}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden>
        <div className="h-full rounded-full bg-brand-amber transition-all" style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>
      <ol className="mt-3 space-y-1.5 text-sm">
        {STEPS.map((s) => {
          const ok = progress[s.key] > 0;
          return (
            <li key={s.key}>
              <Link href={s.href} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-white/10">
                {ok ? <CheckCircle2 className="size-4 text-brand-amber" aria-hidden /> : <Circle className="size-4 text-white/50" aria-hidden />}
                <span className={ok ? 'text-white/60 line-through' : ''}>{s.label}</span>
                <span className="sr-only">{ok ? '(feito)' : '(por fazer)'}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <Link href={next.href} className="mt-3 inline-block rounded-md bg-brand-amber px-3 py-1.5 text-sm font-medium text-[#0B1F45] hover:opacity-90">
        Continuar →
      </Link>
    </section>
  );
}
