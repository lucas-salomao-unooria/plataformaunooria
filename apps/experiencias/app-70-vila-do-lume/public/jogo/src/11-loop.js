/* Vila do Lume — game loop: movimento, mineração, proximidade, interação

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ============================ GAME LOOP ============================ */
function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  frameMoveLen = 0;
  if(playing && controls.isLocked){
    const obj = controls.getObject();
    /* 4,5 u/s — a velocidade de andar do Minecraft, que é a escala que os blocos 1x1 já
       prometem. A 7 ela atravessava a vila inteira em 3,7s e nada parecia longe; procurar
       era só girar a câmera. Ver GRILL-2026-08-20-mundo.md Q4. */
    const speed = 4.5;
    const dir = new THREE.Vector3();
    controls.getDirection(dir);
    dir.y = 0; dir.normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    let move = new THREE.Vector3();
    if(keys['KeyW']) move.add(dir);
    if(keys['KeyS']) move.sub(dir);
    if(keys['KeyD']) move.add(right);
    if(keys['KeyA']) move.sub(right);
    if(move.lengthSq() > 0){
      move.normalize().multiplyScalar(speed*dt);
      const feetY = obj.position.y - EYE_HEIGHT;
      const newX = obj.position.x + move.x, newZ = obj.position.z + move.z;
      if(!collidesObstacle(newX, newZ, feetY)){
        obj.position.x = newX;
        obj.position.z = newZ;
        /* Derivado do conteúdo, nunca digitado. Esta constante era 22 e ficou para trás
           quando o mapa cresceu para r=30: Portal Secreto, Pedra dos Nomes e Campo de
           Treino ficaram fisicamente inalcançáveis, e as três são fogueiras OBRIGATÓRIAS —
           o jogo tinha virado impossível de terminar sem nenhuma mensagem de erro. */
        const dist = Math.sqrt(obj.position.x**2 + obj.position.z**2);
        if(dist > WORLD_LIMIT){ obj.position.x *= WORLD_LIMIT/dist; obj.position.z *= WORLD_LIMIT/dist; }
        frameMoveLen = move.length();
        state.distanceWalked += frameMoveLen;
      }
    }

    // jump — Space, fixed arc, no precision required, never blocks progress
    velocityY -= GRAVITY * dt;
    obj.position.y += velocityY * dt;
    if(obj.position.y <= EYE_HEIGHT){ obj.position.y = EYE_HEIGHT; velocityY = 0; }

    updateMining(dt);

    /* Passive signals — read from play, never asked. Two rules learned the hard way:
       time only counts while actually playing (overlays paused the world but not the clock),
       and standing still is not exploring (idle in the dark was scoring as bravery). */
    state.playTime += dt;
    const moving = frameMoveLen > 0.0001;
    if(moving) state.movingTime += dt; else state.idleTime += dt;

    /* The village has a lit ring road at r≈13 (the landmarks and their fires) and a dark
       middle. Crossing the middle is shorter and scarier; going round is longer and safe.
       Same destinations either way — so which one they pick is a value, not a skill. */
    if(moving){
      const r = Math.sqrt(obj.position.x**2 + obj.position.z**2);

      /* Self-direction: distance spent away from any place worth going to. Being far from
         every landmark, the centre and every rock means she is walking her own line rather
         than the efficient one. */
      let nearestGoal = Infinity;
      zones.forEach(z => {
        const d = Math.hypot(obj.position.x - z.pos.x, obj.position.z - z.pos.z);
        if(d < nearestGoal) nearestGoal = d;
      });
      veins.forEach(v => {
        if(v.mined) return;
        const d = Math.hypot(obj.position.x - v.pos.x, obj.position.z - v.pos.z);
        if(d < nearestGoal) nearestGoal = d;
      });
      if(nearestGoal > 5 && r > 3) state.detourDistance += frameMoveLen;

      /* The dark middle stops at r=6, not r=8. The inner vein ring sits at r≈7.04, so the
         old band made mining the mandatory economy indistinguishable from bravely crossing
         the dark — the Stimulation probe was reading the Objetivo Principal. Standing at a
         rock is excluded outright for the same reason. */
      const inMiddle = r < 6 && !nearAnyVein(obj.position.x, obj.position.z, 2.5);
      if(inMiddle && !isLit(obj.position.x, obj.position.z)){
        state.darkCrossTime += dt;
        if(!state.inDarkCross){ state.inDarkCross = true; state.shortcutsTaken++; }
      } else {
        state.inDarkCross = false;
        // only world light counts here — lamps she lit herself are an Ato Opcional, not caution
        /* A faixa era `r > 10 && r < 17`, congelada do mundo antigo: com as zonas indo até
           r=29, metade da vila ficava invisível para a probe de Segurança — andar pela luz
           lá fora não contava nada. O complemento de `inMiddle` é a definição certa: fora
           do miolo escuro, sob luz do mundo. */
        if(r >= 6 && isLitByWorld(obj.position.x, obj.position.z)) state.litPathTime += dt;
      }
    }

    const radius = Math.sqrt(obj.position.x**2 + obj.position.z**2);
    if(radius > state.maxRadius) state.maxRadius = radius;

    // map coverage: which cells of the grid the child actually set foot in
    const cell = coverageCell(obj.position.x, obj.position.z);
    if(cell !== null) state.cellVisits[cell] = (state.cellVisits[cell] || 0) + dt;

    // dark time only counts while moving — a stuck player is not a brave explorer
    if(moving && !isLit(obj.position.x, obj.position.z)) state.timeInDark += dt;
  }

  /* Lume stays put by the Fogo Sagrado in the village centre. Never follows, never blocks the
     view — walking over to talk to him is a deliberate detour, which is what makes it a
     trustworthy Socializer signal instead of proximity noise. */
  if(controls && bitGroup){
    const camObj = controls.getObject();
    bitGroup.position.set(LUME_HOME.x, 1.15 + Math.sin(performance.now()*0.002)*0.13, LUME_HOME.z);
    const dx = camObj.position.x - LUME_HOME.x, dz = camObj.position.z - LUME_HOME.z;
    const near = Math.sqrt(dx*dx+dz*dz) < 9;
    // turns to face the player when they're close, idles slowly otherwise
    const wanted = near ? Math.atan2(dx, dz) : bitGroup.rotation.y + dt * 0.35;
    bitGroup.rotation.y += (wanted - bitGroup.rotation.y) * (near ? 0.08 : 1);
    if(bitBeacon) bitBeacon.material.opacity = 0.30 + Math.sin(performance.now()*0.003)*0.10;
  }

  checkProximity();
  updateZoneVisuals();
  updateHandAndFootsteps(dt);
  updateWorldGlow(dt);
  updateFootPuffs(dt);
  updateChips(dt);
  updateCinematic(dt);
  updatePickups(dt);
  updateVillagers(dt);
  updatePlaythings(dt);
  updatePodium(dt);
  updateOpportunities(dt);
  updateSmoke(dt);
  updateBeaconPlates();
  updateObjective();
  updateLumeSpeech();
  updateTorches(dt);
  spinMeshes.forEach(m => { m.rotation.y += dt * 1.1; });
  veins.forEach(v => {
    if(v.mined) return;
    const glow = 0.55 + Math.sin(performance.now()*0.004 + v.phase) * 0.45;
    v.gem.children.forEach(e => e.material.emissive.setRGB(0.54*glow, 0.18*glow, 0));
  });
  zones.forEach(z => {
    if(z.fragMesh && z.fragLit && !state.visited.includes(z.id)){
      z.fragMesh.rotation.y += dt * 1.6;
      const rest = z.fragRestY != null ? z.fragRestY : 2.1;
      if(z.fragRising){
        z.fragMesh.position.y += (rest - z.fragMesh.position.y) * Math.min(1, dt*2.2);
        if(Math.abs(z.fragMesh.position.y - rest) < 0.05) z.fragRising = false;
      } else {
        z.fragMesh.position.y = rest + Math.sin(performance.now()*0.004) * 0.12;
      }
    }
    if(z.brazier && z.brazier.lit){
      const f = 0.85 + Math.sin(performance.now()*0.012 + z.pos.x) * 0.15;
      z.brazier.flame.scale.set(f, 1/f, f);
      z.brazier.flameLight.intensity = 2.2 + Math.sin(performance.now()*0.02 + z.pos.z) * 0.4;
    }
  });
  renderer.render(scene, camera);
}

