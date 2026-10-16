'use client';

import { CalendarDays } from 'lucide-react';
import { pt } from 'date-fns/locale';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dateToDay, dayToDate, formatDayPt } from '@/lib/ui/datetime';
import { cn } from '@/lib/utils';

/** Escolher um dia (valor AAAA-MM-DD), mostrado em português ("sáb, 17 out 2026"). */
export function DateField({ id, value, onChange, disabled, placeholder = 'Escolher dia', className, ...aria }: {
  id?: string;
  value: string;
  onChange(v: string): void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" data-value={value} disabled={disabled} aria-label={aria['aria-label']} className={cn('h-10 w-full justify-start gap-2 bg-card font-normal', !value && 'text-muted-foreground', className)}>
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          {value ? formatDayPt(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={pt}
          weekStartsOn={1}
          selected={value ? dayToDate(value) : undefined}
          defaultMonth={value ? dayToDate(value) : undefined}
          onSelect={(d) => {
            if (d) onChange(dateToDay(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
