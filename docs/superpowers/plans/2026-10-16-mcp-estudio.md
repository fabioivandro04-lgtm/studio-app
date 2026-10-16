# MCP do Estúdio — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um servidor MCP em `APP_URL/api/mcp`, autenticado pelo OAuth 2.1 do Supabase, que deixa o Claude ler o contexto do Estúdio e criar só rascunhos.

**Architecture:** Rota Next.js com `mcp-handler` 2.x (stateless) + `withMcpAuth`; o token OAuth do dono vai num cliente Supabase por pedido, por isso o RLS aplica-se; uma migração acrescenta defesas na BD para tokens de agente (`client_id`). Ferramentas finas em `src/lib/mcp/tools/`, cada uma reutiliza repos/funções puras existentes.

**Tech Stack:** Next.js 16, `mcp-handler@2.3.0`, `@modelcontextprotocol/server@2.3.1` (+ `@modelcontextprotocol/client@2.3.1` só em dev para testes), Supabase Auth OAuth server (`supabase.auth.oauth.*` do auth-js 2.117), zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-mcp-estudio-design.md`

## Global Constraints
- Só rascunhos: nenhuma ferramenta agenda, publica, cancela ou apaga; nenhuma escreve em `social_accounts`, `brands`, `app_settings`, `hashtag_groups`.
- Datas `AAAA-MM-DD`, horas `HH:MM`, no fuso da marca. Texto pt-PT "você", sem emojis.
- Limite de ficheiros = `NEXT_PUBLIC_MAX_UPLOAD_MB` (50). Tipos aceites = os de `src/lib/media/check.ts` menos HEIC/HEIF.
- URL de envio válida 2 h. Rate limit 60 chamadas/minuto por token. `calendario` ≤ 62 dias; `metricas` ≤ 90 dias; `biblioteca` ≤ 50 itens.
- Não tocar nos projetos Supabase UNIDREAMITY nem "Gestão app". Sem ids de modelo no repositório. Nunca pedir chaves no chat.

## Review Focus
- Token de sessão normal da app (sem `client_id`) usado no `/api/mcp` → 401, não entra. (Task 3)
- `criar_rascunho` com data no passado → cria na mesma (é rascunho), mas devolve o aviso "A data já passou." de `verificar_post`. (Task 7)
- `editar_rascunho` num post já agendado/publicado → erro "Só pode editar rascunhos.", post intacto (ferramenta e RLS). (Tasks 1, 7)
- `importar_de_link` para `http://169.254.169.254/…`, `localhost`, IP privado ou redirecionamento para eles → recusado. (Task 6)
- `confirmar_envio` antes do `curl` terminar (objeto inexistente) → "O ficheiro ainda não chegou.", sem linha órfã em `media_assets`. (Task 6)

---

### Task 1: Migração 0014 — origem do post e defesas para agentes
**Files:** Create `supabase/migrations/0014_mcp.sql`, `supabase/tests/mcp.test.ts`; modify `supabase/tests/db.ts` (`asUser(uid, o?: { clientId?: string })` define também `request.jwt.claims` = `{"sub":uid,"client_id":…}`), `supabase/tests/bootstrap.sql` se `auth.jwt()` não existir.
**Produces:** coluna `posts.origin text not null default 'app' check (origin in ('app','claude'))`; `private.is_agent() returns boolean` (`coalesce(auth.jwt() ? 'client_id', false)`); `save_post(p)` grava `origin` de `p->>'origin'` (omissão `app`) e lança `'Só rascunhos.'` quando `is_agent()` e `intent <> 'draft'`.
- [ ] Testes (FAIL): agente insere post `draft` com origin `claude` ✓; agente não muda `status` para `scheduled`/`cancelled` (0 linhas ou erro); agente não atualiza post não-rascunho; agente sem `delete` em `posts`, `media_assets`, `ideas`, `deadlines`, `storage.objects`; agente sem insert/update em `social_accounts`, `brands`, `app_settings`, `hashtag_groups`; `save_post` com `intent='schedule'` como agente → erro; dono normal continua a agendar e apagar; `origin` omissão `app`; migração reaplicável.
- [ ] Implementar com políticas `as restrictive` (`using/with check (not private.is_agent() or …)`); em `posts`/`post_targets`/`post_media` o agente só escreve quando o post está e fica `draft`.
- [ ] `npm run test:db` PASS → aplicar em produção (`apply_migration`; se o MCP der timeout, copiar para o scratchpad e pedir ao dono para correr no SQL Editor; confirmar com `pg_get_functiondef` e `information_schema.columns`) → commit `feat(db): origem do post e defesas para o Claude`.

