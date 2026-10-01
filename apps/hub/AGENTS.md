<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- As regras acima são geradas pelo Next e ficam entre os marcadores.
     Tudo abaixo é do projeto e sobrevive a uma regeração. -->

# apps/hub — Next.js (App Router)

Complementa o `AGENTS.md` da raiz.

**A raiz (`/`) é o SITE PÚBLICO ENTRE REDES** (2026-09-16, ADR-107): sem sessão,
renderiza `components/site/` — porte 1:1 de um material aprovado fora deste
repositório, com CSS, tipografia e movimento PRÓPRIOS. **O DS não vale ali**: ele
começa na porta do login. As regras do porte (o que é cópia literal, o que
mudou de dono e como conferir por medida) estão em
[`components/site/AGENTS.md`](components/site/AGENTS.md). Com sessão, `/`
continua roteando para a home do papel: o `login-form` e o `trocar-senha` fazem
`router.replace("/")` e dependem disso.

**A landing ANTERIOR (ADR-40) não foi apagada**: ela responde em
`/landing-anterior`, com `noindex`, e `components/landing/` continua no lugar —
`/privacidade` e `/termos` montam o `FundoAnimado` e a folha dela. Duas
armadilhas medidas continuam valendo para esse componente: o cleanup do shader
NÃO pode chamar `loseContext()` (o Strict Mode remonta o efeito no mesmo canvas
e o contexto volta perdido — fundo em branco), e cor de ícone vai pela prop
`color` do `Icon`, não por classe (a folha do DS vence e o ícone sai preto).
Suíte: `node scripts/e2e/rodar.mjs publico` (o site e o login; só o hub).

**`/privacidade` e `/termos` são a MESMA superfície pública da landing**
(ADR-70), alcançadas pelo rodapé dela. `components/legal/` importa
`landing.css` e monta o mesmo `FundoAnimado` — não copie a nav, o fundo nem a
escala tipográfica para cá: a cópia diverge na primeira mudança de marca, e as
duas páginas passam a parecer de outro produto justo onde a confiança está sendo
decidida. **O conteúdo entra como DADO** (`SecaoLegal[]` com `id`, `titulo`,
`conteudo`), nunca como marcação livre: sumário, numeração e âncora saem da
mesma lista que renderiza as seções, então o índice não pode prometer um item
que o corpo não tem. Duas proibições que já foram rejeitadas em revisão:
**nenhuma `<table>`** no texto legal (célula altíssima e rolagem lateral no
celular, que é onde a família abre o link — use `.legal-card`) e **nenhum
`[A DEFINIR]` espalhado**; o que depende do contrato mora no bloco
`IDENTIFICACAO` no topo de cada página, e o que falta decidir tem uma seção
final própria. **O texto só afirma o que o código faz** — a ADR-70 lista as
promessas que hoje seriam falsas (retenção, exclusão por titular, log de acesso,
dados no Brasil, consentimento). Suíte: `publico/03-documentos-legais`.

**Header: um só para todos os papéis.** `components/header-plataforma.tsx`
(marca → home do papel, e o `MenuDaConta` com nome, série/papel e avatar) é o header de
`/estudante`, `/professor`, `/admin`, `/analise` E de `/exp/*` — uma cópia por
área diverge, e a experiência ficaria sem nenhum. A casca visual (CSS do DS,
compensações, fontes) mora em `components/casca-plataforma.tsx`, e não no layout
do grupo `(plataforma)`, porque `/exp/*` e `/dev-embed` estão fora do grupo e
também precisam dela. A regra de ouro vale um nível abaixo: o header é chrome do
HUB, desenhado ACIMA do aparelho — dentro do iframe nada da marca institucional
entra.

**O "Sair" mora no menu do avatar, não na barra** (`components/menu-da-conta.tsx`,
`HeaderMenu` do DS). Solto na barra como um `Button variant="ghost"`, seria a
ação mais destrutiva do header com o mesmo peso visual da marca, a um clique de
distância.
Duas coisas para saber antes de mexer nele:

- **O nome e o papel moram DENTRO do `MenuDaConta`, e é obrigatório.** A tira do
  `HeaderMenu` é um overlay ancorado à esquerda do gatilho e o componente assume
  espaço vazio ali. No nosso header ali fica a identidade: devolver o bloco para
  o `header-plataforma.tsx` faz o item "Sair" abrir DESENHADO EM CIMA do nome.
  Passa no typecheck, passa no build, e só aparece abrindo o menu.
- **Item de menu novo precisa de tela que exista.** "Trocar senha" parece o
  próximo item óbvio e é um link morto: `middleware.ts` devolve quem já trocou
  para a home do papel. Menu curto é melhor que menu com item que não leva a
  lugar nenhum.

