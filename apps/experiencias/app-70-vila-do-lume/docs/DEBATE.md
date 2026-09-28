# Consolidação do debate técnico — Game Design × Psicometria × Arquitetura

> **Nota do porte — 26/08/2026.** Este documento é registro histórico de um debate sobre o
> app de origem, e a maior parte dele deve ser lida como tal. Três coisas mudaram e afetam a
> leitura de hoje:
>
> - **Onde diz "painel do responsável" e "um pai lendo", leia "relatório do professor".** Os
>   papéis da plataforma são estudante/professor/gestor/admin-contrato — não há responsável. O
>   risco de C-19 continua valendo (a assimetria adulto→criança é a mesma, e o professor
>   decide sobre ela); o cenário doméstico — jantar, comparação entre irmãos — não é o
>   cenário do produto.
> - **G-04 foi parcialmente resolvido.** Não há mais `localStorage` nem exportação por
>   console: a partida vive na api, escopada por `escola_id` com RLS. Continuam em aberto
>   dono do dado, retenção, expiração, botão de apagar e quem pode abrir a tela.
> - **D5 / G-06 foram parcialmente decididos.** O corte por faixa etária virou corte por
>   **série**, e só da bolha B (`SERIES_SEM_BOLHA_B`, do 1º ao 5º ano). As duas mensagens
>   comuns e o golpe C continuam sendo servidos do 1º ano em diante. A revisão externa de
>   proteção infantil dos textos **segue pendente**.
>
> Os caminhos de arquivo e os números de linha citados abaixo referem-se a um `index.html`
> único de 3703 linhas, que não existe mais: o jogo é `public/jogo/src/*.js`.

> **Registro histórico, não especificação.** Este texto era o capítulo 9 do Game Design
> Document antigo; o GDD foi reescrito em 21/08/2026 e a numeração ficou órfã. Ele vale
> pelo raciocínio — como cada trade-off foi discutido e por que se decidiu assim — e as
> referências C-01..C-17 e D1..D6 são citadas em outros documentos.
>
> **Não confie no "estado atual" descrito aqui.** Vários consensos registrados como
> resolvidos continuaram vivos no código (C-14 e C-17 são os casos conhecidos). Para o que
> é verdade hoje, `GAME_DESIGN.md`.

> Documento de fechamento da rodada de confronto entre os três especialistas. Todas as
> afirmações de código abaixo foram verificadas no `index.html` (3703 linhas) na data desta
> consolidação. Números de linha são deste arquivo e envelhecem — a descrição do sintoma não.
> **Este documento tem precedência sobre as seções 1 a 6.9 onde houver conflito.** As seções 1,
> 2, 3, 4, 5, 6, 6.5 e 6.8 ainda descrevem Bartle, Espelho/fragmentos, faixa 9–13 e mecânicas
> mortas: estão obsoletas e devem ser reescritas (ver §9.4, item D-07).

---

## 9.1 CONSENSOS

Os três chegaram a acordo explícito nos itens abaixo. Nenhum é opinião isolada.

**C-01 — O painel do responsável imprime hoje números aritmeticamente falsos, e isso é dano, não imprecisão.**
`safetyPct = data.safeChoices / data.total` (L3282) com `total: SAFETY_ZONES` fixo em 5 (L2990): criança que respondeu com segurança 1 de 1 DM apresentada lê "20% de Segurança". Os três classificaram isso como P0, acima de qualquer discussão sobre Schwartz.

**C-02 — A fila de DMs está travada: `dmTimeoutId` é declarado (L2613) e limpo duas vezes (L2674, L2867), e nunca atribuído.**
Não existe `setTimeout` que o alimente. O auto-dismiss de 13s documentado na seção 4 deste GDD **não existe**. Ignorar o cartão mantém `dmOverlay` aberto para sempre e `tryFireNextAmbientDM` (L2010) reagenda a cada 3s em laço. As DMs 2 a 5 nunca disparam para quem ignora a primeira.

**C-03 — `state.timeInDark` acumula só em movimento (L2116) e é dividido por `play` total (L2921).**
Erro de uma palavra, com direção de viés conhecida: ficar parado no escuro **aumenta** o escore de Segurança. Denominador correto é `state.movingTime`.

**C-04 — A tela final da criança expõe a Camada 2.**
L3215-3217 monta `topValues` = os 5 escores Schwartz observados, ordenados do maior para o menor; L3240-3244 os desenha como **barras de progresso** sob "O QUE VOCÊ FEZ HOJE"; L3219 define `profile = PORTRAITS[topValues[0][0]]` — o retrato-lembrança da criança **é o nome do seu valor mais alto**. O comentário de L3209-3212, três linhas acima, afirma exatamente o contrário. Consequência aceita pelos três: a segunda partida de qualquer criança é performance, não comportamento.

**C-05 — Lampiões acesos morrem na segunda partida.**
`lightLamp` empurra `lamp.light` para `torches` (L1452); `restart()` faz `scene.remove(t.light)` (L3438) e depois só `l.light.intensity = 0` (L3449), sem readicionar à cena. `buildLamps()` não roda de novo. O único indicador de Universalismo do jogo para de produzir luz enquanto `state.lampsLit` continua contando — o painel reporta um Universalismo que a criança nunca viu acontecer. As fogueiras escapam porque `flameLight` é filho do `group` da zona (L1258) e `scene.remove` nelas é no-op.

**C-06 — `'Só dar um oi'` está marcado `kind:'lore'` (L2823) e conta Tradição + 25 pontos por clique.**
`norm(loreTalks, 3)` satura Tradição com três "oi". Correção mais barata do projeto; enviesa o polo Conservação inteiro.

**C-07 — `suggestionFollowed` é escrito em `finishZone` (L2845), chamado de `claimFragment`, não de `lightBrazier`.**
Conformidade é decidida pela primeira **Chama pega**, não pela primeira fogueira acesa. O briefing e a seção 6.9 deste GDD afirmam o contrário. Bug de definição operacional.

**C-08 — `norm(state.namesErased, 2)` (L2917) satura Poder com 2 de 3 nomes, e o HUD imprime a instrução do ato.**
L2550: `'E — APAGAR O NOME DE X E PÔR O SEU'`. A Pedra dos Nomes é uma das 8 zonas obrigatórias: toda criança passa lá e lê o prompt. O jogo **instrui** o ato que trata como traço de personalidade, e paga 25 pontos por ele.

