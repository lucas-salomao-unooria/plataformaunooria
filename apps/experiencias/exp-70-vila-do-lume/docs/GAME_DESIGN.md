# Vila do Lume — Game Design Document

**Estado atual do jogo.** Este documento descreve o que existe, não o que já se pensou em
fazer. Todo número aqui foi conferido contra o código em 21/08/2026; onde documento e
código divergirem, o código é a verdade e o documento é bug.

O histórico de como cada decisão foi tomada vive em `GRILL-2026-08-20.md`,
`GRILL-2026-08-20-mundo.md` e `DEBATE.md`. Eles são registro, não especificação — não
volte a eles para saber como o jogo funciona hoje.

> **A versão anterior deste documento descrevia outro jogo.** Falava em Bit, Espelho,
> brasas, eixos Bartle, bússola, moeda cosmética e Pódio de Ranking — nada disso existe.
> Ele foi crescendo por acúmulo através de três sessões de design e passou a se
> contradizer. Esta versão é reescrita, não emenda.

---

## 1. O que é

Um jogo 3D de navegador, em primeira pessoa, onde a criança reacende as 8 fogueiras de uma
vila no escuro.

É também um instrumento de perfilamento comportamental baseado na Teoria de Valores
Básicos de Schwartz. A criança nunca sabe disso.

## 2. As duas camadas

**Camada 1 — o que a criança vive.** Uma vila apagada, um objetivo claro, e escolhas pelo
caminho que ninguém pontua.

**Camada 2 — o que o adulto lê.** Um retrato de quais valores apareceram no comportamento.

**As duas nunca se cruzam.** A criança não vê pontuação de valor, rótulo Schwartz, retrato
de caráter, nem qualquer sinal de que está sendo medida. Se ela perceber a medição, a
próxima partida vira atuação e o instrumento morre.

Consequência operacional: **não existe tela de resultado dentro do jogo.** Nem retrato, nem
lista de partidas, nem rota escondida atrás de parâmetro de URL. O relatório vive no **hub do
professor** (`/professor/entre-redes/vila-do-lume` — ficha, guia do debate, resultados por
turma e relatório individual), que a criança não abre.

O perfil ganhou um segundo consumidor: colapsado em quatro quadrantes
(`apps/api/src/vila/quadrantes.ts`), ele decide de que lado o feed do Instanooria nasce.

## 3. Público

**6 a 13 anos.** A experiência é **transversal** (`series: []` no manifesto): não pertence a
ano nenhum. Quem sabe a idade é a plataforma — a série da turma chega junto com a sessão, e
hoje ela decide uma coisa só: nos anos iniciais (1º ao 5º ano) a bolha B da missão não é
servida (`SERIES_SEM_BOLHA_B`, `apps/api/src/vila/regras.ts`).

As três faixas declaradas (`6-8`, `9-11`, `12-13`) eram do app de origem e não existem mais.

Essa largura é o risco metodológico central do projeto: sete anos de diferença em destreza
motora, leitura, memória espacial e fôlego de atenção. Ver §8.

## 4. Identidade

**A criança nunca declara quem ela é.** A identidade vem da **sessão autenticada da
plataforma** (`hub:init` → `src/main.ts`), e a partida é aberta no servidor
(`POST /vila/sessoes`), que crava o id e o horário de início e devolve a bolha. Não há tela de
escolha, link por estudante nem modo livre: sem handshake o shim **não sobe o jogo**, porque
partida órfã é pior que partida nenhuma — ela desaparece e o professor lê a lista achando que
a criança não jogou.

O jogo recebe apenas o **primeiro nome** dela, e ele vive só na Camada 1 (a fala do Lume e a
Pedra dos Nomes). Nunca é serializado: `verificarSemNome()` bloqueia no cliente e
`semNomeDeCrianca` recusa no servidor (`apps/api/src/vila/contrato.ts`). Isso importa MAIS
aqui do que no app de origem, onde não havia nome nenhum em memória. Ver
`adr/0002-nome-nunca-entra-no-log.md`.

---

## 5. O mundo

Vila circular, raio útil ~30 unidades. Velocidade a pé: **4,5 u/s** — deliberadamente
baixa, porque é a caminhada que torna as escolhas caras.

