/* Vila do Lume — cinemática final, tela da criança e painel do responsável

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ===================== THE RESTORATION ======================
   The shards rise out of the village, gather high in the sky, lock into a disc, and the
   remade Mirror detonates in light over the whole valley. The child earned a spectacle. */
let cinematic = null;
const SKY_Y = 17;

function startRestoration(){
  playing = false;
  miningHeld = false;
  dmQueue = [];
  if(activeDM) closeDM();
  hideMineBar();
  document.getElementById('crosshair').style.display = 'none';
  document.getElementById('interactPrompt').style.display = 'none';
  document.getElementById('hud').style.opacity = '0';
  document.getElementById('tally').style.opacity = '0';

  /* Staged in front of the player's current view, at eye level. They keep full control of
     the camera and can look wherever they want — the show simply happens where they look. */
  const obj = controls.getObject();
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  const stage = new THREE.Vector3(
    obj.position.x + fwd.x * 8,
    obj.position.y + 0.2,
    obj.position.z + fwd.z * 8
  );
  const sky = new THREE.Vector3(stage.x, SKY_Y, stage.z);

  const shards = [];
  for(let i=0;i<8;i++){
    const a = (i/8) * Math.PI * 2;
    const m = mkMesh(new THREE.ConeGeometry(0.3,0.75,6), 0xFFC24A, false, {emissive:0x8a4a00});
    const src = zones[i] ? zones[i].pos : {x:Math.sin(a)*12, z:Math.cos(a)*12};
    m.position.set(src.x, 1.6, src.z);
    scene.add(m);
    shards.push({mesh:m, angle:a, from:m.position.clone(), delay:i*0.1});
  }

  const disc = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 3.4, 10),
    new THREE.MeshBasicMaterial({color:0xFFD27A, transparent:true, opacity:0, depthWrite:false, fog:false})
  );
  disc.position.copy(stage);
  scene.add(disc);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 2.3, 40),
    new THREE.MeshBasicMaterial({color:0xFFC24A, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false, fog:false})
  );
  halo.position.copy(stage);
  scene.add(halo);

  const stageLight = new THREE.PointLight(0xFFB25C, 0, 95, 2);
  stageLight.position.copy(stage);
  scene.add(stageLight);

  cinematic = {t:0, shards, disc, halo, stageLight, stage, sky, burst:false, done:false};
  blip(392,0.6,'sine',0.06); blip(523,0.7,'sine',0.06,0.25);
}

const T_RISE = 1.9;    // shards leave the village and climb
const T_FALL = 3.7;    // they spiral down to eye level
const T_CLOSE = 4.5;   // the disc snaps shut

function updateCinematic(dt){
  if(!cinematic) return;
  // A crash mid-cutscene must never strand the player in a frozen world: bail out to the
  // results screen instead of leaving them locked in place with nothing responding.
  try{
    runCinematic(dt);
  }catch(err){
    console.error('cinematic failed', err);
    const c = cinematic;
    if(c){
      c.shards.forEach(sh => scene.remove(sh.mesh));
      scene.remove(c.disc); scene.remove(c.halo); scene.remove(c.stageLight);
    }
    cinematic = null;
    document.getElementById('whiteOut').classList.remove('hit');
    document.getElementById('hud').style.opacity = '1';
    document.getElementById('tally').style.opacity = '1';
    openResults();
  }
}