**C-09 — `observed` é hoje "pontuou", não "teve oportunidade" (L2948: `observed[k] = breakdown[k].length > 0`).**
Com o filtro `p.w > 0.001`, um único roçar acidental num sino é matematicamente **pior** do que nunca ter tocado: Hedonismo entra observado em 0,125 e derruba a média do polo Abertura, enquanto zero toques o deixa indefinido e fora da média. A ação mínima é penalizada e a inação é perdoada — o sistema está invertido. Os três aceitam a separação `probed` (entra na média) × `scored` (numerador).

**C-10 — As saturações de `norm()` (L2900-2936) são os pesos reais do circumplexo, e estão escondidas.**
`norm(playfulActs, 8)` custa zero fagulha; `norm(lampsLit, 4)` custa 8 fagulhas — o excedente inteiro da economia. Essas constantes de balanceamento estão enterradas numa literal de objeto dentro de `computeValueProfile` e nunca foram tratadas como decisão de design.

**C-11 — `enough` é destravável por conversa fiada.**
`valueChoices = lampsLit + villagersRescued + namesErased + talks` (L2969-2970) com `talks` incluindo os "oi". Três "oi" para o Lume declaram amostra suficiente. O guarda de honestidade não guarda nada.

**C-12 — Existe um gradiente explícito na direção errada, visível para a criança.**
Retomar a tocha do aldeão (`reclaimTorch`, L1693-1699) devolve 1 fagulha, libera 2 atos opcionais extras e **sobe o score**; ao mesmo tempo zera a parcela `lightLeft` (0,3 de Benevolência) e sobe Realização. A única seta que a criança enxerga aponta contra o sinal que o instrumento quer ler. Não é contaminação teórica de "pesos planos" — é verificável numa planilha.

**C-13 — Benevolência tem um componente gratuito.**
`earlyRescues` filtra `r.firesLit < 8` (L2893), mas `updateVillagers` (L1708) só libera o aldeão quando `zones.every(z => z.brazier.lit)` — as 8 — e acender a 8ª leva direto à cinemática. **É impossível resgatar um aldeão com `firesLit === 8`.** Logo `earlyRescues === villagersRescued` sempre, e 0,2 de 1,0 do valor mais defendido pelos três é cópia carbono da parcela de 0,5.

**C-14 — `litPathTime` tem fonte contaminada, não só denominador errado.**
`isLit()` varre `torches` com `LIGHT_RADIUS = 6.5` (L1560); lampiões entram em `torches` (L1452) e estão em r = 10,48 (L1415-1417); `litPathTime` exige `r > 10 && r < 17 && isLit()` (L2100). Um lampião aceso cria bolha de luz de 6,5 m **dentro da faixa do probe de Segurança**. Acender lampião (Universalismo) infla Segurança.

**C-15 — `detourDistance` mede progresso de tarefa, não autonomia.**
L2085-2092: o conjunto de "objetivos" inclui veios não minerados e encolhe monotonicamente. Quanto mais a criança avança, mais do mapa vira "desvio". Autodireção infla com conclusão de tarefa.

**C-16 — Minerar a economia obrigatória É o probe de Estimulação.**
Anel interno de veios em `{2.7, 6.5}` → r = 7,04 (L1377-1379), inteiramente dentro de `const inMiddle = r < 8` (L2094). Pior: `shortcutsTaken` incrementa a cada re-entrada no estado dark (L2097), então minerar 8 pedras internas com a vila apagada pode sozinho saturar `norm(shortcutsTaken, 5)`.

**C-17 — Há dois relógios diferentes na mesma tela do responsável.**
`playTime` (denominador de `mins`, L2880) só corre com `playing && controls.isLocked` (L2044); `durationSec` (L2992, L3220) usa `performance.now()` desde `startGame`. Criança que solta o mouse duas vezes tem denominador diferente da que não solta — a confiabilidade das taxas está limitada por perda de foco de janela **antes** de estar limitada por destreza.

**C-18 — O jogo obrigatório tem piso de ~44 segundos de ação.**
181 m a `speed = 7` + 16 × ~1,1 s de mineração. `enough` exige `mins >= 5`. Enquanto isso for verdade, nenhuma correção de denominador importa: três sessões de um jogo que se esgota em três minutos acumulam o mesmo viés três vezes.

**C-19 — O risco nº 1 do projeto não é estatístico: é o ato de recepção.**
Os três, independentemente, elegeram a mesma coisa como risco principal. O painel não é relatório, é **rótulo aplicado a uma criança específica por um adulto que tem poder sobre ela**. Não existe tela de enquadramento, linguagem de incerteza, limite do que o painel se recusa a dizer, política de retenção, botão de apagar, definição de dono do dado, nem decisão sobre a criança poder ver ou apagar o próprio perfil. Nenhum disclaimer sobrevive ao contato com um adulto ansioso, e nós não estaremos na sala.

**C-20 — O jogo, como brinquedo, funciona.** O loop minerar→acender→pegar fecha, e `updateWorldGlowTarget()` segura atenção. A discordância dos três é sobre o **instrumento**, nunca sobre o jogo.

### Erros corrigidos durante o debate (registro, para não voltarem)
- `cinematic.beam` (L3386) **não existe** no objeto (L3079) e `Object3D.remove(undefined)` é no-op silencioso — não crasha. O vazamento real é `disc`, `stageLight` e `sky`, nunca removidos no caminho do `restart()`.
- O ◆ da bússola **não é persistente**: L2416-2426 escolhe a zona pela **menor distância** e só marca ◆ quando ela por acaso é a sugerida. Com 8 zonas, a seta aponta para outro lugar em ~7 de 8 casos. `suggestionFollowed === true` mede, na prática, se o sorteio uniforme calhou de escolher a zona mais próxima do spawn.
- O Lume está em `LUME_HOME = {6.0, 6.0}` → r = 8,49, **fora** do miolo (`r < 8`). Falar com ele não incrementa Estimulação. A via correta de contaminação é a mineração interna (C-16).
- Universalismo e Segurança **não** são opostos no circumplexo (~135°, não 180°). A contaminação de C-14 é real e independe disso.
- `fires >= 4` em `enough` **não é código morto** — é inerte apenas porque `saveLog` roda uma única vez, no fim feliz. Volta a ser guarda correto no instante em que houver persistência de sessão abandonada. **Não deletar.**
- Realização não tem viés etário **ainda**: com saturação em 3,0 fogueiras/min, uma partida completa e eficiente dá ~0,18. A métrica está colada no chão para toda a população e não discrimina por nada. O viés por destreza só aparece depois de consertar o teto.