**8 lugares, cada um com uma fogueira apagada.** Estes são o objetivo:

| lugar | raio |
|---|---|
| Mercado | 10,0 |
| Praça | 12,0 |
| Casa das Memórias | 14,0 |
| Mural de Recados | 17,0 |
| Arena | 21,0 |
| Campo de Treino | 24,0 |
| Pedra dos Nomes | 27,0 |
| Portal Secreto | 29,0 |

O **Fogo Sagrado** fica em (0,0) e é o destino final.

**16 pedras de fagulha**, em três faixas: r≈7–8, r≈12–13, r≈19–28. Cada pedra rende
**1 fagulha** (segurar `F` por 1,1 s).

**6 lampiões apagados.** Quatro formam par com um Aldeão; dois ficam sozinhos.

**4 aldeões perdidos.** Dois na rota normal, **dois além da Crista** — só encontrados por
quem seguiu o sinal de fumaça.

**5 brinquedos** (sinos e pedrinhas) no miolo, r≈4,5 e r≈10,5. Não fazem nada.

**Crista:** obstáculo que divide o mapa. Contornar custa caminhada; atravessar exige achar
a fenda.

## 6. O loop

### Obrigatório — o que fecha o jogo

1. **Minerar** (`F`) uma pedra → 1 fagulha.
2. **Acender** (`T`) a fogueira de um lugar → custa 1 fagulha. Fogueira acesa nunca apaga.
3. **Pegar** (`E`) a Chama Sagrada que sobe do fogo.
4. Repetir nos 8 lugares → ir ao Fogo Sagrado → `E` → Vila Salva.

### A Tocha — o recurso que cria as escolhas

Acesa numa fogueira **já acesa**, custa 1 fagulha. **A criança carrega uma por vez.**

Essa indivisibilidade é a peça central do instrumento, não do jogo: ela elimina a
aritmética mental ("tenho 6 fagulhas, posso fazer tudo") e transforma duas oportunidades
copresentes em conflito real.

### Opcional — onde mora o sinal

Nada abaixo é exigido para vencer, **nada pontua, e nada aparece em contador durante a
partida**. É exatamente por isso que a escolha é genuína. Ver `adr/0001-ato-opcional-nao-pontua.md`.

- **Ajudar um Aldeão** — entrega a Tocha, ele atravessa o escuro sozinho até a Praça.
- **Acender um Lampião** — luz permanente que não dá nada em troca.
- **Retomar a Tocha doada** — o fogo que ela deu ao Aldeão pode ser buscado de volta.
- **Pedra dos Nomes** — gravar na **Borda** (sem apagar ninguém) ou tomar o **Destaque**
  (apagando o nome de outra criança). Mesmo custo, mesma tecla.
- **Passarela** — atalho que só serve a quem o acendeu.
- **Brinquedos** — tocar sino, mexer em pedrinhas.
- **Lume** — o NPC guia. Pode-se perguntar o caminho, pedir instruções, ou puxar a história
  da vila.

### O Dilema

Cada um dos 4 pares tem um Aldeão a exatamente **3,00 unidades** do seu Lampião, no mesmo
raio — os dois entram no enquadramento juntos. Uma Tocha. Dois pares ficam além da Crista.

É a operacionalização de **Benevolência × Universalismo**: pessoa concreta contra bem
coletivo, mesmo custo, ao mesmo tempo.

### O Chamado

Toda oportunidade se anuncia de forma diegética, nunca por HUD:

- **Aldeão:** fumaça que atravessa a névoa a 42 unidades, grito, e `⁉️` pulsante de perto.
- **Lampião:** o vidro apagado pulsa dentro de 7 unidades.

Sem Chamado percebido, a oportunidade **não chegou** — e isso é diferente de ter sido
recusada. Ver §7.

---

## 7. O instrumento

### Os quatro graus

A distinção mais importante do projeto:

| grau | significado | vira número? |
|---|---|---|
| `scored` | 2+ **fontes de medida distintas** | sim |
| `indicative` | 1 fonte só — um sinal não sustenta número | não |
| `zero` | teve a oportunidade e não foi por ali | 0, e entra nas médias |
| `none` | a oportunidade nunca chegou até ela | sai das médias |

