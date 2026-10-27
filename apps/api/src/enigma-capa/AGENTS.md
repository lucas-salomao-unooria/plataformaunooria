# apps/api/src/enigma-capa — O Enigma da Capa da Rádio (exp02ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão do 2º ano EF, unidade 1 (ADR-184), vinda da esteira
(`artefatos_exp02ef1b`, one-pager do PO v1.1). A **2.0.0** (ADR-186, pedida
pelo Lucas em 2026-10-26 depois de usar a 1.0.0) segue o protótipo validado
pelo time (`design/08-prototipo.html`) quase à risca. Prefixo `/enigma-capa`,
porta do Vite 5187.

O estudante é repórter mirim da Rádio Escola no **Unoovista**: vê o card
"RASCUNHO PENDENTE — INVESTIGAR A NOVA CAPA" e toca em **ABRIR BANCADA**
(`POST /iniciar`, abre a sessão); acha com a lupa os dois objetos do fundo nas
duas fotos do mesmo minuto (piso: 3 s em cada um); escolhe UMA foto, a enquadra
numa moldura de tamanho fixo, cola um selo e **publica a capa** (o LATCH). A
visitante diz só o que o recorte mostrou. O professor conversa e toca em
**LIBERAR VIRADA**: a tela divide, a criança acha os dois objetos iguais nas
duas fotos, o slider de comparação revela a cena inteira e ela marca com o
alfinete o que ficou fora da foto dela (o "Pronto" marca a EF02CO05). Depois a
E5 — os pares e a segunda foto, que **conclui**. Quatro tabelas:
`exp02ef1b_pacotes`, `_gates_turma`, `_gates_historico`, `_sessoes`
(migrações `20261026120000_exp02ef1b_enigma_capa` e
`20261026210000_exp02ef1b_prototipo`).

## As decisões do Lucas que vencem o one-pager (2026-10-26)

- **Clone Unoovista**, não instanooria. Por isso o podcast diz "no Unoovista"
  onde o roteiro do PO dizia "no Instanooria" — a única troca no texto literal.
- **A virada é GERAL da turma** (um botão), não por estudante. Quem publica
  depois da virada passa da capa direto à busca (a tela mostra a visitante).
- **Sessão individual**; o aparelho compartilhado entra pelo mecanismo de
  equipes da plataforma (a missão está em `EXPERIENCIAS_COM_EQUIPE` e
  `EXPERIENCIAS_COM_ATIVIDADE`; `individual` é o padrão). O professor sabe
  quem é a criança pelo painel, que identifica a linha pelo NOME.
- **100% ações em tela (Canal A)**, sem áudio de tela e sem texto livre de
  estudante. Nenhuma rota recebe texto da criança.
- **A missão termina na segunda foto** (a 2.0.0): o protótipo não tem etapa
  depois dela.
- **O componente curricular são todos os do 2º ano** do catálogo
  (`curriculo/componentes.ts#componentesDoAno("2EF")`), mais Computação e
  "Outro componente" no fim. `DISCIPLINAS` é literal (o CHECK precisa do
  texto) e a suíte de regras o confere contra o catálogo; o rótulo vem do
  catálogo. `PRONTO_DA_DISCIPLINA`: Ciências→Horta, História e
  Geografia→Museu, o resto→Biblioteca.
- **IA desde o lançamento, só no PREPARO**: o banco padrão Biblioteca em 1
  toque, os prontos Horta e Museu, e a cena gerada por tema, que o professor
  CONFIRMA tocando nos dois objetos. A cena é LIMPA (paredes lisas, poucos
  objetos, no máximo 2 crianças por atividade, os dois objetos do meio grandes,
  de cor forte e sozinhos na parede) — no SYSTEM e no pedido de imagem.

## O que não é óbvio

- **A geometria é o coração** (`regras/geometria.ts`). Tudo em 0–100 da
  PANORÂMICA 16:9. As duas fotos SÃO recortes fixos dela
  (`foto-1 = {x:0,w:68}`, `foto-2 = {x:32,w:68}`): uma imagem serve as duas
  fotos e a revelação, e a faixa comum x ∈ [32, 68] aparece nas duas — é lá
  que os invariantes moram (a régua exige `x − r ≥ 32` e `x + r ≤ 68`). A
  moldura da capa é 80% × 80% da foto; o estudante só a DESLOCA
  (`deslocamento` = fração da folga, 0 a 1), e o servidor deriva o retângulo
  visível. A segunda foto tem moldura própria (55% × 85% de `leitura.webp`,
  4:3), estreita o bastante para PODER cortar a criança.
