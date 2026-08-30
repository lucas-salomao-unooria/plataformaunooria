# Missão: A Noite Longa

Framework de missão para turma. O jogo é o veículo — **o desenho está nas mensagens que
chegam durante a partida**.

Cinco batidas: **desafiar → navegar → dividir → debater → explicar.**

---

## O nome não pode entregar o resultado

A missão se chama **A Noite Longa** porque essa é a **tarefa**: manter a Vila acesa até
amanhecer. O nome descreve o que a criança faz, nunca o que está sendo observado.

Chamar de "O Golpe" destruiria a missão de três maneiras:

1. **A criança entra avisada.** Fica em alerta desde o primeiro segundo, e aí não se mede o
   julgamento dela — mede-se o quanto ela leu o título.
2. **Mata o debate.** Ninguém consegue sustentar *"não dava pra saber"* quando o nome avisou.
3. **É a regra do projeto.** No instante em que ela sabe o que está sendo medido, a próxima
   partida vira atuação.

A mesma regra vale para tudo que o adulto disser antes: **nada de "prestem atenção nas
mensagens"**. A instrução é *"vocês vão manter a Vila acesa"*, e nada mais.

---

## Nem toda mensagem é golpe — e isso é o coração do desenho

Se todas as mensagens fossem golpe, **"ignorar tudo" seria a resposta certa**, e uma criança
que recusa o mundo inteiro tiraria nota máxima. Isso não mede discernimento, mede
desconfiança — e desconfiança total não é o que se quer ensinar.

Então as mensagens vêm misturadas, e **os dois erros custam**:

| ela faz | custo |
|---|---|
| aceita o que era golpe | entregou o que pediram, e nunca chega nada |
| recusa o que era real | a ajuda que existia não chega até ela |

Nenhum dos dois custos toca a economia do jogo — ver a batida 5. O custo é de **informação e
de conversa**, não de fagulha.

A criança não sabe a proporção. Nunca saberá quantas eram reais — nem no fim do jogo.

É isso que transforma a missão de **aula sobre phishing** em **instrumento**: existe um custo
para confiar demais e um custo para não confiar em nada, e o comportamento dela fica entre os
dois.

---

## As três bolhas

A **api** atribui a bolha e a guarda: balanceada dentro da turma (é a sala que precisa ter
as três para o debate acontecer) e estável — o mesmo estudante recebe sempre a mesma, mesmo
jogando de novo. O professor não escolhe, e o jogo também não: o navegador não conhece a
turma inteira, e o cliente escolhendo a própria condição de teste está a uma linha de
console de distância. Ver `regras.escolherBolha` na api.

**Nos anos iniciais (1º ao 5º ano) a bolha B não é servida** — ver Notas de aplicação.

O que varia entre as bolhas **não é a quantidade de golpes** — é a **qualidade do melhor
golpe** que cada uma recebe, e o **momento** em que ele chega.

| bolha | o golpe que ela recebe | quando chega |
|---|---|---|
| **A** | grosseiro | momento tranquilo |
| **B** | autoridade + urgência | depois de já ter o que perder |
| **C** | o colega, e o momento exato | quando está travada, sem fagulha |

As três recebem **as mesmas duas mensagens legítimas**. Só o golpe muda de nível.

---

## As mensagens

Chegam como DM durante a partida, **sem pausar o jogo**, com ~13 s para responder. O jogo
**nunca** diz se ela acertou. A consequência é diegética; a revelação é coletiva, no fim.

### Batida 1 · comum — DESAFIAR

Um golpe grosseiro, igual para todos. Ensina que o canal existe e que dá para recusar — e faz
a criança sentir que **ela sabe reconhecer golpe**. Essa confiança é o que a batida 3 usa
contra ela.

> **BRILHO_MASTER_99**
> *"ei psiu 👀 achei um GERADOR DE FAGULHAS INFINITAS"*
> *"vila-do-1ume-fagulhas.com — põe teu número de estudante e a senha da sala que DOBRA na hora!!!"*
>
> `1` Entrar no site · `2` Ignorar · `3` Avisar um adulto

### Batida 2 · comum — a primeira legítima

Chega logo depois. **É verdadeira, e ajuda de verdade.**

> **Lume**
> *"Ó, esqueci de te falar: tem pedra de fagulha atrás da Crista, do lado onde o vento bate."*
> *"Quer que eu te mostre onde?"*
>
> `1` Quero · `2` Ignorar · `3` Avisar um adulto

