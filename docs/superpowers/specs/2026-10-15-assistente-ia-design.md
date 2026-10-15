# Estúdio — Assistente de IA no post (design)

Data: 2026-10-15 · Estado: aprovado em conversa, a aguardar revisão escrita

Primeiro de três subprojetos pedidos pelo dono (ordem: 1. Assistente IA no post → 2. Ideias e plano com IA
→ 3. Mais rápido e fluido). Este documento cobre só o subprojeto 1.

## 1. Objetivo e critérios de sucesso

O dono cria o conteúdo fora da app e usa o Estúdio para agendar. Quer que a app o ajude a escrever **título,
legenda e hashtags** e a escolher **o melhor dia e hora**, no estilo de cada marca.

O que o dono disse:
- Motor: **OpenRouter** (uma chave, vários modelos).
- Pedido: **uma frase + a IA vê a imagem** (ou a capa do vídeo).
- Cada marca tem um **contexto da empresa** escrito por ele e uma **voz da marca**, que a IA pode rascunhar a
  partir das últimas legendas do Instagram.
- "Conversão" depende da marca: Unidreamity = **contactos**; marca de shorts = **alcance**.

Sucesso quando:
1. Com uma frase e uma imagem, em ≤ 15 s aparecem 3 legendas por rede escolhida, títulos e hashtags em pt-PT,
   coerentes com o contexto e a voz da marca.
2. Tocar numa sugestão preenche o campo; nada é publicado ou agendado sem o dono carregar em **Agendar**.
3. "Melhor hora" devolve 3 horários futuros com explicação, de forma instantânea e sem custo.
4. O gasto mensal nunca passa do limite definido pelo dono.

Fora de âmbito (subprojetos seguintes ou depois): ideias/plano a partir de prazos, geração de imagens,
respostas a comentários, resumo semanal.

## 2. Experiência do utilizador

### 2.1 Definições → Marcas (por marca)
Novos campos, numa secção "Assistente de IA" de cada cartão de marca:
- **Contexto da empresa** (texto livre, até 4000 caracteres): serviços, países, público, ofertas, contactos.
- **Voz da marca** (texto livre, até 2000 caracteres): tom, chamada para ação, palavras a evitar.
  Botão **"✨ Criar a partir do Instagram"**: lê até 20 legendas recentes da conta Instagram ativa da marca e
  escreve um rascunho no campo (não grava sozinho; o dono revê e carrega em Guardar). Sem conta Instagram
  ativa, o botão aparece desativado com a explicação.
- **Hashtags fixas** (lista, até 10): entram sempre nas sugestões.
- **Objetivo**: `Contactos` (por omissão) ou `Alcance`.

### 2.2 Definições → IA (página nova)
- Modelo: **Normal — Claude Sonnet 5.5** (`anthropic/claude-sonnet-5.5`, por omissão) ou
  **Económico — Claude Haiku 5.5** (`anthropic/claude-haiku-5.5`). Campo avançado para outro id do OpenRouter.
- **Limite mensal** em USD (por omissão 5). Mostra o gasto do mês atual e o nº de pedidos.
- Estado da chave: "Ligada" / "Falta a chave OPENROUTER_API_KEY na Vercel" (nunca mostra a chave).

### 2.3 Novo post / editar post — painel "✨ Assistente"
Visível quando o post não está bloqueado. Fica entre "1. Mídia" e "2. Redes e legendas".
1. Campo **"Sobre o que é este post?"** (até 300 caracteres) + botão **Gerar**.
   - Usa as redes já marcadas; se nenhuma estiver marcada, usa as contas ativas da marca.
   - Usa a primeira mídia escolhida (imagem, ou capa do vídeo) se existir.
2. Enquanto espera: cartão com animação "A escrever…" (sem bloquear o resto do ecrã).
3. Resultado, por rede: **3 legendas** em cartões; tocar em **Usar** coloca a legenda no campo da rede
   (substitui; o texto anterior fica disponível com "Desfazer" no toast).
   - **Título interno** sugerido: botão "Usar" preenche o título interno.
   - **Título do YouTube** (≤ 100 caracteres) quando há YouTube.
   - **Hashtags** como etiquetas alternáveis; "Adicionar à legenda" acrescenta as escolhidas no fim.
4. Ações rápidas em cada campo de legenda (menu ✨): **Encurtar · Mais chamativo · Mais profissional ·
   Adicionar chamada para ação · Traduzir para inglês**. Resultado substitui a legenda, com "Desfazer".