- **O alvo é redondo na tela**: o raio é em % da largura e um ponto de altura
  vale 9/16 de um de largura (`acertaAlvo`). Raio 7 ≈ 44 px no celular.
- **A geometria é ANOTAÇÃO das imagens** (`conteudo.ts#PACOTES_PRONTOS`,
  medida pelo líder). Trocou a imagem? Reanote e edite só esse objeto; a suíte
  passa os três prontos pela régua. No Museu o invariante é a PLACA DOURADA, e
  não a "placa 1952" do one-pager: a imagem não tem texto escrito. A "Horta
  Escolar" é um desses três prontos (Ciências).
- **As constantes de geometria DESCEM** em `GET /sessao` (`geometria`: os
  recortes, a faixa, as duas molduras, o piso) — não são gabarito, e a
  experiência não as duplica.
- **O gabarito não desce** (regra 3): a cena vai sem `nucleo`, sem a fala da
  visitante, sem `seloCoerente`, sem os alvos e sem os `marcaveis`; as cartas
  da E5 só com id e imagem. Três exceções: **os dois alvos em `lupa.alvos`
  SÓ enquanto o passo é `lupa`** (ADR-186: o brilho da lente precisa do
  lugar; o que a E4 cobra — achá-los NAS DUAS fotos, por toque — continua
  corrigido aqui); o alvo do invariante JÁ ACHADO (`invariantes.achados`, sem
  ele o F5 não redesenha o dourado); e todos os alvos depois da AJUDA (3
  erros: o pulso amarelo precisa do lugar).
- **A lupa é relato da tela, limitado pelo servidor** (`regras/lupa.ts`):
  `alvo1Ms`/`alvo2Ms` = os ms com o centro da lente sobre `inv-1`/`inv-2`, em
  qualquer das duas fotos; o servidor guarda o máximo de cada (monótono) e
  nunca mais que o tempo desde a entrada (o ABRIR BANCADA). O avanço sem o
  piso conta um alerta ("OLHE O FUNDO") — é a régua.
- **A cena gerada pela IA não tem coordenada**: a IA escreve o texto e desenha
  a imagem com o layout que `GEOMETRIA_DA_CENA_GERADA` supõe (atividade 1 à
  esquerda, 2 à direita, os dois objetos no centro da parede); os alvos nascem
  `null` e o professor os marca (`POST …/rascunho/invariantes`). O CHECK
  `exp02ef1b_pacotes_alvos_check` não deixa um pacote sem alvos ser aprovado
  — e é por isso que `lupa.alvos` nunca falta no ar.
- **O preparo cobra texto E imagem** (`preparo.service.ts`): `temSaldo`
  antes, o que o vendor disse que cobrou depois (`aoUsarTokens` nas duas
  chamadas; a imagem sem contagem vale `CUSTO_ESTIMADO_DA_IMAGEM`). Sem saldo
  ou com o vendor fora, o rascunho é o pacote PRONTO da disciplina. A saída
  passa pela MESMA régua da aprovação (`regras/pacote.ts#problemasDoConteudo`,
  com os alvos ainda opcionais). O pedido de imagem diz "ilustração", nunca
  "foto" (ADR-178), e proíbe texto escrito na imagem.
- **Os passos são derivados** (`regras/passos.ts`): `inicio → lupa → decidir
  → feed → invariantes → slider → fora → pares → segunda-foto → concluida`.
  `inicio` = sem sessão. A segunda foto grava `concluido_em` junto com
  `segunda_em` (`MarcosDaSessao.concluiu` = segunda foto feita). Jogada à
  frente = 409 `passo-invalido`; repetir a já feita devolve o estado (200) —
  o duplo toque e a fila de reenvio da tela são inofensivos. O latch da capa
  com OUTRA escolha: 409 `ja-publicado`. Os CHECKs de ordem do banco são a
  rede final.
