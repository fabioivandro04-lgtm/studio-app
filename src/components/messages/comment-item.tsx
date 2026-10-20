'use client';

import { EyeOff, Eye, MessageSquareReply, Send, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { hideComment, replyToComment, suggestCommentReply } from '@/app/(app)/mensagens/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { callSafely } from '@/lib/ai/call-safely';
import { cn } from '@/lib/utils';

export interface CommentView {
  id: string;
  username: string;
  text: string;
  when: string;
  hidden: boolean;
  answered: boolean;
  replies: { id: string; username: string; text: string; when: string; fromBusiness: boolean }[];
}

/** Um comentário: respostas, responder (com sugestão da IA) e esconder. */
export function CommentItem({ accountId, comment }: { accountId: string; comment: CommentView }) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [pending, start] = useTransition();
  const [suggesting, startSuggest] = useTransition();

  const suggest = (quiet: boolean) =>
    startSuggest(async () => {
      const r = await callSafely(() => suggestCommentReply({ accountId, commentId: comment.id }));
      if (r.ok) setText((cur) => (cur.trim() && quiet ? cur : r.text));
      else if (!quiet) toast.error(r.error);
    });

  const openReply = () => {
    setReplying(true);
    if (!text.trim()) suggest(true);
  };

  const send = () =>
    start(async () => {
      const r = await callSafely(() => replyToComment({ accountId, commentId: comment.id, text }));
      if (r.ok) {
        setText('');
        setReplying(false);
        toast.success('Resposta publicada.');
        router.refresh();
      } else toast.error(r.error);
    });

  const toggleHidden = () =>
    start(async () => {
      const r = await callSafely(() => hideComment({ accountId, commentId: comment.id, hide: !comment.hidden }));
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });

  return (
    <li className={cn('space-y-2 rounded-lg border bg-card px-3 py-2', comment.hidden && 'opacity-60')}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <a href={`https://instagram.com/${comment.username}`} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline">@{comment.username}</a>
        <span className="text-[11px] text-muted-foreground">{comment.when}</span>
        {comment.answered && <span className="text-[11px] text-success">· Respondido</span>}
        {comment.hidden && <span className="text-[11px] text-muted-foreground">· Escondido</span>}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{comment.text}</p>
      {comment.replies.length > 0 && (
        <ul className="space-y-1 border-l-2 pl-3">
          {comment.replies.map((r) => (
            <li key={r.id} className="text-sm">
              <span className={cn('font-medium', r.fromBusiness && 'text-primary')}>@{r.username}</span> {r.text}
              <span className="ml-1 text-[11px] text-muted-foreground">{r.when}</span>
            </li>
          ))}
        </ul>
      )}
      {replying ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) send();
          }}
        >
          <label htmlFor={`reply-${comment.id}`} className="sr-only">Resposta a @{comment.username}</label>
          <Textarea
            id={`reply-${comment.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2200}
            placeholder={suggesting ? 'A IA está a escrever uma resposta…' : `Responder a @${comment.username}…`}
            disabled={pending}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setReplying(false)} disabled={pending}>Cancelar</Button>
            <Button type="button" variant="outline" size="sm" disabled={pending || suggesting} onClick={() => suggest(false)}>
              <Sparkles className="size-3.5" aria-hidden /> {suggesting ? 'A escrever…' : 'Outra sugestão'}
            </Button>
            <Button type="submit" size="sm" disabled={pending || suggesting || !text.trim()}>
              <Send className="size-3.5" aria-hidden /> {pending ? 'A publicar…' : 'Responder'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="xs" onClick={openReply} disabled={pending}>
            <MessageSquareReply aria-hidden /> Responder
          </Button>
          <Button type="button" variant="ghost" size="xs" onClick={toggleHidden} disabled={pending} title="Esconder: deixa de aparecer para os outros, mas a pessoa continua a vê-lo.">
            {comment.hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />} {comment.hidden ? 'Mostrar' : 'Esconder'}
          </Button>
        </div>
      )}
    </li>
  );
}
