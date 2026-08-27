/* Vila do Lume — CAMADA 2 — instrumentação Schwartz. Nada aqui desenha na tela da criança

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ============ SCHWARTZ BASIC VALUES — inferred, never asked ============
   Ten values on a circumplex, collapsed into the two bipolar dimensions the data can
   actually support. A value only shows itself in conflict — when the child cannot have
   both things — so every probe below is a moment where one priority costs another.

   Honesty note: this mapping from behaviour to value is a design hypothesis, not a
   validated instrument. Schwartz is validated by questionnaire (PVQ / PBVS-C for
   children), not by game telemetry. Treat the output as plausible and explainable,
   never as a measurement. */
/* ---- Medida de cobertura do mapa ----
   Estava em 01-config.js, que é o arquivo de DADOS: cobertura não é dado, é instrumento.
   Trazido para cá junto do resto da Camada 2 — e com isso 01-config.js deixou de ter
   qualquer dependência para frente, virando a folha da árvore. */
const COVERAGE_N = 8;
/* O grid ia de -22 a +22 quando o mundo cresceu para ±32: cobria 47% do mapa, e ir até o
   Portal Secreto, o Campo de Treino ou a Pedra dos Nomes não contava como exploração
   nenhuma. Agora deriva de WORLD_LIMIT, como todo o resto. */
function coverageCell(x, z){
  const half = WORLD_LIMIT;
  const gx = Math.floor((x + half) / (2*half) * COVERAGE_N);
  const gz = Math.floor((z + half) / (2*half) * COVERAGE_N);
  if(gx < 0 || gx >= COVERAGE_N || gz < 0 || gz >= COVERAGE_N) return null;
  return gz * COVERAGE_N + gx;
}

/* Quantas células a ROTA OBRIGATÓRIA já toca sozinha. As 8 fogueiras estão espalhadas, então
   quem faz só o mínimo já cobre cerca de um terço do mapa — e isso não é iniciativa, é o
   caminho. Sem descontar esse piso, Autodireção estava pontuando o cumprimento do objetivo,
   exatamente o vício que o C-16 tinha em Estimulação. Calculado no boot a partir das
   posições reais, para nunca descolar do mapa. */
let MANDATORY_CELLS = 0;
function computeMandatoryFloor(){
  const seen = new Set();
  let cur = {x:SPAWN.x, z:SPAWN.z};
  const pend = zones.map(z => ({x:z.pos.x, z:z.pos.z}));
  const mark = (x,z) => { const c = coverageCell(x,z); if(c !== null) seen.add(c); };
  mark(cur.x, cur.z);
  while(pend.length){
    let bi = 0, bd = Infinity;
    pend.forEach((p,i) => { const d = Math.hypot(p.x-cur.x, p.z-cur.z); if(d < bd){ bd = d; bi = i; } });
    const nxt = pend.splice(bi,1)[0];
    const steps = Math.max(1, Math.round(bd));
    for(let i=0;i<=steps;i++){
      const t = i/steps;
      mark(cur.x + (nxt.x-cur.x)*t, cur.z + (nxt.z-cur.z)*t);
    }
    cur = nxt;
  }
  MANDATORY_CELLS = seen.size;
}