/* Mining: hold left click while the crosshair is on a vein. Deliberately chunky and
   physical — this is the verb kids already know from Minecraft. */
const miningRay = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0,0);
let miningHeld = false, miningTarget = null;

function hideMineBar(){
  const bar = document.getElementById('mineBar');
  if(bar) bar.style.display = 'none';
}

/* Crack overlay: four progressively worse fracture stages painted onto a shell that sits
   just outside the rock, exactly like the block-breaking overlay everyone knows. */
function crackTexture(stage){
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(10,8,12,0.95)';
  ctx.lineWidth = 2;
  const seeds = [
    [[32,4],[30,20],[38,30],[34,48]],
    [[4,30],[20,28],[30,34],[52,30]],
    [[10,6],[24,22],[20,40],[8,56]],
    [[54,8],[42,26],[48,42],[58,58]]
  ];
  for(let i = 0; i <= stage && i < seeds.length; i++){
    const pts = seeds[i];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(pt => ctx.lineTo(pt[0], pt[1]));
    ctx.stroke();
    if(i >= 1){
      ctx.beginPath();
      ctx.moveTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[1][0] + (i%2 ? 14 : -14), pts[1][1] + 12);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}
const CRACK_TEXTURES = [];

function ensureCrackShell(vein){
  if(vein.crack) return;
  if(!CRACK_TEXTURES.length){
    for(let i=0;i<4;i++) CRACK_TEXTURES.push(crackTexture(i));
  }
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(1.04,1.04,1.04),
    new THREE.MeshBasicMaterial({map:CRACK_TEXTURES[0], transparent:true, opacity:0, depthWrite:false})
  );
  shell.position.copy(vein.rock.position);
  scene.add(shell);
  vein.crack = shell;
}

