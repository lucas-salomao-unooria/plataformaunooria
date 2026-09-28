# exp04ef1b — Jornal da Escola: A Edição de Bento

4º ano EF, unidade 1 (Entre Redes). A dupla é editora do jornal da escola: escolhe
3 de 8 notícias de meios diferentes, publica a 1ª edição, vê o que ela causou nos
leitores (depois que o professor libera o resultado), monta a Chave do Editor —
fonte, data e autoria — quando o professor libera a revisão, republica e compara
as duas edições. Fecha com um desafio individual (P1/P2) fora da redação. ~50 min.
A doutrina da pasta está no `AGENTS.md`.

## Rodar

```bash
pnpm --filter @edu/exp04ef1b dev     # :5174, strictPort
# no hub: /exp/exp04ef1b  (ou /dev-embed?src=http://localhost:5174)
pnpm --filter @edu/exp04ef1b typecheck lint test build
```

Precisa de: a missão LIBERADA na turma do estudante (`liberacoes`, ADR-69), o
produto `entre-redes` ligado no painel da Unooria (ADR-87) e o módulo
`apps/api/src/jornal-escola` de pé. Sem pacote homologado, a turma roda o banco
padrão (a api o cria no primeiro `GET sessao`).

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake, primeira leitura (`GET sessao`), 403 | `src/bootstrap.tsx` |
| A máquina de telas, o polling, as ações | `src/app/jornal-app.tsx` |
| A redação (mesa, gaveta, página, Chave, leitores…) | `src/app/redacao/` |
| As peças de outra seção do DS (o post, a mensagem) | `src/app/pecas/` |
| O desafio final e as telas da escola | `src/app/escola/` |
| O contrato espelhado, `EXP_ID`, `EXP_VERSION` | `src/lib/tipos.ts` |
| `Meio` → `NewsMedium`, ícones | `src/lib/meios.ts` |
| As rotas (sempre pelo SDK) e a repetição | `src/lib/api.ts`, `src/app/conexao.ts` |
| Telemetria | `src/lib/telemetria.ts` |
| Copy que a TELA escreve | `src/lib/textos.ts` |
| Regras e rotas do servidor | `apps/api/src/jornal-escola/` |

## Telemetria (PRD §13)

Só ids (`n1`…`n8`, a posição na mesa) e números — nenhum texto, nome ou e-mail.

| ID | Verbo | Objeto | Quando | `resultado` / `contexto` |
|---|---|---|---|---|
| EVT-U01 | `attempted` | `missao:iniciar` | a primeira tela, depois do `GET sessao` | `{ retomada }` / `{ etapa }` |
| EVT-U02 | `progressed` | `etapa:entrar` | a cada etapa nova (E1…E6, EREV) | `{ etapa }` / `{ pedagogical_role }` |
| EVT-001 | `interacted` | `noticia:inspecionar` | toque num chip de pista | `{ tipo, abertas }` / `{ noticia_id, fase }` |
| EVT-002 | `scored` | `edicao:publicar` | o latch de cada edição, confirmado pela api | `{ edicao }` / `{ slots }` |
| — | `progressed` | `resultado:ver` | o resultado chegou (depois do portão) | `{ verificadas, percentual }` / `{ etapa }` |
| EVT-003 | `interacted` | `algoritmo:ordenar` | cada tentativa da Chave | `{ sucesso, tentativas }` / `{ etapa }` |
| EVT-004 | `interacted` | `transferencia:responder` | P1 ou P2 enviada | `{ questao }` / `{ etapa }` — **sem a alternativa** |
| EVT-U03 | `completed` | `exp04ef1b` | `concluir()` | `{ tempo_total_s }` (desde o `iniciadaEm` da sessão) / `{ versao }` |
| EVT-U04 | `interacted` | `aviso:inatividade` | 90 s sem toque numa tela em que a criança age | `{ segundos_sem_acao }` / `{ etapa }` |
| EVT-U05 | `attempted` | `erro:exibir` | um aviso apareceu: sem sinal, 429, sessão, rodada nova ou imagem | `{ codigo }` / `{ etapa }` |

