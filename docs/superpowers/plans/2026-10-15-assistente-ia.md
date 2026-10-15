# Assistente de IA no post — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar legendas, títulos, hashtags e sugerir a melhor hora dentro do criador de posts, com contexto e voz por marca, via OpenRouter e com limite mensal de custo.

**Architecture:** Módulos puros em `src/lib/ai/` (regras, esquemas, prompts, cliente OpenRouter, orçamento, melhor hora) orquestrados por `service.ts` com dependências injetadas; server actions finas em `src/app/(app)/ai/actions.ts` montam as dependências (cliente Supabase do dono, definições, fornecedor real ou falso). UI: secção IA nas marcas, página Definições → IA, painel Assistente no Composer.

**Tech Stack:** Next.js 16 (App Router, server actions), Supabase Postgres + RLS, zod 4, Vitest, Playwright, OpenRouter Chat Completions API.

**Spec:** `docs/superpowers/specs/2026-10-15-assistente-ia-design.md`

## Global Constraints

- Todo o texto visível em **português de Portugal**.
- Modelos: `anthropic/claude-sonnet-5.5` (Normal, por omissão) e `anthropic/claude-haiku-5.5` (Económico).
- Limite mensal por omissão **5 USD**; mês civil em UTC.
- Pedido do dono ≤ **300** caracteres; contexto ≤ **4000**; voz ≤ **2000**; hashtags fixas ≤ **10**.
- `max_tokens`: suggest **1500**, refine **600**, voice **800**. Timeout **45 s**.
- Limites: legenda IG **2200**, TikTok **2200**, YouTube descrição **5000**, título YouTube **100**.
- Hashtags recomendadas: IG **3–5**, TikTok **3–5**, YouTube **3**.
- URLs de imagem assinadas com validade **600 s**.
- `OPENROUTER_API_KEY` só no servidor e opcional; `PLATFORM_MODE=fake` usa o fornecedor falso.
- A IA nunca grava posts: só devolve texto à UI.
- Commits terminam com as linhas `Co-Authored-By`/`Claude-Session` da sessão.

## Review Focus

1. **Imagem indisponível** (mídia sem miniatura, vídeo ainda sem capa) → gerar só com texto, sem erro. Teste na Task 9 (`runSuggest sem imagem`).
2. **Marca sem contexto nem voz** (campos vazios) → prompt continua válido e não inclui secções vazias. Teste na Task 5.
3. **Resposta da IA com plataformas a mais/a menos ou hashtags com espaços/duplicadas** → pós-processamento filtra e normaliza. Teste na Task 4.
4. **Sem posts agendados e fuso diferente de Maputo** (ex.: Atlantic/Cape_Verde) → horários calculados no fuso da marca. Teste na Task 8.
5. **Erro do OpenRouter a meio de uma ação rápida** → a legenda atual não muda (UI só substitui com `ok: true`). Teste e2e na Task 12.

---

### Task 1: Migração 0009 (dados da IA)

**Files:**
- Create: `supabase/migrations/0009_ai.sql`
- Test: `supabase/tests/ai.test.ts`

**Interfaces:**
- Produces: colunas `brands.ai_context text`, `brands.ai_voice text`, `brands.ai_hashtags text[]`, `brands.goal text ('contacts'|'reach')`; tabela `app_settings(id boolean pk, ai_model text, ai_monthly_limit_usd numeric(8,2))` com uma linha; tabela `ai_usage(id uuid, created_at, brand_id uuid null, kind text, model text, input_tokens int, output_tokens int, cost_usd numeric(10,6))`; colunas `post_metrics.profile_visits bigint`, `post_metrics.follows bigint`.

