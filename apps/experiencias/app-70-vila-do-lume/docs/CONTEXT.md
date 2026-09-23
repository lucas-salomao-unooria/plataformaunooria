# Vila do Lume — glossário

Jogo 3D em navegador para crianças de 6 a 13 anos. Duas camadas que nunca se cruzam: a criança vive uma história de reacender uma vila; o adulto recebe, depois, um retrato comportamental orientado pela Teoria dos Valores Básicos de Schwartz.

## Camadas

**Camada 1**:
O que a criança experimenta. História, missão, HUD. Precisa ser divertida e coerente sozinha.
_Avoid_: frontend, jogo, UI

**Camada 2**:
A instrumentação invisível que registra comportamento e produz o perfil. Só o adulto vê, e só depois da partida.
_Avoid_: backend, analytics, telemetria

## Objetivo

**Objetivo Principal**:
Acender as 8 Fogueiras. Único caminho obrigatório para terminar o jogo.
_Avoid_: missão, quest

**Ato Opcional**:
Ação que a criança pode fazer ou não, e que não é exigida para terminar o jogo — ajudar Aldeão, acender Lampião, ler nome na Pedra, tocar Sino, ouvir história. É o principal insumo de Camada 2, porque só aparece quando ela escolhe.
_Avoid_: side quest, bônus, extra

**Score**:
Número na HUD que existe apenas para motivar a criança a terminar o Objetivo Principal. Não pontua Ato Opcional — pontuar escolha livre transformaria sinal de valor em perseguição de placar.
_Avoid_: pontuação, XP, recompensa

**Zero Observado**:
Valor que teve Oportunidade Percebida e nenhum sinal. Diferente de "não observado": é um zero legítimo, e entra na média do polo.
_Avoid_: ausência, nulo

## Observação

**Chamado**:
Sinal diegético que um Ato Opcional emite quando a criança chega perto — o Aldeão grita e solta fumaça, o vidro do Lampião apagado pulsa dentro de 7 unidades. Substitui contador e ponto como forma de anunciar que a ação existe.
_Avoid_: dica, tutorial, quest marker

**Oportunidade Percebida**:
Registro de que um Chamado alcançou a criança — ela esteve perto o bastante para receber o sinal. Distingue "não quis" de "não viu", e é o que autoriza a Camada 2 a tratar a ausência do ato como escolha.
_Avoid_: exposição, trigger

## Saída

**Relatório do professor**:
Única superfície onde o vocabulário Schwartz aparece. Vive no **hub do professor** (`/professor/entre-redes/vila-do-lume/estudantes/:id`) — fora do jogo, e a criança não o abre. Publica os 10 valores, cada um com seu grau de sustentação: número só onde há duas ou mais **fontes de medida distintas**, texto descritivo onde há uma só, "não observado" onde não houve Oportunidade Percebida.

Duas travas que o porte acrescentou: a regra do número deixou de ser convenção de tela e virou **tipo** (`leitura.ts` — só a variante `scored` carrega `numero: number`, então o hub nunca recebe o número que não pode desenhar); e na **listagem da turma nenhum valor aparece**, porque listagem é ordenável e uma coluna "Poder" viraria ranking de crianças.
_Avoid_: painel do responsável, dashboard, resultado

**Selo**:
O que a criança recebe no fim — reconhecimento do que ela fez ("Acendeu as 8 Fogueiras"). Nunca do que ela é.
_Avoid_: retrato, perfil, tipo, classificação

## Dilema

**Dilema**:
Momento em que dois Atos Opcionais disputam a mesma Tocha e a criança só pode atender um. É a única situação do jogo em que escolher custa algo, e por isso o insumo mais forte da Camada 2.
_Avoid_: escolha, trade-off, encruzilhada

**Tocha**:
Fogo único que a criança carrega na mão, aceso numa Fogueira já queimando ao custo de 1 Fagulha. Só cabe uma por vez, e cada Ato Opcional gasta ela inteira — é o que faz o Dilema ser sentido sem exigir aritmética de quem tem 6 anos.
_Avoid_: chama, fogo

**Chama Sagrada**:
O que sobe de cada Fogueira recém-acesa e a criança coleta. São 8, e juntá-las é o Objetivo Principal. Não confundir com Tocha: uma é o objetivo, a outra é o recurso.
_Avoid_: fragmento, caco

**Destaque**:
Os três lugares gravados no alto da Pedra dos Nomes, ocupados por nomes de **aldeões** da Vila (Tião da Crista, Nilda do Portal, Bento da Praça). Gravar ali exige apagar alguém. Nunca nome de colega de turma: na plataforma a turma é real, e apagar o nome de um colega mediria a relação entre as duas crianças, não o valor — além do dano em sala.
_Avoid_: pódio, ranking, top

**Borda**:
Faixa estreita e vazia na base da Pedra dos Nomes, onde ainda cabe um nome sem tirar ninguém. Existe para separar quem quer a própria marca de quem quer o lugar de outro.
_Avoid_: cantinho, rodapé

**Nome de Jogo**:
Como a criança é chamada dentro da vila. **Ela não digita nada e não escolhe nada**: é o **primeiro nome** dela, vindo da sessão autenticada da plataforma (`Ana Beatriz Souza` → `Ana`). Vive só na Camada 1 — aparece na Pedra dos Nomes e na fala do Lume — e nunca é serializado.
Houve um campo de texto onde ela digitava um apelido. Saiu: um campo livre é por onde um nome de criança entra num arquivo, e a única forma segura de impedir isso é não ter onde escrever.
_Avoid_: nome, usuário, jogador

**Modo Livre** (extinto):
Existiu enquanto a identidade vinha de link: o jogo aberto sem link jogava inteiro e não gravava nada. Na plataforma não há partida sem sessão — sem handshake o jogo **não abre**, porque partida órfã desaparece e o professor lê a lista achando que a criança não jogou.
_Avoid_: anônimo, convidado, demo

**Fonte de Medida**:
De onde um sinal vem, não quantas linhas o descrevem. Duas leituras da mesma variável (tempo na luz e seu complemento, tempo no escuro) são **uma** fonte. O portão que autoriza um valor a virar número conta fontes por isso.
_Avoid_: probe, sinal, indicador

## Geografia

**Crista**:
Muralha de rocha em arco que separa parte da vila do centro, com uma única fenda. Não é intransponível — é um custo de rota: contornar pelas pontas é o dobro do caminho, e a fenda é o trecho mais escuro do mapa.
_Avoid_: muro, parede, barreira

**Passarela**:
Estrutura de pranchas na fenda da Crista, com um braseiro apagado. Acender custa uma Tocha e vale pelo resto da partida. É o único destino da Tocha que beneficia apenas quem a gastou.
_Avoid_: ponte, atalho

**Mastro**:
Marcador alto em cada zona, visível através da névoa. A altura cresce com a distância ao centro — zona longe é cara de alcançar e fácil de avistar, para que o esforço seja constante e a criança decida *quando* ir, nunca *se consegue achar*.
_Avoid_: beacon, farol, marcador

**Fumaça**:
Coluna que sobe do Aldeão perdido e atravessa a névoa e a Crista. É a forma que o Chamado assume à distância, e funciona sem áudio — o contexto de uso é sala de aula sem fone.
_Avoid_: sinal, fogueira

## Economia

**Fagulha**:
Recurso extraído de Pedra. Moeda única do jogo — gasta em Fogueira (obrigatória, 1 cada) e em acender uma Tocha (1 cada). É escassa de propósito: não dá para fazer tudo.
_Avoid_: brasa, cristal, moeda
