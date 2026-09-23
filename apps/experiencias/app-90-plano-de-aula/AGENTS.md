# apps/experiencias/exp-90-plano-de-aula — ferramenta do professor

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp-90-plano-de-aula` · `publico: "professor"` · `series: []` · `telemetria, ia` |
| Dev | `pnpm --filter @edu/exp-90-plano-de-aula dev` → :5175 · hub `/professor/plano-de-aula` |
| DS | `@edu/ui/ds` (plataforma — não há disfarce a proteger aqui) |
| api | `/planos` (+ `/planos/referencias/disponiveis`) — ver `apps/api/AGENTS.md` |
| e2e | `scripts/e2e/professor/03-plano-de-aula.mjs` (a conta sai de `credenciais-demo.csv` via `conta("professor")`, nunca de login fixo; `seed:demo` importa as referências) |

## A geração é assíncrona, e a tela é escrava do status

`POST /planos` responde **202**; a api gera em background. O cliente faz polling
em `GET /planos/:id` e `telaDoStatus` (`src/lib/estado.ts`) é a única a decidir
onde o professor está. Não invente estado local paralelo ao status: o professor
recarrega a página no meio de uma geração de minutos, e o que traz ele de volta
ao lugar certo é o status do servidor.

## O export é `.doc`, não `.docx`, e é do cliente

`src/lib/exportar-doc.ts` monta um HTML com os namespaces do MS Office — o Word
abre como documento. Sem servidor e sem lib. DOCX de verdade (zip) só se um
cliente reclamar; até lá, trocar isso é somar dependência para resolver problema
que ninguém tem.

## Cada status HTTP tem uma frase que o professor entende

`mensagemDoStatus` traduz o status em texto de tela ("ainda não há material de
referência para essa disciplina e série" para 400). Erro novo na api = frase
nova aqui, senão o professor recebe o texto genérico e abre chamado.
