'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MovePost } from './move-post';
import { PostCard, WEEKDAYS, type CalendarDeadline, type CalendarPost } from './calendar-view';

/** Calendário para telemóvel: grelha pequena com pontos + lista do dia escolhido. */
export function CalendarMobile({ weeks, month, today, posts, deadlines }: {
  weeks: string[][];
  month: number | null;
  today: string;
  posts: CalendarPost[];
  deadlines: CalendarDeadline[];
}) {
  const days = weeks.flat();
  const firstInRange = days.find((d) => month == null || Number(d.slice(5, 7)) === month) ?? days[0];
  const firstBusy = days.find((d) => posts.some((p) => p.day === d) || deadlines.some((x) => x.day === d));
  const [selected, setSelected] = useState(days.includes(today) ? today : (firstBusy ?? firstInRange));

  const dayPosts = posts.filter((p) => p.day === selected).sort((a, b) => a.time.localeCompare(b.time));
  const dayDeadlines = deadlines.filter((d) => d.day === selected);
  const label = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${selected}T12:00:00Z`),
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[11px] font-medium text-muted-foreground">{d[0]}</span>
        ))}
        {days.map((day) => {
          const inMonth = month == null || Number(day.slice(5, 7)) === month;
          const dots = [
            ...deadlines.filter((d) => d.day === day).map((d) => ({ id: d.id, color: '#F0A93B' })),
            ...posts.filter((p) => p.day === day).map((p) => ({ id: p.id, color: p.brandColor })),
          ];
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(day)}
              aria-pressed={day === selected}
              aria-label={`Dia ${day}`}
              className={cn(
                'flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-sm',
                !inMonth && 'text-muted-foreground/50',
                day === selected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                day === today && day !== selected && 'font-bold text-primary ring-1 ring-brand-navy/40',
              )}
            >
              {Number(day.slice(8))}
              <span className="flex h-1.5 gap-0.5">
                {dots.slice(0, 3).map((d) => (
                  <span key={d.id} className="size-1.5 rounded-full" style={{ background: day === selected ? '#fff' : d.color }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <section aria-label="Posts do dia" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium first-letter:uppercase">{label}</h2>
          <Link href={`/posts/novo?data=${selected}`} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm hover:bg-accent">
            <Plus className="size-4" aria-hidden /> Post
          </Link>
        </div>
        {dayDeadlines.map((d) => (
          <p key={d.id} className="rounded-md bg-highlight px-2 py-1.5 text-sm font-medium text-highlight-foreground">⏰ {d.title}</p>
        ))}
        {dayPosts.map((p) => (
          <div key={p.id} className="space-y-1">
            <PostCard p={p} large />
            {p.movable && <MovePost postId={p.id} day={p.day} title={p.title} />}
          </div>
        ))}
        {dayPosts.length === 0 && dayDeadlines.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Nada marcado para este dia.</p>
        )}
      </section>
    </div>
  );
}
