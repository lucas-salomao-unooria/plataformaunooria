# apps/api/src/evidencias — a evidência pedagógica por habilidade da BNCC (E14, ADR-112)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## O que é a evidência aqui

**Que habilidades da BNCC cada estudante DEMONSTROU numa atividade de uma
missão, rodada a rodada.** A missão já via o que a criança fazia (tirou o post
do ar, acertou a pergunta) e isso morria dentro da experiência; aqui vira o
nível que o professor lê, corrige e leva para o boletim.

A plataforma entrou primeiro; as missões entram uma a uma, cada uma com a sua
ficha. **A primeira é Quem Mandou Isso?** (`fichas/exp05ef1b.ts` v5, ADR-177;
sem as P1/P2 desde a ADR-171): só ações rotuladas, cada uma na transação do
próprio envio — Mural (EF05CO08), alerta do grupo no 4º envio (CO03), robô do
grupo (CO04). Sem resolvedor.
**A segunda é A Seleção (`exp07ef1b`)**: `fichas/exp07ef1b.ts` v2 (ADR-170,
que tirou as enquetes P1/P2): EF07CO11 pela legenda lida por IA, marcada numa
transação só dela DEPOIS da resposta; EF07CO08 pela marcação do post do colega,
congelada na abertura das fichas. Sem resolvedor. Falhando a IA, não há marca:
"Não avaliado", com a sugestão da reserva na lista da aula, e o professor
ajusta — com `motivo` opcional (ADR-170, `MOTIVOS_DE_AJUSTE`), que vai só para
o histórico (`evidencias_eventos.para.motivo`), para todas as missões.
**A terceira é o Jornal da Escola (`exp04ef1b`)**: `fichas/exp04ef1b.ts`,
**versão 2, Canal A puro (ADR-168)** — EF15CO04 por `julgamentos`, EF15CO02 por
`montagem` + `simulacao`, EF04CO08 por `edicao-2` + `transferencia`, todas AÇÃO,
nenhuma pergunta e nenhum resolvedor de contexto. O marcador parcial tem teto
em "em processo" e o final grava o COMBINADO: é assim que uma régua "A só com
as duas" cabe no "vale o melhor" desta porta, sem regra nova na plataforma.
**A quarta é o Júri Estadual (`exp06ef1b`)**: `fichas/exp06ef1b.ts` v6
(ADR-176 sobre a 174, que tirou as enquetes P1–P3 e a EF06CO10): só ações
rotuladas, cada uma na transação do próprio envio — `classificacao`, a
separação nas PASTAS do feed, corrigida e marcada no VOTO (EF06CO01, a
principal; < 4 estandes vistos = sem marca), e `regra`, a SE … ENTÃO (EF06CO03,
id novo: a `cadeia` da v4 fica no histórico). Sem resolvedor.
**A quinta é o Unoovista (`exp08ef1b`)**: `fichas/exp08ef1b.ts` v2 (ADR-167,
que tirou as três perguntas da ADR-153): toda habilidade por AÇÃO — `raio-x` e
`reflexao` (EF08CO11), `termos` (EF08CO09), `envio` e `envio-sem-confiabilidade`
(EF08CO07, limitado pela atividade), todos com `rotulo`. Sem resolvedor
registrado: as tarefas marcam da run do próprio estudante
(`motor/contexto-da-evidencia.ts#contextoDaRun`, `null` em atividade sem turma)
e a **rodada é sempre 1**. Vale o PRIMEIRO envio: o reinício reabre a tarefa e
não apaga a marca, e a missão confere `jaMarcou` antes de marcar.
**A nona é O Assistente Invisível (`exp01em1b`, ADR-185)**: `fichas/exp01em1b.ts` v1, 100% Canal A, sem perguntas e sem resolvedor — EM13CO20 (foco), EM13CO01, EM13CO18 e EM13CO03 marcadas JUNTAS no latch do Publicar (E6); quem apostou e não publicou recebe as quatro quando o professor encerra a missão na Sala de Aula, com a publicação ausente (o "conta ao encerrar" da ADR-154, sem `contaAoEncerrarAMissao`: a própria missão se registra em `SalasService.aoEncerrarMissao`); atividade = o pacote. **A décima é O Porta-Voz dos Dados (`exp03em1b`, ADR-198)**: `fichas/exp03em1b.ts` v1, 100% Canal A, sem perguntas e sem resolvedor — EM13CO13 no Publicar da 1ª publicação; EM13CO12, CO21, CO22 e CO26 na DECISÃO DA ERRATA (publicar ou pular), porque leem o conjunto FINAL e a porta guarda a melhor marca (marcar na 1ª deixaria um "atingiu" que a errata regressiva não apagaria); EM13CO14 no parecer da perícia (ou no pular); atividade = o pacote. **A oitava é O Enigma da Capa da Rádio (`exp02ef1b`, ADR-184; a 2.0.0, ADR-186)**: `fichas/exp02ef1b.ts` v2, 100% Canal A, sem perguntas e sem resolvedor — EF02CO01 quando os invariantes completam, EF02CO05 no "Pronto" do "o que ficou fora" (a lupa, o selo, os invariantes e o "fora" juntos); atividade = o pacote. **A sétima é O Efeito Amplificador (`exp02em1b`, ADR-181; a 2.1.0, ADR-191)**: `fichas/exp02em1b.ts` v2, 100% Canal A (sem perguntas) — EM13CO14 e EM13CO26 marcadas no Publicar; EM13CO24 pelo MOTIVO do aviso de cuidado e EM13CO08 pelas três proteções do feed (privacidade, denúncia e relato encaminhado), a melhor, e o "não atingiu" na abertura dos bastidores; atividade = o pacote, como a exp05ef1b. **A sexta é a Missão Tempestade (hoje `exp02em1b-v0`, a versão anterior)**: `fichas/exp02em1b-v0.ts` v2
(ADR-172, que tirou as quatro perguntas da ADR-154): toda habilidade por AÇÃO
— `leitura`, `fontes`, `e-se`, `whatsapp`, `alerta`, `saude` e `moradora`,
todos com `rotulo` —, marcadas pelas tarefas de `unoogpt/canal-a.service.ts`
(as que são "primeira da rodada" conferem `jaMarcou`). Continua com
`contaAoEncerrarAMissao` (vira evidência só no encerramento da missão na Sala
de Aula: `SalasService.aoEncerrarMissao` → `aoEncerrarAMissao`, pelo mesmo
`gravarPropria`). Atividade `"turma"` (a das equipes), rodada da turma, sem
resolvedor registrado: não há pergunta.
**O encerramento só transforma em nível a marca de marcador que ESTÁ na ficha
vigente** (`aoEncerrarAMissao`): a turma com a missão aberta no dia em que a
ficha muda tem marcas de marcador que saiu (as `p1`–`p4` da Tempestade v1), e
elas virariam nível pelo caminho que o pedagógico tirou. A marca fica no banco;
só não conta.

