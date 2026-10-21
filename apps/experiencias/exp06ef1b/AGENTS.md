# apps/experiencias/exp06ef1b — O Júri Estadual de Projetos

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| Manifesto | Dev | DS | api | e2e |
|---|---|---|---|---|
| `exp06ef1b` · 6EF · unidade 1 · `entre-redes` · `viewport` 375×812 · `permissoes: ["forms"]` · versão **0.7.0** (os ajustes do time, ADR-176) | `:5185` (`strictPort`), hub `/exp/exp06ef1b` | `@edu/ui/ds-unoovista` (clone, DS `^0.2.11`) + `@edu/ui/ds` (escola) | `apps/api/src/juri-estadual` ↔ `/juri-estadual/*` (ficha 6: as pastas do feed e a regra, sem enquetes) | `scripts/e2e/estudante/13-juri-estadual.mjs` (dois estudantes + a professora) |

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
| `feed` | E2-ALU-01/02 — o feed | app | `TopBar` ("Unoovista" + `BadgeUnv` `@jurado_oficial`, `clone/cabecalho.tsx`), `PostCard` (carrossel de 3 fotos, "Foto 2 de 3", e a 4ª lâmina "Bastidores do estande" — sem foto, `Media` sem `src`; com foto, texto embaixo (`.bastidor-do-post`); `errorLabel`/`errorDescription` = `PLACEHOLDER_DIEGETICO`), `GestureHint`, `ButtonUnv` (setas; "...mais"/"menos"), `FloatingButton` (a cédula), `TabBar` (4 abas), `NotificationItem` e `ProfileHeader` (as abas; "Suas pastas" no Jurado), `InlineHint` `neutral` (o pedido da comissão), `SnackbarUnv` |
| `feed` (Salvar) | as PASTAS (EF06CO01): a folha "Salvar em" guarda ou MOVE o post | app | `BottomSheetUnv`, `ListItem` por pasta (`aria-pressed`), `IconUnv` `bookmark`/`bookmarkFilled`, `ButtonUnv` ("Remover dos salvos") |
| `feed` (cédula aberta) | E3-ALU-01 — a cédula, 4 elementos; travada com `semPasta` > 0 | app | `BottomSheetUnv` modal, `InlineHint` `friction` (quantos faltam; e num `role="alert"`, E3-SIS-01, 60 s), `Escolha` (`ListItem` + `AvatarUnv`), `Chip` (Sim / Com certeza), `ButtonUnv` |
| `classificacao` | — (sessão antiga, `saindoDaSeparacao`) | — | `POST passo {para:"lacrada"}` sozinho |
| `lacrada` | E3-ALU-02 — o voto lacrado e a espera | comissão | `TopBar`, `IconUnv`, o carimbo "Protocolo #…" e a linha da espera |
| `galeria` | E4-ALU-01/02/03 — a Galeria Oculta e a revisão | comissão, depois app | `NotificationItem` (a comissão), `InlineHint` `friction` ("X de Y estandes"), `SearchField`, `Chip` (as hashtags; a área da grade), a grade de 3 colunas com `ButtonUnv` "Inspecionar Projeto", `BottomSheetUnv` ("Ficha Técnica de Auditoria"; a troca do voto, com os mesmos chips), `Escolha` |
| `revisada` | — (passagem) | — | a tela pede `POST passo {para:"cadeia"}` sozinha, também num F5 |
| `cadeia` | E5-ALU-01 — o Léo e a REGRA SE … ENTÃO (EF06CO03), a revelação e "Concluir o Julgamento" (CONCLUI) | **escola** | `ScrollBar`, `Logo`, `SectionHeader`, `RadioGroup` ×2, `Card`, `AlertBox`, `Button` |
| `mariana`, `enquetes` | — (sessão antiga, `concluindo`) | — | `POST concluir` sozinho |
| `fim` | E6-ALU-03 — a conclusão | comissão, depois **escola** | `TopBar`, `IconUnv` (a comissão); `Card` da plataforma numa faixa `.fim__escola` (o infográfico) |
| 403 | missão não aberta aqui | **escola** | `AlertBox` |

A tela só anda quando a api responde: nenhum latch é otimista. A única coisa
otimista é o coração (a curtida é ESTADO, e o servidor devolve a lista inteira a
cada ida).

## A fronteira do disfarce é QUEM FALA

Do crachá à galeria quem conduz é a comissão da mostra, dentro do Unoovista —
inclusive a revelação (a Galeria Oculta é um comunicado da comissão) e as
PASTAS do salvar, no feed. A regra SE … ENTÃO sai do clone: é a Unooria
mostrando a engrenagem. O topo do fim volta ao clone (a comissão homologa). Os avisos globais seguem a mesma regra (`app/avisos.tsx`,
`regras.ts#vozDaTela`): `SnackbarUnv`/`BottomSheetUnv` no clone, `AlertBox` na
escola.