- [ ] **Step 1: Write the failing tests** (`supabase/tests/ai.test.ts`, usar `startTestDb`/`seed` de `./db`)
  - `marca nova tem defaults de IA`: `select ai_context, ai_voice, ai_hashtags, goal` → `'' , '' , [] , 'contacts'`.
  - `goal inválido é recusado`: update `goal='x'` rejeita `/check/`.
  - `contexto acima de 4000 é recusado`: `repeat('a',4001)` rejeita `/check/`.
  - `mais de 10 hashtags fixas é recusado`.
  - `app_settings tem uma linha com defaults`: `ai_model='anthropic/claude-sonnet-5.5'`, `ai_monthly_limit_usd='5.00'`.
  - `não é possível criar segunda linha em app_settings`: `insert into app_settings(id) values (false)` rejeita.
  - `dono atualiza app_settings; outro não vê`: `asUser(ownerId)` update ok; `asUser(strangerId)` select → 0 linhas.
  - `ai_usage: dono insere e lê; outro não lê`.
  - `post_metrics tem profile_visits e follows`.
- [ ] **Step 2:** `npx vitest run supabase/tests/ai.test.ts` → FAIL (colunas inexistentes). (Usar o script de testes de BD existente em `package.json`.)
- [ ] **Step 3: Implement `0009_ai.sql`** — `alter table brands add column …` com `check (length(ai_context) <= 4000)`, `check (length(ai_voice) <= 2000)`, `check (coalesce(array_length(ai_hashtags,1),0) <= 10)`, `check (goal in ('contacts','reach'))`; `create table app_settings (id boolean primary key default true check (id), …)` + `insert … default values`; `create table ai_usage (…)` com `brand_id … references brands(id) on delete set null`, `kind check (kind in ('suggest','refine','voice'))`; `enable row level security` + `create policy owner_all … using (private.is_owner()) with check (private.is_owner())` em ambas; `alter table post_metrics add column profile_visits bigint, add column follows bigint`. Idempotente (`if not exists`) como 0006.
- [ ] **Step 4:** `npx vitest run supabase/tests/ai.test.ts` → PASS; correr toda a suite de BD → PASS.
- [ ] **Step 5: Commit** `feat(db): campos e tabelas para o assistente de IA`

### Task 2: Tipos e validação de marca/definições

**Files:**
- Modify: `src/lib/db/types.ts` (Brand + fromBrandRow), `src/lib/brands/schema.ts`, `src/lib/env.ts`
- Create: `src/lib/ai/types.ts`
- Test: `src/lib/brands/schema.test.ts` (criar/estender), `src/lib/env.test.ts`

**Interfaces:**
- Produces (`src/lib/ai/types.ts`):
  ```ts
  export type Goal = 'contacts' | 'reach';
  export type RefineAction = 'shorten' | 'catchy' | 'professional' | 'cta' | 'english';
  export interface BrandAi { name: string; aiContext: string; aiVoice: string; aiHashtags: string[]; goal: Goal }
  export interface PlatformSuggestion { platform: Platform; captions: string[]; hashtags: string[] }
  export interface Suggestions { internalTitle: string; youtubeTitle: string | null; byPlatform: PlatformSuggestion[] }
  export interface AiUsage { inputTokens: number; outputTokens: number; costUsd: number }
  export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
  export interface ChatMessage { role: 'system' | 'user'; content: string | ContentPart[] }
  export interface JsonSchemaSpec<T> { name: string; schema: Record<string, unknown>; parse(x: unknown): T }
  export interface AiProvider { chat<T>(req: { model: string; messages: ChatMessage[]; spec: JsonSchemaSpec<T>; maxTokens: number }): Promise<{ data: T; usage: AiUsage }> }
  export const AI_MODELS = [{ id: 'anthropic/claude-sonnet-5.5', label: 'Normal — Claude Sonnet 5.5' }, { id: 'anthropic/claude-haiku-5.5', label: 'Económico — Claude Haiku 5.5' }] as const;
  ```
- Produces: `Brand` ganha `aiContext: string; aiVoice: string; aiHashtags: string[]; goal: Goal`.
- Produces (`schema.ts`): `BrandAiInput` (zod: `aiContext ≤4000`, `aiVoice ≤2000`, `aiHashtags` ≤10 itens normalizados com `normalizeHashtag` da Task 4 — nesta task usar validação simples `^#?[\p{L}\p{N}_]+$`u, `goal`), `AiSettingsInput` (`model` string 3–100 com `/`, `limitUsd` número 0–1000).
- Produces (`env.ts`): `OPENROUTER_API_KEY: z.string().optional()`.

