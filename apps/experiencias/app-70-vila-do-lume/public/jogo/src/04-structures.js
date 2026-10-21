/* Vila do Lume — uma estrutura distinta por zona, reconhecível pela silhueta

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ---- one distinct structure per zone, so each is recognizable by silhouette ---- */
const STRUCTURE_BUILDERS = {

  loja(group, z){ // market stall with a spinning item on a pedestal
    const counter = mkBox(2.4, 1.0, 1.4, z.color);
    counter.position.y = 0.5;
    group.add(counter);
    [[-1.05,-0.55],[1.05,-0.55]].forEach(([px,pz]) => {
      const post = mkBox(0.18, 2.2, 0.18, WOOD);
      post.position.set(px, 1.1, pz);
      group.add(post);
    });
    const awning = mkBox(2.6, 0.18, 1.7, 0xC94F4F);
    awning.position.y = 2.25;
    group.add(awning);
    const pedestal = mkMesh(new THREE.CylinderGeometry(0.35,0.4,0.15,8), STONE);
    pedestal.position.set(0, 1.08, 0);
    group.add(pedestal);
    const item = mkMesh(new THREE.OctahedronGeometry(0.32), 0xFFD84A, true, {emissive:0x554000});
    item.position.set(0, 1.65, 0);
    item.userData.spin = true;
    group.add(item);
    spinMeshes.push(item);
    return { core: counter, labelY: 2.7, labelZ: 0.9 };
  },

  praca(group, z){ // open plaza: bench, lamp post, tree — no walls
    const bench = mkBox(1.6, 0.4, 0.55, z.color);
    bench.position.y = 0.4;
    group.add(bench);
    [[-0.65],[0.65]].forEach(([px]) => {
      const leg = mkBox(0.14, 0.4, 0.5, WOOD);
      leg.position.set(px, 0.2, 0);
      group.add(leg);
    });
    const trunk = mkMesh(new THREE.CylinderGeometry(0.16,0.2,1.6,6), WOOD);
    trunk.position.set(-1.4, 0.8, 1.2);
    group.add(trunk);
    const foliage = mkMesh(new THREE.IcosahedronGeometry(0.75,0), 0x3F8F3F);
    foliage.position.set(-1.4, 1.95, 1.2);
    group.add(foliage);
    const lampPost = mkMesh(new THREE.CylinderGeometry(0.06,0.06,2.2,6), 0x2E2A28);
    lampPost.position.set(1.3, 1.1, 1.1);
    group.add(lampPost);
    const lampGlow = mkMesh(new THREE.SphereGeometry(0.18,8,8), 0xFFE9A8, false, {emissive:0x664400});
    lampGlow.position.set(1.3, 2.25, 1.1);
    group.add(lampGlow);
    return { core: bench, labelY: 2.9, labelZ: 0 };
  },

  mural(group, z){ // corkboard on two posts with pinned notes
    [[-1.1],[1.1]].forEach(([px]) => {
      const post = mkBox(0.16, 2.6, 0.16, WOOD);
      post.position.set(px, 1.3, 0);
      group.add(post);
    });
    const board = mkBox(2.2, 1.4, 0.12, z.color);
    board.position.y = 1.9;
    group.add(board);
    const papers = [[-0.55,0.25,0xF3ECD8],[0.15,-0.1,0xFFD84A],[0.55,0.3,0xE8D9B0]];
    papers.forEach(([px,py,c]) => {
      const paper = mkBox(0.35,0.45,0.03,c,false);
      paper.position.set(px, 1.9+py, 0.1);
      paper.rotation.z = (Math.random()-0.5)*0.3;
      group.add(paper);
    });
    return { core: board, labelY: 2.95, labelZ: 0.3 };
  },

  arena(group, z){ // mini colosseum ring
    const floor = mkMesh(new THREE.CylinderGeometry(1.6,1.6,0.08,16), z.color);
    floor.position.y = 0.04;
    group.add(floor);
    for(let i=0;i<10;i++){
      const ang = (i/10)*Math.PI*2;
      const seg = mkBox(0.5,0.55,0.22, STONE);
      seg.position.set(Math.cos(ang)*1.6, 0.3, Math.sin(ang)*1.6);
      seg.rotation.y = ang;
      group.add(seg);
    }
    [[-1.6],[1.6]].forEach(([px]) => {
      const pole = mkMesh(new THREE.CylinderGeometry(0.05,0.05,2.4,6), 0x2E2A28);
      pole.position.set(px, 1.2, 0);
      group.add(pole);
      const flag = mkBox(0.5,0.35,0.03, 0x8F4FC9, false);
      flag.position.set(px + (px>0?-0.28:0.28), 2.05, 0);
      group.add(flag);
    });
    return { core: floor, labelY: 3.0, labelZ: 0 };
  },

  cabine(group, z){ // narrow video-call booth
    const body = mkBox(1.0, 2.3, 0.9, z.color);
    body.position.y = 1.15;
    group.add(body);
    const screen = mkBox(0.7, 1.2, 0.06, 0x14121A, false);
    screen.position.set(0, 1.4, 0.48);
    group.add(screen);
    const antenna = mkMesh(new THREE.CylinderGeometry(0.03,0.03,0.9,5), 0x2E2A28);
    antenna.position.set(0, 2.75, 0);
    group.add(antenna);
    const antennaTip = mkMesh(new THREE.SphereGeometry(0.08,6,6), 0xFF5C5C, false, {emissive:0x550000});
    antennaTip.position.set(0, 3.2, 0);
    group.add(antennaTip);
    return { core: body, labelY: 3.5, labelZ: 0.55 };
  },

  portal(group, z){ // stone archway with a glowing shimmer inside
    [[-0.9],[0.9]].forEach(([px]) => {
      const pillar = mkBox(0.4, 2.6, 0.4, 0x2A2A35);
      pillar.position.set(px, 1.3, 0);
      group.add(pillar);
    });
    const lintel = mkBox(2.2, 0.4, 0.4, 0x2A2A35);
    lintel.position.y = 2.8;
    group.add(lintel);
    const glow = mkMesh(new THREE.CircleGeometry(0.85, 16), z.color, false, {emissive:0x1a3f30, transparent:true, opacity:0.85});
    glow.position.set(0, 1.5, 0);
    glow.userData.spin = true;
    group.add(glow);
    spinMeshes.push(glow);
    return { core: glow, labelY: 3.5, labelZ: 0 };
  },

  duelo(group, z){ // raised fighting platform with practice dummies
    const platform = mkBox(2.6, 0.3, 2.6, z.color);
    platform.position.y = 0.15;
    group.add(platform);
    [[-0.9,-0.9],[0.9,0.9]].forEach(([px,pz]) => {
      const torso = mkBox(0.32,0.7,0.22, 0xC9A24F);
      torso.position.set(px, 0.65, pz);
      group.add(torso);
      const head = mkBox(0.24,0.24,0.24, 0xE8D9B0);
      head.position.set(px, 1.12, pz);
      group.add(head);
    });
    return { core: platform, labelY: 2.1, labelZ: 0 };
  },

  ranking(group, z){ // tall billboard over a 3-step podium
    const post = mkMesh(new THREE.CylinderGeometry(0.12,0.12,2.4,6), 0x2E2A28);
    post.position.set(0, 1.2, -0.9);
    group.add(post);
    const board = mkBox(1.7, 1.3, 0.12, z.color);
    board.position.set(0, 2.5, -0.9);
    group.add(board);
    PODIUM_STEPS.forEach((sp, i) => {
      const step = mkBox(0.7, sp.h, 0.5, STONE);
      step.position.set(sp.x, sp.h/2, sp.z);
      group.add(step);
      const tag = nameplateSprite(LEADERBOARD[i].name, {width:1.15});
      tag.position.set(sp.x, sp.h + 0.3, sp.z);
      group.add(tag);
      LEADERBOARD[i].tag = tag;
    });
    // the Borda: a low empty slab in front, with room for exactly one more name
    const borda = mkBox(1.5, BORDA_SPOT.h, 0.62, 0x5A5652);
    borda.position.set(BORDA_SPOT.x, BORDA_SPOT.h/2, BORDA_SPOT.z);
    group.add(borda);
    const bordaTag = nameplateSprite('· · · · · · ·', {width:1.3, color:'#9B94A8'});
    bordaTag.position.set(BORDA_SPOT.x, BORDA_SPOT.h + 0.26, BORDA_SPOT.z);
    group.add(bordaTag);
    z.bordaTag = bordaTag;
    return { core: board, labelY: 3.4, labelZ: -0.9 };
  },

  espelho(group, z){ // the great central fire pit — dead and cold until the finale
    // ring of standing stones
    for(let i=0;i<10;i++){
      const a = (i/10)*Math.PI*2;
      const st = mkBox(0.5, 0.7 + (i%3)*0.18, 0.5, 0x4A4550);
      st.position.set(Math.cos(a)*2.3, 0.35, Math.sin(a)*2.3);
      st.rotation.y = a;
      group.add(st);
    }
    // big stacked logs waiting to burn
    const pyre = new THREE.Group();
    for(let i=0;i<6;i++){
      const a = (i/6)*Math.PI;
      const log = mkBox(3.0, 0.28, 0.28, 0x3A2214);
      log.position.set(0, 0.35 + (i%2)*0.3, 0);
      log.rotation.y = a;
      pyre.add(log);
    }
    group.add(pyre);
    const core = mkMesh(new THREE.ConeGeometry(1.1, 2.0, 8), 0xFF8A2E, false, {emissive:0x000000, transparent:true, opacity:0.9});
    core.position.y = 1.5;
    core.visible = false;
    group.add(core);
    z.pyre = pyre;
    return { core, labelY: 3.4, labelZ: 0 };
  }
};
