/* Vila do Lume — a Crista, a Passarela, obstáculos e o ponto de partida

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ===================== A CRISTA E A PASSARELA =====================
   Uma crista de pedra em arco (r=17, de 95° a 180°) separa o Portal Secreto e o Campo de
   Treino do resto da vila, com uma única fenda no meio. Três rotas pela mesma geografia,
   e cada uma revela um valor diferente:

     contornar a crista pelas pontas  -> o dobro de caminho, pela luz das fogueiras -> Segurança
     cortar pela fenda                -> curto, e o trecho mais escuro do mapa       -> Estimulação
     acender a Passarela (1 Tocha)    -> curto e claro pelo resto da partida         -> Realização

   A Passarela é o primeiro destino da Tocha que beneficia a PRÓPRIA criança: economiza a
   caminhada dela e não dá nada a mais ninguém. Até aqui a Tocha só podia ir para outra
   pessoa (Aldeão) ou para o lugar (Lampião) — as duas metades de Autotranscendência. Agora
   Autopromoção disputa o mesmo recurso, no meio do mapa e cedo, em vez de depender da
   Pedra dos Nomes, que é evento único e fácil de nunca acontecer.

   Nada fica inacessível sem ela: quem nunca gastar uma Tocha aqui termina o jogo igual,
   só andando mais. O custo é relógio, nunca habilidade — não há pulo, mira nem timing.
   Ver GRILL-2026-08-20-mundo.md Q8. */
const RIDGE = [
  {x:-1.48, z:16.94}, {x:-3.39, z:16.66}, {x:-5.25, z:16.17}, {x:-7.05, z:15.47},
  {x:-8.76, z:14.57}, {x:-10.35, z:13.49},
  /* fenda em ~138° — a Passarela mora aqui */
  {x:-14.26, z:9.26}, {x:-15.21, z:7.59}, {x:-15.97, z:5.81}, {x:-16.53, z:3.97},
  {x:-16.87, z:2.07}, {x:-17.0, z:0.15}
];
const PASSARELA = {x:-12.63, z:11.38, lit:false};

/* Ponto de partida. Ficava em (0,18) — que, depois que a Crista entrou, passou a ser
   DENTRO de um bloco de rocha: collidesObstacle bloqueava todas as direções e o WASD
   simplesmente não movia. Fica perto do centro de propósito, pra que o Lume e o Fogo
   Sagrado sejam a primeira coisa que ela vê. */
const SPAWN = {x:0, z:9};

/* Até onde ela pode andar. Calculado a partir da zona mais distante mais uma folga, para
   nunca mais descolar do mapa: o muro de borda fica em r=34, atrás disto. */
const WORLD_LIMIT = Math.max(...zones.map(z => Math.hypot(z.pos.x, z.pos.z))) + 3;

/* Rede contra a mesma classe de bug: se algum dia o ponto de partida cair dentro de
   geometria nova, empurra para fora em espiral em vez de deixar a criança presa. */
function safeSpawn(){
  if(!collidesObstacle(SPAWN.x, SPAWN.z, 1.7)) return {x:SPAWN.x, z:SPAWN.z};
  for(let r = 1; r <= 12; r += 1){
    for(let i = 0; i < 12; i++){
      const a = (i/12) * Math.PI * 2;
      const x = SPAWN.x + Math.cos(a)*r, z = SPAWN.z + Math.sin(a)*r;
      if(!collidesObstacle(x, z, 1.7)) return {x, z};
    }
  }
  return {x:0, z:0};
}

