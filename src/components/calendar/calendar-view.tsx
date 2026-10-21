'use client';

import { Bot, CalendarClock, Check, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { reschedule } from '@/app/(app)/calendario/actions';
import { POST_STATUS_DOT, POST_STATUS_LABEL } from '@/lib/calendar/status';
import { PlatformIcon } from '@/components/platform-icon';
import { PLATFORM_LABEL, type Platform, type PostStatus } from '@/lib/platforms/types';
import { cn } from '@/lib/utils';
import { CalendarMobile } from './calendar-mobile';
import { FreeSlot } from './free-slot';
import { useSelection } from './selection';

export interface CalendarPost {
  id: string;
  day: string;
  time: string;
  title: string;
  status: PostStatus;
  brandColor: string;
  brandName: string;
  platforms: Platform[];
  thumbUrl: string | null;
  movable: boolean;
  /** Pode ser apagado a partir do calendário (agendados são cancelados antes). */
  deletable?: boolean;
  byClaude?: boolean;
}
export interface CalendarDeadline { id: string; day: string; title: string; brandColor: string }

export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function PostCard({ p, large = false }: { p: CalendarPost; large?: boolean }) {
  const router = useRouter();
  const sel = useSelection();
  // Pré-carrega o editor quando o dedo ou o rato chega ao cartão: ao clicar já está (quase) pronto.
  const warm = () => router.prefetch(`/posts/${p.id}`, { kind: PrefetchKind.FULL });
  const className = cn(
    'group block w-full rounded-md border bg-card text-left shadow-xs transition hover:border-primary/40 hover:shadow-sm',
    large ? 'p-2.5 text-sm' : 'px-1.5 py-1 text-xs',
    p.status === 'cancelled' && 'opacity-60',
  );
  const title = `${p.brandName} · ${p.platforms.map((x) => PLATFORM_LABEL[x]).join(', ')} · ${POST_STATUS_LABEL[p.status]}${p.byClaude ? ' · Criado pelo Claude' : ''}`;
  if (sel.active) {
    const on = sel.selected.has(p.id);
    return (
      <button
        type="button"
        data-testid="post-card"
        aria-pressed={on}
        disabled={!p.deletable}
        onClick={() => sel.toggle(p.id)}
        className={cn(className, on && 'border-destructive ring-1 ring-destructive', !p.deletable && 'cursor-not-allowed opacity-40')}
        style={{ borderLeft: `3px solid ${p.brandColor}` }}
        title={p.deletable ? title : 'Está a ser publicado: não pode ser apagado agora.'}
      >
        <span className={cn('float-right ml-1 flex size-4 items-center justify-center rounded border', on && 'border-destructive bg-destructive text-white')} aria-hidden>
          {on && <Check className="size-3" />}
        </span>
        <CardBody p={p} large={large} />
      </button>
    );
  }
  return (
    <div className="group/card relative">
      <Link
        href={`/posts/${p.id}`}
        onMouseEnter={warm}
        onTouchStart={warm}
        onFocus={warm}
        draggable={p.movable}
        onDragStart={(e) => e.dataTransfer.setData('text/post-id', p.id)}
        data-testid="post-card"
        className={className}
        style={{ borderLeft: `3px solid ${p.brandColor}` }}
        title={title}
      >
        <CardBody p={p} large={large} />
      </Link>
      {p.deletable && (
        <button
          type="button"
          disabled={sel.pending}
          onClick={() => sel.remove([p.id], `Apagar "${p.title || 'Sem título'}" do Estúdio?${p.status === 'scheduled' ? ' O agendamento é cancelado.' : ''} Não dá para desfazer.`)}
          aria-label={`Apagar ${p.title || 'post'}`}
          className={cn(
            'absolute right-1 top-1 rounded bg-card/90 p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
            large ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover/card:opacity-100',
          )}
        >
          <Trash2 className={large ? 'size-4' : 'size-3'} aria-hidden />
        </button>
      )}
    </div>
  );
}

function CardBody({ p, large }: { p: CalendarPost; large: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {p.thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.thumbUrl} alt="" className={cn('shrink-0 rounded object-cover', large ? 'size-12' : 'size-8')} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold tabular-nums">{p.time}</span>
          <span className={cn('size-1.5 shrink-0 rounded-full', POST_STATUS_DOT[p.status])} aria-hidden />
          <span className={cn('truncate text-muted-foreground', large ? 'text-xs' : 'text-[10px]')}>{POST_STATUS_LABEL[p.status]}</span>
        </div>
        <p className={cn('truncate', large ? 'font-medium' : '')}>{p.title || 'Sem título'}</p>
        <div className="mt-0.5 flex items-center gap-1">
          {p.platforms.map((x) => <PlatformIcon key={x} platform={x} size="sm" />)}
          {p.byClaude && <Bot className="size-3 text-muted-foreground" aria-label="Criado pelo Claude" />}
          {large && <span className="ml-1 truncate text-xs text-muted-foreground">{p.brandName}</span>}
        </div>
      </div>
    </div>
  );
}

export function CalendarView(props: {
  weeks: string[][];
  month: number | null;
  today: string;
  posts: CalendarPost[];
  deadlines: CalendarDeadline[];
  freeSlots: Record<string, string[]>;
}) {
  return (
    <>
      <div className="md:hidden"><CalendarMobile key={props.weeks[0][0]} {...props} /></div>
      <div className="hidden md:block" data-testid="calendar-grid"><CalendarGrid {...props} /></div>
    </>
  );
}

function CalendarGrid({ weeks, month, today, posts, deadlines, freeSlots }: {
  weeks: string[][];
  month: number | null;
  today: string;
  posts: CalendarPost[];
  deadlines: CalendarDeadline[];
  freeSlots: Record<string, string[]>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const drop = (day: string, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/post-id');
    if (!id) return;
    start(async () => {
      const r = await reschedule(id, day);
      if (r.ok) {
        toast.success('Post reagendado.');
        router.refresh();
      } else toast.error(r.error);
    });
  };

  return (
    <div className={cn('overflow-x-auto', pending && 'opacity-60')}>
      <div className="grid min-w-[720px] grid-cols-7 overflow-hidden rounded-lg border bg-card">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
        {weeks.flat().map((day) => {
          const inMonth = month == null || Number(day.slice(5, 7)) === month;
          const dayPosts = posts.filter((p) => p.day === day).sort((a, b) => a.time.localeCompare(b.time));
          const dayDeadlines = deadlines.filter((d) => d.day === day);
          return (
            <div
              key={day}
              data-day={day}
              aria-label={`Dia ${day}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => drop(day, e)}
              className={cn('group/day min-h-28 space-y-1 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-muted/50 text-muted-foreground', month == null && 'min-h-72')}
            >
              <div className="flex items-center justify-between">
                <span className={cn('flex size-6 items-center justify-center rounded-full text-xs tabular-nums', day === today && 'bg-primary font-semibold text-primary-foreground')}>{Number(day.slice(8))}</span>
                <Link href={`/posts/novo?data=${day}`} className="rounded px-1 text-xs text-muted-foreground opacity-0 hover:bg-accent group-hover/day:opacity-100 focus:opacity-100" aria-label={`Novo post em ${day}`}>+</Link>
              </div>
              {dayDeadlines.map((d) => (
                <p key={d.id} data-testid="deadline-chip" className="truncate rounded bg-highlight px-1 text-[11px] font-medium text-highlight-foreground" title={d.title}>
                  <CalendarClock className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />{d.title}
                </p>
              ))}
              {dayPosts.map((p) => <PostCard key={p.id} p={p} />)}
              {(freeSlots[day] ?? []).map((t) => <FreeSlot key={t} day={day} time={t} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
