import { ArrowLeft, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { RefreshButton } from '@/components/messages/refresh-button';
import { CommentItem } from '@/components/messages/comment-item';
import { ReplyBox } from '@/components/messages/reply-box';
import { PageHeader } from '@/components/ui-x/page-header';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { listInboxAccounts, loadComments, loadConversation, loadInbox, type Inbox } from '@/lib/messages/inbox';
import type { DmMessage } from '@/lib/messages/types';
import { replyWindow } from '@/lib/messages/window';
import { formatInZone } from '@/lib/time/zone';
import { cn } from '@/lib/utils';

const DEFAULT_TZ = 'Africa/Maputo';

function when(d: Date, tz: string, now: Date): string {
  const sameDay = formatInZone(d, tz, 'yyyy-MM-dd') === formatInZone(now, tz, 'yyyy-MM-dd');
  return formatInZone(d, tz, sameDay ? 'HH:mm' : "d MMM 'às' HH:mm");
}

function preview(m: DmMessage | null): string {
  if (!m) return '';
  const who = m.fromBusiness ? 'Você: ' : '';
  if (m.text) return who + m.text;
  if (m.story === 'mention') return `${who}Mencionou-o numa story`;
  if (m.attachments.length) return `${who}Enviou um anexo`;
  return `${who}Mensagem que a app não consegue mostrar`;
}

function Bubble({ m, tz, now }: { m: DmMessage; tz: string; now: Date }) {
  return (
    <li className={cn('flex flex-col', m.fromBusiness ? 'items-end' : 'items-start')}>
      <div className={cn('max-w-[85%] space-y-1 rounded-2xl px-3 py-2 text-sm', m.fromBusiness ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
        {m.story && <p className="text-xs opacity-75">{m.story === 'reply' ? 'Respondeu à sua story' : 'Mencionou-o numa story'}</p>}
        {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
        {m.attachments.map((a) =>
          a.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={a.url} src={a.url} alt="Imagem enviada" className="max-h-60 rounded-lg" />
          ) : (
            <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="block underline">
              {a.kind === 'video' ? 'Ver vídeo' : 'Abrir anexo'}
            </a>
          ),
        )}
        {!m.text && !m.attachments.length && !m.story && (
          <p className="italic opacity-75">{m.unsupported ? 'Conteúdo que a app não consegue mostrar (veja no Instagram).' : 'Mensagem sem texto.'}</p>
        )}
      </div>
      <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">{when(m.createdAt, tz, now)}</span>
    </li>
  );
}

export default async function MensagensPage({ searchParams }: { searchParams: Promise<{ conta?: string; c?: string; vista?: string }> }) {
  const sp = await searchParams;
  const tab = sp.vista === 'comentarios' ? 'comments' : 'dms';
  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);
  const accounts = await listInboxAccounts(db, brandId);
  const now = new Date();
  const tzOf = (accountId: string) => brands.find((b) => b.id === accounts.find((a) => a.id === accountId)?.brandId)?.timezone ?? DEFAULT_TZ;
  const showHandle = accounts.length > 1;

  const errors = (list: Inbox['errors']) =>
    list.map((e) => (
      <p key={e.handle} role="alert" className="rounded-lg bg-highlight px-3 py-2 text-sm text-highlight-foreground">
        @{e.handle}: {e.message}
      </p>
    ));

  const tabs = (
    <nav aria-label="Vista" className="flex h-9 w-fit rounded-md border bg-card p-0.5 text-sm">
      {([['dms', '/mensagens', 'Mensagens'], ['comments', '/mensagens?vista=comentarios', 'Comentários']] as const).map(([key, href, label]) => (
        <Link key={key} href={href} aria-current={tab === key ? 'page' : undefined} className={cn('flex items-center rounded px-3', tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>
          {label}
        </Link>
      ))}
    </nav>
  );

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader title="Mensagens" description="Mensagens diretas e comentários do Instagram." />
        <EmptyState
          icon={MessageCircle}
          title="Nenhum Instagram ligado"
          text={brandId ? 'Esta marca ainda não tem uma conta de Instagram ligada.' : 'Ligue uma conta de Instagram para ver as mensagens e os comentários dos clientes.'}
          action={{ href: '/definicoes/contas', label: 'Ligar conta' }}
        />
      </div>
    );
  }

  const header = (
    <PageHeader
      title="Mensagens"
      description="Mensagens diretas e comentários do Instagram, com respostas sugeridas pela IA. O TikTok não permite ler mensagens a partir da Europa."
      actions={<>{tabs}<RefreshButton /></>}
    />
  );

  if (tab === 'comments') {
    const { posts, errors: errs } = await loadComments(db, accounts);
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        {errors(errs)}
        {posts.length === 0 && errs.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Não há comentários nos últimos posts.</p>
        )}
        {posts.map((p) => {
          const tz = tzOf(p.accountId);
          const open = p.comments.filter((c) => !c.answered && !c.hidden).length;
          return (
            <section key={`${p.accountId}:${p.id}`} aria-label={`Comentários do post ${p.caption.slice(0, 40)}`} className="space-y-2">
              <div className="flex items-center gap-3">
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnailUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="size-12 shrink-0 rounded-md bg-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.caption || 'Post sem legenda'}</p>
                  <p className="text-xs text-muted-foreground">
                    {when(p.createdAt, tz, now)}{showHandle && ` · @${p.accountHandle}`}
                    {open > 0 ? ` · ${open} por responder` : ' · tudo respondido'}
                    {p.permalink && <> · <a href={p.permalink} target="_blank" rel="noreferrer" className="underline">abrir</a></>}
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {p.comments.map((c) => (
                  <CommentItem
                    key={c.id}
                    accountId={p.accountId}
                    comment={{
                      id: c.id, username: c.username, text: c.text, when: when(c.createdAt, tz, now), hidden: c.hidden, answered: c.answered,
                      replies: c.replies.map((r) => ({ id: r.id, username: r.username, text: r.text, when: when(r.createdAt, tz, now), fromBusiness: r.fromBusiness })),
                    }}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
  }

  const inbox = await loadInbox(db, accounts);
  const selected = sp.conta && sp.c && accounts.some((a) => a.id === sp.conta) ? { accountId: sp.conta, id: sp.c } : null;
  const opened = selected ? await loadConversation(db, selected.accountId, selected.id) : null;
  const tz = selected ? tzOf(selected.accountId) : DEFAULT_TZ;
  const win = opened?.ok ? replyWindow(opened.conversation.messages, now) : null;
  const lastFromCustomer = opened?.ok ? opened.conversation.messages.at(-1)?.fromBusiness === false : false;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {header}
      {errors(inbox.errors)}
      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <section aria-label="Conversas" className={cn('space-y-1', selected && 'hidden md:block')}>
          {inbox.conversations.length === 0 && inbox.errors.length === 0 && (
            <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Ainda não há conversas.</p>
          )}
          <ul className="space-y-1">
            {inbox.conversations.map((c) => {
              const active = selected?.accountId === c.accountId && selected.id === c.id;
              return (
                <li key={`${c.accountId}:${c.id}`}>
                  <Link
                    href={`/mensagens?conta=${c.accountId}&c=${encodeURIComponent(c.id)}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn('block rounded-lg border px-3 py-2 transition-colors', active ? 'border-primary bg-accent' : 'bg-card hover:bg-muted')}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">@{c.customer.username}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{when(c.updatedAt, tzOf(c.accountId), now)}</span>
                    </div>
                    <p className={cn('truncate text-xs', c.last && !c.last.fromBusiness ? 'font-medium text-foreground' : 'text-muted-foreground')}>{preview(c.last)}</p>
                    {showHandle && <p className="text-[11px] text-muted-foreground">para @{c.accountHandle}</p>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Conversa" className={cn('min-w-0 rounded-xl border bg-card p-4', !selected && 'hidden md:block')}>
          {!selected && <p className="py-10 text-center text-sm text-muted-foreground">Escolha uma conversa para ler e responder.</p>}
          {opened && !opened.ok && <p role="alert" className="text-sm text-destructive">{opened.error}</p>}
          {opened?.ok && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <Link href="/mensagens" className="md:hidden" aria-label="Voltar às conversas"><ArrowLeft className="size-4" /></Link>
                <a href={`https://instagram.com/${opened.conversation.customer.username}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  @{opened.conversation.customer.username}
                </a>
              </div>
              <ul className="space-y-3">
                {opened.conversation.messages.map((m) => <Bubble key={m.id} m={m} tz={tz} now={now} />)}
              </ul>
              <ReplyBox
                key={opened.conversation.id}
                accountId={selected!.accountId}
                conversationId={opened.conversation.id}
                open={!!win?.open}
                closesLabel={win?.closesAt ? `Pode responder até ${when(win.closesAt, tz, now)}.` : null}
                autoSuggest={lastFromCustomer}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
