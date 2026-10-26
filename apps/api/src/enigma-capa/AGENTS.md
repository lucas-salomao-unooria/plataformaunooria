# apps/api/src/enigma-capa — O Enigma da Capa da Rádio (exp02ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão do 2º ano EF, unidade 1 (ADR-184), vinda da esteira
(`artefatos_exp02ef1b`, one-pager do PO v1.1, 2026-10-26). Prefixo
`/enigma-capa`, porta do Vite 5187.

O estudante é repórter mirim da Rádio Escola no **Unoovista**: escolhe o
crachá, investiga duas fotos do mesmo minuto com a lupa (piso: 3 s em cada e
o fundo das duas), escolhe UMA, a enquadra numa moldura de tamanho fixo, cola
um selo e **publica a capa** (o LATCH 1). A visitante diz só o que o recorte
mostrou. O professor conversa e toca em **LIBERAR VIRADA**: a tela divide, a
criança acha os dois objetos iguais do fundo nas duas fotos, o slider revela a
panorâmica e ela marca o que ficou fora. Depois a E5 (pares e segunda foto) e
a E6 (a lagarta na alface: **SÓ UM PEDAÇO** × **MOSTRA TUDO**, o LATCH 2, que
conclui). Quatro tabelas: `exp02ef1b_pacotes`, `_gates_turma`,
`_gates_historico`, `_sessoes` (migração `20261026120000_exp02ef1b_enigma_capa`).

## As decisões do Lucas que vencem o one-pager (2026-10-26)

- **Clone Unoovista**, não instanooria. Por isso o podcast diz "no Unoovista"
  onde o roteiro do PO dizia "no Instanooria" — a única troca no texto literal.
- **A virada é GERAL da turma** (um botão), não por estudante. Quem publica
  depois da virada passa da capa direto à busca (a tela mostra a visitante).
- **Sessão individual**; o aparelho compartilhado entra pelo mecanismo de
  equipes da plataforma (a missão está em `EXPERIENCIAS_COM_EQUIPE` e
  `EXPERIENCIAS_COM_ATIVIDADE`; `individual` é o padrão).
- **Sem Canal B, sem áudio de tela, sem texto livre de estudante.** Nenhuma
  rota recebe texto da criança.
- **IA desde o lançamento, só no PREPARO**: o banco padrão Biblioteca em 1
  toque, os prontos Horta e Museu, e a cena gerada por tema, que o professor
  CONFIRMA tocando nos dois objetos.

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
  não a "placa 1952" do one-pager: a imagem não tem texto escrito.
- **As constantes de geometria DESCEM** em `GET /sessao` (`geometria`: os
  recortes, a faixa, as duas molduras, o piso) — não são gabarito, e a
  experiência não as duplica.
- **O gabarito não desce** (regra 3): a cena vai sem `nucleo`, sem a fala da
  visitante, sem `seloCoerente`, sem os alvos e sem os `marcaveis`; as cartas
  da E5 só com id e imagem. Duas exceções: o alvo do invariante JÁ ACHADO
  (`invariantes.achados` — deixou de ser gabarito, e sem ele o F5 não
  redesenha o dourado) e todos os alvos depois da AJUDA (3 erros: o PO pede o
  pulso amarelo, e o pulso precisa do lugar).
- **A cena gerada pela IA não tem coordenada**: a IA escreve o texto e desenha
  a imagem com o layout que `GEOMETRIA_DA_CENA_GERADA` supõe (atividade 1 à
  esquerda, 2 à direita, os dois objetos no centro da parede); os alvos nascem
  `null` e o professor os marca (`POST …/rascunho/invariantes`). O CHECK
  `exp02ef1b_pacotes_alvos_check` não deixa um pacote sem alvos ser aprovado.
- **O preparo cobra texto E imagem** (`preparo.service.ts`): `temSaldo`
  antes, o que o vendor disse que cobrou depois (`aoUsarTokens` nas duas
  chamadas; a imagem sem contagem vale `CUSTO_ESTIMADO_DA_IMAGEM`). Sem saldo
  ou com o vendor fora, o rascunho é o pacote PRONTO da disciplina
  (`PRONTO_DA_DISCIPLINA`: LP→Biblioteca, Ciências→Horta, História→Museu,
  outra→Biblioteca). A saída passa pela MESMA régua da aprovação
  (`regras/pacote.ts#problemasDoConteudo`, com os alvos ainda opcionais). O
  pedido de imagem diz "ilustração", nunca "foto" (ADR-178), e proíbe texto
  escrito na imagem.