function computeValueProfile(){
  const pl = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const play = Math.max(30, state.playTime);
  const mins = play / 60;
  const norm = (v, max) => Math.max(0, Math.min(1, v / max));
  const fires = state.visited.filter(id => id !== 'espelho').length;

  /* Espalhamento pelo mapa, medido por entropia — visitar 10 células em cantos diferentes
     vale mais que 10 passos numa só. Descontado o piso da rota obrigatória: o que conta é
     onde ela foi ALÉM do caminho que o jogo já obrigava. */
  const cells = Object.values(state.cellVisits);
  const cellsSeen = cells.length;
  const total = cells.reduce((a,b) => a+b, 0) || 1;
  let entropy = 0;
  cells.forEach(c => { const pr = c/total; if(pr > 0) entropy -= pr * Math.log(pr); });
  const spread = norm(entropy / Math.log(COVERAGE_N*COVERAGE_N), 0.75);
  const beyondFloor = Math.max(0, cellsSeen - MANDATORY_CELLS) /
                      Math.max(1, (COVERAGE_N*COVERAGE_N) - MANDATORY_CELLS);
  /* 0,3 no espalhamento e 0,7 no que passou do piso. Com peso igual, quem fazia só o
     obrigatório levava metade da nota: as 8 fogueiras estão espalhadas de propósito, então
     o espalhamento sozinho mede o cumprimento do objetivo, não a iniciativa. */
  const coverage = spread * 0.3 + beyondFloor * 0.7;

  /* Denominador é quem ela ENCONTROU, não quantos existem. Dois aldeões nascem escondidos;
     com 4 fixo, quem ajudou os dois que achou aparecia como "2 de 4" — metade — quando na
     verdade ajudou todo mundo que teve chance de ajudar. A chance que não chegou não pode
     virar omissão dela. */
  const conhecidos = (typeof villagers !== 'undefined')
    ? villagers.filter(v => v.calledOut || v.rescued).length : 0;
  const villagersMet = Math.max(1, conhecidos);
  const lightLeft = state.villagersRescued - state.torchesReclaimed;
  /* C-13: this used to filter firesLit < 8, but a villager only frees himself once all 8
     are lit — so earlyRescues was an exact copy of villagersRescued and 0.2 of Benevolence
     was counted twice. Half the village lit is a real "still dark" threshold. */
  const earlyRescues = state.rescueTimes.filter(r => r.firesLit < 4).length;

  const dilemmaFor = who => state.dilemmaChoices.filter(c => c.chose === who).length;
  const dilemmasResolved = state.dilemmaChoices.length;

  /* Every value is a sum of named parts, so the report can always answer "why this number".
     A score you cannot explain is a score nobody should act on. */
  const V = {
    selfDirection: [
      {w: coverage * 0.4,                                        n:'Foi além do caminho obrigatório', d:`${cellsSeen} de ${COVERAGE_N*COVERAGE_N} pedaços do mapa, ${MANDATORY_CELLS} deles no trajeto das fogueiras`},
      {w: state.suggestionFollowed === false ? 0.4 : 0,           n:'Ignorou a sugestão do Lume',      d:state.suggestionFollowed === false ? 'foi para outro lugar' : 'não ignorou'},
      {w: norm(state.detourDistance / Math.max(1, state.distanceWalked), 0.4) * 0.1, n:'Andou fora das rotas úteis', d:`${Math.round(state.detourDistance)}m longe de objetivos`},
      /* O outro lado do mesmo eixo: achou os lugares sem voltar pedir direção. Só conta
         quando ela já acendeu bastante coisa — no começo ninguém sabe nada, e não perguntar
         com uma fogueira acesa é sorte, não autonomia. */
      {w: (fires >= 4 && state.lumeAsks === 0) ? 0.3 : 0,          n:'Achou tudo sem perguntar', d:fires >= 4 ? 'nenhuma volta ao Lume' : 'poucas fogueiras pra dizer'}
    ],
    stimulation: [
      {w: norm(state.darkCrossTime / Math.max(1, state.movingTime), 0.3) * 0.5, n:'Atravessou o miolo escuro', d:`${Math.round(state.darkCrossTime)}s no escuro em movimento`},
      {w: norm(state.shortcutsTaken, 5) * 0.3,                    n:'Pegou atalhos pelo escuro',  d:pl(state.shortcutsTaken, 'travessia', 'travessias')},
      {w: norm(state.maxRadius - 13, 8) * 0.2,                    n:'Foi além do anel dos lugares', d:`${Math.round(state.maxRadius)}m do centro`}
    ],
    hedonism: [
      {w: norm(state.playfulActs, 8),                             n:'Mexeu em coisas sem função', d:pl(state.playfulActs, 'vez', 'vezes')}
    ],
    achievement: [
      /* A Passarela é o único uso da Tocha que beneficia só a própria criança: encurta o
         caminho DELA e não dá nada a mais ninguém. Cada Tocha gasta aqui é uma que não foi
         pro Aldeão que estava com a fumaça subindo. */
      {w: state.passarelaLit ? 0.2 : 0,                           n:'Acendeu a passarela pra encurtar o próprio caminho', d:state.passarelaLit ? 'gastou uma tocha no atalho' : 'não acendeu'},
      {w: norm(fires / mins, 3.0) * 0.3,                          n:'Ritmo de fogueiras',        d:`${(fires/mins).toFixed(1)} por minuto`},
      {w: norm(state.crystalsMined / mins, 6) * 0.2,              n:'Ritmo de mineração',        d:`${(state.crystalsMined/mins).toFixed(1)} pedras por minuto`},
      {w: norm(state.torchesReclaimed, 3) * 0.1,                  n:'Reaveu fogo já doado',      d:pl(state.torchesReclaimed, 'tocha retomada', 'tochas retomadas')},
      /* Borda: she paid a tocha for her own name and took nobody's place. That is wanting
         a mark, not wanting someone else's — which is exactly the line between Realização
         and Poder, and the game could not draw it before the Borda existed. */
      {w: state.nameOnBorda ? 0.2 : 0,                             n:'Gravou o nome na borda da pedra', d:state.nameOnBorda ? 'sem apagar ninguém' : 'não gravou'}
    ],
    power: [
      {w: state.nameOnDestaque ? 0.6 : 0,                         n:'Tomou um lugar de destaque na pedra', d:state.nameOnDestaque ? 'apagou um nome tendo a borda livre' : 'não tomou'},
      {w: norm(Math.max(0, state.namesErased - 1), 2) * 0.4,      n:'Apagou mais de um nome',     d:pl(state.namesErased, 'nome apagado', 'nomes apagados')}
    ],
    security: [
      {w: norm(state.litPathTime / Math.max(1, state.movingTime), 0.45) * 0.6, n:'Andou pelo anel iluminado', d:`${Math.round(state.litPathTime)}s na luz das fogueiras`},
      /* C-03: timeInDark only accumulates while moving, so it has to be divided by moving
         time. Divided by total play time, standing still in the dark RAISED Segurança. */
      {w: norm(1 - (state.timeInDark / Math.max(1, state.movingTime)), 0.9) * 0.4, n:'Evitou ficar no escuro', d:`${Math.round(100 - (state.timeInDark/Math.max(1,state.movingTime))*100)}% do tempo andando na luz`}
    ],
    conformity: [
      {w: state.suggestionFollowed === true ? 0.4 : 0,            n:'Seguiu a sugestão do Lume', d:state.suggestionFollowed === true ? 'acendeu primeiro onde ele indicou' : 'não seguiu'},
      /* Sem bússola na HUD, pedir direção custa a caminhada até o centro. Quantas vezes ela
         preferiu perguntar a achar sozinha é gradiente ao longo da partida inteira, no lugar
         do bit único que Conformidade era. */
      {w: norm(state.lumeAsks, 4) * 0.4,                          n:'Voltou perguntar o caminho ao Lume', d:pl(state.lumeAsks, 'vez', 'vezes')},
      {w: norm(state.helpTalks - state.lumeAsks, 2) * 0.2,        n:'Pediu instruções de como jogar', d:pl(Math.max(0, state.helpTalks - state.lumeAsks), 'pergunta', 'perguntas')}
    ],
    tradition: [
      {w: norm(state.loreTalks, 3),                               n:'Quis saber a história da vila', d:pl(state.loreTalks, 'pergunta de lore', 'perguntas de lore')}
    ],
    benevolence: [
      {w: norm(state.villagersRescued / villagersMet, 0.75) * 0.4, n:'Acendeu tocha para aldeões', d:`${state.villagersRescued} de ${conhecidos}`},
      {w: norm(earlyRescues / villagersMet, 0.5) * 0.15,           n:'Ajudou com a vila ainda escura', d:`${earlyRescues} de ${conhecidos} antes de metade das fogueiras`},
      {w: norm(Math.max(0, lightLeft) / villagersMet, 0.5) * 0.2,  n:'Deixou a luz na Praça',      d:pl(Math.max(0,lightLeft), 'tocha não retomada', 'tochas não retomadas')},
      /* The Dilema itself: with one tocha and both a person and a lamp in front of her,
         which one got the fire. This is the only place in the game where the two halves of
         Autotranscendência are forced apart. */
      {w: dilemmasResolved ? (dilemmaFor('aldeao') / dilemmasResolved) * 0.2 : 0, n:'No dilema, escolheu a pessoa', d:`${dilemmaFor('aldeao')} de ${pl(dilemmasResolved,'dilema','dilemas')}`},
      /* Desviar da própria rota por causa de alguém — cortou pela metade a distância até
         uma fumaça depois de avistá-la. Mede intenção no meio do movimento, não proximidade. */
      {w: state.smokeSpotted ? (state.smokeFollowed / state.smokeSpotted) * 0.25 : 0, n:'Foi atrás de quem estava chamando', d:`${state.smokeFollowed} de ${pl(state.smokeSpotted,'sinal avistado','sinais avistados')}`}
    ],
    universalism: [
      {w: norm(state.lampsLit, 4) * 0.75,                          n:'Acendeu lampiões que não dão nada', d:`${state.lampsLit} de 6`},
      {w: dilemmasResolved ? (dilemmaFor('lampiao') / dilemmasResolved) * 0.25 : 0, n:'No dilema, escolheu o lugar', d:`${dilemmaFor('lampiao')} de ${pl(dilemmasResolved,'dilema','dilemas')}`}
    ]
  };

  const values = {}, breakdown = {};
  Object.entries(V).forEach(([k, parts]) => {
    values[k] = Math.max(0, Math.min(1, parts.reduce((a,p) => a + p.w, 0)));
    breakdown[k] = parts.filter(p => p.w > 0.001)
                        .sort((a,b) => b.w - a.w)
                        .map(p => ({name:p.n, detail:p.d, points:Math.round(p.w*100)}));
  });

  /* `observed` means the chance existed and reached her — NOT that she scored. The old
     version used breakdown.length, which made one accidental bell tap mathematically worse
     than never seeing a bell: the tap dragged the pole down, the silence left the average.
     Now zero with an opportunity is a real zero, and zero without one is not a number. */
  const observed = {};
  Object.keys(V).forEach(k => { observed[k] = !!state.opportunities[k] || breakdown[k].length > 0; });

  /* How much a value can be spoken about. Four of the ten hang on a single probe, and a
     single probe cannot carry a number — "Poder 100" off one act on one object is a label,
     not a measurement. Those print as described behaviour instead. */
  const support = {};
  Object.entries(V).forEach(([k, parts]) => {
    const scoring = parts.filter(p => p.w > 0.001).length;
    if(!observed[k])      support[k] = 'none';        // never had the chance — no number
    else if(scoring === 0) support[k] = 'zero';        // had the chance and did not — a real zero
    else if(scoring === 1) support[k] = 'indicative';  // one probe cannot carry a number
    else                   support[k] = 'scored';
  });

  // average only over the values that actually had a chance to show up
  const poleMean = keys => {
    const seen = keys.filter(k => observed[k]);
    if(!seen.length) return null;
    return seen.reduce((a,k) => a + values[k], 0) / seen.length;
  };
  const openness      = poleMean(['selfDirection','stimulation','hedonism']);
  const conservation  = poleMean(['security','conformity','tradition']);
  const transcendence = poleMean(['universalism','benevolence']);
  const enhancement   = poleMean(['achievement','power']);

  // an axis needs both poles observed to mean anything at all
  const axis = (a,b) => (a === null || b === null) ? null : a - b;
  const axes = {
    opennessVsConservation: axis(openness, conservation),
    transcendenceVsEnhancement: axis(transcendence, enhancement)
  };

  const talks = state.loreTalks + state.helpTalks;
  const valueChoices = state.lampsLit + state.villagersRescued + state.namesErased + (state.nameOnBorda?1:0) + talks;
  const evidence = {
    playMinutes: +(mins).toFixed(1),
    firesLit: fires,
    conformityProbe: state.suggestionFollowed !== null,
    valueChoicesMade: valueChoices,
    // resolving one implies having seen it — the pair proximity check can miss a frame
    dilemmasSeen: Math.max(state.dilemmaSeen, dilemmasResolved),
    dilemmasResolved,
    enough: mins >= 5 && fires >= 4 && valueChoices >= 3
  };

  return {values, breakdown, observed, support, axes, evidence};
}

/* ===================== NÃO HÁ ARMAZENAMENTO LOCAL =====================

   Havia aqui `chaveDoAluno()`, `lerSessaoDoAluno()`, `alunosComSessao()`,
   `apagarSessaoDoAluno()`, `marcarEnvioNoStorage()` e `saveLog()`: quarenta chaves de
   localStorage, uma por slot, porque trinta crianças dividiam a mesma máquina e a partida
   tinha que sobreviver até o professor exportar o `.json` no pendrive.

   Nada disso existe na plataforma. Cada criança entra na conta dela, a partida é aberta na
   api quando o jogo começa e fechada na api quando termina — o navegador não guarda nada, e
   por isso não há como uma criança ler ou apagar a partida de outra a partir do DevTools.

   O que o `saveLog()` calculava para guardar (o `computeValueProfile()` logo acima) continua
   servindo à Camada 1; o retrato de valores que a api publica é RECALCULADO lá, a partir das
   medidas brutas, e nunca aceito do cliente. Ver `mapeamento.ts` da api.

   A troca tem um custo, e ele é aceito: fechar a aba no meio perde a partida. Era verdade no
   jogo de origem também — não havia retomada, e uma partida é uma aula. */
