# Sessão de decisão — expansão do mundo

> **Registro histórico — não é especificação.**
>
> Transcrição de uma sessão de design de 20/08/2026, quando a Vila do Lume era um app
> standalone. Está aqui pelo raciocínio: por que cada decisão foi tomada e quais
> alternativas foram descartadas. **Não leia para saber como o jogo funciona hoje** —
> isso está em `GAME_DESIGN.md`, e o glossário em `CONTEXT.md`.
>
> O porte para a plataforma (26/08/2026) invalidou parte do que está escrito abaixo:
>
> - **Identidade.** Não há mais `?aluno=N&turma=`, grade de slots nem "modo livre". Quem
>   joga é o aluno autenticado da plataforma; sem sessão, o jogo não sobe.
> - **Persistência.** Não há mais `localStorage`, chave de partida no navegador, export de
>   `.json` pelo console nem cópia por pendrive. A partida é aberta e gravada na api
>   (`/vila/*`), e o id vem de lá.
> - **Painel.** Não existe `?painel` nem qualquer tela de resultado dentro do jogo — e o
>   `?painel` que este texto DECIDE implementar foi justamente o que se abandonou. O
>   relatório vive no hub do professor.
> - **Bolha da missão.** Não é mais `alunoSlot % 3` no navegador; é atribuída pela api,
>   balanceada por turma, e não é servida a bolha B nos anos iniciais.
> - **Nome de Jogo.** A criança não digita nome nenhum, e não há campo nem validação. O jogo
>   recebe o primeiro nome da sessão e apenas o mostra antes de entrar. Continua valendo que
>   ele nunca é persistido (`adr/0002`).
> - **Como o jogo roda.** Bundle estático embedado num iframe do hub — Vite em dev, CDN em
>   produção. Não é mais um arquivo só: as referências a `index.html:<linha>` e aos `.bak`
>   não têm correspondente.
>
> Onde o texto abaixo descreve um desses mecanismos, ele está descrevendo o passado.
> - **CDN e banco.** A dependência de `unpkg`/Google Fonts listada como pendência foi
>   resolvida na mesma sessão (vendorização), e o banco de dados listado como "etapa
>   própria" é hoje o módulo `vila` da api.

Segunda entrevista do dia. Ponto de partida: a proposta de crescer o mundo, criar assimetria, esconder Aldeões e adicionar obstáculo. Contexto de uso revelado no meio da sessão: **sala de aula com computadores de escola pública**.

Framework de decisão registrado em [`CLAUDE.md`](./CLAUDE.md). Glossário em [`CONTEXT.md`](./CONTEXT.md).

---

## O achado que reenquadrou tudo

O mapa foi medido em segundos, não em unidades:

| percurso | distância | tempo |
|---|---|---|
| entre duas zonas vizinhas | 9,9 u | 1,4 s |
| volta completa no anel | 80 u | 11 s |
| travessia pelo centro | 26 u | 3,7 s |
| **partida mínima obrigatória** | — | **~20 s** |

O C-18 estimava 44 s de piso. São 20.

A causa é a velocidade: **7 u/s**, com blocos 1×1. A criança se move mais rápido do que *correndo* no Minecraft (5,6 blocos/s). É por isso que nada parece longe — e é por isso que crescer o mapa, sozinho, não resolve: levar uma zona para raio 24 adiciona 3,4 segundos.

Segundo achado, do mesmo tipo: `WORLD_DIM.fogFar = 38` e o conteúdo inteiro cabe em raio 18. **De qualquer ponto do mapa, inclusive das bordas, ela enxerga tudo.** A escuridão era decorativa — deixava a cena roxa, não escondia nada. Esconder as zonas não funcionaria sem mexer nisso.

---

## Perguntas e respostas

### Q1 — Quanto tempo dura uma partida?
**Decidido: 8 a 12 minutos, com o obrigatório em ~5.**

`evidence.enough` já exige 5 minutos, então abaixo disso o painel nasce avisando que não sabe. Criança de 6 sustenta 10–15 min num jogo novo, e partida abandonada não gera perfil nenhum. Os Atos Opcionais precisam caber **depois** do obrigatório.

