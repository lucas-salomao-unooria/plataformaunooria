# apps/hub/app/(plataforma)/professor/entre-redes — a ficha da missão

Complementa o `AGENTS.md` de `apps/hub/app/(plataforma)/professor`, que vence em
conflito. Aqui mora o que vale para a FICHA de cada missão: o despachante que
escolhe o corpo dela, e o que a ficha hospeda (equipes, evidência, A Seleção).

## A ficha da missão é um DESPACHANTE, e o fallback dele é o Instanooria

`app/(plataforma)/professor/entre-redes/[ano]/[unidade]/page.tsx` escolhe o corpo
da ficha por `missao.expId`, e o `return` final — sem `if` nenhum — é
`<MissaoInstanooria>`. **Missão publicada sem ramo não quebra: ela mostra a ficha
de outra missão.** Com "Nova atividade", que grava em `exp08ef1b_activities` e a
missão nova nunca lê, e sem "Abrir a aula e os resultados", que é o único caminho
para o painel da turma.

Aconteceu duas vezes — a exp06ef2b e, em 2026-09-11, a exp08ef4b, com o aviso já
escrito em `missao-rastro-boato.tsx`, no arquivo ao lado. Comentário não é rede:
`lib/entre-redes/despachante-da-ficha.test.ts` lê o `page.tsx` e reprova toda
missão publicada com `expId` que não tenha ramo próprio, com uma lista de
exceções (`MISSOES_NO_FALLBACK`) que exige declarar por escrito quem usa o corpo
do Instanooria de propósito.

**Missão nova = ramo no despachante + `missao-<slug>.tsx`, no mesmo trabalho.**

## Equipes na missão (E13)

Quando a turma divide computadores, quem entra na missão representa a equipe. A
seção **"Equipes desta turma"** mora na FICHA, entra UMA vez pelo `corpo()` do
despachante (`components/equipes/equipes-da-ficha.tsx`, logo abaixo da faixa da
turma) e só aparece com `?turmaId=` e quando a api responde `permitida` — a
lista de missões com equipe é da api, não do hub. Os tipos e as regras puras
(mover, remover, o que impede salvar) estão em `lib/equipes.ts`, que o cliente
importa; as leituras server-side em `lib/equipes-servidor.ts` (`server-only`).

- **A plataforma sempre pergunta** "Sortear as equipes" ou "Eu separo", sem
  opção marcada; "Manter as equipes da última missão" só existe quando a turma
  tem equipes salvas em outra missão.
- **Só o `professor` escreve.** Gestor lê: cartões ou "Nenhuma equipe montada
  para esta turma." A api recusaria de qualquer jeito.
- **"Mostrar equipes" é uma janela do DS (`Modal` `full`), não uma rota**: uma
  página de tela cheia herdaria a trilha e o layout da área. Ela mostra o nome
  da equipe e o PRIMEIRO nome de cada estudante — nada de falta, desempenho ou
  "Sem equipe": é a tela que a sala inteira lê. Nome que empata na turma sobe só
  o que desempata (`rotulosCurtos`): a inicial do sobrenome, e o último
  sobrenome inteiro quando duas ainda ficam "Gabriela C." (a 4B do seed tem esse
  par, e a tela já as mostrou iguais em equipes diferentes).
- **A lista de presença e a edição NÃO vão dentro de `Collapse`**: fechado, ele
  deixa ~40 controles focáveis dentro de `aria-hidden`. Renderização condicional.
- **Na sala, as equipes são uma `Tag` ("N equipes prontas"), não um link**
  (ADR-100): montar e editar é na ficha, pelo mesmo "Conduzir com esta turma".
- **O estudante vê a própria equipe** numa faixa entre o header e o aparelho
  (`components/equipes/faixa-da-equipe.tsx`, `shrink-0`, uma linha), só com
  primeiros nomes e sem link.

Suíte: `professor/10-equipes-na-missao` (4B de ponta a ponta, terminando em
"Desfazer"; a faixa do estudante na 4A, com as equipes criadas e apagadas pelo
BFF; e a ficha da exp05ef1b na 5A, só leitura, com a seção).

