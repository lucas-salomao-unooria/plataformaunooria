# apps/experiencias/exp06ef1b — O Júri Estadual de Projetos

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp06ef1b` · 6EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` · versão **0.4.0** (PRD v2) | `:5185` (`strictPort`), hub `/exp/exp06ef1b` | `@edu/ui/ds-unoovista` (clone, DS `^0.2.11`) + `@edu/ui/ds` (escola) | `apps/api/src/juri-estadual` ↔ `/juri-estadual/*`; enquetes em `/evidencias/exp06ef1b/perguntas/*` (E14) | `scripts/e2e/estudante/13-juri-estadual.mjs` (dois estudantes + a professora) |

## O passo manda na tela

A api devolve o passo JÁ reconciliado com a etapa da turma
(`regras/passos.ts#passoEfetivo`). A tela lê `sessao.passo` e nada mais —
`passoDoEstudante` é o cru. O espelho do cliente (`lib/regras.ts#passoEfetivo`,
`lib/tipos.ts`) existe para o teste provar a igualdade; `lib/espelho.test.ts` LÊ
os arquivos da api (`vocabulario.ts`, `regras/passos.ts`, `conteudo.ts`,
`contrato-de-rotas.ts` e a ficha) e reprova divergência nas listas, nos números e
nos CAMPOS dos schemas que a tela lê.

| Passo | Tela | Quem fala | Componentes do DS |
|---|---|---|---|
| `credencial` | E1-ALU-01 — o crachá, modal sobre a timeline DESFOCADA | comissão (clone) | a casca do app desfocada e `inert` (`TopBar`, `PostCard` sem foto, `TabBar`), `BottomSheetUnv` modal (não fecha), `IconUnv`, `BadgeUnv` (`@jurado_oficial`), `ButtonUnv` |
| `feed` | E2-ALU-01/02 — o feed | app | `TopBar` ("Unoovista" + `BadgeUnv` `@jurado_oficial`, `clone/cabecalho.tsx`), `PostCard` (carrossel de 3 fotos, "Foto 2 de 3"; `errorLabel`/`errorDescription` = `PLACEHOLDER_DIEGETICO`), `GestureHint`, `ButtonUnv` (setas; "...mais"/"menos"), `FloatingButton` (a cédula), `TabBar` (4 abas), `NotificationItem` e `ProfileHeader` (as abas), `SnackbarUnv` |
| `feed` (cédula aberta) | E3-ALU-01 — a cédula, 4 elementos | app | `BottomSheetUnv` modal, `InlineHint` `friction` num `role="alert"` (E3-SIS-01, 60 s), `Escolha` (`ListItem` + `AvatarUnv`), `Chip` (Sim / Com certeza), `ButtonUnv` |
| `lacrada` | E3-ALU-02 — o voto lacrado e a espera | comissão | `TopBar`, `IconUnv`, o carimbo "Protocolo #…" e a linha da espera |
| `galeria` | E4-ALU-01/02/03 — a Galeria Oculta e a revisão | comissão, depois app | `NotificationItem` (a comissão), `InlineHint` `friction` (o badge com a taxa REAL), `SearchField`, `Chip` (as hashtags da api), a grade de 3 colunas com `ButtonUnv` "Inspecionar Projeto", `BottomSheetUnv` ("Ficha Técnica de Auditoria"; a troca do voto), `Escolha`, `BadgeUnv` |
| `revisada` | — (passagem) | — | a tela pede `POST passo {para:"cadeia"}` sozinha, também num F5 |
| `cadeia` | E5-ALU-01 — a ponte do Léo, o par simulado e a cadeia | **escola** | `ScrollBar`, `Logo`, `SectionHeader`, `Card` + `Tag` (os dois lados do par), `PuzzleBlock`, `PuzzleTrack`, `AlertBox` (a errada e a certa), `Button` |
| `mariana` | E6-ALU-01 — o caso Mariana | **escola** (PRD §10.1) | `ScrollBar`, `Logo`, `Card` (o caso), `RadioGroup` ×2 (mecanismo, atitude), `Button` |
| `enquetes` | E6-ALU-02 — a consulta nos Stories | comissão, tema ESCURO | `StoryViewer`, `StoryPoll`, `ButtonUnv` |
| `fim` | E6-ALU-03 — a conclusão | comissão, depois **escola** | `TopBar`, `IconUnv` (a comissão); `Card` da plataforma numa faixa `.fim__escola` (o infográfico) |
| 403 | missão não aberta aqui | **escola** | `AlertBox` |

A tela só anda quando a api responde: nenhum latch é otimista. A única coisa
otimista é o coração (a curtida é ESTADO, e o servidor devolve a lista inteira a
cada ida).

## A fronteira do disfarce é QUEM FALA

