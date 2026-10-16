# Ligar o Claude ao Estúdio (MCP)

Com esta ligação, o Claude (no claude.ai ou no Claude Code) consegue ver o seu Estúdio e montar posts como
**rascunhos**. Quem agenda é sempre você, na app.

Endereço: `https://studio-app-five-phi.vercel.app/api/mcp`

## O que o Claude pode fazer
- Ver: marcas e contas, calendário, horários fixos livres, voz da marca e grupos de hashtags, Biblioteca,
  Ideias, Prazos, métricas, estado das publicações, grelha do Instagram (em texto) e resumo da semana.
- Criar: carregar ficheiros (JPG, MP4, MOV), criar e editar rascunhos, guardar ideias, criar prazos.
- Verificar: corre as regras da app (duração, medidas, legenda, data) e avisa antes de criar.
- Nunca: agendar, publicar, apagar, nem mexer em Definições, contas ligadas ou chaves.

Os rascunhos do Claude aparecem no calendário com um pequeno robô e no editor com "Criado pelo Claude".
Cada ação fica em **Definições → Registo de atividade**.

## claude.ai
1. Definições → Conectores → **Adicionar conector personalizado**.
2. Nome: `Estúdio`; URL: o endereço acima. Guardar.
3. Na primeira utilização abre a página do Estúdio: entre e toque em **Permitir**.

## Claude Code
```
claude mcp add --transport http estudio https://studio-app-five-phi.vercel.app/api/mcp
```
Depois, dentro do Claude Code, escreva `/mcp`, escolha `estudio` → **Authenticate** e toque em **Permitir**.

Os ficheiros da pasta sobem diretamente: o Claude pede um link de envio (`pedir_envio`), envia com `curl` e
confirma (`confirmar_envio`). No claude.ai, use ficheiros que já estão na Biblioteca ou um link público
(`importar_de_link`). Imagens só em JPG (o Instagram não aceita PNG).

## Exemplos de pedidos
- "Vê os horários livres da Unidreamity na próxima semana e monta estes 3 Reels (pasta ./posts) em rascunho,
  com legendas na voz da marca."
- "Que posts resultaram melhor no último mês? Sugere 5 ideias e guarda-as no Estúdio."
- "Faz-me o resumo da semana."

## Cortar o acesso
Definições → **Ligações do Claude** → Cortar acesso.

## Configuração (uma vez, no Supabase do projeto "studio app")
1. SQL Editor: correr `supabase/migrations/0014_mcp.sql`.
2. Authentication → **OAuth Server**: ligar; **Dynamic client registration**: ligar;
   Authorization path: `/oauth/autorizar` (Site URL = endereço da app).
