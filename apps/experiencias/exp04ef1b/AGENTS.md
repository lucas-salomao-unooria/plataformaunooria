# apps/experiencias/exp04ef1b — em quais fontes você confiaria

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp04ef1b` · 4EF · `telemetria, progresso` |
| Dev | `pnpm --filter @edu/exp04ef1b dev` → :5174 |
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

## Vídeo que não chega não pode prender a missão

O `ShortsPlayer` do DS deriva `waiting` só de `waiting`/`playing` — **não escuta
`error`**. Com o mp4 em 404 (bucket de assets sem a mídia daquele contrato) o
navegador emite `waiting`, depois `error`, e `playing` nunca chega: o estado de
carregamento ficava `true` para sempre. E como Salvar e Curtir são
`disabled={carregandoEste}` pela nota `ETAPA 2` (não salvar sem assistir), a
missão ficava **impossível de concluir** — não só feia.

Por isso o `Feed.tsx` mantém um conjunto próprio de vídeos falhos: listener de
`error` no elemento (o `videoRef` do DS entrega o `<video>`), checagem de
`node.error` para o erro que chegou antes do efeito, e um teto de 15s para a
rede que engasga sem nunca emitir `error`. Vídeo falho sai de "carregando", as
ações voltam, e a dica muda (`lib/dicas.ts`, variante `falhou`).

Enquanto a seção `unootube` não publicar um estado de erro no reprodutor, isso é
compensação local e está marcada como tal em `IndicadorCarregando.tsx`.
