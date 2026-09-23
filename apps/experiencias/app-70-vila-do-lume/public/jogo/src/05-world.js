/* Vila do Lume — sinalização que atravessa a névoa e construção das zonas

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ============ SINALIZAÇÃO QUE ATRAVESSA A NÉVOA ============
   Com fogFar=20 e conteúdo até r=30, nada é visível de longe por padrão. Estes marcadores
   usam material.fog = false: aparecem a qualquer distância, mas pequenos pela perspectiva —
   dão direção, nunca leitura precisa. É o oposto de um HUD: está no mundo, e some quando
   você chega perto.

   A altura cresce com o raio de propósito. Zona longe é CARA de alcançar e FÁCIL de avistar;
   perto é barata e fácil. Assim o esforço fica constante e o que a criança decide é QUANDO
   ir, nunca se vai conseguir achar. Se achar também fosse o custo, o probe estaria medindo
   busca espacial — que é das habilidades que mais variam entre 6 e 13 anos, e a criança
   mais nova sairia do painel parecendo menos determinada quando é só menor.
   Ver GRILL-2026-08-20-mundo.md Q7 e CLAUDE.md. */
function beaconFor(z, group){
  const r = Math.hypot(z.pos.x, z.pos.z);
  const h = 3 + Math.max(0, r - 10) * 0.42;      // r=10 -> 3, r=29 -> 11
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.14, h, 5),
    new THREE.MeshBasicMaterial({color:0x2E2A28, fog:false})
  );
  mast.position.y = h/2;
  group.add(mast);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.95),
    new THREE.MeshBasicMaterial({color:z.color, fog:false, side:THREE.DoubleSide, transparent:true, opacity:0.9})
  );
  flag.position.set(0.8, h - 0.7, 0);
  group.add(flag);
  z.beaconFlag = flag;

  /* O nome do lugar, legível de longe. Sem a bússola da HUD, o Lume dizia "eu começava
     pelo Mural de Recados" e a criança não tinha como saber qual dos mastros era o Mural —
     indicação inútil. A placa resolve sem devolver o GPS: a cor aparece de qualquer
     distância e diz "tem um lugar ali"; o nome só fica legível a partir de uns 26, o que
     ainda obriga a ir olhar. */
  const plate = nameplateSprite(z.label.toUpperCase(), {width:4.2, maxFont:40});
  plate.material.fog = false;
  plate.position.y = h + 1.1;
  group.add(plate);
  z.beaconPlate = plate;

  // brasa fria no topo: acende junto com a fogueira, marcando o que já foi feito de longe
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 8, 8),
    new THREE.MeshBasicMaterial({color:0x2A2A35, fog:false})
  );
  tip.position.y = h + 0.2;
  group.add(tip);
  z.beaconTip = tip;
}

