# Estúdio — Ideias e plano de conteúdo com IA (design)

Data: 2026-10-16 · Estado: aprovado em conversa (o dono pediu para avançar direto para plano e construção)

Subprojeto 2 de 3 (1. Assistente IA no post ✓ → **2. Ideias e plano com IA** → 3. Mais rápido e fluido).

## 1. Objetivo
Ajudar o dono a decidir **o que** publicar: sequências de posts antes dos prazos das universidades
(Unidreamity), ideias de vídeos curtos (marca de shorts) e o plano da próxima semana.

O que o dono escolheu:
- Frequência: Unidreamity **3/semana**, Shorts **5/semana** (campo por marca, editável).
- As ideias ficam numa **página "Ideias" à parte**; daí vão para o calendário com um toque.
- A IA só gera **quando o dono pede** (sem tarefas automáticas).

Sucesso quando:
1. "Ideias para um prazo" devolve até 5 ideias datadas antes do prazo, coerentes com o contexto/voz da marca.
2. "Ideias de vídeos curtos" devolve 10 ideias com gancho e guião, sem repetir títulos recentes.
3. "Planear a próxima semana" cria exatamente as ideias que faltam para atingir os posts/semana da marca.
4. "Pôr no calendário" cria um rascunho no dia/hora sugeridos e abre-o no criador de posts.
5. Datas e horas são calculadas pela app (nunca inventadas pela IA). Custos dentro do limite mensal já existente.

Fora de âmbito: geração automática semanal, notificações, geração de imagens/vídeos.

## 2. Experiência
### 2.1 Navegação
Novo item **"Ideias"** (ícone lâmpada) no menu, logo a seguir a "Calendário". Respeita o seletor de marca global
(com "Todas as marcas", os botões de geração pedem para escolher uma marca primeiro).

### 2.2 Página /ideias
- Botões (marca selecionada):
  1. **"💡 Ideias para um prazo"** → escolher um prazo futuro da marca (lista dos próximos prazos) → gerar.
  2. **"🎬 Ideias de vídeos curtos"** → gerar 10.
  3. **"🗓️ Planear a próxima semana"** → gerar as que faltam.
- Separadores **Novas / Usadas / Descartadas** (contadores).
- Cartão de ideia: título; gancho; guião (pontos curtos); legenda de rascunho (recolhível); formato sugerido;
  ícones das redes; data e hora sugeridas (ou "sem data"); "Prazo: <título>" quando aplicável.
  Ações: **"Pôr no calendário"**, **"Copiar guião"**, **"Descartar"** (nas descartadas: **"Recuperar"**).
  Nas usadas: **"Abrir post"**.
- Estado vazio explica os três botões.

### 2.3 Definições → Marcas
Na secção "Assistente de IA": campo **"Posts por semana"** (1–21; por omissão 3).

## 3. Regras de datas (sem IA)
- **Prazo**: desvios −28, −21, −14, −7, 0 dias em relação a `due_date`; mantêm-se só datas ≥ hoje no fuso da
  marca; quantidade = nº de datas que restam (mín. 1: se todas passaram mas o prazo é hoje/futuro, usa hoje).
  Prazo já passado → erro "Este prazo já passou."
- **Semana**: próxima segunda a domingo (fuso da marca). Em falta = `posts_per_week` − posts da marca nessa
  semana com estado ≠ cancelado e ideias novas com data nessa semana. ≤ 0 → erro "A próxima semana já está
  completa." Dias espalhados: índice `floor(i * 7 / N)` (seg = 0).
- **Vídeos curtos**: 10 ideias sem data.
- **Hora de um dia**: a melhor faixa do histórico para esse dia da semana (se ≥ 10 posts com métricas, como em
  `best-time`), senão a hora de `INITIAL_TIMES[goal][dia]` mais próxima das 19:00. Evita ±2 h de posts já
  agendados da marca escolhendo a próxima hora da tabela desse dia; se nenhuma servir, mantém a escolhida.
- "Pôr no calendário" de uma ideia sem data (ou com data já passada) usa a 1.ª sugestão de `suggestSlots`.

