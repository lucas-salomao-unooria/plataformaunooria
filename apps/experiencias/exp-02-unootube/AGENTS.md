# apps/experiencias/exp-02-unootube — em quais fontes você confiaria

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp-02-unootube` · 4EF · `telemetria, progresso` |
| Dev | `pnpm --filter @edu/exp-02-unootube dev` → :5174 |
| DS | `@edu/ui/ds-unootube` na ficção, `@edu/ui/ds` na escola (a linha é a REVELAÇÃO — ver `packages/ui/AGENTS.md`) |
| api | `/unootube/*` (`sessao`, `salvos`, `credibilidade`, `ranking`, `reiniciar`) |
| e2e | `scripts/e2e/estudante/03-unootube.mjs` |

## Os 21 vídeos não estão no git nem no bundle

~52 MB de mp4. Em dev, `public/videos/` (gitignorado) é servido pelo Vite em
`./videos`; em produção o build recebe `VITE_VIDEOS_BASE_URL` apontando para o
bucket de assets via CDN (`docs/INFRA.md`). O `base: "./"` do Vite é o que
mantém o caminho relativo válido dentro do path versionado do bucket. Clone
novo = feed sem vídeo, e isso é esperado, não bug.

## Estado que o navegador apagaria mora em memória

A ordem do feed é Fisher-Yates a cada abertura, e a regra "não repetir o
primeiro vídeo da abertura anterior" vive **em memória** — o app de origem usava
`sessionStorage`, que em iframe cross-origin é particionado ou bloqueado.

## O ranking do cliente espelha o do servidor, desempate incluído

`src/lib/ranking.ts` repete os desempates de `regras.ts` da api para a posição
mostrada bater com a calculada. São duas implementações do mesmo critério de
propósito (a api continua sendo quem corrige, regra 3): mudou lá, muda aqui, e
o teste `ranking.test.ts` é o que segura.

## A voz que acompanha o estudante é uma função pura

`src/lib/dicas.ts` — a linha sob o reprodutor é a única voz durante o feed. Fica
numa função pura, e não em texto espalhado pelos componentes, para o que a
criança lê ser auditável de um lugar só.