`zero` e `none` são a mesma ausência na tela e coisas opostas no método. Confundir os dois
transforma "não teve chance" em "não quis".

**Fonte de medida, não linha de probe.** Duas leituras da mesma variável não são dois
sinais independentes — o portão conta fontes justamente por isso.

### Os 10 valores e o que instancia cada um

| valor | fontes hoje | pode virar número? |
|---|---|---|
| Autodireção | cobertura, sugestão do Lume, perguntas | sim |
| Estimulação | escuro, raio máximo | sim |
| Hedonismo | brinquedos | **não — 1 fonte** |
| Realização | passarela, ritmo de fogueiras, ritmo de pedras, borda, retomadas | sim |
| Poder | destaque, nomes apagados | sim (mas ver §9) |
| Segurança | luz | **não — 1 fonte** |
| Conformidade | sugestão do Lume, perguntas, pedidos de ajuda | sim |
| Tradição | lore | **não — 1 fonte** |
| Benevolência | aldeões, dilemas, fumaça | sim |
| Universalismo | lampiões, dilemas | sim |

### Os dois eixos

- **Abertura à Mudança** (Autodireção, Estimulação, Hedonismo) **× Conservação**
  (Segurança, Conformidade, Tradição)
- **Autotranscendência** (Universalismo, Benevolência) **× Autopromoção** (Realização, Poder)

Um polo só é calculado com **pelo menos 2 membros** em grau `scored` ou `zero`. Com menos,
o eixo é `null` — eixo com metade faltando não é zero, é desconhecido.

### Quando a partida sustenta leitura

O portão pergunta **"o instrumento teve chance de funcionar?"**, e não "ela jogou bastante?".
Os quatro critérios valem juntos:

| critério | por quê |
|---|---|
| `movendoSeg ≥ 180` | O relógio do jogo, não o da sessão: parado não acumula medida. |
| `escolhasComCusto ≥ 3` | Só o que gastou Tocha ou fagulha. Perguntar ao Lume não conta. |
| `dilemasVistos ≥ 1` | Esteve num par copresente **com a Tocha na mão**. É a única prova de conflito real com meio de agir. |
| `dimensoesLidas ≥ 3` | Largura: valores em grau `scored` ou `zero`. |

**Acender fogueira não entra.** É cumprimento de tarefa, e dá para acender as 8 sem escolher
nada — essa partida passava na versão anterior do portão.

**O teto real é 6 valores legíveis de 10.** Numa partida máxima, quatro ficam em
`indicative`: Hedonismo, Segurança e Tradição por terem uma fonte só, e Autodireção porque
desaba para uma fonte quando a criança segue a sugestão do Lume e pergunta o caminho — que é
o comportamento comum. Por isso o limiar é 3 e não 4: com 4, o portão fica colado no teto.

### O servidor recalcula

O jogo envia **medidas brutas**, nunca perfil. O servidor calcula e recusa qualquer payload
que traga resultado pronto. O mapeamento comportamento→valor é hipótese de design, e
guardar o bruto é o que permite reprocessar o histórico quando a hipótese mudar.

---

## 8. Princípios que não se negociam

**Valor só aparece em conflito.** Uma escolha sem trade-off não revela nada. Duas
oportunidades boas ao mesmo tempo, com recurso para uma, revelam.

**Cada sinal custa algo real.** Se um comportamento não custa fagulha, Tocha ou caminhada,
ele não é evidência de valor — é conveniência.

**Ponha a dificuldade onde o relógio decide, não onde a maturidade decide.** Se a barreira é
mira, leitura ou memória espacial, o probe está medindo a idade da criança, não um valor.

**Constante de mundo se deriva, nunca se digita.** Toda constante que descreve geometria é
calculada a partir do mapa. Três bugs graves e silenciosos nasceram de números escritos à
mão que envelheceram quando o mundo cresceu.

**Nenhum feedback avaliativo após escolha.** Sem elogio, sem veredito. O jogo nunca comenta
a decisão.

---

## 9. Incoerências conhecidas

Levantadas em 21/08/2026 por auditoria de metodologia Schwartz e de game design
educacional, e **verificadas no código**. Estão aqui porque documento que esconde defeito
conhecido é pior que documento nenhum.