const chips = [];
function spawnChips(pos, n, color){
  for(let i=0;i<n;i++){
    const chip = mkMesh(new THREE.BoxGeometry(0.1,0.1,0.1), color, false);
    chip.position.set(pos.x + (Math.random()-0.5)*0.6, pos.y + 0.4 + Math.random()*0.5, pos.z + (Math.random()-0.5)*0.6);
    scene.add(chip);
    chips.push({
      mesh: chip,
      vx:(Math.random()-0.5)*2.4, vy:1.6+Math.random()*1.8, vz:(Math.random()-0.5)*2.4,
      life:0.7+Math.random()*0.3
    });
  }
}

function updateChips(dt){
  for(let i=chips.length-1;i>=0;i--){
    const c = chips[i];
    c.life -= dt;
    c.vy -= 9 * dt;
    c.mesh.position.x += c.vx * dt;
    c.mesh.position.y += c.vy * dt;
    c.mesh.position.z += c.vz * dt;
    c.mesh.rotation.x += dt*6; c.mesh.rotation.y += dt*4;
    if(c.mesh.position.y < 0.05){ c.mesh.position.y = 0.05; c.vy *= -0.35; c.vx *= 0.6; c.vz *= 0.6; }
    if(c.life <= 0){ scene.remove(c.mesh); chips.splice(i,1); }
  }
}

function resetMiningTarget(){
  if(!miningTarget) return;
  miningTarget.progress = 0;
  miningTarget.rock.scale.set(1,1,1);
  miningTarget.rock.rotation.set(0,0,0);
  if(miningTarget.crack) miningTarget.crack.material.opacity = 0;
  miningTarget = null;
}

let swingTimer = 0;
const MINE_TIME = 1.1;

