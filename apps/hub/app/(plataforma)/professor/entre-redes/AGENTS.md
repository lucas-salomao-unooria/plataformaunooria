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
  `?pacote=` (Jornal, Quem Mandou, Júri Estadual, Nina), e a `/professor/atividades/[id]` no
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

A página de UMA atividade mora em `[ano]/[unidade]/resultados/resultados-a-selecao.tsx`:
pô-la no ar (se pronta) e as cinco abas do template (ADR-182, no `AGENTS.md` de
`professor/`): o painel ao vivo com a folha e o zerar, as imagens, as equipes, o
podcast e as habilidades. A criação é
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

## O Enigma da Capa da Rádio (exp02ef1b)

Página `resultados/resultados-enigma-capa.tsx`, criação `atividades/nova/criar-enigma-capa.tsx`,
espelho `lib/enigma-capa-tipos.ts`. O `banco-padrao` (Biblioteca, Horta, Museu) **aprova E põe no
ar** num toque. Na cena da IA o professor DESENHA a área de cada objeto igual, arrastando uma caixa
(a IA não devolve coordenada; ADR-188): as duas áreas vão juntas em `rascunho/invariantes`, e a caixa
fica presa à faixa do meio — mas a caixa arrastada com mais de 1/4 FORA da faixa não vira área
(`fracaoForaDaFaixa`): é o objeto que a IA pôs fora (medido: ~metade das imagens, com qualquer
redação), e a curadoria oferece "Gerar outra imagem". O **pedido da imagem** (só a descrição; as regras fixas são da api) fica
editável na curadoria, e "Gerar a imagem com este pedido" (`rascunho/imagem`) troca SÓ a imagem e
apaga as áreas. Toda geração mostra a espera ONDE o professor olha: o quadro animado no lugar da cena
(`EsperaDaCena`) ou o véu sobre a imagem (`ocupada` da `CenaDoEnigma`), com o botão em carregamento —
a barra lá em cima, sozinha, ficava fora da tela. A cena pronta é arquivo do
bundle: a base vem de `lib/bundle-da-experiencia.ts`, no servidor. LIBERAR VIRADA é um botão só, da turma.
Desde a 2.0.0 (ADR-186) a folha identifica a criança pelo NOME e mostra a lupa nos 2 objetos e o "fora"
(`marcaramFora` na lousa); o componente curricular do recorte é a lista `disciplinas` da api (o 2º ano
inteiro, Computação e "Outro componente"), num `Selection` — o hub não guarda essa lista, só o rótulo
para o histórico, conferido contra a api em `enigma-capa-tipos.test.ts`.

## O Assistente Invisível (exp01em1b)

Página `resultados/resultados-assistente-invisivel.tsx`, criação `atividades/nova/criar-assistente-invisivel.tsx`,
espelho `lib/assistente-invisivel-tipos.ts` (as rotas da turma num lugar só, `ROTAS_DA_CURADORIA`, e o
teste confere cada uma no controller da api). **Aqui `GET /pacotes` é o PREPARO** e a lista das
atividades é `GET /historico` — o contrário das irmãs; UMA atividade inteira (o Conteúdo da que está
fora do ar) é `GET /pacotes/:pacoteId`. O `banco-padrao` aprova E põe no ar.
A curadoria vai ao SERVIDOR item a item ("Editar Texto" e "Regenerar Este Item" devolvem o rascunho
inteiro) e o "Aprovar Pacote Homologado" manda só o `rascunhoId`. Sem saldo ou com o vendor fora, a
geração cai no banco padrão e a curadoria só abre depois de "Prosseguir com Banco Oficial" / "Usar
Banco Padrão" (E0-PROF-03). A aula são cinco liberações e duas pausas, só para a frente
(`ACOES_DA_FASE`, que o teste confere contra `PROXIMAS_FASES` da api); "Liberar Início da Simulação"
só acende com `todosApostaram`, e o painel lista quem falta. O relatório final (E6-PROF-01) imprime
SOZINHO pelo `BotaoImprimir` com `impressao="relatorio-homologacao"`: a folha
(`resultados/relatorio-de-homologacao.css`) só vale com a marca no `<html>`.
**O painel desenha o QUADRO do Figma do momento, não a fase inteira** (`momentoDoPainel`, ADR-190): a fase
`explicar` sem reteste é o E4-PROF-01 "liberado" (sem projeção e SEM botão — eles chegam com o primeiro
reteste), e `publicar` sem publicação é o E5-PROF-01 "liberado" (sem o relatório). Na pausa, o botão dela
fica à vista e desabilitado (`PAUSA_FEITA`): ele NÃO entra em `ACOES_DA_FASE`, que segue só para a frente e
espelhando a api. "Handoff" do Figma não entra na etiqueta (ADR-91).