O crachá é do clone; a escola fala antes dele só no 403.

**PRD v2 §10.1**: o caso Mariana (a transferência, da escola) SAIU na 0.7.0
(ADR-176); a transferência fica no debate do guia. O fim tem as DUAS vozes — a comissão no topo e o infográfico da
Unooria numa faixa própria (`.fim__escola`: `Card` da seção `unooria`, nenhum
token `--unv-*`, sem a barra nem as abas do clone).

## O voto e a revisão (PRD v2)

- **Salvar** abre as pastas e NÃO pesa no feed (só curtir e ficar pesam).
  A pasta é a separação da EF06CO01: a api corrige no VOTO (409
  `estandes-sem-pasta` se faltar).
  **Comentar e compartilhar** respondem com a linha da comissão
  (`e2.rotulo.comentarios_desabilitados`) e não viajam.
- **A cédula tem quatro elementos**: o cabeçalho (título da folha), os
  estandes do feed, a certeza ("Sim" / "Com certeza") e o botão. Sem
  justificativa, sem frase grifada.
- **A revisão tem dois botões**: "Manter meu voto inicial" (travado, com a
  explicação, até a criança abrir UM oculto — a api responde 409
  `galeria-sem-inspecao` se a tela errar) e "Confirmar Voto Revisado" (abre a
  lista dos 39 outros, FILTRADA por área pelos chips — abre na área da grade).
  Depois do latch, a tela pede a regra sozinha.

## As quatro abas

`clone/abas.ts`. **Início** é o feed; **Busca** responde fechada no julgamento
(abri-la antes furaria a bolha antes de o feed formá-la); **Notificações** mostra
o crachá; **Jurado** é o perfil. Nenhuma abre fluxo novo.

## O relógio de 8 minutos é do servidor

O primeiro `proximo: true` liga o relógio (`encerraEm`); recarregar não zera.
A tela agenda UMA ida vazia para `encerraEm` (`regras.ts#esperaAteEncerrar`), e
a barra da cédula só acende com `cedulaLiberada` do servidor. Sem cronômetro.

## A cédula aberta: o aviso de 60 s e o batimento de 15 s

`app/inatividade.ts#useOciosidade`: 60 s sem toque com a cédula ABERTA acende a
linha da comissão (`role="alert"`). Folha aberta: `POST cedula/batimento
{aberta:true, segundosSemToque}` a cada 15 s (204); ao fechar, `{aberta:false}`
— o sinalizador de ociosos do painel do professor.

## A Galeria Oculta (0.5.0): o que sumiu, não quanto

Com 40 estandes e dez posts sem repetição, o total oculto é igual para todos
(30 de 40): a prova é QUAL área sumiu. Tudo vem calculado da api
(`GaleriaSchema`; o motor nunca desce); a tela só conta, na voz da comissão:

- `invisibilidade` → "30 de 40 estandes nunca chegaram ao seu feed" (Y = o
  pacote: 16 no antigo). Sem porcentagem.
- **Do badge vai direto à busca** (ADR-176): a contagem por área e o
  contraste "Sem as suas curtidas" saíram da tela; a api segue mandando
  `porArea` (escolhe a área inicial) e `semCurtidas`.
- **A grade é dos ocultos de UMA área**, a do chip: abre na que mais ficou fora
  (`regras.ts#areaComMaisOcultos`) sem contar como busca; o toque conta.

## O feed é servido um post por vez

`POST /juri-estadual/passo {para:"feed"}` serve a abertura (4 posts, um de cada
área). Quando o ÚLTIMO post fica ≥ 60% visível, a tela pede o próximo (`POST
feed/eventos`, `proximo: true`) com as curtidas e permanências da fila. A fila
(`juri-app.tsx`) junta por 400 ms e manda UMA ida por vez. O motor da api escolhe o post; antes do voto, a fila é esvaziada.

A permanência (`lib/permanencia.ts`) é um FATO por post (> 5 s seguidos com
≥ 60% visível), não o tempo somado.

O motor serve só `apresentacao`, sem repetir; o `bastidor` é a ÚLTIMA lâmina
do carrossel. Fotos 2, 3 e bastidores: `post.laminas` (ADR-178);
`null` = arte procedural. Sessões 2.0.0: a tela desenha os formatos legados.

## Polling SÓ na espera

