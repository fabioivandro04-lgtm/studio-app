# Mais rápido e fluido — design

Subprojeto 3 de 3 (1. Assistente IA ✓ → 2. Ideias e plano com IA ✓ → **3. Mais rápido e fluido**).
A ligação ao site da Unidreamity fica para um subprojeto 4, depois deste.

## 1. Objetivo

Menos toques e menos espera no dia a dia: a app responde logo a cada toque, e repetir trabalho (copiar um post,
juntar as mesmas hashtags, escolher a hora habitual, mudar um post de dia no telemóvel) passa a ser um toque.

O que o dono escolheu:
- Incluir: **app mais rápida**, **duplicar post**, **grupos de hashtags**, **horários fixos** e **mover posts no
  telemóvel**. Modelos de legenda ficam de fora.
- Horários fixos usados **em todo o lado**: no post ("Próximo horário livre") e nas Ideias (planear a semana e
  ideias para um prazo).

Critérios de sucesso:
- Ao tocar num item do menu, aparece de imediato um esboço da página (sem ecrã parado).
- O tempo de resposta das páginas principais (calendário, editor de post, ideias) medido antes e depois; o editor
  de post não fica mais lento e as consultas independentes correm em paralelo.
- Cada uma das 4 funcionalidades funciona no telemóvel e no computador.

## 2. App mais rápida

- `src/app/(app)/loading.tsx`: esboço genérico (título + blocos cinzentos com `animate-pulse`). Com ele, o Next
  mostra o esboço logo ao tocar e pré-carrega a "casca" das páginas ligadas no menu.
- `loadComposer`: marcas, contas e biblioteca passam a ser lidas **em paralelo** (hoje são em fila). Também lê os
  grupos de hashtags e os horários fixos (secções 4 e 5) no mesmo lote.
- Medição: script Playwright (fora do repositório) que entra com o utilizador de teste e mede o tempo até a página
  estar visível em `/calendario`, `/posts/novo` e `/ideias`, 3 vezes cada, antes e depois. Resultado no relatório
  final.

## 3. Duplicar post

- A ação `duplicatePost(id)` já existe (cria rascunho "(cópia)" com a mesma mídia, redes, legendas e data) mas não
  tem botão. Novo botão **"Duplicar"** no editor (só em posts já guardados, também quando o post está só de
  leitura, ex.: publicado). Ao tocar: cria a cópia, mostra "Cópia criada." e abre `/posts/<novo id>`.
- Se a data copiada já passou, a cópia fica com a mesma data (é rascunho; o dono escolhe outra).

## 4. Grupos de hashtags

### 4.1 Dados
Tabela `hashtag_groups`: `id uuid pk`, `brand_id → brands on delete cascade`, `name text 1–40`,
`tags text[]` (1–30 hashtags), `created_at`. RLS `owner_all` (como as outras tabelas). Índice por `brand_id`.

### 4.2 Definições
Em **Definições → Marcas**, em cada marca, secção **"Grupos de hashtags"**: lista dos grupos (nome + hashtags),
criar, editar e apagar (com confirmação). As hashtags escrevem-se separadas por espaços ou vírgulas; normalizam-se
com `normalizeHashtag` (acrescenta `#`, sem repetidas). Mensagens: "Dê um nome ao grupo.", "Escreva pelo menos uma
hashtag.", "No máximo 30 hashtags por grupo.", "Hashtag inválida: …".

Ações (`definicoes/actions.ts`): `saveHashtagGroup({ id?, brandId, name, tags })`, `deleteHashtagGroup(id)`.

