/* Vila do Lume — HUD, conversa com o Lume e as DMs

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ============================ DIALOGUE / UI ============================ */
function updateHud(){
  const done = state.visited.filter(id => id !== 'espelho').length;
  document.getElementById('scoreStars').textContent = done;
  for(let i=0;i<8;i++){
    const stone = document.getElementById('wedge'+i);
    if(stone) stone.classList.toggle('filled', i < done);
  }
  document.getElementById('mirrorHud').classList.toggle('complete', done >= 8);
}

function nameClass(who){ return who === 'bit' ? 'bit' : (who === 'you' ? 'you' : 'them'); }
function mcLine(who, name, text){
  return `<div class="mc-line"><span class="mc-name ${nameClass(who)}">&lt;${name}&gt;</span>${text}</div>`;
}

function dmInitial(name){ return name.replace(/[^A-Za-z]/g,'').slice(0,2).toUpperCase() || '?'; }

/* DMs never pause the game — the player keeps walking, looking around, jumping while
   this sits in the corner. No pointer unlock, so replies come via number keys (1/2/3),
   not clicks. Ignored long enough, it dismisses itself — that's a real answer too. */
let activeDM = null;
let dmTimeoutId = null;

function openDM(zone){
  activeDM = zone;
  state.dmsFired++;
  /* Abre o registro deste cartão. Fecha em `pickDM` ou em `dismissDM`.

     SÓ O QUE ELA FEZ. `nivel`, `legitima` e `aceitou` saíram daqui: são gabarito, e o
     gabarito vive na api. Ela recebe o `id` de volta e corrige contra o catálogo — e
     confere que o cartão pertence à bolha desta partida, o que substitui o campo `bolha`
     que o payload mandava (e que o servidor tinha de acreditar). */
  state.dmCartoes.push({
    id: zone.id,
    emMs: Math.round(performance.now() - (sessionStartedAt || performance.now())),
    /* `viuOpcoes` separa "deixei passar" de "nem vi": se o cartão expirou antes de as
       opções aparecerem, ela nunca teve chance real de responder. As duas caíam em
       `ignoradas` e são crianças diferentes. */
    viuOpcoes: false, escolha: null, decisaoMs: null
  });
  document.getElementById('dmCard').innerHTML = `
    <div class="dm-head">
      <div class="dm-avatar">${dmInitial(zone.beats[0].name)}</div>
      <div class="dm-head-text">
        <div class="dm-name">${zone.beats[0].name}</div>
        <div class="dm-sub">mensagem direta · agora</div>
      </div>
    </div>
    <div class="dm-body" id="dmBody"></div>
  `;
  document.getElementById('dmOverlay').classList.add('open');
  playDMPing();
  setTimeout(() => playDMBeats(zone, 0), 450);
}

function playDMBeats(zone, i){
  const body = document.getElementById('dmBody');
  if(!body) return;
  if(i >= zone.beats.length){ showDMOptions(zone); return; }
  const typing = document.createElement('div');
  typing.className = 'dm-bubble-row';
  typing.innerHTML = `<div class="dm-typing-dots"><span></span><span></span><span></span></div>`;
  body.appendChild(typing);
  body.scrollTop = body.scrollHeight;
  setTimeout(() => {
    typing.outerHTML = `<div class="dm-bubble-row"><div class="dm-bubble">${zone.beats[i].text}</div></div>`;
    body.scrollTop = body.scrollHeight;
    playDMPing();
    setTimeout(() => playDMBeats(zone, i+1), 700);
  }, 550);
}

const DM_KEYS = ['Digit1','Digit2','Digit3'];