### Task 2: Login OAuth — consentimento, metadata e "Ligações do Claude"
**Files:** Create `src/app/oauth/autorizar/page.tsx` (+ `consent-buttons.tsx` cliente), `src/app/.well-known/oauth-protected-resource/route.ts` e `…/oauth-protected-resource/api/mcp/route.ts` (ambos `protectedResourceHandler({ authServerUrls: [SUPABASE_URL + '/auth/v1'] })` + `OPTIONS` = `metadataCorsOptionsRequestHandler()`), `src/app/(app)/definicoes/ligacoes/page.tsx` (+ ação `revokeClaudeGrant(clientId)`); modify `src/lib/auth/paths.ts` (+test: `/api/mcp`, `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/api/mcp` públicos; `/oauth/autorizar` NÃO é público), menu de Definições.
- [ ] Testes `paths.test.ts` → FAIL → implementar → PASS.
- [ ] Página: sem `authorization_id` → "Pedido inválido."; sem sessão → proxy manda para `/login?next=/oauth/autorizar?authorization_id=…` (confirmar que `next` preserva a query); com `getAuthorizationDetails` → se `redirect_url` redireciona; senão mostra "O <client.name> quer aceder ao seu Estúdio", a lista do spec §1 (ler calendário, métricas, ideias…; criar rascunhos; nunca agenda nem apaga) e **Permitir**/**Recusar** (`approveAuthorization`/`denyAuthorization` com `skipBrowserRedirect: true` → `window.location.assign(redirect_url)`). Só o dono (`app_owner`) vê o pedido; outro utilizador → "Esta conta não tem acesso.".
- [ ] "Ligações do Claude": `listGrants()` → nome, data (`granted_at`), botão **Cortar acesso** com `confirm` → `revokeGrant({ clientId })` → toast "Acesso cortado.". Vazio → "Ainda não ligou o Claude." + 3 passos curtos de ligação.
- [ ] tsc/eslint/unit → commit `feat(auth): consentimento OAuth e ligações do Claude`.

### Task 3: Núcleo do MCP — rota, autenticação, contexto, limite
**Files:** Create `src/app/api/mcp/route.ts`, `src/lib/mcp/auth.ts` (+test), `src/lib/mcp/context.ts`, `src/lib/mcp/rate-limit.ts` (+test), `src/lib/mcp/result.ts`, `src/lib/mcp/server.ts`, `src/lib/mcp/tools/marcas.ts` (+test); add deps `mcp-handler@2.3.0`, `@modelcontextprotocol/server@2.3.1`, dev `@modelcontextprotocol/client@2.3.1`.
**Produces:**
```ts
// auth.ts — usado por withMcpAuth(handler, verifyMcpToken, { required: true, resourceMetadataPath: '/.well-known/oauth-protected-resource/api/mcp' })
export function verifyMcpToken(req: Request, bearer?: string): Promise<AuthInfo | undefined>; // getClaims(bearer); exige client_id e sub ∈ app_owner; extra: { userId }
// context.ts
export interface McpCtx { db: SupabaseClient; userId: string; clientId: string; now(): Date; env: ServerEnv }
export function ctxFrom(authInfo: AuthInfo): McpCtx; // createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
// rate-limit.ts
export function takeToken(key: string, now: number): boolean; // janela deslizante 60/min, Map em memória
// result.ts
export function ok(text: string, data?: unknown): CallToolResult;   // content texto + structuredContent
export function fail(message: string): CallToolResult;               // isError: true
// server.ts
export function registerTools(server: McpServer): void;               // regista todas as ferramentas; cada uma passa por rate limit + try/catch → fail('Ocorreu um erro. Tente de novo.') + console.error
export async function brandOrFail(ctx: McpCtx, brandId: string): Promise<Brand | CallToolResult>;
```
- [ ] Testes (FAIL): `verifyMcpToken` sem token / token inválido / sem `client_id` / `sub` não-dono → `undefined`; válido → `{ token, clientId, scopes: [], extra: { userId } }` (getClaims e consulta ao dono injetáveis). `takeToken` 61.º pedido no mesmo minuto → false; depois de 60 s → true. `marcas` devolve marcas com fuso, contas (rede, @, estado) e horários fixos.
- [ ] Implementar; `route.ts` exporta `GET`/`POST`/`DELETE` = `withMcpAuth(createMcpHandler(registerTools, { serverInfo: { name: 'estudio', version: '1.0.0' } }), …)`; `maxDuration = 60`; instruções do servidor (texto curto pt-PT: "Use marcas primeiro; tudo o que cria fica como rascunho; o dono agenda na app").
- [ ] Teste de rota (vitest, handler chamado direto): sem `Authorization` → 401 com `WWW-Authenticate` contendo `resource_metadata=`; com token simulado válido → `tools/list` inclui `marcas`.
- [ ] tsc/eslint/unit → commit `feat(mcp): rota autenticada e ferramenta marcas`.

### Task 4: Ferramentas de leitura
**Files:** Create em `src/lib/mcp/tools/`: `contexto-marca.ts`, `calendario.ts`, `horarios-livres.ts`, `biblioteca.ts`, `ideias.ts`, `prazos.ts`, `estado-publicacoes.ts` (cada um + `.test.ts`); register em `server.ts`.
**Consumes:** `McpCtx`, `ok/fail`, `brandOrFail` (Task 3); `listHashtagGroups`, `freeSlotsInRange`, `busyTimes`, `listMedia`, `listIdeas`, `upcomingDeadlines`, `utcToLocalParts`.
**Inputs (zod):** `contexto_marca { brandId }`; `calendario { brandId?, de, ate }` (ate−de ≤ 62 dias, senão "Escolha no máximo 62 dias."); `horarios_livres { brandId, de, ate }` (≤ 62); `biblioteca { brandId, texto?, tipo?: 'image'|'video', limite?: 1..50 = 20 }`; `ideias { brandId, estado?: 'new'|'used'|'discarded' = 'new' }`; `prazos { brandId, de, ate }`; `estado_publicacoes { brandId? }` (últimos 14 dias).
- [ ] Testes (FAIL) com db falsa: intervalo > 62 dias recusado; datas inválidas recusadas; `calendario` converte para hora local da marca e inclui `origin`; `horarios_livres` sem horários fixos → "Esta marca não tem horários fixos." ; `biblioteca` filtra texto no nome/tags e limita 50; `estado_publicacoes` agrupa publicados / falhados (com `last_error`) / à espera de toque.
- [ ] Implementar → PASS → commit `feat(mcp): ferramentas de leitura`.

### Task 5: Métricas, grelha e resumo
**Files:** Create `src/lib/mcp/tools/{metricas,grelha-instagram,resumo-semana}.ts` (+tests), `src/lib/mcp/describe-grid.ts` (+test).
**Produces:** `describeGrid(items: GridItem[], tz: string): string` — linhas "1. [planeado, Reel, ter 21 out 19:00] Título" / "4. [publicado, carrossel] legenda curta…", 3 por linha visual ("Linha 1: …").
**Inputs:** `metricas { brandId, dias?: 1..90 = 30 }` → totais por rede, top 5 posts (visualizações, gostos), melhores horas (reutilizar `bestTimeInputs`/dados da página Métricas); `grelha_instagram { brandId }` → `buildGrid` + `instagramRecentPosts` → `describeGrid` dos primeiros 12; Instagram não ligado → "O Instagram desta marca não está ligado."; `resumo_semana { brandId }` → últimos 7 dias publicados + números, rascunhos por agendar, prazos dos próximos 14 dias.
- [ ] Testes `describeGrid` (ordem, 12 itens, sem imagem) e das 3 ferramentas (dias > 90 recusado) → FAIL → implementar → PASS → commit `feat(mcp): métricas, grelha e resumo`.

### Task 6: Ficheiros — envio, confirmação e importação
**Files:** Create `src/lib/media/probe-server.ts` (+test com fixtures pequenas em `src/lib/media/__fixtures__/`: PNG 2×3, JPEG 4×5, WebP 6×7, MP4 e MOV curtos com `moov` no fim), `src/lib/net/safe-fetch.ts` (+test), `src/lib/mcp/tools/{pedir-envio,confirmar-envio,importar-de-link}.ts` (+tests).
**Produces:**
```ts
export function probeBuffer(buf: Uint8Array, mime: string): { width: number | null; height: number | null; durationS: number | null }; // PNG IHDR, JPEG SOFn, WebP VP8/VP8L/VP8X, MP4/MOV mvhd(duração)+tkhd(largura/altura da faixa de vídeo)
export async function safeFetch(url: string, maxBytes: number): Promise<{ bytes: Uint8Array; mime: string; name: string }>; // só https; resolve DNS e recusa loopback/privado/link-local/ULA; segue ≤ 3 redirecionamentos validando cada um; aborta acima de maxBytes
```
- `pedir_envio { brandId, nome, mime, tamanhoBytes }` → valida tipo/tamanho (`checkFile`-equivalente sem `File`), gera `id`, caminho `<brandId>/<id>.<ext>`, `createSignedUploadUrl(path)` (cliente do agente, RLS de storage) → `ok("Envie com: curl -X PUT -H 'Content-Type: <mime>' --data-binary @'<nome>' '<url>' e depois chame confirmar_envio com envioId <id>", { envioId, url, expiraEm })`.
- `confirmar_envio { brandId, envioId, nome, mime }` → descarrega o objeto (service client só para leitura do ficheiro deste caminho), `probeBuffer`, insere `media_assets` com o cliente do agente; objeto inexistente → "O ficheiro ainda não chegou."; tamanho > limite ou tipo errado → remove o objeto e explica.
- `importar_de_link { brandId, url }` → `safeFetch(url, limite)` → upload com service client para `<brandId>/<id>.<ext>` → mesmo caminho de `confirmar_envio`.
- [ ] Testes (FAIL): `probeBuffer` nas 5 fixtures; `safeFetch` recusa `http:`, `localhost`, `10.0.0.1`, `169.254.169.254`, `[::1]`, redirecionamento para IP privado, resposta > limite; ferramentas: HEIC recusado ("Envie em JPG ou PNG."), 51 MB recusado, confirmar sem objeto → mensagem e sem linha.
- [ ] Implementar → PASS → commit `feat(mcp): envio e importação de ficheiros`.

### Task 7: Escrita — verificar, criar e editar rascunhos, ideias, prazos
**Files:** Create `src/lib/mcp/tools/{verificar-post,criar-rascunho,editar-rascunho,guardar-ideia,criar-prazo}.ts` (+tests), `src/lib/mcp/post-input.ts` (+test); modify `src/lib/posts/schema.ts` (`origin?: 'app'|'claude'` passado a `save_post`), calendário/editor para mostrar a etiqueta "Criado pelo Claude" quando `origin = 'claude'` (`calendar-view.tsx`, `calendar-list.tsx`, `composer.tsx`; leitura em `posts/data.ts` e na query do calendário).
**Produces:** `toPostInput(args: RascunhoArgs, intent: 'draft'|'schedule'): PostInputT` — mapeia `{ brandId, titulo, mediaIds, data, hora, redes: [{ conta, formato, legenda, titulo?, capaMs? }] }` (conta = id da conta ou `@handle` da marca).
- `verificar_post` → `checkPost(toPostInput(a,'schedule'), …)` sem gravar → lista de avisos "Rede X: mensagem" ou "Tudo certo para agendar.".
- `criar_rascunho { …, ideiaId? }` → `save_post` com `intent:'draft'`, `origin:'claude'`; devolve id, link `APP_URL/posts/<id>` e os avisos de `verificar_post`; com `ideiaId` → `claimIdea` + `linkIdeaPost`; `activity_log` (`source:'mcp'`, "Claude criou o rascunho «título»").
- `editar_rascunho { postId, …mesmos campos }` → post não-`draft` → "Só pode editar rascunhos."; senão `save_post` com `id`.
- `guardar_ideia { brandId, titulo, gancho?, guiao?, legenda?, formato, redes }` → `insertIdeas` (kind conforme formato; `shorts` para vídeo curto, senão `week`).
- `criar_prazo { brandId, titulo, data, instituicao?, pais?, url? }`.
- Todas as escritas (incl. `confirmar_envio`, `importar_de_link`, `editar_rascunho`, `guardar_ideia`, `criar_prazo`) registam uma linha em `activity_log` com `source: 'mcp'`.
- [ ] Testes (FAIL): `toPostInput` resolve `@handle`; conta de outra marca → erro; data passada → cria + aviso "A data já passou."; editar post `scheduled` → recusado; ideia ligada fica `used`.
- [ ] Implementar → PASS; ver a etiqueta no browser (390 px e desktop) → commit `feat(mcp): rascunhos, ideias e prazos pelo Claude`.

### Task 8: Ativação, teste em produção, guia e revisão
**Files:** Create `scripts/mcp-smoke.mjs` (fora do build: cliente `@modelcontextprotocol/client` com OAuth + PKCE via browser Playwright), `docs/MCP.md` (guia pt-PT); modify `README.md`, `docs/SETUP.md` (secção "Claude (MCP)").
- [ ] Merge para `main`, deploy READY.
- [ ] Dono liga no Supabase: Authentication → OAuth Server → Enable; Dynamic client registration → on; Authorization path `/oauth/autorizar` (Site URL = APP_URL). Confirmar `GET <SUPABASE_URL>/.well-known/oauth-authorization-server/auth/v1` → 200 JSON.
- [ ] Smoke em produção com o utilizador de teste (desbanir temporário, depois rebanir): OAuth completo → `marcas` → `calendario` → `pedir_envio` + `curl` + `confirmar_envio` → `criar_rascunho` → ver rascunho "Criado pelo Claude" na app → tentar `save_post` agendado com o token do agente via REST → recusado → apagar dados de teste.
- [ ] Guia `docs/MCP.md`: claude.ai (Definições → Conectores → Adicionar conector personalizado → URL), Claude Code (`claude mcp add --transport http estudio <APP_URL>/api/mcp` → `/mcp` → autenticar), exemplos de pedidos, cortar acesso.
- [ ] Revisão final independente; corrigir Critical/Important; commit e push.
