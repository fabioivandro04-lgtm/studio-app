# Novo visual — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Visual moderno sem cara de IA, editor mais simples, calendário mais claro, modo escuro.
**Architecture:** Tokens CSS + componentes existentes reestilizados; funções puras novas em `src/lib/calendar` e `src/lib/posts`; uma server action nova para a biblioteca do editor.
**Tech Stack:** Next.js 16, React 19, Tailwind 4, lucide-react, next/font (Manrope), Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-10-18-novo-visual-design.md`

## Global Constraints
- Nenhum emoji em `src/**/*.tsx` (verificado por teste).
- Texto pt-PT "você". Cores só por tokens (exceto o logótipo/cores de marca vindas da BD).
- Modo escuro pelo sistema; nada ilegível em escuro.

## Review Focus
- Modo escuro: texto sobre âmbar/azul legível; inputs nativos (date/time/select) legíveis. (Task 1)
- Barra de ações fixa não tapa o último campo nem a barra inferior do telemóvel. (Task 3)
- Gravação local não recupera alterações de outro post nem depois de guardar. (Task 3)
- Horário livre no passado ou ocupado não aparece como "+ hora". (Task 4)
- Filtros na URL inválidos são ignorados, não partem a página. (Task 4)

---

### Task 1: Tokens, letra, modo escuro, cabeçalho e menu
**Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/app-nav.tsx`, `src/components/brand-switcher.tsx`, `src/lib/calendar/status.ts`, ficheiros com cores fixas.
- [ ] Teste `src/lib/ui/no-emoji.test.ts`: nenhum `.tsx` em `src` contém emoji (falha agora).
- [ ] Tokens claros/escuros, Manrope, `dark` = media query; substituir cores fixas por tokens; estados com tokens.
- [ ] Cabeçalho claro, menu com realce discreto. tsc/eslint/unit → commit.

### Task 2: Sem emojis nem "magia" da IA
**Files:** `ideas/generate-bar.tsx`, `ideas/idea-card.tsx`, `calendar/*`, `composer/{ai-panel,refine-menu,best-time}.tsx`, `definicoes/marcas/brand-ai-section.tsx`, e2e.
- [ ] Ícones lucide; rótulos: "Ideias para um prazo", "Vídeos curtos", "Planear a próxima semana", "Melhor hora", "Próximo horário livre", "Reescrever", "Sugerir com IA", "Criar a partir do Instagram". no-emoji passa → commit.

### Task 3: Editor
**Files:** `composer/composer.tsx` (+ `composer/action-bar.tsx`, `composer/use-local-draft.ts`), `posts/data.ts`, `biblioteca/actions.ts` (`listBrandMedia(brandId)`), `src/lib/posts/local-draft.ts` (+test).
**Produces:** `localDraftKey(postId|null, brandId)`, `readLocalDraft/writeLocalDraft/clearLocalDraft` (puras sobre `Storage`), testes: chave por post, ignora rascunho igual ao guardado, limpa ao guardar.
- [ ] Testes → FAIL → implementar → PASS. Cartões, painel IA fechado, barra fixa com menu "Mais", biblioteca lazy. commit.

### Task 4: Calendário
**Files:** `calendario/page.tsx`, `calendar/{calendar-view,calendar-mobile}.tsx`, novos `calendar/{calendar-list,calendar-filters,free-slot}.tsx`, `src/lib/calendar/filters.ts` (+test), `src/lib/calendar/free-slots.ts` (+test), `posts/novo/page.tsx` (`hora=`).
**Produces:** `parseFilters(sp) → { platforms: Platform[]; statuses: PostStatus[] }`, `applyFilters(posts, f)`, `freeSlotsByDay({ slots, tz, days, posts, now }) → Record<day, time[]>`.
- [ ] Testes → FAIL → implementar → PASS. Cartão novo, "+ hora", vista Lista (omissão no telemóvel), filtros. commit.

### Task 5: Verificação e publicação
- [ ] e2e ajustados; capturas 390 px e desktop, claro/escuro; publicar; revisão final independente; corrigir.
