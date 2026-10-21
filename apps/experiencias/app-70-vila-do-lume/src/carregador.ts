/**
 * Injeta os scripts clássicos do jogo, em ordem de dependência.
 *
 * O jogo NÃO é módulo ES e nunca vai ser (ADR-0001): `01-config.js` declara
 * `state` e `zones` no escopo global e os outros dezesseis contam com isso. A
 * ordem abaixo é a mesma do `index.html` do repo de origem, incluindo a
 * inversão do fim — `17-export` antes de `16-boot`, porque o boot chama
 * `construirPayloadSessao` e `renderInicio` já no parse.
 *
 * Carregamento SEQUENCIAL, um `onload` por vez. `<script defer>` em paralelo
 * preservaria a ordem de execução, mas aqui a injeção é dinâmica: script
 * inserido por JS é `async` por default, e a ordem se perderia em silêncio —
 * o sintoma seria `state is not defined` num arquivo aleatório, diferente a
 * cada recarga.
 */

const ARQUIVOS: readonly string[] = [
  "jogo/vendor/three.min.js",
  "jogo/vendor/PointerLockControls.js",
  "jogo/src/01-config.js",
  "jogo/src/02-audio.js",
  "jogo/src/03-engine.js",
  "jogo/src/04-structures.js",
  "jogo/src/05-world.js",
  "jogo/src/06-resources.js",
  "jogo/src/07-torch.js",
  "jogo/src/08-village.js",
  "jogo/src/09-ui-channels.js",
  "jogo/src/10-terrain.js",
  "jogo/src/11-loop.js",
  "jogo/src/12-dialogue.js",
  "jogo/src/13-layer2.js",
  "jogo/src/14-finale.js",
  "jogo/src/15-intro.js",
  "jogo/src/17-export.js",
  "jogo/src/16-boot.js",
  // Ponte com a plataforma: pausa/retomada. Depois do boot, porque usa os
  // globais que o boot cria.
  "jogo/src/18-plataforma.js",
];

function carregarUm(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    // Relativo ao documento: o bundle é servido da raiz de uma versão no
    // bucket (`.../app-70-vila-do-lume/1.0.0/`), e caminho absoluto quebraria.
    tag.src = src;
    tag.async = false;
    tag.onload = () => resolve();
    tag.onerror = () => reject(new Error(`falhou ao carregar ${src}`));
    document.body.appendChild(tag);
  });
}

export async function carregarJogo(): Promise<void> {
  for (const arquivo of ARQUIVOS) {
    await carregarUm(arquivo);
  }
}