- [ ] **Step 1: Failing tests** — `BrandAiInput` aceita valores válidos; recusa contexto 4001 ("O contexto pode ter no máximo 4000 caracteres."), 11 hashtags ("No máximo 10 hashtags fixas."), goal 'x'; `AiSettingsInput` recusa `limitUsd: -1` e modelo sem `/`; `parseServerEnv` sem `OPENROUTER_API_KEY` funciona.
- [ ] **Step 2:** `npx vitest run src/lib/brands src/lib/env.test.ts` → FAIL.
- [ ] **Step 3:** Implementar tipos, schemas e `fromBrandRow` (`ai_context ?? ''`, `ai_voice ?? ''`, `ai_hashtags ?? []`, `goal ?? 'contacts'`).
- [ ] **Step 4:** testes → PASS; `npx tsc --noEmit` limpo.
- [ ] **Step 5: Commit** `feat(ai): tipos e validação de marca e definições`

### Task 3: Métricas extra do Instagram (visitas ao perfil, seguidores)

**Files:**
- Modify: `src/lib/platforms/types.ts` (`PostMetrics`), `src/lib/platforms/instagram/metrics.ts`, `src/lib/db/repo/metrics-repo.ts`
- Test: `src/lib/platforms/instagram/oauth.test.ts` (onde estão os testes de insights)

**Interfaces:**
- Produces: `PostMetrics` ganha `profileVisits?: number | null; follows?: number | null` (opcionais: outros adaptadores não mudam).

- [ ] **Step 1: Failing tests** — `insights extra: profile_visits e follows`: rota `GET /m1/insights` com `metric=reach,...` devolve base e outra rota com `metric=profile_visits,follows` devolve `{data:[{name:'profile_visits',values:[{value:7}]},{name:'follows',values:[{value:2}]}]}` → `out.m1.profileVisits === 7`, `follows === 2`. `insights extra falham → nulos`: segunda chamada 400 → base presente, `profileVisits === null`.
- [ ] **Step 2:** `npx vitest run src/lib/platforms/instagram` → FAIL.
- [ ] **Step 3:** Em `igPostMetrics`, após a chamada base, `try { api.get(`/${id}/insights`, { metric: 'profile_visits,follows' }) } catch { /* ignorar */ }`; `upsertPostMetrics` grava `profile_visits: m.profileVisits ?? null, follows: m.follows ?? null`.
- [ ] **Step 4:** testes → PASS (incluindo `src/lib/metrics`).
- [ ] **Step 5: Commit** `feat(metrics): visitas ao perfil e seguidores por post no Instagram`

### Task 4: Regras por rede e esquemas de resposta

**Files:**
- Create: `src/lib/ai/rules.ts`, `src/lib/ai/schemas.ts`
- Test: `src/lib/ai/schemas.test.ts`

**Interfaces:**
- Produces (`rules.ts`): `AI_RULES: Record<Platform, { captionMax: number; hashtagsMin: number; hashtagsMax: number; style: string }>` (IG 2200/3/5 "gancho forte na 1.ª linha, parágrafos curtos, emojis com moderação"; TikTok 2200/3/5 "curta, 1–2 frases, direta"; YouTube 5000/3/3 "descrição com palavra-chave no início"); `YT_TITLE_MAX = 100`.
- Produces (`schemas.ts`): `SuggestionsSpec: JsonSchemaSpec<Suggestions>` (name `suggestions`), `RefinedSpec: JsonSchemaSpec<{ text: string }>` (name `refined`), `VoiceSpec: JsonSchemaSpec<{ voice: string }>` (name `voice`); `normalizeHashtag(s: string): string | null`; `postprocessSuggestions(raw: Suggestions, o: { platforms: Platform[]; fixedHashtags: string[] }): Suggestions`.
  JSON Schema com `additionalProperties: false` e todos os campos `required` (compatível com `strict: true`); `youtubeTitle` como `["string","null"]`.