Quem aceita recebe a dica e economiza caminhada. Quem recusa segue sem ela — **e nunca fica
sabendo que era real**.

Esta mensagem é a peça que impede "ignorar tudo" de ser a resposta certa.

**Cuidado de instrumentação:** esta dica é uma direção dada pelo Lume, e o jogo já conta
direções pedidas ao Lume como sinal de Conformidade (`lume.perguntasCaminho`). Uma dica que a
missão **empurrou** não é uma pergunta que a criança **fez** — se contar junto, a missão
inflaciona Conformidade de quem simplesmente aceitou ajuda. Tem que ficar fora daquele
contador, explicitamente.

### Batida 3 · divergente — NAVEGAR e DIVIDIR

**Bolha A · o golpe grosseiro outra vez.** Momento tranquilo.

> **SquadFogo_Oficial**
> *"PARABÉNS!!! Você foi o jogador 1000 da Vila hoje 🎉"*
> *"clica aqui pra resgatar tua RECOMPENSA ESPECIAL antes que acabe"*

**Bolha B · autoridade e urgência.** Depois da quinta fogueira, quando ela já tem o que perder.

> **Lume · Suporte da Vila** ✓
> *"Oi. Detectamos um acesso estranho na sua sala hoje."*
> *"Suas fogueiras estão marcadas pra apagar em 2 minutos. Pra cancelar, confirma que é
> você: manda teu número de estudante e a senha da sala aqui."*
> *"Se não responder, não tem como recuperar depois."*

Remetente **conhecido**, selo, português correto, ameaça ao que ela **construiu**, prazo
curto, e o pedido embrulhado como proteção. E é o **mesmo nome** da mensagem legítima da
batida 2 — que é o que faz esse golpe ser bom.

**Bolha C · o colega e o momento.** No instante em que ela fica sem fagulha.

> **Estudante 14 · sua turma**
> *"opa, tu tá na Vila agora? sou da tua sala, sentei atrás de ti"*
> *"tô com fagulha sobrando aqui, te mando"*
> *"me passa o link da tua sala que eu mando direto pro teu número"*

**Este não pede senha.** Pede um passo pequeno, plausível, de alguém que parece real, no
minuto exato em que ela precisa. Nenhum dos sinais aprendidos na batida 1 aparece: sem CAPS,
sem link torto, sem promessa absurda, sem pressa explícita.

### Batida 4 · comum — a segunda legítima, e a mais cruel

Chega **depois** do golpe da batida 3, e é **verdadeira**.

> **Estudante 07 · sua turma**
> *"ei, acho que te mandaram uma mensagem estranha agora há pouco"*
> *"chegou uma igual aqui pra mim. não clica não"*
>
> `1` Responder e perguntar o que era · `2` Ignorar · `3` Avisar um adulto

Quem foi ficando desconfiado com tudo **também recusa esta** — e recusa o único aviso
verdadeiro que recebeu. É a demonstração, dentro do jogo, de que desconfiar de tudo não
protege ninguém.

### Batida 5 · a consequência fica na conversa, nunca no jogo

**Esta missão não toca na jogabilidade.** Nenhuma escolha aqui tira fagulha, apaga nome da
Pedra ou muda qualquer coisa da Vila. Ela **lê** o estado do jogo para escolher a hora de
mandar a mensagem, e **nunca escreve** nele.

A regra não é organizacional, é de medida: fagulha é o recurso que sustenta Benevolência e
Universalismo. Se um golpe custasse fagulhas, a criança que caiu apareceria como **menos
generosa** no retrato de valores — e o instrumento de phishing estaria contaminando o
instrumento de Schwartz, sem que nada no relatório mostrasse isso.

A consequência existe, mas vive **dentro da conversa**: o remetente responde em personagem,
como quem conseguiu o que queria.

> **BRILHO_MASTER_99** — *"boa! já tô vendo aqui 👀"*
> **Lume · Suporte da Vila** — *"Confirmado. Obrigado, sua conta está protegida."*
> **Estudante 14** — *"valeu! te mando já já"*

E nunca chega nada. É só isso. A criança fica com a sensação de que alguma coisa não fecha, e
o jogo não comenta.

Quem recusou também não recebe elogio nenhum.

---

