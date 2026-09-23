/* Vila do Lume — a Tocha e o Dilema que ela cria ao só caber uma na mão

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ======================= CHAMA =======================
   One Tocha at a time, lit at any burning Fogueira for one Fagulha, spent on exactly one
   Ato Opcional. Carrying only one is what turns two things standing side by side into a
   Dilema: she can serve one, and the other costs the walk back to a fire. */
function lightTorchAtFire(zone){
  if(state.carryingTorch){ showSparkToast('Você já está com uma tocha acesa na mão.'); return true; }
  if(state.sparks < TORCH_COST_SPARKS){ showSparkToast('Você não tem fagulha pra acender uma tocha.'); return true; }
  state.sparks -= TORCH_COST_SPARKS;
  state.carryingTorch = true;
  state.torchesTaken++;
  updateResourceHud();
  updateTorchHud();
  blip(620,0.1,'sine',0.08); blip(880,0.13,'sine',0.07,0.09);
  teachOnce('tocha',
    'Agora você tá com uma tocha acesa na mão. Dá pra acender UMA coisa só com ela. Depois é voltar numa fogueira e pegar fogo de novo.',
    () => !state.carryingTorch);                            // sai quando ela gasta a tocha
  return true;
}

function spendTorch(where){
  state.carryingTorch = false;
  state.torchesSpent[where] = (state.torchesSpent[where] || 0) + 1;
  updateTorchHud();
}

function updateTorchHud(){
  const el = document.getElementById('torchSlot');
  if(el) el.className = state.carryingTorch ? 'torch-slot on' : 'torch-slot';
}

/* A Dilema resolves the moment she spends the Tocha on one half of a pair she was standing
   inside. Which half is the reading; that she had to pick is what makes it worth reading. */
function recordDilemmaChoice(pairId, chose){
  const already = state.dilemmaChoices.find(c => c.pairId === pairId);
  if(already) return;
  state.dilemmaChoices.push({pairId, chose, at: Math.round(state.playTime)});
}

const LIGHT_RADIUS = 6.5;
const torches = [];
/* T is a single contextual verb: light the brazier in front of you, or hand your torch to
   a villager stuck in the dark. Every ember has a destination — nothing is spent on decor. */
function placeTorch(){
  const atPedra = !!(nearPodium || nearBorda);
  const fireLit = !!(nearBrazier && nearBrazier.brazier && nearBrazier.brazier.lit);

  // an unlit Fogueira is the Objetivo Principal and always wins the key
  if(nearBrazier && !fireLit){ if(lightBrazier(nearBrazier)) return; }
  // standing at the Pedra with the fire already burning: carving wins over taking more fire
  if(atPedra && carveOnPedra()) return;
  if(nearVillager && giveTorchToVillager(nearVillager)) return;
  if(nearLamp && lightLamp(nearLamp)) return;
  if(nearPassarela && lightPassarela()) return;
  if(fireLit && lightTorchAtFire(nearBrazier)) return;
  showSparkToast('Aqui não tem nada pra acender. O T acende fogueira, tocha e lampião.');
}

const TORCH_LIFE = 55;
function updateTorches(dt){
  if(!playing) return;
  let died = false;
  for(let i = torches.length - 1; i >= 0; i--){
    const t = torches[i];
    if(t.permanent) continue;
    t.life -= dt;
    const f = Math.max(0, t.life / TORCH_LIFE);
    t.light.intensity = 1.6 * (0.25 + f * 0.75);
    t.head.material.emissive.setRGB(0.54*f, 0.35*f, 0.0);
    if(t.life < 8){
      const flicker = 0.6 + Math.sin(performance.now()*0.02)*0.4;
      t.light.intensity *= flicker;
    }
    if(t.life <= 0){
      scene.remove(t.post); scene.remove(t.head); scene.remove(t.light);
      torches.splice(i,1);
      died = true;
    }
  }
  if(died) refreshFragmentLighting();
}
