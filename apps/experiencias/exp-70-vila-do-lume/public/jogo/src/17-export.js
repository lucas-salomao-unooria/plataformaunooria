/* Vila do Lume — montagem do payload da partida

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* Este arquivo só LÊ o estado da partida e monta o corpo validado por
   `apps/api/src/vila/contrato.ts` (Zod, a fronteira entre o jogo e o banco). Ele não altera
   nada do jogo.

   Quem entrega o payload é `window.VILA.concluir()`; o jogo não conhece HTTP nem token. O
   caminho de pendrive e o `.json` para o professor não existem mais.

   DUAS REGRAS QUE O CONTRATO IMPÕE, e que estão implementadas aqui:

   1. Nenhum campo de nome. O Nome de Jogo vive só na Camada 1 (docs/adr/0002) e não é
      serializado. O servidor rejeita com 422 qualquer payload com chave de nome, então um
      vazamento por descuido vira erro visível em vez de dado gravado em silêncio.

   2. Nenhum perfil calculado. O jogo sabe computar o retrato Schwartz — e não o envia. O
      servidor recalcula a partir das medidas brutas, com versão própria de mapeamento.
      Assim, quando a hipótese mudar (e ela vai: é hipótese de design, não instrumento
      validado), todo o histórico pode ser reprocessado e comparado. Enviar o resultado
      pronto tornaria isso impossível. */

const EXPORT_SCHEMA_VERSION = 1;
/* Sobe a cada mudança no que é ENVIADO. Sem isto, duas gerações de bundle rodando na
   mesma escola ficam indistinguíveis na tabela, e um campo que só existe na segunda vira
   "dado faltando" sem explicação. 08.20b = ganhou `duracaoTotalSeg`. */
/** Rede contra descuido: os `state.log.push` já mandam `tipo` em snake_case, e o contrato
 *  da api exige `^[a-z0-9_]+$`. Isto normaliza de qualquer jeito — um `tipo` com acento ou
 *  espaço faria a api recusar a PARTIDA INTEIRA de uma criança por causa de um caractere. */
function normalizarTipoEvento(tipo){
  return String(tipo || 'log')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'log';
}

const BUNDLE_VERSION = '2026.08.20c';

/* `novoSessaoLocalId()` saiu. O id da partida é emitido pela API quando ela abre, e a
   idempotência é dele: o cliente não escolhe mais a própria chave. Isso resolve de raiz o
   bug que o comentário antigo descrevia — a segunda criança da mesma máquina reaproveitando
   o id da primeira e vendo a partida dela ser recusada como "duplicada". */