---

## 9.2 DIVERGÊNCIAS ABERTAS — decisões que o dono do produto precisa tomar

Nenhuma destas é resolvível com o código na mão. Estão formuladas como escolha, não como recomendação.

---

### D1 — O que o painel do responsável publica

| Posição | Quem | Argumento |
|---|---|---|
| Zero rótulos Schwartz; só o breakdown em linguagem de comportamento | Psicometria | "Poder 71" sobre uma criança de 7 anos que apertou E por curiosidade motora é um rótulo que a evidência não sustenta |
| Três valores defensáveis (Benevolência, Universalismo, ritmo de Realização) | Game Design (posição inicial; cedeu para "zero na v1") | Menos promessa, mais chance de estar certo |
| Nenhum enquanto a aritmética não fechar | Arquitetura | Com as saturações atuais e `observed = scored`, o número de 8 dos 10 valores **não é comparável entre duas crianças** |

**Trade-off real:** o produto foi vendido com 10 valores explicáveis. Três valores dão um eixo só, e um eixo só não é Schwartz — é uma escala de generosidade com nome pomposo. Zero rótulos entrega o ativo honesto (o breakdown) e mata a promessa comercial.

**DECISÃO DE PRODUTO:** o painel entrega (i) vocabulário Schwartz completo com disclaimer, (ii) três valores, ou (iii) nenhum rótulo e só descrição comportamental? E, se (i) ou (ii) algum dia: **o que destrava a v2?** O único critério proposto no debate é r ≥ 0,30 contra PBVS-C em 4 dos 10 valores. Aceitar esse critério, endurecê-lo ou abandonar a pretensão é decisão de quem paga o estudo.

---

### D2 — O score visível

| Posição | Quem |
|---|---|
| Score sai da tela inteiro | Game Design |
| Score fica, mas os cinco `addScore('optional')` (sino, lore, lampião, aldeão, apagar nome) vão a zero | Psicometria |
| Score só para o objetivo principal (fogueira 100 / chama 50 / pedra 10), zero para opcional | Arquitetura |

**Trade-off real, e é o único ponto onde as três propostas colidem:** o score é hoje o único incentivo extrínseco a experimentar. Zerando o opcional, o volume de atos cai, mais valores caem em "não observado", e a sessão já é curta demais (C-18). **Mais sinal contaminado × menos sinal limpo.** Nenhum dos três resolve isso com código: é uma aposta sobre engajamento de criança de 6 anos.

**DECISÃO DE PRODUTO:** o placar sai da tela, ou os cinco `addScore('optional')` saem do placar? Manter os dois é escolher, por omissão, medir completismo com nome de valor.

---

### D3 — Conteúdo antes de instrumento, ou instrumento antes de conteúdo

**Trade-off real:** Faixa 1 do arquiteto (denominadores) custa uma tarde e conserta quatro medidas independentes. O segundo minuto de jogo (copresença de escolhas — pares aldeão/lampião a menos de 3 m com fagulha para exatamente um — e escassez legível no HUD) custa um mês e é a única coisa que faz existir escolha para ler. Sem dilema copresente e sabido, toda correção estatística só repete o mesmo viés com mais casas decimais.

**DECISÃO DE PRODUTO:** o próximo mês é level design ou é a Faixa 1+2? O game designer declarou querer as duas e não decidir esta.

---

### D4 — O lampião pode dar luz de verdade?

| Posição | Quem |
|---|---|
| Nenhuma vantagem mecânica, senão mede completude e infla Segurança (C-14) | Psicometria |
| Um lampião que não ilumina quebra a única regra que a criança de 6 anos entende do mundo | Game Design |

**Trade-off real:** ou o objeto é coerente e o sinal é sujo, ou o sinal é limpo e o mundo mente para a criança. Não há síntese. Registre-se também que o comentário de L1410-1414 (*"gives absolutely nothing back"*) é **falso contra o código três linhas abaixo**: dá luz permanente, dá 25 pontos e ajuda a navegar.

**DECISÃO DE PRODUTO:** mantém a luz do lampião ou não? Proposta do game designer, se solicitada: manter a luz e fazer Segurança parar de usar `isLit()` — passar a usar geometria fixa do anel, imune ao que a criança acendeu.

---

### D5 — DMs de golpe digital para a faixa 6–8 anos

| Posição | Quem |
|---|---|
| Remover da faixa 6–8 | Game Design |
| Submeter a revisão de proteção infantil | Psicometria |
| Só o custo: com a fila travada e o denominador errado, **remover é mais barato que consertar** | Arquitetura |

**Trade-off real:** remover apaga o único módulo do jogo com resposta explícita da criança — a única coisa no arquivo que se parece com um item de instrumento.

**DECISÃO DE PRODUTO:** DMs saem, ficam com revisão externa, ou ficam com corte por faixa etária?

---

### D6 — O reclaim (retomar a tocha doada): exploit a remover ou probe a proteger?

| Posição | Quem |
|---|---|
| Estritamente dominante em pontos — remover ou zerar a devolução | Game Design |
| É o único ato do arquivo que move dois polos opostos em direções opostas (Realização ↑, Benevolência ↓) com custo real e sem elogio na tela — **tirem os pontos, nunca o gesto** | Psicometria |
| Concorda com o remédio, discorda do diagnóstico: o exploit exige conhecer mapa e timing, então **não achata todo mundo — achata só quem volta a jogar**. É viés que cresce com a exposição, e destrói o reteste | Arquitetura |

**Trade-off real:** removido o reclaim, a resposta à tensão 4 do briefing cai de 3 conflitos genuínos para 2, e o projeto perde seu único fragmento de circumplexo real. Mantido com pontos, ele é um gradiente na direção errada (C-12).