function updateMining(dt){
  if(!miningHeld){
    resetMiningTarget();
    hideMineBar();
    return;
  }
  miningRay.setFromCamera(screenCenter, camera);
  const meshes = veins.filter(v => !v.mined).map(v => v.rock);
  const hit = miningRay.intersectObjects(meshes, false)[0];
  if(!hit || hit.distance > 4.5){
    resetMiningTarget();
    hideMineBar();
    return;
  }
  const vein = veins.find(v => v.rock === hit.object);
  if(miningTarget && miningTarget !== vein) resetMiningTarget();
  miningTarget = vein;
  ensureCrackShell(vein);

  vein.progress += dt;
  const f = Math.min(1, vein.progress / MINE_TIME);

  const bar = document.getElementById('mineBar');
  bar.style.display = 'block';
  document.getElementById('mineBarFill').style.width = (f*100) + '%';

  // rhythmic pickaxe swings: hand punch + tick + chips fly off the face
  swingTimer -= dt;
  if(swingTimer <= 0){
    swingTimer = 0.26;
    punchHand();
    blip(180 + Math.random()*60, 0.05, 'square', 0.07);
    spawnChips(vein.rock.position, 3, 0xFF7A2E);
  }

  // crack stage deepens as the rock gives way
  const stage = Math.min(3, Math.floor(f * 4));
  if(vein.crack){
    vein.crack.material.map = CRACK_TEXTURES[stage];
    vein.crack.material.opacity = 0.15 + f * 0.75;
    vein.crack.material.needsUpdate = true;
  }

  // shake harder the closer it is to breaking
  const shake = 0.05 * f;
  vein.rock.rotation.z = Math.sin(performance.now()*0.045) * shake;
  vein.rock.rotation.x = Math.cos(performance.now()*0.037) * shake;
  const squash = 1 + Math.sin(performance.now()*0.05) * 0.09 * f;
  vein.rock.scale.set(squash, 1/squash, squash);

  if(vein.progress >= MINE_TIME) breakVein(vein);
}

function breakVein(vein){
  hideMineBar();
  vein.mined = true;
  vein.rock.visible = false;
  vein.gem.visible = false;
  vein.tag.visible = false;
  if(vein.crack) vein.crack.visible = false;
  miningTarget = null;

  // the rock bursts, then the two embers arc through the air into your hands
  spawnChips(vein.rock.position, 14, 0x1E1A22);
  spawnChips(vein.rock.position, 8, 0xFF7A2E);
  spawnPickup(vein.rock.position, 0);

  state.crystalsMined += 1;
  addScore('rock');
  blip(150,0.14,'square',0.11);
  blip(90,0.18,'sawtooth',0.08,0.03);
  showSparkToast('+1 fagulha');
}

/* Embers fly to the player before landing in the counter — the reward has to travel. */
const pickups = [];
function spawnPickup(pos, delay){
  const m = mkMesh(new THREE.OctahedronGeometry(0.2), 0xFF9A3E, false, {emissive:0x8a3a00});
  m.position.set(pos.x + (Math.random()-0.5)*0.5, pos.y + 0.5, pos.z + (Math.random()-0.5)*0.5);
  m.visible = false;
  scene.add(m);
  pickups.push({mesh:m, delay:delay||0, t:0});
}

function updatePickups(dt){
  if(!controls) return;
  const obj = controls.getObject();
  for(let i=pickups.length-1;i>=0;i--){
    const p = pickups[i];
    if(p.delay > 0){ p.delay -= dt; continue; }
    p.mesh.visible = true;
    p.t += dt;
    const dx = obj.position.x - p.mesh.position.x;
    const dy = (obj.position.y - 0.5) - p.mesh.position.y;
    const dz = obj.position.z - p.mesh.position.z;
    const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
    const speed = 3 + p.t * 9;
    p.mesh.position.x += (dx/d) * speed * dt;
    p.mesh.position.y += (dy/d) * speed * dt;
    p.mesh.position.z += (dz/d) * speed * dt;
    p.mesh.rotation.y += dt * 9;
    if(d < 0.8 || p.t > 2.2){
      scene.remove(p.mesh);
      pickups.splice(i,1);
      state.sparks++;
      updateResourceHud();
      blip(1046,0.08,'sine',0.07);
      blip(1568,0.1,'sine',0.07,0.05);
    }
  }
}