### Q2 — De onde vem o tempo que falta?
**Decidido: procura. Distância só de apoio, volume nenhum.**

Só existem três fontes: distância, volume (mais tarefas) e procura. Empilhando mapa 3× e velocidade 40% menor chega-se a ~64 s — ainda 4,7× abaixo do alvo. Volume é trabalho repetitivo que infla o relógio sem gerar uma escolha, e ainda satura Realização, que é medida por *ritmo*.

Procura multiplica o tempo **e** gera comportamento legível: quem varre, quem vai pro escuro primeiro, quem volta pedir ajuda. E a dificuldade cai sozinha ao longo da partida — cada fogueira acesa revela um pedaço da vila, então procurar é difícil quando ela tem paciência e fácil quando está cansada.

### Q3 — O que fica escondido?
**Decidido: as 8 zonas. O Lume vira a bússola sob demanda.**

A bússola da HUD apontava sempre a zona não visitada mais próxima, com nome e distância — não só removia a procura, **desenhava a rota ótima**, já que ir sempre na mais perto é percorrer o anel em ordem.

Ela sai. Quando quiser direção, a criança volta ao centro e pergunta ao Lume.

Três efeitos:
- O tempo vem sem inventar tarefa.
- Ninguém trava: o centro é o único ponto que ela sempre sabe achar, e o Lume está lá.
- **Conformidade deixa de ser um bit e vira gradiente.** Hoje é "acendeu primeiro onde o Lume mandou" — sim ou não, uma vez. Passa a ser quantas vezes ela preferiu perguntar em vez de achar sozinha, com custo real de caminhada a cada ida. Autodireção e Conformidade viram lados da mesma medida, ao longo da partida inteira — que é como o circumplexo os trata.

### Q4 — A criança continua a 7 u/s?
**Decidido: 4,5 u/s**, a velocidade de andar do Minecraft.

A mesma vila fica 55% mais demorada sem mudança de mapa, e atravessar 20 blocos escuros passa de 2,8 s para 4,4 — a diferença entre hesitar e não pensar. Efeito colateral: cortar pelo escuro passa a economizar tempo de verdade, então o probe Segurança × Estimulação fica honesto.

### Q5 — Até onde ela enxerga no escuro?
**Decidido: 20 unidades, subindo para 75 conforme as 8 acendem.**

A máquina já existia (`worldGlow` interpola `WORLD_DIM` → `WORLD_FULL`); só os números estavam errados. A 20, um mapa de raio 30 mostra um terço de si por vez.

Restrição registrada: **escuro aqui não pode ter ameaça.** As sombras foram removidas do projeto porque mediam medo em vez de estilo. Escuridão sem nada dentro limita o que você sabe, não o que pode te acontecer. Se entrar bicho no escuro, o probe volta a medir a idade dela.

### Q6 — Até onde vai o conteúdo?
**Decidido: raio 8 a 30** — vila de 60 blocos de ponta a ponta, a escala de uma vila de Minecraft.

Não vai além por um motivo específico: de raio 30, voltar ao Lume custa 6,7 s de ida e 6,7 de volta. Caro o bastante pra ser escolha real — que é o que faz o gradiente Conformidade × Autodireção existir — e barato o bastante pra ela ainda fazer. A 34+ ela para de perguntar, e aí não é decisão, é punição.

### Q7 — A zona mais distante é mais fácil ou mais difícil de avistar?
**Decidido: mais fácil, e proporcionalmente.** Quanto mais longe, mais alta e visível a estrutura.

Decidido aplicando o teste duplo às duas opções:

|  | mais visível | mais escondida |
|---|---|---|
| **jogo melhor?** | sim — esforço constante, nunca vaga sem ideia | não — o fim vira varredura, onde criança pequena larga |
| **valor legível?** | sim — separa *quando ir* de *se acho* | só na aparência — mede persistência na busca, que não é valor de Schwartz |