**DECISÃO DE PRODUTO:** o reclaim sai, ou fica com devolução de 0 fagulha e sem score? A terceira opção — fica como está — está fora: os três a rejeitaram.

---

## 9.3 DECISÕES REGISTRADAS

Fica decidido a partir deste debate. Cada item traz o porquê, porque decisão sem porquê é revertida na primeira sprint apertada.

### O que passa a valer

**D-01 — Nenhum rótulo Schwartz sai para nenhum humano na v1.**
Saem da tela da criança: `topValues`, as barras de `meter-fill` (L3240-3244) e `PORTRAITS[topValues[0]]` como retrato. Fica desligada também a emissão de perfil no painel do adulto. **A coleta continua**; a emissão para.
*Porquê:* enquanto o desfecho do jogo revelar à criança o nome do seu valor mais alto, toda partida seguinte é performance e nenhum dado coletado depois da primeira sessão é interpretável — isso invalida retroativamente o instrumento inteiro, não um valor. E enquanto quatro medidas estiverem quebradas por bug, qualquer número entregue a um adulto é ficção que vira conversa de jantar.

**D-02 — A tela final da criança mostra contagens de fatos, sem ordenação e sem largura proporcional.**
Formato: `8 fogueiras · 18 pedras · 3 lampiões · 2 aldeões`. Zero barras, zero ranking, zero adjetivo de personalidade.
*Porquê:* largura de barra é um número sem dígito, e uma lista ordenada é um ranking mesmo sem rótulo. Contagem de fato não ensina resposta certa.

**D-03 — Faixa 1 (denominadores) vem antes de tudo, inclusive antes do bot de rota e da ipsatização.**
Escopo fechado: atribuir `dmTimeoutId` e destravar a fila; `safeChoices/(safeChoices+riskyChoices)` com "não apresentadas" reportado à parte; `timeInDark / movingTime`; `litPathTime` consultando função separada que considera **apenas as 8 fogueiras de zona**; readicionar `lamp.light` à cena no `restart()`.
*Porquê:* são erros de uma palavra que corrompem quatro medidas independentes, custam uma tarde e têm a melhor razão custo/benefício do backlog inteiro. Não se discute validade de construto de um número que não computa a quantidade que seu próprio nome declara. **A psicometria cedeu formalmente a prioridade aqui: ipsatização, indicadores múltiplos e convergência com PBVS-C saem do topo da lista e vão para depois desta faixa.**

**D-04 — `observed` passa a significar oportunidade apresentada (`probed`), não pontuação obtida (`scored`).**
`namesRead` (L1774) já existe e está sendo jogado fora — passa a ser o probe de Poder. **Condição de design anexa, inegociável:** oportunidade só conta se for legível. Passar a 3 m de um lampião apagado, no escuro, com 2 fagulhas no bolso, **não** é oportunidade apresentada enquanto o lampião apagado não tiver affordance de que dá para acender. O trabalho de affordance é pré-requisito da correção estatística, não consequência dela.
*Porquê:* C-09. Um sistema em que a ação mínima é penalizada e a inação é perdoada está invertido, e sem oportunidade registrada a recusa (que é informação de valor) é apagada.

**D-05 — Ordem das operações de calibração: (1) saturações num denominador comum derivado da economia — 16 fagulhas, 8 excedentes, 4 de 10 atos possíveis, calibradas *par a par nos polos opostos*; (2) `probed` ≠ `scored`; (3) só então ipsatizar no MRAT.**
*Porquê:* `axis(a,b) = a − b` é diferença de médias — erro de escala **comum** aos dois polos se cancela, erro **assimétrico** não. Por isso não basta "denominador comum": tem que ser par a par. E ipsatizar antes transforma escalas incomensuráveis numa hierarquia *estável*; hierarquia estável e errada é pior que ruído, porque parece resultado e sobrevive ao reteste.

**D-06 — Correção da direção do viés no eixo Autotranscendência↔Autopromoção, para o registro.**
A conclusão de que o eixo aponta para transcendência está **errada**. Poder é `norm(namesErased, 2)`: dois apertos de E, zero fagulhas, com a instrução impressa no centro da tela numa zona obrigatória. Criança que apaga 2 nomes → Autopromoção = média(0,18 · 1,00) = **0,59**. Para empatar do outro lado ela precisa de Universalismo alto, que custa 8 fagulhas — o excedente inteiro. O viés é **sistemático pró-Autopromoção**, comprado com trinta segundos e nenhum recurso.
*Porquê:* o diagnóstico (escalas incomensuráveis) estava certo, a direção estava errada, e a direção é o que o adulto lê.

**D-07 — Este GDD é reescrito antes de qualquer sessão com criança.**
Seções 1, 2, 3, 4, 5, 6, 6.5, 6.8 e a tabela 7 descrevem Bartle, Espelho/fragmentos, faixa 9–13, Sombras, tochas que apagam em 55s e cristais cosméticos — nada disso existe no código. A seção 6.9 afirma que Conformidade mede "acende primeiro a fogueira que o Lume sugeriu", o que C-07 desmente.
*Porquê:* um GDD que descreve um jogo diferente do que roda é pior que nenhum GDD — ele fabrica consenso sobre coisas que ninguém verificou.

**D-08 — `speed = 7` (L2034) e o mouse-look sem sensibilidade deixam de ser tratados como game feel e passam a ser tratados como fonte de variância do instrumento.**
*Porquê:* sem centrar no MRAT, o primeiro componente do "perfil" é idade e destreza motora, e essas duas constantes são o que mais mexe nisso.

**D-09 — Ordem de validação: bot de rota antes de entrevista com criança.**
Três estratégias sintéticas (rush, completista, explorador) rodando `simulateSession(actions)` e cuspindo os três perfis Schwartz. Se o completista sair alto em tudo, o score contamina — provado sem uma criança, sem comitê de ética, hoje.
*Porquê:* é falsificável, é barato, e responde a tensão 3 do briefing diretamente. A psicometria cedeu a ordem: think-aloud com 20 crianças vem depois.
*Dependência registrada, e não é opcional:* o bot é impossível sem a extração. Hoje a instrumentação inteira mora dentro de `animate()`, com `dt` do `requestAnimationFrame`, `speed` declarado dentro do laço e `playTime` correndo só com `controls.isLocked`. Não existe ponto onde injetar uma rota. `simulateSession` **é** o bot de rota; a extração é o pré-requisito declarado dele, não um fim em si.

