/* Vila do Lume — canais de mensagem: AGORA, balão do Lume, eventos

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ===================== CANAL A — AGORA =====================
   Uma linha que responde "o que eu faço agora?", derivada do estado e nada mais. Diz o
   QUÊ, jamais o ONDE — a procura, que é de onde vem o tempo de jogo e metade dos sinais,
   continua inteira. A regra de ordem é a da cadeia do fogo: sem fagulha não dá pra acender,
   sem acender não sobe Chama, sem as 8 Chamas o Fogo Sagrado não volta. */
function currentObjective(){
  const fires = zones.filter(z => z.brazier && z.brazier.lit).length;
  const claimable = zones.some(z => z.fragLit && !state.visited.includes(z.id));
  const allTaken = state.visited.filter(id => id !== 'espelho').length >= zones.length;

  if(allTaken)          return {icon:'🔥', text:'VOLTE PRO FOGO SAGRADO, NO MEIO DA VILA', done:true};
  if(claimable)         return {icon:'✋', text:'PEGUE A CHAMA SAGRADA QUE SUBIU DO FOGO'};
  if(state.sparks < 1)  return {icon:'⛏️', text:'QUEBRE UMA PEDRA PRETA PRA PEGAR FAGULHA'};
  if(fires === 0)       return {icon:'🔥', text:'ACENDA A PRIMEIRA FOGUEIRA DA VILA'};
  return {icon:'🔥', text:'FALTAM ' + (8 - fires) + (8 - fires === 1 ? ' FOGUEIRA' : ' FOGUEIRAS')};
}

