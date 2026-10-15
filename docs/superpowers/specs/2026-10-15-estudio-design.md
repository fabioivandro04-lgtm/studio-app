# Estúdio — App pessoal de gestão e publicação de conteúdo

**Data:** 2026-10-15
**Estado:** Especificação para revisão
**Dono:** Fabio Ivandro (utilizador único)

---

## 1. Objetivo

Uma app web pessoal para **organizar, agendar, publicar e medir** conteúdo em várias marcas e
contas, a partir de um único painel. O conteúdo (vídeos, imagens, carrosséis) é criado fora da
app (Canva, CapCut, etc.) e carregado na app.

**Critérios de sucesso da versão 1**
1. Carregar um vídeo uma vez e agendá-lo para Instagram, TikTok e YouTube Shorts, com legenda
   diferente em cada rede, em menos de 2 minutos.
2. Na hora marcada, o Instagram publica sozinho; TikTok e YouTube recebem o vídeo e a app indica
   claramente o "1 toque" que falta.
3. Ver num ecrã, por marca, quais posts tiveram mais visualizações, alcance e seguidores ganhos.
4. Nunca perder um post em silêncio: qualquer falha aparece no painel com o motivo em português.

## 2. O que disse o utilizador vs. o que assumimos

**Disse:** só para ele por agora; Instagram + TikTok + YouTube; várias marcas (Unidreamity e uma
conta de "viral shorts"); cria o conteúdo fora; eu construo tudo; tipos de conteúdo misturados.

**Assumido:** app web instalável no telemóvel (PWA); Supabase + Vercel; interface em português de
Portugal; fuso horário padrão Africa/Maputo; IA e automação de DMs ficam para fases seguintes.

## 3. Âmbito

### Dentro da versão 1
- **Marcas**: criar várias marcas (nome, cor, fuso horário). Cada uma com contas, mídia e métricas próprias.
- **Contas**: ligar contas Instagram (profissional), TikTok e YouTube por OAuth; mais de uma por rede.
- **Biblioteca de mídia** por marca, com etiquetas.
- **Criar post**: mídia + redes de destino + formato + legenda/título por rede + data/hora.
- **Calendário** (semana/mês), todas as marcas ou filtrado, com estados e prazos.
- **Prazos** (datas importantes por marca, ex.: prazos de candidatura da Unidreamity).
- **Publicação agendada** com tentativas automáticas e registo de erros.
- **Ações pendentes**: lista do que precisa de "1 toque" no TikTok/YouTube.
- **Métricas** por post, por conta e por marca.
- **Login** exclusivo do dono.
- **Páginas legais** (política de privacidade, termos) exigidas pelo TikTok e pela Google.

### Fora da versão 1 (fases seguintes)
- Criação com IA (ideias, roteiros, legendas).
- DMs e comentário → DM no Instagram.
- Outras redes (LinkedIn, Facebook, etc.).
- Vários utilizadores / equipa.
- Servidor MCP para usar a app a partir do Claude.
- Publicação 100% automática no TikTok/YouTube (depende das auditorias — ver §5).

## 4. Arquitetura

```
┌───────────────────────────────┐
│ Painel Next.js (PWA) — Vercel │  páginas + rotas de API (OAuth, tick, métricas)
└──────────────┬────────────────┘
               │
┌──────────────▼────────────────────────────────────────────┐
│ Supabase                                                  │
│  • Postgres (dados + RLS)                                 │
│  • Auth (magic link, só o email do dono)                  │
│  • Storage (bucket privado "media")                       │
│  • pg_cron + pg_net: chama /api/cron/* com segredo        │
└──────────────┬────────────────────────────────────────────┘
               │
   Instagram Graph API · TikTok Content Posting/Display API · YouTube Data/Analytics API
```

**Decisões**
- **Um só código (Node/TypeScript)** no Next.js. As tarefas agendadas são rotas de API protegidas
  por `CRON_SECRET`, chamadas pelo `pg_cron` do Supabase (a Vercel gratuita só permite cron 1x/dia).
  - `POST /api/cron/tick` — a cada minuto: avança publicações.
  - `POST /api/cron/metrics` — 1x por dia: recolhe métricas.
  - `POST /api/cron/tokens` — 1x por dia: renova tokens.
