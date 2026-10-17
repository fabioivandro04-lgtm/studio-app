# Pastas na Biblioteca — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pastas por tema na Biblioteca (um ficheiro numa só pasta), "Usado em" por ficheiro, sugestão de pasta no editor e pastas no MCP.
**Architecture:** Tabela `media_folders` + `media_assets.folder_id` (migração 0015, corrida pelo dono). Regras puras em `src/lib/library/` com testes; repo `folders-repo.ts`; ações em `biblioteca/actions.ts`; UI em `src/components/media/`. O código que lê `folder_id` só vai para `main` depois de o dono correr o SQL.
**Tech Stack:** Next.js 16, React 19, Supabase (RLS), zod 4, Vitest, Playwright, testes de BD em `supabase/tests` (PGlite).
**Spec:** `docs/superpowers/specs/2026-10-17-pastas-biblioteca-design.md`

## Global Constraints
- pt-PT "você", sem emojis, tokens de cor, modo escuro legível; sem controlos nativos (teste `no-native-controls`).
- Nome da pasta 1–80 caracteres (aparado); nota ≤ 2000; único por marca sem distinguir maiúsculas.
- Apagar pasta nunca apaga ficheiros (`on delete set null`).
- Agente MCP: lê e cria pastas; nunca update/delete de pastas; só põe ficheiros numa pasta no insert.
- "Usado N×" conta posts com `status <> 'cancelled'`.
- Link para o editor: `/posts/novo?midia=id1,id2,…` (o parâmetro `midia` existente passa a aceitar lista).

## Review Focus
- Mover ficheiros para uma pasta de outra marca (pedido forjado) → recusado na BD ("A pasta é de outra marca."), nada muda. (Task 1 + Task 3)
- Criar pasta "Prazos" quando já existe "prazos" na mesma marca → usa/indica a existente, sem erro técnico. (Task 3 `ensureFolder`)
- `?pasta=<id inexistente ou de outra marca>` → "Pasta não encontrada", sem 500. (Task 4)
- `?midia=` com ids repetidos, inválidos ou de outra marca → ignorados, ordem dos válidos mantida. (Task 5)
- "Guardar na pasta" num post sem título → pasta "Post de dd/mm" (data do post no fuso da marca, ou hoje). (Task 5)

---

### Task 1: Migração 0015 e testes de BD
**Files:** Create `supabase/migrations/0015_pastas.sql`, `supabase/tests/folders.test.ts`; modify `src/lib/db/types.ts` (`MediaAsset.folderId: string | null`, `fromMediaRow`), `supabase/tests/db.ts` só se precisar de seed de pasta.
**Produces:** tabela `media_folders(id, brand_id, name, notes, created_at)`, índice único `(brand_id, lower(name))`, `media_assets.folder_id`, trigger `media_folder_same_brand` (erro `'A pasta é de outra marca.'`), RLS dono + restritivas de agente (sem update/delete em `media_folders`).
- [ ] Testes: dono cria/renomeia/apaga pasta; apagar → `folder_id` nulo e ficheiro continua; pasta de outra marca → throw /outra marca/; nome repetido (`'Prazos'` vs `'prazos'`) → throw /unique|duplicate/; agente insere e lê pasta, `update`/`delete` devolvem `[]`; agente insere `media_assets` com `folder_id`; migração reaplicável 2×.
- [ ] Correr `npx vitest run supabase/tests/folders.test.ts` → FAIL; escrever SQL → PASS; `npx vitest run supabase/tests` todo PASS.
- [ ] Copiar o SQL para o scratchpad como `pastas.sql` (para o dono). Commit.

### Task 2: Regras puras
**Files:** Create `src/lib/library/usage.ts` (+test), `src/lib/library/folder-name.ts` (+test).
**Produces:**
```ts
type UsageRow = { mediaId: string; postId: string; title: string; status: PostStatus; scheduledAt: string | null };
usageOf(rows: UsageRow[]): Map<string, { count: number; posts: Omit<UsageRow, 'mediaId'>[] }> // ignora 'cancelled'; um post conta 1× mesmo com o ficheiro repetido; posts por scheduledAt desc
defaultFolderName(title: string, day: string /* AAAA-MM-DD */): string // título aparado (≤80) ou 'Post de dd/mm'
cleanFolderName(s: string): string | null // trim, colapsa espaços; vazio ou >80 → null
```
- [ ] Testes (cancelado ignorado; repetido conta 1; ordem; `defaultFolderName('', '2026-10-17') === 'Post de 17/10'`; nome de 81 chars → null) → FAIL → implementar → PASS → commit.