- [ ] **Step 1: Failing tests**
  - `normalizeHashtag(' Estudar Fora ')` → `'#EstudarFora'`; `'##bolsas'` → `'#bolsas'`; `'#'` → `null`; `'#são_tomé'` mantém acentos.
  - `postprocess remove plataformas não pedidas e corta legendas`: legenda IG de 2300 chars → 2200; plataforma `youtube` não pedida desaparece; mais de 3 legendas → 3.
  - `postprocess hashtags`: fixas `['#unidreamity']` ficam primeiro; duplicados (sem distinção de maiúsculas) removidos; IG limitado a `max(5, fixas.length)`.
  - `youtubeTitle` cortado a 100 e `null` se não há YouTube.
  - `SuggestionsSpec.parse` lança com objeto inválido (ex.: `captions` não array).
- [ ] **Step 2:** `npx vitest run src/lib/ai/schemas.test.ts` → FAIL.
- [ ] **Step 3:** Implementar com zod (`parse` = schema zod `.parse`).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ai): regras por rede e validação das respostas`

### Task 5: Construção dos prompts

**Files:**
- Create: `src/lib/ai/prompts.ts`
- Test: `src/lib/ai/prompts.test.ts`

**Interfaces:**
- Consumes: `BrandAi`, `ChatMessage`, `RefineAction` (Task 2), `AI_RULES`, `YT_TITLE_MAX` (Task 4).
- Produces:
  ```ts
  export const PROMPT_MAX = 300;
  export function buildSuggestMessages(o: { brand: BrandAi; prompt: string; imageUrl: string | null; targets: { platform: Platform; format: TargetFormat }[] }): ChatMessage[];
  export function buildRefineMessages(o: { brand: BrandAi; platform: Platform; text: string; action: RefineAction }): ChatMessage[];
  export function buildVoiceMessages(o: { brand: BrandAi; captions: string[] }): ChatMessage[];
  ```
  Mensagem de sistema comum (`systemFor(brand)`): papel de gestor de redes sociais lusófono; "Escreve sempre em português de Portugal (nunca do Brasil): usa 'tu'/'vocês', evita gerúndio ('estou a fazer', não 'estou fazendo'), 'equipa' e não 'time', 'registo' e não 'cadastro'"; "Nunca inventes preços, datas, vagas ou promessas que não estejam no contexto ou no pedido"; secções `Contexto da empresa`, `Voz da marca`, `Hashtags fixas` só quando não vazias; objetivo `contacts` → "objetivo: gerar contactos (mensagens, visitas ao perfil) — termina com chamada para ação"; `reach` → "objetivo: alcance máximo — gancho forte, linguagem simples".

- [ ] **Step 1: Failing tests**
  - sistema inclui `português de Portugal`, nome da marca, contexto e voz quando preenchidos.
  - `marca sem contexto nem voz`: o sistema não contém `Contexto da empresa` nem `Voz da marca`.
  - objetivo `contacts` inclui `contactos`; `reach` inclui `alcance`.
  - suggest: mensagem do utilizador tem parte `image_url` quando `imageUrl` existe e não tem quando é `null`; lista cada rede com o seu `style` e limites; inclui `YouTube` título ≤100 só quando há alvo YouTube.
  - pedido com 500 chars é cortado a 300.
  - refine `english` pede tradução para inglês; `shorten` menciona encurtar; mantém hashtags existentes.
  - voice inclui até 20 legendas numeradas e ignora vazias.
- [ ] **Step 2:** `npx vitest run src/lib/ai/prompts.test.ts` → FAIL.
- [ ] **Step 3:** Implementar funções puras.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ai): prompts em pt-PT com contexto e voz da marca`

### Task 6: Cliente OpenRouter, erros e fornecedor falso

**Files:**
- Create: `src/lib/ai/errors.ts`, `src/lib/ai/openrouter.ts`, `src/lib/ai/fake.ts`
- Test: `src/lib/ai/openrouter.test.ts`

