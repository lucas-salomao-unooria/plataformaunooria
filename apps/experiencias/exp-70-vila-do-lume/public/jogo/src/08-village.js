/* Vila do Lume — fogueiras, aldeões e a Pedra dos Nomes

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */


function isLit(x, z){
  return torches.some(t => {
    const dx = x-t.x, dz = z-t.z;
    return dx*dx + dz*dz < LIGHT_RADIUS*LIGHT_RADIUS;
  });
}

/* Light the world gave her (Fogueiras) versus light she created with an Ato Opcional
   (Lampião, tocha de Aldeão). The Security probe must only see the first: otherwise being
   generous with lamps reads as being cautious, and Universalismo leaks into Segurança. */
function isLitByWorld(x, z){
  return torches.some(t => {
    if(t.optional) return false;
    const dx = x-t.x, dz = z-t.z;
    return dx*dx + dz*dz < LIGHT_RADIUS*LIGHT_RADIUS;
  });
}

function nearAnyVein(x, z, radius){
  return veins.some(v => !v.mined && Math.hypot(x - v.pos.x, z - v.pos.z) < radius);
}

function refreshFragmentLighting(){ /* shards are released by braziers now, not ambient light */ }

/* Lighting a brazier is the payoff moment: the fire roars up, the whole corner of the
   village wakes, and the landmark's mirror shard rises out of the flames. */
function lightBrazier(zone){
  const b = zone.brazier;
  if(!b || b.lit) return false;
  if(state.sparks < 1){ showSparkToast('Você está sem fagulha'); return true; }

  /* Conformity vs Self-Direction: Lume names one place at the start, and the FIRST FIRE
     SHE LIGHTS is the answer. This used to live in finishZone, which runs from
     claimFragment — so it was reading the first Tocha picked up, not the first fire lit. */
  if(state.suggestionFollowed === null && state.suggestedZone){
    state.suggestionFollowed = (zone.id === state.suggestedZone);
    const first = zone;
    setTimeout(() => showZoneIntroToast('Vi que você começou pel' + (first.art === 'a' ? 'a ' : 'o ') + first.label + '.'), 2200);
  }

  state.sparks--;
  state.torchesPlaced++;
  state.torchSpots.push({x: zone.brazierWorld.x, z: zone.brazierWorld.z});
  updateResourceHud();

  b.lit = true;
  addScore('fire');
  /* Canal ANALÍTICO (telemetria do SDK), separado do canal da partida. Os dois existem de
     propósito: este agrega entre experiências e alunos; o payload da partida é o registro
     de verdade, transacional, e é dele que o perfil é recalculado. Nada aqui é lido pelo
     relatório do professor. */
  if(window.VILA) window.VILA.registrar('progressed', 'fogueira', {
    zona: zone.id, acesas: state.torchesPlaced
  });
  b.flame.visible = true;
  b.flame.material.emissive = new THREE.Color(0x9c3c00);
  b.flameLight.intensity = 2.4;
  b.tag.visible = false;
  b.logs.children.forEach(l => l.material.color.set(0x6a3a18));
  if(b.mark) b.mark.material.opacity = 0.5;
  if(b.ring) b.ring.children.forEach(st => st.material.emissive = new THREE.Color(0x4a2000));

  // permanent light source for this corner of the village
  torches.push({x: zone.brazierWorld.x, z: zone.brazierWorld.z, post:null, head:null, light:b.flameLight, life:Infinity, permanent:true});

  if(zone.beaconTip) zone.beaconTip.material.color.set(0xFFB25C);
  zone.fragLit = true;
  zone.fragMesh.visible = true;
  zone.fragMesh.position.y = 3.2;
  zone.fragRising = true;

  updateWorldGlowTarget();
  triggerSuccessBloom();
  playAmbientChime();
  teachOnce('fogueira',
    'A fogueira acendeu! Olha a Chama Sagrada subindo do fogo. Chega perto dela e aperta E pra pegar.',
    () => state.visited.some(id => id !== 'espelho'));      // sai quando ela pega a primeira Chama
  return true;
}

