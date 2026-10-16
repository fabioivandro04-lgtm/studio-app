# MCP do Estúdio — design

O dono aprovou ("avança") um MCP próprio do Estúdio para o Claude (claude.ai e Claude Code) montar posts na app
a partir dos designs feitos no Claude. Os designs nascem no claude.ai e os ficheiros finais são trabalhados no
Claude Code (resposta "C").

## 1. Objetivo e regras
- O Claude lê o contexto do Estúdio (calendário, horários fixos, métricas, voz da marca, hashtags, Biblioteca,
  Ideias, Prazos, estado das publicações) e cria **rascunhos** de posts com ficheiros, redes, legendas, data/hora
  e capa do Reel.
- **Só rascunhos** (resposta "A"): o dono revê e agenda na app. O MCP nunca agenda, publica, cancela ou apaga,
  nem mexe em Definições, contas ligadas ou chaves.
- Sucesso: numa conversa, "monta estes 5 posts para a próxima semana" termina com 5 rascunhos certos no
  calendário, marcados "Criado pelo Claude", sem o dono copiar chaves nem ficheiros à mão.

## 2. Arquitetura
- Rota `src/app/api/mcp/route.ts` (Streamable HTTP, sem estado) com `@modelcontextprotocol/sdk` via
  `mcp-handler`. Endereço: `APP_URL/api/mcp`. Mesmo endereço no claude.ai (Conectores) e no Claude Code
  (`claude mcp add --transport http estudio APP_URL/api/mcp`).
- Ferramentas em `src/lib/mcp/tools/*.ts`, uma por ficheiro, cada uma: esquema zod de entrada, função pura ou
  repo existente, resposta em texto curto pt-PT + JSON estruturado. Reutilizam os repos e funções da app
  (`checkPost`, `validateTarget`, `freeSlotsInRange`, `listIdeas`, `upcomingDeadlines`, `buildGrid`, métricas).
- `proxy.ts`: `/api/mcp` e `/.well-known/oauth-protected-resource*` passam a públicos (a rota valida o token).

## 3. Autenticação
- **Supabase Auth OAuth 2.1 server** (com registo dinâmico de clientes). Passo do dono no painel do Supabase:
  Authentication → OAuth Server → ligar; ligar "Dynamic client registration"; Authorization URL =
  `APP_URL/oauth/autorizar`.
- `/.well-known/oauth-protected-resource` (RFC 9728) aponta para `https://<ref>.supabase.co/auth/v1`.
  Sem token ou token inválido → 401 com `WWW-Authenticate: Bearer resource_metadata="…"`.
- Página `src/app/oauth/autorizar/page.tsx`: exige login do dono (redireciona para `/login?next=…`), mostra
  "O <cliente> quer aceder ao seu Estúdio" com a lista do que pode fazer, botões **Permitir** / **Recusar**
  (APIs `auth.oauth.getAuthorizationDetails / approveAuthorization / denyAuthorization`).
- Na rota MCP: `getClaims(token)` (verificação local ES256); exige `sub` = dono (`app_owner`) e claim
  `client_id` presente (token OAuth, não sessão da app). O cliente Supabase usado pelas ferramentas leva o token
  do utilizador, por isso o RLS (`private.is_owner()`) aplica-se a tudo.
- **Defesa na BD** (migração `0014_mcp.sql`): políticas restritivas para tokens com `client_id` (função
  `private.is_agent()` = `auth.jwt() ? 'client_id'`): sem `delete` em nenhuma tabela; em `posts` (e nos
  seus `post_targets`/`post_media`) só insert/update quando o post está e fica em `status = 'draft'`; sem
  escrita em `social_accounts`, `brands`, `app_settings`, `hashtag_groups`; `save_post` recusa
  `intent = 'schedule'` quando `is_agent()`. Assim, mesmo um pedido direto à API do Supabase com o token do
  Claude não consegue agendar nem apagar.
- `posts.origin text not null default 'app' check (origin in ('app','claude'))`; o calendário e o editor mostram
  "Criado pelo Claude".
- **Definições → Ligações do Claude**: lista os clientes autorizados (`auth.oauth.listGrants`) com data e botão
  **Cortar acesso** (`revokeGrant`).