### O que NÃO se mexe — proteções contra melhoria bem-intencionada

**P-01 — O custo de 2 fagulhas dos atos opcionais e a cobertura de 40% (4 de 10 atos possíveis).**
Toda proposta futura de "compensar o custo do lampião", "dar mais pedras" ou "equilibrar a recompensa" **destrói o único trade-off real do arquivo**. Se algo tiver de sair, sai o score — nunca a escassez. Registre-se que as duas correções propostas pela psicometria na rodada inicial ("ou o score sai, **ou** os atos pagos ganham compensação de custo") são mutuamente incompatíveis; a segunda está formalmente descartada aqui.

**P-02 — `updateWorldGlowTarget()`: a vila clareando a cada fogueira.**
É a única recompensa do jogo que é intrínseca, ilegível como métrica e imune a otimização. Ninguém a acopla a progresso opcional, a valores, ou a qualquer coisa farmável.

**P-03 — O breakdown textual por valor ("+38 Acendeu tocha para aldeões · 3 de 4").**
É o produto de verdade: útil, honesto, conversável com o responsável e verdadeiro **independentemente** de o mapeamento Schwartz ser válido. Toda simplificação futura de UI vai querer trocá-lo pela barra, que é mais limpa. **A barra é o passivo; o breakdown é o ativo.** Não trocar, e nunca reduzir a um número só.

**P-04 — `computeValueProfile()` como função pura de `state`, com eixo nulo quando falta polo.**
Ninguém "otimiza" isso lendo DOM, `performance.now()` ou `zones` de dentro dela. É a única fronteira testável do arquivo e a única coisa que torna a saída auditável por um humano. Se um dia houver um teste neste projeto, é aqui que ele encosta.

**P-05 — O disclaimer do painel e o comentário de L2874-2878.**
Toda pressão futura será para suavizá-los ("assusta o responsável", "parece que o produto não funciona"). Eles são o que separa este projeto de um teste de personalidade infantil vendido sem validação. **Endureçam, nunca amoleçam** — e registre-se que hoje o comentário ainda é generoso demais: só depois de P0 e P1 corrigidos ele passa a merecer o próprio texto.

**P-06 — O par doar/retomar como *gesto*, se D6 decidir mantê-lo.**
Se ficar, ele vai reaparecer como "exploit" em toda revisão de balanceamento futura, porque é estritamente dominante em pontos. **A resposta correta é sempre tirar os pontos, nunca tirar o gesto.**

**P-07 — Nenhum `addScore` novo em ato opcional, qualquer que seja a decisão de D2.**
Adicionar um a mais reintroduz o gradiente já diagnosticado.

**P-08 — `fires >= 4` em `enough` não é removido.** Ver §9.1, erros corrigidos.

---

## 9.4 DÍVIDA TÉCNICA E DE MÉTODO — priorizada por risco × esforço

Legenda de risco: **A** = número falso chega a um adulto hoje · **B** = dado inutilizável, sem dano direto · **C** = sustentação.

| # | Item | Risco | Esforço | Nota |
|---|---|---|---|---|
| **P0 — números falsos chegando ao adulto** ||||
| 01 | `dmTimeoutId` nunca atribuído; fila de DMs travada; auto-dismiss de 13s inexistente | A | 1 linha + 1 `setTimeout` | C-02 |
| 02 | `safetyPct` com denominador fixo 5 → "20% de segurança" para quem acertou 1 de 1 | A | 2 linhas | C-01. Reportar "não apresentadas" separado |
| 03 | `timeInDark / play` → deve ser `/ movingTime` | A | 1 palavra | C-03 |
| 04 | `litPathTime` contaminado por lampiões via `isLit()` | A | ~10 linhas, 2 funções onde há 1 | C-14 |
| 05 | Lampiões sem luz na 2ª partida (`restart()` remove e não readiciona) | A | 3 linhas | C-05 |
| 06 | `try/catch` + `schemaVersion` no `showDashboard` | A | 10 linhas | Painel quebra em silêncio com log de versão antiga |
| **P1 — regras que produzem dado falso** ||||
| 07 | `'Só dar um oi'` marcado `kind:'lore'` | B | 1 palavra | C-06 |
| 08 | `suggestionFollowed` escrito em `finishZone`, não em `lightBrazier`; registrar também se o toast foi exibido | B | ~15 linhas | C-07 |
| 09 | Prompt do pódio: `'APAGAR O NOME DE X'` → `'LER'` | A | 1 string | C-08. O jogo instrui o traço que mede |
| 10 | `playWith` sem cap/cooldown; `t.uses` incrementado e nunca lido | B | 5 linhas | 8 toques de sino = Hedonismo 1,00 + 200 pontos |
| 11 | `earlyRescues` sempre igual a `villagersRescued` | B | condição nova ou remoção da parcela | C-13 |
| 12 | Reclaim: devolução de fagulha e score (pendente de D6) | B | 3 linhas | C-12 |
| 13 | `restart()`: `cinematic.disc`/`stageLight`/`sky` nunca removidos; sprites "VOCÊ" acumulam em `zoneMeshes['ranking']`; nameplate original nunca escondido no `erasePodiumName` | B | meio dia | Contaminação silenciosa entre sessões, indistinguível de dado real |
| 14 | Dois relógios (`playTime` × `durationSec`) lado a lado no painel | B | 1 decisão + 2 linhas | C-17 |
| **P2 — corretude do modelo** ||||
| 15 | `probed` × `scored`, usando `namesRead` | B | 1 dia | D-04, com pré-requisito de affordance |
| 16 | Saturações de `norm()` num bloco declarativo, ao lado de `OPTIONAL_COST`, calibradas par a par nos polos | B | 1 dia | C-10, D-05 |
| 17 | `detourDistance` mede progresso de tarefa | B | redefinir conjunto de objetivos | C-15 |
| 18 | Mineração interna satura Estimulação; `shortcutsTaken` incrementa por re-entrada | B | geometria ou histerese | C-16 |
| 19 | `enough` destravado por três "oi" | B | 1 linha | C-11 |
| 20 | Persistência append-only com `profileId`, autosave e `completed:false` | B | 1-2 dias | **Bloqueada por G-04 abaixo.** Hoje a sessão abandonada não deixa rastro e sem N>1 nenhuma das 6 tensões é investigável — mas `profileId` sem política de retenção **aumenta** o risco de §9.5 |
| 21 | Ipsatização no MRAT | B | 1 dia | Só depois de 15 e 16 |
| **P3 — sustentação** ||||
| 22 | `makeState()` + `resetScene()` derivado das mesmas listas que constroem | C | 2 dias | `makeState()` sozinho não pega o item 13: o problema é o espelho de **cena**, não o de estado |
| 23 | Extração de `values.js` + `tests.html` + `simulateSession(actions)` | C | 3 dias | Pré-requisito declarado de D-09 |
| 24 | Pools de partículas | C | 1 dia | |
| 25 | `TORCH_LIFE` / `updateTorches` são código morto | C | deletar | Confirmado por dois especialistas independentemente |
| 26 | GAME_DESIGN.md reescrito | C | 1 dia | D-07 |

