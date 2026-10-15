'use client';

import { Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cancelPost, savePost } from '@/app/(app)/posts/actions';
import type { ComposerData } from '@/app/(app)/posts/data';
import { MediaGrid } from '@/components/media/media-grid';
import { MediaThumb } from '@/components/media/media-thumb';
import { MediaUploader } from '@/components/media/media-uploader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FORMAT_PLATFORM, PLATFORM_LABEL, type MediaInfo, type TargetFormat } from '@/lib/platforms/types';
import { checkPost, defaultFormat, FORMAT_LABEL, type PostError } from '@/lib/posts/schema';

type Target = ComposerData['initial']['targets'][number];
const CAPTION_MAX: Record<string, number> = { instagram: 2200, tiktok: 2200, youtube: 5000 };

export function Composer({ data }: { data: ComposerData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [s, setS] = useState(data.initial);
  const [serverErrors, setServerErrors] = useState<PostError[]>([]);
  const ro = s.locked;

  const brand = data.brands.find((b) => b.id === s.brandId);
  const accounts = data.accounts.filter((a) => a.brandId === s.brandId);
  const brandMedia = data.media.filter((m) => m.brandId === s.brandId);
  const selectedMedia = s.mediaIds.map((id) => data.media.find((m) => m.id === id)).filter((m) => !!m);
  const mediaInfo: MediaInfo[] = selectedMedia.map((m) => ({
    id: m.id, kind: m.kind, mime: m.mime, sizeBytes: m.sizeBytes, width: m.width, height: m.height, durationS: m.durationS, storagePath: m.storagePath,
  }));

  const liveCheck =
    brand && s.targets.length > 0 && s.mediaIds.length > 0
      ? checkPost({ ...s, intent: 'schedule' }, mediaInfo, accounts, brand.timezone, new Date())
      : null;
  const live: PostError[] = liveCheck && !liveCheck.ok ? liveCheck.errors : [];
  const errorsFor = (i: number | null) => [...live, ...serverErrors].filter((e) => e.targetIndex === i);

  const update = (patch: Partial<typeof s>) => {
    setServerErrors([]);
    setS((prev) => ({ ...prev, ...patch }));
  };
  const toggleMedia = (id: string) =>
    update({ mediaIds: s.mediaIds.includes(id) ? s.mediaIds.filter((x) => x !== id) : [...s.mediaIds, id] });
  const toggleAccount = (accountId: string) => {
    const exists = s.targets.some((t) => t.accountId === accountId);
    const acc = accounts.find((a) => a.id === accountId)!;
    update({
      targets: exists
        ? s.targets.filter((t) => t.accountId !== accountId)
        : [...s.targets, { accountId, format: defaultFormat(acc.platform, selectedMedia), caption: s.targets[0]?.caption ?? '', title: acc.platform === 'youtube' ? '' : null }],
    });
  };
  const setTarget = (i: number, patch: Partial<Target>) => update({ targets: s.targets.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  const submit = (intent: 'draft' | 'schedule') =>
    start(async () => {
      const r = await savePost({ ...s, intent });
      if (r.ok) {
        toast.success(intent === 'draft' ? 'Rascunho guardado.' : 'Post agendado.');
        router.push('/calendario');
      } else {
        setServerErrors(r.errors);
        toast.error(r.errors[0]?.message ?? 'Verifique os erros.');
      }
    });

  if (data.brands.length === 0) return <p className="text-sm text-muted-foreground">Crie primeiro uma marca em Definições → Marcas.</p>;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {ro && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">Este post já começou a publicar — só de leitura.</p>}

        <section className="space-y-2" aria-label="Marca e título">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="brand">Marca</Label>
              <select id="brand" disabled={ro || !!s.id} value={s.brandId} onChange={(e) => update({ brandId: e.target.value, mediaIds: [], targets: [] })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {data.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="title">Título interno (só para si)</Label>
              <Input id="title" disabled={ro} value={s.internalTitle} maxLength={120} onChange={(e) => update({ internalTitle: e.target.value })} placeholder="Ex.: Prazos Portugal 2027" />
            </div>
          </div>
        </section>

        <section className="space-y-2" aria-label="Mídia">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">1. Mídia</h2>
            {!ro && (
              <Dialog>
                <DialogTrigger asChild><Button type="button" variant="outline" size="sm">Escolher ficheiros</Button></DialogTrigger>
                <DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto">
                  <DialogHeader><DialogTitle>Biblioteca — {brand?.name}</DialogTitle></DialogHeader>
                  <MediaUploader brands={brand ? [brand] : []} defaultBrandId={s.brandId} onUploaded={(ids) => update({ mediaIds: [...s.mediaIds, ...ids] })} />
                  <MediaGrid items={brandMedia} selected={s.mediaIds} onToggle={toggleMedia} />
                </DialogContent>
              </Dialog>
            )}
          </div>
          {selectedMedia.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum ficheiro escolhido.</p>
          ) : (
            <ol className="flex flex-wrap gap-2">
              {selectedMedia.map((m, i) => (
                <li key={m.id} className="w-24 space-y-1">
                  <MediaThumb item={m} />
                  {!ro && selectedMedia.length > 1 && (
                    <div className="flex justify-between text-xs">
                      <button type="button" disabled={i === 0} aria-label="Mover para a esquerda" onClick={() => { const a = [...s.mediaIds]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; update({ mediaIds: a }); }}>←</button>
                      <span>{i + 1}</span>
                      <button type="button" disabled={i === selectedMedia.length - 1} aria-label="Mover para a direita" onClick={() => { const a = [...s.mediaIds]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; update({ mediaIds: a }); }}>→</button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          {errorsFor(null).filter((e) => e.field === 'mediaIds').map((e) => <p key={e.message} className="text-sm text-destructive">{e.message}</p>)}
        </section>

        <section className="space-y-3" aria-label="Redes">
          <h2 className="font-medium">2. Redes e legendas</h2>
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">Esta marca ainda não tem contas ligadas (Definições → Contas ligadas).</p>}
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <label key={a.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                <input type="checkbox" disabled={ro} checked={s.targets.some((t) => t.accountId === a.id)} onChange={() => toggleAccount(a.id)} />
                {PLATFORM_LABEL[a.platform]} @{a.handle.replace(/^@/, '')}
              </label>
            ))}
          </div>
          {s.targets.length > 1 && !ro && (
            <Button type="button" variant="ghost" size="sm" onClick={() => update({ targets: s.targets.map((t) => ({ ...t, caption: s.targets[0].caption })) })}>
              <Copy className="size-4" aria-hidden /> Copiar a primeira legenda para todas as redes
            </Button>
          )}
          {s.targets.map((t, i) => {
            const acc = accounts.find((a) => a.id === t.accountId);
            if (!acc) return null;
            const formats = (Object.keys(FORMAT_LABEL) as TargetFormat[]).filter((f) => FORMAT_PLATFORM[f] === acc.platform);
            const errs = errorsFor(i);
            const max = CAPTION_MAX[acc.platform];
            return (
              <fieldset key={t.accountId} className="space-y-2 rounded-xl border p-3" aria-label={`Destino ${PLATFORM_LABEL[acc.platform]}`}>
                <legend className="px-1 text-sm font-medium">{PLATFORM_LABEL[acc.platform]} @{acc.handle.replace(/^@/, '')}</legend>
                {formats.length > 1 && (
                  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Formato">
                    {formats.map((f) => (
                      <button key={f} type="button" disabled={ro} role="radio" aria-checked={t.format === f} onClick={() => setTarget(i, { format: f })}
                        className={`rounded-full border px-3 py-0.5 text-xs ${t.format === f ? 'border-brand-navy bg-brand-navy text-white' : ''}`}>
                        {FORMAT_LABEL[f]}
                      </button>
                    ))}
                  </div>
                )}
                {acc.platform === 'youtube' && (
                  <Input aria-label="Título do YouTube" disabled={ro} placeholder="Título (obrigatório)" maxLength={150} value={t.title ?? ''} onChange={(e) => setTarget(i, { title: e.target.value })} />
                )}
                {t.format !== 'ig_story' && (
                  <div className="space-y-1">
                    <Textarea aria-label={`Legenda ${PLATFORM_LABEL[acc.platform]}`} disabled={ro} rows={4} value={t.caption} onChange={(e) => setTarget(i, { caption: e.target.value })}
                      placeholder={acc.platform === 'youtube' ? 'Descrição' : 'Legenda'} />
                    <p className={`text-right text-xs ${t.caption.length > max ? 'text-destructive' : 'text-muted-foreground'}`}>{t.caption.length}/{max}</p>
                  </div>
                )}
                {acc.platform === 'tiktok' && <p className="text-xs text-muted-foreground">O vídeo vai para a caixa de entrada do TikTok; cola a legenda e publica com 1 toque.</p>}
                {acc.platform === 'youtube' && <p className="text-xs text-muted-foreground">O Short é enviado como privado; torna-o público no YouTube Studio com 1 toque.</p>}
                {errs.map((e) => <p key={`${e.field}${e.message}`} role="alert" className="text-sm text-destructive">{e.message}</p>)}
              </fieldset>
            );
          })}
        </section>

        <section className="space-y-2" aria-label="Quando">
          <h2 className="font-medium">3. Quando</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" disabled={ro} value={s.date} onChange={(e) => update({ date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="time">Hora</Label>
              <Input id="time" type="time" disabled={ro} value={s.time} onChange={(e) => update({ time: e.target.value })} />
            </div>
            <span className="pb-2 text-sm text-muted-foreground">Fuso: {brand?.timezone}</span>
          </div>
          {errorsFor(null).filter((e) => e.field !== 'mediaIds').map((e) => <p key={e.message} role="alert" className="text-sm text-destructive">{e.message}</p>)}
        </section>

        {!ro && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button type="button" disabled={pending} onClick={() => submit('schedule')}>Agendar</Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => submit('draft')}>Guardar rascunho</Button>
            {s.id && (
              <Button type="button" variant="ghost" disabled={pending} onClick={() => {
                if (!confirm('Cancelar este post?')) return;
                start(async () => {
                  const r = await cancelPost(s.id!);
                  if (r.ok) { toast.success('Post cancelado.'); router.push('/calendario'); } else toast.error(r.error);
                });
              }}>Cancelar post</Button>
            )}
          </div>
        )}
      </div>

      <aside aria-label="Pré-visualização" className="space-y-3">
        <h2 className="font-medium">Pré-visualização</h2>
        {s.targets.length === 0 && <p className="text-sm text-muted-foreground">Escolha uma rede para ver a pré-visualização.</p>}
        {s.targets.map((t) => {
          const acc = accounts.find((a) => a.id === t.accountId);
          if (!acc) return null;
          return (
            <div key={t.accountId} className="space-y-2 rounded-xl border p-3">
              <p className="text-xs font-medium">{PLATFORM_LABEL[acc.platform]} · {FORMAT_LABEL[t.format]}</p>
              {selectedMedia[0] && <MediaThumb item={selectedMedia[0]} className={t.format === 'ig_image' || t.format === 'ig_carousel' ? '' : 'aspect-[9/16]'} />}
              {t.title && <p className="text-sm font-semibold">{t.title}</p>}
              {t.caption && <p className="line-clamp-4 whitespace-pre-wrap text-xs">{t.caption}</p>}
            </div>
          );
        })}
      </aside>
    </div>
  );
}