Três tabelas de PLATAFORMA (sem prefixo, como `liberacoes` e `equipes`), todas
com `escola_id` + RLS forçada:

| Tabela | O que guarda |
|---|---|
| `evidencias_marcas` | o DADO BRUTO: uma linha por marcador da ficha × estudante × atividade × rodada. Só a missão escreve (pela porta `marcar`) |
| `evidencias` | a evidência por HABILIDADE: `status`, `origem` (`propria`/`equipe`/`projecao`/`professor`), `situacao` (`valida`/`a_revisar`) — é o que o painel lê |
| `evidencias_eventos` | o histórico APPEND-ONLY, com de/para, quem e quando. Trigger recusa `UPDATE`; a role de runtime só tem `SELECT, INSERT` |

## As regras (todas em `regras.ts`, todas testadas sem banco)

- **A unidade é ATIVIDADE + RODADA.** A atividade é um id OPACO da missão
  (`ATIVIDADE_ID_RE`); reiniciar a atividade abre a rodada seguinte, e a
  anterior fica — **salvo o "Zerar a turma"** (e o "Apagar as sessões" do
  Unoovista), que apaga marcas e níveis da atividade: `apagar-da-atividade.ts`,
  ADR-155. O histórico fica (a role não apaga).
- **A escala: atingiu > em_processo > nao_atingiu. N/A é a AUSÊNCIA de linha.**
  `nao_participou` é o N/A EXPLÍCITO que só o professor põe, e existe para
  BARRAR a cópia da equipe. No perfil ele conta como N/A.