5. Botão **"🕐 Melhor hora"** junto a "3. Quando": mostra 3 chips (ex.: "Qui 19:00 — os teus posts às
   quintas à noite tiveram 2× mais contactos"). Tocar preenche data e hora. Etiqueta "sugestão inicial"
   enquanto houver poucos dados (ver §4.4).

Mensagens de erro (toast, pt-PT): sem chave, limite atingido, IA indisponível, resposta inválida. Em nenhum
caso o conteúdo do post é alterado por um erro.

## 3. Abordagens consideradas

1. **Server actions do Next.js a chamar o OpenRouter (escolhida).** Simples, chave só no servidor, reutiliza
   autenticação/RLS existentes. Resposta não-streaming em JSON estruturado → fácil de validar.
2. Rota com streaming de texto: sensação mais rápida, mas o JSON parcial complica a validação e o mapeamento
   para cartões. Pode ser acrescentado depois só para "ações rápidas".
3. Supabase Edge Function: mais uma peça para manter e mais um sítio para a chave. Sem ganho aqui.

## 4. Arquitetura

### 4.1 Dados (migração `0009_ai.sql`)
- `brands`: `ai_context text not null default ''`, `ai_voice text not null default ''`,
  `ai_hashtags text[] not null default '{}'`, `goal text not null default 'contacts' check (goal in
  ('contacts','reach'))`, com `check` de tamanho (4000/2000/10 itens).
- `app_settings` (uma linha, `id boolean primary key default true check (id)`): `ai_model text not null
  default 'anthropic/claude-sonnet-5.5'`, `ai_monthly_limit_usd numeric(8,2) not null default 5`.
  A migração insere a linha única. RLS: só o dono lê/escreve.
- `ai_usage`: `id`, `created_at`, `brand_id` (nullable, `on delete set null`), `kind text` (`suggest`,
  `refine`, `voice`), `model text`, `input_tokens int`, `output_tokens int`, `cost_usd numeric(10,6)`.
  RLS: dono lê; inserção feita pela server action com o cliente do utilizador (política de insert só para o
  dono).
- `post_metrics`: `profile_visits bigint`, `follows bigint` (nulos quando a rede não fornece).

### 4.2 Módulos (`src/lib/ai/`)
- `openrouter.ts` — `chat({ model, messages, schema, maxTokens, fetch })`: POST
  `https://openrouter.ai/api/v1/chat/completions` com `Authorization: Bearer`, `HTTP-Referer: APP_URL`,
  `X-Title: Estúdio`, `response_format: { type: 'json_schema', json_schema: { strict: true, … } }`,
  `usage: { include: true }`. Timeout 45 s. Devolve `{ data, usage: { inputTokens, outputTokens, costUsd } }`.
  Erros → `AiError` com código (`no_key`, `budget`, `unavailable`, `invalid_response`, `rate_limited`) e
  mensagem pt-PT. Resposta validada com zod; se falhar a validação → `invalid_response`.
- `prompts.ts` — funções puras que montam as mensagens:
  - sistema: papel (gestor de redes sociais lusófono), **português de Portugal** (evitar brasileirismos:
    "você"/gerúndio/"time"/"cadastro"…), contexto da empresa, voz, objetivo, hashtags fixas, regras por rede
    (§4.3), e "nunca inventar preços, datas ou promessas que não estejam no contexto ou no pedido".
  - utilizador: frase do dono + lista de redes/formatos + imagem como `image_url` (URL assinada 10 min).
- `rules.ts` — regras por rede: limites de legenda (IG 2200, TikTok 2200, YT descrição 5000, título 100),
  nº de hashtags recomendado (IG 3–5, TikTok 3–5, YouTube 3), estilo (IG: gancho na 1.ª linha; TikTok: curta;
  YouTube: título com palavra-chave + descrição).
- `schemas.ts` — zod + JSON Schema equivalentes para: `Suggestions` (`internalTitle`, `youtubeTitle?`,
  `byPlatform: { platform, captions[3], hashtags[] }[]`), `Refined` (`text`), `Voice` (`voice`).
  Pós-processamento: cortar ao limite da rede, normalizar hashtags (`#`, sem espaços, sem duplicados,
  juntar hashtags fixas no início).
- `budget.ts` — `assertWithinBudget(db)`: soma `ai_usage.cost_usd` do mês civil (UTC) e compara com o limite;
  `recordUsage(db, …)`.
- `fake.ts` — fornecedor falso (respostas fixas, custo 0) usado quando `PLATFORM_MODE=fake` ou nos testes.

### 4.3 Server actions (`src/app/(app)/ai/actions.ts`)
- `suggestPost({ brandId, prompt, mediaId?, platforms[] })` → `Suggestions`.
- `refineCaption({ brandId, platform, text, action })` → `{ text }`; `action ∈ shorten | catchy |
  professional | cta | english`.
- `draftVoice({ brandId })` → `{ voice }` (usa `igRecentPosts`, até 20 legendas, via o token da conta;
  sem conta IG ativa → erro claro).
- `saveAiSettings`, `saveBrandAi` (validação zod).
Cada action: confirma sessão do dono (RLS), verifica chave e orçamento, chama `openrouter.chat`, grava
`ai_usage`, devolve `{ ok: true, … } | { ok: false, error }`.

### 4.4 Melhor hora (`src/lib/ai/best-time.ts`, sem IA)
`suggestSlots({ history, goal, tz, busy, now, defaults })` → até 3 `{ date, time, reason, source }`.
- `history`: destinos publicados da marca com a última métrica de cada um e a hora local de publicação.
- Pontuação por post: `contacts` = `profile_visits + follows*3 + shares*2 + saves*2 + comments` (campos nulos
  contam 0); `reach` = `reach ?? views ?? 0`.
- Agrupa por (dia da semana, hora). Se houver ≥ 10 posts com métricas: classifica as faixas pela mediana
  (mín. 2 posts por faixa) e explica em relação à mediana geral ("2× mais contactos").
- Caso contrário usa a tabela inicial por objetivo (horas locais do fuso da marca), pensada para estudantes e
  jovens adultos de Moçambique/Angola/Cabo Verde: dias úteis 12:30 e 19:00–20:30, sábado 11:00 e 18:00,
  domingo 17:00–19:00 (alcance também 21:00). Marca `source: 'initial'`.
- Gera candidatos nos próximos 7 dias, ≥ 1 h a partir de agora, a ≥ 2 h de posts agendados da mesma marca,
  e devolve os 3 melhores em dias diferentes quando possível.
- Action `bestTimes({ brandId, excludePostId? })` lê os dados e chama `suggestSlots`.

### 4.5 Métricas extra do Instagram
`igPostMetrics` faz a chamada atual sem alterações e uma segunda chamada opcional
`metric=profile_visits,follows`; qualquer erro nessa segunda chamada é ignorado (campos ficam nulos).
`metrics-repo` grava os dois campos novos.

## 5. Segurança e custos
- `OPENROUTER_API_KEY` só em `serverEnv` (opcional; sem ela as funções de IA mostram "Falta a chave").
- URLs de imagem assinadas com validade de 10 min; nunca se envia a mídia original de vídeo.
- Pedido do dono limitado a 300 caracteres; contexto/voz com limites de tamanho → custo previsível.
- `max_tokens`: 1500 (suggest), 600 (refine), 800 (voice).
- Orçamento verificado antes de cada chamada; o custo real devolvido pelo OpenRouter é gravado depois.
  (Uma chamada pode ultrapassar o limite no máximo pelo seu próprio custo.)

## 6. Erros
| Situação | Mensagem ao dono |
|---|---|
| Sem chave | "Falta ligar a IA: adicione OPENROUTER_API_KEY na Vercel." |
| Limite mensal | "Chegou ao limite mensal de IA (X USD). Aumente em Definições → IA." |
| 401/402 do OpenRouter | "A conta OpenRouter não tem crédito ou a chave é inválida." |
| 429 / 5xx / timeout | "A IA está ocupada. Tente de novo dentro de momentos." |
| Resposta fora do formato | "A IA respondeu de forma inesperada. Tente de novo." |

## 7. Testes
- Unidade (Vitest): `prompts` (inclui contexto/voz/objetivo/regras; pt-PT), `schemas` + pós-processamento
  (cortes, hashtags), `openrouter` com fetch falso (sucesso, 401, 402, 429, timeout, JSON inválido, custo),
  `budget`, `best-time` (sem dados → tabela inicial; com dados → melhores faixas; evita posts próximos;
  fuso), `igPostMetrics` (segunda chamada falha → campos nulos).
- Base de dados: migração 0009 (defaults, checks, RLS de `app_settings` e `ai_usage`).
- E2E (fornecedor falso): gerar sugestões e usar legenda/hashtags; ação rápida com desfazer; melhor hora
  preenche data/hora; voz da marca rascunhada e guardada; limite atingido mostra mensagem.
- No fim, um único teste real em produção com a chave do dono.

## 8. Configuração (o dono faz uma vez)
1. Conta em openrouter.ai, crédito (ex.: 5 USD), criar chave.
2. Vercel → `OPENROUTER_API_KEY` (sensível). Redeploy.
3. Definições → Marcas: preencher contexto, gerar/rever voz, escolher objetivo.