## Nina e a Notícia que Desapareceu (exp03ef1b)

Página `resultados/resultados-nina-noticia.tsx`, criação `atividades/nova/criar-nina-noticia.tsx`,
espelho `lib/nina-noticia-tipos.ts` (o teste lê `vocabulario.ts`, `invariantes.ts`, `conteudo.ts` e
`contrato-de-rotas.ts` da api como texto; o índice `ROTAS` confere cada rota que o hub chama). Guia
`lib/entre-redes/guias/exp03ef1b.ts`, sem transferência (o Canal B saiu, spec §0.1) e sem podcast.

- **"aposta" é nome INTERNO** (passo e etapa). Na tela é "escolha" — "Travar Escolha", "Escolhas da
  Etapa 2" (spec §7.1). O teste do espelho lê as telas desta missão SEM comentários e reprova a
  palavra fora do literal `"aposta"`.
- **Preparo no topo, como o Júri**: "Usar Banco Padrão" (`POST banco-padrao`, textos sem IA). **Aqui o
  banco padrão SE AFASTA do Júri** (ADR-199, pedido do Lucas): o pacote nasce EM PREPARO e a criação
  abre a MESMA grade `imagens-da-nina.tsx` (`data-fase="banco-padrao"`), com `gerarAoAbrir` — as do
  banco chegam prontas, as que faltam se geram com a quota dela (de graça pelo hash), "Refazer
  imagem" e "Aprovar imagens"; só então "Pacote homologado e pronto." e o "Liberar". As CENAS
  FIXAS não aparecem na grade (iguais para todas as turmas, a professora não as refaz): o
  `gerar-midia` as gera na conta da plataforma, e quem as confere é o `admin`. Ou o
  recorte com IA: Componente Curricular (`Selection`), Tema do Evento (≤ 60) e **"Assunto da
  matéria"** (spec §7.2). `gerar-conteudo` é UMA chamada que escreve só o texto das três notícias
  (cabe no teto do BFF); `usouIa: false` mostra o quadro E0-PROF-03 com o título da falha
  (`FALHA_DA_GERACAO`) e "Carregar Banco Padrão" — o banco NÃO entra na conferência.
- **A ESTRUTURA é do servidor**: a conferência (E0-PROF-04) só edita a MANCHETE ("Editar Manchete",
  ≤ 4 palavras) e regenera UMA notícia ("Regenerar Notícia"); suportes, fichas e lugar não se editam.
  A do telão vem tracejada, com o Onde vazio de propósito.
- **Duas fases** (ADR-146): "Homologar Pacote" grava os textos; a grade `resultados/imagens-da-nina.tsx`
  gera as quatro imagens (as três fotos e o cartaz) em laço (`gerar-midia` por pacote), com a FOTO DO
  TELÃO em destaque ("confira se o pátio aparece" — K1 é ✔) e "Refazer imagem"; "Aprovar imagens"
  fecha. Sem a segunda fase é "Em preparo". "Pacote homologado e pronto." e o botão final do
  assistente vira "Liberar Atividade para a Turma" (`rotuloDoCriar`), que põe no ar E libera na sala.