/* Lost villagers: the dark's real cost is people, not monsters. Each one is stranded in an
   unlit corner; rescuing costs the child time they could have spent chasing fragments —
   which is exactly what makes choosing to help a genuine Socializer signal. */
/* Said out loud by the villager, never printed as an objective. Short, first person, and
   never a request for a specific item — a six-year-old should understand that someone
   needs something without being told what to press. */
/* A fumaça é fog:false, então tecnicamente aparece a qualquer distância. Este alcance
   existe pra que "viu" signifique algo: perto o bastante pra que a coluna ocupe pixels
   suficientes na tela de uma criança, e não um ponto de um pixel no horizonte. */
const SMOKE_VISIBLE_RANGE = 42;
const _smokeDir = new THREE.Vector3(), _camDir = new THREE.Vector3();
function smokeInView(camObj, v){
  _smokeDir.set(v.pos.x - camObj.position.x, 0, v.pos.z - camObj.position.z).normalize();
  camera.getWorldDirection(_camDir); _camDir.y = 0; _camDir.normalize();
  return _smokeDir.dot(_camDir) > 0.42;      // ~65° de meia-abertura, folgado de propósito
}

const VILLAGER_CALLS = [
  'Ei! Tem alguém aí? Não enxergo nada daqui.',
  'Oi! Eu não consigo voltar pra Praça sem luz.',
  'Aqui! Tô parado nesse escuro faz tempo.',
  'Psiu! Se você tiver fogo, eu consigo andar.'
];

/* O Chamado precisa alcançá-la de qualquer jeito: se não alcança, "não ajudou" volta a ser
   ambíguo e o conserto do C-09 se perde. A primeira versão era grito posicional, e morreu
   no contexto real de uso — sala de aula de escola pública, sem fone, trinta máquinas
   juntas, quase sempre no mudo. E por acessibilidade: criança surda tem que poder jogar.

   A fumaça faz o mesmo trabalho sem depender de áudio. Sobe acima da névoa (fog:false),
   atravessa a Crista, e dá direção grosseira sem seta nem distância — exatamente o que o
   som daria. O grito continua tocando pra quem tiver áudio, mas nunca carrega informação
   sozinho. Ver GRILL-2026-08-20-mundo.md Q9. */
function buildSmokeSignal(v){
  const g = new THREE.Group();
  const puffs = [];
  for(let i=0;i<5;i++){
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.34 + i*0.12, 6, 6),
      new THREE.MeshBasicMaterial({color:0xBFB6C7, fog:false, transparent:true, opacity:0.34 - i*0.05})
    );
    m.position.y = 2.6 + i * 1.5;
    g.add(m); puffs.push(m);
  }
  g.position.set(v.pos.x, 0, v.pos.z);
  scene.add(g);
  v.smoke = g; v.smokePuffs = puffs;
}

function updateSmoke(dt){
  const t = performance.now() * 0.001;
  villagers.forEach(v => {
    if(!v.smoke) return;
    const on = !v.rescued && !v.walkingHome;
    v.smoke.visible = on;
    if(!on) return;
    v.smokePuffs.forEach((m, i) => {
      m.position.y = 2.6 + i*1.5 + Math.sin(t*0.7 + i*0.6 + v.phase) * 0.3;
      m.position.x = Math.sin(t*0.4 + i*0.9 + v.phase) * (0.2 + i*0.14);
    });
  });
}

/* O Aldeão andava reto até a Praça atravessando rocha, caixa e a Crista inteira. Sem
   pathfinding (não cabe aqui): tenta a linha reta e, se estiver bloqueado, testa desvios
   de até 60° para cada lado e vai pelo primeiro que abrir. Não é ótimo — às vezes ele
   contorna feio — mas nunca atravessa parede, que é o que estragava a ilusão. */
