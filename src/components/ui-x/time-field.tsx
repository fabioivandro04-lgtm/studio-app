'use client';

import { Clock } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { normalizeTime, TIME_OPTIONS } from '@/lib/ui/datetime';
import { cn } from '@/lib/utils';

/** Hora em 24 h (HH:MM): escreve-se à mão ou escolhe-se da lista (a cada 30 min). */
export function TimeField({ id, value, onChange, disabled, className, ...aria }: {
  id?: string;
  value: string;
  onChange(v: string): void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  // Valor mudou por fora (ex.: "Melhor hora"): atualiza o texto durante o render.
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(value);
    setInvalid(false);
  }

  const commit = () => {
    const n = normalizeTime(text);
    if (n) {
      setInvalid(false);
      if (n !== value) onChange(n);
      setText(n);
    } else {
      setInvalid(text.trim() !== '');
      setText(value);
    }
  };

  return (
    <div className={cn('space-y-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Clock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id={id}
              aria-label={aria['aria-label']}
              inputMode="numeric"
              placeholder="HH:MM"
              disabled={disabled}
              value={text}
              maxLength={5}
              onFocus={() => setOpen(true)}
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit();
                  setOpen(false);
                }
              }}
              className="h-10 bg-card pl-9 tabular-nums"
              aria-invalid={invalid || undefined}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent className="max-h-64 w-36 overflow-y-auto p-1" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
          {TIME_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setInvalid(false);
                setText(t);
                onChange(t);
                setOpen(false);
              }}
              className={cn('block w-full rounded px-2 py-1.5 text-left text-sm tabular-nums hover:bg-accent', t === value && 'bg-accent font-medium')}
            >
              {t}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {invalid && <p role="alert" className="text-xs text-destructive">Hora inválida.</p>}
    </div>
  );
}