- **O painel (E4-PROF-01)**: "Painel da Sala em Tempo Real", polling de 5 s. DOIS portões pelo
  `proximaEtapa` ("Liberar Filtro", depois "Liberar Inspeção"; `{acao: "liberar", para}`), e
  "Pausar Turma"/"Retomar Turma" (`{acao: "pausar" | "retomar"}`) — pausada, o painel vira o quadro
  "Sala pausada" do print 24 e o portão some até retomar. Quatro números na ordem dos portões
  (`progressoDaAula`: Entraram, Travaram a escolha, Viram a notícia sumir, Concluíram — os seis
  cartões por etapa espremiam o painel; a etapa de cada um é a folha), "Escolhas da Etapa 2" (só o
  agregado; o VALOR é curto, a porcentagem, e a frase vai na descrição — no corpo grande do
  `MetricCard` a frase estourava o cartão) e "Alertas da sala" (vazio = "Nenhum alerta
  crítico ativo"); o roteiro de mediação na íntegra; a folha diz etapa, passo e alertas — nunca acerto.
  `mudouAEvidencia` relê a página quando uma linha passa de `ficha`, `reparo`, `rotina` ou `caso`.
- **"Zerar Turma"** com diálogo: rodada nova, habilidades apagadas (ADR-155).

## O Porta-Voz dos Dados (exp03em1b)

Página `resultados/resultados-porta-voz.tsx`, criação `atividades/nova/criar-porta-voz.tsx`, espelho
`lib/porta-voz-tipos.ts` (as rotas da turma em `ROTAS_DA_TURMA`, conferidas no controller da api pelo
teste). **A primeira missão com atividade e SEM equipe** (individual por desenho, ADR-198): ela está em
`MISSOES_SEM_EQUIPE` (`lib/entre-redes/atividades.ts`), o assistente de criação pula o passo Equipes, o
`concluirCriacao` não grava montagem (a api responderia 400 `missao-sem-equipes`) e a página da
atividade não tem a aba Equipes. **O em andamento é da TURMA** (`POST …/em-andamento` com `{ pacoteId }`
no corpo, `corpoDoEmAndamento`), não do pacote como nas irmãs. `GET /pacotes` traz também o RASCUNHO da
curadoria (`aprovadoEm: null`): ele não é atividade, e a lista o tira. "Usar Banco Padrão e Liberar"
(`pacotes/padrao`) homologa, põe no ar E libera na sala no mesmo toque; sem IA, a geração cai no aviso
do E0-PROF-03 com "Carregar Banco Padrão Curado", e o rascunho do banco curado NÃO entra na curadoria. O
"Regenerar Item" devolve o rascunho inteiro do servidor, e a tela fica só com o item novo
(`comItemRegenerado`): as edições dos outros blocos só sobem no "Homologar Pacote de Conteúdo". A aula
são dois botões só para a frente ("Pausar para o debate", "Liberar Retomada da Turma"); a lousa é só
contagem (escala da 1ª publicação, anexo, errata, perícia), e o polling chama `router.refresh()` quando
`mudouAEvidencia` acusa um dos três gestos que a ficha marca. O podcast é só do professor (aba Podcast).

## O Dossiê Invisível (exp09ef1b)

Página `resultados/resultados-dossie-invisivel.tsx`, criação `atividades/nova/criar-dossie-invisivel.tsx`,
espelho `lib/dossie-invisivel-tipos.ts` (o teste lê `conteudo.ts`, `regras/passos.ts`,
`contrato-de-rotas.ts` e o controller da api como texto, e reprova a Etapa 6 nas telas), guia
`lib/entre-redes/guias/exp09ef1b.ts`. **O molde é o Porta-Voz** (ADR-202): individual
(`MISSOES_SEM_EQUIPE`), em andamento da TURMA com `{ pacoteId }` no corpo, o rascunho da curadoria fora
da lista, "Usar banco padrão" que põe no ar E libera na sala, e sem IA o E0-PROF-03 com "Prosseguir
com Banco Padrão" (o banco NÃO entra na curadoria). A curadoria (E0-PROF-04) edita os três projetos e
os cadernos inline; o número de documentos de cada papel (1, 7, 12) é fixo — edita-se o texto, não a
quantidade. "Regenerar item pontual" troca só o item (`comItemRegenerado`), e a etiqueta "Modificado
pelo docente" sai de `itensModificados` contra o que o servidor entregou. **TRÊS travas, só para a
frente** (`TRAVAS`, `proximaTrava`): "Liberar Próxima Pauta", "Abrir Revisão da Decisão" (depois do
debate) e "Destravar Explicar e Protocolo" — as três à vista, só a próxima habilitada; o rótulo vem de
`roteiro.botoes` da api. A lousa é só contagem: a "Distribuição de Votos da Turma — 1ª Deliberação"
(tipografia grande, para o telão), os caminhos A1/A2/B e, depois da trava do debate, a "Consolidação
do Segundo Voto e Migração de Escolhas" (mantiveram/trocaram e 1ª × final por projeto). **Não há a
Etapa 6** (o caso do transporte saiu da missão): nada de módulo extra no painel. Podcast só do
professor.