### Estruturais

**Três valores não podem virar número.** Hedonismo, Tradição e Segurança têm uma fonte cada.
Como Segurança e Tradição são dois dos três membros do polo Conservação, o eixo
Abertura↔Conservação quase nunca existe. Pior: `indicative` é excluído do polo e `zero`
entra — então **Segurança só participa do eixo quando é nula**.

**O eixo se anula no caso de maior sinal.** Os polos de Autotranscendência e Autopromoção
têm 2 membros cada, e o mínimo é 2. Apagar **um** nome deixa Poder `indicative` → polo com
1 membro → eixo `null`. Escolher o Aldeão nos 4 Dilemas faz o mesmo com Universalismo. O
instrumento apaga o eixo exatamente quando a criança faz o ato que o eixo existe para ler.

**As duas fontes de Poder são um ato só.** `namesErased++` e `nameOnDestaque = true` são
linhas consecutivas da mesma função. O portão de duas fontes é burlado por rótulo.

### De medida

**Tradição não mede Tradição.** A única probe é perguntar a história da vila — curiosidade
intelectual, que no circumplexo é Autodireção, o valor oposto. O jogo não instancia Tradição
em lugar nenhum.

**Estimulação é paga pela tarefa.** A probe `raioMax − 20` satura em 0,18 de 0,20 só por
visitar o Portal Secreto, que está em r=29 e é fogueira **obrigatória**.

**O rótulo mente sobre o dado.** O jogo calcula `darkCrossTime` (só o miolo escuro, r<6) e
**nunca o exporta**; envia `timeInDark`, que é o mapa inteiro. O servidor imprime
"Atravessou o miolo escuro" em cima disso — na prática, quanto tempo ela jogou antes de
acender as fogueiras.

**Universalismo ainda vaza para Segurança.** `isLitByWorld()` existe para impedir que acender
lampião leia como cautela, mas `timeInDark` ainda usa `isLit()`, que enxerga lampiões.

**Conformidade conta duas vezes.** O jogo subtrai as perguntas de direção dos pedidos de
ajuda; o servidor não.

**Denominador fixo em Benevolência.** O servidor divide por 4 aldeões; dois nascem
escondidos. Quem ajudou os 2 que encontrou aparece como metade.

### De desenho

**O jogo instrui o ato de Poder.** Junto à Pedra dos Nomes, o HUD imprime
`T apagar <nome> e pôr o seu`. A Pedra é fogueira obrigatória: toda criança lê o convite. O
Lampião **tem** convite, mas mais fraco: `T acender lampião`, sem objeto e sem vítima — o da
Pedra nomeia quem vai ser apagado. **Poder é induzido com mais força que Universalismo** —
assimetria que aponta para Autopromoção.

**Fazer os dois lados do par ainda conta como escolha.** Só a primeira metade servida é
gravada. Servir um, voltar buscar outra Tocha e servir o outro é uma viagem, não uma
renúncia — mas entra no relatório como preferência.

**A oportunidade é marcada sem capacidade de agir.** Passar a 7 unidades de um lampião conta
como oportunidade mesmo sem Tocha nem fagulha. Quem nunca descobriu a mecânica recebe
`zero` — "teve a chance e não foi" — quando não teve.

**A sugestão do Lume é sorteada** entre as 8 zonas. Acerto por acaso: 1/8. Essa moeda
alimenta os dois polos opostos do mesmo eixo (Autodireção e Conformidade).

**As DMs deixaram de estar órfãs** (26/08/2026). Eram cinco cartões no bundle, com gabarito
dentro, cujas respostas nenhuma linha do servidor lia. Hoje são **6 no catálogo da api**, **4
servidos por criança** (3 comuns + o da bolha), sem gabarito no cliente, corrigidos em
`regras.corrigirCartoes` e lidos em `mensagens.ts`. A parte etária foi endereçada pelo corte
da bolha B nos anos iniciais. Não há, e nunca houve, cartão de chat tóxico: quatro golpes de
engenharia social e duas mensagens verdadeiras.

---

## 10. Decisões em aberto

Três coisas não se resolvem escrevendo. Precisam de decisão do dono do produto.

