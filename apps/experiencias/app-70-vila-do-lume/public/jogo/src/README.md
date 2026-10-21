# src/

O jogo, dividido em 16 arquivos carregados em ordem por `index.html`.

## Por que scripts clássicos e não módulos ES

Módulo ES exige servidor HTTP — o navegador bloqueia `import` sobre `file://` por CORS. O alvo de uso é sala de aula de escola pública, onde **"copie a pasta e abra o index.html"** precisa continuar funcionando sem ninguém subir servidor. Pelo mesmo motivo não há bundler: nenhum passo de build entre editar e ver.

O preço é conhecido e aceito: o escopo é compartilhado entre os arquivos, e **a ordem dos `<script>` em `index.html` é a ordem de dependência**. Não reordene sem rodar `tests/smoke.js`.

Na prática isso importa menos do que parece: quase toda referência entre arquivos acontece **dentro de funções**, chamadas só depois que tudo carregou. O que precisa mesmo respeitar a ordem são as constantes de topo de arquivo.

## Ordem e responsabilidade

| arquivo | o que vive aqui |
|---|---|
| `01-config.js` | zonas, textos das DMs, rótulos, e o objeto `state`. **Folha da árvore**: não depende de nenhum outro. |
| `02-audio.js` | áudio procedural via WebAudio — não há um único arquivo de som no projeto |
| `03-engine.js` | setup do Three.js, `mkMesh`, sprites, texturas de canvas |
| `04-structures.js` | uma estrutura distinta por zona, reconhecível pela silhueta |
| `05-world.js` | mastros que atravessam a névoa, montagem das zonas |
| `06-resources.js` | pedras, lampiões e brinquedos |
| `07-torch.js` | a Tocha e o Dilema que ela cria por só caber uma na mão |
| `08-village.js` | fogueiras, aldeões e a Pedra dos Nomes |
| `09-ui-channels.js` | os canais de mensagem: AGORA, balão do Lume, eventos |
| `10-terrain.js` | Crista, Passarela, obstáculos, `SPAWN` e `WORLD_LIMIT` |
| `11-loop.js` | game loop: movimento, mineração, proximidade, interação |
| `12-dialogue.js` | HUD, conversa com o Lume, DMs |
| `13-layer2.js` | **Camada 2** — instrumentação Schwartz e persistência |
| `14-finale.js` | cinemática, tela da criança, painel do responsável |
| `15-intro.js` | onboarding e Nome de Jogo |
| `16-boot.js` | inicialização |

## A fronteira que mais importa

`13-layer2.js` é a **Camada 2** inteira: as dez medidas de valor, os graus de sustentação, e o que é persistido. Ele lê `state` e não escreve nada na tela da criança.

Isso é verificável e vale manter verificável: o arquivo depende apenas de `01-config.js` e de `03-engine.js`. Se um dia ele passar a chamar algo de `09-ui-channels.js` ou `14-finale.js`, a separação entre o que a criança vive e o que o adulto lê começou a vazar — e é essa separação que sustenta o projeto inteiro.

A medida de cobertura do mapa mora aqui, e não em `01-config.js`, pela mesma razão: cobertura não é dado do mundo, é instrumento.

## Antes de dar qualquer coisa por pronta

```bash
python3 serve.py              # servidor sem cache
for f in src/*.js; do node --check "$f"; done
```

Depois, no console do jogo aberto:

```js
eval(await (await fetch('/tests/smoke.js?t='+Date.now())).text())
```

47 invariantes de comportamento. Rode antes e depois de qualquer mudança estrutural e compare.

### Duas armadilhas que já morderam

**Cache.** Uma rodada inteira passou 47/47 enquanto dois arquivos estavam com erro de sintaxe: o navegador serviu o `index.html` antigo. Por isso `serve.py` manda `no-store` e o teste começa checando se as funções existem de verdade.

**`node --check` por arquivo não basta**, mas é o primeiro filtro e pega o erro mais comum — corte de arquivo no meio de uma função. Um arquivo que não parseia some inteiro no navegador, e o sintoma aparece longe da causa.