const OBSTACLES = [
  {x:5,z:-8.7,w:1.6,d:1.6,h:1.1},
  {x:10,z:0,w:1.6,d:1.6,h:1.1},
  {x:5,z:8.7,w:1.6,d:1.6,h:1.0},
  {x:-5,z:8.7,w:1.4,d:1.4,h:1.2},
  {x:-10,z:0,w:1.6,d:1.6,h:1.0},
  {x:-5,z:-8.7,w:1.6,d:1.6,h:1.1}
];
function buildRidge(){
  RIDGE.forEach((p, i) => {
    const h = 3.2 + (i % 3) * 0.5;                 // dente de serra, pra não virar muro liso
    const rock = mkBox(3.4, h, 2.6, 0x3A3436);
    rock.position.set(p.x, h/2, p.z);
    rock.rotation.y = Math.atan2(p.x, p.z);
    scene.add(rock);
    OBSTACLES.push({x:p.x, z:p.z, w:3.4, d:2.6, h:h});
  });

  // a Passarela: pranchas na fenda, apagadas até alguém gastar uma Tocha nelas
  const g = new THREE.Group();
  for(let i=0;i<3;i++){
    const plank = mkBox(2.6, 0.16, 0.7, 0x4A3418);
    plank.position.set(0, 0.09, (i-1) * 0.85);
    g.add(plank);
  }
  const post1 = mkBox(0.16, 1.5, 0.16, 0x3A2214); post1.position.set(-1.1, 0.75, 0);
  const post2 = mkBox(0.16, 1.5, 0.16, 0x3A2214); post2.position.set(1.1, 0.75, 0);
  const bowl = mkMesh(new THREE.CylinderGeometry(0.22,0.16,0.24,6), 0x2A2A35, false, {emissive:0x000000});
  bowl.position.set(0, 1.62, 0);
  g.add(post1, post2, bowl);
  g.position.set(PASSARELA.x, 0, PASSARELA.z);
  g.rotation.y = Math.atan2(PASSARELA.x, PASSARELA.z);
  scene.add(g);
  PASSARELA.group = g;
  PASSARELA.bowl = bowl;
}

function lightPassarela(){
  if(PASSARELA.lit) return false;
  if(!state.carryingTorch){ showSparkToast('A passarela tem um braseiro apagado. Precisa de uma tocha acesa.'); return true; }
  spendTorch('passarela');
  PASSARELA.lit = true;
  state.passarelaLit = true;
  PASSARELA.bowl.material.color.set(0xFFC857);
  PASSARELA.bowl.material.emissive = new THREE.Color(0x8a5a00);
  PASSARELA.group.children.forEach(c => { if(c.geometry && c.geometry.type === 'BoxGeometry') c.material.color.set(0x6B4423); });
  // luz emissiva e um decalque no chão — nenhuma PointLight nova, pelo orçamento gráfico
  const glow = mkMesh(new THREE.RingGeometry(0.6, 5.5, 16), 0xFFB25C, false, {transparent:true, opacity:0.16});
  glow.rotation.x = -Math.PI/2;
  glow.position.set(PASSARELA.x, 0.04, PASSARELA.z);
  scene.add(glow);
  PASSARELA.glow = glow;
  torches.push({x:PASSARELA.x, z:PASSARELA.z, post:null, head:null, light:null, life:Infinity, permanent:true, optional:true, fake:true});
  blip(600,0.12,'sine',0.08); blip(820,0.16,'sine',0.07,0.1);
  teachOnce('passarela', 'A passarela acendeu. Agora dá pra atravessar por aqui a hora que você quiser.');
  return true;
}

function buildObstacles(){
  OBSTACLES.forEach(o => {
    const crate = mkBox(o.w, o.h, o.d, 0x8B5A2B);
    crate.position.set(o.x, o.h/2, o.z);
    scene.add(crate);
    const plank = mkBox(o.w*0.9, 0.08, 0.08, 0x5E3B1C, false);
    plank.position.set(o.x, o.h*0.65, o.z);
    scene.add(plank);
  });
}

let handGroup, handRestY = -0.55, handPunch = 0, stepDist = 0, frameMoveLen = 0, bobT = 0;
let footstepColor = 0x5CF3E6; // purely decorative footstep puff
const footPuffs = [];

function spawnFootPuff(){
  if(!footstepColor || !controls) return;
  const obj = controls.getObject();
  const puff = mkMesh(new THREE.RingGeometry(0.05,0.16,8), footstepColor, false, {transparent:true, opacity:0.75});
  puff.rotation.x = -Math.PI/2;
  puff.position.set(obj.position.x, 0.06, obj.position.z);
  scene.add(puff);
  footPuffs.push({mesh:puff, life:0.5});
}

function updateFootPuffs(dt){
  for(let i=footPuffs.length-1;i>=0;i--){
    const p = footPuffs[i];
    p.life -= dt;
    p.mesh.scale.multiplyScalar(1 + dt*1.5);
    p.mesh.material.opacity = Math.max(0, p.life/0.5) * 0.75;
    if(p.life <= 0){ scene.remove(p.mesh); footPuffs.splice(i,1); }
  }
}

