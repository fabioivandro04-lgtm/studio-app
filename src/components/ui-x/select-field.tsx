'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface SelectOption { value: string; label: string }

/** Lista de escolha com o estilo da app (substitui o <select> nativo). */
export function SelectField({ id, value, onChange, options, disabled, className, placeholder, ...aria }: {
  id?: string;
  value: string;
  onChange(v: string): void;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={aria['aria-label']} className={cn('h-10 w-full bg-card', className)}>
        <SelectValue placeholder={placeholder ?? 'Escolher'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