- **A lupa é relato da tela, limitado pelo servidor** (`regras/lupa.ts`): o
  máximo de cada tempo (monótono) e nunca mais que o tempo desde a entrada
  (o crachá). O avanço sem o piso conta um alerta — é a régua.
- **Os passos são derivados** (`regras/passos.ts`): `cracha → lupa → decidir →
  feed → invariantes → slider → fora → pares → segunda-foto → transferencia →
  concluida`. Jogada à frente = 409 `passo-invalido`; repetir a já feita
  devolve o estado (200) — o duplo toque e a fila de reenvio da tela são
  inofensivos. Os latches com OUTRA escolha: 409 (`ja-publicado`, `ja-enviado`).
  Os CHECKs de ordem do banco são a rede final.
- **A atividade é o PACOTE; a rodada é o "Zerar"** (ADR-130/155), como na
  exp02em1b: aprovar cria a atividade PRONTA; `em-andamento` a põe no ar;
  `banco-padrao` faz os dois num toque (e reusa o mesmo pronto já aprovado na
  turma, sem tocar no rascunho da IA); `zerar` apaga a evidência do pacote,
  guarda as sessões e devolve a fase à `aberta`.
- **O podcast é FIXO** (`podcast.ts`): o §11 literal (Iara e Bento), com a
  troca do app; os efeitos sonoros vão na direção de atuação.
- **Vocabulário em dois lugares**: disciplina, origem, cena, fase, crachá,
  foto, selo, motivo, elemento, voto e as cartas estão em `conteudo.ts` e nos
  CHECKs; `tests/enigma-capa-regras.spec.ts` compara os textos.

## A régua (E14) — 100% Canal A (`regras/evidencia.ts`)

| indicador | pleno | parcial | ausente |
|---|---|---|---|
| lupa | piso com 0 alertas | 1 alerta | 2+ alertas |
| selo | coerente | — | incoerente |
| invariantes | menos de 3 erros (sem ajuda) | ajuda acesa e menos de 3 erros depois | 3+ erros depois da ajuda |
| transferência | SÓ UM PEDAÇO | — | MOSTRA TUDO |

- **EF02CO05** (o foco, marca no voto): atingiu = os quatro plenos; não
  atingiu = MOSTRA TUDO **e** mais um ausente (selo, lupa ou invariantes); em
  processo = o resto.
- **O ajuste do "não atingiu"** (ADR-184): o PO escreveu as quatro faltas com
  "e". Literal, a régua seria inalcançável, e a criança que PERSISTE na crença
  de entrada (MOSTRA TUDO, o descritor central) cairia em "em processo" com
  outro sinal ausente. A régua pede a crença MAIS um sinal; MOSTRA TUDO
  sozinho, com o resto pleno, é "em processo".
- **EF02CO01** (associada, marca quando os quatro achados completam): atingiu =
  sem a ajuda; em processo = com a ajuda e menos de 3 erros depois; não
  atingiu = 3+ erros depois da ajuda — o "precisou de apontamento do
  professor", medido. O fluxo segue: com o pulso, o professor aponta e ela acha.
- O "fora", os pares, o motivo e a segunda foto vão SÓ ao painel. Falha
  técnica = sem marca ("Não avaliado"). Sem `registrarContexto`: não há pergunta.

## As duas suítes

- `tests/enigma-capa-regras.spec.ts` — sem banco: a geometria, a visitante, o
  "fora", a segunda foto, o piso da lupa, a busca com a ajuda, os pares, o
  passo, as tabelas-verdade das duas habilidades (a da CO05 inteira, 36
  combinações), a régua do pacote (os três prontos e a saída da IA), o
  gabarito fora do schema da sessão, o podcast e o espelho dos CHECKs.
- `tests/enigma-capa-postgres.spec.ts` — a porta da sala em toda rota de
  estudante, a missão que nasce vazia, o preparo com a quota (texto e imagem)
  e a reserva, os alvos do professor, a aprovação, o banco padrão, a lupa, o
  latch, a virada geral só para a frente, a busca com as marcas, o voto, o
  gabarito ausente do `GET /sessao`, o painel, os CHECKs, a RLS com a role sem
  `BYPASSRLS` e o zerar.