/* Quem está além da Crista não consegue contornar só com desvio local — o arco é longo
   demais e ele fica raspando a parede pra sempre. Então ele faz o que uma pessoa faria:
   vai primeiro até a fenda, atravessa, e só depois segue para a Praça. É a mesma passagem
   que a criança usa, o que também deixa a cena legível: ela vê o aldeão saindo por ali. */
const RIDGE_ARC = {rMin: 15.5, angMin: 92, angMax: 183};
function behindRidge(x, z){
  const r = Math.hypot(x, z);
  if(r < RIDGE_ARC.rMin) return false;
  const a = (Math.atan2(z, x) * 180 / Math.PI + 360) % 360;
  return a >= RIDGE_ARC.angMin && a <= RIDGE_ARC.angMax;
}

function villagerTarget(v){
  const p = v.group.position;
  /* Uma vez que ele encosta na fenda, o alvo vira a Praça de vez. Sem esta trava ele
     chegava na fenda, continuava "atrás da Crista" pelo teste de setor — a própria fenda
     está em r=17, dentro do arco — e mirava eternamente o ponto onde já estava. */
  if(!v.pastGap && Math.hypot(p.x - PASSARELA.x, p.z - PASSARELA.z) < 2.5) v.pastGap = true;
  if(!v.pastGap && behindRidge(p.x, p.z) && !behindRidge(PRACA_POS.x, PRACA_POS.z)){
    return {x: PASSARELA.x, z: PASSARELA.z};
  }
  return {x: PRACA_POS.x, z: PRACA_POS.z};
}

function stepVillager(v, tx, tz, speed, dt){
  const dx = tx - v.group.position.x, dz = tz - v.group.position.z;
  const base = Math.atan2(dx, dz);
  const stepLen = speed * dt;
  const tries = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.9, -1.9];
  for(const off of tries){
    const a = base + off;
    const nx = v.group.position.x + Math.sin(a) * stepLen;
    const nz = v.group.position.z + Math.cos(a) * stepLen;
    if(collidesObstacle(nx, nz, 0)) continue;
    v.group.position.x = nx;
    v.group.position.z = nz;
    v.group.rotation.y = a;
    v.group.position.y = Math.abs(Math.sin(performance.now()*0.008 + v.phase)) * 0.09;
    return true;
  }
  return false;   // encurralado: fica parado em vez de vazar pela geometria
}

const villagers = [];
function buildVillagers(){
  VILLAGER_SPOTS.forEach(p => {
    const g = new THREE.Group();
    const body = mkMesh(new THREE.BoxGeometry(0.55,0.9,0.4), 0x6B5BA8, false);
    body.position.y = 0.45;
    const head = mkMesh(new THREE.BoxGeometry(0.42,0.42,0.42), 0xE8C9A0, false);
    head.position.y = 1.1;
    g.add(body, head);
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    const mark = emojiSprite('\u2049\ufe0f', 0.5);
    mark.position.y = 1.75;
    g.add(mark);
    villagers.push({group:g, mark, pos:p, pair:p.pair, hidden:!!p.hidden, rescued:false, calledOut:false, phase:Math.random()*Math.PI*2});
    buildSmokeSignal(villagers[villagers.length-1]);
  });
}

/* Handing over a torch is what saves a villager: the light is what lets them cross the dark
   to the Praça. It costs a real ember, which is what makes choosing to help a genuine
   Socializer signal instead of a free click. */