- **Os textos DESCEM** (`TEXTOS`, literais do protótipo) já preenchidos:
  `{ESPACO}`, `{espacoCurto}`, `{hora}`, e as duas frases que dependem do
  artigo do espaço — `e1.missao` (`fraseDaMissao`: "a biblioteca" → "…DA
  BIBLIOTECA") e `e4.fora` (`fraseDoFora`). `{n}` fica para a tela. A
  experiência tem cópia das duas funções.
- **A atividade é o PACOTE; a rodada é o "Zerar"** (ADR-130/155), como na
  exp02em1b: aprovar cria a atividade PRONTA; `em-andamento` a põe no ar;
  `banco-padrao` faz os dois num toque (e reusa o mesmo pronto já aprovado na
  turma, sem tocar no rascunho da IA); `zerar` apaga a evidência do pacote,
  guarda as sessões e devolve a fase à `aberta`.
- **O podcast é FIXO** (`podcast.ts`): o §11 literal (Iara e Bento), com a
  troca do app; os efeitos sonoros vão na direção de atuação.
- **Vocabulário em dois lugares**: disciplina, origem, cena, fase, foto, selo,
  motivo, elemento e as cartas estão em `conteudo.ts` e nos CHECKs (a
  disciplina, recriada na migração da 2.0.0); `tests/enigma-capa-regras.spec.ts`
  compara os textos.

## A régua (E14) v2 — 100% Canal A (`regras/evidencia.ts`)

| indicador | pleno | parcial | ausente |
|---|---|---|---|
| lupa | piso com 0 alertas | 1 alerta | 2+ alertas |
| selo | coerente | — | incoerente |
| invariantes | menos de 3 erros (sem ajuda) | ajuda acesa e menos de 3 erros depois | 3+ erros depois da ajuda |
| fora | marcou ≥ 1 marcável que ficou fora da capa | — | nenhum |

- **EF02CO05** (o foco, marca no `POST /fora`, o "Pronto"): atingiu = os
  quatro plenos; não atingiu = `fora` ausente **e** mais um ausente (selo,
  lupa ou invariantes); em processo = o resto. O "fora" mede, por ação e
  corrigido aqui (`itensFora`), o reconhecimento de que a foto mostra só um
  pedaço do lugar.
- **O ajuste do "não atingiu"** (ADR-184, mantido na ADR-186): o PO escreveu
  as quatro faltas com "e". Literal, a régua seria inalcançável. A régua pede
  a falta central (nada marcado fora) MAIS um sinal; sozinha, com o resto
  pleno, é "em processo".
- **EF02CO01** (associada, marca quando os quatro achados completam): atingiu =
  sem a ajuda; em processo = com a ajuda e menos de 3 erros depois; não
  atingiu = 3+ erros depois da ajuda — o "precisou de apontamento do
  professor", medido. O fluxo segue: com o pulso, o professor aponta e ela acha.
- A ficha é a **versão 2** (`evidencias/fichas/exp02ef1b.ts`). Os pares, o
  motivo e a segunda foto vão SÓ ao painel. Falha técnica = sem marca ("Não
  avaliado"). Sem `registrarContexto`: não há pergunta.

## As duas suítes

- `tests/enigma-capa-regras.spec.ts` — sem banco: a geometria, a visitante, o
  "fora", a segunda foto, a lupa dos dois objetos, a busca com a ajuda, os
  pares, o passo, as tabelas-verdade das duas habilidades (a da CO05 inteira,
  com o "fora", 36 combinações), a régua do pacote (os três prontos e a saída
  da IA, a cena limpa), as disciplinas contra o catálogo, os textos, o
  gabarito fora do schema da sessão, o podcast e o espelho dos CHECKs.
- `tests/enigma-capa-postgres.spec.ts` — a porta da sala em toda rota de
  estudante, a missão que nasce vazia, o preparo com a quota (texto e imagem)
  e a reserva, os alvos do professor, a aprovação, o banco padrão, o ABRIR
  BANCADA, a lupa (e os alvos só no passo dela), o latch, a virada geral só
  para a frente, a busca com as marcas, o "fora" com a EF02CO05, a segunda
  foto que conclui, o gabarito ausente do `GET /sessao`, o painel pelo nome,
  o material com as disciplinas, os CHECKs e as colunas da 2.0.0, a RLS com a
  role sem `BYPASSRLS` e o zerar.
