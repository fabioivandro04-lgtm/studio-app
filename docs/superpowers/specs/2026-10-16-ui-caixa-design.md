# Parte A — nova UI da app + Caixa do Claude — design

O dono aprovou ("avança") a parte A: melhorar a UI da app toda (não só pequenos acertos) e criar a Caixa do Claude.
Fora desta parte: avisos por email (retirados pelo dono), instalar como app (parte B), banco de perguntas (parte C),
funcionalidades de métricas (mais tarde, quando houver posts publicados).

## 1. Princípios
- Mantém a identidade atual (Manrope, azul-marinho #0B1F45, âmbar só como destaque, modo escuro automático, sem emojis).
- Nada de controlos nativos do browser que mostrem formatos estrangeiros ou aspeto de sistema: datas `dd/mm/aaaa`,
  horas 24 h, seletores com o estilo da app (componentes `ui/select`, `ui/popover`, `ui/calendar` já existentes).
- Cada página: cabeçalho igual (título, frase curta, ações à direita) e a mesma largura de conteúdo
  (`max-w-5xl`, exceto calendário e biblioteca que usam a largura toda).
- Telemóvel primeiro: nada tapado pela barra de baixo nem pela barra de ações; botões com área de toque ≥ 40 px.

## 2. Estrutura e navegação
- Menu: Calendário, Ideias, Biblioteca, **Caixa** (substitui "Pendentes"), Métricas, Definições. A Caixa tem um número
  com o total de coisas à espera (toques pendentes + falhas + rascunhos do Claude). `/pendentes` redireciona para `/caixa`.
- Cabeçalho: logótipo; **seletor de marca** próprio (botão com a bolinha da cor da marca + nome, lista em popover,
  "Todas as marcas" no topo); menu da conta (ícone de pessoa) com "A minha conta" e "Sair".

## 3. Componentes novos
- `DateField` (popover com `ui/calendar` em pt-PT, semana a começar à segunda; mostra "sex, 17 out 2026").
- `TimeField` (24 h: campo de texto `HH:MM` com validação + lista de horas comuns a cada 30 min).
- `PageHeader` (título, descrição, ações).
- `BrandSwitcher` (substitui o `<select>` do cabeçalho).
- `FilterButton` (botão "Filtros" com contagem; popover com redes e estados; no telemóvel abre como folha de baixo).
- Todos os `<select>` de formulários passam a `ui/select`.

## 4. Páginas
- **Calendário:**
  - "Primeiros passos" compacto: com 3 de 4 feitos vira uma linha ("Falta 1 passo: agendar o primeiro post
    → Continuar") com botão fechar (lembrado no browser); com 4 de 4 desaparece.
  - Barra: mês e navegação à esquerda; vista (Lista/Semana/Mês/Grelha) e "Filtros" ao centro/direita;
    "Novo post" como botão principal (no telemóvel: botão redondo flutuante "+" por cima da barra de baixo).
  - Cartões de post com mais contraste; hoje destacado; dias de outro mês mais apagados.
- **Editor de post:**
  - "Sugerir com IA" passa para o cabeçalho do cartão "2. Redes e legendas".
  - Data e hora com `DateField`/`TimeField`; "Melhor hora" e "Próximo horário livre" ao lado.
  - Telemóvel: barra de ações fixa com espaço reservado (o último campo nunca fica tapado); a pré-visualização
    passa a um botão "Pré-visualizar" que abre uma folha; no computador continua ao lado.
- **Ideias:** em "Todas as marcas", em vez do aviso amarelo, botões com as marcas para escolher ali mesmo.
- **Biblioteca:** cabeçalho igual, cartões com o mesmo estilo; ações num menu "⋯" (criar post, etiquetas, apagar).
- **Métricas:** sem dados de posts, um estado vazio explicativo ("Os números aparecem 1 dia depois do primeiro post
  publicado") em vez de zeros; o gráfico de seguidores só aparece com ≥ 2 dias de dados.
- **Definições:** lista com ícones e descrições igual; formulário de marca com paleta de cores (8 cores + "outra")
  em vez do quadrado de cor nativo; botões de perigo ("Apagar") separados e a vermelho.
- **Login e autorização do Claude:** mesmo estilo de cartão.

## 5. Caixa (`/caixa`)
Três secções, por esta ordem, cada uma só aparece se tiver itens; tudo vazio → estado "Está tudo em dia".
1. **À espera do seu toque** — o que hoje está em Pendentes (TikTok/YouTube), igual em funcionalidade.
2. **Falharam** — publicações falhadas com o motivo e "Tentar de novo" (igual a hoje).
3. **Do Claude** — rascunhos com `origin = 'claude'` e `status = 'draft'` da marca escolhida (ou todas):
   - Cada item: miniatura, título, dia e hora no fuso da marca, ícones das redes, início da legenda (2 linhas),
     avisos de `checkPost(intent: 'schedule')` (ex.: "Instagram: O Reel tem de ter pelo menos 3 s.").
   - Ações: **Agendar** (desativado se houver avisos ou a data já passou, com o motivo), **Abrir**, **Apagar**
     (com confirmação).
   - Caixa de seleção por item + "Agendar selecionados (N)": agenda os que não têm avisos e diz quantos ficaram
     de fora e porquê.
   - Ação nova `scheduleDrafts(ids: string[]) → { ok: true; scheduled: string[]; skipped: { id; reason }[] }`
     (cliente do dono; recarrega cada post, corre `checkPost` com intent `schedule`, chama `save_post`).

## 6. Testes e verificação
- Unitários: `DateField`/`TimeField` (formatar/ler `dd/mm/aaaa`, `HH:MM`, valores inválidos), contagem da Caixa,
  `scheduleDrafts` (agenda válidos, salta com aviso/data passada, ignora posts que não são rascunho), regra do
  "Primeiros passos" compacto, filtros na URL continuam a funcionar.
- e2e ajustados aos novos rótulos ("Caixa", seletores novos).
- Capturas antes/depois em 390 px e 1366 px, claro e escuro; revisão final independente.
