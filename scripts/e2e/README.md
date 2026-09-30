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
| `professor/` | o docente | turmas, trilha, criar atividade, conduzir, plano de aula, bem-estar, resultados, guias de aula, planejamento de ensino |
| `gestor_escola/` | a secretaria da escola | importar, enturmar, senhas, quem trabalha em duas escolas |
| `gestor_contrato/` | a rede | escolas, regionais, OneRoster, períodos, transferência, análise de produto |
| `arquivados/` | NINGUÉM — não é papel | as suítes das experiências arquivadas (ADR-116), guardadas como estavam e FORA do runner: uma arquivada não abre para ninguém, e a suíte só reprovaria (ver `arquivados/AGENTS.md`) |

Por papel, e não por experiência, porque é o crachá que decide o que a pessoa
alcança — e porque a organização antiga, pelo nome da experiência, escondia as
telas da plataforma, que são a maioria. O porquê inteiro, com as alternativas
descartadas, está na **ADR-51**.

**A ordem importa** e está fixada no runner: `publico` não depende de nada;
`estudante` PRODUZ o estado (runs, partidas, sessões) que `professor` lê; e
`gestor_escola`/`gestor_contrato` vêm por último porque importam gente e trocam senha.

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
  em cada tela. O corpo da resposta vai na mensagem. Cobre também a requisição
  que **não chega a ter status** (abortada, recusada): é a que mais engana,
  porque o `fetch` do cliente morre sem resposta, a tela nunca avança e a
  espera cega paga o timeout inteiro para reportar o seletor.

**Vigiar alerta só depois de o estado novo COMEÇAR.** Quando o botão que dispara
a ação está DENTRO do alerta de erro anterior (o "Tentar de novo" da app-92 é o
caso), o `esperarOuFalharCedo` seguinte vê o alerta ANTIGO e aborta antes de a
ação começar. Espere primeiro o estado `gerando` com `waitFor` puro — vigiar o
alerta ali é vigiar o passado. Em 2026-09-10 isso fez a `professor/09` reportar
vermelho enquanto o banco gravava a semana como `pronto` na mesma corrida: o
pior falso negativo, porque manda investigar um produto que funcionou.

## O que derruba o SMOKE do deploy, e não é o produto

O `deploy.yml` roda `publico/01-site` contra o ambiente recém-publicado. Duas
coisas o derrubaram em 2026-09-18, com o site correto e as verificações verdes:

**1. O 401 do trace do navegador.** Em superfície pública o hub instrumenta, o
BFF recusa sem sessão e o exportador descarta o lote — está escrito e aceito em
`apps/hub/instrumentation-client.ts`. Como dev e hml amostram 5% das sessões
(`OBS_TRACE_RATIO_CLIENTE`), ele aparece em **uma corrida a cada vinte**: o
smoke ficava vermelho por sorteio. As três suítes de `publico/` declaram esse
erro com `r.provocado(/observabilidade\/v1\/traces/, …)`.

**Regra geral:** erro de console que o PRODUTO decidiu produzir é `provocado`,
com o motivo. Sem isso, o vermelho aparece quando o sorteio quiser, e a próxima
pessoa procura regressão onde não há.

**2. O print que estoura o tempo.** O site público ganhou um campo de estrelas
fixo que anima sem parar; num runner de CI sem GPU, o `Page.captureScreenshot`
chegou a passar dos 30s numa página de 20 000 px e derrubou o deploy de hml com
**28 verificações verdes**. O `registrar` do `roteiro.mjs` agora dá 60s e, se
ainda assim estourar, repete a captura com `emulateMedia({reducedMotion:
"reduce"})` — o desligamento que os próprios efeitos respeitam, então o quadro
é o mesmo, parado.

## O 404 do BFF que não é do produto

`GET /api/plataforma/<prefixo>/…` respondendo **404 `{"mensagem":"rota não
permitida"}`** com o prefixo JÁ escrito na allowlist de
`apps/hub/app/api/plataforma/[...path]/route.ts` é o `next dev` servindo o
route handler VELHO. Em 2026-09-25 o `git pull` que trouxe `equipes` e
`evidencias` para a allowlist recompilou o chunk no disco, mas o processo do hub
(no ar havia dois dias) seguiu recusando os dois prefixos: a `professor/11`
reprovou dizendo que "a api devolve 404" para um perfil que a api devolvia com
200. As páginas se atualizaram — só o route handler não.

Três sinais separam isso de um bug: o log do hub tem `codigo:
"bff-prefixo-recusado"` com o prefixo novo; a api não tem query nenhuma
naquele segundo; e a mesma rota, chamada direto na api com um token de
`/api/exp-token`, responde. O remédio é reiniciar o hub
(`docker restart unooria-plataforma-hub-1`) e repetir as suítes daquela janela.

## Evidências

`testes/<papel>/<suíte>/` — os prints, o `passos.json` e um `relatorio.md`
legível. **A pasta é apagada no começo de cada execução**: print de duas
corridas na mesma pasta conta uma história que nunca aconteceu. `testes/` inteira
está no `.gitignore` — tudo ali é reproduzível rodando a suíte de novo.