**Sobre a tensão 5 do briefing (arquivo único, 3400 linhas, sem build, sem testes).**
Resposta consolidada: o arquivo único **não é o gargalo da lista de hoje** — nenhum dos 26 itens acima seria evitado por modularizar. Mas os 3 bugs de regra do designer, os 6 do arquiteto, os 3 já corrigidos pelo time e o `restart()` que a psicometria jurou estar completo têm todos a mesma assinatura: **sinal escrito num lugar, lido em outro, sem nada entre os dois.** A dívida não é o tamanho do arquivo; é a **taxa com que defeitos desse tipo nascem**. Por isso a extração entra como P3 e como pré-requisito do bot, não como refatoração de princípio.

---

## 9.5 PRÉ-REQUISITOS PARA IR A CAMPO

**Veredito dos três, em uma linha:** o **jogo** pode sentar na frente de uma criança amanhã, com o painel desligado; o **instrumento** não pode. Um instrumento que altera o sujeito (C-04) e rotula o sujeito (C-19) ao mesmo tempo não é piloto, é dano.

### Bloqueadores duros — nenhuma criança joga isto em contexto de pesquisa ou escola antes

**G-01 — `topValues` e `PORTRAITS[topValues[0]]` fora da tela da criança.** Sem isso, a segunda sessão de qualquer criança é performance e nenhuma medida coletada nela vale nada — inclusive retroativamente, sobre o desenho do estudo.

**G-02 — Os seis itens P0 corrigidos.** Nenhum número sai da sessão para nenhum adulto enquanto quatro medidas estiverem quebradas por bug de uma palavra.

**G-03 — Tela de enquadramento do painel, escrita antes de qualquer sessão.** Precisa dizer, em linguagem que um pai ansioso não consegue reinterpretar: o que isto é (hipótese de design), o que isto não é (teste, diagnóstico, previsão), o que o painel **se recusa a dizer**, e o que fazer e não fazer com isso. Vale mesmo que todos os bugs sejam corrigidos e o proxy seja bom: a assimetria de poder entre quem lê e quem é lido é a razão pela qual "é só uma hipótese" não é uma defesa disponível.

**G-04 — Política de dado, decidida e implementada: dono, retenção, expiração, botão "apagar tudo" visível, e decisão explícita sobre quem pode abrir a tela do painel.**
Hoje o perfil é um retrato psicológico de uma criança identificável, gravado sem consentimento informado dela, num navegador possivelmente compartilhado, sem expiração e sem apagar. O painel é um vetor: uma criança de 11 anos abre o `localStorage` ou o menu e lê o que o jogo concluiu sobre ela. **`profileId` e append-only (item 20) ficam bloqueados até esta política existir** — eles aumentam o risco se entrarem antes. E o primeiro pedido de "sincroniza entre dispositivos" transforma isto num banco de perfis de valores de menores. Isto é anterior a Schwartz.

**G-05 — Consentimento e assentimento por escrito**, dos responsáveis e da própria criança, em linguagem de 6 anos para a criança. Inclui o direito de a criança ver e apagar o próprio perfil — decisão que ainda não foi tomada e precisa ser.

**G-06 — Revisão externa de proteção infantil do módulo de DMs**, ou remoção dele da faixa 6–8 (pendente de D5).

**G-07 — Bot de rota rodado, com os três perfis sintéticos publicados.** Se o completista sair alto em tudo, o score contamina — e isso precisa ser sabido antes da primeira criança, não depois.

### Pré-requisitos de qualidade do dado (não bloqueiam o jogo, bloqueiam a conclusão)

**G-08 — Conteúdo que sustente 10 minutos.** Com piso de ~44 s de ação obrigatória (C-18) e `enough` pedindo 5 minutos, o instrumento pede uma sessão que o conteúdo não produz.

**G-09 — Copresença de escolhas.** Pares aldeão/lampião a menos de 3 m um do outro, com fagulha para exatamente um, e escassez legível no HUD. Sem dilema copresente **e sabido**, não há escolha para ler — só há ordem de encontro.

**G-10 — Affordance visual do lampião apagado**, sem a qual `probed` (D-04) continua mentindo.

**G-11 — Protocolo de sessão que registre perda de foco de janela**, dado C-17.

---

## 9.6 PERGUNTAS EM ABERTO — precisam de dado, não de opinião

**Q-01 — Qual a taxa-base de `suggestionFollowed === true` sem nenhuma criança?**
Calculável hoje, com uma planilha: 8 zonas, sorteio uniforme, spawn conhecido, bússola apontando para a mais próxima. Se a taxa-base for ~1/8, Conformidade está medindo o sorteio. **Responder antes de tocar em qualquer coisa de Conformidade.**

**Q-02 — Existe conflito de valor genuíno, ou é artefato de level design?** (tensão 4 do briefing)
Contagem atual honesta: **3 conflitos genuínos de 10 valores** — fagulha entre fogueira e ato opcional; aldeão versus lampião pelo mesmo excedente; doar versus retomar. Cai para **2** se D6 remover o reclaim. Nenhum dos três especialistas conseguiu argumentar que os outros 7 valores enfrentam conflito real. Precisa de observação, não de debate.