function updateHandAndFootsteps(dt){
  if(!handGroup) return;
  if(frameMoveLen > 0){
    stepDist += frameMoveLen;
    bobT += dt * 9;
    handGroup.position.y = handRestY + Math.abs(Math.sin(bobT)) * 0.06;
    if(stepDist > 1.6){ stepDist = 0; playFootstep(); spawnFootPuff(); }
  } else {
    bobT = 0;
    handGroup.position.y += (handRestY - handGroup.position.y) * 0.2;
  }
  if(handPunch > 0){
    handPunch -= dt * 4.5;
    const p = Math.max(0, Math.sin(Math.max(handPunch,0) * Math.PI));
    handGroup.rotation.x = 0.15 - p * 0.6;
    handGroup.position.z = -0.9 - p * 0.35;
  } else {
    handGroup.rotation.x += (0.15 - handGroup.rotation.x) * 0.3;
    handGroup.position.z += (-0.9 - handGroup.position.z) * 0.3;
  }
}
function buildHand(){
  handGroup = new THREE.Group();
  const arm = mkBox(0.28, 0.28, 0.9, 0xE8B98A, false);
  arm.position.set(0, 0, -0.4);
  handGroup.add(arm);
  handGroup.position.set(0.55, handRestY, -0.9);
  handGroup.rotation.set(0.15, -0.25, 0.1);
  camera.add(handGroup);
}
function punchHand(){ handPunch = 1; }

function updateWorldGlowTarget(){
  const done = zones.filter(z => state.visited.includes(z.id)).length;
  const lit = zones.filter(z => z.brazier && z.brazier.lit).length;
  worldGlowTarget = Math.max(done, lit) / zones.length;
}

function updateWorldGlow(dt){
  // slow, felt dawn instead of a snap — the village should visibly breathe back to life
  worldGlow += (worldGlowTarget - worldGlow) * Math.min(1, dt * 0.55);

  const cg = Math.min(1, worldGlow);
  _lerpBg.lerpColors(WORLD_DIM.bg, WORLD_FULL.bg, cg);
  _lerpFog.lerpColors(WORLD_DIM.fog, WORLD_FULL.fog, cg);
  scene.background.copy(_lerpBg);
  scene.fog.color.copy(_lerpFog);
  scene.fog.near = WORLD_DIM.fogNear + (WORLD_FULL.fogNear - WORLD_DIM.fogNear) * cg;
  scene.fog.far = WORLD_DIM.fogFar + (WORLD_FULL.fogFar - WORLD_DIM.fogFar) * worldGlow;

  hemiLight.intensity = WORLD_DIM.hemi + (WORLD_FULL.hemi - WORLD_DIM.hemi) * worldGlow;
  sunLight.intensity = WORLD_DIM.sun + (WORLD_FULL.sun - WORLD_DIM.sun) * worldGlow;
}

const MAX_ACTIVE_ZONES = 3;

/* Up to 3 fragment zones are open to explore at once (in any order the child likes) —
   as each one is finished, the next unclaimed zone joins the active set. The central fire
   only joins once every fragment is in. Completion order becomes free bonus signal
   (which zone an explorer-leaning kid beelines for) instead of being forced. */
function getActiveZoneIds(){
  // The whole village is open from the start — the child picks their own route.
  const unvisited = zones.filter(z => !state.visited.includes(z.id));
  if(unvisited.length) return unvisited.map(z => z.id);
  if(!state.visited.includes('espelho')) return ['espelho'];
  return [];
}

function updateZoneVisuals(){
  const activeIds = getActiveZoneIds();
  zones.concat([MIRROR]).forEach(z => {
    if(z.id === 'espelho' && !activeIds.includes('espelho') && !state.visited.includes('espelho')){
      // the cold pyre is always there in the middle — only its flame is missing
      zoneMeshes[z.id].visible = true;
      if(z.baseMesh) z.baseMesh.visible = false;
      return;
    }
    zoneMeshes[z.id].visible = true;
    const isNext = activeIds.includes(z.id);
    const isDone = state.visited.includes(z.id);
    z.beaconMesh.visible = isNext;
    if(!(z.id === 'espelho' && z.restored)){
      z.baseMesh.material.emissive = new THREE.Color(isDone ? 0x113322 : 0x000000);
      z.baseMesh.material.color.set(isDone ? 0x2E5C3A : z.color);
    }
    if(z.torchMarker) z.torchMarker.material.color.setHex(isDone ? 0xFFB25C : 0x4A3A28);
  });
}