## Evidência pedagógica (E14)

Por estudante, as habilidades da BNCC que ele demonstrou numa ATIVIDADE,
rodada a rodada. Tipos e regras puras em `lib/evidencias.ts`; leituras em
`lib/evidencias-servidor.ts`; confirmar e ajustar pelo BFF (`evidencias`). Quem
decide nível, cópia e o que conta é a api (`apps/api/src/evidencias/`).

- **O painel mora onde a missão tem a ATIVIDADE**: na tela da atividade do
  Instanooria (`professor/atividades/[id]`, depois da revisão), nos resultados da
  exp05ef1b, onde a atividade é o PACOTE aprovado (`atividadeId = pacoteId`,
  `key` no pacote para remontar quando outro é aprovado), e nos resultados da A
  Seleção, onde a atividade é a COBERTURA (`?cobertura=`; sem ele, a em
  andamento) — e nos do Jornal da Escola, onde é o PACOTE (`?pacote=`). Sem
  turma, sem painel.
- **Invisível sem ficha, de propósito**: `temFicha: false` não desenha nada, e
  hoje só a exp05ef1b (ADR-118), a exp07ef1b (ADR-115) e a exp04ef1b têm ficha — no
  Instanooria o bloco não aparece, e não é defeito: confira `temFicha` antes.
- **Ausência é "Não avaliado", nunca "Não atingiu".** A cópia da aula projetada
  chega "a revisar" e só conta depois de "Confirmar para a turma".
- **O perfil** é `professor/turmas/[id]/estudantes/[estudanteId]`, pelo NOME na aba
  Estudantes; o relatório da Vila, antes destino da linha inteira, virou link ao
  lado (link dentro de link não existe). A trilha volta para `?aba=estudantes`.
- **Só o `professor` confirma e ajusta** (`podeEditar`); gestor lê, sem caixas,
  sem célula clicável, sem confirmar. O estudante nunca vê resultado.
- **Sem ranking nem ordem por nível.** Alfabética com a equipe junta
  (`ordenarPorEquipe`), nenhuma coluna `sortable`. A seleção é o `Checkbox` do
  DS numa coluna, não a `selectable` da `Table`: a dela diz "Selecionar linha
  N", e a linha é uma criança (lacuna a pedir no `storybook-unooria`).

Suíte: `professor/11-perfil-do-aluno` (4B, até o perfil vazio); o painel com
ficha é provado em `estudante/10-quem-mandou-isso` (o nível de cada habilidade
conferido contra a régua) e em `estudante/11-a-selecao`.

## A Seleção (exp07ef1b)

A aula inteira mora em `[ano]/[unidade]/resultados/resultados-a-selecao.tsx`, na
ordem da aula:
preparo, painel ao vivo, folha por computador, zerar e habilidades.

- **Aprovar = atividade nova** (rodada 1), e só acende quando algo mudou;
  **zerar = rodada nova**, sem apagar nada.
- **UM botão**, com o rótulo de `proximaEtapa` da api; não volta.
- **O painel consulta só `…/painel`** a cada 5 s, não `router.refresh()`: a
  página lê seis rotas.
- **As imagens são um laço do cliente** (`continuarGerando`): 2 por chamada,
  para em `completo` ou quando uma volta não gera nada.
- **O podcast de recapitulação é do professor** (`podcast-a-selecao.tsx`, entre
  o painel da aula e o zerar) — e mora AQUI, não no guia: o Bloco 2 conta o que
  cada veículo mostrou no tema DESTA turma, e o guia é o mesmo para todas. O
  áudio é outro laço do cliente (`continuarGerandoPodcast`, um trecho por
  chamada) e a transcrição fica sempre na tela; o player é o `AudioPlayer` do DS.
  As três falas do Bloco 2 se editam no PREPARO, junto dos posts, e vão na mesma
  aprovação (`mesmoLote` compara as falas também).