function construirPayloadSessao(){
  const vp = (typeof computeValueProfile === 'function') ? computeValueProfile() : null;
  const ev = vp ? vp.evidence : {};
  const fires = state.visited.filter(id => id !== 'espelho').length;
  /* Dois tempos, e a diferença entre eles importa:
       duracaoSeg      — do "ENTRAR NA VILA" até o fim. É o tempo de JOGO, e é o
                         denominador dos probes de ritmo (fogueiras por minuto).
       duracaoTotalSeg — desde que a página abriu, incluindo a intro.

     Uma criança de 6 leva vários minutos nos nove cartões do Lume. Sem o total, o
     professor cronometra a atividade inteira e vê um número bem menor no painel — foi
     exatamente o que aconteceu com o Aluno 05: 4min18 de jogo dentro de uma sessão que
     durou bem mais. */
  const duracao = sessionStartedAt ? Math.round((performance.now() - sessionStartedAt)/1000) : 0;
  const duracaoTotal = Math.round((performance.now() - pageOpenedAt)/1000);

  return {
    v: EXPORT_SCHEMA_VERSION,
    bundleVersion: BUNDLE_VERSION,

    /* `sessaoLocalId` e `destino` saíram. Quem é a criança e de que turma ela é já está na
       sessão autenticada com que o shim abriu a partida — repetir isso no payload só criaria
       uma segunda fonte de verdade para o servidor conferir contra a primeira.

       `iniciadaEm` também saiu: era derivado do relógio da máquina (`Date.now()`), e o
       próprio jogo documentava que a hora do sistema numa máquina de escola costuma estar
       errada. Quem crava o início agora é a api, quando a partida abre. Os dois tempos
       abaixo são medidos com `performance.now()` e continuam valendo — são durações, não
       horários. */
    duracaoSeg: duracao,
    duracaoTotalSeg: duracaoTotal,
    status: fires >= zones.length ? 'completa' : 'abandonada',

    resumo: {
      fogueirasAcesas:   fires,
      pedrasQuebradas:   state.crystalsMined,
      aldeoesAjudados:   state.villagersRescued,
      lampioesAcesos:    state.lampsLit,
      tochasAcesas:      state.torchesTaken,
      /* Os nomes internos são em inglês (`dilemmasSeen`), os do contrato em português.
         Errar essa fronteira não quebra nada em tempo de execução: vira zero silencioso.
         Foi o que aconteceu na primeira versão deste arquivo. */
      dilemasVistos:     ev.dilemmasSeen || 0,
      dilemasResolvidos: ev.dilemmasResolved || 0,
      distanciaM:        Math.round(state.distanceWalked)
    },

    /* Medidas brutas — é daqui que o servidor recalcula o perfil. Tudo que a Camada 2
       observou, sem nenhuma interpretação aplicada. */
    medidas: {
      cobertura: {
        celulas:         Object.keys(state.cellVisits).length,
        total:           COVERAGE_N * COVERAGE_N,
        pisoObrigatorio: MANDATORY_CELLS
      },
      movimento: {
        movendoSeg: Math.round(state.movingTime),
        escuroSeg:  Math.round(state.timeInDark),
        luzSeg:     Math.round(state.litPathTime),
        atalhos:    state.shortcutsTaken,
        desvioM:    Math.round(state.detourDistance),
        raioMax:    +state.maxRadius.toFixed(1)
      },
      lume: {
        conversas:        state.bitTalks,
        perguntasCaminho: state.lumeAsks,
        lore:             state.loreTalks,
        ajuda:            state.helpTalks,
        sugestaoSeguida:  state.suggestionFollowed
      },
      tocha: {
        aldeao:    state.torchesSpent.aldeao,
        lampiao:   state.torchesSpent.lampiao,
        pedra:     state.torchesSpent.pedra,
        passarela: state.torchesSpent.passarela,
        retomadas: state.torchesReclaimed
      },
      pedra: {
        borda:         state.nameOnBorda,
        destaque:      state.nameOnDestaque,
        nomesApagados: state.namesErased,
        nomesLidos:    state.namesRead
      },
      fumaca:     { avistadas: state.smokeSpotted, seguidas: state.smokeFollowed },
      brinquedos: state.playfulActs,
      resgates:   state.rescueTimes
    },

    /* Onde o Chamado alcançou a criança. Ausência aqui significa "não observado" — que é
       diferente de zero, e o painel do servidor precisa dessa diferença para não tratar
       silêncio como escolha. */
    oportunidades: Object.assign({}, state.opportunities),

    dilemas: state.dilemmaChoices.map(c => ({
      pairId: c.pairId, escolha: c.chose, emMs: Math.round(c.at * 1000)
    })),

    /* Telemetria fina. Tempo RELATIVO ao início, nunca relógio de parede: a hora do sistema
       numa máquina de escola costuma estar errada, e o horário absoluto em que uma criança
       específica jogou não interessa a ninguém.

       SEM TEXTO LIVRE. Era `dados: {tag, texto, risco}`, com `texto` montado por template
       string — o único canal de texto arbitrário do payload, e o caminho por onde o nome
       da criança chegaria a um JSONB que vive 90 dias (o shim entrega o primeiro nome dela
       ao jogo, para o Lume chamá-la e para a Pedra dos Nomes).

       Agora cada `state.log.push` já nasce tipado: `{tipo, dados}`, com valores que são
       número, booleano ou palavra de um VOCABULÁRIO FECHADO (ids de zona, destinos da
       Tocha, ações da Pedra, ids de cartão — ver `contrato.ts` da api). Nome de criança
       não cabe num vocabulário fechado; é trava estrutural, não lista de proibidos. */
    eventos: (state.log || []).map(e => ({
      tipo: normalizarTipoEvento(e.tipo),
      emMs: (typeof e.atMs === 'number') ? e.atMs : null,
      dados: e.dados || null
    })),

    /* SÓ O QUE ELA FEZ — a classificação é da api (regra inviolável nº 3).
       Saíram daqui:
         · `seguras` e `risco`, que vinham de `safeChoices`/`riskyChoices`: era o cliente
           decidindo o que foi risco;
         · `golpeAceito`/`golpeRecusado`/`legitimaAceita`/`legitimaRecusada`: as quatro
           contagens continuam existindo, calculadas no servidor (`mensagens.ts`), onde
           ainda separam a criança prudente da que se fechou — que é a distinção que o
           professor mais precisa;
         · `bolha`: a api já sabe qual atribuiu, e o cliente declarando de novo criaria
           uma segunda fonte de verdade. Os IDS DOS CARTÕES respondidos provam a bolha, e
           a api confere que pertencem a ela — mais forte que acreditar no campo;
         · `nivel`, `legitima` e `aceitou` por cartão: gabarito. */
    seguranca: {
      apareceram:  state.dmsFired,
      respondidas: state.dmCartoes.filter(c => c.escolha !== null).length,
      ignoradas:   state.dmsIgnored,
      cartoes: state.dmCartoes.map(c => ({
        id: c.id, emMs: c.emMs, viuOpcoes: c.viuOpcoes,
        escolha: c.escolha, decisaoMs: c.decisaoMs
      }))
    }
  };
}

