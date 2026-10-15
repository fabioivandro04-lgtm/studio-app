import { Camera, Music2, Play } from 'lucide-react';
import type { Platform } from '@/lib/platforms/types';
import { cn } from '@/lib/utils';

const STYLE: Record<Platform, { icon: typeof Camera; className: string }> = {
  instagram: { icon: Camera, className: 'bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]' },
  tiktok: { icon: Music2, className: 'bg-black' },
  youtube: { icon: Play, className: 'bg-[#FF0000]' },
};

/** Ícone simples e reconhecível de cada rede (quadrado com a cor da rede). */
export function PlatformIcon({ platform, size = 'md', className }: { platform: Platform; size?: 'sm' | 'md'; className?: string }) {
  const { icon: Icon, className: bg } = STYLE[platform];
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center text-white', size === 'sm' ? 'size-4 rounded' : 'size-6 rounded-md', bg, className)}
    >
      <Icon className={size === 'sm' ? 'size-2.5' : 'size-3.5'} strokeWidth={2.5} />
    </span>
  );
}