function giveTorchToVillager(v){
  if(v.rescued) return false;
  if(!state.carryingTorch){ showSparkToast('Você precisa de uma tocha acesa. Pega fogo numa fogueira.'); return true; }

  spendTorch('aldeao');
  state.torchesGiven++;
  if(v.pair != null) recordDilemmaChoice(v.pair, 'aldeao');
  updateResourceHud();

  v.rescued = true;
  v.mark.visible = false;

  // the villager now carries a lit torch of their own
  const torchPost = mkBox(0.1, 0.5, 0.1, 0x5E3B1C, false);
  torchPost.position.set(0.36, 0.75, 0.1);
  const torchHead = mkMesh(new THREE.SphereGeometry(0.13,8,8), 0xFFC857, false, {emissive:0x8a5a00});
  torchHead.position.set(0.36, 1.05, 0.1);
  torchHead.material = new THREE.MeshBasicMaterial({color:0xFFC857});
  v.group.add(torchPost, torchHead);
  v.carriedLight = null;

  state.villagersRescued++;
  state.rescueTimes.push({
    at: Math.round(state.playTime),
    firesLit: zones.filter(z => z.brazier && z.brazier.lit).length
  });
  state.log.push({tipo:'tocha_gasta', dados:{destino:'aldeao'}});
  blip(660,0.1,'sine',0.08);
  blip(880,0.12,'sine',0.08,0.08);
  teachOnce('aldeao',
    'O aldeão pegou a tocha e tá indo pra Praça. Ele finca ela lá quando chegar. Se você quiser, dá pra ir buscar esse fogo de volta depois.',
    () => villagerTorches.length > 0);                      // sai quando ele finca a tocha na Praça
  return true;
}

/* Derivado da zona, nunca digitado: era uma constante fixa em {9.2,-9.2} e ficou apontando
   para onde a Praça costumava estar quando o mapa foi redesenhado — os Aldeões caminhavam
   para um ponto vazio ao lado do Mural. */
const PRACA_POS = (() => { const z = zones.find(z => z.id === 'praca'); return {x:z.pos.x, z:z.pos.z}; })();

/* The villager plants the torch when they get home, and it stays lit in the Praça. You may
   walk over and take the fire back — one spark returned, but the Praça goes dark again.
   That turns helping into three different acts instead of one: helping and leaving the
   light, helping and reclaiming it, or not helping at all. Only the first is plain
   generosity; the second is investment. The game never says which is better. */
const villagerTorches = [];
function plantVillagerTorch(v){
  const a = villagerTorches.length * 1.3;
  /* 4.6 e não 2.4: a 2.4 a tocha caía em cima do ponto da Chama Sagrada da Praça, e o E
     pegava o fragmento em vez de retomar o fogo. */
  const px = PRACA_POS.x + Math.cos(a) * 4.6;
  const pz = PRACA_POS.z + Math.sin(a) * 4.6;

  const post = mkBox(0.14, 1.1, 0.14, 0x5E3B1C);
  post.position.set(px, 0.55, pz);
  scene.add(post);
  const head = mkMesh(new THREE.SphereGeometry(0.16,8,8), 0xFFC857, false, {emissive:0x8a5a00});
  head.position.set(px, 1.18, pz);
  scene.add(head);
  head.material = new THREE.MeshBasicMaterial({color:0xFFC857});
  const decal = mkMesh(new THREE.RingGeometry(0.5, 5.0, 14), 0xFFB25C, false, {transparent:true, opacity:0.16});
  decal.rotation.x = -Math.PI/2;
  decal.position.set(px, 0.04, pz);
  scene.add(decal);

  const entry = {x:px, z:pz, post, head, decal, light:null, taken:false};
  villagerTorches.push(entry);
  torches.push({x:px, z:pz, post:null, head:null, light:null, life:Infinity, permanent:true, optional:true, fake:true});

  // the villager lets go of their own carried torch now that it stands in the square
  if(v.carriedLight){ v.group.remove(v.carriedLight); v.carriedLight = null; }
}