- **Dois marcadores da mesma habilidade na mesma rodada: vale o MELHOR.**
- **O resultado da atividade é a MELHOR RODADA POR HABILIDADE** — cada
  habilidade com o melhor nível válido que teve em qualquer rodada.
- **Precedência: professor > a própria criança > a cópia da equipe.** A marca
  própria vence a cópia mesmo sendo pior; nada vence o ajuste.
- **A cópia para a equipe** (`decidirCopia`, lendo `equipes/consulta.ts#mapaDeEquipes`):
  quando o resultado próprio sai, os colegas de computador recebem o NÍVEL —
  nunca texto. Colega com marca própria daquela habilidade na rodada, ou com
  ajuste do professor, não é sobrescrito; entre duas fontes, fica a melhor.
- **A PROJEÇÃO** (`ehProjecao`: a montagem tem `computadores = 1`, ou a equipe
  tem a turma inteira) copia como `projecao`/`a_revisar` e **não conta** —
  nem no resultado, nem no perfil — até "Confirmar para a turma" (`valida`).
  Depois o professor ainda ajusta um a um.
- **Equipe mudou → recalcula SÓ a rodada em andamento DA ATIVIDADE cuja
  montagem mudou** (ADR-130: a equipe é da atividade, e o `alvo` do gancho a
  traz): a rodada da marca mais recente dela na turma. A cópia para os colegas
  usa a equipe DAQUELA atividade (`mapaDeEquipes(..., m.atividadeId)`). Rodada passada nunca muda por troca
  de equipe; corrige-se no ajuste. Cópia que não mudou de nível nem de origem
  FICA com a confirmação que tinha (`diferencaDasCopias`).
- **Múltipla escolha: o gabarito é do servidor.** O estudante recebe a pergunta
  sem `status`, responde só a alternativa, e recebe `{ enviada: true }` —
  sempre, na primeira e na segunda. **Vale a PRIMEIRA resposta** — salvo a
  ficha com `respostas: "melhor"` (ADR-154). Atividade e
  rodada NUNCA vêm do cliente: saem do resolvedor da missão.
- **As alternativas saem EMBARALHADAS, numa ordem nova a cada leitura**
  (`regras.ts#embaralhar`, Fisher–Yates sobre uma cópia). A ficha as guarda na
  ordem da régua — atingiu primeiro, porque é assim que o pedagógico escreve —,
  e servida assim "a primeira é a certa" vira a pista da turma. No SERVIDOR, e
  não na tela: o bundle é público e a tela é de cada missão; aqui a regra vale
  para todas sem nenhuma lembrar. A tela responde pelo `id`, nunca pela
  posição. O teste de Postgres lê 60 vezes e cobra mais de uma ordem.
  Ficha com `ordemDasAlternativas: "por-estudante"` (o Júri até a v4): ordem
  fixa por estudante (`regras.ts#aleatorioDe`).
- **De onde veio o nível (ADR-166).** A evidência PRÓPRIA guarda o marcador
  que a deu (`evidencias.marcador`, `regras.ts#marcadorDoNivel`): o da melhor
  marca; no empate, o que NÃO é `limitadoPelaAtividade`, depois a ordem da
  ficha. Cópia e ajuste ficam com `null` (CHECK
  `evidencias_marcador_so_na_propria_check`). Com `rotulo` no marcador da
  ficha, o painel traz `marcador`/`rotulo` na célula, `acoes` (o nível de cada
  ação rotulada) quando elas DIVERGEM na rodada, e `origemDoResultado`. **Ficha
  sem `rotulo` não recebe nada disso** — é o que mantém o painel das missões
  antigas igual, e a suíte cobra (`o painel › a forma`).
- **O "em processo" limitado pela atividade** (`limitadoPelaAtividade`, só em
  marcador de ação): a missão nunca grava ali acima de `em_processo`. O
  consolidado o conta em `emProcessoLimitado`, FORA de `emProcesso` e dentro do
  `total`; entre atividades, empate limitado × comum guarda o COMUM
  (`regras-do-consolidado.ts#limitadosDaMissao`). O limitado sai da ficha de
  HOJE (`fichaDe`), e a cópia da equipe não o carrega.
