# apps/api/src/enigma-capa — O Enigma da Capa da Rádio (exp02ef1b)

Complementa o `AGENTS.md` de `apps/api`, que vence em conflito.

Missão do 2º ano EF, unidade 1 (ADR-184), vinda da esteira
(`artefatos_exp02ef1b`, one-pager do PO v1.1). A **2.0.0** (ADR-186, pedida
pelo Lucas em 2026-10-26 depois de usar a 1.0.0) segue o protótipo validado
pelo time (`design/08-prototipo.html`) quase à risca. Prefixo `/enigma-capa`,
porta do Vite 5187.

O estudante é repórter mirim da Rádio Escola no **Unoovista**: vê o card
"RASCUNHO PENDENTE — INVESTIGAR A NOVA CAPA" e toca em **ABRIR BANCADA**
(`POST /iniciar`, abre a sessão); acha com a lupa os dois objetos IGUAIS do
fundo EM CADA UMA das duas fotos do mesmo minuto (piso: 3 s em cada um dos
quatro — ADR-188); escolhe UMA foto, a enquadra
numa moldura de tamanho fixo, cola um selo e **publica a capa** (o LATCH). A
visitante diz só o que o recorte mostrou. O professor conversa e toca em
**LIBERAR VIRADA**: a tela divide, a criança acha os dois objetos iguais nas
duas fotos, o slider de comparação revela a cena inteira e ela marca com o
alfinete o que ficou fora da foto dela (o "Pronto" marca a EF02CO05). Depois a
E5 — os pares e a segunda foto, que **conclui**. Quatro tabelas:
`exp02ef1b_pacotes`, `_gates_turma`, `_gates_historico`, `_sessoes`
(migrações `20261026120000_exp02ef1b_enigma_capa`,
`20261026210000_exp02ef1b_prototipo` e `20261027120000_exp02ef1b_areas_e_pedido`).

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
  CONFIRMA desenhando a área dos dois objetos. A cena é NEM POLUÍDA NEM ÓBVIA
  (ADR-188): organizada, no máximo 2 crianças por atividade, e os dois objetos
  do meio de tamanho médio, com a cor natural, entre 2 ou 3 objetos comuns —
  no SYSTEM, no pedido de imagem e nas três cenas prontas. A 2.0.0 pedia os
  dois GRANDES e SOZINHOS, e a cena ficou óbvia.
- **O pedido da imagem é do professor** (ADR-188): a DESCRIÇÃO da cena
  (`prompts.ts#pedidoDaCena`) fica em `pedido_da_imagem` e é editável na
  curadoria; `POST …/rascunho/imagem` gera SÓ a imagem a partir dela (mesma
  quota; os alvos voltam a `null`). As REGRAS FIXAS (`regrasDaImagem`:
  ilustração, 16:9, os objetos no terço central, crianças sem rosto, nenhum
  texto) são acrescentadas a TODO pedido e não são editáveis nem gravadas —
  nunca devolva o pedido completo ao hub nem o ponha no log.

## O que não é óbvio

- **A geometria é o coração** (`regras/geometria.ts`). Tudo em 0–100 da
  PANORÂMICA 16:9. As duas fotos SÃO recortes fixos dela
  (`foto-1 = {x:0,w:68}`, `foto-2 = {x:32,w:68}`): uma imagem serve as duas
  fotos e a revelação, e a faixa comum x ∈ [32, 68] aparece nas duas — é lá
  que os invariantes moram (a régua exige a área inteira em x ∈ [32, 68]). A
  moldura da capa é 80% × 80% da foto; o estudante só a DESLOCA
  (`deslocamento` = fração da folga, 0 a 1), e o servidor deriva o retângulo
  visível. A segunda foto tem moldura própria (55% × 85% de `leitura.webp`,
  4:3), estreita o bastante para PODER cortar a criança.
- **O alvo é a ÁREA do objeto** (ADR-188): o retângulo `{x, y, w, h}` que o
  professor desenha. Acerta-se dentro dele com a folga `MARGEM_DO_ALVO` (1,5
  da largura; na altura, × 16/9 — a mesma distância na tela), que desce em
  `geometria.margemDoAlvo` para a lupa. A régua: área na faixa, de 3×5 a 30×60
  (% da panorâmica), sem sobrepor a outra. Era um círculo de raio fixo, e o
  topo de um objeto alto ficava fora.
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
  corrigido aqui); a área do invariante JÁ ACHADO (`invariantes.achados`, sem
  ela o F5 não redesenha o dourado); e todas depois da AJUDA (3
  erros: o pulso amarelo precisa do lugar).
- **A lupa é relato da tela, limitado pelo servidor** (`regras/lupa.ts`):
  `tempos["inv-1:foto-1"]`… = os ms com o centro da lente sobre cada objeto EM
  CADA foto (ADR-188: achar na foto 1 não acha na 2; colunas
  `lupa_inv{1,2}_foto{1,2}_ms`); o servidor guarda o máximo de cada (monótono) e
  nunca mais que o tempo desde a entrada (o ABRIR BANCADA). O avanço sem o
  piso conta um alerta ("OLHE O FUNDO") — é a régua.
- **A cena gerada pela IA não tem coordenada**: a IA escreve o texto e desenha
  a imagem com o layout que `GEOMETRIA_DA_CENA_GERADA` supõe (atividade 1 à
  esquerda, 2 à direita, os dois objetos no centro da parede); os alvos nascem
  `null` e o professor desenha as áreas (`POST …/rascunho/invariantes`). O CHECK
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
  artigo do espaço — `e1.missao` (`fraseDaMissao`: "a biblioteca" → "ENCONTRE
  OS 2 OBJETOS IGUAIS NAS DUAS FOTOS DA BIBLIOTECA") e `e4.fora` (`fraseDoFora`). `{n}` fica para a tela. A
  experiência tem cópia das duas funções.
- **A atividade é o PACOTE; a rodada é o "Zerar"** (ADR-130/155), como na
  exp02em1b: aprovar cria a atividade PRONTA; `em-andamento` a põe no ar;
  `banco-padrao` faz os dois num toque (e reusa o mesmo pronto já aprovado na
  turma, sem tocar no rascunho da IA); `zerar` apaga a evidência do pacote,
  guarda as sessões e devolve a fase à `aberta`.
- **O podcast conta a CENA** (ADR-204; fixo até a 2.2.2): o §11 do PO com
  sete vagas. `pacoteParaPodcast` escolhe: a linha de `podcast_roteiros`
  vence; sem ela, o pronto INTOCADO (`prontoIntocado`) — Biblioteca = `padrao`
  (o texto de antes, letra a letra), Horta e Museu = `falasProprias`. A cena
  da IA e o pronto editado vão à escrita (`falasProntas` para Horta/Museu) e à
  revisão na curadoria; o `homologar` EXIGE `podcast`. IA aprovada antes: 409.
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