### 4.3 No post
Botão **"# Hashtags"** na secção das redes (só se a marca tiver grupos; sem grupos, mostra o link "Criar grupos de
hashtags" para Definições → Marcas). Abre um menu com os grupos da marca escolhida. Tocar num grupo junta as
hashtags ao fim de **todas as legendas** do post com `appendHashtags` (sem repetir) e mostra "Hashtags
adicionadas." com **Desfazer** (o mesmo mecanismo da IA). Sem redes escolhidas: "Escolha primeiro uma rede.".

## 5. Horários fixos

### 5.1 Dados
`brands.posting_slots jsonb not null default '[]'`: lista de `{ "weekday": 0–6, "time": "HH:MM" }`
(0 = domingo, como `weekdayOf`). Validação em zod: no máximo 21, sem repetidos, hora `HH:MM` 00:00–23:59.
Check na BD: `jsonb_typeof(posting_slots) = 'array'`.

### 5.2 Definições
Em **Definições → Marcas → Assistente de IA**, junto a "Posts por semana", campo **"Horários fixos"**: lista de
linhas "dia da semana + hora" com "+ Adicionar horário" e "Remover". Guarda com o resto da secção
(`saveBrandAi` ganha `postingSlots`). Texto de ajuda: "Os dias e horas em que costuma publicar. O botão 'Próximo
horário livre' e o plano da semana usam-nos."

### 5.3 Funções puras (`src/lib/schedule/slots.ts`)
- `slotDates({ slots, from, to })` → `{ date, time }[]` ordenados: cada dia local de `from` a `to` (inclusive)
  cujo dia da semana tem horários.
- `isTaken(at, busy)`: há um post (não cancelado) a menos de 1 h desse momento.
- `nextFreeSlot({ slots, tz, busy, now, horizonDays = 28 })` → o primeiro `{ date, time }` a partir de hoje (no fuso
  da marca) que está ≥ 1 h no futuro e não está ocupado; `null` se não houver horários ou nenhum livre no horizonte.
- `freeSlotsInRange({ slots, tz, busy, now, from, to })` → horários livres nesse intervalo (mesmas regras).

"Ocupado" usa todos os posts não cancelados da marca com data (rascunhos incluídos) e, nas Ideias, também as ideias
novas com data. Repositório: `busyTimes(db, brandId, from, to, { excludePostId?, includeIdeas? })`.

### 5.4 No post
Botão **"📅 Próximo horário livre"** ao lado de "🕐 Melhor hora" (só se a marca tiver horários fixos). Preenche
data e hora. Sem nenhum livre nas próximas 4 semanas: "Não há horários fixos livres nas próximas 4 semanas.".
Ação `nextSlot({ brandId, excludePostId })`.

### 5.5 Nas Ideias
- **Planear a próxima semana**, se a marca tiver horários fixos: as ideias vão para os horários **livres** da
  próxima semana (seg–dom), no máximo `posts por semana − já planeados` e no máximo 10. Sem horários livres:
  "Os horários fixos da próxima semana já estão ocupados.". Sem horários fixos: tudo como hoje.
- **Ideias para um prazo**: as datas continuam (−28, −21, −14, −7, 0 dias); a hora de cada dia é o horário fixo
  desse dia da semana que estiver livre (o mais próximo das 19:00, se houver vários); sem horário fixo nesse dia,
  como hoje (`timeForDate`).

## 6. Mover no telemóvel

No calendário do telemóvel (`CalendarMobile`), cada post que se pode mover (`movable`) ganha um botão **"Mover"**.
Abre, por baixo do cartão, um campo de data e "Mover para este dia" / "Cancelar". Usa a ação `reschedule` que já
existe (mantém a hora, recusa posts já a publicar e datas passadas para posts agendados). Sucesso: "Post movido
para <dia>." e o calendário atualiza. No computador, arrastar continua igual.

## 7. Erros

Todas as ações devolvem `{ ok: true, … } | { ok: false, error }` em pt-PT, chamadas com `callSafely` no cliente
(erro de rede → "Ligação perdida. Tente de novo."). Nenhuma ação lança erro para o ecrã.

## 8. Testes

- Unitários (Vitest): `slots.ts` (dias e horas, fuso Cabo Verde, ocupado ±1 h, antecedência de 1 h, horizonte,
  sem horários), esquemas zod (horários e grupos), plano da semana e prazos com horários fixos.
- BD (`supabase/tests`): `hashtag_groups` (RLS, apagar marca apaga grupos, checks), `posting_slots` (omissão `[]`,
  check de array).
- E2E (`e2e/quick.spec.ts`): duplicar abre a cópia; grupo de hashtags criado em Definições e usado no post (com
  Desfazer); horários fixos + "Próximo horário livre"; "Mover" no telemóvel (viewport 390 px).
- Verificação em produção com o utilizador de teste (como nas partes 1 e 2), medição de tempos antes/depois e
  revisão final independente.

## 9. Fora de âmbito

Modelos de legenda; arrastar no telemóvel; mudar a hora ao mover; horários diferentes por rede; ligação ao site da
Unidreamity (subprojeto 4).