function reclaimTorch(t){
  t.taken = true;
  scene.remove(t.post); scene.remove(t.head); if(t.decal) scene.remove(t.decal);
  const i = torches.findIndex(x => Math.abs(x.x - t.x) < 0.01 && Math.abs(x.z - t.z) < 0.01);
  if(i !== -1) torches.splice(i, 1);
  /* Taking the fire back hands her a lit tocha, not a spark. It used to pay +1 spark AND
     score while zeroing the Benevolence component it belonged to — the only visible
     gradient pointed against the signal it was supposed to read. Now it is what it looks
     like: the fire she gave away, back in her hand, and the Praça dark again. */
  state.torchesReclaimed++;
  if(!state.carryingTorch){
    state.carryingTorch = true;
    updateTorchHud();
    showSparkToast('Você pegou o fogo de volta. A Praça ficou escura de novo.');
  }else{
    showSparkToast('Você já está com uma tocha. Esta ficou apagada.');
  }
  updateResourceHud();
  refreshFragmentLighting();
  blip(520,0.1,'sine',0.07);
}


function updateVillagers(dt){
  const villageLit = zones.every(z => z.brazier && z.brazier.lit);
  villagers.forEach(v => {
    if(!v.rescued && villageLit && !v.walkingHome){
      v.walkingHome = true;
      v.mark.visible = false;
      state.villagersSelfReturned++;
    }
    if(v.walkingHome && !v.rescued){
      const d = Math.hypot(PRACA_POS.x - v.group.position.x, PRACA_POS.z - v.group.position.z);
      if(d > 4.4){ const t = villagerTarget(v); stepVillager(v, t.x, t.z, 1.8, dt); }
      return;
    }
    if(v.rescued){
      if(v.arrived){
        v.group.position.y = Math.sin(performance.now()*0.002 + v.phase) * 0.05;
        return;
      }
      // walk to the Praça, lighting their own way
      const d = Math.hypot(PRACA_POS.x - v.group.position.x, PRACA_POS.z - v.group.position.z);
      if(d > 4.4){
        const t = villagerTarget(v);
        stepVillager(v, t.x, t.z, 2.1, dt);
      } else if(!v.arrived){
        v.arrived = true;
        blip(784,0.14,'sine',0.07);
        plantVillagerTorch(v);
      }
    } else {
      v.group.position.y = Math.sin(performance.now()*0.002 + v.phase) * 0.05;
      if(v.mark) v.mark.material.opacity = 0.5 + Math.sin(performance.now()*0.005 + v.phase)*0.4;

      /* Chamado. Nada na HUD diz que dá pra ajudar um Aldeão — quem diz é a fumaça dele,
         de longe, e o próprio Aldeão quando ela chega perto. Substituiu o score e o
         contador, e é também o único registro honesto de que a chance existiu.

         A Oportunidade Percebida é marcada quando a FUMAÇA entra no campo de visão, não
         quando ela chega perto: é o momento em que a informação chegou até ela. Daí em
         diante, ignorar é escolha, não desconhecimento. */
      if(controls){
        const o = controls.getObject();
        const d = Math.hypot(o.position.x - v.group.position.x, o.position.z - v.group.position.z);

        if(d < SMOKE_VISIBLE_RANGE && smokeInView(o, v)){
          markOpportunity('benevolence', 'fumaca:' + v.pair);
          if(v.spottedAt == null){
            v.spottedAt = d;              // distância no instante em que ela avistou o sinal
            state.smokeSpotted++;
          }
        }
        /* Probe novo: desviar da própria rota por causa de alguém. Cortar a distância pela
           metade depois de avistar o sinal é intenção, não proximidade — é Benevolência
           bem mais forte que ajudar quem estava do lado do caminho. É também o primeiro
           probe do projeto que lê uma mudança de rumo no meio do movimento. */
        if(v.spottedAt != null && !v.wentAfter && d < v.spottedAt * 0.5 && v.spottedAt > 12){
          v.wentAfter = true;
          state.smokeFollowed++;
        }

        if(d < 7){
          markOpportunity('benevolence', 'perto:' + v.pair);
          if(!v.calledOut){
            v.calledOut = true;
            blip(430,0.2,'sine',0.075); blip(340,0.26,'sine',0.06,0.16);
            pushToast('🧑 ' + VILLAGER_CALLS[Math.floor(Math.random()*VILLAGER_CALLS.length)], 'bit');
          }
          // she is inside a Dilema pair, carrying the one Tocha that can serve either
          if(v.pair != null && state.carryingTorch){
            const lamp = lamps.find(l => l.pair === v.pair);
            if(lamp && !lamp.lit && !v.seenAsDilemma){
              v.seenAsDilemma = true;
              state.dilemmaSeen++;
              markOpportunity('universalism', 'par:' + v.pair);
            }
          }
        }
      }
    }
  });
}