### Task 3: Repo e ações
**Files:** Create `src/lib/db/repo/folders-repo.ts` (+test com fake db se o padrão existir, senão via ações); modify `src/lib/db/repo/media-repo.ts` (`folderId?: string | 'none'`, `unused?: boolean`, devolve `folderId`), `src/app/(app)/biblioteca/actions.ts`, `src/lib/media/upload.ts` (parâmetro `folderId?`).
**Produces:**
```ts
listFolders(db, brandId: string | null): Promise<FolderCard[]> // { id, brandId, name, notes, count, usedIn, previews: string[] /* ≤4 urls */ }
getFolder(db, id): Promise<Folder | null>
mediaUsage(db, mediaIds: string[]): Promise<Map<string, {count; posts}>> // usa usageOf
// ações (server, dono):
createFolder({ brandId, name, notes? }): Promise<ActionResult<{ id: string }>>
ensureFolder({ brandId, name }): Promise<ActionResult<{ id: string; created: boolean }>> // devolve a existente pelo nome
updateFolder({ id, name?, notes? }): Promise<ActionResult>
deleteFolder(id): Promise<ActionResult>
moveMedia({ ids: string[], folderId: string | null }): Promise<ActionResult<{ moved: number }>> // ids de uma só marca, senão 'Escolha ficheiros de uma só marca.'
```
Erros em pt-PT: nome inválido → "O nome tem de ter entre 1 e 80 caracteres."; duplicado em `createFolder` → "Já existe uma pasta com esse nome."; todas fazem `revalidatePath('/biblioteca')`.
- [ ] Testes das ações (validação zod, mensagens, uma só marca, `ensureFolder` reutiliza) → FAIL → implementar → PASS; tsc/eslint/unit → commit.

### Task 4: Biblioteca — pastas, pasta aberta, seleção, "Usado em"
**Files:** Create `src/components/media/{folder-grid,folder-header,folder-dialog,move-to-folder,usage-badge}.tsx`; modify `biblioteca/page.tsx` (`?pasta=<id>|sem`, chip "Por usar" `?uso=nao`), `media-grid.tsx` (modo "Selecionar" + barra "N selecionados · Mover para pasta… · Tirar da pasta"; "⋯" → "Mover para pasta"; selo), `media-viewer.tsx` (secção "Usado em": título ou "Sem título", dia/hora no fuso da marca, estado Rascunho/Agendado/Publicado/Falhou, link), `media-uploader.tsx` (`folderId` prop).
- Vista sem `pasta`: grelha de pastas (+ "Sem pasta (N)", "Nova pasta"), depois ficheiros como hoje. "Todas as marcas" → bolinha da cor da marca no cartão.
- Pasta aberta: nome + "Tema e abordagem" editáveis, ficheiros por `created_at asc`, "Criar post com estes ficheiros" (`/posts/novo?midia=…`), "Mudar nome", "Apagar pasta" (confirmação "Os ficheiros passam para Sem pasta. Nada é apagado."). Inexistente → "Pasta não encontrada" + "Voltar à Biblioteca".
- [ ] e2e `e2e/library.spec.ts`: criar pasta, mover 2 ficheiros, abrir pasta, ver "Usado em". tsc/eslint/unit → commit.

### Task 5: Editor de post
**Files:** modify `src/app/(app)/posts/data.ts` (`mediaIds: string[]` a partir de `midia` com vírgulas: só uuid válidos da marca, sem repetidos, ordem mantida), `posts/novo/page.tsx`, `components/composer/composer.tsx` (linha "Estes N ficheiros não estão numa pasta — Guardar na pasta «nome»" usando `defaultFolderName` + `ensureFolder` + `moveMedia` só dos soltos; picker com filtro por pasta e "Usar a pasta toda" sem repetir), `listBrandMedia` devolve `folderId` e pastas.
- [ ] Teste unitário do parsing de `midia` (repetidos, inválidos, outra marca) → FAIL → PASS; e2e: "Criar post com estes ficheiros" abre o editor com os ficheiros por ordem. commit.

### Task 6: MCP
**Files:** Create `src/lib/mcp/tools/{pastas,criar-pasta}.ts`; modify `tools/index.ts`, `tools/biblioteca.ts` (`pastaId?`, campo `pasta: { id, nome } | null`), `tools/confirmar-envio.ts`, `tools/importar-de-link.ts`, `lib/mcp/uploads.ts` (`folderId?` no insert; pasta tem de existir na marca → `ToolError('Pasta não encontrada nesta marca.')`), `lib/mcp/server.ts` (INSTRUCTIONS: "Junte os ficheiros de um carrossel numa pasta com o tema do post."), `docs/MCP.md`.
- [ ] Testes em `tools/*.test.ts` (fake-db): `pastas` lista com contagem; `criar_pasta` cria e repete-nome devolve a existente; `pastaId` de outra marca → erro; `biblioteca` filtra por pasta → FAIL → PASS. commit.

### Task 7: Verificação e publicação
- [ ] Passar `pastas.sql` ao dono e esperar confirmação; depois merge `main`, deploy READY.
- [ ] Capturas 390 px e 1366 px (claro/escuro) da Biblioteca, de uma pasta e do editor; revisão final independente; corrigir Critical/Important.
