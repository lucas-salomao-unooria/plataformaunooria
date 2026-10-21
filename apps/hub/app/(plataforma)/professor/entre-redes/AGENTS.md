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

## As atividades da missão (ADR-130)

**A missão é o esqueleto narrativo; a ATIVIDADE é a missão que a turma faz de
fato, e a plataforma nunca a cria.** As cinco missões com atividade
(`MISSOES_COM_ATIVIDADE` em `lib/entre-redes/atividades.ts`, o par da api)
dividem a seção **"Suas atividades"** da ficha (`[ano]/[unidade]/atividades-da-missao.tsx`,
no molde da lista do Instanooria) e o card `components/cartao-atividade.tsx`.

- **A lista é da TURMA.** Sem `?turmaId=`, a seção pede a turma (as do professor
  da série da missão). A em andamento vem primeiro.
- **Criar não põe no ar.** A atividade nasce PRONTA; "Usar esta atividade agora"
  (`components/atividades/usar-esta-atividade.tsx`) escolhe a EM ANDAMENTO, uma
  por turma, e pede confirmação quando troca a que está no ar. No Instanooria o
  caminho é o "Ativar" (que pode devolver 422 com as pendências).
- **Pôr no ar LIBERA a missão na sala** (ADR-146): o toggle "Pôr esta atividade
  no ar agora" e o "Usar esta atividade agora" fazem também o `PUT` da Sala de
  Aula (`liberarNaSala`), inclusive com a missão encerrada. Sem a linha em
  `liberacoes` (ADR-69) a atividade ficava no ar e a turma via o cadeado — e a
  e2e não via, porque o seed libera a 7A e a 5A antes. Se só a liberação falha
  (gestor não libera), sai um aviso, não um erro.
- **A criação é o assistente de quatro passos** (`components/atividades/assistente-de-atividade.tsx`:
  turma, conteúdo, equipes, revisar e criar) em `[unidade]/atividades/nova`; o
  passo do CONTEÚDO é de cada missão (`atividades/nova/criar-<missão>.tsx`), e o
  fim (pôr no ar, montar as equipes) é `lib/entre-redes/criar-atividade.ts`. O
  Instanooria mantém a criação dele (`/professor/atividades/nova`).
- **A página da atividade** é a `.../resultados` com `?cobertura=` (A Seleção) ou
  `?pacote=` (Jornal, Quem Mandou, Júri Estadual), e a `/professor/atividades/[id]` no
  Instanooria. O painel da aula e o zerar só aparecem na EM ANDAMENTO; a pronta
  mostra o "Usar esta atividade agora" — e a EM PREPARO (imagens sem OK), a
  grade de aprovação no lugar dele.
- **O Jornal aprova em duas fases na criação** (ADR-147): textos, depois
  imagens, na grade `resultados/imagens-do-pacote.tsx` (a mesma da página da
  atividade). Sem todas aprovadas é "Em preparo" (a api dá 409); por imagem.

## Equipes na missão (E13)

Quando a turma divide computadores, quem entra na missão representa a equipe. A
**equipe é da ATIVIDADE** (ADR-130): a criação pergunta o modo (sortear, eu
separo, um aluno por computador) e a seção **"Equipes desta atividade"**
(`EquipesDaAtividade`, `components/equipes/equipes-da-ficha.tsx`) mora na PÁGINA
da atividade — `?separar=N` abre direto as N equipes vazias de quem escolheu "Eu
separo". Na FICHA, a seção "Equipes desta turma" (`EquipesDaFicha`, id fixo
`turma`) só existe na missão SEM atividade, o unooGPT. Ela só aparece quando a
api responde `permitida` — a lista de missões com equipe é da api, não do hub. Os tipos e as regras puras
(mover, remover, o que impede salvar) estão em `lib/equipes.ts`, que o cliente
importa; as leituras server-side em `lib/equipes-servidor.ts` (`server-only`).

- **A plataforma sempre pergunta** "Sortear as equipes", "Eu separo" ou "Um aluno
  por computador", sem opção marcada; "Usar as equipes da atividade anterior" só
  existe quando a turma tem equipes salvas em outra atividade.
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
  andamento) — e nos do Jornal da Escola e do Júri Estadual, onde é o PACOTE
  (`?pacote=`). Sem turma, sem painel.