function runCinematic(dt){
  const c = cinematic;
  c.t += dt;

  // The camera is never taken from the player — forced rotation is nauseating and reads as
  // losing control. The spectacle comes to where they are already looking instead.

  c.shards.forEach(sh => {
    const rise = Math.max(0, Math.min(1, (c.t - sh.delay) / T_RISE));
    const eRise = 1 - Math.pow(1 - rise, 3);
    const fall = Math.max(0, Math.min(1, (c.t - T_RISE) / (T_FALL - T_RISE)));
    const eFall = fall * fall * (3 - 2 * fall);
    const close = Math.max(0, Math.min(1, (c.t - T_FALL) / (T_CLOSE - T_FALL)));
    const eClose = close * close;

    const spin = c.t * (2.4 - eClose * 1.8);
    const ang = sh.angle + spin;
    const radius = 6.5 * (1 - eClose) + 1.05 * eClose;

    // height sweeps: village floor -> sky -> down to the player's eye line
    const y = c.sky.y + (c.stage.y - c.sky.y) * eFall + Math.cos(ang) * radius * 0.35 * (1 - eClose);
    const orbit = new THREE.Vector3(
      c.stage.x + Math.sin(ang) * radius,
      y,
      c.stage.z + Math.cos(ang) * radius * 0.4
    );
    sh.mesh.position.lerpVectors(sh.from, orbit, eRise);

    sh.mesh.rotation.z = ang + Math.PI/2;
    sh.mesh.rotation.x = (1 - eClose) * 1.0;
    sh.mesh.scale.set(1, 1 + eClose * 0.6, 1);
  });

  if(c.t > T_CLOSE && !c.burst){
    c.burst = true;
    const w = document.getElementById('whiteOut');
    w.classList.remove('hit'); void w.offsetWidth; w.classList.add('hit');
    triggerSuccessBloom();
    blip(659,1.0,'sine',0.11); blip(880,1.1,'sine',0.11,0.16); blip(1319,1.5,'sine',0.12,0.34);
    worldGlowTarget = 1.4;
    MIRROR.restored = true;
    const mirrorGroup = zoneMeshes['espelho'];
    if(mirrorGroup) mirrorGroup.visible = true;
    if(MIRROR.baseMesh){
      MIRROR.baseMesh.visible = true;
      MIRROR.baseMesh.material.color.set(0xFFB04A);
      MIRROR.baseMesh.material.emissive = new THREE.Color(0x9c3c00);
    }
    if(MIRROR.pyre) MIRROR.pyre.children.forEach(l => l.material.color.set(0x6a3a18));
    if(!MIRROR.fireLight){
      MIRROR.fireLight = new THREE.PointLight(0xFFB25C, 4, 40, 2);
      MIRROR.fireLight.position.set(MIRROR.pos.x, 2.4, MIRROR.pos.z);
      scene.add(MIRROR.fireLight);
    }
    MIRROR.fireLight.intensity = 4;
  }

  if(c.burst){
    const b = Math.min(1, (c.t - T_CLOSE) / 1.6);
    c.disc.material.opacity = Math.min(1, b * 2.2);
    c.disc.scale.setScalar(1 + b * 0.2);
    c.halo.material.opacity = Math.sin(b * Math.PI) * 0.9;
    c.halo.scale.setScalar(1 + b * 8);
    c.stageLight.intensity = Math.sin(b * Math.PI) * 9;
  }

  if(c.t > T_CLOSE + 2.3 && !c.done){
    c.done = true;
    c.shards.forEach(sh => scene.remove(sh.mesh));
    scene.remove(c.disc); scene.remove(c.halo); scene.remove(c.stageLight);
    document.getElementById('whiteOut').classList.remove('hit');
    cinematic = null;
    document.getElementById('hud').style.opacity = '1';
    document.getElementById('tally').style.opacity = '1';
    openResults();
  }
}

function openResults(){
  try{ buildResults(); }
  catch(err){
    console.error('results failed', err);
    document.getElementById('resultsPanel').innerHTML =
      '<div class="scene-tag">🌟 VILA SALVA!</div>' +
      '<div class="card"><div class="from">🔥 Lume</div><p style="margin:0;">CONSEGUIMOS! O Fogo Sagrado voltou a queimar e a vila está acesa de novo.</p></div>' +
      '<button class="btn" onclick="restart()">🔁 JOGAR DE NOVO</button>';
    document.getElementById('resultsOverlay').classList.add('open');
    playing = false;
    controls.unlock();
  }
}

