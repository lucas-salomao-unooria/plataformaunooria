import type { GuiaDaAula } from "./tipos";

/**
 * Guia da aula da **Missão Tempestade** — hoje `exp02em1b-v0`, a VERSÃO ANTERIOR
 * (ADR-180). Fica como registro, FORA do registro de guias (`index.ts`): a
 * missão saiu da trilha, e o guia da 2ª série, unidade 1, é o de O Efeito
 * Amplificador (`exp02em1b.ts`).
 *
 * ESTE GUIA É O INSTRUMENTO. A missão não revela nada por software — é decisão
 * de produto, não lacuna: um estudante que descobre pela tela qual fonte engana
 * em quê decora uma tabela; um que descobre no debate, comparando o que viu com
 * o que o colega viu, aprende a desconfiar de fonte única. Sem a conversa, esta
 * missão é um jogo de alocação com um final aleatório.
 *
 * A tabela dos 8 vieses NÃO mora aqui: ela vem de `GET /unoogpt/professor/fontes`
 * e entra como bloco vivo na página do guia. É a mesma regra dos cartões da
 * Vila — o texto É o instrumento, e uma cópia no hub faria o professor contar à
 * turma um viés que o cenário já não produz.
 */
export const GUIA_EXP02EM1B_V0: GuiaDaAula = {
  expId: "exp02em1b-v0",
  chamada:
    "Uma aula de 50 minutos. A missão leva cerca de 16 minutos, com o registro da operação; o debate, 15; o fechamento, 5. É no debate que a lição acontece — a missão não conta a ninguém qual fonte engana em quê.",

  avisos: [
    {
      tom: "warning",
      titulo: "Esta missão só começa quando você der a largada",
      texto:
        "O relógio é da TURMA, não de cada estudante. Enquanto você não largar, todos veem o cronômetro parado e ninguém fala com o assistente. A largada, o +2 min e o encerrar ficam em Resultados da turma — abra essa tela ANTES da aula.",
    },
    {
      tom: "error",
      titulo: "O material do debate é seu, e só seu",
      texto:
        "Cada uma das 8 fontes distorce a cidade de um jeito, e a missão nunca revela isso. A tabela dos vieses está mais abaixo, nesta página. Não a projete antes do debate e não a entregue impressa à turma: quem sabe de antemão qual fonte engana em quê para de cruzar dados e passa a decorar.",
    },
  ],

  objetivos: [
    "Formular perguntas que reduzam a incerteza, em vez de confirmar a decisão já tomada.",
    "Distinguir ausência de dado de ausência de risco — “não sabemos” nunca é “zero”.",
    "Explicar o viés de uma fonte a partir de como ela foi produzida: quem mediu, quando, e o que aquele instrumento consegue enxergar.",
    "Sustentar uma decisão sob incerteza citando a evidência usada, e reconhecer o que ficou sem consultar.",
    "Ler um resultado como faixa de possibilidades, e não como consequência única da própria escolha.",
  ],

  bncc: [
    {
      codigo: "EM13CO12",
      texto:
        "Produzir, analisar, gerir e compartilhar informações a partir de dados, utilizando princípios de ciência de dados.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "A investigação inteira: o estudante escolhe quais fontes carregar e cruza camadas. Medida no registro da operação: a última tabela que o grupo pediu volta à tela, e ele compara dois pares de bairros — num a faixa de um fica acima da do outro, no outro as faixas se cruzam. Pedir dados leva a \"em desenvolvimento\"; ler certo os dois pares, a \"demonstra\".",
    },
    {
      codigo: "EM13CO14",
      texto:
        "Avaliar a confiabilidade das informações encontradas em meio digital, investigando seus modos de construção e considerando a autoria, a estrutura e o propósito da mensagem.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Medida no registro da operação: dois cartões, cada um com uma fonte e um bairro, e as mesmas cinco perguntas para toda fonte (quando foi medida, o que conta, se enxerga o bairro, quem a produziu, ou nada). O cartão cai sempre num bairro onde aquela fonte distorce ou não enxerga — se o bairro da equipe não é um deles, o cartão pergunta \"se fosse usar essa fonte\" em outro. No debate, cada viés vem do MODO DE CONSTRUÇÃO da fonte.",
    },
    {
      codigo: "EM13CO10",
      texto:
        "Conhecer os fundamentos da Inteligência Artificial, comparando-a com a inteligência humana, analisando suas potencialidades, riscos e limites.",
      eixo: "Mundo Digital",
      ondeAcontece:
        "Trabalhada no debate, não medida: o Cientista de Dados responde com rigor a partir de fontes enviesadas — e é assim que a turma vê que o limite não estava no modelo, e sim no dado que ele recebeu. Nenhuma tarefa da missão gera nível nesta habilidade.",
    },
    {
      codigo: "EM13CO11",
      texto:
        "Criar e explorar modelos computacionais simples para simular e fazer previsões, identificando sua importância no desenvolvimento científico.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Medida no resultado, em \"Duas outras decisões, nas mesmas 20 tempestades\": para cada comparação o grupo lê uma faixa de 20 quadradinhos e diz se a outra decisão resgata mais, menos, ou depende da tempestade. Mede interpretar as previsões de um modelo; explorar fica no \"E se…\" livre, que não dá marca.",
    },
    {
      codigo: "EM13CO08",
      texto:
        "Entender como mudanças na tecnologia afetam a segurança, incluindo novas maneiras de preservar sua privacidade e dados pessoais on-line, reportando suspeitas e buscando ajuda em situações de risco.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Medida no fechamento: um número desconhecido, que diz ser voluntário, pede pelo WhatsApp a lista das pessoas com deficiência ou mobilidade reduzida do Morro Alto. O grupo diz o que responde e o que mais faz com o pedido. Não mandar nada e avisar a coordenação é o que demonstra.",
    },
    {
      codigo: "EM13CO24",
      texto:
        "Identificar e reconhecer como as redes sociais e artefatos computacionais em geral interferem na saúde física e mental de seus usuários.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Medida no registro da operação: o grupo monta o alerta para os celulares de quem ficou sem equipe — com que frequência, em que tom e o que ele diz. Frequência e tom pesam na saúde mental de quem recebe; o conteúdo, na física.",
    },
    {
      codigo: "EM13CO26",
      texto:
        "Aplicar os conceitos e pressupostos do direito digital em sua conduta e experiências com o cotidiano da cultura digital, bem como na produção e uso de artefatos computacionais.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Medida duas vezes, e vale a melhor: na investigação, quando a Secretaria de Saúde liga e o grupo escolhe que dados de terceiros pedir (o pedido vai no máximo a \"em desenvolvimento\"); e no fechamento, na resposta à moradora do bairro que ficou sem equipe — com que dados decidiu, o critério, quem decidiu e como contestar.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Libere a missão para a turma.",
        texto: "Minhas turmas → a turma → Missões. Sem isso o estudante vê cadeado.",
      },
      {
        titulo: "Abra Resultados da turma ANTES da aula.",
        texto:
          "É de lá que sai a largada, e nenhum estudante fala com o assistente antes dela. Deixe a aba aberta o tempo todo: é o seu painel de condução.",
      },
      {
        titulo: "Rode a missão você mesmo, uma vez, com calma.",
        texto:
          "Uns dezesseis minutos. Faça de propósito o que a turma vai fazer sem querer: decida sem carregar fonte nenhuma e veja o que o resultado devolve. Passe pela ligação da Saúde e pelo registro da operação, que vêm antes do resultado. Você precisa conhecer essas telas para reconhecê-las no rosto de quem acabou de vê-las.",
      },
      {
        titulo: "Leia a tabela dos 8 vieses nesta página.",
        texto:
          "Ela é o roteiro do debate. Não é para decorar as oito: escolha três que você vai puxar — sugestão de partida: satélite (vê telhado, não vê gente), cadastro (nove anos de defasagem) e telefonia (conta aparelho, e idoso e criança somem).",
      },
      {
        titulo: "Gere o áudio do podcast, se for usá-lo.",
        texto:
          "O podcast de recapitulação é seu: cerca de 3 minutos e meio em que Lia e Caio retomam a missão com a turma. O roteiro é o mesmo para todas as turmas e não precisa de revisão. Ele fica em A aula e os resultados, com o botão Gerar o áudio do podcast, e a transcrição está sempre ao lado. É opcional, e toca só DEPOIS do debate: ele conta o que três das fontes não enxergavam.",
      },
      {
        titulo: "Combine a largada em voz alta.",
        texto:
          "O relógio é da turma: quem chega antes espera, e a espera é a aula — não a tela travada. Diga que vai largar e conte até três.",
      },
    ],
    pedagogico: [
      {
        titulo: "Guarde 15 minutos para o debate, e 5 para o fechamento.",
        texto:
          "O debate vem antes do fechamento de propósito: as perguntas sobre cuidado com os dados e sobre direitos entregariam as respostas do WhatsApp e da moradora. Se a aula for “rodar e recolher”, o estudante sai achando que perdeu um jogo por azar.",
      },
      {
        titulo: "Não prometa uma resposta certa.",
        texto:
          "Não existe alocação ótima, e a missão foi construída para que não exista. O objetivo é experimentar que perguntas melhores e dados melhores produzem respostas melhores — e que nenhuma delas produz A resposta.",
      },
      {
        titulo: "Prepare a pergunta do orçamento.",
        texto:
          "Três perguntas e cinco minutos não é limitação técnica: é a condição real de quem decide em emergência. Vale dizer isso no fechamento, não no começo — no começo, vira desculpa antecipada.",
      },
      {
        titulo: "Saiba de antemão quem, na sua sala, mora no Morro Alto.",
        texto:
          "O cenário é ficcional, mas a situação não é: o bairro que os dados enxergam pior é o bairro ocupado depois do último cadastro. Numa turma de escola pública isso pode ser o bairro de alguém ali. Conduza a conversa para o instrumento (o dado é velho) e nunca para as pessoas (o lugar é invisível).",
      },
    ],
    naoDiga: [
      "“Algumas fontes estão erradas.” — nenhuma está errada; cada uma vê um pedaço. A diferença entre erro e recorte é a aula inteira.",
      "“Prestem atenção porque tem pegadinha.” — o estudante passa a jogar contra o professor em vez de investigar a cidade.",
      "“Carreguem o máximo de fontes que der.” — o orçamento de perguntas é parte do instrumento; gastá-lo por instrução sua tira a decisão dele.",
      "“Vocês vão ver que a IA erra.” — o Cientista não erra: ele responde com rigor sobre um dado torto, que é exatamente o que acontece na vida real.",
      "Qualquer viés específico, antes do debate. Um só entregue derruba o valor dos outros sete.",
    ],
  },

  roteiro: {
    total: "1 aula · 50 min",
    linhas: [
      {
        tempo: "0–5",
        momento: "Enquadramento. Você abre A aula e os resultados na sua tela.",
        professor:
          "“Uma tempestade chega em uma hora. Vocês têm duas equipes e quatro bairros. Não dá para atender todos.” Nada sobre dados, viés ou IA.",
      },
      {
        tempo: "5–8",
        momento:
          "A turma entra: a tela da missão, mapa apagado e o cronômetro PARADO. Ninguém fala com o assistente ainda.",
        professor:
          "Confirme na sua tela que todos entraram. Diga uma vez, para todos: “intuição é uma resposta legítima aqui, e é melhor que inventar um motivo”.",
      },
      {
        tempo: "8–9",
        momento: "A largada. O relógio começa para a turma inteira ao mesmo tempo.",
        professor: "Conte até três em voz alta e largue.",
        botao: "Dar a largada",
      },
      {
        tempo: "9–18",
        momento:
          "Investigação: 3 perguntas e 5 minutos de relógio. O mapa começa vazio e só acende o que uma fonte carregada cobre. No primeiro destino escolhido, ou ao abrir a decisão, a Secretaria de Saúde liga oferecendo dados de pessoas com deficiência ou mobilidade reduzida.",
        professor:
          "Circule em silêncio e não sugira fonte nenhuma — a escolha é o dado que você vai ler depois. Se alguém disser que o assistente travou, lembre que uma resposta leva de 10 a 30 segundos.",
        botao: "+2 min (só se a turma inteira atrasar)",
      },
      {
        tempo: "18–25",
        momento:
          "Decisão: cada equipe para um bairro, com o porquê — uma fonte que o grupo ABRIU, ou “foi intuição”. As equipes saem no botão “Enviar equipes” (confirmar na conversa só abre essa tela). Depois, sem relógio, o registro da operação: a leitura dos dados, o que precisaria saber de cada fonte e o alerta para quem ficou sem equipe. O resultado vem em seguida.",
        professor:
          "Se alguém reclamar que o resultado demora, diga que as equipes já saíram e que o registro é parte da operação.",
        botao: "Encerrar (quando todos tiverem enviado)",
      },
      {
        tempo: "25–30",
        momento:
          "O resultado: a faixa com 20 corridas da mesma decisão, o bairro sem equipe, o que o grupo nunca abriu e as duas comparações de “Duas outras decisões, nas mesmas 20 tempestades”. Não há pontuação.",
        professor:
          "Deixe em silêncio por dois minutos. Depois: “levanta a mão quem teve o mesmo resultado que o colega do lado, com a mesma decisão”. Quase ninguém levanta.",
      },
      {
        tempo: "30–45",
        momento: "Debate com a turma inteira, em cinco blocos. É a metade que vale.",
        professor:
          "Siga os blocos do debate abaixo. Use o painel “O que cada grupo perguntou sobre cada fonte” e a frase do alcance do alerta. Não use aqui as perguntas sobre cuidado com os dados nem sobre direitos: elas entregariam as respostas do fechamento.",
      },
      {
        tempo: "45–50",
        momento:
          "Fechamento: no computador, o pedido pelo WhatsApp e a resposta à moradora (cerca de 3 min); no papel, cada um escreve a pergunta que faria se tivesse uma quarta, em duas linhas.",
        professor:
          "Abra o fechamento e diga a frase de síntese. O painel mostra quantos grupos já enviaram.",
        botao: "Abrir o fechamento",
      },
      {
        tempo: "Depois do fechamento enviado",
        momento:
          "Duas perguntas faladas, sem nível: “que cuidado um sistema desses exigiria com os dados?” e “que direitos teriam as pessoas afetadas?”.",
        professor:
          "Só comece quando o painel mostrar todos os fechamentos enviados — no fim desta aula, se sobrar tempo, ou na abertura da seguinte.",
      },
    ],
    nota: "Somar +2 min não faz a chuva andar para trás: o relógio da cidade tem um pivô que impede a tempestade de rebobinar. Use o +2 quando a turma inteira estiver atrasada, não para socorrer um estudante — para esse, o resultado com poucas fontes é uma aula melhor do que o tempo extra. O grupo que não terminou o fechamento quando o sinal tocou termina no começo da aula seguinte, antes de você encerrar a missão: o nível só aparece no encerramento, então nada se perde.",
  },

  debate: {
    aberturaNaLousa: "Vocês decidiram sobre a mesma cidade. Por que viram cidades diferentes?",
    tempo:
      "15 minutos, com a turma inteira, em cinco blocos: o mapa em branco (4 min), as fontes que discordam (5), “nenhuma fonte mentiu” (2), por que um modelo honesto entrega faixa (2) e como um sistema afeta a vida das pessoas (2). Esta é a única missão em que a tela se recusa a explicar, e tudo o que ela mede só vira aprendizado aqui.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Quantos de vocês terminaram com algum bairro ainda em branco no mapa?",
        porQue:
          "Bloco 1, o mapa em branco. Quase todos. Serve para instalar o fato antes da interpretação: a cidade nunca ficou inteira visível para ninguém.",
      },
      {
        nivel: "analise",
        pergunta:
          "O que significava um bairro em branco? Quem tratou como “não sabemos” e quem tratou como “não tem risco”?",
        porQue:
          "Ainda o bloco 1, e a pergunta mais importante da aula. Confundir ausência de dado com ausência de risco é o erro que a missão foi construída para produzir — e ele aparece em política pública, em diagnóstico médico e em crédito bancário exatamente assim.",
      },
      {
        nivel: "analise",
        pergunta:
          "Alguém teve duas fontes discordando sobre o mesmo bairro? Em qual acreditou, e por quê?",
        porQue:
          "Bloco 2, as fontes que discordam. Aqui entra a tabela dos vieses, uma fonte por vez, e o painel “O que cada grupo perguntou sobre cada fonte” (por exemplo, quantos grupos perguntaram “quando foi medida” sobre o cadastro, no Morro Alto). Pergunte COMO cada fonte foi produzida antes de dizer o viés — “quem mediu isso? quando? o que esse instrumento consegue ver?” — e deixe a turma deduzir. Feche o bloco com o alcance do alerta: o aviso no celular não chega a quem não tem aparelho, a mesma gente que o sinal de celular não conta.",
      },
      {
        nivel: "analise",
        pergunta:
          "O satélite mostrou o Industrial cheio de construção. Isso quer dizer cheio de gente?",
        porQue:
          "O viés mais fácil de deduzir, e por isso o melhor para abrir a série do bloco 2. Satélite vê telhado, não vê morador — galpão vazio e prédio lotado têm o mesmo telhado.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Nenhuma fonte mentiu. Todas mediram direito o que se propunham a medir. Então de onde veio o erro?",
        porQue:
          "Bloco 3. Move a turma de “dado falso” para “dado parcial”, que é o conceito que sustenta a habilidade. Erro não está no número: está na distância entre o que a fonte mede e a pergunta que se faz a ela.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "O resultado veio como uma faixa de 20 corridas, e as duas comparações mostraram tempestade por tempestade. Por que um modelo honesto entrega faixa?",
        porQue:
          "Bloco 4. Trabalha incerteza como propriedade do mundo, e não como falha de quem calculou. A comparação “depende” é a prova: nas mesmas tempestades, uma decisão ganha numas e perde noutras.",
      },
      {
        nivel: "transferencia",
        pergunta: "O que a missão mostra sobre como um sistema pode afetar a vida das pessoas?",
        porQue:
          "Bloco 5. O alerta já foi montado no registro, então a pergunta não entrega nada do fechamento. Puxe para quem ficou sem equipe e para quem recebe o aviso no celular.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Que decisão sobre a nossa cidade é tomada com dado que não enxerga alguém?",
        porQue:
          "Só se sobrar tempo. Puxa para o real sem sair do instrumento: onde passa ônibus, onde vai o posto de saúde, onde a prefeitura conta que mora gente.",
      },
    ],
  },

  observacao: {
    intro:
      "Marque UMA letra por estudante durante o debate. Nesta missão a folha é a avaliação principal: o relatório da api conta o que ele consultou, mas quem ele se tornou como decisor aparece na fala.",
    marcas: [
      { letra: "E", texto: "sustentou a decisão citando uma fonte que ele mesmo abriu" },
      { letra: "I", texto: "assumiu que decidiu por intuição — honestidade, não erro" },
      { letra: "C", texto: "percebeu duas fontes em conflito e explicou em qual acreditou" },
      { letra: "A", texto: "nomeou o branco do mapa como “não sabemos”, e não como “zero”" },
      { letra: "N", texto: "não participou" },
    ],
    nota:
      "O A é o que a missão inteira existe para produzir, e é o mais raro no primeiro contato. Se aparecer em três estudantes de trinta, a aula funcionou.",
  },

  mediacao: [
    {
      quando: "A turma pergunta qual era a resposta certa.",
      faca: "Mostre a faixa: a mesma decisão, rodada 20 vezes, dá resultados diferentes. “A pergunta não é se você acertou. É se você decidiu com o que dava para saber.”",
      naoFaca:
        "Inventar uma alocação ótima para encerrar o assunto. Ela não existe no modelo, e a turma vai testar você.",
    },
    {
      quando: "Um estudante anuncia o viés de uma fonte antes do debate.",
      faca: "Ótimo — peça a prova: “como você descobriu?”. Escreva o nome dele na lousa ao lado da fonte. E não confirme nem negue as outras sete: o debate ainda precisa delas.",
    },
    {
      quando: "Alguém diz “não tinha como saber”.",
      faca: "Concorde, inteiro. E devolva: “certo. Com uma pergunta a mais, o que você teria descoberto?” A resposta separa quem entendeu a incerteza de quem se conformou com ela.",
    },
    {
      quando: "A sala conclui que “IA não presta / a IA mentiu”.",
      faca: "Volte ao que aconteceu: o Cientista respondeu com rigor sobre o dado que recebeu. Pergunte quem, na cidade, decidiu quais dados existiam — e note que essa pessoa não estava na conversa.",
      naoFaca:
        "Defender a IA. O ponto não é absolvê-la: é localizar a responsabilidade um passo antes, em quem escolheu o que medir.",
    },
    {
      quando: "Um estudante trata o branco do mapa como zero, em voz alta.",
      faca: "Pare o debate e trabalhe isso por dois minutos com a turma inteira. É o erro mais valioso que vai aparecer na aula, e ele precisa ser nomeado por alguém que o cometeu — não por você.",
    },
    {
      quando: "A turma começa a comparar quem “salvou mais gente”.",
      faca: "Corte e explique por que a lista da turma não tem coluna de resgatados: listagem é ordenável, e ordenar pessoas por acerto num problema sem resposta certa é produzir um ranking do acaso.",
      naoFaca:
        "Projetar a tela individual de alguém para ilustrar. O número existe, mas fica numa tela por vez, e é assim de propósito.",
    },
    {
      quando: "Ninguém carregou nenhuma fonte e a turma inteira decidiu no escuro.",
      faca: "É um resultado, não um fracasso — e provavelmente o melhor debate possível. Pergunte o que os fez decidir mesmo assim, e o que sentiram ao ver a lista do que nunca abriram.",
    },
    {
      quando: "O cronômetro acabou e metade da turma não decidiu.",
      faca: "Deixe acabar. Decidir tarde demais é um dos desfechos do problema, e a conversa sobre isso é melhor do que a decisão que você salvaria com dois minutos extras.",
    },
  ],

  depois: {
    sintese: [
      "“Nenhuma das fontes mentiu para vocês. Cada uma mediu bem o que ela consegue medir — e nenhuma consegue medir tudo.”",
      "“Bairro em branco no mapa nunca quis dizer bairro sem risco. Quem tratou branco como zero decidiu com uma informação que não existia.”",
      "“A mesma decisão, rodada vinte vezes, deu resultados diferentes. Vocês não controlavam o desfecho: controlavam a pergunta que fizeram antes.”",
    ],
    registro:
      "Duas linhas, individuais, no papel, no fechamento: “se eu tivesse uma quarta pergunta, faria ___, porque ___”. É a avaliação mais honesta desta missão — mostra o que o estudante entendeu do próprio ponto cego, e não a sorte que ele teve na simulação — e ela é sua: não vira nível no painel. O que vira nível são as tarefas no computador (a ligação da Saúde, o registro da operação, as duas comparações do resultado e o fechamento), e só aparece em “Habilidades da BNCC” depois que você encerra a missão na Sala de Aula. Quem não fez a tarefa de uma habilidade fica “não avaliado” nela, e você pode ajustar no painel.",
    produto: {
      titulo: "Registro estendido (para quem quiser levar a duas aulas)",
      itens: [
        "Qual foi a sua decisão, e qual evidência você usou para ela?",
        "Qual bairro ficou em branco no seu mapa? O que você assumiu sobre ele?",
        "Escolha uma fonte que você carregou e explique COMO ela foi produzida — quem mediu, quando, com que instrumento.",
        "Onde essa forma de produzir o dado deixa alguém de fora?",
        "A sua decisão mudaria se você soubesse disso antes? Diga o que mudaria, não só “sim”.",
        "Descreva uma decisão real (na sua cidade, na sua escola) que provavelmente é tomada com um dado parcial parecido.",
      ],
    },
    rubrica: {
      nota: "Nunca avalie quantas pessoas o estudante “salvou”: o desfecho é sorteado dentro de uma faixa, e dar nota a ele é dar nota ao sorteio — a própria tela do estudante mostra as 20 corridas para dizer isso. Avalie o raciocínio, que é o que ele controlou.",
      criterios: [
        {
          criterio: "Qualidade da pergunta",
          emDesenvolvimento:
            "Perguntou para confirmar a decisão que já tinha tomado, ou não perguntou.",
          adequado:
            "Perguntou algo que reduzia a incerteza sobre onde estava o risco.",
          avancado:
            "Encadeou: a segunda pergunta nasceu do que a primeira respondeu (ou não respondeu).",
        },
        {
          criterio: "Leitura da ausência",
          emDesenvolvimento: "Tratou bairro sem dado como bairro sem risco.",
          adequado:
            "Reconhece que branco significa “não sabemos” e diz o que assumiu no lugar.",
          avancado:
            "Usou a ausência como informação — decidiu levando em conta que havia um ponto cego, e diz qual.",
        },
        {
          criterio: "Crítica da fonte",
          emDesenvolvimento:
            "Trata as fontes como confiáveis ou não confiáveis em bloco.",
          adequado:
            "Explica o viés de ao menos uma fonte a partir de como ela foi produzida.",
          avancado:
            "Relaciona o viés ao efeito na decisão: mostra que aquela fonte o empurrou para um bairro específico.",
        },
        {
          criterio: "Decisão sob incerteza",
          emDesenvolvimento:
            "Justifica pelo resultado (“deu certo”) ou pela intuição sem reconhecê-la.",
          adequado:
            "Sustenta a decisão pela evidência disponível no momento em que decidiu.",
          avancado:
            "Sustenta a decisão E reconhece o que não sabia, sem transformar isso em desculpa.",
        },
      ],
    },
    desdobramentos: [
      "Geografia: pegue o mapa de vulnerabilidade real do município. Qual foi o ano do último levantamento? A pergunta do Morro Alto é literalmente a mesma.",
      "Matemática / Estatística: a faixa das 20 corridas é uma distribuição. Trabalhe amostra, variabilidade e por que a média sozinha mente sobre um caso individual.",
      "Sociologia e Filosofia: quem decide o que é medido decide o que existe. É Foucault com dado de prefeitura, e a turma acabou de viver isso.",
      "Ciências da Natureza: previsão meteorológica de grade grossa — por que a resolução espacial de um modelo é uma escolha, e o que ela custa.",
      "Redação / ENEM: proposta de intervenção sobre invisibilidade estatística de populações. A turma tem repertório vivido, não decorado.",
    ],
  },

  cuidados: [
    "Não projete a tabela dos vieses para a turma nem a entregue impressa. Ela é sua: entregue os vieses um a um, no debate, e de preferência deduzidos pela sala.",
    "Nunca exponha a decisão de um estudante com o nome dele. A lista da turma não tem coluna de resgatados por isso mesmo — ordenar crianças por acerto num problema sem resposta certa produz um ranking do acaso.",
    "Deixe explícito, no fechamento, que o assistente é uma IA e que a cidade, os dados e as pessoas são inventados para a atividade.",
    "Cuidado com a turma que mora no bairro invisível. O Morro Alto é ficção, a situação não é; conduza para o instrumento (o dado é velho) e nunca para o lugar ou as pessoas.",
    "Não diga que a IA errou. Ela respondeu com rigor sobre um dado torto — e é essa diferença que a aula ensina.",
    "“Foi intuição, não olhei dado” é uma resposta legítima e precisa ser dita como tal antes da decisão. Tratada como vergonha, ela some do relatório e você perde o dado mais interessante da turma.",
    "A missão fala de pessoas com deficiência, de acamados e de enchente. Pode haver na sala quem tem deficiência, quem cuida de alguém acamado, ou uma turma de região que passou por enchente há pouco tempo. O texto fala de pessoas afetadas, nunca de mortes; conduza a conversa pelo instrumento, não pela história de ninguém.",
    "As perguntas faladas sobre cuidado com os dados e sobre direitos só depois que todos enviarem o fechamento: antes, elas entregariam as respostas do WhatsApp e da moradora.",
  ],

  adaptacoes: [
    {
      contexto: "Há estudantes que precisam de mediação de leitura.",
      comoAdaptar:
        "Os cartões da ligação da Saúde, do registro e do fechamento podem ser lidos em voz alta: são iguais para todos, salvo os nomes de fonte e de bairro. Leia o enunciado e as opções sem comentar nenhuma.",
    },
    {
      contexto: "O grupo divide o mesmo computador.",
      comoAdaptar:
        "Todas as tarefas no computador são do grupo, inclusive as do fechamento: peça que o grupo decida em voz alta. O nível de quem entrou é copiado para os colegas da mesma equipe, e você ajusta cada estudante, um a um, no painel. A parte individual é a quarta pergunta, no papel.",
    },
    {
      contexto: "O sinal tocou e um grupo não terminou o fechamento.",
      comoAdaptar:
        "Ele termina no começo da aula seguinte, antes de você encerrar a missão na Sala de Aula. Se o debate passar do tempo, abra o fechamento no começo da aula seguinte.",
    },
    {
      contexto: "Você tem 30 minutos, não 50.",
      comoAdaptar:
        "Rode a missão (12 min) e escolha UM viés para o debate — sugestão: o satélite, que é o mais fácil de deduzir. Não corte a pergunta do mapa em branco: se sobrar tempo para uma pergunta só, é essa.",
    },
    {
      contexto: "Duas turmas em horários diferentes.",
      comoAdaptar:
        "O relógio é por turma, então cada uma tem a própria largada — não há conflito. O que não funciona é dar a largada e sair da sala: a segunda turma precisa de você no painel.",
    },
    {
      contexto: "Um estudante chegou depois da largada.",
      comoAdaptar:
        "Ele entra com o relógio já correndo, e isso é parte da condição do problema. Se for muito no fim, deixe-o acompanhar a decisão de um colega como observador e depois participar do debate — a conversa não exige que ele tenha jogado.",
    },
    {
      contexto: "Menos aparelhos que estudantes.",
      comoAdaptar:
        "Monte as equipes em “Equipes desta turma”, na ficha da missão (Minhas turmas → a turma → Conduzir com esta turma): diga quantos computadores há e sorteie, ou separe você mesmo. Só um da equipe entra, e ele representa o grupo: nos resultados da turma, cada computador é uma linha. As 3 perguntas e a cota diária de IA são da conta de quem entrou: a equipe negocia em voz alta o que perguntar, e você ouve o raciocínio acontecendo. O que for escrito fica no nome de quem entrou.",
    },
    {
      contexto: "A conexão da escola é lenta.",
      comoAdaptar:
        "Uma resposta do Cientista leva de 10 a 30 segundos mesmo em rede boa. Avise a turma antes: sem esse aviso, o estudante reenvia a pergunta achando que travou — e o orçamento de três perguntas não perdoa.",
    },
  ],

  duvidas: [
    {
      pergunta: "O resultado não aparece depois de “Enviar equipes”.",
      resposta:
        "Ele vem depois do registro da operação: três cartões, sem relógio, com as equipes já a caminho. Respondidos os cartões, o grupo toca em “Ver o que aconteceu”.",
    },
    {
      pergunta: "A turma pergunta da contagem da Secretaria de Saúde.",
      resposta:
        "Ela usa a mesma base de endereços do cadastro de nove anos atrás, então o Morro Alto aparece com menos da metade. É mais uma visão parcial, e entra no debate junto da tabela dos vieses. O Cientista não a comenta.",
    },
    {
      pergunta: "O cronômetro está parado e ninguém consegue falar com o assistente.",
      resposta:
        "Falta a largada. Ela sai de Resultados da turma e vale para a turma inteira ao mesmo tempo. É o motivo nº 1 de “não abre” nesta missão.",
    },
    {
      pergunta: "A turma não aparece com partida nenhuma no painel.",
      resposta:
        "Confira duas coisas, nesta ordem: a missão está liberada para a turma (Minhas turmas → Missões) e a largada foi dada.",
    },
    {
      pergunta: "Posso dar mais tempo?",
      resposta:
        "Pode: +2 min, quantas vezes quiser, e também pode encerrar a qualquer momento. Somar não faz a chuva andar para trás — a tempestade não rebobina.",
    },
    {
      pergunta: "Um estudante quer tentar de novo.",
      resposta:
        "Dá, até você abrir o fechamento: “Tentar de novo” abre uma tentativa NOVA e não apaga a conversa anterior. Nas tarefas de escolha (a ligação da Saúde, o alerta, as duas comparações e o fechamento), vale a primeira resposta da rodada; na leitura dos dados e nas fontes, a melhor tentativa que começou com o relógio aberto. Com o fechamento aberto, o botão some.",
    },
    {
      pergunta: "O assistente demora muito para responder.",
      resposta:
        "De 10 a 30 segundos é o normal — cada turno consulta várias fontes. Avise a turma antes da largada: reenviar não acelera e gasta o orçamento.",
    },
    {
      pergunta: "O que quer dizer “não consultou a previsão do tempo” no relatório?",
      resposta:
        "Que a fonte estava disponível e o estudante não a abriu. O relatório distingue isso de “a oportunidade não chegou” — são coisas diferentes e nunca aparecem com a mesma palavra.",
    },
  ],
};