O que decidiu: **busca espacial é uma das habilidades que mais varia entre 6 e 13 anos.** Se achar é o custo, o painel de uma criança de 7 e o de uma de 12 medem coisas diferentes com o mesmo rótulo, e a mais nova sai parecendo menos determinada quando é só menor. Virou regra em `CLAUDE.md`: **ponha a dificuldade onde o relógio decide, não onde a maturidade decide.**

### Q8 — A ravina tem ponte que custa Tocha?
**Decidido: sim, e a ravina continua atravessável sem ela.**

Três rotas pela mesma geografia:

| rota | custo | revela |
|---|---|---|
| contornar pela luz | o dobro do caminho | **Segurança** |
| atravessar por dentro | trecho mais escuro do mapa | **Estimulação** |
| acender a ponte | uma Tocha, e vale o resto da partida | **Realização** |

A ponte é o primeiro destino da Tocha que beneficia **a própria criança**. Hoje a Tocha só vai para outra pessoa (Aldeão) ou para o lugar (Lampião) — as duas metades de Autotranscendência. A ponte põe Autopromoção disputando o mesmo recurso, no meio do mapa, cedo — enquanto a Pedra dos Nomes é evento único e fácil de nunca acontecer.

Sem a ponte nada fica inacessível: quem nunca gastar uma Tocha ali termina igual, só andando mais.

### Q9 — Como ela localiza o Aldeão escondido?
**Decidido inicialmente:** som posicional repetido, com o Lume como rede de segurança.
**Revisto após o contexto de sala de aula: sinal visual, com som apenas como reforço.**

Dois pares de Dilema (Aldeão + Lampião) vão para o escuro; dois ficam no caminho como controle. A busca vem antes do Dilema, sem desfazê-lo.

O Chamado precisa alcançá-la de qualquer jeito, senão `observed.benevolence` volta a ser ambíguo e o conserto do C-09 se perde. Solução final: **fumaça pálida subindo acima da linha do horizonte**, na direção do Aldeão — sobe acima da névoa, atravessa a ravina e o paredão, e funciona no mudo. Direção grosseira, sem seta e sem distância, como o som seria.

Probe novo que isso cria: **"viu o chamado e foi atrás" × "viu e seguiu em frente"**, medido pela distância andada na direção do sinal. É o primeiro probe do projeto que lê mudança de intenção no meio do movimento, em vez de um clique. Desviar da própria rota por alguém é Benevolência muito mais forte que ajudar quem estava do lado do caminho.

---

## Contexto de uso: sala de aula, escola pública

Revelado no fim da sessão. Impacto medido:

**1. O jogo depende de internet pra existir.** `unpkg.com` × 2 (Three.js, PointerLockControls) e Google Fonts. Com internet instável, proxy ou filtro, a tela fica preta sem mensagem de erro. **Pendência de deploy, não implementada nesta etapa** por decisão do dono (foco no jogo).

**2. Renderização pesada demais.** Sombras PCFSoft 2048×2048, antialias, pixelRatio até 2, e até **21 PointLights** dinâmicas simultâneas. Intel HD de PC de 2013 engasga bem antes. Gargalo é luz, não geometria — o que é bom, porque a expansão custa geometria.

**3. Som posicional morto.** Sem fone, 30 máquinas na mesma sala, provavelmente no mudo. E por acessibilidade: criança surda precisa poder jogar. Nenhum Chamado pode depender de áudio.

Decisões tomadas em consequência:
- Sombras desligadas, antialias off, pixelRatio 1.
- **O mapa maior não ganha nenhuma luz nova.** Fogueiras e lampiões extras usam material emissivo e decalque no chão em vez de PointLight.
- Som nunca carrega informação sozinho.

---

## Adiado por decisão do dono

- **Componentização do código** — etapa própria.
- **Extração / banco de dados** — etapa própria. Inclui a coleta dos perfis numa sala de trinta máquinas, hoje presos cada um no `localStorage` da sua, com a segunda turma do dia apagando a primeira em silêncio.
- **Vendorizar Three.js e as fontes** — necessário antes de qualquer uso real em escola.

## Riscos que continuam abertos