- **O professor ajusta a qualquer momento**, mesmo com a missão encerrada, um ou
  vários (1..200); cada mudança vai para o histórico. **Gestor só LÊ. O
  estudante nunca vê o próprio resultado. Não há ranking em lugar nenhum.**

## A porta das missões

Missão com ficha faz TRÊS coisas, no mesmo trabalho:

1. **A ficha** em `fichas/<expId>.ts`, entrando em `FICHAS` (`fichas/index.ts`).
   `tests/evidencias-fichas.spec.ts` confere: códigos da BNCC com a grafia
   exata (`curriculo/`), `expId` nos manifestos, gabarito só com níveis válidos,
   todo marcador de pergunta apontando para uma pergunta que existe. Subiu
   marcador ou gabarito? Suba a `versao` da ficha — ela vai gravada em cada
   marca.
2. **O contexto**: `EvidenciasService.registrarContexto(expId, resolver)` no
   `onModuleInit` do módulo dela — o resolver diz, para um estudante, a turma,
   a atividade e a rodada EM ANDAMENTO (ou `null`). Sem ele, a pergunta
   responde 409 `sem-atividade-em-andamento`.
3. **A marca**: `EvidenciasService.marcar(tx, {...})` DA TRANSAÇÃO dela, no
   ponto em que a missão já sabe o que a criança fez. Recebe o `tx` e não abre
   `comTenancy`: a marca cai junto se a jogada cair.
   **Toda rodada mede tudo de novo** (ADR-145): não há "já foi avaliada
   antes". A ADR-120 pulava a ação que a revelação entrega na rodada nova do
   mesmo pacote; o PO pediu a medição inteira, e a melhor rodada por
   habilidade já impede que a repetição derrube o resultado.

`registrarFicha` existe **só para teste**. A suíte da plataforma registra uma
ficha FALSA da exp08ef1b, que SUBSTITUI a real só na instância dela, de
propósito (as regras pedem uma pergunta de múltipla escolha, que a real não tem
mais); a real e as tarefas do motor são provadas em `tests/motor-evidencia-postgres.spec.ts`.
A ficha real vai no registro estático, onde a trava a confere.

O resolvedor da missão devolve `null` sempre que a resposta não deve contar:
na A Seleção, antes da reflexão (a enquete vem depois dela, na ordem do PO) e
quando a sessão não é mais a (cobertura, rodada) do gate — a professora zerou ou
trocou o tema, e uma resposta atrasada cairia numa rodada que acabou.

## As rotas

- Professor (+ gestores lendo): `GET /evidencias/turma/:turmaId/missao/:expId/atividade/:atividadeId`
  (o painel; missão sem ficha = 200 com `temFicha: false`) e
  `GET /evidencias/estudante/:estudanteId` (o perfil).
- Só professor que leciona: `POST …/rodadas/:rodada/confirmar` e
  `PATCH …/rodadas/:rodada/ajustes` — as duas devolvem o painel.
- Estudante: `GET /evidencias/:expId/perguntas/:perguntaId` e
  `POST /evidencias/:expId/perguntas/:perguntaId/resposta`.
- Turma que o professor não leciona, e estudante que ele não ensina: **404,
  nunca 403** (o desenho de `salas`).

## O painel de habilidades (F14.7, ADR-144)

A evidência SOMADA, só leitura, em `evidencias-consolidado.{service,controller}.ts`
e com as regras puras em `regras-do-consolidado.ts`:
`GET /evidencias/turma/:turmaId/consolidado` (professor e gestão),
`GET /evidencias/escola/consolidado` (gestão) e
`GET /evidencias/rede/consolidado` (regional e contrato).

- **A coluna é a UNIDADE da missão** (do manifesto, na tabela `experiencias`),
  nunca o bimestre do calendário.
- **O nível da criança na MISSÃO é o melhor entre TODAS as atividades e
  rodadas** — é `melhorRodadaPorHabilidade` sobre as linhas da missão inteira.
  Cada missão fica separada; a mesma habilidade em duas missões são duas linhas.