`GET /juri-estadual/gate` a cada 3 s, só com `aguardandoOProfessor` (o passo
`lacrada`). Compara etapa, rodada e atividade (`regras.ts#gateMudou`); mudou,
relê a sessão. A galeria é lida (`GET galeria`) ao entrar no passo dela; o 403
`galeria-nao-liberada` relê a sessão em vez de mostrar a porta fechada.

## A galeria não manda texto

Da busca, a api recebe `{tipo:"buscar", busca:"hashtag"|"texto", area}` —
`regras.ts#classificarBusca` —, NUNCA o que foi digitado (texto livre de
menor). Uma busca conta quando a digitação para (1,2 s) ou no toque do chip. As ações vão numa fila sem bloquear a
tela, e a revisão do voto ESPERA a fila esvaziar. Desde a 0.6.0 a galeria não marca habilidade (ADR-174).

`galeria/acoes` responde **204 sem corpo**, e o SDK faz `res.json()` em toda
resposta `ok`: o `SyntaxError` sem status seria lido como queda de rede e
repetido para sempre. `lib/api.ts#postSemResposta` o trata como sucesso.

## Os latches e o F5

- **Voto** (LATCH 1) e **revisão** (LATCH 2) só existem quando a api confirma; a
  repetição de uma ida perdida volta 409 e a tela relê a sessão.
- O **carimbo** e a espera são a mesma tela (E3-ALU-02); o protocolo sai de
  `regras.ts#protocoloDoVoto`, o mesmo num F5.
- **A regra: UMA vez só, e CONCLUI** (ADR-176). Ela responde a REVELAÇÃO, que
  a tela mostra antes de aplicar o `fim` (em "Concluir o Julgamento"; num F5,
  a api já está no fim).
- As peças reabrem como estavam (`lib/memoria.ts`: `sessionStorage`, só ids,
  chave = estudante + atividade + rodada). As pastas são da api.
- Sessão antiga: em `classificacao` pede `lacrada` (sem marca); em `mariana`
  ou `enquetes`, `POST concluir`.
- A **dica do carrossel** não volta depois do primeiro deslize (memória).

## O que o bundle NÃO sabe

Quantas pastas estão certas, a peça certa da regra antes do envio (`rg-`), os
pesos do motor, a área líder e os
estandes que o feed NÃO serviu. `lib/tipos.ts` não tem campo para nenhum. Depois do build:

```bash
cd apps/experiencias/exp06ef1b
find dist -name '*.js' | xargs grep -l -F -e "certo:" -e "certa:" -e "se-curtir" -e "entao-tema" -e "LIMIAR_DA_BOLHA" -e "PESO_DA_CURTIDA"   # vazio
```

O post mostra a área (perfil e hashtag) ao lado do Salvar: a pasta certa está
ao alcance de quem lê o post. É o risco aceito na ADR-176; corrige o servidor.

## A interface: compensações e props do DS

As compensações locais do DS (cada uma com a lacuna e o pedido ao
`storybook-unooria`) e as props do DS que enganam moram em
[`src/app/AGENTS.md`](src/app/AGENTS.md), a pasta onde se escreve a interface.

## Ausências deliberadas

- **Sem busca antes do voto** (a aba Busca responde fechada).
- **Sem contagem de curtidas no post** (`PostCard.Likes`): a api não tem o
  número — inventar seria a tela mentindo.
- **Sem cronômetro na tela** (ver o relógio de 8 minutos).
- **Sem certo/errado nas pastas**, nem depois do voto: o nível é do professor.
- **Sem contagem por área na galeria** (ADR-176, pedido do time).
- **Sem arrastar** nas pastas nem na regra (AA, ADR-162): toque e teclado.
- Sem `PhoneFrame` (o aparelho é do hub).

## A copy

A fonte é `design/06-copy-strings-revisada.md` do PRD v2, chave por chave em
`lib/textos.ts`; o que a copy não tinha está marcado `ESCRITA AQUI` (o
inventário no `README.md`). O "75%" e os "12 projetos" da copy viraram, na
0.5.0, a moldura "X de Y estandes" com os números REAIS (nenhum `%` na tela). UMA exclamação na missão (a do Léo). O
`lib/textos.test.ts` cobra as duas, o teto de 25 palavras com as exceções
NOMEADAS (o crachá e o infográfico, literais do PO), e que nada antes da
galeria — as pastas inclusive — diga "algoritmo", "bolha", "filtro" ou
"oculto".

## Vitrine (verificação visual)

Fora do repositório: um `vite.config` com `root` nesta experiência e um alias de
`@edu/sdk` para uma SDK falsa que responde por `?passo=` (`feed&posts=N`,
`galeria`, `bloqueada=1`...), fotografada pelo Playwright do pnpm.