- **Invisível sem ficha, de propósito**: `temFicha: false` não desenha nada, e
  hoje a exp05ef1b (ADR-118), a exp07ef1b (ADR-115), a exp04ef1b, a exp06ef1b e a
  exp08ef1b têm ficha — missão sem ficha não mostra o bloco, e não é defeito:
  confira `temFicha` antes. No Unoovista a rodada é sempre 1 (uma aplicação
  nova é uma atividade nova), então o painel não recebe `rodadaEmAndamento`.
- **Ausência é "Não avaliado", nunca "Não atingiu".** A cópia da aula projetada
  chega "a revisar" e só conta depois de "Confirmar para a turma".
- **A rodada em andamento tem aba mesmo vazia** (`rodadaEmAndamento`, ADR-145):
  a api conta as rodadas pelas evidências, e sem a prop a rodada aberta pelo
  "Zerar" só aparecia depois do primeiro jogo e de um F5. A aba vazia é só de
  leitura (`rodadaSemRegistro`): a api recusa ajuste em rodada sem registro.
- **O critério de cada nível vem da ficha** (`habilidades[].criterios`) e é
  listado no fim do painel, em toda missão com ficha.
- **O painel acompanha a aula sem F5** (ADR-146): o polling do painel da aula
  chama `router.refresh()` quando `mudouAEvidencia` (no `lib/<missão>-tipos.ts`)
  acusa mudança no que a ficha registra. No Jornal e no Júri uma leitura basta
  (a marca vai na transação da jogada); na A Seleção relê quando uma leitura de
  legenda termina (ela roda depois da publicação) e quando a etapa vira (a
  marcação congela nas fichas).
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

A página de UMA atividade mora em `[ano]/[unidade]/resultados/resultados-a-selecao.tsx`,
na ordem da aula: pô-la no ar (se pronta), equipes, imagens, painel ao vivo com a
folha por computador, zerar, podcast e habilidades. A criação é
`atividades/nova/criar-a-selecao.tsx`.

