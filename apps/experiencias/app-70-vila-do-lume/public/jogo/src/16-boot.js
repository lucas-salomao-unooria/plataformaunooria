/* Vila do Lume — inicialização

   Script clássico, NÃO módulo ES — e continua sendo por decisão, não por inércia: são ~10
   mil linhas com globais compartilhados (`state`, `zones`, `THREE`), e converter é semanas
   de risco num instrumento com distâncias e tempos calibrados. Ver
   `ADR-0001-jogo-nao-e-typescript.md` na raiz da experiência.

   A ordem de dependência NÃO está em nenhum `index.html`: está na lista `ARQUIVOS` de
   `src/carregador.ts`, que injeta os scripts sequencialmente. */

/* ============================ BOOT ============================ */
initScene();
updateHud();
animate();

function startGame(){
  const sp = safeSpawn();
  controls.getObject().position.set(sp.x, 1.7, sp.z);
  initAudio();
  state.suggestedZone = zones[Math.floor(Math.random()*zones.length)].id;
  const sug = zones.find(z => z.id === state.suggestedZone);
  setTimeout(() => {
    if(playing) lumeSay('Eu começava pel' + (sug.art === 'a' ? 'a ' : 'o ') + sug.label + addr() +
      '. Fica ' + compassWord(sug.pos.x, sug.pos.z) + ' — procura o mastro de bandeira lá. Mas a vila é tua: vai por onde você quiser.',
      () => zones.some(z => z.brazier && z.brazier.lit));   // sai quando qualquer fogueira acende
  }, 1800);
  if(!sessionStartedAt) sessionStartedAt = performance.now();
  document.getElementById('menuOverlay').classList.remove('open');
  document.getElementById('crosshair').style.display = 'block';
  playing = true;
  controls.lock();
  scheduleAmbientDMs();
}

/* Não há `?painel` nem qualquer outra rota para resultado dentro do jogo. O que não deve
   ser visto pela criança não deve estar aqui — esconder atrás de um parâmetro de URL é
   confiar que ela não vai achar, e ela acha. Ver o cabeçalho de vilaExportarTudo(). */
renderInicio();

/* SEM `window.addEventListener('load', ...)` em volta — e essa é a única diferença entre
   este arquivo e o do repo de origem.

   Lá os 18 `<script>` estavam no fim do `index.html`, então o `load` do documento
   disparava DEPOIS deles e o listener entrava. Aqui os scripts são injetados por
   `src/carregador.ts` depois do handshake com o hub e da abertura da partida na api —
   duas idas à rede —, e nessa altura o `load` JÁ DISPAROU: o callback nunca era chamado
   e o `pointerlockchange` ficava sem ninguém ouvindo.

   O sintoma não aponta para cá. A criança perde o ponteiro (Esc, trocar de aba, ou o
   `hub:pause` que `18-plataforma.js` traduz em `controls.unlock()`), a câmera congela e
   o teclado para de andar — porque o laço de movimento exige `controls.isLocked`
   (`11-loop.js`) — e o aviso "Clique pra voltar pro jogo" NÃO aparece. Ele é o único
   caminho de volta: o `onclick` logo abaixo é o único `controls.lock()` fora dos
   diálogos. O jogo fica preso, e nada na tela diz por quê.

   O `load` nunca foi necessário nem no origem: o `pausedHint` já está no DOM quando este
   arquivo roda, e a linha seguinte — que sempre foi de topo de script — prova isso. */
document.addEventListener('pointerlockchange', () => {
  if(!controls) return;
  if(!controls.isLocked && playing && !document.getElementById('resultsOverlay').classList.contains('open')){
    document.getElementById('pausedHint').style.display = 'flex';
  }else{
    document.getElementById('pausedHint').style.display = 'none';
  }
});
document.getElementById('pausedHint').onclick = () => { if(playing) controls.lock(); };