- **A sessão pode ficar longa demais.** O alvo subiu de 20 s para 8–12 min. A direção é certa (mais tempo decidindo, não andando), mas se passar do fôlego de uma criança de 6 o risco vira abandono no meio — e partida abandonada não gera perfil nenhum. Precisa de teste com criança real antes de considerar fechado.
- **Nada disso foi validado com uma criança.** Todas as decisões desta sessão são raciocínio sobre geometria e tempo.


---

## Implementação — 2026-08-20

Tudo implementado em `index.html` e verificado em navegador. Backup em `index.html.pre-mundo.bak`.

### Números antes e depois

| | antes | depois |
|---|---|---|
| velocidade | 7 u/s | **4,5 u/s** |
| visão no escuro (`fogFar`) | 38 u | **20 u**, crescendo até 75 |
| raio do conteúdo | 18 | **30** |
| distribuição das zonas | 8 em r=13, a cada 45° | **r de 10 a 29, ângulos irregulares, vazio de 75°** |
| muro de borda | r=24 | r=34 |
| **luzes na cena** | **26** | **11**, e não cresce no pior caso |
| sombras / antialias / pixelRatio | PCFSoft 2048², on, até 2 | **off / off / 1** |

O corte de luzes veio de três lugares: a PointLight decorativa por zona que só a bússola lia (−8), os Lampiões (−6) e as tochas dos Aldeões (−até 8). Todas viraram material emissivo mais um decalque no chão — no escuro a leitura é quase idêntica e o custo de shader é zero. Em Lambert, **luz apagada custa quase o mesmo que luz acesa**, porque entra no shader de todos os materiais de qualquer jeito.

Efeito colateral: o C-05 deixou de existir. Não há mais PointLight de Lampião para o `restart` remover da cena e esquecer de devolver.

### Verificado em execução

| o que | resultado |
|---|---|
| Crista bloqueia, fenda passa | `collidesObstacle` true na rocha, false na fenda |
| Passarela | custa 1 Tocha, acende permanente, entra em Realização |
| Lume como bússola | responde direção cardeal grossa, incrementa `lumeAsks` |
| Bússola da HUD | elemento removido, zero referências órfãs |
| Mastros | 8 construídos, altura proporcional ao raio, `fog:false` |
| Fumaça | 4 colunas, `fog:false`, some quando o Aldeão é resgatado |
| Probe "foi atrás" | `smokeSpotted` e `smokeFollowed` registrando |
| Pares de Dilema | 4 pares a 3,00 unidades, 2 além da Crista |
| Ciclo do Aldeão | dá Tocha → caminha → planta na Praça → ela retoma → volta a carregar |
| Gradiente de Benevolência | "Deixou a luz na Praça" some quando ela retoma o fogo |
| Final e painel | sem erro, sem vazamento de Schwartz na tela da criança |

### Bugs encontrados ao implementar

- **`PRACA_POS` era uma constante fixa `{9.2, -9.2}`** — ficou apontando para onde a Praça costumava estar antes do mapa ser redesenhado, e os Aldeões caminhavam para um ponto vazio ao lado do Mural. Agora deriva da zona.
- **Tocha plantada caía em cima do ponto da Chama Sagrada** da Praça: o `E` pegava o fragmento em vez de retomar o fogo. Raio de 2,4 para 4,6.
- **Passarela a 2,3 unidades do Lampião do par 2** — o `T` acendia o lampião. Par movido de 128° para 105°.
- **Veia de pedra a 2,1 unidades da Passarela**, sequestrando o prompt. Movida.
- **`#compass` foi removido do DOM com cinco `getElementById('compass')` ainda vivos** — cada um teria lançado `TypeError` em tempo de execução.

### Novos probes que a expansão criou

- **`lumeAsks`** — quantas vezes ela voltou ao centro pedir direção. Conformidade deixou de ser um bit no início da partida e virou gradiente ao longo dela.
- **`fires >= 4 && lumeAsks === 0`** — o outro lado do mesmo eixo, em Autodireção. Só conta com quatro fogueiras acesas: no começo ninguém sabe nada, e não perguntar cedo é sorte, não autonomia.
- **`smokeFollowed / smokeSpotted`** — cortou pela metade a distância até uma Fumaça depois de avistá-la. Lê intenção no meio do movimento.
- **`passarelaLit`** — Tocha gasta no próprio atalho, em Realização.

