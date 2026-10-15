'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { reschedule } from '@/app/(app)/calendario/actions';
import { POST_STATUS_CLASS, POST_STATUS_LABEL } from '@/lib/calendar/status';
import { PLATFORM_LABEL, type Platform, type PostStatus } from '@/lib/platforms/types';
import { cn } from '@/lib/utils';

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
}
export interface CalendarDeadline { id: string; day: string; title: string; brandColor: string }

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const PLATFORM_SHORT: Record<Platform, string> = { instagram: 'IG', tiktok: 'TT', youtube: 'YT' };

function PostCard({ p }: { p: CalendarPost }) {
  return (
    <Link
      href={`/posts/${p.id}`}
      draggable={p.movable}
      onDragStart={(e) => e.dataTransfer.setData('text/post-id', p.id)}
      data-testid="post-card"
      className="block rounded-md border-l-4 bg-background p-1.5 text-xs shadow-sm hover:bg-accent"
      style={{ borderLeftColor: p.brandColor }}
      title={`${p.brandName} · ${p.platforms.map((x) => PLATFORM_LABEL[x]).join(', ')}`}
    >
      <div className="flex items-center gap-1.5">
        {p.thumbUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumbUrl} alt="" className="size-7 shrink-0 rounded object-cover" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium">
            {p.time} {p.title || 'Sem título'}
          </p>
          <p className="text-[10px] text-muted-foreground">{p.platforms.map((x) => PLATFORM_SHORT[x]).join(' · ')}</p>
        </div>
      </div>
      <span className={cn('mt-1 inline-block rounded px-1 text-[10px]', POST_STATUS_CLASS[p.status])}>{POST_STATUS_LABEL[p.status]}</span>
    </Link>
  );
}

export function CalendarView({ weeks, month, today, posts, deadlines }: {
  weeks: string[][];
  month: number | null;
  today: string;
  posts: CalendarPost[];
  deadlines: CalendarDeadline[];
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
      <div className="grid min-w-[720px] grid-cols-7 border-l border-t">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-b border-r bg-muted px-2 py-1 text-xs font-medium">{d}</div>
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
              className={cn('min-h-28 space-y-1 border-b border-r p-1', !inMonth && 'bg-muted/40 text-muted-foreground', month == null && 'min-h-64')}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-xs', day === today && 'rounded-full bg-brand-navy px-1.5 text-white')}>{Number(day.slice(8))}</span>
                <Link href={`/posts/novo?data=${day}`} className="text-xs text-muted-foreground opacity-0 hover:opacity-100 focus:opacity-100" aria-label={`Novo post em ${day}`}>+</Link>
              </div>
              {dayDeadlines.map((d) => (
                <p key={d.id} data-testid="deadline-chip" className="truncate rounded bg-brand-amber/25 px-1 text-[11px] font-medium text-brand-navy" title={d.title}>
                  ⏰ {d.title}
                </p>
              ))}
              {dayPosts.map((p) => <PostCard key={p.id} p={p} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
