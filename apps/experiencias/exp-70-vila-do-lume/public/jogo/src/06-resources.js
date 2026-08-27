/* Vila do Lume — pedras, lampiões e brinquedos — a economia visível

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ===================== MINE -> LIGHT -> CLAIM =====================
   The Minecraft-native loop. Crystal veins are mined (hold left click), the crystals
   become torches (right click to place), torches push back the dark, and a Mirror
   fragment only wakes up once its spot is lit. Nothing here is a menu; every value
   signal is read from HOW the child does this, never from a question. */

const VEIN_POSITIONS = [
  // miolo — o que ela encontra sem procurar
  {x:6.34, z:2.96},   {x:-2.74, z:7.52},   {x:-7.24, z:-1.94},  {x:2.74, z:-7.52},
  {x:6.0, z:10.39},   {x:-11.26, z:6.5},   {x:-8.84, z:-8.84},  {x:12.22, z:-4.45},
  // faixa média
  {x:18.35, z:4.92},  {x:-3.47, z:19.7},   {x:-17.32, z:10.0}, {x:-19.92, z:1.74},
  // periferia — atrás da Crista e nos cantos, só acha quem foi olhar
  {x:16.71, z:19.92}, {x:-17.36, z:20.68}, {x:-21.65, z:-12.5}, {x:14.0, z:-24.25}
];
const veins = [];
/* Ember rock: a chunky opaque black cube speckled with glowing orange coal. Deliberately
   NOT a floating gem \u2014 the thing you mine and the thing you collect must never share a
   silhouette. Coal makes fire, fire makes torches: the logic explains itself. */
function buildVeins(){
  VEIN_POSITIONS.forEach(p => {
    const rock = mkMesh(new THREE.BoxGeometry(1.0,1.0,1.0), 0x1E1A22);
    rock.position.set(p.x, 0.5, p.z);
    scene.add(rock);

    const embers = new THREE.Group();
    [[-0.22,0.18,0.5],[0.26,-0.1,0.5],[0.05,0.3,0.5],
     [0.5,0.1,0.2],[-0.5,-0.05,-0.15],[0.1,0.5,-0.25]].forEach(([ex,ey,ez]) => {
      const e = mkMesh(new THREE.BoxGeometry(0.16,0.16,0.06), 0xFF7A2E, false, {emissive:0x8a2f00});
      e.position.set(p.x + ex, 0.5 + ey, p.z + ez);
      embers.add(e);
    });
    scene.add(embers);

    const tag = emojiSprite('\u26cf\ufe0f', 0.5);
    tag.position.set(p.x, 1.6, p.z);
    scene.add(tag);
    veins.push({rock, gem:embers, tag, pos:p, mined:false, progress:0, baseY:1.15, phase:Math.random()*Math.PI*2});
  });
}

/* Village lamps: broken lampposts scattered between the landmarks. Lighting one costs a
   spark and gives absolutely nothing back — no Tocha, no progress, no counter. It only
   makes that corner of the village less dark for whoever passes later. That is the whole
   point: it is the cleanest reading of Universalism the game can produce, because the
   benefit is entirely other people's. */
/* Four of the six lamps sit 3 units from a stranded Aldeão — those four pairs are the
   Dilemas. The two on the 0°/180° spokes have no villager near them and stay as controls:
   Universalismo with nothing competing for the Tocha. The paired lamps deliberately avoid
   the spokes where a landmark sits, so the villager never reads as part of a zone. */
const LAMP_POSITIONS = [
  // pares visíveis, no caminho — o controle
  {x:-9.01,  z:-6.31, pair:0}, {x:6.5,   z:-11.26, pair:1},
  // pares atrás da Crista — só existem pra quem foi atrás do sinal
  {x:-4.92,  z:18.35, pair:2}, {x:-17.82, z:2.51,  pair:3},
  // lampiões sem Aldeão por perto: Universalismo sem nada disputando a Tocha
  {x:8.43,   z:-7.07},         {x:10.61, z:10.61}
];
/* Cada Aldeão fica 3 unidades para fora do seu Lampião, no mesmo raio — os dois entram no
   enquadramento juntos, que é o que transforma duas tarefas num Dilema. Dois pares ficam
   na rota normal; dois ficam além da Crista, e só são encontrados por quem seguiu o sinal
   de fumaça. Ver GRILL-2026-08-20-mundo.md Q9. */
const VILLAGER_SPOTS = [
  {x:-11.47, z:-8.03,  pair:0, hidden:false},
  {x:8.0,    z:-13.86, pair:1, hidden:false},
  {x:-5.69,  z:21.25,  pair:2, hidden:true},
  {x:-20.8,  z:2.92,   pair:3, hidden:true}
];

