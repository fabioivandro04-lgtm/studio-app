# Estúdio — Guia de configuração

Este guia leva-o do código até à app a publicar nas suas contas. Faça os passos por ordem.
Nunca partilhe chaves ou palavras-passe por chat ou email: cole-as só nos painéis indicados.

Neste guia, `APP_URL` é o endereço da app na Vercel (ex.: `https://estudio.vercel.app`).

---

## 1. Supabase (base de dados, ficheiros e login)

O projeto **studio app** já tem as tabelas, a segurança e as funções aplicadas.

1. **Migração em falta:** abra **SQL Editor** e execute o conteúdo de `supabase/migrations/0006_posts.sql`
   (cria a função que guarda posts). Se aparecer o aviso sobre operações destrutivas, confirme: a função só
   apaga a mídia e os destinos do próprio post quando o edita.
2. **Login:** em **Authentication → Sign In / Providers**:
   - **Email** ligado; **Confirm email** ligado.
   - **Allow new users to sign up**: **desligado** (só o dono entra).
3. **Endereços:** em **Authentication → URL Configuration**:
   - **Site URL**: `APP_URL`
   - **Redirect URLs**: `APP_URL/auth/callback`
4. **Criar o seu utilizador:** **Authentication → Users → Add user → Send invitation** com o seu email.
   Depois, no **SQL Editor**:
   ```sql
   insert into app_owner (user_id) select id from auth.users where email = 'o.seu@email.com';
   ```
5. **Chaves** (Project Settings → API Keys): vai precisar do **Project URL**, da **publishable key** e da
   **secret / service_role key** no passo 2.
6. **Agendamento:** depois do passo 2, execute `supabase/deploy/cron.sql` no SQL Editor, substituindo
   `<APP_URL>` e `<CRON_SECRET>`. A partir daí, o Supabase chama a app a cada minuto para publicar.

> Plano gratuito: ficheiros até 50 MB e 1 GB no total. Se precisar de mais, passe para o plano Pro.

## 2. Vercel (alojamento)

1. Em **vercel.com → Add New → Project**, importe o repositório do GitHub.
2. Em **Settings → Environment Variables** (Production), crie:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | secret / service_role key |
| `APP_URL` | o endereço final da app |
| `CRON_SECRET` | um segredo longo e aleatório (ex.: gerado num gestor de palavras-passe) |
| `TOKEN_ENC_KEY` | 32 bytes em base64 — gere com `openssl rand -base64 32` |
| `PLATFORM_MODE` | `real` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | o email de contacto que aparece nas páginas legais |
| `IG_APP_ID`, `IG_APP_SECRET` | do passo 3 |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | do passo 4 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | do passo 5 |

3. **Guarde a `TOKEN_ENC_KEY` num local seguro.** Se a perder, terá de voltar a ligar todas as contas.
4. Faça **Redeploy** depois de mudar variáveis.

> A Vercel gratuita (Hobby) é para uso não comercial. Para uso da empresa pode ser necessário o plano Pro.

## 3. Instagram (Meta for Developers)

1. No Instagram: **Definições → Tipo de conta → Mudar para conta profissional** (Criador ou Empresa).
2. Em **developers.facebook.com → My Apps → Create App**: tipo **Business**.
3. Adicione o produto **Instagram** → **API setup with Instagram login**.
4. Em **Business login settings**, adicione o redirect: `APP_URL/api/oauth/instagram/callback`.
5. Em **App roles → Roles**, adicione a sua conta de Instagram como **Instagram Tester** e aceite o convite
   no Instagram (**Definições → Apps e sites → Convites de testador**).
6. Em **Permissions**, confirme `instagram_business_basic` e ative `instagram_business_content_publish` e
   `instagram_business_manage_insights` (métricas).
7. Copie o **Instagram App ID** e **Instagram App Secret** para a Vercel (`IG_APP_ID`, `IG_APP_SECRET`).

Como só usa as suas contas, o **acesso padrão** chega e não precisa de revisão da Meta.

## 4. TikTok (TikTok for Developers)

1. Em **developers.tiktok.com → Manage apps → Connect an app**.
2. Preencha: ícone, nome, categoria e os links legais:
   - Política de privacidade: `APP_URL/legal/privacidade`
   - Termos: `APP_URL/legal/termos`