function showDMOptions(zone){
  const body = document.getElementById('dmBody');
  optionsShownAt = performance.now();
  /* A partir daqui ela teve chance real de responder. */
  const regAtual = state.dmCartoes[state.dmCartoes.length - 1];
  if(regAtual) regAtual.viuOpcoes = true;
  const hint = document.createElement('div');
  hint.className = 'dm-hint';
  hint.textContent = 'Aperte 1, 2 ou 3 pra responder';
  document.getElementById('dmCard').appendChild(hint);

  const wrap = document.createElement('div');
  wrap.className = 'dm-replies';
  wrap.id = 'dmReplies';
  zone.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'dm-reply-btn';
    btn.innerHTML = `<span class="dm-key">${i+1}</span>${opt.text}`;
    btn.onclick = () => pickDM(zone, opt);
    wrap.appendChild(btn);
  });
  document.getElementById('dmCard').appendChild(wrap);

  /* Ignoring is a real answer, so it has to be able to happen. Without this the card sat
     open forever and blocked the whole queue. It counts as neither safe nor risky — it
     counts as not answered, and drops out of the safety denominator. */
  dmTimeoutId = setTimeout(() => { if(activeDM === zone) dismissDM(zone); }, DM_TIMEOUT_MS);
}

const DM_TIMEOUT_MS = 13000;
function dismissDM(zone){
  state.dmsIgnored++;
  const reg = state.dmCartoes[state.dmCartoes.length - 1];
  if(reg && reg.escolha === null) reg.decisaoMs = null;
  state.log.push({tipo:'dm_ignorada', dados:{cartao:zone.id}});
  closeDM();
  scheduleNextAmbientDM(6000 + Math.random()*8000);
}


function pickDM(zone, opt){
  if(dmTimeoutId){ clearTimeout(dmTimeoutId); dmTimeoutId = null; }
  const wrap = document.getElementById('dmReplies');
  if(wrap){ Array.from(wrap.children).forEach(b => b.disabled = true); wrap.remove(); }

  /* O JOGO NÃO CLASSIFICA MAIS. Havia aqui `arriscada = !zone.legitima && !!opt.aceita`,
     que alimentava `riskyChoices`/`safeChoices` e virava `seguras`/`risco` no payload.
     Sem gabarito no bundle isso deixou de ser possível — e não faz falta: nada disto
     movia um pixel na tela ("No flash, no scare label" logo abaixo), então a criança não
     percebe diferença nenhuma. Quem separa "entregou a um golpe" de "recusou ajuda
     verdadeira" é a api, que sabe qual era qual. */
  const decisionMs = optionsShownAt ? Math.round(performance.now() - optionsShownAt) : null;
  /* Fecha o registro do cartão. `decisaoMs` é o campo mais informativo do conjunto: cair
     em dois segundos e cair depois de dez são duas crianças diferentes — a primeira não
     avaliou, a segunda avaliou e foi convencida. */
  const escolha = zone.options.indexOf(opt) + 1;
  const reg = state.dmCartoes[state.dmCartoes.length - 1];
  if(reg){
    reg.escolha = escolha;
    reg.decisaoMs = decisionMs;
  }
  state.log.push({tipo:'dm_respondida', dados:{cartao:zone.id, escolha:escolha, decisaoMs:decisionMs}});
  /* Canal analítico. `escolha` é o índice, nunca "caiu"/"recusou": a classificação é da
     api, e repeti-la aqui recriaria o gabarito no cliente pela porta dos fundos. */
  if(window.VILA) window.VILA.registrar('interacted', 'mensagem', {
    cartao: zone.id, escolha: escolha, decisaoMs: decisionMs
  });
  updateHud();

  const body = document.getElementById('dmBody');
  body.insertAdjacentHTML('beforeend', `<div class="dm-bubble-row me"><div class="dm-bubble">${opt.text}</div></div>`);
  body.scrollTop = body.scrollHeight;
  playChoiceConfirm();

  // The sender answers in character — never a verdict on the child's choice. No flash,
  // no scare label: the moment the game grades you is the moment it stops measuring you.
  if(opt.reply){
    setTimeout(() => {
      const b = document.getElementById('dmBody');
      if(!b) return;
      const typing = document.createElement('div');
      typing.className = 'dm-bubble-row';
      typing.innerHTML = `<div class="dm-typing-dots"><span></span><span></span><span></span></div>`;
      b.appendChild(typing);
      b.scrollTop = b.scrollHeight;
      setTimeout(() => {
        typing.outerHTML = `<div class="dm-bubble-row"><div class="dm-bubble">${opt.reply}</div></div>`;
        b.scrollTop = b.scrollHeight;
        playDMPing();
        setTimeout(closeDM, 1500);
      }, 600);
    }, 500);
  } else {
    setTimeout(closeDM, 1100);
  }
}

