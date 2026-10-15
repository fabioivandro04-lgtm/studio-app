# Novo visual — design

O dono aprovou ("avança") a proposta: visual moderno **sem cara de IA**, editor de post mais simples, calendário
mais bonito e claro, modo escuro. A velocidade e a IA grátis já foram feitas à parte.

## 1. Princípios ("sem cara de IA")
- Sem emojis em botões ou rótulos (💡🎬🗓️⏰🕐📅✨): ícones lucide simples e texto direto.
- Sem ✨/"magia" para a IA: a IA é uma ferramenta como as outras ("Sugerir legenda", "Reescrever").
- Não usar o aspeto shadcn de origem: letra própria (Manrope), neutros quentes (não cinzento puro), cantos
  moderados (8 px), sombras subtis, chips retangulares discretos em vez de pílulas coloridas.
- Paleta: azul-marinho da marca (#0B1F45) como primária, âmbar (#F0A93B) só como destaque pontual.

## 2. Tokens e modo escuro
- `globals.css`: novos valores para `--background` (#FAF9F7), `--card` (branco), `--muted`, `--border`,
  `--muted-foreground` em tons quentes; raio 0.5rem; tokens de estado (`--status-*`).
- Modo escuro automático pelo sistema (`prefers-color-scheme`): a variante `dark:` passa a ser a media query;
  tokens escuros definidos. Cores fixas no código (`bg-amber-50`, `text-white` fora do cabeçalho, etc.)
  substituídas por tokens.
- Estados dos posts com cores próprias e legíveis em claro e escuro (`POST_STATUS_CLASS`).

## 3. Estrutura
- Cabeçalho: barra clara (fundo `card`, borda inferior), logótipo "Estúdio" em azul; seletor de marca e sair à direita.
- Menu lateral (desktop) e barra inferior (telemóvel) com o item ativo marcado por barra/realce discreto.
- Páginas: título + subtítulo curto; conteúdo em cartões (`card`, borda, sombra leve).

## 4. Editor de post
- Três cartões numerados: **Conteúdo** (marca, título, mídia), **Redes e legendas**, **Quando**.
- Assistente fechado por omissão: botão "Sugerir com IA" abre o painel (sem caixa amarela grande).
- Barra de ações fixa no fundo (por cima da barra do telemóvel): Agendar (principal), Guardar rascunho, e um
  menu "Mais" (Duplicar, Cancelar post, Apagar do Estúdio).
- Biblioteca carregada só ao abrir "Escolher ficheiros" (ação `listBrandMedia`), o editor abre mais depressa;
  as mídias já escolhidas vêm no carregamento inicial.
- Gravação local: alterações guardadas no navegador a cada mudança; ao reabrir um post com alterações não
  guardadas, aviso "Tem alterações não guardadas de <hora>" com "Recuperar"/"Descartar". Limpa ao guardar.

## 5. Calendário
- Cartão: hora em destaque, título numa linha, ícones das redes, miniatura maior quando existe, ponto de estado
  colorido (sem riscado).
- Horários fixos livres visíveis como espaço tracejado "+ 19:00" (mês, semana e lista); um toque abre o editor
  com essa data e hora (`/posts/novo?data=…&hora=…`).
- Nova vista **Lista** (próximos 30 dias agrupados por dia), a vista por omissão no telemóvel.
- Filtros por rede e estado (chips, na URL: `rede=`, `estado=`).

## 6. Testes e verificação
- Unitários para as funções novas (filtros, horários livres por dia, gravação local).
- e2e atualizados para os novos rótulos (sem emojis).
- Capturas no telemóvel (390 px) e computador, em claro e escuro; revisão final independente.
