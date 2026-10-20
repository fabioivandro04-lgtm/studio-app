'use client';

import { Bot } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { callSafely } from '@/lib/ai/call-safely';
import { draftVoice } from '@/app/(app)/ai/actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveBrandAi } from '../actions';
import { PostingSlotsField } from './posting-slots-field';
import type { PostingSlot } from '@/lib/schedule/slots';
import { SelectField } from '@/components/ui-x/select-field';

export interface BrandAiForm {
  brandId: string;
  aiContext: string;
  aiVoice: string;
  aiHashtags: string[];
  goal: 'contacts' | 'reach';
  postsPerWeek: number;
  postingSlots: PostingSlot[];
  replyKnowledge: string;
  hasInstagram: boolean;
}

const Counter = ({ value, max }: { value: string; max: number }) => (
  <span className={value.length > max ? 'text-destructive' : 'text-muted-foreground'}>{value.length}/{max}</span>
);

/** Contexto, voz, hashtags fixas e objetivo de uma marca (o que a IA lê antes de sugerir). */
export function BrandAiSection({ initial }: { initial: BrandAiForm }) {
  const [context, setContext] = useState(initial.aiContext);
  const [voice, setVoice] = useState(initial.aiVoice);
  const [tags, setTags] = useState(initial.aiHashtags.join(' '));
  const [goal, setGoal] = useState(initial.goal);
  const [ppw, setPpw] = useState(String(initial.postsPerWeek));
  const [slots, setSlots] = useState(initial.postingSlots);
  const [knowledge, setKnowledge] = useState(initial.replyKnowledge);
  const [pending, start] = useTransition();
  const [drafting, startDraft] = useTransition();
  const id = initial.brandId;

  const save = () =>
    start(async () => {
      const r = await callSafely(() => saveBrandAi({ brandId: id, aiContext: context, aiVoice: voice, aiHashtags: tags.split(/[\s,]+/).filter(Boolean), goal, postsPerWeek: ppw.trim() === '' ? Number.NaN : Number(ppw), postingSlots: slots, replyKnowledge: knowledge }));
      if (r.ok) toast.success('Definições de IA guardadas.');
      else toast.error(r.error);
    });

  const draft = () =>
    startDraft(async () => {
      const r = await callSafely(() => draftVoice({ brandId: id }));
      if (r.ok) {
        setVoice(r.voice);
        toast.success('Rascunho da voz criado. Reveja e carregue em Guardar IA.');
      } else toast.error(r.error);
    });

  return (
    <details className="rounded-xl border bg-muted/30 px-4 py-3" aria-label="Assistente de IA">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <Bot className="size-4 text-muted-foreground" aria-hidden /> Assistente de IA
      </summary>
      <div className="mt-3 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <Label htmlFor={`ctx-${id}`}>Contexto da empresa</Label>
            <Counter value={context} max={4000} />
          </div>
          <Textarea
            id={`ctx-${id}`}
            rows={5}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="O que a empresa faz, serviços, países, público, ofertas e contactos."
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <Label htmlFor={`voice-${id}`}>Voz da marca</Label>
            <Counter value={voice} max={2000} />
          </div>
          <Textarea
            id={`voice-${id}`}
            rows={5}
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            placeholder="Tom, tratamento (tu/vocês), chamada para ação, palavras a evitar."
          />
          <Button type="button" variant="outline" size="sm" disabled={!initial.hasInstagram || drafting} onClick={draft}>
            {drafting ? 'A ler o Instagram…' : 'Criar a partir do Instagram'}
          </Button>
          {!initial.hasInstagram && <p className="text-xs text-muted-foreground">Ligue o Instagram desta marca primeiro.</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor={`tags-${id}`}>Hashtags fixas</Label>
          <input
            id={`tags-${id}`}
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="#unidreamity #estudarfora"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
          <p className="text-xs text-muted-foreground">Separadas por espaço. Entram sempre nas sugestões (máx. 10).</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`goal-${id}`}>Objetivo</Label>
          <SelectField id={`goal-${id}`} value={goal} onChange={(v) => setGoal(v as 'contacts' | 'reach')} options={[{ value: 'contacts', label: 'Contactos' }, { value: 'reach', label: 'Alcance' }]} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ppw-${id}`}>Posts por semana</Label>
          <input
            id={`ppw-${id}`}
            type="number"
            min={1}
            max={21}
            inputMode="numeric"
            value={ppw}
            onChange={(e) => setPpw(e.target.value)}
            className="h-9 w-24 rounded-md border bg-background px-3 text-sm"
          />
          <p className="text-xs text-muted-foreground">Usado para planear a semana nas Ideias.</p>
        </div>
        <PostingSlotsField id={id} value={slots} onChange={setSlots} />
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <Label htmlFor={`kb-${id}`}>Respostas guardadas</Label>
            <Counter value={knowledge} max={4000} />
          </div>
          <Textarea
            id={`kb-${id}`}
            rows={6}
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            placeholder={'Perguntas frequentes e a resposta certa, uma por linha. Ex.:\nPreço da consulta: 50 €.\nVagas para outubro: abertas até 15/11.\nComo marcar: pelo WhatsApp +258 …'}
          />
          <p className="text-xs text-muted-foreground">A IA usa isto (e o contexto da empresa) para sugerir respostas a mensagens e comentários. Não inventa o que não estiver aqui.</p>
        </div>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? 'A guardar…' : 'Guardar IA'}
        </Button>
      </div>
    </details>
  );
}
