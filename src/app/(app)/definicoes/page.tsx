import { CalendarClock, ChevronRight, KeyRound, Link2, Palette, ScrollText, Sparkles } from 'lucide-react';
import Link from 'next/link';

const LINKS = [
  { href: '/definicoes/marcas', label: 'Marcas', desc: 'Nome, cor, fuso, contexto e voz de cada marca', icon: Palette },
  { href: '/definicoes/contas', label: 'Contas ligadas', desc: 'Instagram, TikTok e YouTube', icon: Link2 },
  { href: '/definicoes/ia', label: 'IA', desc: 'Motor, limite mensal e gastos', icon: Sparkles },
  { href: '/definicoes/prazos', label: 'Prazos', desc: 'Datas importantes que aparecem no calendário', icon: CalendarClock },
  { href: '/definicoes/registo', label: 'Registo de atividade', desc: 'Publicações, erros e avisos', icon: ScrollText },
  { href: '/definicoes/conta', label: 'A minha conta', desc: 'Mudar a palavra-passe', icon: KeyRound },
];

export default function DefinicoesPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Definições</h1>
      <ul className="divide-y rounded-xl border">
        {LINKS.map(({ href, label, desc, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-accent">
              <Icon className="size-5 text-brand-navy" aria-hidden />
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