/* Village leaderboard: three podium steps with other kids' names on them. Stepping onto a
   step you outrank is a deliberate "I'm taking your place" act — a Killer signal with no
   violence anywhere near it. Purely optional; ignoring the podium costs nothing. */
/* Nomes de quem passou antes. Eram "ALUNO 12/31/5", derivados do formato do slot; o slot
   morreu no porte para a plataforma, e o substituto NÃO PODE ser nome de colega de turma.

   Na plataforma a turma é real e a criança conhece os nomes dela. Gravar aqui o nome de um
   colega faria de apagar um Destaque um ato social de verdade — o que contamina Poder com
   realidade social (o probe passaria a ler a relação entre as duas crianças, não o valor) e
   é dano concreto numa sala de aula. São aldeões da Vila, com sobrenome de lugar, para não
   colidirem com a lista de chamada de ninguém. */
const LEADERBOARD = [
  {name:"TIÃO DA CRISTA", step:0},
  {name:"NILDA DO PORTAL", step:1},
  {name:"BENTO DA PRAÇA", step:2}
];
/* Standing on a podium step was firing by collision alone — and kids jump on everything,
   so it was measuring the physics engine, not intent. Now taking someone's place is a
   deliberate act with a named victim, and the game gives no praise for doing it. */
let nearBorda = false;
let nearPassarela = false;
function updatePodium(dt){
  const rank = zones.find(z => z.id === 'ranking');
  if(!rank || !controls) return;
  const obj = controls.getObject();
  nearPodium = null;
  nearBorda = false;

  const bx = rank.pos.x + BORDA_SPOT.x, bz = rank.pos.z + BORDA_SPOT.z;
  if(!state.nameOnBorda && Math.hypot(obj.position.x - bx, obj.position.z - bz) < 1.3){
    nearBorda = true;
  }

  LEADERBOARD.forEach(entry => {
    if(entry.claimed) return;
    const step = PODIUM_STEPS[entry.step];
    const wx = rank.pos.x + step.x, wz = rank.pos.z + step.z;
    if(Math.hypot(obj.position.x - wx, obj.position.z - wz) < 1.0){
      nearPodium = entry;
      if(!entry.seen){ entry.seen = true; state.namesRead++; }
    }
  });

  /* Standing at the Pedra at all, carrying a Tocha, is the Oportunidade Percebida for
     Autopromoção: from here she can sign the Borda, take a Destaque, or walk away — and
     walking away only means something because the other two were right there. */
  if((nearPodium || nearBorda) && state.carryingTorch){
    markOpportunity('achievement');
    markOpportunity('power');
  }
}

/* Two different acts, deliberately not collapsed. Borda: she paid a Tocha for her own mark
   and took nothing — Achievement. Destaque: she paid the same Tocha and put her name where
   another child's was — Power. Before the Borda existed, both were the same click. */