### Vendorização — feita

`index.html` não faz mais nenhuma requisição externa. Three.js r128, PointerLockControls e os subsets latin/latin-ext das duas fontes vivem em `vendor/`, por referência (não embutidos — decisão do dono, para manter o HTML legível e permitir a componentização futura). Ver `vendor/README.md`.

Ao copiar para uma máquina de sala, leve a **pasta inteira**: sem `vendor/` ao lado, a tela fica preta de novo.

### Três bugs de constante desatualizada, encontrados depois

Todos da mesma família: número que descrevia o mapa antigo e não acompanhou o crescimento. Nenhum dava mensagem de erro.

**1. `const r = 22` travando o movimento.** O conteúdo foi para r=30, e o clamp continuou em 22 — Portal Secreto (29), Pedra dos Nomes (27) e Campo de Treino (24) ficaram **fisicamente inalcançáveis**. As três são fogueiras obrigatórias: o jogo tinha virado impossível de terminar. Agora `WORLD_LIMIT` deriva da zona mais distante.

**2. Ponto de partida dentro da Crista.** `(0, 18)` caiu dentro de um bloco de rocha novo, `collidesObstacle` bloqueou todas as direções e **o WASD parou de mover** — foi o sintoma que o dono reportou. Spawn movido para `(0, 9)`, mais `safeSpawn()`, que empurra para fora em espiral se algum dia isso se repetir.

**3. `PRACA_POS` fixo em `{9.2, -9.2}`** — já registrado acima.

Virou regra em `CLAUDE.md`: **constantes de mundo se derivam, não se digitam.**


---

## Correções após o primeiro teste do dono

**Nome de Jogo não era obrigatório.** O botão "Pular e ir direto" chamava `startGame()` contornando o cartão do nome — e sem nome a Pedra dos Nomes grava "VOCÊ", que não significa nada para ninguém. Agora pular leva ao último cartão (onde o nome é pedido), o botão de entrar fica desabilitado enquanto o campo está vazio, espaço em branco não conta, e Enter entra.

**O Lume indicava um lugar que a criança não tinha como identificar.** Com a bússola removida, "eu começava pelo Mural de Recados" virou instrução inútil: nada no mundo dizia qual dos mastros era o Mural. Buraco aberto por mim na Q3, não percebido porque testei o Lume por função, nunca pelos olhos de quem joga.

Correção em duas partes:
- **O mastro carrega o nome do lugar**, com fade por distância: invisível além de 30 unidades, sólido a partir de 18. A cor da bandeira continua aparecendo de qualquer distância — de longe ela sabe que *tem um lugar ali*, e só perto descobre *qual*. A procura continua existindo; a frustração de não poder seguir uma indicação, não.
- **A sugestão inicial passou a dar direção junto com o nome:** "fica pro fundo da vila, procura o mastro de bandeira lá".

**Aldeão atravessava paredes.** `updateVillagers` movia em linha reta sem consultar `collidesObstacle`. Correção em três camadas, porque as duas primeiras não bastaram:

1. Desvio local: tenta a linha reta e, se bloqueado, ângulos de até ±110°. Resolveu as caixas soltas.
2. **Não resolveu a Crista** — o arco é longo demais e o Aldeão ficava raspando a parede para sempre (3 unidades andadas em 900 passos). Solução: quem está além da Crista mira primeiro a fenda, atravessa, e só depois segue para a Praça. É a mesma passagem que a criança usa, o que deixa a cena legível — ela vê o Aldeão saindo por ali.
3. **Ainda travava na própria fenda**: ao chegar nela o Aldeão continuava "atrás da Crista" pelo teste de setor (a fenda está em r=17, dentro do arco) e mirava eternamente o ponto onde já estava. Trava `pastGap` resolve.

