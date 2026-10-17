# Pastas na Biblioteca — design

O dono aprovou ("avança"): organizar os ficheiros da Biblioteca em pastas por tema/abordagem (ex.: as fotos de um
carrossel juntas) e ver onde cada ficheiro foi usado, para não ficarem vídeos soltos sem saber se já saíram.
Escolhas do dono: pastas manuais **e** sugestão a partir do post (C); cada ficheiro só numa pasta (A).

## 1. Dados (migração `0015_pastas.sql`)
- `media_folders (id uuid pk, brand_id uuid not null references brands on delete cascade, name text not null
  check (length(trim(name)) between 1 and 80), notes text not null default '' check (length(notes) <= 2000),
  created_at timestamptz not null default now())`; único `(brand_id, lower(name))`.
- `media_assets.folder_id uuid null references media_folders(id) on delete set null`; índice `(folder_id, created_at)`.
- Trigger: a pasta tem de ser da mesma marca do ficheiro (senão erro "A pasta é de outra marca.").
- RLS: dono (`private.is_owner()`) tudo. Agente (`private.is_agent()`): lê e cria pastas; sem update/delete
  (políticas restritivas iguais às da 0014). Ficheiros do agente só entram numa pasta no momento em que são
  criados (o agente já não pode fazer update em `media_assets`).
- Migração reaplicável; o dono corre-a no SQL Editor (passo manual, como a 0014).

## 2. Biblioteca (`/biblioteca`)
- Vista inicial: grelha de **Pastas** da marca escolhida (cartão: até 4 miniaturas, nome, "N ficheiros",
  "Usada em N posts") + cartão **"Sem pasta (N)"**; por baixo, como hoje, os ficheiros (filtrados pelos chips).
  Botão "Nova pasta" (nome + "Tema e abordagem").
- Com "Todas as marcas": pastas de todas as marcas, cada cartão com a bolinha da cor da marca.
- `/biblioteca?pasta=<id>`: cabeçalho com nome e nota "Tema e abordagem" (editáveis), ficheiros por ordem de envio,
  ações **Criar post com estes ficheiros** (`/posts/novo?media=id1,id2,…` pela mesma ordem), **Mudar nome**,
  **Apagar pasta** (confirmação: "Os ficheiros passam para Sem pasta. Nada é apagado.").
  `?pasta=sem` mostra os ficheiros soltos. Pasta inexistente → "Pasta não encontrada" + voltar.
- Enviar ficheiros dentro de uma pasta grava-os nessa pasta.
- Selecionar: botão "Selecionar" → caixas nas miniaturas → barra "N selecionados · Mover para pasta… · Tirar da
  pasta". "Mover para pasta…" abre lista das pastas da marca + "Nova pasta…". Menu "⋯" de cada ficheiro ganha
  "Mover para pasta". Ficheiros de marcas diferentes na seleção → "Escolha ficheiros de uma só marca."
- Chips: Tudo · Imagens · Vídeos · **Por usar** · etiquetas (continuam).

## 3. Onde foi usado
- Selo em cada miniatura: "Usado N×" (posts não cancelados) ou "Por usar".
- Visualizador do ficheiro: secção "Usado em" com título do post (ou "Sem título"), dia/hora no fuso da marca,
  estado (Rascunho/Agendado/Publicado/Falhou) e link `/posts/<id>`.
- Função pura `usageOf(rows) → Map<mediaId, { count; posts[] }>` testada.

## 4. Editor de post
- Cartão "1. Conteúdo": se ≥ 1 ficheiro escolhido está sem pasta, linha "Estes N ficheiros não estão numa pasta —
  **Guardar na pasta «título»**" (título interno; vazio → "Post de dd/mm"). Um toque cria a pasta (ou usa a
  existente com o mesmo nome) e move os ficheiros soltos. Ficheiros já numa pasta não mudam.
- "Escolher da Biblioteca": filtro por pasta + botão **"Usar a pasta toda"** (junta os ficheiros pela ordem de envio,
  sem repetir os já escolhidos).
- `/posts/novo?media=…`: pré-escolhe esses ficheiros (só ids válidos da marca; os outros são ignorados).

## 5. MCP (Claude)
- `biblioteca`: devolve `pasta` (id, nome) de cada ficheiro e aceita filtro `pastaId`.
- Ferramenta nova `pastas` (lista: id, nome, tema, nº ficheiros) e `criar_pasta` (nome, tema).
- `confirmar_envio` e `importar_de_link` aceitam `pastaId` opcional (pasta da mesma marca, senão erro claro).
- Instruções do servidor: "Junte os ficheiros de um carrossel numa pasta com o tema do post."

## 6. Testes e verificação
- BD: dono cria/edita/apaga pasta; apagar pasta deixa ficheiros com `folder_id` nulo; pasta de outra marca recusada;
  agente cria e lê pastas mas não altera nem apaga; nome repetido na mesma marca recusado; migração reaplicável.
- Unitários: `usageOf`, nome por omissão da pasta do editor, ações (mover, tirar, criar, apagar) com validação,
  ferramentas MCP novas e `pastaId`.
- e2e: criar pasta, mover ficheiros, abrir pasta, criar post com a pasta.
- Capturas 390 px e 1366 px (claro/escuro) da Biblioteca e da pasta; revisão final independente.

## Fora desta parte
Pastas dentro de pastas; um ficheiro em várias pastas; arrastar para reordenar dentro da pasta.
