'use client';

import { Bot } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { callSafely } from '@/lib/ai/call-safely';
import { suggestPost } from '@/app/(app)/ai/actions';
import { PlatformIcon } from '@/components/platform-icon';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PROMPT_MAX } from '@/lib/ai/prompts';
import type { Suggestions } from '@/lib/ai/types';
import { PLATFORM_LABEL, type Platform, type TargetFormat } from '@/lib/platforms/types';
import { cn } from '@/lib/utils';

export interface AiPanelProps {
  brandId: string;
  mediaId: string | null;
  platforms: Platform[];
  formats: Partial<Record<Platform, TargetFormat>>;
  onUseCaption(platform: Platform, text: string): void;
  onAddHashtags(platform: Platform, tags: string[]): void;
  onUseTitle(text: string): void;
  onUseYoutubeTitle(text: string): void;
}

/** Painel "Sugerir com IA": uma frase + a imagem → legendas, títulos e hashtags. */
export function AiPanel(p: AiPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<Suggestions | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const generate = () =>
    start(async () => {
      const r = await callSafely(() => suggestPost({ brandId: p.brandId, prompt, mediaId: p.mediaId, platforms: p.platforms, formats: p.formats }));
      if (r.ok) {
        setResult(r.suggestions);
        setChosen({});
      } else toast.error(r.error);
    });

  const key = (platform: Platform, tag: string) => `${platform}:${tag}`;

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} aria-expanded={false}>
        <Bot className="size-4" aria-hidden /> Sugerir com IA
      </Button>
    );
  }

  return (
    <section aria-label="Assistente" className="space-y-3 rounded-lg border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Bot className="size-4 text-muted-foreground" aria-hidden /> Sugerir com IA
        </h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} aria-expanded>Fechar</Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ai-prompt">Sobre o que é este post?</Label>
        <Textarea
          id="ai-prompt"
          rows={2}
          maxLength={PROMPT_MAX}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex.: prazos Lisboa 2027, vagas para Angola"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {p.platforms.length === 0 ? 'Ligue uma rede para esta marca.' : `Para: ${p.platforms.map((x) => PLATFORM_LABEL[x]).join(', ')}${p.mediaId ? ' · a IA vê a imagem' : ''}`}
          </p>
          <Button type="button" size="sm" disabled={pending || !prompt.trim() || p.platforms.length === 0} onClick={generate}>
            Gerar
          </Button>
        </div>
      </div>

      {pending && (
        <p role="status" className="animate-pulse rounded-lg bg-background px-3 py-4 text-sm text-muted-foreground">
          A escrever…
        </p>
      )}

      {result && !pending && (
        <div className="space-y-4">
          {result.internalTitle && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-background p-2 text-sm">
              <span><span className="text-muted-foreground">Título interno: </span>{result.internalTitle}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => p.onUseTitle(result.internalTitle)}>Usar título</Button>
            </div>
          )}
          {result.youtubeTitle && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-background p-2 text-sm">
              <span><span className="text-muted-foreground">Título do YouTube: </span>{result.youtubeTitle}</span>
              <Button type="button" size="sm" variant="outline" onClick={() => p.onUseYoutubeTitle(result.youtubeTitle!)}>Usar título</Button>
            </div>
          )}
          {result.byPlatform.map((s) => (
            <div key={s.platform} className="space-y-2" aria-label={`Sugestões ${PLATFORM_LABEL[s.platform]}`}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <PlatformIcon platform={s.platform} size="sm" /> {PLATFORM_LABEL[s.platform]}
              </p>
              {s.captions.length === 0 && (
                <p className="rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground">Sem sugestões para esta rede. Carregue em Gerar de novo.</p>
              )}
              <ul className="grid gap-2 md:grid-cols-3">
                {s.captions.map((c, i) => (
                  <li key={i} data-testid="ai-caption" className="flex flex-col justify-between gap-2 rounded-lg border bg-background p-2 text-sm">
                    <p data-testid="ai-caption-text" className="line-clamp-6 whitespace-pre-wrap">{c}</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => p.onUseCaption(s.platform, c)}>Usar</Button>
                  </li>
                ))}
              </ul>
              {s.hashtags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {s.hashtags.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={!!chosen[key(s.platform, h)]}
                      onClick={() => setChosen((prev) => ({ ...prev, [key(s.platform, h)]: !prev[key(s.platform, h)] }))}
                      className={cn('rounded-md border px-2 py-0.5 text-xs', chosen[key(s.platform, h)] ? 'border-primary bg-primary text-primary-foreground' : 'bg-background')}
                    >
                      {h}
                    </button>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={!s.hashtags.some((h) => chosen[key(s.platform, h)])}
                    onClick={() => p.onAddHashtags(s.platform, s.hashtags.filter((h) => chosen[key(s.platform, h)]))}
                  >
                    Adicionar à legenda
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