const lamps = [];
function buildLamps(){
  LAMP_POSITIONS.forEach(p => {
    const g = new THREE.Group();
    const post = mkBox(0.13, 2.1, 0.13, 0x3A3540);
    post.position.y = 1.05;
    const arm = mkBox(0.5, 0.11, 0.11, 0x3A3540);
    arm.position.set(0.2, 2.05, 0);
    const glass = mkMesh(new THREE.BoxGeometry(0.34,0.42,0.34), 0x2A2A35, false, {emissive:0x000000, transparent:true, opacity:0.85});
    glass.position.set(0.4, 1.82, 0);
    g.add(post, arm, glass);
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    /* Sem PointLight: vidro emissivo + um decalque claro no chão. No escuro a leitura é
       praticamente a mesma, e custa zero no shader. Orçamento de PC de escola pública —
       o gargalo aqui é luz, não geometria. */
    const decal = mkMesh(new THREE.RingGeometry(0.5, 4.6, 14), 0xFFD9A0, false, {transparent:true, opacity:0});
    decal.rotation.x = -Math.PI/2;
    decal.position.set(p.x + 0.4, 0.04, p.z);
    scene.add(decal);
    lamps.push({group:g, glass, decal, pos:p, lit:false, pair:p.pair});
  });
}

/* Oportunidade Percebida — a Chamado reached her. `observed` in the profile used to mean
   "scored", which made one accidental bell tap mathematically WORSE than never touching
   one: the tap dragged the pole down, the silence dropped out of the average. Now silence
   only counts against a value if she was actually within earshot of the thing. */
/**
 * Registra que o Chamado de um valor ALCANÇOU a criança — e conta oportunidades
 * DISTINTAS, não quadros de animação.
 *
 * A maioria das chamadas vive dentro de `updateOpportunities()`, que roda a cada frame.
 * Sem o `fonte`, uma criança parada perto de um aldeão somava mais de dois mil em
 * Benevolência enquanto Segurança somava trinta e seis — números que iam para o banco
 * parecendo contagem de oportunidades e eram, na verdade, contagem de frames e uma
 * medida de quanto tempo ela ficou parada em cada lugar.
 *
 * `fonte` identifica QUEM ofereceu a oportunidade (este lampião, aquele aldeão). Cada par
 * valor+fonte conta uma vez. O que o servidor precisa é a distinção entre "teve a chance
 * e não foi" e "a chance nunca chegou", e para isso um número honesto e pequeno serve
 * melhor que um grande e falso.
 */
function markOpportunity(key, fonte){
  const id = key + '|' + (fonte == null ? '_' : fonte);
  if(state.opportunitySeen[id]) return;
  state.opportunitySeen[id] = true;
  if(!state.opportunities[key]) state.opportunities[key] = 0;
  state.opportunities[key]++;
}

/* Nothing costs sparks any more. Every Ato Opcional costs the Tocha she is carrying, and
   she can only carry one — so at a Dilema pair, serving one means walking back for the
   other. The scarcity is local and felt, instead of arithmetic in a six-year-old's head. */
const TORCH_COST_SPARKS = 1;

function lightLamp(lamp){
  if(lamp.lit) return false;
  if(!state.carryingTorch){ showSparkToast('Você precisa de uma tocha acesa. Pega fogo numa fogueira.'); return true; }
  spendTorch('lampiao');
  state.lampsLit++;
  if(lamp.pair != null) recordDilemmaChoice(lamp.pair, 'lampiao');
  updateResourceHud();
  lamp.lit = true;
  lamp.glass.material.color.set(0xFFE9B0);
  lamp.glass.material.emissive = new THREE.Color(0xC9A34A);
  lamp.decal.material.opacity = 0.18;
  torches.push({x:lamp.pos.x, z:lamp.pos.z, post:null, head:null, light:null, life:Infinity, permanent:true, optional:true, fake:true});
  blip(740,0.09,'sine',0.07);
  blip(990,0.11,'sine',0.06,0.07);
  // deliberately no praise, no counter, no toast beyond the sound: the moment the game
  // rewards this, it stops measuring generosity and starts measuring completionism
  return true;
}

/* Playthings: a bell that rings, stones that roll, a swing of dry grass. They do nothing.
   They are not counted on screen and never help you win. Touching them is pure play —
   the only honest read of Hedonism available, because there is no other reason to. */
