# Estúdio

App pessoal para organizar, agendar, publicar e medir conteúdo em Instagram, TikTok e YouTube Shorts,
com várias marcas.

- Especificação: `docs/superpowers/specs/2026-10-15-estudio-design.md`
- Configuração (Supabase, Vercel, Meta, TikTok, Google, OpenRouter): `docs/SETUP.md`
- Assistente de IA: `docs/superpowers/specs/2026-10-15-assistente-ia-design.md`
- Ideias e plano com IA: `docs/superpowers/specs/2026-10-16-ideias-ia-design.md`
- Mais rápido e fluido (duplicar, grupos de hashtags, horários fixos, mover): `docs/superpowers/specs/2026-10-17-mais-rapido-design.md`

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencher; PLATFORM_MODE=fake não contacta as redes
npm run dev                  # http://localhost:3000
```

## Testes

```bash
npm test            # unitários (Vitest)
npm run test:db     # base de dados: Postgres 16 local temporário (precisa de /usr/lib/postgresql/16/bin)
npm run e2e         # ponta a ponta (Playwright) contra o Supabase de .env.local, com PLATFORM_MODE=fake
npm run typecheck && npm run lint && npm run build
```

Os testes e2e precisam em `.env.local` de `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
`NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN=true` e de um utilizador de teste (`E2E_EMAIL`, `E2E_PASSWORD`)
registado em `app_owner`.

## Estrutura

- `src/lib/platforms/*` — um adaptador por rede (validação, publicação, OAuth, métricas)
- `src/lib/publishing/tick.ts` — motor de publicação (máquina de estados, um passo por minuto)
- `src/lib/metrics/sync.ts` — recolha diária de métricas
- `src/lib/ai/*` — assistente de IA (OpenRouter, prompts pt-PT, limite mensal, melhor hora, ideias e datas do plano)
- `src/app/(app)/ideias` — página Ideias (gerar, pôr no calendário, descartar)
- `src/lib/schedule/slots.ts` — horários fixos (próximo horário livre, horários livres da semana)
- `src/app/api/cron/*` — rotas chamadas pelo pg_cron do Supabase
- `supabase/migrations` — esquema, segurança (RLS) e funções