Dois afastamentos do PRD: EVT-004 não leva `opcao_id` (o id da alternativa é o
nível para quem conhece a ficha — segredo de servidor, como na exp07ef1b), e
EVT-002 não leva `verificadas` (a tela não sabe na hora do latch; o número vai no
`resultado:ver`). Onde cada medida é LIDA: as colunas de `exp04ef1b_sessoes` e o
painel do professor (`/jornal-escola/turmas/:turmaId/painel`).

## A copy ESCRITA AQUI (para o PO revisar)

O que o sheet (`design/06-copy-strings-revisada.md`) não tinha, marcado em
`src/lib/textos.ts`:

- o nome "Bento" sobre o balão; "Abrindo a pista…";
- a linha do modal de publicar: "A 1ª edição vai para os leitores da escola e
  não pode mais ser trocada." (onde o sheet tinha a pergunta de motivo);
- "Enviar resposta" (motivo); "Aguardando o professor liberar a mesa de
  revisão..." (a espera da revisão, criada pelos dois portões);
- a calha da Chave: "N de 3 vagas preenchidas", "Testando a Chave…", "Esse bloco
  não abre a chave. Tente outro." / "Esses blocos…", "Voltou para a bandeja",
  "Blocos periciais", "Abrir a Mesa de Revisão";
- os marcadores das vagas: "Fonte sem confirmação", "Fato que já passou",
  "Ninguém assina", "Matéria verificada"; "Chave do Editor" no selo da revisão;
- "Comunidade da escola" (o balão de `erev.reacao.comunidade_grata`), "1ª
  edição" / "2ª edição";
- E6: "Encaminhada" (o selo do balão) e "Responder";
- os avisos do 429 ("A gráfica está com muitos pedidos agora…") e do
  `rodada-mudou` ("O professor atualizou a mesa de notícias…");
- "Tentar novamente", "Não deu para abrir a redação agora." e a tela de missão
  não liberada.

As vagas vazias juntam o nome do PRD e `e2.rotulo.cartao_vaga`: "Manchete
Principal — Vaga Disponível".

## Testes

- `src/versao.test.ts` — versão nos três lugares, manifesto no vocabulário
  fechado, e os valores do spec (porta, `viewport`, `forms`, capabilities).
- `src/lib/espelho.test.ts` — LÊ `vocabulario.ts` e `regras/passos.ts` da api como
  texto e compara as listas; `LAYOUTS` = `NEWSPAPER_LAYOUTS` do DS; os seis blocos
  da Chave têm ícone; cada meio tem `NewsMedium` e peça.
- `src/lib/textos.test.ts` — lê `TERMOS_PROIBIDOS_NA_TELA` de `invariantes.ts` e
  reprova a moldura que carimba notícia ou rotula criança; cobra as duas decisões
  (motivo fora do modal, síntese única).
- `src/lib/regras.test.ts`, `src/lib/api.test.ts` — as vagas, a bandeja da Chave, o
  `gateMudou`, o enunciado de P1, a repetição por status.
- `src/app/fluxo.test.tsx` — RENDERIZA a missão (jsdom + DS) contra
  `src/teste/api-falsa.ts`: o fluxo inteiro, o F5 em cada degrau e o 403.

O `jsdom` está declarado em `devDependencies` (`^30.0.1`, a mesma do `@edu/sdk`):
o lockfile sobe junto com o `pnpm install` da raiz.

## O `dist/` não leva gabarito, prompt nem a Chave

```bash
cd apps/experiencias/exp04ef1b && pnpm build
g() { find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -print0 | xargs -0 grep "$@"; }
g -l -E "publicavel|explicacao|consequencia|gabarito|descricaoImagem"   # vazio
g -l -E "systemInstruction|responseSchema|Você é um|generateJson"       # vazio (prompt)
g -l -E "BLOCOS_ISCA|BLOCOS_VALIDOS|iscas"                               # vazio (a Chave)
g -l -E "Você comprovou|Você começou a identificar|Manchete da notícia"   # vazio
g -oh -E ".{30}pilarEmFalta.{30}"   # só o `mapaDeMarcadores` lendo o campo do GET revisao
g -l sourceMappingURL                                                    # vazio
```