/* The choice IS the action: walking to a physical point and pressing E there both picks
   the value signal and collects the flame in one motion. No modal, no menu, no gap
   between what the button says and what the child actually did. */
function claimFragment(zone){
  addScore('flame');
  if(zone.fragMesh) zone.fragMesh.visible = false;
  /* `zona` é o ID, nunca o `label`: o rótulo é texto de tela ("Casa das Memórias") e o
     contrato só aceita palavras do vocabulário fechado. As contagens vão como números. */
  state.log.push({
    tipo: 'chama_pega',
    dados: { zona: zone.id, fogueiras: state.torchesPlaced, pedras: state.crystalsMined }
  });
  playChoiceConfirm();
  finishZone(zone);
}


function triggerSuccessBloom(){
  const flash = document.getElementById('successFlash');
  flash.classList.remove('hit');
  void flash.offsetWidth;
  flash.classList.add('hit');
  blip(523,0.5,'sine',0.09,0);
  blip(659,0.5,'sine',0.09,0.12);
  blip(784,0.6,'sine',0.1,0.24);
  blip(1047,0.9,'sine',0.11,0.36);
}

const LUME_GREETINGS = ["E aí! Tá indo pra onde agora?","Oi! Que bom te ver aqui.","Pode voltar quando quiser. Eu fico por aqui mesmo."];

/* Portuguese needs the article to agree with each place, and the old code guessed it from
   the first letter — which produced "o Praça" and "o Pedra dos Nomes". Each zone now
   carries its own article and these helpers use it. */
function zoneWithArticle(z, upper){
  const t = (z.art === 'a' ? 'a ' : 'o ') + z.label;
  return upper ? t.toUpperCase() : t;
}
function zoneList(list){
  const names = list.map(z => zoneWithArticle(z));
  if(names.length === 1) return names[0];
  return names.slice(0,-1).join(', ') + ' e ' + names[names.length-1];
}