function carveOnPedra(){
  if(!state.carryingTorch){
    if(nearPodium || nearBorda) showSparkToast('Pra queimar teu nome na pedra você precisa de uma tocha acesa.');
    return !!(nearPodium || nearBorda);
  }
  if(nearBorda){
    spendTorch('pedra');
    state.nameOnBorda = true;
    const rank = zones.find(z => z.id === 'ranking');
    if(rank && rank.bordaTag){
      const g = zoneMeshes['ranking'];
      if(g) g.remove(rank.bordaTag);
      const tag = nameplateSprite(playerLabel(), {width:1.3});
      tag.position.set(BORDA_SPOT.x, BORDA_SPOT.h + 0.26, BORDA_SPOT.z);
      if(g) g.add(tag);
      rank.bordaTag = tag;
    }
    state.log.push({tipo:'pedra_dos_nomes', dados:{acao:'borda'}});
    blip(700,0.12,'sine',0.08); blip(940,0.14,'sine',0.07,0.1);
    return true;
  }
  if(nearPodium){ erasePodiumName(nearPodium); return true; }
  return false;
}

/* O PRIMEIRO NOME da criança, vindo da sessão autenticada da plataforma (nunca de um campo
   que ela digite, nunca de um número que ela escolha). Era 'ALUNO 7', do link do professor.

   Vive só na Camada 1 — a fala do Lume e a Pedra dos Nomes — e NUNCA é serializado: o
   payload que sobe para a api não tem campo de nome, e a api recusa payload que tenha. É a
   mesma regra do jogo de origem; só a fonte do nome mudou. */
function playerLabel(){
  return (window.VILA && window.VILA.identidade.primeiroNome) || 'VOCÊ';
}

/* Lume chama a criança pelo nome em voz alta. Só aqui e na Pedra. */
function addr(){
  const nome = window.VILA && window.VILA.identidade.primeiroNome;
  return nome ? ', ' + nome : '';
}

function erasePodiumName(entry){
  entry.claimed = true;
  spendTorch('pedra');
  state.namesErased++;
  state.nameOnDestaque = true;
  /* Log TIPADO, não frase. O `text` livre montado por template string era o único canal de
     texto arbitrário do payload — e o único por onde um nome poderia chegar a um JSONB que
     vive 90 dias. O `docs/06` do jogo de origem sempre especificou `{acao, passo}` aqui; o
     código é que nunca implementou. Ver `contrato.ts` da api. */
  state.log.push({tipo:'pedra_dos_nomes', dados:{acao:'destaque', passo:entry.step}});
  blip(300,0.12,'square',0.09);
  const group = zoneMeshes['ranking'];
  if(group){
    const step = PODIUM_STEPS[entry.step];
    if(entry.tag) group.remove(entry.tag);
    const tag = nameplateSprite(playerLabel(), {width:1.15});
    tag.position.set(step.x, step.h + 0.3, step.z);
    group.add(tag);
    entry.tag = tag;
  }
}

/* Score motivates the Objetivo Principal and nothing else. Ato Opcional pays ZERO —
   the moment helping a villager or lighting a lamp is worth points, the instrument stops
   reading who cares and starts reading who chases a number. What replaces the incentive is
   the Chamado: the villager calls, the dark lamp darkens its corner. The world asks.
   See docs/adr/0001-ato-opcional-nao-pontua.md */
const SCORE = { fire:100, flame:50, rock:10, optional:0 };

function addScore(kind){
  state.score += SCORE[kind] || 0;
  const el = document.getElementById('scoreTotal');
  el.textContent = state.score;
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}

/* A tally of what has happened, never of what is missing. Each row only appears once the
   child has done that thing at least once, and it never shows a denominator — so it reads
   as "look what you did", not "three left to collect". */
function updateTally(){
  /* Only the Objetivo Principal is counted here. Aldeão, Lampião and História left this
     list on purpose: a visible counter on a free choice is a scoreboard wearing a costume,
     and it pushes her to raise the number instead of doing the thing. */
  const rows = [
    {n: state.crystalsMined, icon:'⛏️', word:'pedras quebradas', one:'pedra quebrada'}
  ].filter(r => r.n > 0);
  document.getElementById('tally').innerHTML = rows.map(r =>
    `<div class="tally-item">${r.icon} <b>${r.n}</b> ${r.n === 1 ? r.one : r.word}</div>`).join('');
}
