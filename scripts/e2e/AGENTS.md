# scripts/e2e — a suíte de ponta a ponta

Complementa o `AGENTS.md` da raiz.

**A doutrina desta pasta é o `README.md` ao lado, e ele não entra sozinho no seu
contexto: leia-o antes de escrever ou alterar uma suíte.** O que está aqui é só
o que decide se você precisa abri-lo.

- **Tela nova ou alterada = passo novo, com `titulo`/`mostra`/`prova`.** O deck e
  as legendas dos vídeos nascem do `passos.json`, não de um roteiro à mão — que
  existiu, com 66 KB, e divergiu.
- **A suíte vai pelo PAPEL de quem usa, não pela experiência** (ADR-51), e a
  ordem do runner não é alfabética: `estudante` PRODUZ o estado que `professor`
  lê, e a administração vem por último porque importa gente e troca senha.
- **A PASTA tem o nome do papel, e o runner monta o caminho a partir do array
  `PAPEIS` de `rodar.mjs`.** Renomear um sem o outro faz o `existsSync` devolver
  lista VAZIA — e o runner pula as suítes daquele papel em silêncio. Aconteceu
  na ADR-80: a suíte caiu de 29 roteiros para 19 sem um aviso, porque o array
  dizia `gestor_escola` e a pasta ainda se chamava `gestor`. Mexeu num, mexa no
  outro, e confira a contagem no cabeçalho (`══ suíte … · N roteiro(s) ══`).
- **Espera nova corre contra o erro** (`lib/smoke.mjs`: `esperarOuFalharCedo`,
  `esperarOuFalharPorHttp`). Espera cega paga o timeout inteiro e reporta o
  seletor que faltou em vez da causa — e quando ela é CURTA demais é pior:
  espere o DESFECHO, nunca o relógio. A `publico/02` esperava 3s fixos depois
  do clique no login; em 2026-09-10 o callback levou 4,5s porque era a primeira
  compilação de `/api/auth/[...nextauth]` no `next dev`, a foto pegou
  "Entrando…" e a verificação reprovou dizendo que a recusa **não aparece na
  tela** (ADR-97). O relatório não disse "não sei" — apontou um culpado errado,
  e o culpado apontado foi o produto.
- **Vigie o alerta só DEPOIS de o estado novo começar.** Quando o botão que
  dispara a ação fica dentro do alerta de erro anterior (o "Tentar de novo" da
  app-92), a vigilância vê o alerta ANTIGO e aborta antes de a ação começar —
  espere primeiro o estado `gerando` com `waitFor` puro. Em 2026-09-10 isso fez
  a `professor/09` reportar vermelho enquanto o banco gravava `pronto` na mesma
  corrida: falso negativo que manda investigar um produto que funcionou.
- **Estado de ONTEM não pode reprovar hoje.** A `professor/09` só conhecia "A
  planejar" e "Planejada"; uma semana que falhou na geração na véspera deixava a
  suíte sem candidata e o vermelho não era de quem estava rodando. Roteiro que
  procura item para agir aceita também o estado de FALHA — e ali é o caminho
  "Tentar de novo", que é o que mais precisa ser exercitado.
- **Tela com mais de um estado terminal LEGÍTIMO: espere a união e ramifique.**
  O relatório individual da Vila é o da ÚLTIMA partida fechada — que pode ter
  sido abandonada, e aí não há retrato POR DESENHO (a tela explica a ausência).
  A `professor/05` abria "o primeiro da lista" e esperava o conteúdo do caminho
  feliz: reprovava por timeout sempre que a última partida de quem calhava no
  topo tinha sido largada no meio (2026-09-11). O molde certo: esperar o
  locator-união dos estados possíveis (correndo contra o `ALERTA_DE_ERRO`),
  decidir pelo que a tela diz e provar CADA ramo; se o dado que o caminho feliz
  exige não existir em ninguém, reprovar com a frase da pré-condição — nunca
  com o seletor que faltou.
- **Conteúdo de `Collapse` fechado FICA no DOM.** `filter(...)` acha item de
  seção fechada, o Playwright o considera visível e o clique morre interceptado
  pelo contêiner. Abra os collapses antes de procurar (`role="button"` +
  `aria-expanded` no cabeçalho).
- **Rádio do DS se clica pelo PAPEL, nunca pelo texto do rótulo.** O `<input>`
  do `RadioGroup` é transparente e cobre o `<label>` inteiro: `getByText(rótulo)`
  resolve no `<span>`, e o clique morre em "<input> intercepts pointer events"
  até o timeout (a `professor/10`, 2026-09-25). Use
  `getByRole("radio", { name, exact: true })`.
- **Diálogo do DS sem NOME é defeito da tela, não do seletor.** Até a 0.2.2 o
  `Modal` só punha `aria-labelledby` no `role="dialog"` com o atalho `title=`;
  montado com `ModalTitle`, o diálogo ficava sem nome e
  `getByRole("dialog", { name })` esperava até o timeout com a janela aberta na
  foto (a `professor/10`, 2026-09-25). Corrigido na 0.2.3: o `Modal` liga o
  `ModalTitle` sozinho. Se voltar a acontecer, o conserto é na TELA
  (`aria-labelledby` + `id` no `ModalTitle`) ou no DS, nunca no seletor: sem
  nome, o leitor de tela também só diz "diálogo".
- **Erro provocado de propósito se declara** (`r.provocado(...)`), senão a
  corrida que prova que a trava funciona é a que pinta de vermelho.
- **`testes/` é descartável e está no `.gitignore`** — prints, deck e vídeos se
  reproduzem rodando de novo. Nunca commite nada de lá, e nunca compare prints
  de duas corridas na mesma pasta: ela é apagada a cada execução.

Rodar só o papel afetado (`node scripts/e2e/rodar.mjs professor`) é o caminho
normal; a suíte inteira leva o tempo de uma pessoa almoçar.