3. Adicione os produtos **Login Kit** e **Content Posting API**.
4. Scopes: `user.info.basic`, `user.info.stats`, `video.upload`, `video.list`.
5. Redirect URI: `APP_URL/api/oauth/tiktok/callback`.
6. Submeta para **revisão**. Enquanto espera, use o modo **Sandbox** com a sua conta como utilizador de teste.
7. Copie **Client key** e **Client secret** para a Vercel.

Na versão 1 os vídeos vão para a **caixa de entrada** da app TikTok; abre a notificação, cola a legenda
(botão "Copiar legenda" em Pendentes) e publica. Para publicação 100% automática, peça depois a
**auditoria** da Content Posting API.

## 5. YouTube (Google Cloud)

1. Em **console.cloud.google.com**, crie um projeto (ex.: "Estúdio").
2. **APIs & Services → Library**: ative **YouTube Data API v3** e **YouTube Analytics API**.
3. **OAuth consent screen**: tipo **External**; preencha nome, email e os links legais; adicione os scopes
   `youtube.upload`, `youtube.readonly`, `yt-analytics.readonly`.
4. **Publique a app ("In production")**. Em modo *Testing*, o acesso expira a cada 7 dias.
   Verá um aviso "app não verificada" ao ligar — é normal para uso pessoal; continue.
5. **Credentials → Create credentials → OAuth client ID** (Web application) com o redirect
   `APP_URL/api/oauth/youtube/callback`.
6. Copie **Client ID** e **Client secret** para a Vercel.

Sem auditoria da Google, os Shorts são enviados como **privados**; torne-os públicos no YouTube Studio
(botão em Pendentes). A auditoria pede-se no formulário "YouTube API Services – Audit and Quota Extension".

## 6. IA (OpenRouter)

1. Crie conta em **openrouter.ai**, carregue crédito (ex.: 5 USD) e, em **Keys**, crie uma chave.
2. Vercel → **Settings → Environment Variables**: `OPENROUTER_API_KEY` (marcar como *Sensitive*). Faça *Redeploy*.
3. Na app, **Definições → IA**: escolha o motor (Normal ≈ 2 cêntimos por geração; Económico ≈ 0,2 cêntimos) e o
   limite mensal. Ao chegar ao limite, a IA pausa até ao mês seguinte.
4. **Definições → Marcas → Assistente de IA**: escreva o contexto da empresa, gere a voz da marca a partir do
   Instagram ("✨ Criar a partir do Instagram"), reveja e escolha o objetivo (Contactos ou Alcance).

5. Ainda em **Definições → Marcas → Assistente de IA**, ajuste **Posts por semana** (ex.: Unidreamity 3,
   marca de vídeos curtos 5). É o número usado em "Planear a próxima semana".

A IA só sugere texto e horários: nunca publica nem agenda sozinha.

**Atalhos para o dia a dia:**
- **Duplicar** (no post): cria uma cópia em rascunho e abre-a.
- **Grupos de hashtags** (Definições → Marcas): guarde conjuntos de hashtags; no post, o botão **# Hashtags** junta-os
  às legendas (com Desfazer).
- **Horários fixos** (Definições → Marcas → Assistente de IA): os dias e horas em que costuma publicar. No post, o
  botão **📅 Próximo horário livre** escolhe a data; o plano da semana nas Ideias usa os horários livres.
- **Mover** (calendário no telemóvel): muda o dia de um post sem o abrir. No computador, arraste o post.

**Página Ideias** (menu **Ideias**, com uma marca escolhida no topo):
- **💡 Ideias para um prazo** — escolha um prazo (Definições → Prazos) e recebe uma sequência de posts até essa data
  (4, 3, 2 e 1 semana antes e no próprio dia).
- **🎬 Ideias de vídeos curtos** — 10 ideias com gancho e guião.
- **🗓️ Planear a próxima semana** — completa a semana seguinte até ao número de posts por semana da marca.
- Em cada ideia, **Pôr no calendário** cria um rascunho com legenda e data sugerida; falta só juntar a foto ou o vídeo.
  As ideias que não quer vão para **Descartadas** (pode recuperá-las).

## 7. Primeiro teste

1. Entre na app com o link enviado para o seu email.
2. **Definições → Marcas**: crie "Unidreamity" (fuso Maputo) e a marca dos shorts.
3. **Definições → Contas ligadas**: ligue Instagram, TikTok e YouTube.
4. Carregue um vídeo curto na **Biblioteca**, crie um post para daqui a 5 minutos nas três redes.
5. Confirme: Instagram publicado; TikTok e YouTube em **Pendentes** a aguardar 1 toque;
   **Definições → Registo** mostra cada passo.