**Interfaces:**
- Consumes: `AiProvider`, `JsonSchemaSpec` (Task 2); `fakeFetch` (`src/lib/platforms/testing/fake-fetch.ts`).
- Produces:
  ```ts
  export type AiErrorCode = 'no_key' | 'budget' | 'auth' | 'unavailable' | 'invalid_response';
  export class AiError extends Error { constructor(public code: AiErrorCode, message: string) }
  export function createOpenRouter(o: { apiKey: string; appUrl: string; fetch: typeof fetch; timeoutMs?: number }): AiProvider;
  export function createFakeAi(): AiProvider; // respostas fixas por spec.name, custo 0
  ```
  Pedido: `POST https://openrouter.ai/api/v1/chat/completions`, headers `Authorization: Bearer <key>`, `HTTP-Referer: <appUrl>`, `X-Title: Estúdio`; corpo `{ model, messages, max_tokens, response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }, usage: { include: true } }`. Resposta: `choices[0].message.content` (string JSON) → `spec.parse(JSON.parse(...))`; `usage.prompt_tokens`, `usage.completion_tokens`, `usage.cost` (USD; 0 se ausente). Mensagens (pt-PT) exatamente as da tabela §6 da spec.

- [ ] **Step 1: Failing tests**
  - sucesso: envia headers e corpo acima; devolve `data` validado e `usage { inputTokens:100, outputTokens:50, costUsd:0.0021 }`.
  - 401 e 402 → `AiError('auth')`; 429, 500 → `'unavailable'`; timeout (fetch que nunca resolve, `timeoutMs: 20`) → `'unavailable'`.
  - conteúdo não-JSON ou que falha `spec.parse` → `'invalid_response'`.
  - conteúdo dentro de bloco ```json … ``` é aceite.
  - `createFakeAi().chat` com `SuggestionsSpec` devolve `Suggestions` válido e custo 0.
- [ ] **Step 2:** `npx vitest run src/lib/ai/openrouter.test.ts` → FAIL.
- [ ] **Step 3:** Implementar (timeout com `AbortController`).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ai): cliente OpenRouter com erros claros e fornecedor falso`

### Task 7: Orçamento mensal

**Files:**
- Create: `src/lib/ai/budget.ts`
- Test: `src/lib/ai/budget.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function monthStartUtc(now: Date): string; // 'YYYY-MM-01T00:00:00.000Z'
  export function assertWithinBudget(spentUsd: number, limitUsd: number): void; // lança AiError('budget', 'Chegou ao limite mensal de IA (5 USD). Aumente em Definições → IA.')
  ```
- [ ] **Step 1: Failing tests** — `monthStartUtc(new Date('2026-10-15T23:30:00-01:00'))` → `'2026-10-01T00:00:00.000Z'`; `monthStartUtc(new Date('2026-11-01T00:30:00+02:00'))` → `'2026-10-01T00:00:00.000Z'` (ainda outubro em UTC); `assertWithinBudget(4.99, 5)` não lança; `(5, 5)` lança `budget` com "5 USD"; `limit 0` lança sempre.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ai): limite mensal de gastos`

### Task 8: Melhor hora (sem IA)

**Files:**
- Create: `src/lib/ai/best-time.ts`
- Test: `src/lib/ai/best-time.test.ts`

**Interfaces:**
- Consumes: `Goal` (Task 2); `localToUtc`, `utcToLocalParts` (`src/lib/time/zone.ts`).
- Produces:
  ```ts
  export interface HistoryPoint { publishedAt: Date; reach: number | null; views: number | null; profileVisits: number | null; follows: number | null; shares: number | null; saves: number | null; comments: number | null }
  export interface Slot { date: string; time: string; reason: string; source: 'history' | 'initial' }
  export const INITIAL_TIMES: Record<Goal, Record<number, string[]>>; // chave = dia da semana 0 (dom) … 6 (sáb)
  export function scorePoint(p: HistoryPoint, goal: Goal): number;
  export function suggestSlots(o: { history: HistoryPoint[]; goal: Goal; tz: string; busy: Date[]; now: Date }): Slot[];
  ```
  `INITIAL_TIMES.contacts`: seg–sex `['12:30','19:00','20:30']`, sáb `['11:00','18:00']`, dom `['17:00','19:00']`; `reach` igual + `'21:00'` em todos os dias.
  `scorePoint`: contacts = `profileVisits + follows*3 + shares*2 + saves*2 + comments`; reach = `reach ?? views ?? 0` (nulos = 0).
  Algoritmo: se ≥ 10 pontos, agrupar por (dia da semana, hora local) com ≥ 2 pontos, ordenar por mediana; candidatos = essas faixas nos próximos 7 dias (minuto `:00`); `reason` = `"Os teus posts de <dia> às <hora> tiveram <x>× mais contactos|alcance"` (x = mediana faixa / mediana global, 1 casa decimal); senão usar `INITIAL_TIMES` com `reason` `"Sugestão inicial: hora de maior atividade do público"`. Filtrar: ≥ 1 h após `now`, ≥ 2 h de qualquer `busy`. Escolher 3, preferindo dias diferentes; se faltar, completar com o mesmo dia.