/* Missão "A Noite Longa" — quando cada mensagem chega.
   Ver o cabeçalho de 01-config.js e `apps/api/src/vila/catalogo.ts`.

   Não é sorteio. O MOMENTO é metade do desenho: o golpe da bolha C só funciona porque
   chega no instante em que ela está sem fagulha, e o da bolha B só funciona porque chega
   quando ela já tem cinco fogueiras a perder. Disparo aleatório desmancharia as duas
   coisas.

   O agendador LÊ o estado do jogo para decidir a hora e NUNCA escreve nele. É por isso
   que o gatilho continua sendo avaliado AQUI e não no servidor: só o jogo sabe quantas
   fogueiras já acenderam e se ela está travada sem fagulha.

   O FILTRO POR BOLHA SAIU. A api já entrega só os cartões desta criança, na ordem em que
   devem chegar — filtrar de novo aqui exigiria o `nivel` de volta no bundle, que é
   metade do gabarito. */

let dmPendentes = [];
/** Quantos cartões já foram resolvidos (respondidos ou expirados). É o que o gatilho
 *  `aposCartao:N` conta. */
let dmResolvidos = 0;

function scheduleAmbientDMs(){
  dmPendentes = cartoesDaMissao().slice();
  if(!dmPendentes.length){
    /* Sem cartão servido a missão simplesmente não roda. Não é erro do jogo, e a criança
       não vê nada: a api já gravou `cartoesServidos: 0` e o relatório vai dizer "as
       mensagens não chegaram nesta partida" em vez de "ela ignorou tudo". */
    return;
  }
  dmResolvidos = 0;
  setTimeout(verificarGatilhosDM, 4000);
}

/** Quantas fogueiras já foram acesas — a Chama Sagrada não conta. */
function fogueirasAcesas(){
  return state.visited.filter(id => id !== 'espelho').length;
}

function gatilhoAtendido(g){
  if(g === 'inicio') return (performance.now() - (sessionStartedAt || 0)) > 20000;
  if(g === 'semFagulha') return state.sparks === 0 && !state.carryingTorch && fogueirasAcesas() >= 1;
  /* Era `aposGolpe`, e o nome dizia ao cliente qual cartão era o golpe. Por índice diz a
     mesma coisa sobre ORDEM (o 3º da lista servida é sempre o golpe da bolha) e nada
     sobre conteúdo. */
  const c = /^aposCartao:(\d+)$/.exec(g);
  if(c) return dmResolvidos >= parseInt(c[1], 10);
  const m = /^aposFogueiras:(\d+)$/.exec(g);
  if(m) return fogueirasAcesas() >= parseInt(m[1], 10);
  return true;
}

function verificarGatilhosDM(){
  if(!dmPendentes.length || cinematic) return;
  /* A partida acaba no instante em que a última Chama está na mão — nada novo interrompe
     o fim. */
  if(fogueirasAcesas() >= zones.length){ dmPendentes = []; return; }

  const overlayAberto = ['bitOverlay','dmOverlay','resultsOverlay','menuOverlay'].some(
    id => document.getElementById(id).classList.contains('open')
  );
  if(!playing || overlayAberto){ setTimeout(verificarGatilhosDM, 2000); return; }

  /* Ordem da lista servida, não a ordem em que os gatilhos abrem: a batida 4 é um aviso
     SOBRE o golpe e não pode chegar antes dele. A api entrega nessa ordem de propósito. */
  const pronto = dmPendentes.find(d => gatilhoAtendido(d.gatilho));
  if(pronto){
    dmPendentes = dmPendentes.filter(d => d !== pronto);
    /* Quem conta o cartão como resolvido é o `closeDM()` — respondido ou expirado. Ver o
       comentário lá: aqui ficava um `setTimeout` de 1s que contava logo depois de ABRIR. */
    openDM(pronto);
    setTimeout(verificarGatilhosDM, 15000);
    return;
  }
  setTimeout(verificarGatilhosDM, 2500);
}

/* Mantido porque `12-dialogue.js` chama ao fechar um cartão. */
function scheduleNextAmbientDM(delay){
  setTimeout(verificarGatilhosDM, delay || 3000);
}