function collidesObstacle(x, z, feetY){
  const r = 0.4;
  return OBSTACLES.some(o =>
    Math.abs(x-o.x) < (o.w/2+r) && Math.abs(z-o.z) < (o.d/2+r) && feetY < o.h - 0.15
  );
}

function checkProximity(){
  if(bitTalkIcon){
    bitTalkIcon.material.opacity = 0.55 + Math.sin(performance.now()*0.004)*0.35;
  }
  if(!playing || cinematic || document.getElementById('bitOverlay').classList.contains('open')){
    document.getElementById('interactPrompt').style.display = 'none';
    nearZone = null; nearBit = false; nearChoicePoint = null; nearVillager = null; nearVein = null; nearBrazier = null; nearLamp = null; nearPodium = null; nearPlaything = null; nearReclaim = null; nearBorda = false; nearPassarela = false;
    return;
  }

  const obj = controls.getObject();

  // proximity to Lume (independent of zone gating — always talkable)
  const bdx = obj.position.x - bitGroup.position.x, bdz = obj.position.z - bitGroup.position.z;
  const bitDist = Math.sqrt(bdx*bdx + bdz*bdz);
  nearBit = bitDist < 2.4;

  const activeIds = getActiveZoneIds();
  if(!activeIds.length){
    nearZone = null; nearChoicePoint = null;
    document.getElementById('interactPrompt').style.display = nearBit ? 'block' : 'none';
    if(nearBit) document.getElementById('interactPrompt').textContent = 'E — FALAR COM O LUME';
    return;
  }
  const all = zones.concat([MIRROR]);
  const activeZones = activeIds.map(id => all.find(zz => zz.id === id));
  let z = activeZones[0], dist = Infinity;
  activeZones.forEach(az => {
    const dx = obj.position.x - az.pos.x, dz = obj.position.z - az.pos.z;
    const d = Math.sqrt(dx*dx+dz*dz);
    if(d < dist){ dist = d; z = az; }
  });

  // compass: angle between camera forward and direction to target (points at the zone,
  // navigation only — the actual choice happens at one of its physical points inside it)
  /* A bússola da HUD saiu. Ela apontava sempre a zona não visitada mais próxima, com nome
     e distância — e não só removia a procura: DESENHAVA a rota ótima, porque ir sempre na
     mais perto é percorrer o anel em ordem. Autodireção media "desvio das rotas úteis" de
     uma rota que o próprio jogo estava indicando.

     No lugar dela, o Lume. Quem quiser direção volta ao centro e pergunta. Ninguém trava:
     o centro é o único ponto que ela sempre sabe achar, e ele está sempre lá.

     O ganho de medida é grande. Conformidade era um bit — "acendeu primeiro onde o Lume
     mandou", sim ou não, uma vez. Agora é quantas vezes ela preferiu perguntar em vez de
     achar sozinha, com custo real de caminhada a cada ida, ao longo da partida inteira.
     Conformidade e Autodireção viram lados da mesma medida, que é como o circumplexo de
     Schwartz as trata. Ver GRILL-2026-08-20-mundo.md Q3. */

  if(dist < 9 && !z.introShown && z.npcLine){
    z.introShown = true;
    showZoneIntroToast(z.npcLine);
  }

  // nearest fragment — only claimable once the child has lit that spot with a torch
  nearChoicePoint = null;
  let bestFragDist = 3.0, nearFragUnlit = null;
  activeZones.forEach(az => {
    if(!az.fragWorld || state.visited.includes(az.id)) return;
    const dx = obj.position.x - az.fragWorld.x, dz = obj.position.z - az.fragWorld.z;
    const d = Math.sqrt(dx*dx+dz*dz);
    if(d < bestFragDist){
      bestFragDist = d;
      if(az.fragLit) nearChoicePoint = {zone:az};
      else nearFragUnlit = az;
    }
  });

  nearVillager = null;
  let bestVillDist = 2.0;
  villagers.forEach(v => {
    if(v.rescued) return;
    const dx = obj.position.x - v.pos.x, dz = obj.position.z - v.pos.z;
    const d = Math.sqrt(dx*dx+dz*dz);
    if(d < bestVillDist){ bestVillDist = d; nearVillager = v; }
  });

  // a crystal vein within reach: this is what was missing — the player walked up to one
  // and the screen said nothing at all
  nearVein = null;
  let bestVeinDist = 3.2;
  veins.forEach(v => {
    if(v.mined) return;
    const dx = obj.position.x - v.pos.x, dz = obj.position.z - v.pos.z;
    const d = Math.sqrt(dx*dx+dz*dz);
    if(d < bestVeinDist){ bestVeinDist = d; nearVein = v; }
  });

  /* A lit Fogueira stays in range: unlit it wants a spark, lit it hands out a Tocha. It
     used to drop out of proximity the moment it caught, which left nowhere to take fire
     from once the village was burning — and the Tocha economy needs a source. */
  nearBrazier = null;
  let bestBzDist = 3.0;
  zones.forEach(z => {
    if(!z.brazier) return;
    const dx = obj.position.x - z.brazierWorld.x, dz = obj.position.z - z.brazierWorld.z;
    const d = Math.sqrt(dx*dx+dz*dz);
    if(d < bestBzDist){ bestBzDist = d; nearBrazier = z; }
  });

  nearReclaim = null;
  let bestReclaimDist = 2.0;
  villagerTorches.forEach(t => {
    if(t.taken) return;
    const dx = obj.position.x - t.x, dz = obj.position.z - t.z;
    const d = Math.sqrt(dx*dx+dz*dz);
    if(d < bestReclaimDist){ bestReclaimDist = d; nearReclaim = t; }
  });

  nearPlaything = null;
  let bestToyDist = 1.9;
  playthings.forEach(t => {
    const dx = obj.position.x - t.pos.x, dz = obj.position.z - t.pos.z;
    const d = Math.sqrt(dx*dx+dz*dz);
    if(d < bestToyDist){ bestToyDist = d; nearPlaything = t; }
  });

  nearPassarela = false;
  if(!PASSARELA.lit && Math.hypot(obj.position.x - PASSARELA.x, obj.position.z - PASSARELA.z) < 2.6){
    nearPassarela = true;
    if(state.carryingTorch) markOpportunity('achievement');
  }

  nearLamp = null;
  let bestLampDist = 2.4;
  lamps.forEach(l => {
    if(l.lit) return;
    const dx = obj.position.x - l.pos.x, dz = obj.position.z - l.pos.z;
    const d = Math.sqrt(dx*dx+dz*dz);
    if(d < bestLampDist){ bestLampDist = d; nearLamp = l; }
  });

  const prompt = document.getElementById('interactPrompt');
  /* O canal AQUI passou a ter dois estados visuais. Dourado com borda = dá pra apertar
     agora. Apagado e discreto = existe, mas falta alguma coisa. Antes os dois tinham o
     mesmo destaque, então "precisa de 1 fagulha" competia por atenção como se fosse uma
     ação disponível — e ficava pendurado o tempo todo perto de qualquer fogueira. */
  prompt.classList.remove('dim');
  const dim = () => prompt.classList.add('dim');
  if(nearLamp && !nearBrazier && !nearChoicePoint && !nearVillager){
    nearZone = null;
    prompt.style.display = 'block';
    if(state.carryingTorch){ prompt.innerHTML = '<b>T</b> acender lampião'; }
    else { prompt.innerHTML = 'lampião apagado'; dim(); }
  }else if(nearBrazier && !nearChoicePoint && !((nearPodium || nearBorda) && nearBrazier.brazier && nearBrazier.brazier.lit)){
    nearZone = null;
    prompt.style.display = 'block';
    // a lit fire is a place to take fire FROM; an unlit one is a place to spend a spark
    if(nearBrazier.brazier && nearBrazier.brazier.lit){
      /* Fogueira acesa é fonte OPCIONAL de tocha. Sem fagulha não há nada a dizer aqui:
         a barra AGORA já está mandando quebrar pedra, e repetir vira ruído permanente,
         já que ela passa perto de fogueira acesa o tempo todo depois de acender. */
      if(state.carryingTorch){ prompt.innerHTML = 'já está com tocha acesa'; dim(); }
      else if(state.sparks > 0){ prompt.innerHTML = '<b>T</b> pegar fogo pra tocha'; }
      else { prompt.style.display = 'none'; nearZone = null; return; }
    }else{
      // fogueira apagada é o objetivo obrigatório: aqui vale dizer o que falta
      if(state.sparks > 0){ prompt.innerHTML = '<b>T</b> acender fogueira'; }
      else { prompt.innerHTML = 'fogueira apagada — falta 1 fagulha'; dim(); }
    }
  }else if(nearVein && !nearVillager && !nearChoicePoint){
    nearZone = null;
    prompt.style.display = 'block';
    if(miningTarget === nearVein){ prompt.innerHTML = 'quebrando...'; }
    else if(bestVeinDist < 2.2){ prompt.innerHTML = 'segure <b>F</b> pra quebrar'; }
    else { prompt.innerHTML = 'chegue mais perto da pedra'; dim(); }
  }else if(nearVillager){
    nearZone = null;
    prompt.style.display = 'block';
    if(state.carryingTorch){ prompt.innerHTML = '<b>T</b> dar a tocha'; }
    else { prompt.innerHTML = 'aldeão perdido no escuro'; dim(); }
  }else if(nearChoicePoint){
    nearZone = null;
    prompt.style.display = 'block';
    prompt.innerHTML = '<b>E</b> pegar a Chama';
  }else if(nearFragUnlit){
    nearZone = null;
    prompt.style.display = 'block';
    prompt.innerHTML = 'acenda a fogueira daqui primeiro'; dim();
  }else if(z.id === 'espelho' && dist < 4 && !nearBit){
    nearZone = z;
    prompt.style.display = 'block';
    prompt.innerHTML = '<b>E</b> reacender o Fogo Sagrado';
  }else if(nearPodium){
    nearZone = null;
    prompt.style.display = 'block';
    if(state.carryingTorch){ prompt.innerHTML = '<b>T</b> apagar ' + nearPodium.name + ' e pôr o seu'; }
    else { prompt.innerHTML = 'nome de ' + nearPodium.name; dim(); }
  }else if(nearBorda){
    nearZone = null;
    prompt.style.display = 'block';
    if(state.carryingTorch){ prompt.innerHTML = '<b>T</b> pôr seu nome na borda'; }
    else { prompt.innerHTML = 'ainda cabe um nome aqui'; dim(); }
  }else if(nearBit){
    nearZone = null;
    prompt.style.display = 'block';
    prompt.innerHTML = '<b>E</b> falar com o Lume';
  }else if(nearReclaim){
    nearZone = null;
    prompt.style.display = 'block';
    prompt.innerHTML = '<b>E</b> pegar o fogo de volta';
  }else if(nearPassarela){
    nearZone = null;
    prompt.style.display = 'block';
    if(state.carryingTorch){ prompt.innerHTML = '<b>T</b> acender a passarela'; }
    else { prompt.innerHTML = 'passarela apagada'; dim(); }
  }else if(nearPlaything){
    nearZone = null;
    prompt.style.display = 'block';
    prompt.innerHTML = nearPlaything.kind === 'bell' ? '<b>E</b> tocar o sino' : '<b>E</b> chutar as pedrinhas';
  }else{
    nearZone = null;
    prompt.style.display = 'none';
  }
}

function tryInteract(){
  if(!playing) return;
  punchHand();
  if(nearBit){
    playInteractOpen();
    openBitTalk();
  }else if(nearChoicePoint){
    playInteractOpen();
    claimFragment(nearChoicePoint.zone);
  }else if(nearZone){
    if(nearZone.id === 'espelho'){ playInteractOpen(); startRestoration(); return; }
  }else if(nearReclaim){
    playInteractOpen();
    reclaimTorch(nearReclaim);
  }else if(nearPlaything){
    playWith(nearPlaything);
  }
}