function buildResults(){
  playing = false;
  controls.unlock();
  document.getElementById('crosshair').style.display = 'none';
  document.getElementById('interactPrompt').style.display = 'none';
  if(!state.visited.includes('espelho')) state.visited.push('espelho');

  /* Entrega a partida à plataforma e SEGUE. Não espera resposta, não bloqueia nada, e não
     mostra nada à criança se falhar: a tela final dela monta logo abaixo de qualquer jeito.
     Trocar o fim do jogo por um aviso de erro de rede seria pôr na frente dela uma
     preocupação que é do adulto. Ver o rodapé de `17-export.js`. */
  if(typeof entregarPartida === 'function') entregarPartida();

  /* Camada 1 ends here, and Schwartz is not part of it. The bars used to be topValues —
     the value scores themselves — with a PORTRAITS "type" stamped on top of them. Shown
     to her, that tells her she was being assessed, and the second playthrough becomes a
     performance. Same bars, same payoff, different axis: what she DID, never what she IS.
     Os números vivem na aplicação de acompanhamento, fora do jogo. */
  const durationSec = sessionStartedAt ? Math.round((performance.now()-sessionStartedAt)/1000) : 0;
  const durationStr = Math.floor(durationSec/60) + 'm ' + (durationSec%60) + 's';
  const who = (typeof playerLabel === 'function') ? playerLabel() : null;

  const fires = state.visited.filter(id => id !== 'espelho').length;
  /* Sem o antigo fator 1.6, que fazia "100% explorado" aparecer com 63% do mapa andado.
     A criança pode ver o número real: ele é o feito dela, não uma nota. */
  const cells = Object.keys(state.cellVisits).length;
  const explored = Math.round(cells / (COVERAGE_N*COVERAGE_N) * 100);

  /* A Selo is the deed, not the character. Everyone who finishes gets the same one —
     it marks that the village is lit, and says nothing about the person who lit it. */
  const deeds = [
    {icon:'🔥', label:'Fogueiras acesas', n:fires,               max:8,  color:'var(--gold)'},
    {icon:'⛏️', label:'Pedras quebradas', n:state.crystalsMined, max:16, color:'var(--cyan)'},
    {icon:'🧑', label:'Aldeões ajudados',  n:state.villagersRescued, max:4, color:'var(--emerald)'},
    {icon:'💡', label:'Lampiões acesos',   n:state.lampsLit,      max:6,  color:'var(--emerald)'},
    {icon:'🗺️', label:'Vila explorada',    n:explored,            max:100, color:'var(--cyan)', unit:'%'}
  ];
  /* Todas as cinco barras aparecem, inclusive as que ficaram em zero.
     Durante o jogo o contador da HUD esconde o que ainda não foi feito, de propósito: ali
     um número com denominador vira lista de tarefas e empurra a criança a completar. Aqui
     a partida ACABOU — não há mais o que completar, e a barra vazia é parte do retrato do
     que ela escolheu fazer. Esconder faria a tela mentir por omissão. */

  document.getElementById('resultsPanel').innerHTML = `
    <div class="scene-tag">🌟 VILA SALVA!</div>
    <div class="card"><div class="from">🔥 Lume</div><p style="margin:0;">CONSEGUIMOS${who ? ', ' + who : ''}! As 8 Chamas Sagradas se juntaram e o Fogo Sagrado voltou a queimar. Olha a vila inteira acesa de novo. Valeu por ter vindo.</p></div>
    <div class="result-card">
      <div class="type-emoji">🔥</div>
      <p class="type-name">ACENDEU AS 8 FOGUEIRAS DA VILA DO LUME</p>
      <p class="type-desc">${who ? who + ', a' : 'A'} vila tava no escuro e agora não tá mais. Isso foi você que fez.</p>
    </div>
    <h3 style="font-family:'Press Start 2P';font-size:0.62rem;color:var(--gold);margin:4px 0 12px;">O QUE VOCÊ FEZ HOJE</h3>
    ${deeds.map(d => `
      <div class="meter-row${d.n === 0 ? ' zerada' : ''}">
        <div class="label"><span>${d.icon} ${d.label}</span><span class="val">${d.n}${d.unit||''}</span></div>
        <div class="meter-bg"><div class="meter-fill" style="width:${Math.min(100, d.n/d.max*100)}%;background:${d.color};"></div></div>
      </div>`).join('')}
    <div class="mini-stats">
      <div class="mini-stat"><span class="num">${durationStr}</span><span class="lbl">Tempo na vila</span></div>
      <div class="mini-stat"><span class="num">${Math.round(state.distanceWalked)}m</span><span class="lbl">Você andou</span></div>
      <div class="mini-stat"><span class="num">${state.bitTalks}x</span><span class="lbl">Conversas comigo</span></div>
    </div>
    <button class="btn" onclick="restart()">🔁 JOGAR DE NOVO</button>
  `;
  document.getElementById('resultsOverlay').classList.add('open');
}


/* ===================== NÃO HÁ TELA DE RESULTADO NO JOGO =====================

   Nem retrato, nem lista de partidas, nem `?painel`. Nada.

   Houve as duas coisas aqui, e as duas eram erradas pelo mesmo motivo: qualquer tela de
   resultado dentro do jogo é uma tela que a criança pode abrir. Ela clica no que existe —
   e no instante em que se sabe medida, a próxima partida vira atuação. Não adianta
   esconder atrás de um parâmetro de URL: o que não deve ser visto não deve estar lá.

   Com a partida terminada o jogo faz UMA coisa, e ela não desenha na tela: entrega o payload
   à plataforma (`entregarPartida()`).

   Saiu daqui o `vilaExportarTudo()`, que baixava um `.json` por estudante pelo console — sem
   botão, porque botão é convite. Não existe mais localStorage para exportar, e o caminho do
   pendrive não existe mais.

   O relatório vive no hub do professor, que a criança não abre. */