### D1 — A tela final da criança

**O documento e o código se contradizem de frente.** A regra registrada é *"sem ordenação e
sem largura proporcional, zero barras"*, e Ato Opcional não aparece em contador.

O código mostra cinco barras proporcionais, incluindo **Aldeões 3/4** e **Lampiões 2/6** —
que são probes de Benevolência e Universalismo — com o botão **JOGAR DE NOVO** logo abaixo.
Foi implementado a pedido do dono do produto em 20/08/2026, para que barras zeradas não
sumissem da tela.

O risco concreto: a segunda partida de quem vê uma barra pela metade vira coleta de
lampião. Durante o jogo o contador esconde o denominador exatamente para evitar isso.

Ou o código volta, ou esta regra muda e o motivo fica registrado aqui. **Não podem coexistir.**

### D2 — Tradição

Ou o jogo ganha um ato de costume que **custe uma Tocha** (repetir um rito da vila, acender
na ordem antiga, deixar algo no círculo de pedras), ou Tradição é declarada não-instanciável
e sai do polo Conservação — o que obriga a recompor o polo.

### D3 — As DMs de segurança digital

Ou entram no mapeamento e passam por revisão de proteção infantil para a faixa 6–8, ou saem
do jogo. Hoje são conteúdo sensível sem propósito de medida.

---

## 11. O que não se mexe

Proteções contra melhoria bem-intencionada. Cada uma já foi "consertada" para pior alguma vez.

- **Ato Opcional com zero ponto e fora do contador durante a partida.** No instante em que
  uma escolha livre vale placar, o instrumento passa a medir quem persegue número.
- **A Tocha única.** Dar duas destrói todos os Dilemas de uma vez.
- **Borda × Destaque.** É o que separa Realização de Poder, e é a melhor decisão do projeto.
- **`zero` × `none`.** Colapsar os dois é transformar ausência de oportunidade em recusa.
- **Doar × retomar.** O mesmo ato sobe Realização e derruba Benevolência. É o único gesto
  que move dois polos opostos com custo real, e o jogo nunca diz qual é melhor. Se um dia
  virar exploit, tire os pontos — nunca o gesto.
- **A probe da fumaça.** Cortar a distância pela metade depois de avistar o sinal é a única
  medida que lê mudança de intenção no meio do movimento, em vez de um clique.
- **Nenhum feedback avaliativo após escolha.**

---

## 12. A missão das mensagens

Rodando na mesma partida existe um **segundo instrumento**, separado deste: a missão
**"A Noite Longa"**. Mensagens chegam durante o jogo — duas verdadeiras, duas golpe — e o
nível do golpe varia por **bolha (A/B/C), atribuída pela api** — estável por estudante,
balanceada dentro da turma (é a sala que precisa ter as três para o debate acontecer) e sem a
bolha B nos anos iniciais. Os cartões chegam por `window.VILA.cartoes` **sem gabarito**; o
jogo registra só o índice escolhido e a api corrige. Assim a turma se divide entre "era
óbvio" e "não dava pra saber", e isso vira debate.

Ela **não toca a jogabilidade**: lê o estado do jogo para escolher a hora e nunca escreve
nele. Nada do que acontece ali entra em nenhum dos dez valores.

Narrativa, mensagens, roteiro do debate e notas de aplicação em sala:
[`MISSAO-a-noite-longa.md`](./MISSAO-a-noite-longa.md).

---

## 13. Registro histórico

- `GRILL-2026-08-20.md` — entrevista de design que definiu a metodologia Schwartz, a Tocha,
  o Dilema e a separação Borda/Destaque.
- `GRILL-2026-08-20-mundo.md` — entrevista que definiu o mundo maior, assimétrico, a Crista
  e os aldeões escondidos.
- `DEBATE.md` — consolidação do debate Game Design × Psicometria × Arquitetura, com os
  erros corrigidos durante o processo (C-01 a C-17) e as divergências D1–D6.
- `CLAUDE.md` (desta pasta) — as regras operacionais para quem for mexer no código.
- `CONTEXT.md` — glossário do domínio.
- `adr/` — as duas decisões arquiteturais que não se revertem sem reescrever o instrumento.