## O debate · 10 a 15 minutos

O debate **também é instrumento**. Não é só o fecho da aula: é onde aparece a população que a
telemetria não distingue — **quem não prestou atenção em nada**.

Uma pergunta na lousa. **Sem pressupor golpe:**

> ### Em quem dava pra confiar?

O professor **não corrige nada**. Só pergunta *"o que te fez confiar/desconfiar dessa?"* e
**anota os sinais na lousa**.

O que vai acontecer:

- A bolha **A** dirá que era tudo óbvio.
- A bolha **C** não vai conseguir explicar por que caiu — a mensagem dela não tinha nenhum dos
  sinais que os outros estão citando.
- A bolha **B** dirá *"mas parecia ser o Lume"* — e é a mais interessante, porque **era** o
  Lume na batida 2.
- E vão aparecer **dois** grupos transversais, de todas as bolhas:
  - **os que não confiaram em nada** — vão se apresentar como os espertos da sala;
  - **os que não lembram de mensagem nenhuma.** Esses não discordam de ninguém: ficam
    calados, ou perguntam "que mensagem?". É a resposta mais importante da sala, e a única
    que não aparece em telemetria — o contador não separa *"deixei passar de propósito"* de
    *"nem vi"*.

### A folha do professor

Enquanto a sala discute, o professor marca ao lado do nome de cada estudante **uma** letra:

| | |
|---|---|
| **P** | tomou posição e sustentou com um motivo tirado da mensagem |
| **S** | tomou posição, mas repetindo o que o colega disse |
| **N** | não participou |
| **?** | disse que não lembra de ter recebido mensagem |

`?` é o achado. Combinado com a telemetria fecha o diagnóstico:

- `?` **+ `ignoradas` alto** → não viu. A mensagem competiu com o jogo e perdeu.
- `?` **+ `respondidas` alto** → respondeu sem ler. Clicou para tirar da frente.

São duas crianças diferentes e o mesmo silêncio no debate.

Deixe alguém dizer *"quem cai nisso é bobo"*. Vai ser dito. Anote quem disse.

---

## A explicação final

O professor projeta as mensagens **de todas as bolhas**, lado a lado, marcando quais eram
verdadeiras. É a primeira vez que a turma vê as outras versões.

> Vocês estão todos certos.
>
> Era óbvio — **para quem recebeu aquela.**
> Não dava pra saber — **para quem recebeu esta.**
>
> Vocês não receberam as mesmas mensagens. E não foi escolhido quem é mais esperto: o
> sistema distribuiu as três versões pela sala, para que as três estivessem aqui hoje.

Então, olhando para quem disse que era óbvio, **ler em voz alta a mensagem da bolha C**:

> E essa? Você teria percebido?
>
> Não tem erro de português. Não tem link estranho. Não promete nada absurdo. Não te apressa.
> Vem de alguém que diz ser da sua sala, que sabe que você está jogando, no minuto em que
> você está travado.
>
> Nenhum sinal que vocês escreveram na lousa aparece nela.

E então, para o grupo que não confiou em nada:

> Duas daquelas mensagens eram **verdadeiras**.
>
> O Lume ia te mostrar onde tinha fagulha. O Estudante 07 tentou te avisar. Vocês recusaram as
> duas — e recusaram o único aviso honesto que receberam naquela noite.
>
> Não confiar em nada não é estar seguro. É estar sozinho.

---

## O que a turma leva

**1. Cair não é burrice, é contexto.** O melhor golpe não parece golpe: vem da pessoa certa,
no momento em que você precisa, pedindo algo pequeno.

**2. Os sinais só pegam os golpes ruins.** Todos os que a turma escreveu na lousa são
verdadeiros — e nenhum funciona contra um golpe bem-feito. Eles existem porque golpe ruim é
barato, não porque funciona.

**3. Desconfiar de tudo não é a resposta.** Custa igual, e isola.

**4. A regra que sobrevive** — a única coisa da aula para decorar:

> **Confere por outro caminho.**
> Diz que é o suporte? Sai do chat e procura o suporte. Diz que é o Estudante 14? **Vira e
> pergunta pro Estudante 14.** Diz que é sua mãe? Liga pra sua mãe.
>
> Golpe nenhum sobrevive a uma segunda conversa — e é exatamente por isso que todo golpe tem
> pressa. **Pressa é o único sinal que atravessa os três níveis.**

