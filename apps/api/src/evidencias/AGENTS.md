# apps/api/src/evidencias — a evidência pedagógica por habilidade da BNCC (E14, ADR-112)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

## O que é a evidência aqui

**Que habilidades da BNCC cada estudante DEMONSTROU numa atividade de uma
missão, rodada a rodada.** A missão já via o que a criança fazia (tirou o post
do ar, acertou a pergunta) e isso morria dentro da experiência; aqui vira o
nível que o professor lê, corrige e leva para o boletim.

A plataforma entrou primeiro; as missões entram uma a uma, cada uma com a sua
ficha. **A primeira é Quem Mandou Isso? v2.2** (`fichas/exp05ef1b.ts`): a
EF05CO08 por uma AÇÃO (a seleção do Mural, marcada na transação do latch) e a
EF05CO03/EF05CO04 por duas perguntas de múltipla escolha — o molde para a
próxima.
**A segunda é A Seleção (`exp07ef1b`)**: `fichas/exp07ef1b.ts` (EF07CO11 pela
legenda graduada por IA — o Canal A — e pela enquete P1; EF07CO08 pela P2),
o contexto registrado no `onModuleInit` de `a-selecao.service.ts` e a marca da
legenda numa transação SÓ DELA, depois do latch da publicação: a IA leva até
6 s, e a transação da jogada não pode esperar. Falhando a IA, não há marca:
"Não avaliado", e o professor decide.
**A terceira é o Jornal da Escola (`exp04ef1b`)**: `fichas/exp04ef1b.ts`
(EF15CO04 por `pistas`, EF15CO02 por `chave`, EF04CO08 por `edicao-2`, `p1` e
`p2`), as três ações marcadas DENTRO das transações dos latches e da Chave, cada
uma depois de `jaAvaliadaAntes` (ADR-120).

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
  anterior fica.
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
  sempre, na primeira e na segunda. **Vale a PRIMEIRA resposta.** Atividade e
  rodada NUNCA vêm do cliente: saem do resolvedor da missão.
- **As alternativas saem EMBARALHADAS, numa ordem nova a cada leitura**
  (`regras.ts#embaralhar`, Fisher–Yates sobre uma cópia). A ficha as guarda na
  ordem da régua — atingiu primeiro, porque é assim que o pedagógico escreve —,
  e servida assim "a primeira é a certa" vira a pista da turma. No SERVIDOR, e
  não na tela: o bundle é público e a tela é de cada missão; aqui a regra vale
  para todas sem nenhuma lembrar. A tela responde pelo `id`, nunca pela
  posição. O teste de Postgres lê 60 vezes e cobra mais de uma ordem.
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
   **Ação que a revelação entrega** (a seleção do Mural da exp05ef1b) pergunta
   antes `jaAvaliadaAntes(tx, {...})`: se a criança já tem nível daquele
   marcador numa rodada anterior da mesma atividade (qualquer origem, menos
   `nao_participou`), a rodada nova mediria memória, e a missão não marca
   (ADR-120).

`registrarFicha` existe **só para teste** (a suíte registra uma ficha da
exp08ef1b em tempo de execução). A ficha de uma missão real vai no registro
estático, onde a trava a confere.

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