- [ ] **Step 1: Failing tests**
  - `sem histórico → 3 sugestões iniciais futuras` com `source: 'initial'`, em dias diferentes.
  - `respeita fuso`: tz `Atlantic/Cape_Verde`, `now` = quinta 10:00 local → primeira sugestão 12:30 local dessa quinta (e não convertida de Maputo).
  - `evita posts próximos`: `busy` às 19:30 local → não sugere 19:00 nem 20:30 desse dia.
  - `não sugere menos de 1 h a partir de agora`.
  - `com histórico usa as melhores faixas`: 12 pontos, 4 às quintas 19h com pontuação alta → primeira sugestão quinta 19:00, `source: 'history'`, `reason` contém `mais contactos`.
  - `scorePoint` contacts e reach com nulos.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ai): sugestão de melhor hora a partir dos resultados`

### Task 9: Serviço da IA (orquestração testável)

**Files:**
- Create: `src/lib/ai/service.ts`
- Test: `src/lib/ai/service.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 6, 7.
- Produces:
  ```ts
  export interface AiDeps { provider: AiProvider | null; model: string; limitUsd: number; spentUsd: number; recordUsage(u: { brandId: string | null; kind: 'suggest' | 'refine' | 'voice'; model: string; usage: AiUsage }): Promise<void> }
  export async function runSuggest(d: AiDeps, i: { brandId: string; brand: BrandAi; prompt: string; imageUrl: string | null; targets: { platform: Platform; format: TargetFormat }[] }): Promise<Suggestions>;
  export async function runRefine(d: AiDeps, i: { brandId: string; brand: BrandAi; platform: Platform; text: string; action: RefineAction }): Promise<string>;
  export async function runDraftVoice(d: AiDeps, i: { brandId: string; brand: BrandAi; captions: string[] }): Promise<string>;
  ```
  Ordem em cada função: `provider` nulo → `AiError('no_key', 'Falta ligar a IA: adicione OPENROUTER_API_KEY na Vercel.')`; `assertWithinBudget`; validar entrada (prompt não vazio → "Escreva sobre o que é o post."; `targets` vazio → "Escolha pelo menos uma rede."; `captions` vazio → "Não há legendas no Instagram para analisar."); `provider.chat` com `max_tokens` da Global Constraints; `recordUsage`; pós-processar (`postprocessSuggestions`, `text.slice(0, captionMax)`, `voice.slice(0, 2000)`).
