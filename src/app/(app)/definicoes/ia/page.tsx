import { isFreeModel } from '@/lib/ai/types';
import { aiStatus } from '@/app/(app)/ai/actions';
import { AiSettingsForm } from './ai-settings-form';

export const metadata = { title: 'IA — Estúdio' };

const usd = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default async function IaPage() {
  const s = await aiStatus();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">Motor usado pelo Assistente e limite de gastos por mês (via OpenRouter).</p>
      </div>
      {!s.ok ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">{s.error}</p>
      ) : (
        <>
          <section aria-label="Estado" className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Chave</p>
              <p className={s.hasKey ? 'font-medium text-emerald-700' : 'font-medium text-amber-700'}>
                {s.hasKey ? 'Ligada' : 'Falta a chave OPENROUTER_API_KEY na Vercel'}
              </p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Gasto este mês</p>
              <p className="font-medium tabular-nums">
                {usd.format(s.spentUsd)} <span className="text-muted-foreground">de {usd.format(s.limitUsd)}</span>
              </p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">Pedidos este mês</p>
              <p className="font-medium tabular-nums">{s.requests}</p>
            </div>
          </section>
          {s.spentUsd >= s.limitUsd && !isFreeModel(s.model) && (
            <p role="status" className="rounded-lg bg-brand-amber/15 px-3 py-2 text-sm">
              Chegou ao limite deste mês: até ao próximo mês a IA usa o modelo grátis (mais lento e com limite diário de pedidos).
            </p>
          )}
          <p className="text-sm text-muted-foreground">Ao chegar ao limite mensal, a IA não para: passa a usar o modelo grátis até ao mês seguinte.</p>
          <AiSettingsForm initial={{ model: s.model, limitUsd: s.limitUsd }} />
        </>
      )}
    </div>
  );
}