**Q-03 — Uma sessão de 10-15 min basta?** (tensão 2)
Hoje metade dos valores sai sem sinal. Não se responde com teoria: exige N de sessões reais com `probed` implementado, para saber **quantos valores tiveram oportunidade apresentada** — número que hoje o sistema não sabe calcular.

**Q-04 — O score contamina mesmo com pesos planos?** (tensão 3)
Falsificável pelo bot (D-09), sem criança. Pergunta operacional: o perfil do completista fica achatado (alto em tudo) ou preserva ordenação? Se achatar, D2 deixa de ser decisão de produto e vira consequência.

**Q-05 — Qual a confiabilidade teste-reteste das taxas?**
Predição da psicometria: r ≈ 0,5–0,65. Termo de erro não considerado nela: perda de foco de janela (C-17), que pode dominar destreza. Precisa de duas sessões da mesma criança, com os dois relógios registrados separadamente.

**Q-06 — O mapeamento comportamento→valor sobrevive ao contato com PBVS-C?** (tensão 1)
Único caminho proposto no debate: aplicar PBVS-C num subgrupo e correlacionar. Critério proposto: r ≥ 0,30 em 4 de 10. **Ninguém sabe onde o mapeamento quebra até isso ser feito** — as hipóteses de quebra levantadas (Poder por curiosidade motora, Realização por destreza, Tradição por "oi") são plausíveis e não testadas.

**Q-07 — Como validar sem base de usuários?** (tensão 6)
Sequência acordada, e é a resposta consolidada à tensão: **(1) bot de rota** — falsifica o score hoje, sem ninguém; **(2) planilha de taxa-base** (Q-01) — falsifica Conformidade hoje; **(3) think-aloud com ~20 crianças** — descobre se o mundo faz sentido e se a criança percebe as escolhas como escolhas; **(4) PBVS-C em subgrupo** — única coisa que autoriza a palavra "valores". Os passos 1 e 2 não custam nada e não precisam de comitê. Não há atalho para o 4.

**Q-08 — O que um adulto real faz com o painel?**
A pergunta que nenhum dos três conseguiu responder e que sobrevive a todos os consertos de código. Exige observação do adulto lendo, não do jogo rodando. Sem essa resposta, G-03 é escrita no escuro.

**Q-09 — A criança pode ver e apagar o próprio perfil?**
Decisão nunca tomada. Não é técnica: colide com C-04 (ver o perfil altera partidas futuras) e com o direito da criança sobre o próprio dado. Precisa de posição jurídica e ética, não de código.

---

**Arquivos de referência:** `/Users/assis/missoes/vila-do-bit-3d/index.html` · `/Users/assis/missoes/vila-do-bit-3d/GAME_DESIGN.md`

---

## VEREDITO FINAL — Game Designer

# VEREDITO FINAL — game design

## 1. As 3 mudanças que vêm antes de tudo

1. **Desligar a emissão de perfil (barras da tela final + qualquer rótulo Schwartz no painel), mantendo a coleta.** Enquanto `safetyPct` divide por 5 e `dmTimeoutId` nunca é atribuído, o produto entrega números falsos a um adulto sobre uma criança específica — isso é dano, não imprecisão, e é o único item aqui que não admite prazo.
2. **Faixa 1 do arquiteto inteira, numa tarde: `dmTimeoutId`, denominador de segurança por DMs efetivamente vistas, `timeInDark/movingTime`, luzes de lampião no restart.** São quatro erros de uma palavra cada que corrompem quatro medidas independentes; nada mais no backlog tem essa razão custo/benefício.
3. **O segundo minuto de jogo: copresença de escolhas (pares aldeão/lampião a <3 m com fagulha para exatamente um) e escassez legível no HUD.** Sem dilema copresente e sabido, não há escolha para ler — e sem conteúdo que sustente 10 minutos, toda correção estatística só repete o mesmo viés com mais casas decimais.

## 2. As 2 coisas certas — protejam-nas

1. **O custo de 2 fagulhas dos atos opcionais, e os 40% de cobertura.** Toda proposta futura de "compensar o custo", "dar mais pedras" ou "equilibrar recompensa" destrói o único trade-off real do arquivo. Se algo tem de sair, sai o score — nunca a escassez.
2. **`updateWorldGlowTarget()` — a vila clareando a cada fogueira.** É a única recompensa do jogo que é intrínseca, ilegível como métrica e imune a otimização. Ninguém deve "melhorá-la" acoplando-a a progresso opcional, a valores, ou a qualquer coisa que a criança possa farmar.

## 3. O risco nº 1 que ninguém levantou o suficiente

**O que o adulto faz com o painel.** O debate inteiro tratou de validade de medida; nenhum de nós tratou do ato de recepção. Um pai lê "Poder 0,59 · Benevolência 0,20" sobre um filho de 7 anos e isso vira conversa de jantar, comparação entre irmãos, ou rótulo que a criança carrega por anos. O breakdown explicável — nosso orgulho de design — é exatamente o que torna o número **crível** e portanto acionável. Não existe no projeto nenhuma tela de enquadramento, nenhuma linguagem de incerteza, nenhum limite de o que o painel se recusa a dizer, e nenhuma decisão sobre a criança poder ver ou apagar o próprio perfil. A Camada 2 foi projetada como saída de dados, não como comunicação a um humano com poder sobre outro humano. Esse é o risco que sobrevive a todos os consertos de código.

## 4. Pode ir a campo hoje?

**Sim como jogo, não como instrumento** — dá para sentar uma criança na frente dele amanhã e observar (o loop funciona, a vila clareando segura a atenção), mas nenhum número pode sair da sessão para um adulto enquanto quatro medidas estiverem quebradas por bug e o painel não tiver enquadramento.


---

## VEREDITO FINAL — Especialista em Schwartz

# VEREDITO FINAL — Psicometria / Schwartz

## 1. As 3 mudanças, em ordem

