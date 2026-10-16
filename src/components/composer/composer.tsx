'use client';

import { Copy, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { listBrandMedia } from '@/app/(app)/biblioteca/actions';
import { cancelPost, deletePost, duplicatePost, savePost } from '@/app/(app)/posts/actions';
import type { ComposerData } from '@/app/(app)/posts/data';
import { MediaGrid } from '@/components/media/media-grid';
import { MediaThumb } from '@/components/media/media-thumb';
import { MediaUploader } from '@/components/media/media-uploader';
import { MediaViewer } from '@/components/media/media-viewer';
import type { MediaItem } from '@/lib/db/repo/media-repo';
import { clearLocalDraft, draftAction, localDraftKey, readLocalDraft, writeLocalDraft, type LocalDraft } from '@/lib/posts/local-draft';
import { PlatformIcon } from '@/components/platform-icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FORMAT_PLATFORM, PLATFORM_LABEL, type MediaInfo, type Platform, type TargetFormat } from '@/lib/platforms/types';
import { aiPlatformsFor, appendHashtags, restoreCaptions, setCaption, snapshotCaptions, type CaptionSnapshot } from '@/lib/posts/caption-edits';
import { callSafely } from '@/lib/ai/call-safely';
import { AiPanel } from './ai-panel';
import { BestTime } from './best-time';
import { CoverPicker } from './cover-picker';
import { HashtagGroupsMenu } from './hashtag-groups-menu';
import { RefineMenu } from './refine-menu';
import { hasUnsavedChanges } from '@/lib/posts/dirty';
import { checkPost, defaultFormat, FORMAT_LABEL, type PostError } from '@/lib/posts/schema';
import { SelectField } from '@/components/ui-x/select-field';
import { DateField } from '@/components/ui-x/date-field';
import { TimeField } from '@/components/ui-x/time-field';

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
  // A biblioteca só é pedida ao abrir "Escolher ficheiros"; as mídias do post já vêm com a página.
  const [library, setLibrary] = useState<MediaItem[] | null>(null);
  const [libraryBrand, setLibraryBrand] = useState<string | null>(null);
  const loadLibrary = async () => {
    const r = await callSafely(() => listBrandMedia(s.brandId));
    if (r.ok) {
      setLibrary(r.items);
      setLibraryBrand(s.brandId);
    } else toast.error(r.error);
  };
  const known = [...(library ?? []), ...data.media];
  const brandMedia = libraryBrand === s.brandId ? (library ?? []) : [];
  const selectedMedia = s.mediaIds.map((id) => known.find((m) => m.id === id)).filter((m) => !!m);
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
  // Troca pela identidade (não pela posição): a lista visível pode não ter todos os ids.
  const swapMedia = (a: string, b: string) => {
    const ids = [...s.mediaIds];
    const i = ids.indexOf(a);
    const j = ids.indexOf(b);
    if (i < 0 || j < 0) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    update({ mediaIds: ids });
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

  // Assistente de IA: toda a alteração feita pela IA pode ser desfeita.
  const platformOf = (t: Target) => accounts.find((a) => a.id === t.accountId)?.platform;
  const aiPlatforms = aiPlatformsFor(s.targets.map(platformOf).filter((p): p is Platform => !!p), accounts);
  const aiFormats = Object.fromEntries(s.targets.map((t) => [platformOf(t), t.format]).filter(([p]) => p)) as Partial<Record<Platform, TargetFormat>>;
  // As respostas da IA chegam segundos depois: aplicam-se sobre o estado atual (não sobre o do clique)
  // e "Desfazer" repõe só as legendas que a IA mudou.
  const latest = useRef(s);
  useEffect(() => {
    latest.current = s;
  }, [s]);

  // Gravação local: as alterações ficam no navegador até serem guardadas.
  const draftKey = localDraftKey(data.initial.id ?? null, data.initial.brandId);
  const [recoverable, setRecoverable] = useState<LocalDraft<typeof s> | null>(null);
  useEffect(() => {
    // Só depois de montar: o servidor não conhece o navegador (evita diferenças na hidratação).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!ro) setRecoverable(readLocalDraft(window.localStorage, draftKey, data.initial, Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (ro) return;
    const action = draftAction(s, data.initial);
    if (action === 'write') writeLocalDraft(window.localStorage, draftKey, s, Date.now());
    else if (action === 'clear') clearLocalDraft(window.localStorage, draftKey);
  }, [s, ro, draftKey, data.initial]);
  // O aviso só aparece enquanto não houve edições (editar = ficar com o que está no ecrã).
  const showRecover = recoverable && s === data.initial ? recoverable : null;
  const recover = (d: LocalDraft<typeof s>) => {
    // Estado, bloqueio e id vêm sempre do servidor, nunca do rascunho.
    setS({ ...d.value, id: data.initial.id, status: data.initial.status, locked: data.initial.locked });
    setRecoverable(null);
    if (d.value.mediaIds.some((id) => !known.some((m) => m.id === id))) void loadLibrary();
  };
  const forgetDraft = () => clearLocalDraft(window.localStorage, draftKey);
  const patchTargets = (fn: (targets: Target[]) => Target[]) => {
    setServerErrors([]);
    setS((prev) => ({ ...prev, targets: fn(prev.targets) }));
  };
  const withUndo = (snap: CaptionSnapshot, message: string) =>
    toast.success(message, { action: { label: 'Desfazer', onClick: () => patchTargets((ts) => restoreCaptions(ts, snap)) } });
  const idsFor = (platform: Platform) => latest.current.targets.filter((t) => platformOf(t) === platform).map((t) => t.accountId);
  const applyAiCaption = (platform: Platform, text: string) => {
    const ids = idsFor(platform);
    if (ids.length) {
      const snap = snapshotCaptions(latest.current.targets, ids);
      patchTargets((ts) => ids.reduce((acc, id) => setCaption(acc, id, text), ts));
      withUndo(snap, 'Legenda alterada.');
      return;
    }
    const acc = accounts.find((a) => a.platform === platform && a.status === 'active');
    if (!acc) {
      toast.error('Esta rede não está ligada (ou precisa de ser ligada de novo) para esta marca.');
      return;
    }
    const added: Target = { accountId: acc.id, format: defaultFormat(platform, selectedMedia), caption: text, title: platform === 'youtube' ? '' : null };
    patchTargets((ts) => (ts.some((t) => t.accountId === acc.id) ? setCaption(ts, acc.id, text) : [...ts, added]));
    withUndo({ [acc.id]: null }, 'Legenda alterada.');
  };
  const addAiHashtags = (platform: Platform, tags: string[]) => {
    const ids = idsFor(platform);
    if (ids.length === 0) {
      toast.error('Marque primeiro esta rede em "2. Redes e legendas" ou use uma das legendas sugeridas.');
      return;
    }
    const snap = snapshotCaptions(latest.current.targets, ids);
    patchTargets((ts) => ts.map((t) => (ids.includes(t.accountId) ? { ...t, caption: appendHashtags(t.caption, tags) } : t)));
    withUndo(snap, 'Hashtags adicionadas.');
  };
  const addGroupHashtags = (tags: string[]) => {
    const ids = latest.current.targets.map((t) => t.accountId);
    if (ids.length === 0) {
      toast.error('Escolha primeiro uma rede.');
      return;
    }
    const snap = snapshotCaptions(latest.current.targets, ids);
    patchTargets((ts) => ts.map((t) => ({ ...t, caption: appendHashtags(t.caption, tags) })));
    withUndo(snap, 'Hashtags adicionadas.');
  };
  const duplicate = () => {
    if (hasUnsavedChanges(data.initial, s) && !confirm('Tem alterações por guardar. A cópia é feita a partir da versão guardada e estas alterações perdem-se. Continuar?')) return;
    start(async () => {
      const r = await callSafely(() => duplicatePost(s.id!));
      if (r.ok) {
        toast.success('Cópia criada.');
        router.push(`/posts/${r.id}`);
      } else toast.error(r.error);
    });
  };
  // Apagar do Estúdio: publicados, cancelados, falhados e rascunhos (não mexe nas redes).
  const deletable = !!s.id && ['draft', 'published', 'partial', 'failed', 'cancelled'].includes(s.status ?? 'draft');
  const remove = () => {
    if (!confirm('Apagar este post do Estúdio? Sai do calendário e das métricas. Não apaga nada no Instagram, TikTok ou YouTube.')) return;
    start(async () => {
      const r = await callSafely(() => deletePost(s.id!));
      if (r.ok) {
        forgetDraft();
        toast.success('Post apagado do Estúdio.');
        router.push('/calendario');
      } else toast.error(r.error);
    });
  };
  const replaceCaptionFromAi = (accountId: string, next: string) => {
    const snap = snapshotCaptions(latest.current.targets, [accountId]);
    patchTargets((ts) => setCaption(ts, accountId, next));
    withUndo(snap, 'Legenda alterada.');
  };

  const submit = (intent: 'draft' | 'schedule') =>
    start(async () => {
      const r = await savePost({ ...s, intent });
      if (r.ok) {
        forgetDraft();
        toast.success(intent === 'draft' ? 'Rascunho guardado.' : 'Post agendado.');
        router.push('/calendario');
      } else {
        setServerErrors(r.errors);
        toast.error(r.errors[0]?.message ?? 'Verifique os erros.');
      }
    });

  if (data.brands.length === 0) return <p className="text-sm text-muted-foreground">Crie primeiro uma marca em Definições → Marcas.</p>;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 pb-28 md:pb-20 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        {ro && <p role="status" className="rounded-lg bg-highlight px-3 py-2 text-sm text-highlight-foreground">Este post já começou a publicar — só de leitura.</p>}
        {showRecover && (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="flex-1">Tem alterações não guardadas de {new Date(showRecover.savedAt).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</span>
            <Button type="button" size="sm" onClick={() => recover(showRecover)}>Recuperar</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { forgetDraft(); setRecoverable(null); }}>Descartar</Button>
          </div>
        )}

        <section className="space-y-4 rounded-lg border bg-card p-4 shadow-xs md:p-5" aria-label="Conteúdo">
          <h2 className="font-semibold">1. Conteúdo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="brand">Marca</Label>
              <SelectField id="brand" disabled={ro || !!s.id} value={s.brandId} onChange={(v) => update({ brandId: v, mediaIds: [], targets: [] })} options={data.brands.map((b) => ({ value: b.id, label: b.name }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="title">Título interno (só para si)</Label>
              <Input id="title" disabled={ro} value={s.internalTitle} maxLength={120} onChange={(e) => update({ internalTitle: e.target.value })} placeholder="Ex.: Prazos Portugal 2027" />
            </div>
          </div>
          <div className="flex items-center justify-between" aria-label="Mídia" role="group">
            <h3 className="text-sm font-medium">Fotos e vídeos</h3>
            {!ro && (
              <Dialog onOpenChange={(o) => { if (o && libraryBrand !== s.brandId) void loadLibrary(); }}>
                <DialogTrigger asChild><Button type="button" variant="outline" size="sm">Escolher ficheiros</Button></DialogTrigger>
                <DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto">
                  <DialogHeader><DialogTitle>Biblioteca — {brand?.name}</DialogTitle></DialogHeader>
                  <MediaUploader brands={brand ? [brand] : []} defaultBrandId={s.brandId} onUploaded={(ids) => { update({ mediaIds: [...s.mediaIds, ...ids] }); void loadLibrary(); }} />
                  {libraryBrand === s.brandId ? (
                    <MediaGrid items={brandMedia} selected={s.mediaIds} onToggle={toggleMedia} />
                  ) : (
                    <p role="status" className="py-8 text-center text-sm text-muted-foreground">A abrir a biblioteca…</p>
                  )}
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
                  <MediaViewer item={m} />
                  {!ro && selectedMedia.length > 1 && (
                    <div className="flex justify-between text-xs">
                      <button type="button" disabled={i === 0} aria-label="Mover para a esquerda" onClick={() => swapMedia(m.id, selectedMedia[i - 1].id)}>←</button>
                      <span>{i + 1}</span>
                      <button type="button" disabled={i === selectedMedia.length - 1} aria-label="Mover para a direita" onClick={() => swapMedia(m.id, selectedMedia[i + 1].id)}>→</button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          {errorsFor(null).filter((e) => e.field === 'mediaIds').map((e) => <p key={e.message} className="text-sm text-destructive">{e.message}</p>)}
        </section>

        {!ro && (
          <AiPanel
            key={s.brandId}
            brandId={s.brandId}
            mediaId={s.mediaIds[0] ?? null}
            platforms={aiPlatforms}
            formats={aiFormats}
            onUseCaption={applyAiCaption}
            onAddHashtags={addAiHashtags}
            onUseTitle={(text) => update({ internalTitle: text })}
            onUseYoutubeTitle={(text) => {
              const ids = idsFor('youtube');
              const titles = Object.fromEntries(latest.current.targets.filter((t) => ids.includes(t.accountId)).map((t) => [t.accountId, t.title]));
              patchTargets((ts) => ts.map((t) => (ids.includes(t.accountId) ? { ...t, title: text } : t)));
              toast.success('Título do YouTube alterado.', {
                action: { label: 'Desfazer', onClick: () => patchTargets((ts) => ts.map((t) => (t.accountId in titles ? { ...t, title: titles[t.accountId] } : t))) },
              });
            }}
          />
        )}

        <section className="space-y-4 rounded-lg border bg-card p-4 shadow-xs md:p-5" aria-label="Redes">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">2. Redes e legendas</h2>
            {!ro && <HashtagGroupsMenu key={s.brandId} groups={data.hashtagGroups.filter((g) => g.brandId === s.brandId)} onPick={addGroupHashtags} />}
          </div>
          {accounts.length === 0 && (
            <p className="rounded-lg bg-highlight px-3 py-2 text-sm text-highlight-foreground">
              Esta marca ainda não tem redes ligadas.{' '}
              <Link href="/definicoes/contas" className="font-medium text-primary underline">Ligar agora</Link>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <label key={a.id} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
                <input type="checkbox" disabled={ro} checked={s.targets.some((t) => t.accountId === a.id)} onChange={() => toggleAccount(a.id)} />
                <PlatformIcon platform={a.platform} size="sm" />
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
                        className={`rounded-md border px-2.5 py-0.5 text-xs ${t.format === f ? 'border-primary bg-primary text-primary-foreground' : ''}`}>
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
                    {!ro && (
                      <RefineMenu
                        brandId={s.brandId}
                        platform={acc.platform}
                        text={t.caption}
                        onReplace={(next) => replaceCaptionFromAi(t.accountId, next)}
                      />
                    )}
                    <Textarea aria-label={`Legenda ${PLATFORM_LABEL[acc.platform]}`} disabled={ro} rows={4} value={t.caption} onChange={(e) => setTarget(i, { caption: e.target.value })}
                      placeholder={acc.platform === 'youtube' ? 'Descrição' : 'Legenda'} />
                    <p className={`text-right text-xs ${t.caption.length > max ? 'text-destructive' : 'text-muted-foreground'}`}>{t.caption.length}/{max}</p>
                  </div>
                )}
                {acc.platform === 'instagram' && t.format === 'ig_reel' && selectedMedia[0]?.kind === 'video' && (
                  <CoverPicker key={selectedMedia[0].id} media={selectedMedia[0]} valueMs={t.coverMs ?? null} disabled={ro} onChange={(ms) => setTarget(i, { coverMs: ms })} />
                )}
                {acc.platform === 'tiktok' && <p className="text-xs text-muted-foreground">O vídeo vai para a caixa de entrada do TikTok: escolha a capa, cole a legenda e publique com 1 toque.</p>}
                {acc.platform === 'youtube' && <p className="text-xs text-muted-foreground">O Short é enviado como privado: torne-o público no YouTube Studio com 1 toque.</p>}
                {errs.map((e) => <p key={`${e.field}${e.message}`} role="alert" className="text-sm text-destructive">{e.message}</p>)}
              </fieldset>
            );
          })}
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-4 shadow-xs md:p-5" aria-label="Quando">
          <h2 className="font-semibold">3. Quando</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="date">Data</Label>
              <DateField id="date" disabled={ro} value={s.date} onChange={(v) => update({ date: v })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="time">Hora</Label>
              <TimeField id="time" disabled={ro} value={s.time} onChange={(v) => update({ time: v })} />
            </div>
            <span className="pb-2 text-sm text-muted-foreground">Fuso: {brand?.timezone}</span>
          </div>
          {!ro && <BestTime key={s.brandId} brandId={s.brandId} postId={s.id ?? null} hasSlots={!!brand?.hasSlots} onPick={(date, time) => update({ date, time })} />}
          {errorsFor(null).filter((e) => e.field !== 'mediaIds').map((e) => <p key={e.message} role="alert" className="text-sm text-destructive">{e.message}</p>)}
        </section>

        <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 border-t bg-card/95 px-4 py-3 backdrop-blur md:sticky md:bottom-0 md:mx-0 md:rounded-lg md:border md:px-4">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            {!ro && <Button type="button" disabled={pending} onClick={() => submit('schedule')}>Agendar</Button>}
            {!ro && <Button type="button" variant="outline" disabled={pending} onClick={() => submit('draft')}>Guardar rascunho</Button>}
            {s.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" disabled={pending} className="ml-auto" aria-label="Mais ações">
                    <MoreHorizontal className="size-4" aria-hidden /> Mais
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={duplicate}>Duplicar</DropdownMenuItem>
                  {!ro && (
                    <DropdownMenuItem onSelect={() => {
                      if (!confirm('Cancelar este post?')) return;
                      start(async () => {
                        const r = await cancelPost(s.id!);
                        if (r.ok) { forgetDraft(); toast.success('Post cancelado.'); router.push('/calendario'); } else toast.error(r.error);
                      });
                    }}>Cancelar post</DropdownMenuItem>
                  )}
                  {deletable && (ro || s.status === 'draft') && <DropdownMenuItem variant="destructive" onSelect={remove}>Apagar do Estúdio</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <aside aria-label="Pré-visualização" className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        <h2 className="font-semibold">Pré-visualização</h2>
        {s.targets.length === 0 && <p className="text-sm text-muted-foreground">Escolha uma rede para ver a pré-visualização.</p>}
        {s.targets.map((t) => {
          const acc = accounts.find((a) => a.id === t.accountId);
          if (!acc) return null;
          return (
            <div key={t.accountId} className="space-y-2 rounded-lg border bg-card p-3 shadow-xs">
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