let _lastObjective = '';
function updateObjective(){
  const bar = document.getElementById('objectiveBar');
  if(!bar) return;
  if(!playing || cinematic){ bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  const o = currentObjective();
  if(o.text === _lastObjective) return;          // só toca no DOM quando muda de verdade
  _lastObjective = o.text;
  bar.querySelector('.obj-icon').textContent = o.icon;
  bar.querySelector('.obj-text').textContent = o.text;
  bar.classList.toggle('done', !!o.done);
}

/* ===================== BALÃO DO LUME =====================
   Instrução longa mora aqui, com rosto e nome, e espera. Antes isso era um toast no canto
   disputando espaço com "o aldeão foi pra Praça" e "você não tem fagulha" — três naturezas
   diferentes no mesmo lugar, com o mesmo visual. */
let _lumeQueue = [];
let _lumeDoneWhen = null;

/* `doneWhen` é uma condição de cumprimento. "Chega perto e aperta E pra pegar a Chama" não
   tem razão de continuar na tela depois que ela pegou a Chama — obrigar a fechar um aviso
   que ela já obedeceu é pedir trabalho por nada, e ensina que os avisos do jogo são
   burocracia. Instrução cumprida sai sozinha; só a que ainda não foi atendida espera. */
function lumeSay(text, doneWhen){
  const el = document.getElementById('lumeSpeech');
  if(!el) return;
  if(el.classList.contains('open')){ _lumeQueue.push([text, doneWhen]); return; }
  document.getElementById('lumeSpeechText').textContent = text;
  el.classList.add('open');
  _lumeDoneWhen = doneWhen || null;
  el.querySelector('.ls-dismiss').textContent = doneWhen ? 'faz isso — ou ESPAÇO pra fechar'
                                                         : 'ESPAÇO pra continuar';
  blip(520,0.08,'sine',0.06); blip(700,0.1,'sine',0.05,0.08);
}

function lumeDismiss(){
  const el = document.getElementById('lumeSpeech');
  if(!el || !el.classList.contains('open')) return false;
  el.classList.remove('open');
  _lumeDoneWhen = null;
  /* Ao desenfileirar, descarta o que já foi cumprido enquanto esperava a vez. Sem isto, uma
     criança rápida via aparecer "aperta E pra pegar a Chama" depois de já ter pegado — pior
     que não avisar, porque contradiz o que ela acabou de fazer. */
  if(_lumeQueue.length) setTimeout(() => {
    while(_lumeQueue.length){
      const [t, d] = _lumeQueue.shift();
      let already = false;
      try { already = d ? !!d() : false; } catch(e){ already = false; }
      if(!already){ lumeSay(t, d); return; }
    }
  }, 220);
  return true;
}

/* Fecha sozinho no instante em que a ação pedida acontece. */
function updateLumeSpeech(){
  if(!_lumeDoneWhen) return;
  let done = false;
  try { done = !!_lumeDoneWhen(); } catch(e){ done = false; }
  if(done) lumeDismiss();
}

function updateResourceHud(){
  document.getElementById('scoreSparks').textContent = state.sparks;
  updateTally();
}

/* All on-screen notices go through one stack, so a new message never lands on top of the
   one still being read — they queue downward and expire in order. */
const TOAST_STACK_ID = 'toastStack';
function toastStack(){
  let el = document.getElementById(TOAST_STACK_ID);
  if(!el){
    el = document.createElement('div');
    el.id = TOAST_STACK_ID;
    document.body.appendChild(el);
  }
  return el;
}

/* Tempo de leitura, não tempo fixo. Uma criança em início de alfabetização lê perto de uma
   palavra por segundo — a fala de abertura do Lume tem 25 palavras e sumia em 4,2 s, antes
   de ela chegar na metade. Aqui a duração vem do tamanho do texto, com um piso generoso. */
function readingMs(text){
  const words = text.trim().split(/\s+/).length;
  return Math.min(26000, Math.max(5000, words * 900));
}

function pushToast(text, kind, ms, sticky){
  const stack = toastStack();
  const dur = ms || readingMs(text);
  // collapse an identical message that is already showing instead of stacking a duplicate
  const last = stack.lastElementChild;
  if(last && last.dataset.text === text){
    clearTimeout(Number(last.dataset.timer));
    if(!sticky) last.dataset.timer = String(setTimeout(() => last.remove(), dur));
    return;
  }
  const t = document.createElement('div');
  t.className = 'toast toast-' + (kind || 'info') + (sticky ? ' toast-sticky' : '');
  t.dataset.text = text;
  t.textContent = text;
  if(sticky){
    t.dataset.sticky = '1';
    const hint = document.createElement('span');
    hint.className = 'toast-dismiss';
    hint.textContent = 'ESPAÇO pra fechar';
    t.appendChild(hint);
  }
  stack.appendChild(t);
  while(stack.children.length > 4) stack.firstElementChild.remove();
  if(!sticky) t.dataset.timer = String(setTimeout(() => t.remove(), dur));
}

/* Orientação não pode ter prazo. Estas ficam na tela até a criança fechar — ela lê no
   ritmo dela, relê se precisar, e o jogo não continua contando um relógio que ela não vê.
   Fechar é ESPAÇO, que é a única tecla do jogo sem outra função durante a caminhada. */
function pushStickyToast(text, kind){ pushToast(text, kind || 'bit', null, true); }

/* Explicação de mecânica gruda só na PRIMEIRA vez. Depois disso ela já sabe, e um cartaz
   que precisa ser fechado toda vez vira estorvo em vez de ajuda. */
const _taughtOnce = {};
function teachOnce(key, text, doneWhen){
  if(_taughtOnce[key]) return;      // ensinou uma vez; repetir vira estorvo
  _taughtOnce[key] = true;
  lumeSay(text, doneWhen);
}

function dismissStickyToasts(){
  const stack = document.getElementById(TOAST_STACK_ID);
  if(!stack) return false;
  const sticky = Array.from(stack.children).filter(c => c.dataset.sticky === '1');
  sticky.forEach(c => c.remove());
  return sticky.length > 0;
}

function showSparkToast(text){ pushToast(text, 'spark', 2600); }
/* CANAL C — ACONTECEU. Só evento, nunca instrução: quem instrui é o Lume (balão) e a
   barra de objetivo. Curto de propósito — isto é pra ser notado de canto de olho. */
function showZoneIntroToast(text){ pushToast(text, 'bit'); }
function showEventToast(text){ pushToast(text, 'bit'); }
function showGuidanceToast(text){ pushStickyToast('🔥 ' + text, 'bit'); }
function showFragmentToast(){ pushToast('🔥 Chama Sagrada pega', 'win', 2600); }

/* A handful of low crates along the paths — jumpable, not walk-through. Pure traversal
   texture: never gates progress, a 9-year-old can always just walk around them. */
