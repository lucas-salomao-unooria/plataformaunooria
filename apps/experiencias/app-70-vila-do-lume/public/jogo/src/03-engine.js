/* Vila do Lume — setup do Three.js e helpers de malha, sprite e textura

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ============================ THREE.JS SETUP ============================ */
let scene, camera, renderer, controls;
let bitGroup, bitTarget = new THREE.Vector3();
const zoneMeshes = {};
const clock = new THREE.Clock();
const keys = {};
let velocity = new THREE.Vector3();
let playing = false;
let nearZone = null;
let nearChoicePoint = null;
let nearVillager = null;
let nearVein = null;
let nearBrazier = null;
let nearLamp = null;
let nearPodium = null;
let nearPlaything = null;
let nearReclaim = null;
let nearBit = false;
let bitTalkIcon = null;
const LUME_HOME = {x: 6.0, z: 6.0};
let bitBeacon = null;
let optionsShownAt = null;
let sessionStartedAt = null;
/* Quando a PÁGINA abriu. `sessionStartedAt` só começa a contar no "ENTRAR NA VILA", então
   todo o tempo da intro — nove cartões do Lume, que uma criança de 6 lê devagar — ficava
   fora de qualquer medida. O professor cronometra a atividade inteira e vê um número
   menor no painel, sem nada explicando a diferença. Agora os dois são registrados. */
let pageOpenedAt = performance.now();
let hemiLight, sunLight;
const EYE_HEIGHT = 1.7, GRAVITY = 22, JUMP_SPEED = 8;
let velocityY = 0;
let worldGlow = 0, worldGlowTarget = 0;
/* fogFar era 38 num mapa de 36 de diâmetro: de qualquer ponto ela via tudo, e a escuridão
   só deixava a cena roxa. A 20 ela vê um terço da vila por vez, e a visão CRESCE a cada
   fogueira acesa — procurar é difícil no começo, quando ela tem paciência, e fácil no fim,
   quando está cansada. Restrição: no escuro não pode haver ameaça. Escuro que persegue
   mede medo, não valor. Ver GRILL-2026-08-20-mundo.md Q5. */
const WORLD_DIM = { bg:new THREE.Color(0x14101C), fog:new THREE.Color(0x14101C), fogNear:6, fogFar:20, hemi:0.30, sun:0.34 };
const WORLD_FULL = { bg:new THREE.Color(0x5B3B72), fog:new THREE.Color(0x5B3B72), fogNear:20, fogFar:75, hemi:0.7, sun:1.0 };
const _lerpBg = new THREE.Color(), _lerpFog = new THREE.Color();