Verificado: os 4 Aldeões chegam à Praça, os 2 escondidos usam a fenda, **zero frames dentro de geometria**, e o retorno automático (quando as 8 acendem) também funciona. Os escondidos levam ~17 s contra ~3 s dos visíveis, o que é o contorno esperado.


## Tempo de leitura dos avisos

Reportado: "as orientações estão sumindo muito rápido". Medido: `showZoneIntroToast` usava **4,2 s fixos** para qualquer texto. A fala de abertura do Lume tem 29 palavras; uma criança em início de alfabetização lê perto de uma palavra por segundo. Ela sumia antes da metade.

**Duração agora vem do tamanho do texto** — 900 ms por palavra, entre 5 e 26 segundos. E as mensagens que orientam de verdade não têm prazo nenhum:

- **Sticky**: a sugestão de abertura do Lume fica na tela até a criança fechar com **ESPAÇO**. Ela lê no ritmo dela, relê se quiser, e o jogo não corre atrás de um relógio que ela não vê.
- **Primeira vez apenas**: a explicação da fogueira, da Tocha, do Aldeão e da Passarela gruda só na estreia. Depois disso ela já sabe, e um cartaz que precisa ser fechado toda vez vira estorvo.

Também ajustado: o mesmo nome aparecia duas vezes na faixa média — a placa do mastro e a placa de madeira da própria estrutura. A do mastro agora cobre só de 34 a 12 unidades, com fade nas duas pontas, entregando a leitura para o letreiro local em vez de disputar com ele.


---

## Arquitetura de mensagens

Reportado: "está confuso, aparece muita coisa, temos que separar instrução de evento". Auditoria: **8 canais simultâneos**, 30 chamadas de mensagem, 13 variantes de prompt contextual.

O problema não era volume — era **canal sem papel**. O `toastStack` sozinho carregava três naturezas no mesmo lugar e com o mesmo visual:

| natureza | exemplo | o que a criança precisa |
|---|---|---|
| instrução | "Dá pra acender uma coisa só com a tocha" | ler com calma, talvez reler |
| evento | "O aldeão foi pra Praça" | notar de canto de olho |
| erro | "Você não tem fagulha" | agir agora |

E o `interactPrompt` também instruía, então instrução estava em dois lugares. Faltava o canal mais importante: **nada respondia "o que eu faço agora?"** — a bússola respondia, e foi removida na Q3 sem substituto.

### Quatro cantos, quatro naturezas

**AGORA** (topo-centro, permanente) — uma linha, derivada do estado, diz o QUÊ e nunca o ONDE:
`QUEBRE UMA PEDRA PRETA` → `ACENDA A PRIMEIRA FOGUEIRA` → `PEGUE A CHAMA SAGRADA` → `FALTAM 7 FOGUEIRAS` → `VOLTE PRO FOGO SAGRADO`

Não é a bússola de volta: aquela apontava a zona mais próxima e desenhava a rota ótima; esta não sabe geografia nenhuma. Existe porque **criança travada não exerce valor nenhum — ela desiste.** O que precisa ser difícil é escolher, não entender.

**INSTRUÇÃO** (inferior-esquerdo) — balão do Lume, com rosto e nome, que espera ESPAÇO. Uma criança de 6 lê balão de personagem como "alguém está falando comigo"; um toast no canto ela lê como ruído do sistema, se é que lê. Toda explicação de mecânica passou pra cá, e só na estreia.

**EVENTO** (inferior-direito) — toast efêmero, nunca instrui. Mudou de lado: enquanto dividia canto com o balão, os dois empilhavam e voltavam a se confundir.

**AQUI** (centro-baixo) — o prompt contextual, reduzido a verbo e tecla. `T — ACENDER A FOGUEIRA DO MURAL DE RECADOS` virou `T acender fogueira`: o nome do lugar já está na placa do mastro e no letreiro da estrutura, e repetir era o mesmo texto três vezes na tela.

O rodapé fixo de teclas saiu — virou redundante com AGORA e AQUI.

### Instrução cumprida se apaga sozinha

