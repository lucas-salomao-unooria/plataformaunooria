# `scripts/e2e` — a suíte de ponta a ponta

Abre o produto num navegador de verdade, com uma pessoa de verdade logada, e
percorre cada tela como quem a usa. Typecheck verde não pega ícone virando
texto, iframe vazio, feed sem posts nem cor ilegível — isto pega.

```bash
node scripts/e2e/rodar.mjs                # tudo, na ordem canônica
node scripts/e2e/rodar.mjs professor      # só um papel
node scripts/e2e/rodar.mjs estudante/02   # só uma suíte
node scripts/e2e/rodar.mjs --deck         # tudo + deck (.pptx) + vídeos (.webm)
node scripts/e2e/publico/01-landing.mjs   # cada suíte roda sozinha, direto
```

Pré-requisitos: a plataforma no ar (`pnpm dev` **ou** `pnpm docker:dev`, nunca
os dois), o seed (`SEED_SENHA=… pnpm --filter @edu/api seed` e `seed:demo`) e os
navegadores do Playwright (`pnpm exec playwright install chromium`). A suíte da
Vila do Lume usa o **Chrome do sistema** — sem ele ela roda no Chromium e avisa
que a checagem de pointer lock não valeu.

## Organizada por PAPEL

| Pasta | Quem é | O que cobre |
|---|---|---|
| `publico/` | ninguém logado | landing, login, roteamento por papel |
| `estudante/` | a criança | hub de missões e as quatro missões, ponta a ponta |
| `professor/` | o docente | turmas, trilha, criar atividade, conduzir, plano de aula, bem-estar, resultados |
| `gestor/` | a secretaria da escola | importar, enturmar, senhas, quem trabalha em duas escolas |
| `admin-contrato/` | a rede | escolas, regionais, OneRoster, períodos, transferência, análise de produto |

Por papel, e não por experiência, porque é o crachá que decide o que a pessoa
alcança — e porque a organização antiga, pelo nome da experiência, escondia as
telas da plataforma, que são a maioria. O porquê inteiro, com as alternativas
descartadas, está na **ADR-51**.

**A ordem importa** e está fixada no runner: `publico` não depende de nada;
`estudante` PRODUZ o estado (runs, partidas, sessões) que `professor` lê; e
`gestor`/`admin-contrato` vêm por último porque importam gente e trocam senha.

## O manifesto é a fonte do deck e dos vídeos

Cada passo é registrado assim:

```js
await r.registrar(p, "feed-inicial", {
  titulo: "O feed monta",
  mostra: "Posts com autor, imagem, legenda e comentários.",
  prova: "A curadoria é server-side: o cliente não sabe o lado de nenhum post.",
  detalhe: `${quantos} cards no DOM`,
});
```

Isso vira `testes/<papel>/<suíte>/passos.json`, e é dele que o deck e os vídeos
nascem — o `gerar-deck.mjs` e o `gerar-videos.mjs` não conhecem o produto, só
desenham. Antes existia um roteiro de 66 KB mantido à mão, separado dos
scripts, e ele divergiu: descrevia telas que já não eram fotografadas.

**Passo sem `titulo`/`mostra`/`prova` entra no deck como "passo 7" e não ensina
nada a quem não escreveu o teste.**

## As três asserções da casca

```js
r.exigir(condicao, "texto");          // reprova a suíte se falhar
r.ressalva("o que a suíte não alcança, e por quê");
r.provocado(/422.*\/ativar/, "a trava de volume recusando a ativação");
```

`provocado` existe porque um roteiro que testa uma trava causa o erro de
propósito. Sem declará-lo, o 422 da ativação, o 400 do documento adulterado e o
403 do papel errado pintavam de vermelho justamente a corrida que provava que a
trava funciona — e vermelho que não significa nada é o começo do fim de um
smoke.

## Esperas que correm contra o erro

Espera cega paga o timeout inteiro e reporta o seletor que faltou, não a causa.
Uma geração de IA que falha em 306 ms deixava o roteiro esperando 180 s por uma
`<table>`. Use:

- `esperarOuFalharCedo(sucesso, erro, …)` — onde há alerta estável no DOM (as
  telas da plataforma, `.unooria-feedback-alert--error`);
- `esperarOuFalharPorHttp(pagina, sucesso, /rota/, …)` — onde não há: as
  experiências disfarçadas renderizam erro em `<p>` avulso, com classe diferente
  em cada tela. O corpo da resposta vai na mensagem.

## Evidências

`testes/<papel>/<suíte>/` — os prints, o `passos.json` e um `relatorio.md`
legível. **A pasta é apagada no começo de cada execução**: print de duas
corridas na mesma pasta conta uma história que nunca aconteceu. `testes/` inteira
está no `.gitignore` — tudo ali é reproduzível rodando a suíte de novo.
