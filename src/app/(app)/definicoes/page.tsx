import { Bot, CalendarClock, CalendarX, ChevronRight, KeyRound, Link2, Palette, ScrollText, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui-x/page-header';

const LINKS = [
  { href: '/definicoes/marcas', label: 'Marcas', desc: 'Nome, cor, fuso, contexto e voz de cada marca', icon: Palette },
  { href: '/definicoes/contas', label: 'Contas ligadas', desc: 'Instagram, TikTok e YouTube', icon: Link2 },
  { href: '/definicoes/ligacoes', label: 'Ligações do Claude', desc: 'Claude no claude.ai e no Claude Code', icon: Bot },
  { href: '/definicoes/ia', label: 'IA', desc: 'Motor, limite mensal e gastos', icon: Sparkles },
  { href: '/definicoes/prazos', label: 'Prazos', desc: 'Datas importantes que aparecem no calendário', icon: CalendarClock },
  { href: '/definicoes/limpar', label: 'Limpar calendário', desc: 'Apagar rascunhos e agendados para recomeçar', icon: CalendarX },
  { href: '/definicoes/registo', label: 'Registo de atividade', desc: 'Publicações, erros e avisos', icon: ScrollText },
  { href: '/definicoes/conta', label: 'A minha conta', desc: 'Mudar a palavra-passe', icon: KeyRound },
];

export default function DefinicoesPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Definições" description="Marcas, contas, IA e a sua conta." />
      <ul className="mt-4 divide-y rounded-xl border bg-card shadow-xs">
        {LINKS.map(({ href, label, desc, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
              <Icon className="size-5 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-sm text-muted-foreground">{desc}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
