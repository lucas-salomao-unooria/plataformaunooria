/* Vila do Lume — ponte com a plataforma

   Script clássico, e é por isso que ele existe: só um script clássico alcança os globais do
   jogo (`playing`, `controls`, `state`). O shim (`src/main.ts`) é módulo ES e não vê nenhum
   deles — `let`/`const` de topo de script clássico não vão para o `window`.

   Carregado DEPOIS de `16-boot.js`, porque usa o que o boot cria.

   Este arquivo NÃO tem regra de jogo e NÃO tem regra de medida. Se ele for removido, o jogo
   continua funcionando inteiro; o que se perde é a pausa quando a criança troca de aba. */

/* Pausa vinda do hub (visibilidade/foco da página, `hub:pause` do protocolo).

   O jogo é primeira pessoa com pointer lock. Sem isto, trocar de aba com o ponteiro preso
   deixa a câmera capturada numa aba que não é a dela — e o navegador solta o lock sozinho de
   um jeito que o jogo não vê, então `playing` continuava true e o loop seguia rodando com a
   criança olhando outra coisa. Tempo de jogo é denominador dos probes de ritmo: minuto que
   corre com ela fora da aba estraga a medida. */
window.vilaPausar = function(){
  if(typeof playing === 'undefined' || !playing) return;
  if(typeof controls !== 'undefined' && controls && controls.isLocked) controls.unlock();
};

/* Retomar NÃO volta a prender o ponteiro. `requestPointerLock()` exige gesto do usuário —
   chamar aqui falha com erro no console — e, mais que isso, prender a câmera de volta sozinha
   assusta. O `pausedHint` já está na tela dizendo "clique pra voltar pro jogo", e é o clique
   dela que retoma. Esta função existe para o caso de haver algo mais a religar depois. */
window.vilaRetomar = function(){
  /* Nada a fazer hoje, de propósito. Ver o comentário acima. */
};