**1. `topValues` e `PORTRAITS[topValues[0]]` saem da tela final da criança.** Enquanto o desfecho do jogo revelar à criança o nome do seu valor mais alto, toda partida seguinte é performance e nenhum dado coletado depois da primeira sessão é interpretável — isso invalida retroativamente o instrumento inteiro, não um valor.

**2. Consertar as três contas que estão simplesmente erradas antes de discutir o que elas significam: `timeInDark/play`, `total: SAFETY_ZONES` fixo em 5, e `suggestionFollowed` escrito em `finishZone` em vez de `lightBrazier`.** Não existe debate de validade sobre um número que não computa a quantidade que seu próprio nome declara — hoje o painel afirma coisas aritmeticamente falsas sobre uma criança específica.

**3. Zerar os cinco `addScore('optional')` (sino, lore, lampião, aldeão, apagar nome).** Enquanto o placar pagar 25 por atos de custo zero e infinitamente repetíveis e cobrar 100 em fogueira por atos de custo 2, o score não é neutro: ele é uma recompensa explícita para Autopromoção e um imposto sobre Autotranscendência, e mede completismo com nome de valor.

## 2. As 2 coisas certas — protejam-nas

**O par `torchesReclaimed` / `lightLeft`.** É a única mecânica do arquivo em que um mesmo ato move dois polos opostos em direções opostas — Realização sobe, Benevolência cai — com custo real e sem elogio na tela. Vai aparecer como exploit em toda revisão de balanceamento futura, porque é estritamente dominante em pontos. **A resposta certa é sempre tirar os pontos, nunca tirar o gesto.** Removido o reclaim, a resposta à tensão 4 cai de 3 conflitos genuínos para 2, e o projeto perde seu único fragmento de circumplexo real.

**O breakdown explicável.** As strings "+38 Acendeu tocha para aldeões · 3 de 4" são o produto de verdade: úteis, honestas, conversáveis com o responsável e verdadeiras independentemente de o mapeamento Schwartz ser válido. Toda simplificação futura de UI vai querer trocá-las pela barra, que é mais limpa. Não troquem: a barra é o passivo, o breakdown é o ativo.

## 3. O risco que ninguém levantou o suficiente

**O painel do responsável não é um relatório — é um rótulo aplicado a uma criança específica, por um adulto que tem poder sobre ela.** Debatemos validade como se o erro fosse estatístico. O dano não é estatístico: é um pai lendo "Poder 71" no filho de sete anos que apertou E três vezes por curiosidade motora, e passando a tratá-lo como mandão. Nenhum disclaimer sobrevive ao contato com um adulto ansioso, e nós não vamos estar na sala. A assimetria de poder entre quem lê e quem é lido é a razão pela qual "é só uma hipótese" não é uma defesa disponível — e ela vale mesmo que todos os bugs sejam corrigidos e o proxy seja bom.

## 4. Vai a campo hoje?

**Não** — não pelas fragilidades psicométricas, que são toleráveis num piloto declarado, mas porque a criança sai da partida sabendo qual é o seu valor mais alto e o adulto sai com um rótulo numérico que a evidência disponível não sustenta: um instrumento que altera o sujeito e rotula o sujeito, ao mesmo tempo, não é piloto, é dano.


---

## VEREDITO FINAL — Arquiteto de Software

# VEREDITO FINAL — Arquiteto de Software

## 1. As 3 mudanças que vêm antes de qualquer outra

1. **Consertar os denominadores que já imprimem número falso para o adulto** — `safe/(safe+risky)` no lugar de `safe/5`, `dmTimeoutId` atribuído para destravar a fila, `timeInDark/movingTime`, `litPathTime` só com fogueiras. *Enquanto o painel disser "20% de segurança" para quem acertou tudo que viu, cada dia de uso produz uma conversa adulto-criança baseada em ficção.*
2. **Tornar `observed` = oportunidade apresentada, não pontuação obtida, e calibrar as saturações num denominador comum derivado da economia.** *Sem isso os 10 valores não são comparáveis nem entre si nem entre duas crianças, e o circumplexo mede qual constante foi chutada mais alto.*
3. **Persistência append-only com `profileId`, autosave e `completed:false`.** *Hoje a sessão abandonada — a modal com criança de 6 anos — não deixa rastro nenhum, e sem N>1 nenhuma das outras cinco tensões do briefing é sequer investigável.*

## 2. As 2 coisas certas — protejam-nas

1. **`computeValueProfile()` como função pura de `state`, com breakdown textual por valor e eixo nulo quando falta polo.** Ninguém "otimize" isso lendo DOM, `performance.now()` ou `zones` de dentro dela, e ninguém troque o breakdown por um número só. Ela é a única fronteira testável que o arquivo tem e a única coisa que torna a saída auditável por um humano. Se um dia houver um teste neste projeto, é aqui que ele encosta.
2. **O disclaimer do painel e o comentário de L2874-2878.** Toda pressão futura vai ser para suavizá-los ("assusta o responsável", "parece que o produto não funciona"). Eles são o que separa este projeto de um teste de personalidade infantil vendido sem validação. Endureçam, nunca amoleçam.

## 3. O risco nº 1 que ninguém levantou o suficiente

**Não existe caminho para deletar o perfil, e ninguém definiu quem é o dono do dado.** Discutimos exaustivamente se o número é *certo*; não discutimos que ele é um retrato psicológico de uma criança identificável, gravado sem consentimento informado dela, num navegador compartilhado, sem expiração, sem botão de apagar, e — no momento em que alguém pedir "sincroniza entre dispositivos" — a um passo de virar um banco de perfis de valores de menores. O painel do responsável é um vetor: uma criança de 11 anos abre o localStorage ou o menu e lê o que o jogo concluiu sobre ela. `profileId` e append-only, que eu mesmo pedi, **aumentam** esse risco se entrarem antes de uma política de retenção, de um "apagar tudo" visível e de uma decisão explícita sobre quem pode abrir aquela tela. Isso é anterior a Schwartz.

## 4. Pode ir a campo hoje?

**Não** — com uma exceção estreita: o **jogo** pode ir a campo hoje com o painel desligado, porque como brinquedo ele funciona; o **instrumento** não pode, porque imprime números demonstravelmente errados para adultos que vão agir sobre eles, e um dado falso sobre uma criança é pior que dado nenhum.
