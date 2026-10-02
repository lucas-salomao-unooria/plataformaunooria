# apps/experiencias/exp08ef1b — o feed que se revela (Unoovista)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp08ef1b` · 8EF · `telemetria, progresso, ia` · viewport 375×812 |
| Dev | `pnpm --filter @edu/exp08ef1b dev` → :5173 |
| DS | `@edu/ui/ds-unoovista` no disfarce (desde a 1.2.0, ADR-133; antes era `ds-insta`), `@edu/ui/ds` só nos gráficos do dossiê |
| api | `motor`, `geracao`, `dossie`, `atividades` — tabelas `exp08ef1b_*` |
| e2e | `scripts/e2e/estudante/02-instanooria.mjs` (sobe DOIS contextos: o docente conduz) |
| Copy da revelação | `src/lib/copy-da-revelacao.ts` — **cópia gêmea** de `apps/hub/lib/insta/copy-da-revelacao.ts`, que o guia do professor lê. Mexeu numa, mexa na outra: nada no build cobra isso |

## O cliente MEDE; quem decide é o servidor

`src/lib/eventos.ts` é buffer do MOTOR (flush a 4s, a 10 eventos, ou antes de
pedir o próximo bloco) e **nenhum peso, score ou classificação mora aqui**. O
feed adaptativo é da api: o cliente manda o que aconteceu e recebe o próximo
bloco. Colocar a regra no cliente é entregar o gabarito do próprio instrumento
(regra 3) — e torna impossível reprocessar a hipótese depois, que é o motivo de
o motor ser versionado do lado de lá.

## Dwell time tem uma definição, e ela não é intuitiva

`src/lib/dwell.ts`: `IntersectionObserver` com threshold **0.6** — o cronômetro
abre com ≥60% do card visível e fecha ao sair, revisitas somam, e a aba oculta
pausa. **Sheet aberto sobre o feed NÃO pausa**: comentário aberto continua
contando para o post, porque ler os comentários é atenção àquele post. Mudar
qualquer um dos três muda a medida, não só o número.

## O disfarce é o Unoovista, e o que ficou local tem nome

O app se chama **Unoovista** e a superfície inteira vem da seção `unoovista` do
DS. As cores do Tailwind (`surface`, `ink`, `action`…) são nomes da experiência
que apontam para os tokens `--unv-*` — **nunca** escreva hexadecimal de
interface aqui, e nunca `--unooria-*` no feed: o roxo é o mesmo, a seção não.
A folha `fonts/unoovista.css` é obrigatória, porque o `Icon` é ligadura.

O que ficou local é COMPENSAÇÃO, marcada no comentário do arquivo, e morre
quando o pacote publicar a peça:

| Peça | Arquivo | Lacuna do DS |
|---|---|---|
| grade de miniaturas (busca, perfis, debate) | `abas.tsx`, `debate.tsx` | o `MediaGrid` só desenha bloco com `src` e não entrega o elemento de cada bloco — e a busca registra CADA miniatura no dwell |
| coração do comentário | `comentarios-sheet.tsx` | não há botão de ícone sem contêiner |
| "Seguir" ao lado do cabeçalho do post; coração do duplo-toque | `post-card.tsx` | o `PostCard.Header` não tem slot de ação; embrulhar a `Media` mata a pílula de ações (`Media + Actions` precisa ser adjacente) |
| avatar das iniciais e mídia de emoji no story | `stories.tsx` | o `StoryViewer` só recebe URL (sem `initials`, sem slide sem `src`): os dois viram SVG em `data:` |
| seletor de figurinha | `onboarding.tsx` | não há seletor de avatar |
| camada `fixed` das folhas, do aviso e da doca | `sheet.tsx`, `sheets-extras.tsx`, `bottom-nav.tsx` | no DS eles se posicionam no `PhoneFrame`; aqui o contêiner é o viewport do iframe |

Duas armadilhas que a troca mostrou: o CSS de cada componente do DS entra
DEPOIS do da experiência, então utilitário do Tailwind que briga com a classe
do componente PERDE (o `justify-start` no `Chip` não pegava); e o `Avatar` do
DS não cai para as iniciais quando a imagem falha — a queda está em
`AvatarPerfil`, pelo `onErrorCapture`.

## Avatares

Personagens-símbolo, nunca rosto humano realista nem pessoa identificável — a
criança escolhe uma identidade para usar dentro de um feed que a está medindo.
A URL sai de `import.meta.env.BASE_URL`, **não** de `/`: o bundle é servido de
`{expId}/{versao}/` no bucket, e caminho absoluto aponta para a raiz da CDN.
