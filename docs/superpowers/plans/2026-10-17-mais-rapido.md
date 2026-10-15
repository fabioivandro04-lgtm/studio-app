# Mais rápido e fluido — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App que responde logo ao toque, com duplicar post, grupos de hashtags, horários fixos (no post e nas Ideias) e "Mover" no calendário do telemóvel.

**Architecture:** Funções puras em `src/lib/schedule/slots.ts` e `src/lib/brands/schema.ts`; repositórios finos em `src/lib/db/repo`; server actions finas que devolvem `{ok}`; UI cliente chama-as com `callSafely`. Migração 0012 só acrescenta (tabela + coluna).

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Supabase (RLS `private.is_owner()`), zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-17-mais-rapido-design.md`

## Global Constraints

- Texto da UI em pt-PT com "você"; mensagens exatas da spec.
- Dia da semana: 0 = domingo (como `weekdayOf`). Horas `HH:MM`. Fuso = fuso da marca.
- "Ocupado" = post não cancelado da marca a menos de 1 h; antecedência mínima 1 h; horizonte 28 dias.
- Ações devolvem `{ ok: true, … } | { ok: false, error }`; nunca lançam para o ecrã.
- Não tocar nos projetos Supabase UNIDREAMITY nem "Gestão app". Sem ids de modelo no repositório.

## Review Focus

- Horário fixo de hoje já passado (ou a < 1 h) → saltar para o seguinte, nunca devolver passado. (Task 2)
- Post a ser editado ocupa o seu próprio horário → `excludePostId` não o conta como ocupado. (Task 2/5)
- Trocar de marca no editor → "# Hashtags" e "Próximo horário livre" usam a marca nova. (Task 4/5)
- Mover para um dia já passado um post agendado → erro "A data já passou." visível, calendário intacto. (Task 6)
- Grupo com hashtags repetidas / sem `#` / separadas por vírgulas → normalizado, sem repetidas. (Task 3)

---

### Task 1: Medir antes + migração 0012
**Files:** Create `supabase/migrations/0012_quick.sql`, `supabase/tests/quick.test.ts`; scratchpad `measure.mjs` (fora do repo).
- [ ] Medir tempos de produção (`/calendario`, `/posts/novo`, `/ideias`, 3× cada) com o utilizador de teste; guardar números.
- [ ] Testes BD: `hashtag_groups` (RLS dono/outro, nome vazio/41, tags vazias/31 recusados, apagar marca apaga grupos); `brands.posting_slots` omissão `[]`, `'{}'::jsonb` recusado; migração reaplicável. FAIL.
- [ ] Implementar (idempotente, RLS `owner_all` via bloco `do`, índice `brand_id`) → PASS → aplicar em produção (apply_migration) → commit `feat(db): grupos de hashtags e horários fixos`.

### Task 2: Horários fixos (puro)
**Files:** Create `src/lib/schedule/slots.ts` (+test); modify `src/lib/brands/schema.ts` (+test), `src/lib/db/types.ts`.
**Produces:**
```ts
export type PostingSlot = { weekday: number; time: string };
export const PostingSlots: z.ZodType<PostingSlot[]>; // máx 21, sem repetidos, HH:MM; msgs "No máximo 21 horários.", "Horário repetido.", "Hora inválida."
export function slotDates(o: { slots: PostingSlot[]; from: string; to: string }): { date: string; time: string }[];
export function isTaken(at: Date, busy: Date[]): boolean; // |Δ| < 1 h
export function nextFreeSlot(o: { slots; tz; busy: Date[]; now: Date; horizonDays?: number }): { date: string; time: string } | null;
export function freeSlotsInRange(o: { slots; tz; busy; now; from: string; to: string }): { date: string; time: string }[];
```
`Brand.postingSlots: PostingSlot[]` (`r.posting_slots ?? []`); `BrandAiInput.postingSlots`.
- [ ] Testes: ordem por data/hora; hoje às 19:00 com now 18:30 → salta para o próximo; ocupado ±59 min salta, a 60 min não; Cabo Verde; sem horários → null; horizonte; zod (repetido, 24:00, 22 itens). FAIL → implementar → PASS → commit.