**5. Para quem disse "quem cai nisso é bobo":** essa frase é a razão pela qual as pessoas não
contam quando acontece com elas. E não contar é o que faz o golpe seguinte funcionar na mesma
casa.

---

## Notas de aplicação

**Faixa.** 10–14. Do 1º ao 5º ano a api **já não serve** a bolha B (`SERIES_SEM_BOLHA_B` em
`apps/api/src/vila/regras.ts`): o contraste A × C sozinho divide a sala, e "suporte" exige
entender o que é suporte. Não há nada a cortar à mão — e o guia do professor no hub esconde
a bolha B quando a turma escolhida é dos anos iniciais.

**Nunca pergunte quem clicou.** Nem por levantar a mão. A missão foi desenhada para funcionar
sem essa pergunta; fazê-la destrói o resultado, porque quem caiu passa a defender que não
caiu, e a lição vira vergonha.

**Não há como garantir que "Estudante 14" seja um número vago:** a turma da plataforma é real e
o texto do cartão é fixo no catálogo da api. Por isso a segunda metade virou requisito, não
recomendação — a revelação **tem** que dizer, com todas as letras, que **não foi um colega de
verdade**. Está em destaque no guia do professor por esse motivo. Se a turma sair achando que
o Estudante 14 fez algo, a missão causou dano.

**A consequência dentro do jogo nunca é rotulada.** Regra do projeto, não estilo.

**Não conte antes**, e não avise para prestarem atenção nas mensagens. A instrução é só
*"vocês vão manter a Vila acesa"*.

---
## O que o código faz hoje

> A seção que estava aqui era uma LISTA DE PEDIDOS, escrita quando nada disto existia
> ("hoje não se coleta nada de útil", "isto entra como campo opcional novo"). Tudo foi
> implementado no porte para a plataforma, e vários pedidos foram atendidos de forma
> diferente da que o texto imaginava. Substituída pelo que existe.

**Os cartões vivem na api**, não no bundle: `apps/api/src/vila/catalogo.ts`. A criança recebe
só os da bolha dela, **sem gabarito** — `semGabarito()` tira `nivel`, `legitima` e o `aceita`
de cada opção. As outras duas versões nunca chegam ao navegador dela, e é isso que faz a
revelação final ser mesmo a primeira vez que a turma vê as outras.

**O jogo registra o que ela FEZ, e nada do que aquilo significa.** Por cartão, cinco campos:

| campo | o que é |
|---|---|
| `id` | qual cartão |
| `emMs` | quando apareceu, em ms desde o início da partida |
| `viuOpcoes` | separa "deixei passar" de "nem vi" — na segunda ela nunca teve chance real |
| `escolha` | 1, 2 ou 3; `null` se não respondeu |
| `decisaoMs` | o campo mais informativo dos cinco: cair em dois segundos e cair depois de dez são duas crianças diferentes |

`nivel`, `legitima` e `aceitou` **não vêm do cliente** — a api os aplica a partir do catálogo
(`regras.corrigirCartoes`) e recusa a partida se um cartão não pertencer à bolha daquela
criança. Isso substituiu o campo `bolha` que o payload mandava: os ids dos cartões provam a
bolha, e provar é mais forte que declarar.

**A leitura sai em seis contagens**, não quatro (`apps/api/src/vila/mensagens.ts`):
`golpeAceito`, `golpeRecusado`, `legitimaAceita`, `legitimaRecusada`, `nemViu`,
`deixouPassar`. A frase do topo **nomeia o nível antes do ato**, e a tela do professor abre
pelo cartão da bolha antes de qualquer contagem.

**Os gatilhos são quatro**, avaliados no jogo porque só ele conhece o estado da partida
(`10-terrain.js`): `inicio` (20s dentro da vila), `aposFogueiras:N`, `semFagulha`, e
`aposCartao:N`. O último era `aposGolpe` — o nome dizia ao cliente qual cartão era o golpe;
por índice diz a mesma coisa sobre ordem e nada sobre conteúdo.

**A missão continua sem tocar no jogo.** Nenhuma escolha aqui tira fagulha, apaga nome na
Pedra ou muda qualquer coisa da Vila — fagulha é o recurso que sustenta Benevolência e
Universalismo, e um golpe que custasse fagulha faria a criança que caiu aparecer como menos
generosa no retrato de valores.