Do crachá à galeria quem conduz é a comissão da mostra, dentro do Unoovista —
inclusive a revelação (a Galeria Oculta é um comunicado da comissão). A cadeia sai do
clone: são a Unooria mostrando a engrenagem, e dentro do app
a explicação voltaria para a ficção que a missão acabou de desmontar. A
consulta nos Stories e o topo do fim voltam ao clone, porque quem pergunta e
quem homologa é a comissão. Os avisos globais seguem a mesma regra (`app/avisos.tsx`,
`regras.ts#vozDaTela`): `SnackbarUnv`/`BottomSheetUnv` no clone, `AlertBox` na
escola.

A tela de abertura (o crachá) é do clone, e não é exceção à regra da entrada: a
escola fala ANTES dela só quando a porta está fechada (o 403).

**PRD v2 §10.1 mudou dois lugares**: o caso Mariana passou para a escola (é a
transferência para a vida da criança, fora da mostra), e o fim tem as DUAS
vozes — a comissão no topo (casca do Unoovista) e o infográfico da Unooria
numa faixa própria embaixo (`.fim__escola`: fundo, fonte e `Card` da seção
`unooria`, nenhum token `--unv-*`). Não é a plataforma vestida de app, e o
inverso também não acontece: a peça da Unooria não leva a barra nem as abas do
clone.

## O voto e a revisão (PRD v2)

- **Salvar** grava o evento e NÃO pesa no feed (só curtir e ficar pesam).
  **Comentar e compartilhar** respondem com a linha da comissão
  (`e2.rotulo.comentarios_desabilitados`) e não viajam.
- **A cédula tem quatro elementos**: o cabeçalho (título da folha), os
  estandes do feed, a certeza ("Sim" / "Com certeza") e o botão. Sem
  justificativa, sem frase grifada.
- **A revisão tem dois botões**: "Manter meu voto inicial" (travado, com a
  explicação, até a criança abrir UM oculto — a api responde 409
  `galeria-sem-inspecao` se a tela errar) e "Confirmar Voto Revisado" (abre a
  lista dos quinze outros). Depois do latch, a tela pede a cadeia sozinha.
- **Saíram** a justificativa, o complementar e a rodada de desvio (rotas,
  telas, etapa e passo). As colunas antigas ficam no banco, sem uso.

## As quatro abas

`clone/abas.ts`. **Início** é o feed; **Busca** responde que está fechada no
julgamento (a busca é a ferramenta da Galeria Oculta, e abri-la antes deixaria a
criança furar a bolha antes de o feed formá-la); **Notificações** mostra a
notificação que a criança já recebeu (o crachá); **Jurado** é o perfil do
crachá. Nenhuma abre fluxo novo; o feed só se esconde nas outras.

## O relógio de 8 minutos é do servidor

O primeiro `proximo: true` liga o relógio (`encerraEm`); recarregar não zera.
A tela agenda UMA ida vazia para `encerraEm` (`regras.ts#esperaAteEncerrar`); o
servidor responde `tempoEsgotado` e `cedulaLiberada`. A barra da cédula só
acende com `cedulaLiberada` — a tela nunca decide sozinha. Sem cronômetro
visível (a copy não tem a string).

## A cédula aberta: o aviso de 60 s e o batimento de 15 s

`app/inatividade.ts#useOciosidade`: 60 s sem toque com a cédula ABERTA acende a
linha da comissão no topo da folha (`role="alert"`). Enquanto a folha está
aberta, `POST cedula/batimento {aberta:true, segundosSemToque}` a cada 15 s
(204, por `postSemResposta`); ao fechar, `{aberta:false}`. É o sinalizador de
ociosos do painel do professor.

## O feed é servido um post por vez

`POST /juri-estadual/passo {para:"feed"}` serve a abertura (4 posts, um de cada
área). Cada vez que o ÚLTIMO post servido fica ≥ 60% visível, a tela pede o
próximo (`POST feed/eventos` com `proximo: true`), junto com as curtidas e as
permanências da fila. A fila (`juri-app.tsx`) junta os eventos por 400 ms, manda
UMA ida por vez e guarda para qual tamanho de feed o próximo já foi pedido — o
mesmo fim não pede dois. Quem escolhe o post seguinte é o motor da api; a tela
não sabe a regra. Antes do voto, a fila é esvaziada (o voto vai DEPOIS das
últimas curtidas).

A permanência (`lib/permanencia.ts`) é um FATO por post (> 5 s seguidos com
≥ 60% visível), não o tempo somado.

## Polling SÓ na espera

`GET /juri-estadual/gate` a cada 3 s, só com `aguardandoOProfessor` (o passo
`lacrada`). Compara etapa, rodada e atividade (`regras.ts#gateMudou`); mudou,
relê a sessão. A galeria é lida (`GET galeria`) ao entrar no passo dela; o 403
`galeria-nao-liberada` relê a sessão em vez de mostrar a porta fechada.

## A galeria não manda texto