### Task 3: Grupos de hashtags (dados + Definições)
**Files:** Create `src/lib/db/repo/hashtag-groups-repo.ts`, `src/app/(app)/definicoes/marcas/hashtag-groups-section.tsx`; modify `src/lib/brands/schema.ts` (+test), `src/app/(app)/definicoes/actions.ts`, `brands-editor.tsx`, `marcas/page.tsx`.
**Produces:** `HashtagGroupInput` (zod: name 1–40 "Dê um nome ao grupo."; tags texto → `parseTags(text): string[]` normalizado, 1–30, "Escreva pelo menos uma hashtag.", "No máximo 30 hashtags por grupo."); `listHashtagGroups(db, brandId?) → { id, brandId, name, tags }[]`; ações `saveHashtagGroup({ id?, brandId, name, tags: string })`, `deleteHashtagGroup(id)`.
- [ ] Testes `parseTags`/`HashtagGroupInput` (vírgulas, sem `#`, repetidas, inválida) → FAIL → implementar → PASS.
- [ ] UI "Grupos de hashtags" por marca (lista, criar, editar, apagar com `confirm`); tsc/eslint → commit.

### Task 4: Editor — duplicar, "# Hashtags", carregamento paralelo
**Files:** Modify `src/app/(app)/posts/data.ts` (Promise.all; `hashtagGroups`, `brands[].postingSlots`), `src/components/composer/composer.tsx`; create `src/components/composer/hashtag-groups-menu.tsx`.
- [ ] "Duplicar" (posts guardados, também só-de-leitura) → `duplicatePost` via `callSafely` → toast "Cópia criada." → `/posts/<id>`.
- [ ] "# Hashtags": menu com grupos da marca atual; junta a todas as legendas com `appendHashtags` + Desfazer ("Hashtags adicionadas."); sem redes → "Escolha primeiro uma rede."; sem grupos → link "Criar grupos de hashtags".
- [ ] tsc/eslint/unit; ver no browser → commit.

### Task 5: Horários fixos — Definições, editor e Ideias
**Files:** Modify `brand-ai-section.tsx`, `definicoes/actions.ts` (`saveBrandAi` + `posting_slots`), `src/lib/db/repo/ai-repo.ts` (`busyTimes(db, brandId, from: Date, to: Date, o?: { excludePostId?: string | null; includeIdeas?: boolean }): Promise<Date[]>`), `src/app/(app)/ai/actions.ts` (`nextSlot({ brandId, excludePostId })` → `{ ok, slot: {date,time} | null }`), `src/components/composer/best-time.tsx` (botão "📅 Próximo horário livre"), `src/lib/ai/plan-dates.ts` (`timeForDate` aceita `slots?: PostingSlot[]`: horário fixo livre desse dia mais próximo das 19:00 primeiro), `src/app/(app)/ideias/actions.ts`.
- [ ] Testes `timeForDate` com slots (usa o fixo; fixo ocupado → cai no comportamento atual) → FAIL → implementar → PASS.
- [ ] Planear semana com slots: `freeSlotsInRange` da próxima semana (busy com ideias novas), `min(missing, livres, 10)`; 0 livres → "Os horários fixos da próxima semana já estão ocupados."; sem slots → como hoje. Prazos: `timeForDate` com slots.
- [ ] Editor de horários em Definições ("+ Adicionar horário", "Remover", texto de ajuda da spec); botão no editor só com slots; sem livre → "Não há horários fixos livres nas próximas 4 semanas.". tsc/eslint/unit → commit.

### Task 6: "Mover" no telemóvel + esboço de carregamento
**Files:** Modify `src/components/calendar/calendar-mobile.tsx`; create `src/components/calendar/move-post.tsx`, `src/app/(app)/loading.tsx`.
- [ ] "Mover" em posts `movable` → campo de data + "Mover para este dia"/"Cancelar" → `reschedule` via `callSafely` → "Post movido para <dia>." + `router.refresh()`; erro → toast, sem mudar.
- [ ] `loading.tsx`: título + 3 blocos `animate-pulse`, `aria-busy`, texto só para leitores "A carregar…".
- [ ] tsc/eslint/unit; ver no browser (390 px e desktop) → commit.

### Task 7: E2E, docs, publicação, medição e revisão
**Files:** Create `e2e/quick.spec.ts`; modify `README.md`, `docs/SETUP.md`.
- [ ] E2E (marca de teste): duplicar abre cópia "(cópia)"; grupo criado e usado no post + Desfazer; horários fixos + "Próximo horário livre" preenche data/hora; "Mover" a 390 px.
- [ ] Docs (secção "Atalhos": duplicar, grupos, horários fixos, mover).
- [ ] Merge `main`, deploy READY, verificação em produção com o utilizador de teste, medir depois, revisão final independente, corrigir Critical/Important.
