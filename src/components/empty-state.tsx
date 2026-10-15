import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

/** Ecrã vazio que explica o que fazer a seguir. */
export function EmptyState({ icon: Icon, title, text, action }: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-10 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-amber/20 text-brand-navy">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && (
        <Link href={action.href} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
          {action.label}
        </Link>
      )}
    </div>
  );
}
