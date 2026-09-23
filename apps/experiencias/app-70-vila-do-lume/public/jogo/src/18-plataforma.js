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

/* ---- Pointer lock RECUSADO: o único jeito de esse erro chegar a um adulto ----

   Num iframe com sandbox, `requestPointerLock()` morre com `SecurityError` quando falta o
   token `allow-pointer-lock` — que o `ExpFrame` do hub só liga para quem declarou
   `permissoes` no manifesto. Quando isso acontece o jogo monta inteiro, a intro aparece,
   a criança clica em ENTRAR NA VILA e a vila fica lá: a câmera não gira e ela não anda,
   porque o laço de movimento exige `controls.isLocked` (`11-loop.js`). Nenhuma tela diz
   nada, e o `console.warn` do PointerLockControls sai DENTRO do iframe, onde ninguém
   procura.

   `jaPrendeu` é o que separa esse caso do erro TRANSITÓRIO: depois de um Esc o Chrome
   recusa um novo lock por cerca de um segundo, e tratar isso como falha de configuração
   poria um aviso de sistema na frente de uma criança que só apertou uma tecla. Só o
   PRIMEIRO lock da partida — o que nunca pegou — abre a mensagem. */
var vilaJaPrendeuPonteiro = false;

document.addEventListener('pointerlockchange', function(){
  if(!document.pointerLockElement) return;
  vilaJaPrendeuPonteiro = true;
  const p = document.querySelector('#pausedHint .box p');
  if(p) p.textContent = 'Clique pra voltar pro jogo';
});

document.addEventListener('pointerlockerror', function(){
  if(vilaJaPrendeuPonteiro) return;
  console.error(
    '[vila] o navegador RECUSOU o pointer lock. Quase sempre é o iframe do hub sem o token ' +
    '`allow-pointer-lock` no sandbox: confira `permissoes: ["pointer-lock"]` no manifesto ' +
    'desta experiência (tabela `experiencias` da api, ou o `experiencia.json` do bundle ' +
    'quando a tabela está vazia). Sem o token a câmera não gira e a criança não anda.'
  );
  /* Texto para o ADULTO, e sem culpar a criança: ela não errou nada, e "clique pra voltar
     pro jogo" seria mentira — o clique tentaria o lock de novo e falharia igual. */
  const p = document.querySelector('#pausedHint .box p');
  if(p) p.textContent = 'O navegador não deixou o jogo usar o mouse. Chame o professor.';
  const hint = document.getElementById('pausedHint');
  if(hint) hint.style.display = 'flex';
});