function restart(){
  zones.forEach(z => { z.introShown = false; });
  MIRROR.restored = false;
  if(MIRROR.baseMesh){
    MIRROR.baseMesh.visible = false;
    MIRROR.baseMesh.material.color.set(0xFF8A2E);
    MIRROR.baseMesh.material.emissive = new THREE.Color(0x000000);
  }
  if(MIRROR.fireLight) MIRROR.fireLight.intensity = 0;
  if(MIRROR.pyre) MIRROR.pyre.children.forEach(l => l.material.color.set(0x3A2214));
  state.visited = [];
  /* `riskyChoices`/`safeChoices` não existem mais — a api classifica. */
  state.opportunitySeen = {};
  state.log = novoLog();   // array cru perderia o carimbo de hora
  state.distanceWalked = 0;
  state.bitTalked = false;
  state.bitTalks = 0;
  sessionStartedAt = null;
  worldGlowTarget = 0;
  dmQueue = [];
  if(activeDM) closeDM();
  document.getElementById('dmOverlay').classList.remove('open');
  if(cinematic){
    cinematic.shards.forEach(sh => scene.remove(sh.mesh));
    scene.remove(cinematic.halo); scene.remove(cinematic.beam);
    cinematic = null;
  }
  document.getElementById('hud').style.opacity = '1';
  state.sparks = 0;
  state.crystalsMined = 0;
  state.torchesPlaced = 0;
  state.torchesGiven = 0;
  state.torchesReclaimed = 0;
  state.villagersSelfReturned = 0;
  state.rescueTimes = [];
  state.torchSpots = [];
  state.villagersRescued = 0;
  state.timeInDark = 0;
  state.timeNearBit = 0;
  state.maxRadius = 0;
  state.playTime = 0;
  state.movingTime = 0;
  state.idleTime = 0;
  state.cellVisits = {};
  state.visitOrder = [];
  state.loreTalks = 0;
  state.helpTalks = 0;
  state.lumeAsks = 0;
  state.lampsLit = 0;
  state.suggestionFollowed = null;
  state.suggestedZone = null;
  state.namesErased = 0;
  state.namesRead = 0;
  state.shortcutsTaken = 0;
  state.darkCrossTime = 0;
  state.litPathTime = 0;
  state.inDarkCross = false;
  state.score = 0;
  state.playfulActs = 0;
  state.carryingTorch = false;
  state.torchesTaken = 0;
  state.torchesSpent = {aldeao:0, lampiao:0, pedra:0, passarela:0};
  state.passarelaLit = false;
  /* PASSARELA.lit vive fora do `state` e não era resetado: da segunda criança em diante
     lightPassarela() saía na primeira linha, o probe "acendeu a passarela" (0,2 de
     Realização) ficava estruturalmente impossível, e ela já encontrava a passarela acesa. */
  if(typeof PASSARELA === 'object'){
    PASSARELA.lit = false;
    if(PASSARELA.bowl){
      PASSARELA.bowl.material.color.set(0x2A2A35);
      PASSARELA.bowl.material.emissive = new THREE.Color(0x000000);
    }
    if(PASSARELA.glow){ scene.remove(PASSARELA.glow); PASSARELA.glow = null; }
  }
  state.opportunities = {};
  Object.keys(_taughtOnce).forEach(k => delete _taughtOnce[k]);
  state.dilemmaSeen = 0;
  state.smokeSpotted = 0;
  state.smokeFollowed = 0;
  state.dilemmaChoices = [];
  state.nameOnBorda = false;
  state.nameOnDestaque = false;
  /* Sem isto a próxima criança herda o id da anterior e a partida dela é descartada como
     duplicada. Confirmado contra o banco: a segunda importação com o mesmo id devolve
     `duplicada` e o dado do segundo estudante nunca entra. */
  state.sessaoLocalId = null;
  /* E o relógio total precisa recomeçar, senão a segunda partida reporta a duração da
     primeira somada, e `iniciadaEm` fica errado na mesma proporção. */
  pageOpenedAt = performance.now();
  state.dmsFired = 0;
  state.dmCartoes = [];
  state.dmsIgnored = 0;
  updateTorchHud();
  document.getElementById('scoreTotal').textContent = '0';
  document.getElementById('tally').innerHTML = '';
  state.detourDistance = 0;
  velocityY = 0;
  miningHeld = false; miningTarget = null;

  veins.forEach(v => {
    v.mined = false; v.progress = 0;
    v.rock.visible = true; v.rock.scale.set(1,1,1); v.rock.rotation.set(0,0,0);
    v.gem.visible = true; v.tag.visible = true;
    if(v.crack){ v.crack.visible = true; v.crack.material.opacity = 0; }
  });
  chips.forEach(c => scene.remove(c.mesh)); chips.length = 0;
  pickups.forEach(p => scene.remove(p.mesh)); pickups.length = 0;
  miningTarget = null;
  hideMineBar();
  torches.forEach(t => { if(t.head) scene.remove(t.head); if(t.light) scene.remove(t.light); });
  torches.length = 0;
  villagerTorches.forEach(t => {
    if(!t.taken){ scene.remove(t.post); scene.remove(t.head); if(t.decal) scene.remove(t.decal); }
  });
  villagerTorches.length = 0;
  playthings.forEach(t => { t.uses = 0; t.wobble = 0; });
  lamps.forEach(l => {
    l.lit = false;
    l.glass.material.color.set(0x2A2A35);
    l.glass.material.emissive = new THREE.Color(0x000000);
    /* C-05 deixou de existir junto com a PointLight: não há mais luz pra sumir da cena no
       restart. O decalque é um mesh próprio, que ninguém remove. */
    l.decal.material.opacity = 0;
  });
  villagers.forEach(v => {
    v.rescued = false;
    v.arrived = false;
    v.walkingHome = false;
    v.calledOut = false;
    v.seenAsDilemma = false;
    v.spottedAt = null;
    v.wentAfter = false;
    v.pastGap = false;
    if(v.carriedLight){
      v.group.remove(v.carriedLight);
      v.group.children.slice(-2).forEach(c => v.group.remove(c));
      v.carriedLight = null;
    }
    v.mark.visible = true;
    v.group.position.set(v.pos.x, 0, v.pos.z);
    v.group.children[0].material.color.set(0x6B5BA8);
  });
  LEADERBOARD.forEach((e,i) => {
    e.claimed = false; e.seen = false;
    const g = zoneMeshes['ranking'];
    if(g && e.tag){
      g.remove(e.tag);
      const step = PODIUM_STEPS[e.step];
      const tag = nameplateSprite(e.name, {width:1.15});
      tag.position.set(step.x, step.h + 0.3, step.z);
      g.add(tag);
      e.tag = tag;
    }
  });
  const rankZone = zones.find(z => z.id === 'ranking');
  const rankGroup = zoneMeshes['ranking'];
  if(rankZone && rankGroup && rankZone.bordaTag){
    rankGroup.remove(rankZone.bordaTag);
    const bt = nameplateSprite('· · · · · · ·', {width:1.3, color:'#9B94A8'});
    bt.position.set(BORDA_SPOT.x, BORDA_SPOT.h + 0.26, BORDA_SPOT.z);
    rankGroup.add(bt);
    rankZone.bordaTag = bt;
  }
  zones.forEach(z => {
    if(!z.fragMesh) return;
    z.fragLit = false;
    z.fragRising = false;
    z.fragMesh.visible = false;
    z.fragMesh.position.y = 2.6;
    if(z.brazier){
      const b = z.brazier;
      b.lit = false;
      b.flame.visible = false;
      b.flameLight.intensity = 0;
      b.tag.visible = true;
      b.logs.children.forEach(l => l.material.color.set(0x3A2214));
      if(b.mark) b.mark.material.opacity = 0.12;
      if(b.ring) b.ring.children.forEach(st => st.material.emissive = new THREE.Color(0x000000));
    }
    z.fragMesh.material.color.set(0x2A3140);
    z.fragMesh.material.emissive = new THREE.Color(0x11202b);
  });

  updateResourceHud();
  updateHud();
  controls.getObject().position.set(SPAWN.x, 1.7, SPAWN.z);
  document.getElementById('resultsOverlay').classList.remove('open');
  introStep = 0;
  /* Nada de identidade para limpar: ela vem da sessão da plataforma e não muda entre
     partidas. Era aqui que morava a trava de "só limpa o slot se ela não entrou por link".

     Mas a PARTIDA é nova, e precisa de uma linha nova no servidor: a anterior já foi
     concluída, e enviar esta para o mesmo id faria a api responder "já estava" e a
     partida dela desaparecer depois de ela ter jogado inteiro. No app de origem o replay
     sobrescrevia a chave do localStorage — também era gravado. */
  if(window.VILA) window.VILA.reabrir();
  renderInicio();
  document.getElementById('menuOverlay').classList.add('open');
}