- **Publicação como máquina de estados**: cada destino (`post_target`) avança um passo por tick
  (criar contentor, enviar parte do vídeo, verificar processamento, publicar). Nenhum pedido
  fica bloqueado à espera; vídeos grandes são enviados em partes ao longo de vários ticks.
  Os destinos devidos são reclamados com `FOR UPDATE SKIP LOCKED` para nunca publicar duas vezes.
- **Cada rede é um módulo** com a mesma interface:
  ```ts
  interface PlatformAdapter {
    validate(target, media): ValidationError[]      // regras da rede, antes de agendar
    advance(target, ctx): Promise<AdvanceResult>     // um passo da máquina de estados
    fetchMetrics(target | account, ctx): Promise<MetricsSnapshot>
    refreshToken(account): Promise<TokenSet>
  }
  ```
  Isto permite testar tudo com adaptadores falsos e acrescentar redes depois.
- **Mídia**: o browser carrega diretamente para o Supabase Storage (upload resumível). Para
  publicar, a app gera um URL assinado temporário (Instagram) ou lê o ficheiro em partes e envia-o
  (TikTok `FILE_UPLOAD`, YouTube upload resumível). Imagens PNG/WebP são convertidas para JPEG no
  browser antes do upload (o Instagram só aceita JPEG). O armazenamento fica atrás de uma
  interface `MediaStorage` para poder trocar por Cloudflare R2 se os limites apertarem.
- **Tokens** encriptados na base de dados com AES-256-GCM (chave `TOKEN_ENC_KEY` só no servidor).
  Nunca são enviados para o browser.

## 5. Regras de cada rede (verificadas em 2026-10-15)

### Instagram (API com login do Instagram)
- Conta profissional (empresa ou criador). Permissões: `instagram_business_basic`,
  `instagram_business_content_publish` (ativar à mão). Acesso padrão chega para contas próprias —
  sem revisão da Meta.
- Formatos: imagem (JPEG), carrossel (2–10 itens, conta como 1 post), Reel (vídeo), Story.
- Fluxo: criar contentor com URL público → (vídeo) consultar `status_code` até `FINISHED` →
  `media_publish`.
- Limite de posts pela API: consultar `content_publishing_limit` antes de publicar (documentação
  indica 100/24h, há referências a 50 — usar o valor devolvido).
- Legenda ≤ 2200 caracteres, ≤ 30 hashtags.
- Token de longa duração (~60 dias), renovado automaticamente.
- Métricas: alcance, visualizações, gostos, comentários, guardados, partilhas; seguidores da conta.
  Limite de chamadas proporcional às impressões → recolher 1x/dia e guardar.

### TikTok (Content Posting API + Display API)
- Sem auditoria: publicação direta só para contas **privadas** e só `SELF_ONLY`.
- **Versão 1 usa o modo caixa de entrada** (`video.upload`): a app envia o vídeo; o TikTok
  notifica o utilizador, que conclui a publicação na app TikTok. Estado na app: "Aguarda 1 toque".
- Transferência por `FILE_UPLOAD` (partes), porque `PULL_FROM_URL` exige domínio verificado.
- No modo caixa de entrada a API **não aceita legenda**: a app mostra a legenda em "Ações
  pendentes" com botão "Copiar legenda" para colar na app TikTok.
- O TikTok não devolve logo o ID do post final → a app associa-o mais tarde via `video.list`
  (primeiro vídeo criado depois do envio e ainda não associado) e, quando o encontra, marca o
  destino como publicado; se não conseguir, o utilizador escolhe o vídeo de uma lista
  ("Associar vídeo").
- YouTube: a recolha diária de métricas verifica se o vídeo já está público e, nesse caso, marca o
  destino como publicado automaticamente.