function openBitTalk(){
  playing = false;
  controls.unlock();
  document.getElementById('crosshair').style.display = 'none';
  document.getElementById('interactPrompt').style.display = 'none';

  state.bitTalks++;
  if(!state.bitTalked){
    state.bitTalked = true;
    state.log.push({tipo:'lume_primeira_conversa'});
  }

  const done = state.visited.filter(id => id !== 'espelho').length;
  const left = zones.filter(z => !state.visited.includes(z.id));
  let opening;
  if(done === 0) opening = 'Oi! A vila inteira tá no escuro. Procura uma pedra com pontinhos laranja, segura o F pra quebrar ela e usa as fagulhas pra acender uma fogueira.';
  else if(!left.length) opening = 'As 8 Chamas Sagradas estão com você. Vem aqui no centro comigo pra reacender o Fogo Sagrado.';
  else if(left.length === 1) opening = `Você acendeu ${done} de 8 fogueiras. Falta uma: ${zoneWithArticle(left[0])}.`;
  else if(left.length <= 3) opening = `Você acendeu ${done} de 8 fogueiras. Ainda estão apagadas: ${zoneList(left)}.`;
  else opening = `Você acendeu ${done} de 8 fogueiras. Ainda estão apagadas ${zoneList(left.slice(0,2))} e mais ${left.length-2} lugares.`;

  document.getElementById('bitPanel').innerHTML = `
    <div class="scene-tag">🔥 Lume</div>
    <div class="mc-log" id="bitLog">${mcLine('bit','Lume', opening)}</div>
  `;
  const log = document.getElementById('bitLog');
  const wrap = document.createElement('div');
  wrap.className = 'quickreplies';

  // the player's own line lands in the log first, same as any chat — you see what you said
  function answer(question, text){
    wrap.remove();
    log.insertAdjacentHTML('beforeend', mcLine('you','Você', question));
    log.scrollTop = log.scrollHeight;
    const typing = document.createElement('div');
    typing.className = 'mc-line mc-typing';
    typing.textContent = 'Lume';
    log.appendChild(typing);
    setTimeout(() => {
      typing.outerHTML = mcLine('bit','Lume', text);
      log.scrollTop = log.scrollHeight;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'VOLTAR PRA VILA →';
      btn.onclick = () => closeBitTalk(false);
      log.insertAdjacentElement('afterend', btn);
    }, 450);
  }

  /* Two kinds of visit, counted apart: coming because you're stuck is not sociability,
     and pulling a story thread nobody asked you to pull is what Tradition looks like. */
  /* O Lume aponta um lugar por vez, em direção cardeal grossa e sem distância — direção,
     não GPS. Cada ida até ele custa caminhada de verdade (de r=30 são ~13s ida e volta),
     e é isso que faz perguntar ser uma escolha em vez de um reflexo. */
  const topics = [
    /* `a` é FUNÇÃO nas duas primeiras, e isso não é estilo: elas incrementam
       `state.lumeAsks`, e como string o texto era montado ao ABRIR o painel — abrir o
       Lume uma vez e sair sem clicar em nada já contava duas perguntas. Conformidade
       subia e Autodireção caía (que exige `perguntasCaminho === 0`) por um ato que não
       foi pergunta nenhuma, invertendo o eixo Abertura↔Conservação da criança. */
    {q:'Onde eu procuro agora?', kind:'ask',
     a: () => lumeDirectionLine()},
    {q:'Tem alguém chamando por aí?', kind:'ask',
     a: () => lumeVillagerLine()},
    {q:'Como pego fagulha?', kind:'help', a:'O fogo se escondeu dentro das pedras pretas, aquelas com pontinhos laranja. Olha pra uma delas e segura o F até rachar. Cada pedra solta 1 fagulha.'},
    {q:'E as fogueiras?', kind:'help', a:'Cada lugar da vila tem uma fogueira apagada. Chega perto com uma fagulha e aperta T. Ela acende pra sempre, e a Chama Sagrada daquele lugar sobe do fogo. Aí você aperta E e pega a Chama.'},
    {q:'De onde veio o Fogo Sagrado?', kind:'lore', a:'Dizem que a primeira aldeã chegou aqui trazendo uma fagulha na mão. Ela falou: enquanto isso queimar, ninguém dorme no escuro. Por muitos anos ninguém deixou apagar. Até ontem.'},
    {q:'Quem é você, Lume?', kind:'lore', a:'Eu nasci daquela primeira fagulha. Não sou aldeão e não sou bem fogo. Eu sou o que aparece quando alguém cuida de uma chama por muito tempo.'},
    {q:'Só dar um oi', kind:'greet', a:LUME_GREETINGS[Math.floor(Math.random()*LUME_GREETINGS.length)]}
  ];

  topics.forEach(t => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = t.q;
    b.onclick = () => {
      // 'greet' is neither lore nor help: saying hi is not wanting the village's history
      if(t.kind === 'lore') state.loreTalks++;
      else if(t.kind === 'help' || t.kind === 'ask') state.helpTalks++;
      markOpportunity('tradition');
      /* Só aqui o texto é gerado — e só aqui os contadores mexem. */
      answer(t.q, typeof t.a === 'function' ? t.a() : t.a);
    };
    wrap.appendChild(b);
  });

  log.insertAdjacentElement('afterend', wrap);
  document.getElementById('bitOverlay').classList.add('open');
}