/* Rede contra o próprio descuido: se algum dia alguém adicionar um campo de nome ao
   payload, isto quebra aqui, na máquina do desenvolvedor, em vez de gravar dado de criança
   num banco. O servidor faz a mesma checagem — as duas pontas, de propósito. */
const CHAVES_PROIBIDAS = ['nome','name','playername','aluno','crianca','criança','apelido'];
function verificarSemNome(obj, caminho){
  caminho = caminho || '$';
  if(obj === null || typeof obj !== 'object') return [];
  let achados = [];
  Object.keys(obj).forEach(k => {
    if(CHAVES_PROIBIDAS.includes(k.toLowerCase())) achados.push(caminho + '.' + k);
    achados = achados.concat(verificarSemNome(obj[k], caminho + '.' + k));
  });
  return achados;
}
/* ===================== ENTREGA DA PARTIDA =====================

   Saíram daqui, no porte para a plataforma:

     · `exportarSessao()` / `exportarSessaoDoAluno()` / `baixarPayload()` — o `.json` que o
       professor levava no pendrive;
     · `vilaExportarTudo()` — a saída pelo console, sem botão, porque botão é convite;
     · `enviarSessaoAoServidor()` com `fetch('/api/v1/sessoes')` e a checagem de
       `location.protocol` — o jogo já não é servido pelo mesmo host da api, e quem fala com
       ela é o shim, com o token da sessão do aluno.

   O jogo agora entrega o payload por `window.VILA.concluir()` e não sabe o que acontece
   depois — nem se deu certo. Isso é deliberado, e é a mesma regra do jogo de origem: erro de
   envio NÃO vira alerta na tela da criança. Interromper o fim do jogo dela com uma falha de
   rede seria trocar a experiência dela por uma preocupação que é do adulto.

   O que FICOU foi `verificarSemNome()`, e ele importa mais agora do que antes: o shim entrega
   o primeiro nome da criança ao jogo (para o Lume chamá-la e para a Pedra dos Nomes), então
   existe um nome em memória que não existia no bundle de origem. A api faz a mesma checagem;
   as duas pontas, de propósito. */
function entregarPartida(){
  const payload = construirPayloadSessao();
  const vazamentos = verificarSemNome(payload);
  if(vazamentos.length){
    console.error('ENTREGA BLOQUEADA — campo de nome no payload:', vazamentos);
    return null;
  }
  if(window.VILA) window.VILA.concluir(payload);
  return payload;
}
