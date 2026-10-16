'use client';

import { KeyRound, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { signOut } from '@/app/login/actions';

/** Menu da conta no cabeçalho: "A minha conta" e "Sair". */
export function AccountMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Conta" className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          <UserRound className="size-5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/definicoes/conta"><KeyRound className="size-4" aria-hidden />A minha conta</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut className="size-4" aria-hidden />Sair</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