- Métricas (Display API): visualizações, gostos, comentários, partilhas por vídeo; seguidores.
- Tokens: acesso 24h, renovação ~365 dias.
- Futuro: pedir auditoria → modo `DIRECT_POST` público (a máquina de estados já o suporta por opção).
- Exige URLs de política de privacidade e termos — servidos pela própria app (`/legal/*`).

### YouTube (Data API v3 + Analytics API)
- Sem auditoria da Google: vídeos enviados pela API ficam **privados**, mesmo pedindo público.
- **Versão 1**: a app envia o Short como privado; estado "Aguarda 1 toque" com link direto para o
  YouTube Studio. Depois da auditoria, envia como público ou com `publishAt`.
- Shorts: vertical, ≤ 3 min. Título ≤ 100 caracteres, descrição ≤ 5000.
- Quota: valores públicos contraditórios → a app regista o consumo, mostra-o, e pára antes de
  exceder, com mensagem clara.
- Métricas: visualizações, gostos, comentários, tempo de visualização, subscritores ganhos.
- **Importante**: o ecrã de consentimento OAuth deve estar "Em produção" (não "Testing"), caso
  contrário o token de renovação expira em 7 dias.

## 6. Modelo de dados

Todas as datas em UTC; apresentadas no fuso da marca.

| Tabela | Campos principais |
|---|---|
| `brands` | id, name, color, timezone, created_at |
| `social_accounts` | id, brand_id, platform (`instagram`/`tiktok`/`youtube`), external_id, handle, display_name, avatar_url, access_token_enc, refresh_token_enc, token_expires_at, refresh_expires_at, scopes, status (`active`/`needs_reauth`/`disabled`) |
| `media_assets` | id, brand_id, storage_path, kind (`image`/`video`), mime, size_bytes, width, height, duration_s, thumbnail_path, tags[] |
| `posts` | id, brand_id, internal_title, scheduled_at, status (`draft`/`scheduled`/`publishing`/`needs_action`/`published`/`partial`/`failed`/`cancelled`) |
| `post_media` | post_id, media_id, position |
| `post_targets` | id, post_id, social_account_id, format (`ig_image`/`ig_carousel`/`ig_reel`/`ig_story`/`tiktok_video`/`yt_short`), caption, title, options (jsonb), status (`pending`/`uploading`/`processing`/`awaiting_user`/`published`/`failed`), progress (jsonb — passo atual, IDs de contentor, URL e índice de upload), attempts, next_attempt_at, external_post_id, permalink, last_error, published_at |
| `deadlines` | id, brand_id, title, country, institution, due_date, url, notes |
| `post_metrics` | post_target_id, collected_on, views, reach, likes, comments, shares, saves, watch_time_s, raw (jsonb) |
| `account_metrics` | social_account_id, collected_on, followers, views, raw (jsonb) |
| `activity_log` | id, brand_id, level, source, message, context (jsonb), created_at |
| `api_usage` | social_account_id, day, kind, count — para quotas (YouTube, Instagram) |

O estado do `post` é derivado dos seus destinos (ex.: um publicado e outro a aguardar → `needs_action`).

**Segurança**: RLS em todas as tabelas, permitindo acesso apenas ao utilizador dono
(`auth.uid()` = id guardado em `app_owner`). Registos desativados no Supabase Auth; o dono é
criado por convite. As rotas de cron usam a service role e validam `CRON_SECRET`.

## 7. Ecrãs

1. **Calendário** (início) — semana/mês; filtro por marca; cartões com miniatura, ícones das redes
   e estado; prazos a dourado; arrastar para reagendar.
2. **Novo / editar post** — escolher marca → mídia (da biblioteca ou carregar) → redes e formato →
   legenda por rede (com contador e avisos de regras) → data/hora → pré-visualização → agendar ou
   guardar rascunho. Botão "copiar legenda para todas as redes".
3. **Biblioteca** — grelha por marca, filtros por tipo e etiqueta, carregar vários ficheiros.
4. **Ações pendentes** — itens "Aguarda 1 toque" (TikTok/YouTube) e falhas, com botões
   "Abrir no TikTok/YouTube Studio", "Marcar como feito", "Tentar de novo", "Associar vídeo".