Reportado: *"se eu pegar a chama tem que sumir"*. Cada instrução do Lume passou a carregar uma **condição de cumprimento**, e some no instante em que a ação acontece — sem exigir que a criança feche um aviso que ela já obedeceu.

| instrução | some quando |
|---|---|
| "eu começava pel[a] X" | qualquer fogueira acende |
| "aperta E pra pegar a Chama" | ela pega a primeira Chama |
| "dá pra acender UMA coisa só" | ela gasta a tocha |
| "o aldeão vai fincar a tocha na Praça" | a tocha é fincada |

O rodapé do balão muda junto: `faz isso — ou ESPAÇO pra fechar` quando há ação pendente, `ESPAÇO pra continuar` quando é só informação.

### O canal AQUI ganhou dois estados

Reportado com print: `precisa de 1 fagulha` pendurado permanentemente, com o mesmo destaque dourado de uma ação disponível. Dois erros no mesmo lugar.

**Um: falta de recurso não é ação.** O prompt tinha um visual só, então "você não pode fazer isto" competia por atenção como se fosse "aperte isto". Agora há dois estados — dourado com borda quando dá pra apertar agora, apagado e discreto quando a coisa existe mas falta algo.

**Dois: fogueira acesa não devia falar nada sem fagulha.** Pegar tocha ali é **opcional**, e a criança passa perto de fogueira acesa o tempo todo depois de acender — o aviso ficava permanente na tela, sobre uma ação que ela nem estava tentando. Agora, sem fagulha, o prompt some por completo: a barra AGORA já está dizendo para quebrar pedra, e repetir era ruído.

Fogueira **apagada** continua avisando o que falta, porque essa é obrigatória.

**Caso de borda que o teste pegou:** instrução que espera na fila pode ser cumprida antes de chegar a vez. Uma criança rápida veria "aperta E pra pegar a Chama" *depois* de já ter pegado — pior que não avisar, porque contradiz o que ela acabou de fazer. Ao desenfileirar, o que já foi cumprido é descartado em silêncio.


---

## Medida de exploração

Pergunta do dono: "como é que você sabe que explorou a vila toda? isso não é obrigatório?"

**Não é obrigatório.** Obrigatório são só as 8 fogueiras. Explorar é medida passiva — ninguém pede, ninguém pontua, e a criança não sabe que existe.

A medida é um grid de 8×8 sobre o mapa: cada célula pisada entra em `cellVisits`. O painel usa a **entropia de Shannon** disso (espalhamento, não só quantidade — dez passos em dez cantos valem mais que dez numa célula só).

Dois problemas encontrados ao responder:

**1. O grid cobria 47% do mundo.** Ia de −22 a +22 enquanto o conteúdo foi para ±32. **Portal Secreto, Campo de Treino e Pedra dos Nomes ficavam fora dele** — ir até três das oito fogueiras não contava como exploração nenhuma. Mesma família dos outros três: constante que descrevia o mapa velho. Agora deriva de `WORLD_LIMIT`.

**2. Autodireção estava pontuando o cumprimento do objetivo.** As 8 fogueiras são espalhadas de propósito, então a **rota obrigatória mínima já toca 20 das 64 células — 31% do mapa** sem nenhuma escolha de exploração envolvida. É exatamente o vício que o C-16 tinha em Estimulação, onde minerar a economia obrigatória *era* o probe.

Correção: `MANDATORY_CELLS` é calculado no boot percorrendo a rota mínima real, e a medida passou a ser 30% espalhamento + **70% do que passou desse piso**. Com peso igual, quem fazia só o obrigatório levava metade da nota.

| comportamento | células | pontos em Autodireção |
|---|---|---|
| só o obrigatório | 20 | 12 |
| um pouco além | 28 | 17 |
| metade do que sobra | 42 | 26 |
| mapa inteiro | 64 | 40 |

**3. A tela da criança mentia por design.** `explored` multiplicava por `1.6`, então "100% explorado" aparecia com 63% do mapa andado. O fator saiu: ela vê o número real, que é o feito dela e não uma nota.