const playthings = [];
function buildPlaythings(){
  const spots = [
    {x:3.2, z:3.2, kind:'bell'},
    {x:-3.2, z:3.2, kind:'stones'},
    {x:3.2, z:-3.2, kind:'stones'},
    {x:-3.2, z:-3.2, kind:'bell'},
    {x:7.4, z:7.4, kind:'stones'}
  ];
  spots.forEach(p => {
    const g = new THREE.Group();
    if(p.kind === 'bell'){
      const post = mkBox(0.12, 1.3, 0.12, 0x5E3B1C);
      post.position.y = 0.65;
      const bell = mkMesh(new THREE.ConeGeometry(0.24, 0.36, 8), 0xC9A24F);
      bell.position.y = 1.2;
      bell.rotation.x = Math.PI;
      g.add(post, bell);
      g.userData.swing = bell;
    } else {
      for(let i=0;i<4;i++){
        const st = mkMesh(new THREE.DodecahedronGeometry(0.2), 0x6E6A66);
        st.position.set((Math.random()-0.5)*0.9, 0.2 + i*0.03, (Math.random()-0.5)*0.9);
        g.add(st);
      }
      g.userData.swing = g.children[0];
    }
    g.position.set(p.x, 0, p.z);
    scene.add(g);
    playthings.push({group:g, pos:p, kind:p.kind, wobble:0, uses:0});
  });
}

const PLAYTHING_MAX_USES = 3;
function playWith(t){
  t.wobble = 1;
  /* Each plaything counts at most three times. Before this guard a child could stand at one
     bell and farm it forever — the loudest Hedonism signal in the game was a stuck key. */
  if(t.uses < PLAYTHING_MAX_USES){
    t.uses++;
    state.playfulActs++;
  }
  if(t.kind === 'bell'){
    blip(880,0.22,'sine',0.07); blip(1174,0.3,'sine',0.05,0.08);
  } else {
    blip(220 + Math.random()*120, 0.09, 'square', 0.06);
    t.group.children.forEach(st => {
      st.position.x += (Math.random()-0.5)*0.5;
      st.position.z += (Math.random()-0.5)*0.5;
    });
  }
}

/* Every value needs to know whether the child ever had the CHANCE to show it. Without
   this, `observed` meant "scored", and silence was indistinguishable from absence — so a
   child who never walked near a bell was treated exactly like one who chose not to ring it.
   The panel now says "não observado" only when the chance genuinely never arrived. */
/* A placa do mastro aparece por proximidade: some de longe (senão o mapa inteiro se
   entrega de uma vez e a procura acaba) e fica sólida perto o bastante pra confirmar que
   ela chegou no lugar certo. */
/* A placa do mastro cobre só a faixa do meio. Longe demais ela some (senão o mapa inteiro
   se entrega de uma vez e a procura acaba); perto demais ela também some, porque aí o
   letreiro da própria estrutura já está legível e os dois juntos poluem a tela com o
   mesmo nome escrito duas vezes. */
const PLATE_FAR = 34, PLATE_NEAR = 22, PLATE_CLOSE = 18, PLATE_GONE = 12;
function updateBeaconPlates(){
  if(!controls) return;
  const o = controls.getObject();
  zones.forEach(z => {
    if(!z.beaconPlate) return;
    const d = Math.hypot(o.position.x - z.pos.x, o.position.z - z.pos.z);
    const fadeIn  = 1 - Math.min(1, Math.max(0, (d - PLATE_NEAR) / (PLATE_FAR - PLATE_NEAR)));
    const fadeOut = Math.min(1, Math.max(0, (d - PLATE_GONE) / (PLATE_CLOSE - PLATE_GONE)));
    const t = Math.min(fadeIn, fadeOut);
    z.beaconPlate.material.opacity = t;
    z.beaconPlate.visible = t > 0.02;
  });
}

function updateOpportunities(dt){
  if(!controls || !playing) return;
  const o = controls.getObject();

  // the dark middle and the open map are available from the first second
  markOpportunity('selfDirection');
  markOpportunity('stimulation');
  markOpportunity('achievement');
  if(zones.some(z => z.brazier && z.brazier.lit)) markOpportunity('security');
  if(state.suggestedZone) markOpportunity('conformity');

  playthings.forEach(t => {
    if(Math.hypot(o.position.x - t.pos.x, o.position.z - t.pos.z) < 5) markOpportunity('hedonism', t.id ?? (t.pos.x+','+t.pos.z));
  });

  /* Chamado of the lamp: a dark lamp pulses its unlit glass when she is close, and the
     corner around it stays visibly black. No counter, no arrow — just the hole in the light. */
  lamps.forEach(l => {
    if(l.lit) return;
    const d = Math.hypot(o.position.x - l.pos.x, o.position.z - l.pos.z);
    if(d < 7){
      markOpportunity('universalism', l.pos.x + ',' + l.pos.z);
      const pulse = 0.35 + Math.sin(performance.now()*0.004)*0.25;
      l.glass.material.emissive.setRGB(pulse*0.12, pulse*0.09, pulse*0.02);
    } else if(!l.lit){
      l.glass.material.emissive.setRGB(0,0,0);
    }
  });
}

function updatePlaythings(dt){
  playthings.forEach(t => {
    if(t.wobble > 0){
      t.wobble -= dt * 2.2;
      const w = Math.max(0, t.wobble);
      if(t.group.userData.swing) t.group.userData.swing.rotation.z = Math.sin(performance.now()*0.02) * 0.5 * w;
    }
  });
}
