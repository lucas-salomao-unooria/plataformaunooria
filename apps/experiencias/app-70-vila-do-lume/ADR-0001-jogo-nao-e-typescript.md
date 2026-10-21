# ADR-0001 — O jogo não é TypeScript, e não vai ser

**Data:** 2026-08-26 · **Status:** aceita

## Contexto

O CLAUDE.md do monorepo diz "TypeScript strict em tudo. Sem `any`". A Vila do Lume
chega como ~10 mil linhas de JavaScript clássico: 18 arquivos que declaram globais
(`state`, `zones`, `controls`, `playing`) e contam com a ordem dos `<script>` para
existirem, mais `three.min.js` (r1xx, UMD, 603 KB) e `PointerLockControls`.

O jogo não é código novo: é um instrumento com física, iluminação e distâncias
**calibradas** — os 4 pares de Dilema estão a exatamente 3,00 unidades do Lampião,
a velocidade a pé é 4,5 u/s "deliberadamente baixa, porque é a caminhada que torna
as escolhas caras", e o portão de amostra do perfil foi calibrado contra partidas
reais.

## Decisão

O jogo fica em `public/jogo/`, em JavaScript clássico, com a linguagem visual dele
(pixel, `game.css`, fontes próprias) e **nunca importa o Design System**. O único
código compilado pelo Vite é o shim de `src/` — esse sim, TS strict.

`public/jogo/**` está nos `ignores` do ESLint da raiz, com o comentário apontando
para cá.

## Alternativas descartadas

**Converter para TS + ESM.** Semanas de trabalho num código cuja correção é
comportamental, não tipológica: o compilador não tem como saber que uma refatoração
mudou a distância de um Chamado ou a ordem em que dois probes disparam. O risco é
quebrar a medida em silêncio — o pior tipo de bug num instrumento, porque o
relatório continua saindo, com números errados sobre uma criança.

**ESM sem tipos.** Paga a maior parte do custo (mexer nos 18 arquivos, resolver os
globais) para receber a menor parte do benefício.

**Empacotar `three` como dependência do workspace.** Tentador — tira 603 KB de
arquivo versionado e traz atualizações. Fica para depois: o jogo é afinado contra
esta versão do three, e as releases r150+ removeram API. É troca de motor num
instrumento calibrado, e não é o que este porte precisa provar.

## Consequências

- Bugs no jogo aparecem em runtime, não no `tsc`. A rede é o smoke visual
  (`scripts/walkthrough-*.mjs`) e o teste de contrato do payload na api.
- A fronteira precisa ser estreita e explícita, senão a exceção vaza: **`window.VILA`
  é a única porta** entre o jogo e a plataforma (`src/tipos.ts`), e `18-plataforma.js`
  é o único arquivo do jogo que sabe que uma plataforma existe.
- Sem HMR em `public/`: editar `jogo/src/*.js` recarrega a página. É o mesmo ciclo do
  repositório de origem.
- Esta ADR sucede a `docs/adr/0001-jogo-nao-segue-o-template.md` do repositório de
  origem, que decidiu a mesma coisa por motivos parecidos.