function grassTexture(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4A7F33'; ctx.fillRect(0,0,64,64);
  ctx.fillStyle = '#5C9A3F';
  for(let y=0;y<64;y+=16){ for(let x=0;x<64;x+=16){ if(((x/16)+(y/16))%2===0) ctx.fillRect(x,y,16,16); } }
  // speckle noise per tile (grass blade texture feel)
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for(let i=0;i<180;i++){
    ctx.fillRect(Math.floor(Math.random()*64), Math.floor(Math.random()*64), 1, 1);
  }
  // block grid lines every 16px (reads as individual dirt blocks under the grass)
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  for(let x=0;x<=64;x+=16){ ctx.beginPath(); ctx.moveTo(x+0.5,0); ctx.lineTo(x+0.5,64); ctx.stroke(); }
  for(let y=0;y<=64;y+=16){ ctx.beginPath(); ctx.moveTo(0,y+0.5); ctx.lineTo(64,y+0.5); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.repeat.set(35,35);
  return tex;
}

function emojiSprite(emoji, size){
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '92px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({map:tex, transparent:true});
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

function initScene(){
  scene = new THREE.Scene();
  scene.background = WORLD_DIM.bg.clone();
  scene.fog = new THREE.Fog(WORLD_DIM.fog.getHex(), WORLD_DIM.fogNear, WORLD_DIM.fogFar);

  camera = new THREE.PerspectiveCamera(72, window.innerWidth/window.innerHeight, 0.1, 200);
  camera.position.set(SPAWN.x, 1.7, SPAWN.z);

  renderer = new THREE.WebGLRenderer({antialias:false});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1);
  /* Orçamento gráfico de PC de escola pública (Intel HD de 2013 é o alvo). Sombra
     PCFSoft 2048² + antialias + pixelRatio 2 derrubam o framerate antes de qualquer
     coisa. O gargalo aqui é LUZ, não geometria — o que é conveniente, já que a expansão
     do mapa custa geometria. Ver GRILL-2026-08-20-mundo.md. */
  renderer.shadowMap.enabled = false;
  document.getElementById('canvasHost').appendChild(renderer.domElement);

  hemiLight = new THREE.HemisphereLight(0xD97B4F, 0x223018, WORLD_DIM.hemi);
  scene.add(hemiLight);
  sunLight = new THREE.DirectionalLight(0xFFDDAA, WORLD_DIM.sun);
  sunLight.position.set(-24, 34, 14);
  sunLight.shadow.camera.left = -55; sunLight.shadow.camera.right = 55;
  sunLight.shadow.camera.top = 55; sunLight.shadow.camera.bottom = -55;
  sunLight.shadow.camera.far = 90;
  sunLight.shadow.bias = -0.0015;
  scene.add(sunLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140,140),
    new THREE.MeshLambertMaterial({map:grassTexture()})
  );
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // boundary dirt wall ring (visual only)
  const wallMat = new THREE.MeshLambertMaterial({color:0x5E3B1C});
  for(let i=0;i<40;i++){
    const ang = (i/40)*Math.PI*2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(4,3,2), wallMat);
    // o conteúdo agora vai até r=30; a borda tem que ficar atrás dele
    wall.position.set(Math.cos(ang)*34, 1.5, Math.sin(ang)*34);
    wall.rotation.y = ang;
    wall.castShadow = true; wall.receiveShadow = true;
    scene.add(wall);
  }

  zones.concat([MIRROR]).forEach(z => buildZone(z));
  zones.forEach(z => { const g = zoneMeshes[z.id]; if(g) beaconFor(z, g); });
  buildBit();
  buildHand();
  computeMandatoryFloor();
  buildRidge();
  buildVeins();
  buildLamps();
  buildPlaythings();
  buildVillagers();
  buildObstacles();

  controls = new THREE.PointerLockControls(camera, document.body);
  scene.add(controls.getObject());
  controls.getObject().position.set(SPAWN.x, 1.7, SPAWN.z);

  // Keyboard-only verbs: hold F to mine, T to plant a torch, E to take/talk.
  // The mouse is left purely for looking around.
  document.addEventListener('keydown', e => keys[e.code] = true);
  document.addEventListener('keyup', e => keys[e.code] = false);
  document.addEventListener('keydown', e => { if(e.code === 'KeyE' && !e.repeat) tryInteract(); });
  document.addEventListener('keydown', e => {
    if(!playing) return;
    if(e.code === 'KeyF'){ miningHeld = true; }
    if(e.code === 'KeyT' && !e.repeat){ placeTorch(); punchHand(); }
  });
  document.addEventListener('keyup', e => { if(e.code === 'KeyF') miningHeld = false; });
  document.addEventListener('keydown', e => {
    if(e.code === 'Space' && !e.repeat && playing){
      const obj = controls.getObject();
      // ESPAÇO fecha a fala do Lume antes de virar pulo
      if(lumeDismiss()) return;
      if(dismissStickyToasts()) return;
      if(obj.position.y <= EYE_HEIGHT + 0.02){ velocityY = JUMP_SPEED; playChoiceConfirm(); }
    }
  });
  document.addEventListener('keydown', e => {
    if(!activeDM || e.repeat) return;
    const idx = DM_KEYS.indexOf(e.code);
    if(idx === -1 || idx >= activeDM.options.length) return;
    const wrap = document.getElementById('dmReplies');
    if(!wrap || wrap.children[idx]?.disabled) return;
    pickDM(activeDM, activeDM.options[idx]);
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

const spinMeshes = [];

function mkMesh(geo, color, castShadow, opts){
  const mat = new THREE.MeshLambertMaterial(Object.assign({color}, opts||{}));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = castShadow !== false;
  mesh.receiveShadow = true;
  return mesh;
}
function mkBox(w,h,d,color,castShadow){ return mkMesh(new THREE.BoxGeometry(w,h,d), color, castShadow); }

const WOOD = 0x6B4423, STONE = 0x6E6A66, DARKWOOD = 0x3A2214;

/* Podium geometry is shared between the builder and the "took someone's place" check. */
/* Pedra dos Nomes. Three tall stones carry the names of children who came before — the
   DESTAQUE. In front of them sits one low, empty slab — the BORDA, where a name still fits
   without taking anyone's place. The two are separate places on the ground, so choosing
   between them is walking, not reading a menu: legible at six.
   Without the Borda, every child who simply wanted to sign her name would be forced to
   erase someone, and the panel would read all of them as Power. */
const PODIUM_STEPS = [{h:1.1, x:-0.85, z:0.2}, {h:1.35, x:0, z:0.2}, {h:1.1, x:0.85, z:0.2}];
const BORDA_SPOT = {h:0.22, x:0, z:-2.1};

/* Signs must never clip their own text: the font shrinks until the name fits the board,
   and the sprite is scaled from the real canvas ratio instead of a hardcoded guess. */
function nameplateSprite(text, opts){
  const o = opts || {};
  const W = 512, H = 112, PAD = 26;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  let size = o.maxFont || 62;
  do {
    ctx.font = 'bold ' + size + 'px monospace';
    if(ctx.measureText(text).width <= W - PAD*2) break;
    size -= 2;
  } while(size > 14);

  if(o.plate !== false){
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0,0,W,H);
  }
  ctx.fillStyle = o.color || '#F3ECD8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W/2, H/2 + 2);

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false}));
  const w = o.width || 2.0;
  sprite.scale.set(w, w * (H/W), 1);
  return sprite;
}