- **Quem conta é a lista de estudantes da turma** (`users.turma_id`), não as
  linhas: a criança sem linha que valha é `naoAvaliado`, e a linha de quem saiu
  da turma não entra. `aplicada` = a turma tem QUALQUER linha da missão (até a
  projeção a confirmar).
- **Escola e rede leem só o ano letivo vigente** (`periodoVigente`): sem isso, a
  soma da série misturaria dois anos de crianças. O `agora` é parâmetro para o
  teste não depender do dia.
- **A rede é o laço do relatório da diretoria** (ADR-82): uma transação por
  escola, em lotes de 8. Nunca afrouxe a RLS para acelerar; o gatilho é
  agregado materializado.
- **A REGIONAL desce por `escolaDaConsulta`**: nas rotas de turma, escola e
  perfil ela pede `?escolaId=` de uma escola da regional, e quem decide é
  `EscolasService.temLotacao` (por isso o módulo importa o `RosteringModule`).
  Para os outros papéis vale `escolaAlvo`, igual a antes.
- **O perfil ganhou o nível POR MISSÃO** (`habilidades`, com `null` =
  "não avaliado"), `unidade` e `ultimaEm`, e as missões saem da mais recente
  para a mais antiga. As `atividades` continuam ali.
- **Toda altura abre pelo TOTAL** (ADR-160): `escola/consolidado` e
  `rede/consolidado` devolvem `total`, a soma de TODAS as linhas da resposta,
  série a série — `somarPorSerie` (turmas → escola) e `juntarSeries` (escolas →
  regional → rede), só contagens. A tela não soma nada: total inventado no hub
  não tem teste contra o banco.
- **O contrato na rede inteira desce pela REGIONAL**: a resposta traz
  `regionais` (cada uma com a soma das escolas dela) e cada escola diz a sua
  `regionalId` (`null` = pendurada direto no contrato, e aparece sozinha — sem
  ela o total não fecha). Com `?regionalId=`, e sempre para a `gestor_regional`,
  `regionais` vem vazio.
- **A veracidade é teste, não promessa**: `tests/evidencias-consolidado-postgres.spec.ts`
  prova que cada total é a soma das linhas, que a linha de uma regional no
  painel do contrato é o MESMO número que a coordenação regional lê, e as
  negações por papel (turma de outra escola com escola liberada, perfil de
  criança de outra escola, contrato sem `?escolaId=` = 400, professor e a
  criança da turma vizinha = 404).
- Fora, por decisão: a planilha (CSV) com aviso de LGPD e registro de auditoria.

## Armadilhas

- **Fora de `comTenancy`, tudo volta VAZIO e a escrita é recusada** — as três
  tabelas têm RLS. A missão que chamar `marcar` com um cliente sem tenancy
  armada recebe erro de política, não uma marca.
- **Vocabulário em dois lugares**: as constantes de `regras.ts` e os CHECKs da
  migration `20260925150000_evidencia_pedagogica`. `tests/evidencias-postgres.spec.ts`
  compara os dois. E há CHECKs de COERÊNCIA (`a_revisar` só na projeção, cópia
  com fonte, ajuste com autor, `nao_participou` só do professor): linha que o
  código montar errada é recusada pelo banco.
- **`estudante_id` TEM FK para `users`, com cascata** — é a trava da identidade
  única (`tests/identidade-unica.spec.ts`), e a evidência sai com a criança. No
  histórico também é cascata, nunca `SET NULL`: anular seria um `UPDATE`, que o
  trigger recusa, e a exclusão da conta travaria.
- **`equipe_id`, `fonte_estudante_id`, `editado_por` e `autor_id` não têm FK**:
  as equipes são trocadas INTEIRAS a cada `PUT` (ADR-111), e carimbo de quem
  ajustou (ou de quem a cópia veio) não pode travar a saída de ninguém da rede.
- **O recálculo roda na transação do `PUT` das equipes** (gancho
  `EquipesService.aoMudarEquipes`, registrado no `onModuleInit`). Um erro aqui
  desfaz a montagem — é o certo, e é por isso que ele não pode ser lento. No
  teste, quem chama `onModuleInit` é a suíte.