- [ ] **Step 1: Failing tests** (com `createFakeAi` e um provider espião)
  - `runSuggest sem imagem` envia mensagens sem `image_url` e devolve sugestões pós-processadas.
  - `sem provider` → `no_key`; `gasto ≥ limite` → `budget` e `provider.chat` não é chamado.
  - `recordUsage` chamado uma vez com `kind: 'suggest'` e o custo devolvido.
  - `runRefine` corta ao limite da rede; `runDraftVoice` sem legendas → erro com a mensagem acima.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(ai): serviço que orquestra pedidos, orçamento e registo`

### Task 10: Server actions e repositório da IA

**Files:**
- Create: `src/lib/db/repo/ai-repo.ts`, `src/app/(app)/ai/actions.ts`
- Modify: `src/app/(app)/definicoes/actions.ts` (`saveBrand` mantém-se; nova `saveBrandAi`)
- Test: `src/lib/db/repo/ai-repo.test.ts` (só funções puras de mapeamento) — o resto é coberto pelo e2e da Task 12.

**Interfaces:**
- Consumes: Tasks 2, 6, 8, 9; `createServerClient`; `serverEnv`; `getAdapters` (para `listRecentPosts` do Instagram); `decryptToken` (o mesmo usado em `pendentes/actions.ts`) e `createServiceClient` só para ler o token da conta IG depois de confirmar com o cliente do dono que a conta pertence à marca.
- Produces (`ai-repo.ts`):
  ```ts
  export async function loadAiSettings(db: SupabaseClient): Promise<{ model: string; limitUsd: number }>;
  export async function monthSpend(db: SupabaseClient, now: Date): Promise<{ usd: number; requests: number }>;
  export async function insertUsage(db: SupabaseClient, u: { brandId: string | null; kind: string; model: string; usage: AiUsage }): Promise<void>;
  export async function bestTimeInputs(db: SupabaseClient, brandId: string, excludePostId: string | null): Promise<{ history: HistoryPoint[]; busy: Date[] }>;
  export function toHistoryPoint(row: { published_at: string; post_metrics: { collected_on: string; reach: number|null; views: number|null; profile_visits: number|null; follows: number|null; shares: number|null; saves: number|null; comments: number|null }[] }): HistoryPoint | null; // usa a métrica mais recente; null sem métricas
  ```
- Produces (`ai/actions.ts`, todas `'use server'`, devolvem `{ ok: true, ... } | { ok: false; error: string }`):
  `suggestPost({ brandId, prompt, mediaId: string | null, platforms: Platform[], formats: Record<Platform, TargetFormat> })`, `refineCaption({ brandId, platform, text, action })`, `draftVoice({ brandId })`, `bestTimes({ brandId, excludePostId: string | null })` → `{ ok: true; slots: Slot[] }`, `saveAiSettings({ model, limitUsd })`, `aiStatus()` → `{ hasKey: boolean; model; limitUsd; spentUsd; requests }`.
  Imagem: `media_assets.thumbnail_path ?? (kind==='image' ? storage_path : null)` → `createSignedUrl(path, 600)`.
  Provider: `PLATFORM_MODE === 'fake'` → `createFakeAi()`; senão `OPENROUTER_API_KEY ? createOpenRouter(...) : null`.
  `AiError` → `{ ok: false, error: e.message }`; outros erros → "Ocorreu um erro inesperado. Tente de novo."
  `saveBrandAi({ brandId, aiContext, aiVoice, aiHashtags, goal })` (em `definicoes/actions.ts`): valida com `BrandAiInput`, normaliza cada hashtag com `normalizeHashtag` (Task 4) e descarta nulos, grava com o cliente do dono, `revalidatePath('/', 'layout')`.
- [ ] **Step 1: Failing test** — `toHistoryPoint` escolhe a métrica com `collected_on` mais recente e devolve `null` sem métricas.
- [ ] **Step 2:** FAIL. **Step 3:** implementar repo e actions. **Step 4:** PASS + `npx tsc --noEmit` + `npx eslint src`.
- [ ] **Step 5: Commit** `feat(ai): server actions do assistente`

### Task 11: UI — Marcas (secção IA) e Definições → IA

**Files:**
- Modify: `src/app/(app)/definicoes/marcas/brands-editor.tsx`, `src/app/(app)/definicoes/page.tsx` (link "IA" com ícone `Sparkles`, desc "Motor, limite mensal e gastos")
- Create: `src/app/(app)/definicoes/ia/page.tsx`, `src/app/(app)/definicoes/ia/ai-settings-form.tsx`

**Interfaces:**
- Consumes: `saveBrandAi`, `draftVoice`, `saveAiSettings`, `aiStatus` (Task 10); `AI_MODELS` (Task 2).
- Labels exatos (usados pelo e2e): "Contexto da empresa", "Voz da marca", "Hashtags fixas", "Objetivo", opções "Contactos"/"Alcance", botão "✨ Criar a partir do Instagram", botão "Guardar IA"; página IA: título "IA", "Motor", "Limite mensal (USD)", texto "Gasto este mês", "Guardar".
- [ ] **Step 1:** Implementar secção colapsável "Assistente de IA" em cada cartão de marca (textarea com contador de caracteres, input de hashtags separado por espaços, select objetivo). "Criar a partir do Instagram" chama `draftVoice` e preenche a textarea (sem gravar); desativado com nota "Ligue o Instagram desta marca primeiro." quando não há conta IG ativa.
- [ ] **Step 2:** Implementar página IA: estado da chave ("Ligada" / "Falta a chave OPENROUTER_API_KEY na Vercel"), select de modelo com opção "Outro" (input), limite, gasto do mês e nº de pedidos.
- [ ] **Step 3:** `npx tsc --noEmit`, `npx eslint src`, `npx vitest run src/` → PASS; ver no browser local (telemóvel 400px e desktop).
- [ ] **Step 4: Commit** `feat(ai): contexto, voz e objetivo por marca; página de definições da IA`

### Task 12: UI — painel Assistente no Composer, ações rápidas, melhor hora, e2e e documentação

**Files:**
- Create: `src/components/composer/ai-panel.tsx`, `src/components/composer/refine-menu.tsx`, `src/components/composer/best-time.tsx`, `e2e/ai.spec.ts`
- Modify: `src/components/composer/composer.tsx`, `docs/SETUP.md` (secção "IA (OpenRouter)"), `README.md` (lista de funcionalidades)

**Interfaces:**
- Consumes: `suggestPost`, `refineCaption`, `bestTimes` (Task 10).
- Labels exatos: painel "✨ Assistente"; textarea "Sobre o que é este post?"; botão "Gerar"; estado "A escrever…"; por legenda botão "Usar"; "Usar título"; etiquetas de hashtags como botões `aria-pressed`; "Adicionar à legenda"; menu "✨" com "Encurtar", "Mais chamativo", "Mais profissional", "Adicionar chamada para ação", "Traduzir para inglês"; toast "Legenda alterada." com ação "Desfazer"; botão "🕐 Melhor hora"; chips com `data-testid="best-time-slot"`; etiqueta "sugestão inicial".
- [ ] **Step 1: Write failing e2e** (`e2e/ai.spec.ts`, fornecedor falso via `PLATFORM_MODE=fake`; marca e conta criadas como em `composer.spec.ts`):
  - `gera sugestões e usa legenda e hashtags`: escrever frase, Gerar, "Usar" na 1.ª legenda IG → campo "Legenda Instagram" igual ao texto do cartão; ativar 1 hashtag e "Adicionar à legenda" → legenda termina com ela.
  - `ação rápida com desfazer`: "Encurtar" muda a legenda; "Desfazer" repõe a anterior.
  - `erro mantém legenda`: com `aiStatus` a limite 0 (atualizar `app_settings` via `admin()` para `ai_monthly_limit_usd = 0`) → toast com "limite mensal" e legenda inalterada; repor 5 no fim.
  - `melhor hora preenche data e hora`: clicar 1.º chip → inputs "Data"/"Hora" iguais ao chip.
  - `voz da marca`: Definições → Marcas → (sem IG ligado em fake) o botão está desativado com a nota; preencher contexto + objetivo "Alcance" + Guardar IA → recarregar mantém valores.
- [ ] **Step 2:** `npx playwright test e2e/ai.spec.ts` → FAIL.
- [ ] **Step 3:** Implementar o painel (entre "1. Mídia" e "2. Redes e legendas", escondido quando `ro`), menu de refinamento junto a cada textarea de legenda, e o botão de melhor hora junto a "3. Quando". Substituições só com `ok: true`; guardar valor anterior para "Desfazer".
- [ ] **Step 4:** e2e → PASS (com `E2E_*` e chave de serviço; se não houver chave de serviço nesta sessão, correr pelo menos os testes unitários e verificar manualmente no browser local com o utilizador de teste) ; `npx vitest run src/`, `tsc`, `eslint` → PASS.
- [ ] **Step 5:** Atualizar `docs/SETUP.md` (passos do OpenRouter da spec §8) e `README.md`.
- [ ] **Step 6: Commit** `feat(ai): painel Assistente no criador de posts`
- [ ] **Step 7:** Aplicar `0009_ai.sql` no Supabase de produção (Supabase MCP `apply_migration`), fazer merge para `main`, push, confirmar deploy READY; quando o dono tiver posto `OPENROUTER_API_KEY`, fazer **um** pedido real e confirmar registo em `ai_usage` com custo > 0.
