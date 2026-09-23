# apps/experiencias/exp-70-vila-do-lume — doutrina do jogo

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.
Este arquivo é **doutrina do jogo**: as regras que já foram quebradas uma vez e o que cada
uma custou. O que é verdade sobre a estrutura (onde mora o quê, como rodar, o que a api faz)
vive em `README.md`; o que o jogo É vive em `docs/GAME_DESIGN.md`; o vocabulário, em
`docs/CONTEXT.md`.

> **Reescrito em 26/08/2026.** A versão anterior era o guia do app de origem (`vila-coleta`)
> e descrevia `public/jogo/` dentro de um Next na porta 3100, `localStorage` como rede de
> segurança, `vilaExportarTudo()`, importação de `.json` e um `tests/jogo/smoke.js` que não
> existe. Nada disso sobreviveu ao porte. O que sobreviveu é o que está abaixo: as regras.

## As duas camadas nunca se cruzam

**Camada 1** é o que a criança vive. **Camada 2** é a instrumentação, e ela é invisível: a
criança não vê pontuação de valor, rótulo de Schwartz, retrato de caráter, nem qualquer sinal
de que está sendo medida.

No instante em que ela percebe a medição, a próxima partida vira atuação e o instrumento
morre. Isso não é preferência de design — é a premissa de tudo.

Corolários que já foram violados e voltaram:

- **Não existe tela de resultado dentro do jogo.** Nem retrato, nem lista de partidas, nem
  rota atrás de parâmetro de URL. Houve um `?painel`, e ele era errado pelo motivo mais
  simples: esconder atrás de uma query string é confiar que ela não vai achar, e ela acha.
- **Nenhuma palavra do vocabulário Schwartz existe no bundle.** Os rótulos vivem só na api
  (`vila/mapeamento.ts`, `vila/leitura.ts`). Enquanto a palavra existir no bundle, um
  `innerHTML` distraído a coloca de volta na frente dela.
- **Nenhum feedback avaliativo depois de uma escolha.** Sem flash, sem rótulo de perigo, sem
  som de erro. O momento em que o jogo te dá nota é o momento em que ele para de te medir.

## Ato Opcional não pontua

Nada do que é opcional vale ponto: ajudar Aldeão, acender Lampião, gravar na Pedra, tocar
Sino. `SCORE = { fire:100, flame:50, rock:10, optional:0 }`.

Pontuar escolha livre transforma sinal de valor em perseguição de placar. O que substitui o
incentivo é o **Chamado** — o Aldeão grita, o vidro do Lampião pulsa. O mundo pede; o placar
não. Ver `docs/adr/0001`.

## Teste duplo: cliente e servidor, sempre

Toda trava que protege dado de criança existe nas **duas pontas**, e não é redundância:

| trava | cliente | servidor |
|---|---|---|
| campo de nome no payload | `verificarSemNome()` (`17-export.js`) | `semNomeDeCrianca()` (`vila/contrato.ts`), 422 |
| perfil já calculado | o jogo simplesmente não o envia | `CHAVES_DE_PERFIL`, 422 |
| resposta a um cartão | manda o índice escolhido | corrige contra o catálogo (`regras.ts`) |

A do cliente protege contra descuido de quem escreve o jogo; a do servidor, contra um bundle
adulterado ou de uma versão que ainda não existia quando isto foi escrito.

**Corolário:** rejeitar, nunca ignorar em silêncio. Campo de nome aparecendo é bug, e bug
silencioso aqui não é inconveniência — é dado de menor gravado num banco que carrega a
palavra "Poder" na linha ao lado.

## O servidor recalcula; o jogo não decide nada sobre a criança

O jogo sabe computar o retrato Schwartz e **deliberadamente não o envia**. Manda medidas
brutas; a api recalcula com `VERSAO_MAPEAMENTO` própria. É isso que permite reprocessar o
histórico quando a hipótese mudar — e ela vai mudar, porque é hipótese de design, não
instrumento validado.

Pela mesma razão saíram do bundle, no porte: o **gabarito** dos cartões da missão, a escolha
da **bolha**, e a classificação das respostas. O cliente não decide a condição do próprio
teste.

## Regras das telas do professor

- **Valor com uma fonte de medida só não recebe número.** "Poder 100" a partir de um único
  ato num objeto que convida a ser mexido é rótulo, não medida. Isso deixou de ser convenção
  de tela e virou **tipo** (`vila/leitura.ts`): só a variante `scored` carrega
  `numero: number`, então o hub nunca recebe o número que não pode desenhar.
- **`zero` e `none` são coisas diferentes.** Zero é "teve a chance e não foi" e entra na
  média; não observado sai da conta. Tratar os dois como iguais faz uma criança parecer ter
  recusado algo que nunca lhe foi oferecido.
- **Na listagem da turma, nenhum valor aparece.** Listagem é ordenável, e uma coluna "Poder"
  viraria um ranking de crianças. Os valores vivem na tela individual, uma por vez.
- **A seção das mensagens abre pelo NÍVEL que ela recebeu**, antes do que ela fez. "Caiu em
  2 de 3" sem dizer que era o nível C faz o adulto concluir que a criança é ingênua.

## Constantes de mundo: derive, nunca digite

`coverageCell` deriva de `WORLD_LIMIT`; `MANDATORY_CELLS` é calculado no boot a partir das
posições reais das zonas. Digitar um número que já existe noutro lugar é combinar duas fontes
de verdade que vão divergir na primeira vez que alguém mexer no mapa.

## Sem CDN

`vendor/` tem `three.min.js`, `PointerLockControls` e as fontes, locais. Rede de escola é
filtrada, e um `unpkg.com` bloqueado é tela preta sem explicação.

## As duas armadilhas conhecidas

**Denominador vem do que aconteceu, não de constante.** Um denominador fixo já reportou
"20% de Segurança" para uma criança que respondeu 1 de 1. É o mesmo motivo de
`cartoesServidos` ≠ `apareceram` na api, e de `zero` ≠ `none` no perfil.

**Fronteira de idioma silenciosa.** Os nomes internos do jogo são em inglês
(`dilemmasSeen`), os do contrato em português (`dilemasVistos`). Errar essa tradução não
quebra nada em tempo de execução: vira **zero silencioso**. Já aconteceu.

## Como verificar uma mudança

`tsc` não cobre quase nada aqui — o jogo está fora dele por decisão (`ADR-0001-jogo-nao-e-typescript.md`). A rede
é o smoke visual:

```bash
node scripts/e2e/rodar.mjs estudante/05    # a partida; usa o CHROME do sistema (pointer lock)
node scripts/e2e/rodar.mjs professor/05    # as telas do professor e as três travas de leitura
pnpm --filter @edu/api test                # contrato, bolha, correção, tenancy
node --check public/jogo/src/<arquivo>.js  # erro de sintaxe antes de recarregar
```

Os dois `scripts/walkthrough-*-vila.mjs` que este arquivo mandava rodar até
2026-09-01 **não existem** desde que a suíte passou a ser organizada por papel
(ADR-51). Substituídos pelas duas suítes acima.

O jogo é servido de `public/`, sem HMR: editar um `.js` exige **recarregar a página** — e é
aí que o cache do navegador engana. Ver `README.md` para as portas e o embed.