5. **Métricas** — por marca: totais do período, evolução de seguidores, top posts, tabela por post.
6. **Definições** — marcas, contas ligadas (estado do token, religar), prazos, registo de atividade.
7. **Legal** — `/legal/privacidade`, `/legal/termos` (públicas).

Visual: azul-marinho e âmbar (identidade Unidreamity) como tema base; cor própria por marca.
Funciona bem no telemóvel.

## 8. Fluxos principais

**Agendar**: guardar post + destinos → `validate()` de cada adaptador → se houver erros, mostrar
e não agendar → estado `scheduled`.

**Tick (a cada minuto)**: reclamar destinos com `scheduled_at ≤ agora` e `next_attempt_at ≤ agora`
→ para cada um, `advance()` → gravar novo estado/progresso → registar no `activity_log`.

**Erros**:
- Erro temporário (rede, 5xx, limite): tentar de novo com espera crescente (1, 5, 15 min); após 3
  falhas → `failed` com mensagem em português.
- Erro permanente (formato inválido, permissão em falta): `failed` imediato com explicação e ação
  sugerida.
- Token inválido/revogado: conta → `needs_reauth`; aviso no topo "Volte a ligar <conta>"; posts
  dessa conta ficam em espera até religar.
- Limite de publicação/quota atingido: adiar para quando houver quota, com aviso.

**Métricas (diário)**: para cada conta ativa, recolher métricas da conta e dos posts publicados nos
últimos 30 dias; associar posts TikTok sem ID.

**Tokens (diário)**: renovar os que expiram nos próximos 7 dias (IG) ou antes do uso (TikTok,
YouTube); falha → `needs_reauth`.

## 9. Testes

- **Unitários (Vitest)**: validação de cada rede; máquinas de estado dos adaptadores com respostas
  HTTP simuladas (sucesso, processamento lento, erros temporários/permanentes, token expirado);
  derivação do estado do post; encriptação de tokens; fusos horários.
- **Base de dados**: testes às políticas RLS e à reclamação sem duplicados.
- **Ponta a ponta (Playwright)**: criar marca → carregar mídia → agendar → tick com adaptadores
  falsos → ver "publicado" no calendário.
- **Teste real** (com o dono): uma publicação verdadeira em cada rede numa conta de teste.

## 10. Passos que só o dono pode fazer (guiados)

1. Instagram: converter para conta profissional; criar app no Meta for Developers; adicionar a
   conta como testadora; ativar a permissão de publicação.
2. TikTok: criar app no TikTok for Developers (Login Kit + Content Posting API, scopes
   `user.info.basic`, `user.info.stats`, `video.upload`, `video.list`); submeter para aprovação com
   os URLs legais.
3. Google: criar projeto no Google Cloud; ativar YouTube Data API v3 e YouTube Analytics API;
   ecrã de consentimento "Em produção".
4. Supabase e Vercel: autorizar a criação do projeto (já ligados a este ambiente).
5. Um repositório GitHub para guardar o código (este ambiente é temporário).

## 11. Riscos e limites conhecidos

- **Supabase gratuito**: ficheiros até 50 MB, 1 GB de armazenamento, 5 GB de tráfego/mês. Vídeos
  maiores ou muito volume → plano Pro (~25 USD/mês) ou trocar para Cloudflare R2 (interface pronta).
  A app avisa ao carregar ficheiros acima do limite.
- **Vercel Hobby** é para uso não comercial; para uso da empresa pode ser necessário o plano Pro.
- **Auditorias TikTok/Google** podem demorar ou ser recusadas; a versão 1 funciona sem elas.
- **Regras das APIs mudam**; cada adaptador concentra as regras da sua rede para facilitar ajustes.
- **Conteúdo reutilizado** (repostar clips de terceiros) pode levar a remoções e perda de
  monetização — é uma questão de estratégia de conteúdo, não da app.

## 12. Tecnologia

Next.js (App Router, TypeScript), Tailwind CSS + shadcn/ui, Supabase (Postgres, Auth, Storage,
pg_cron, pg_net), Vercel, Vitest, Playwright, date-fns-tz.