- **Criar é aprovar em DUAS fases, na mesma grade** (ADR-146,
  `[unidade]/grade-da-cobertura.tsx`): os textos ("Aprovar textos e gerar as
  imagens" grava a cobertura) e depois as imagens, geradas sozinhas no card de
  cada post, com "Gerar outra imagem". Os textos vêm antes porque imagem de
  rascunho gasta quota à toa. O botão final do assistente ("Aprovar Cobertura e
  Abrir Turma", `rotuloDoCriar`) só acende depois das duas, e chama
  `aprovar-imagens` antes do `concluirCriacao`. Sem a segunda fase a atividade
  é "Em preparo", sem "Usar esta atividade agora" (a api daria 409), e a página
  dela mostra a mesma grade com "Aprovar imagens".
- Pôr no ar abre a rodada seguinte à última; **zerar = rodada nova** e apaga
  as habilidades da cobertura (ADR-155), em toda missão com ficha.
- **UM botão**, com o rótulo de `proximaEtapa` da api; não volta. Desde a
  ADR-170 há a etapa "Abrir marcação do colega" entre o Mural e as fichas, com
  o "{n} de {total} marcaram" e a métrica "Marcaram o post do colega".
- **O Canal A sem nível na lista** (ADR-170): a folha mostra a leitura da
  legenda como ESTADO (`textoDaLeitura`: lendo, lida, ou "revise" com o que a
  reserva viu), a poda, a marcação (`textoDaMarcacao`) e o "por quê?" — o nível
  é do painel de habilidades. O guia de leitura da reflexão (`GUIA_DA_REFLEXAO`)
  fica acima da lista. O ajuste tem `motivo` opcional (`OPCOES_DE_MOTIVO`).
- **A criação manda os posts EDITADOS** (`editados`, comparando com as
  legendas que chegaram) para a conferência do enquadramento; o 422
  `enquadramento-divergente` marca o card ("não mostra mais o lado de…") e a
  edição do post apaga o aviso; `conferencia: "nao-conferida"` vira aviso.
- **O painel consulta `…/painel`** a cada 5 s e só refaz a página quando muda a
  evidência (acima): a página lê seis rotas.
- **As imagens são um laço do cliente** (`continuarGerando`): 2 por chamada,
  para em `completo` ou quando uma volta não gera nada. Na página da atividade
  o laço antigo só roda para cobertura aprovada antes da ADR-146 com post sem
  imagem.
- **Podcast**: o da plataforma (abaixo); as falas do Bloco 2 vêm com os posts.

## O podcast de recapitulação (ADR-150)

Na página da atividade (`resultados/podcast-da-aula.tsx`); é do professor.

- **As falas do tema se revisam na CRIAÇÃO, sempre** (Lucas, 2026-10-06):
  `atividades/nova/falas-do-podcast.tsx` as pede quando o conteúdo chega, e o
  "Aprovar"/"Criar" só acende com elas na régua.
- **Atividade da IA anterior ao podcast**: 409, e o cartão mostra a frase, sem sumir
  (`lib/podcast-servidor.ts`).
- ADR-156: o 8º revisa as falas no `painel-revisao.tsx` (só em `revisao`) e
  as manda no "Ativar"; a Tempestade é FIXA, só o cartão, atividade `"turma"`.
- E2e com IA real: `scripts/e2e/lib/podcast.mjs`.

## O Júri Estadual de Projetos (exp06ef1b)

A página da atividade é `resultados/resultados-juri-estadual.tsx`; a criação,
`atividades/nova/criar-juri-estadual.tsx`; o espelho do contrato,
`lib/juri-estadual-tipos.ts` (com teste que lê a api como texto).

- **QUARENTA estandes, dez por área** (PO, 2026-10-14). Ids
  `proj-[a-d](10|[1-9])` em ordem NUMÉRICA (`compararIdsDeProjeto`). O pacote
  de 16 da 0.4.x continua abrindo: tela que mostra pacote usa o tamanho DELE,
  nunca `TOTAL_DE_PROJETOS` (que é da escrita). Sem `prototipo`/`depoimento`.
- **Uma aba por área** (`AbasDasAreas`, em `resultados/estande-do-preparo.tsx`)
  na curadoria, na grade das imagens e nos estandes da atividade: `Tabs` do DS
  controlado, a pendência no rótulo ("Saúde · 2 com ajuste") e só a aba aberta
  renderizada — nunca `Collapse`.
- **Banco padrão**: "Usar Banco Padrão Oficial" no TOPO do preparo (`POST
  banco-padrao`, nasce pronto, com as imagens do banco que existem). Sem cota
  ou sem IA, o `gerar-conteudo` dá 200 `usouIa: false`: o aviso
  (`AVISO_DO_BANCO_PADRAO`, literal) e "Usar Acervo Padrão da Mostra" — o
  banco NÃO entra na curadoria (o `homologar` o gravaria como `ia`).
- **Duas fases** (PO, 2026-10-06), na grade `resultados/imagens-do-juri.tsx`:
  UM carimbo do pacote, sem exigir imagem em todo estande; aprovada, congela.
  Quatro por estande (as lâminas, ADR-178), "Gerar outra" por lâmina; oito
  por chamada: as 160 levam minutos. Hashtag em `subtags`.
- **Podcast**: falas na FASE 1; recurso FIXO do fechamento, depois da Etapa 4
  (`avisoDoPodcast`, literal do one-pager).
- **Um botão só**: "Liberar Auditoria", com a instrução de gatilho acima.
- **A folha**: o ícone de ocioso ao lado do nome e "Separação" (se separou,
  nunca quantos acertou — ADR-174). Sem voto, taxa, concentração nem nível; o
  acerto da separação e da regra é nível, e mora no painel de habilidades.
- **A lousa mostra a CONCENTRAÇÃO** (`resumo.concentracao`, quem curtiu ×
  quem não curtiu, dois `MetricCard`) **só depois de Liberar Auditoria**: ela
  diz que o feed se adaptou, e a plenária do pico pede para não dizer ainda. A
  "invisibilidade média" saiu (30 de 40 para todos). Número da api, nunca
  cravado na copy nem no guia.
- **O gráfico de votos usa "Área A"… no eixo** (o `BarChart` corta acima de ~8
  caracteres) e o nome na legenda; as barras em % dos votos.