Da busca, a api recebe `{tipo:"buscar", busca:"hashtag"|"texto", area}` —
`regras.ts#classificarBusca` —, NUNCA o que foi digitado (texto livre de
menor). Uma busca conta quando a digitação para (1,2 s) ou no toque do chip, e a
mesma busca seguida não conta duas vezes. As ações vão numa fila sem bloquear a
tela, e a revisão do voto ESPERA a fila esvaziar: a evidência da EF06CO01 é
marcada no latch da revisão sobre o que a api já gravou.

`galeria/acoes` responde **204 sem corpo**, e o SDK faz `res.json()` em toda
resposta `ok`: o corpo vazio vira `SyntaxError` sem status, que a `tipoDaFalha`
leria como queda de rede e a `comRepeticao` repetiria para sempre.
`lib/api.ts#postSemResposta` trata o `SyntaxError` como o sucesso que ele é.

## Os latches e o F5

- **Voto** (LATCH 1) e **revisão** (LATCH 2) só existem quando a api confirma; a
  repetição de uma ida perdida volta 409 e a tela relê a sessão.
- O **carimbo** e a espera são a mesma tela (E3-ALU-02); o protocolo sai de
  `regras.ts#protocoloDoVoto`, o mesmo num F5.
- A **cadeia errada** é o **422 `ordem-incorreta`** (sem gabarito, a tentativa
  conta para a EF06CO03): `juri-app.tsx#conferirACadeia` o lê como "errada", não
  como falha.
- **Cadeia, cartões e enquetes** reabrem como estavam: a calha montada
  pela metade, os cartões tocados e a alternativa de cada enquete ficam no
  `sessionStorage` (`lib/memoria.ts`, só ids, chave = estudante + atividade +
  rodada). A api guarda a primeira resposta de cada enquete de qualquer jeito.
- A **dica do carrossel** não volta depois do primeiro deslize (memória).

## As enquetes pulam para o fim

Uma tentativa por pergunta, sem repetição: falhou (409, rede, 404), a consulta
encerra e o botão "Encerrar consulta" leva ao `POST concluir`. Nunca mostram
acerto. Da enquete, a telemetria leva a PERGUNTA, nunca a alternativa.

## O que o bundle NÃO sabe

A ordem certa dos blocos (os ids são opacos por sessão), o cartão
certo do caso Mariana, os pesos e o limiar do motor do feed, a área líder, os
estandes que o feed NÃO serviu (só descem no `GET galeria`, depois da liberação)
e o nível das alternativas das enquetes. `lib/tipos.ts` não tem campo para
nenhum deles. Depois do build:

```bash
cd apps/experiencias/exp06ef1b
find dist -name '*.js' | xargs grep -l -F -e "certo:" -e "LIMIAR_DA_BOLHA" -e "PESO_DA_CURTIDA" -e "Formação de bolha temática"   # vazio
```

## A interface: compensações e props do DS

As compensações locais do DS (cada uma com a lacuna e o pedido ao
`storybook-unooria`) e as props do DS que enganam moram em
[`src/app/AGENTS.md`](src/app/AGENTS.md), a pasta onde se escreve a interface.

## Ausências deliberadas

- **Sem busca antes do voto** (a aba Busca responde fechada).
- **Sem contagem de curtidas no post** (`PostCard.Likes`): a api não tem o
  número — inventar seria a tela mentindo.
- **Sem cronômetro na tela** (ver o relógio de 8 minutos).
- **Sem número no rótulo dos blocos**: a copy escreve "1. Suas interações…",
  e o número ENTREGARIA a ordem, que é o gabarito. Os rótulos vêm da api sem ele.
- **Sem avanço automático do Story** (WCAG 2.2.2); sem `PhoneFrame` (o aparelho é do hub).

## A copy

A fonte é `design/06-copy-strings-revisada.md` do PRD v2, chave por chave em
`lib/textos.ts`; o que a copy não tinha está marcado `ESCRITA AQUI` (o
inventário no `README.md`). O "75%" e os "12 projetos" da copy viram o número
REAL da sessão na mesma moldura. UMA exclamação na missão (a do Léo). O
`lib/textos.test.ts` cobra as duas, o teto de 25 palavras com as exceções
NOMEADAS (o crachá e o infográfico, literais do PO), os feedbacks da cadeia
iguais aos da api, e que nada antes da galeria diga "algoritmo", "bolha",
"filtro" ou "oculto".

## Vitrine (verificação visual)

Não mora no repositório. A receita: um `vite.config` fora da pasta com `root`
nesta experiência e um alias de `@edu/sdk` para uma SDK falsa que responde a api
por `?passo=` (`credencial`, `feed&posts=N`, `lacrada`, `galeria`, `cadeia`, `mariana`, `enquetes`, `fim`, `bloqueada=1`), fotografada pelo
Playwright do pnpm (`node_modules/.pnpm/playwright@*/`).