/* Direção cardeal grossa, sem distância e sem nome de rua. Se ela quiser precisão, anda. */
function compassWord(x, z){
  const a = (Math.atan2(z, x) * 180 / Math.PI + 360) % 360;
  const words = ['pro lado do nascente','pro fundo da vila','pro lado do poente','pra frente da vila'];
  return words[Math.round(a / 90) % 4];
}

function lumeDirectionLine(){
  const left = zones.filter(z => !(z.brazier && z.brazier.lit));
  if(!left.length) return 'Todas as oito estão acesas. Não falta lugar nenhum — traz as Chamas aqui pro meio.';
  state.lumeAsks++;
  // aponta a mais longe ainda apagada: é a que ela tem menos chance de achar por acaso
  let far = left[0], best = -1;
  left.forEach(z => { const r = Math.hypot(z.pos.x, z.pos.z); if(r > best){ best = r; far = z; } });
  const near = left.reduce((a,z) => Math.hypot(z.pos.x,z.pos.z) < Math.hypot(a.pos.x,a.pos.z) ? z : a, left[0]);
  const pick = state.lumeAsks % 2 === 1 ? near : far;
  return 'Tem fogueira apagada ' + compassWord(pick.pos.x, pick.pos.z) +
         '. Procura um mastro alto por lá — os de longe são os mais altos, dá pra ver de longe mesmo no escuro.';
}

function lumeVillagerLine(){
  const lost = villagers.filter(v => !v.rescued && !v.walkingHome);
  if(!lost.length) return 'Agora não. Todo mundo que estava perdido já está andando com luz.';
  state.lumeAsks++;
  const v = lost[0];
  return 'Tem sim. Sobe uma fumacinha ' + compassWord(v.pos.x, v.pos.z) +
         '. Olha pro alto que você acha — a fumaça passa por cima de tudo.';
}

function closeBitTalk(){
  document.getElementById('bitOverlay').classList.remove('open');
  document.getElementById('crosshair').style.display = 'block';
  playing = true;
  controls.lock();
}

function finishZone(zone){
  if(!state.visited.includes(zone.id)){
    // Conformity vs Self-Direction: Lume names one place at the start; the first fire the
    // child actually lights is the answer. Only the first one counts — after that she is
    // following her own route by definition.
    state.visited.push(zone.id);
    state.visitOrder.push({id:zone.id, at:Math.round(state.playTime)});
  }
  updateHud();
  updateWorldGlowTarget();
  playAmbientChime();
  showFragmentToast();
  document.getElementById('crosshair').style.display = 'block';
  playing = true;
  controls.lock();
}

function closeDM(){
  // DM ambushes are pure background instrumentation — no fragment, no toast, no world-glow —
  // and they never paused the game, so there's nothing to resume here either.
  /* Um cartão RESOLVIDO — respondido ou expirado — é o que destrava `aposCartao:N`.
     Este é o único ponto de saída de um cartão, então contar aqui é contar o que
     aconteceu, em vez de confiar em quem o abriu.

     O app de origem tinha `dmGolpeResolvido = true` num `setTimeout` de 1s DENTRO DO
     AGENDADOR, logo depois de abrir — e o comentário dele dizia "só depois que o golpe foi
     respondido ou expirou". Código e comentário discordavam; na prática coincidiam, porque
     o agendador só reavaliava 15s depois e o cartão expira em 13s. Implementado aqui, a
     intenção passa a ser a que vale, e o contador continua certo se um dia `openDM` for
     chamado de outro lugar. */
  if(activeDM) dmResolvidos += 1;
  document.getElementById('dmOverlay').classList.remove('open');
  activeDM = null;
  if(dmTimeoutId){ clearTimeout(dmTimeoutId); dmTimeoutId = null; }
}
