'use client';

import { Hash } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { HashtagGroup } from '@/lib/db/repo/hashtag-groups-repo';

/** Botão "# Hashtags": junta um grupo da marca a todas as legendas do post. */
export function HashtagGroupsMenu({ groups, onPick }: { groups: HashtagGroup[]; onPick(tags: string[]): void }) {
  if (groups.length === 0) {
    return (
      <Link href="/definicoes/marcas" className="text-xs text-muted-foreground underline">
        Criar grupos de hashtags
      </Link>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Hash className="size-4" aria-hidden /> Hashtags
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {groups.map((g) => (
          <DropdownMenuItem key={g.id} onSelect={() => onPick(g.tags)}>
            <span className="font-medium">{g.name}</span>
            <span className="ml-2 max-w-48 truncate text-xs text-muted-foreground">{g.tags.join(' ')}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
