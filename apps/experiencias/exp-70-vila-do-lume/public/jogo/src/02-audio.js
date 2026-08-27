/* Vila do Lume — áudio procedural — não há um único arquivo de som no projeto

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ============================ AUDIO (procedural, no files) ============================ */
let actx = null, ambientGain = null;
function initAudio(){
  if(actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();

  // gentle ambient wind hum
  const osc = actx.createOscillator();
  osc.type = 'sine'; osc.frequency.value = 70;
  const lfo = actx.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoGain = actx.createGain(); lfoGain.gain.value = 6;
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
  ambientGain = actx.createGain(); ambientGain.gain.value = 0.025;
  osc.connect(ambientGain); ambientGain.connect(actx.destination);
  osc.start(); lfo.start();
}

function blip(freq, dur, type, vol, delay){
  if(!actx) return;
  const t0 = actx.currentTime + (delay||0);
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol||0.08, t0+0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
  osc.connect(gain); gain.connect(actx.destination);
  osc.start(t0); osc.stop(t0+dur+0.02);
}

let footToggle = false;
function playFootstep(){
  blip(footToggle ? 130 : 110, 0.09, 'square', 0.05);
  footToggle = !footToggle;
}
function playInteractOpen(){ blip(520,0.08,'sine',0.09); blip(720,0.1,'sine',0.08,0.09); }
function playChoiceConfirm(){ blip(660,0.07,'sine',0.08); }
function playAlert(){ blip(180,0.16,'sawtooth',0.14); blip(120,0.22,'sawtooth',0.13,0.14); }
function playAmbientChime(){ blip(880,0.12,'sine',0.06); }
function playDMPing(){ blip(1400,0.09,'sine',0.09); blip(1800,0.11,'sine',0.08,0.08); }
