'use client';

import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { sendMessage } from '@/app/(app)/mensagens/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { callSafely } from '@/lib/ai/call-safely';

/** Caixa de resposta de uma conversa. Fechada quando já passaram 24 h desde a última mensagem do cliente. */
export function ReplyBox({ accountId, conversationId, open, closesLabel }: {
  accountId: string;
  conversationId: string;
  open: boolean;
  /** Ex.: "Pode responder até hoje às 14:30." */
  closesLabel: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <p className="rounded-lg bg-highlight px-3 py-2 text-sm text-highlight-foreground">
        Já passaram mais de 24 h desde a última mensagem do cliente: o Instagram não deixa responder pela app. Responda no telemóvel.
      </p>
    );
  }

  const submit = () =>
    start(async () => {
      const r = await callSafely(() => sendMessage({ accountId, conversationId, text }));
      if (r.ok) {
        setText('');
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) submit();
      }}
    >
      <label htmlFor="dm-reply" className="sr-only">Resposta</label>
      <Textarea
        id="dm-reply"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) {
            e.preventDefault();
            submit();
          }
        }}
        maxLength={1000}
        placeholder="Escreva a resposta…"
        disabled={pending}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{closesLabel}</p>
        <Button type="submit" size="sm" disabled={pending || !text.trim()}>
          <Send className="size-3.5" aria-hidden /> {pending ? 'A enviar…' : 'Enviar'}
        </Button>
      </div>
    </form>
  );
}
