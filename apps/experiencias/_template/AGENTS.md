# apps/experiencias/_template — cru de INTERFACE, completo de FIAÇÃO

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias` (o passo a passo de
"como criar uma experiência nova" está lá).

`pnpm new:exp <código>` (ADR-110: `exp06ef3b` ou `app-NN-nome`) copia esta pasta e troca `exp-template` pelo id em
`package.json`, `public/experiencia.json`, `src/lib/tipos.ts` e `README.md`.
**Não é para ser usada direto** e não entra em nenhum deploy (o `deploy.yml`
a pula pelo nome).

## O que ele traz (e a próxima experiência nasce com)

| Arquivo | O que é | O que trocar primeiro |
|---|---|---|
| `public/experiencia.json` | manifesto completo: `id, nome, versao, produto, series, unidade, publico, capabilities, permissoes, verbos` | tudo — e `permissoes` só com o que o iframe precisa (`forms` se houver `<form>` do DS) |
| `package.json` | scripts iguais aos das outras experiências; DS `^0.2.2` + `@edu/ui` + `vitest` | a porta do `dev` (próxima livre em `apps/hub/lib/experiencias-dev.ts`, e no `CORS_ORIGINS` da api) |
| `src/main.tsx` | folhas da seção `unooria` (componente + FONTE) | acrescentar a seção do clone (`<secao>.css` + `fonts/<secao>.css`) |
| `src/bootstrap.tsx` | handshake `createExperiencia`, singleton, telemetria, primeira leitura, erro reportado pelo SDK | a primeira leitura: `progresso` → `GET /<slug>/sessao` quando houver módulo na api |
| `src/App.tsx` | a tela de exemplo, só com `Button` de `@edu/ui/ds` | tudo |
| `src/lib/tipos.ts` | `EXP_ID`, `EXP_VERSION`, tipos do contrato que a tela vê | espelhar o `contrato-de-rotas.ts` do módulo |
| `src/lib/api.ts` | `api.get/post`, `concluir`, `enviarEstado`, `reportarErro`, `statusDoErro` | acrescentar `put/patch/delete` se a missão usar |
| `src/lib/telemetria.ts` | o vocabulário `verbo:objeto` da missão, num lugar só | os eventos — e o `verbos` do manifesto junto |
| `src/lib/textos.ts` | o que a TELA escreve, em pt-BR | tudo |
| `src/estilos/globals.css` | layout e compensações marcadas; cor só por token | separar as duas famílias quando houver clone |
| `src/versao.test.ts` | versão em três lugares, id, e o manifesto no vocabulário fechado | nada — ele é a rede |
| `README.md` | rodar, onde as coisas estão, tabela de telemetria | preencher |

## O que ele NÃO traz, de propósito

**Componente de interface.** Botão, campo, diálogo, ícone: vêm do
`@unooria/design-system` pela ponte do `@edu/ui`, na seção que a experiência
imita. Acrescentar componente de UI a este template é criar um padrão local que
48 experiências vão copiar — e que nunca mais sai. Faltou componente? O
procedimento de três passos está em `docs/regras/design-system.md`: procure,
use, ou peça no `storybook-unooria` com compensação local MARCADA.

**Módulo na api.** Gabarito, estado de missão e visão do professor vivem em
`apps/api/src/<slug>/` (molde: `manifesto-ia`, `rastro-boato`). O template só
mostra ONDE a experiência o chama (`bootstrap.tsx`, `lib/api.ts`).

## Fiação: mudou aqui, muda em todas?

Não. A experiência nasce **copiada, não linkada**: o que mudar aqui vale para a
próxima, e as que já existem ficam como estão. Mudança de fiação que precisa
valer para todas é mudança no `@edu/sdk`. Por isso este template segue de perto
a experiência mais recente (exp08ef4b): quando uma missão nova consolidar um
padrão melhor, ele volta para cá no mesmo PR — senão a próxima nasce velha,
como a exp01ef1b nasceu em React 18 porque o template estava em 18.