## 4. Arquitetura
### 4.1 Dados (migração `0011_ideas.sql`)
- `brands.posts_per_week int not null default 3 check (between 1 and 21)`.
- `ideas`: `id`, `brand_id → brands on delete cascade`, `deadline_id → deadlines on delete set null`,
  `kind text check in ('deadline','shorts','week')`, `title text check (length ≤ 120)`, `hook text (≤ 300)`,
  `outline text (≤ 1500)`, `caption text (≤ 2200)`, `format text null` (um TargetFormat), `platforms text[]`,
  `suggested_at timestamptz null`, `status text default 'new' check in ('new','used','discarded')`,
  `post_id → posts on delete set null`, `created_at`. Índice (brand_id, status). RLS `owner_all`.
- `ai_usage.kind` passa a aceitar também `'ideas'`.

### 4.2 Módulos
- `src/lib/ai/ideas-schema.ts`: `IdeasSpec` (`{ ideas: { title, hook, outline, caption, format, platforms }[] }`,
  JSON Schema estrito; `format` ∈ TargetFormat; `platforms` ⊆ Platform), `postprocessIdeas(raw, { count, platforms })`
  (corta tamanhos, remove ideias sem título, filtra redes/formatos inválidos, limita a `count`).
- `src/lib/ai/ideas-prompts.ts`: `buildIdeasMessages({ brand, mode, count, deadline?, upcomingDeadlines,
  recentTitles, platforms })` — reutiliza a mensagem de sistema do assistente (pt-PT, contexto, voz, objetivo).
- `src/lib/ai/plan-dates.ts` (puro): `deadlineDates`, `nextWeekRange`, `spreadWeek`, `timeForDate`.
- `src/lib/ai/service.ts`: `runIdeas(deps, input)` (orçamento, chamada, registo `kind: 'ideas'`, pós-processamento;
  0 ideias → `invalid_response`). `max_tokens` 3000.
- `src/lib/db/repo/ideas-repo.ts`: listar, inserir lote, mudar estado, contar semana, títulos recentes.
- `src/app/(app)/ideias/actions.ts`: `generateDeadlineIdeas`, `generateShortsIdeas`, `planNextWeek`,
  `ideaToDraft`, `setIdeaStatus`. Validação zod das entradas; erros como no assistente.
- UI: `src/app/(app)/ideias/page.tsx`, `src/components/ideas/*`; item no `app-nav.tsx`.
- Fornecedor falso: responde a `spec.name === 'ideas'` com N ideias fixas (N lido do pedido).

### 4.3 "Pôr no calendário"
`ideaToDraft(ideaId)`: lê a ideia (RLS), escolhe a data (ideia ou `suggestSlots`), cria rascunho via `save_post`
(`intent: 'draft'`, sem mídia; destinos = contas **ativas** da marca nas redes da ideia, formato da ideia se for
dessa rede senão `defaultFormat`, legenda = rascunho da ideia, título YouTube = título da ideia), marca a ideia
`used` com `post_id`, e devolve o id → a UI abre `/posts/<id>`.

## 5. Erros (pt-PT)
Os do assistente (sem chave, limite, IA ocupada, resposta inesperada) e ainda: "Escolha uma marca primeiro.",
"Este prazo já passou.", "A próxima semana já está completa.", "Ideia não encontrada.".

## 6. Testes
- Unidade: `plan-dates` (desvios, prazos próximos/passados, semana e espalhamento, fuso, hora sem/com histórico,
  evitar ocupados), `ideas-schema` (cortes, redes/formatos inválidos, limite), `ideas-prompts` (modo, prazo,
  títulos recentes, contagem), `runIdeas` (orçamento, registo, vazio).
- Base de dados: tabela `ideas` (defaults, checks, RLS, cascatas), `posts_per_week`, `ai_usage` aceita `ideas`.
- E2E (IA falsa): gerar vídeos curtos → descartar/recuperar; planear semana → pôr no calendário abre rascunho.
- Verificação no browser + um pedido real no fim; revisão independente antes de publicar.