## 4. Ferramentas
Leitura:
| nome | faz |
|---|---|
| `marcas` | marcas com fuso, contas ligadas (rede, @), horários fixos |
| `contexto_marca` | voz/contexto da marca, grupos de hashtags |
| `calendario` | posts entre duas datas (≤ 62 dias): data/hora local, estado, redes, título, origem |
| `horarios_livres` | horários fixos livres entre duas datas (`freeSlotsInRange`, ocupado = ±1 h) |
| `metricas` | totais por rede e top posts dos últimos N dias (≤ 90), melhores horas |
| `biblioteca` | ficheiros da marca (id, nome, tipo, medidas, duração, data), filtro por texto/tipo, ≤ 50 |
| `ideias` | ideias por estado |
| `prazos` | prazos entre duas datas |
| `estado_publicacoes` | últimos 14 dias: publicados, falhados (motivo), à espera de toque (TikTok/YouTube) |
| `grelha_instagram` | descrição em texto dos próximos 12 quadrados (planeados + publicados) |
| `resumo_semana` | o que saiu, números principais, rascunhos por agendar, próximos prazos |
| `verificar_post` | corre `checkPost` com `intent = 'schedule'` sem gravar e devolve avisos em pt-PT |

Escrita (sempre só rascunhos):
| nome | faz |
|---|---|
| `pedir_envio` | `{ brandId, nome, tipo mime, tamanho }` → valida (tipos e limite `NEXT_PUBLIC_MAX_UPLOAD_MB`), devolve URL de envio assinada do Storage (válida 2 h, só esse caminho) + comando `curl` exato |
| `confirmar_envio` | lê o ficheiro enviado, extrai medidas/duração no servidor (imagem: cabeçalho; vídeo MP4/MOV: átomos `moov`), cria a linha em `media_assets`; ficheiro em falta ou inválido → apaga e explica |
| `importar_de_link` | descarrega um URL público https (≤ limite, tipos aceites, sem redes privadas) para o Storage e faz o mesmo que `confirmar_envio` |
| `criar_rascunho` | `{ brandId, titulo, mediaIds, data, hora, redes: [{ conta, formato, legenda, titulo?, capaMs? }], ideiaId? }` → `save_post` com `intent = 'draft'`, `origin = 'claude'`; devolve os avisos de `verificar_post` e o link `APP_URL/posts/<id>`; com `ideiaId` marca a ideia como usada e liga-a ao post |
| `editar_rascunho` | mesmos campos, só para posts em `draft` |
| `guardar_ideia` | cria ideia `new` (título, gancho, guião, legenda, formato, redes) |
| `criar_prazo` | cria prazo (título, data, instituição/país opcionais) |

Regras comuns: datas `AAAA-MM-DD` e horas `HH:MM` no fuso da marca; ids desconhecidos ou de outra marca →
erro claro; respostas curtas (o Claude explica ao dono). Erros nunca expõem detalhes internos.

## 5. Ficheiros
- **Claude Code**: `pedir_envio` → `curl -X PUT --data-binary @ficheiro "<url>"` → `confirmar_envio`.
- **claude.ai**: Biblioteca existente ou `importar_de_link`.
- Imagens HEIC não aceites pelo MCP (pedir JPG/PNG). Sem miniatura de vídeo gerada no servidor (a grelha usa o
  ícone, como hoje quando o browser não consegue ler o vídeo).

## 6. Erros e limites
- Limite de 60 chamadas/minuto por token (memória da função; aviso "Muitos pedidos, aguarde um minuto").
- Registo em `activity_log` (`source = 'mcp'`) de cada escrita: "Claude criou o rascunho «…»".
- Token expirado → 401 (o cliente renova sozinho). Dono que corta o acesso → próximos pedidos 401.

## 7. Testes e verificação
- Unitários: cada ferramenta (entrada inválida, marca errada, sucesso), leitura de medidas de MP4/MOV/PNG/JPEG,
  descrição da grelha, resumo da semana, rate limit.
- BD (`supabase/tests/mcp.test.ts`): com JWT de agente não consegue agendar, apagar, mexer em contas/marcas;
  com JWT normal tudo continua igual; `origin` por omissão `app`.
- Rota: 401 + metadata sem token; token de sessão normal (sem `client_id`) recusado; lista de ferramentas.
- Produção: cliente MCP de teste (SDK) com o utilizador de teste: OAuth completo, `calendario`, `pedir_envio` +
  `curl` + `confirmar_envio`, `criar_rascunho`, verificar o rascunho na app; revisão final independente.
- Guia para o dono (pt-PT): adicionar no claude.ai e no Claude Code, primeiro uso, cortar acesso.