## O detalhe está na pasta

O que vale para uma área vive no `AGENTS.md` dela, e carrega sozinho quando a
sessão abre a pasta:

| Pasta | O que está lá |
|---|---|
| [`app/`](app/AGENTS.md) | os layouts de área: a trilha, e o remonte ao trocar de escola |
| [`app/(plataforma)/admin/`](<app/(plataforma)/admin/AGENTS.md>) | a área do gestor: regionais e escolas, vínculo, relatórios, vocabulário |
| [`app/(plataforma)/professor/`](<app/(plataforma)/professor/AGENTS.md>) | a sala de aula e o guia da aula |
| [`app/(plataforma)/professor/entre-redes/`](<app/(plataforma)/professor/entre-redes/AGENTS.md>) | a ficha da missão: o despachante, equipes, evidência, A Seleção |
| [`app/(plataforma)/unooria/`](<app/(plataforma)/unooria/AGENTS.md>) | o painel da fornecedora e o interruptor na porta do produto |
| [`app/exp/`](app/exp/AGENTS.md) | o embed da experiência, e a allowlist do BFF |
| [`components/`](components/AGENTS.md) | a casca e as medidas: marca, fontes, alturas, rolagem |
| [`components/site/`](components/site/AGENTS.md) | o site público: o que é porte literal e como conferir |
| [`components/agente-professor/`](components/agente-professor/AGENTS.md) | o chat do agente de IA do professor: a rota de stream (exceção ao BFF de 180 s), quem aborta o turno, o markdown seguro |
| [`lib/`](lib/AGENTS.md) | log, OpenTelemetry, Clarity e os sinais do navegador |

**Área nova ganha `AGENTS.md` + `CLAUDE.md` de uma linha**, e entra nesta tabela
no mesmo commit.

## Papéis e roteamento

`lib/papeis.ts` é contrato congelado com a api (`apps/api/src/auth/claims.ts`):
seis papéis (a seção "Papéis: seis" abaixo), replicados em quatro fontes que precisam concordar sem
compartilhar código — o validador do token, este arquivo (que o middleware edge
importa), o `CHECK` no Postgres e o atributo `perfil` do WSO2. `/estudante` e
`/exp/*` são a MESMA área no middleware.

**Escola ativa é estado de SESSÃO.** Quem tem mais de uma escolhe no cabeçalho
(`components/seletor-de-escola.tsx`); a troca passa por `POST /api/escola-ativa`,
que valida contra `GET /escolas/minhas` **da api** — nunca contra a lista que o
cookie carrega.

**A recusa de login vem de `lib/motivos-de-login.ts`, não escrita na tela**
(ADR-97). São três mensagens — credencial, api indisponível, limite por minuto —
e **nenhuma diz qual metade errou**: "este usuário não existe" transforma o
login num verificador de logins válidos da rede. O `authorize` só sabe recusar
devolvendo `null`, e todo `null` chega ao cliente como a MESMA
`CredentialsSignin`; o que distingue os motivos é o `code` de uma subclasse
dela, que é o único campo que o `@auth/core` carrega até o `signIn`. Motivo
novo entra nesse arquivo, nas duas pontas de uma vez — literal repetido no
formulário cai calado na recusa de credencial, e aí a tela culpa a pessoa por
uma falha nossa. O `fetch` do login tem prazo (8s): sem ele, api pendurada
deixa a pessoa em "Entrando…" para sempre, sem mensagem.

## Papéis: seis, e o formulário sai da cadeia (ADR-80)

`lib/papeis.ts` é a cópia edge-safe do vocabulário da api, e também carrega
a **cadeia de atribuição** (`papeisQueCria`). Duas coisas a respeitar:

- **`rotuloDoPapel` é um `Record` EXAUSTIVO, não uma escada de `if`.** Papel novo
  sem rótulo passa a ser erro de compilação; com a escada, ele caía no `return`
  final e aparecia no cabeçalho como "Estudante".
- **A lista de papéis do formulário de novo usuário sai de `papeisQueCria`**, não
  de um array fixo com um `if` para o papel de rede. Com a lista à mão, o papel
  novo aparecia para quem não podia criá-lo e a pessoa preenchia a tela inteira
  para receber 403 no fim. **Quem decide continua sendo a api** — isto só evita
  oferecer o que ela recusa.
- Os quatro papéis de gestão dividem a MESMA área do middleware. Quem separa o
  que cada um pode é o `RolesGuard` da api, item a item — nunca o middleware.
- **"Coordenação", não "Gestor"**, na interface: é a palavra que a rede usa, e
  ela vale no filtro de Usuários e no modal: um dizendo "coordenação" e o outro
  "gestor" para a MESMA coisa confunde quem opera.
