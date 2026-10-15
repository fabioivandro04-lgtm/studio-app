import Link from 'next/link';
import { PLATFORM_LABEL, type Platform } from '@/lib/platforms/types';

export function ReauthBanner({ accounts }: { accounts: { id: string; platform: Platform; handle: string; status_message: string | null }[] }) {
  if (accounts.length === 0) return null;
  return (
    <div role="alert" className="border-b border-border bg-highlight px-4 py-2 text-sm text-highlight-foreground">
      {accounts.map((a) => (
        <p key={a.id} className="flex flex-wrap items-center gap-2">
          <span>
            Volte a ligar <strong>{PLATFORM_LABEL[a.platform]} @{a.handle.replace(/^@/, '')}</strong> — os posts desta conta estão em espera.
          </span>
          <Link href={`/api/oauth/${a.platform}/start?conta=${a.id}`} className="font-medium underline">
            Voltar a ligar
          </Link>
        </p>
      ))}
    </div>
  );
}