function buildZone(z){
  const group = new THREE.Group();
  const builder = STRUCTURE_BUILDERS[z.id] || STRUCTURE_BUILDERS.loja;
  const { core, labelY, labelZ } = builder(group, z);
  z.baseMesh = core;

  const label = emojiSprite(z.icon, 1.5);
  label.position.y = labelY;
  label.position.z = labelZ;
  group.add(label);

  // torch (glow marker, brighter light only when it's the active target — perf)
  const torch = mkBox(0.16,0.5,0.16, 0x2A2118, false);
  torch.position.set(1.5, 1.5, -1.5);
  group.add(torch);
  /* Aqui havia uma PointLight por zona, acesa só quando a zona era o alvo da bússola.
     A bússola saiu, e ela virou 8 luzes que ninguém lê — em Lambert cada luz entra no
     shader de TODOS os materiais, então luz apagada custa quase o mesmo que acesa. Um
     material emissivo faz o mesmo trabalho visual por zero custo de iluminação. */
  torch.material = new THREE.MeshBasicMaterial({color:0x4A3A28});
  z.torchMarker = torch;

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15,0.15,14,6),
    new THREE.MeshBasicMaterial({color:0xFFD84A, transparent:true, opacity:0.5})
  );
  beacon.position.y = 8;
  beacon.visible = false;
  group.add(beacon);
  z.beaconMesh = beacon;

  // The fragment itself: dark and inert until the child lights this spot with a torch
  // they mined and placed. It is never collected by walking up and pressing a button.
  if(z.id !== 'espelho'){
    /* Every landmark gets its own brazier: a stone bowl of unlit wood standing in front of
       the structure. It is the one and only thing you light here, and lighting it is what
       releases that landmark's mirror shard \u2014 cause and reward in the same spot. */
    const BZ = 2.2; // brazier sits just in front of the structure
    const bowl = mkMesh(new THREE.CylinderGeometry(0.42,0.30,0.34,8), 0x4A4550);
    bowl.position.set(0, 0.5, BZ);
    group.add(bowl);
    const stem = mkMesh(new THREE.CylinderGeometry(0.13,0.18,0.36,6), 0x3A3540);
    stem.position.set(0, 0.18, BZ);
    group.add(stem);

    const logs = new THREE.Group();
    [[0.16,0,0.5],[-0.16,0,-0.5],[0,0.06,0]].forEach(([lx,ly,rot],i) => {
      const log = mkBox(0.42,0.11,0.11, 0x3A2214, false);
      log.position.set(lx, 0.7+ly, BZ);
      log.rotation.y = i * 1.05;
      logs.add(log);
    });
    group.add(logs);

    const flame = mkMesh(new THREE.ConeGeometry(0.28, 0.85, 6), 0xFF8A2E, false, {emissive:0x000000, transparent:true, opacity:0.95});
    flame.position.set(0, 1.15, BZ);
    flame.visible = false;
    group.add(flame);
    const flameLight = new THREE.PointLight(0xFFB25C, 0, 11, 2);
    flameLight.position.set(0, 1.4, BZ);
    group.add(flameLight);

    const bTag = emojiSprite('\ud83d\udd25', 0.5);
    bTag.position.set(0, 1.9, BZ);
    group.add(bTag);

    /* A small ring of standing stones around each brazier — the same shape as the great
       Fogo Sagrado at the village centre, just smaller. Without a word of text it says
       "this fire is a child of that one", which is exactly the story. */
    const ring = new THREE.Group();
    for(let i=0;i<8;i++){
      const a = (i/8)*Math.PI*2;
      const st = mkBox(0.26, 0.3 + (i%3)*0.09, 0.26, 0x4A4550);
      st.position.set(Math.cos(a)*1.5, 0.15, BZ + Math.sin(a)*1.5);
      st.rotation.y = a;
      ring.add(st);
    }
    group.add(ring);

    const mark = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.42, 28),
      new THREE.MeshBasicMaterial({color:0xFF8A2E, transparent:true, opacity:0.12, side:THREE.DoubleSide, depthWrite:false})
    );
    mark.rotation.x = -Math.PI/2;
    mark.position.set(0, 0.05, BZ);
    group.add(mark);

    // wooden sign naming the place, so the player always knows where they are
    const SIGN_W = 2.6;
    const signPost = mkBox(0.12, 1.5, 0.12, 0x5E3B1C);
    signPost.position.set(2.05, 0.75, BZ - 0.7);
    group.add(signPost);
    const board = mkBox(SIGN_W, SIGN_W * 0.235, 0.09, 0x7A5230);
    board.position.set(2.05, 1.62, BZ - 0.7);
    group.add(board);
    const frameTop = mkBox(SIGN_W + 0.1, 0.07, 0.12, 0x5E3B1C, false);
    frameTop.position.set(2.05, 1.62 + SIGN_W*0.135, BZ - 0.7);
    group.add(frameTop);
    const frameBot = frameTop.clone();
    frameBot.position.y = 1.62 - SIGN_W*0.135;
    group.add(frameBot);
    const nameTag = nameplateSprite(z.label.toUpperCase(), {width: SIGN_W - 0.18, plate:false});
    nameTag.position.set(2.05, 1.62, BZ - 0.63);
    group.add(nameTag);

    z.brazier = {bowl, logs, flame, flameLight, tag:bTag, ring, mark, lit:false};
    z.brazierWorld = {x: z.pos.x, z: z.pos.z + BZ};

    // the shard is born from the fire \u2014 hidden until the brazier is lit
    const shard = mkMesh(new THREE.ConeGeometry(0.26, 0.62, 6), 0xFFC24A, false, {emissive:0x8a4a00});
    shard.rotation.set(0, 0, 0);
    shard.position.set(0, 2.6, BZ);
    shard.visible = false;
    group.add(shard);
    z.fragMesh = shard;
    z.fragRestY = 2.1;
    z.fragWorld = {x: z.pos.x, z: z.pos.z + BZ};
    z.fragLit = false;
  }

  group.position.set(z.pos.x, 0, z.pos.z);
  scene.add(group);
  zoneMeshes[z.id] = group;
}

function buildBit(){
  bitGroup = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), new THREE.MeshLambertMaterial({color:0xFFD84A}));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.36,0.36), new THREE.MeshLambertMaterial({color:0xFFF2C0}));
  head.position.y = 0.45;
  const eyeMat = new THREE.MeshBasicMaterial({color:0x1c1818});
  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.05), eyeMat);
  eyeL.position.set(-0.09,0.45,0.19);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.09;
  bitGroup.add(body, head, eyeL, eyeR);
  bitGroup.position.set(LUME_HOME.x, 1.15, LUME_HOME.z);
  scene.add(bitGroup);

  // A warm lamp plus a tall beacon. Both ignore fog on purpose — Lume has to be findable
  // from anywhere in the dark village, and the fog was swallowing him whole.
  const glow = new THREE.PointLight(0xFFD84A, 2.6, 22, 2);
  glow.position.y = 0.4;
  bitGroup.add(glow);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.3, 26, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color:0xFFD84A, transparent:true, opacity:0.32,
      side:THREE.DoubleSide, depthWrite:false, fog:false
    })
  );
  column.position.set(LUME_HOME.x, 13, LUME_HOME.z);
  scene.add(column);
  bitBeacon = column;

  // ground ring marking Lume's spot
  const pad = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.7, 24),
    new THREE.MeshBasicMaterial({color:0xFFD84A, transparent:true, opacity:0.4, side:THREE.DoubleSide, depthWrite:false, fog:false})
  );
  pad.rotation.x = -Math.PI/2;
  pad.position.set(LUME_HOME.x, 0.06, LUME_HOME.z);
  scene.add(pad);

  const talkIcon = emojiSprite('💬', 1.1);
  talkIcon.material.fog = false;
  talkIcon.material.depthTest = false;
  talkIcon.position.y = 1.5;
  bitGroup.add(talkIcon);
  bitTalkIcon = talkIcon;
}
