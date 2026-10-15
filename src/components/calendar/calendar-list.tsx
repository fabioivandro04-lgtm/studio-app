'use client';

import { CalendarClock } from 'lucide-react';
import { FreeSlot } from './free-slot';
import { MovePost } from './move-post';
import { PostCard, type CalendarDeadline, type CalendarPost } from './calendar-view';

const dayLabel = (d: string) => {
  const s = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Vista Lista: os próximos dias com posts, prazos ou horários livres, por ordem. */
export function CalendarList({ days, today, posts, deadlines, freeSlots }: {
  days: string[];
  today: string;
  posts: CalendarPost[];
  deadlines: CalendarDeadline[];
  freeSlots: Record<string, string[]>;
}) {
  const busy = days.filter((d) => posts.some((p) => p.day === d) || deadlines.some((x) => x.day === d) || (freeSlots[d] ?? []).length);
  if (busy.length === 0) {
    return <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">Nada marcado nos próximos 30 dias.</p>;
  }
  return (
    <ol className="space-y-5" data-testid="calendar-list">
      {busy.map((d) => (
        <li key={d} className="space-y-2">
          <h2 className="text-sm font-semibold">
            {dayLabel(d)}
            {d === today && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">Hoje</span>}
          </h2>
          {deadlines.filter((x) => x.day === d).map((x) => (
            <p key={x.id} className="rounded-md bg-highlight px-2 py-1.5 text-sm font-medium text-highlight-foreground">
              <CalendarClock className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />{x.title}
            </p>
          ))}
          {posts.filter((p) => p.day === d).sort((a, b) => a.time.localeCompare(b.time)).map((p) => (
            <div key={p.id} className="space-y-1">
              <PostCard p={p} large />
              {p.movable && <MovePost postId={p.id} day={p.day} title={p.title} />}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {(freeSlots[d] ?? []).map((t) => <FreeSlot key={t} day={d} time={t} large />)}
          </div>
        </li>
      ))}
    </ol>
  );
}
