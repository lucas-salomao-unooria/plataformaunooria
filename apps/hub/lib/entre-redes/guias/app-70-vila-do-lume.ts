import type { GuiaDaAula } from "./tipos";

/**
 * Guia da aula da **Vila do Lume** (app-70, missão transversal).
 *
 * O debate É metade do instrumento, e é a única metade que o software não
 * executa: é nele que aparece a população que a telemetria não distingue — quem
 * não prestou atenção em nada — e é nele que a turma descobre que não recebeu
 * as mesmas mensagens. Sem isso, cada criança sai achando que a mensagem dela
 * era A mensagem, e a lição não acontece.
 *
 * O roteiro do debate e a revelação já existiam nesta rota antes deste guia, e
 * continuam vindo da api (`/vila/professor/cartoes`), por turma: os textos SÃO
 * o instrumento, e uma vírgula divergente entre o que o jogo serviu e o que o
 * professor projeta põe a sala discutindo uma mensagem que ninguém recebeu.
 * Eles entram como bloco vivo, ancorados ao debate.
 */
export const GUIA_APP_70: GuiaDaAula = {
  expId: "app-70-vila-do-lume",
  chamada:
    "Uma aula: 15 a 25 minutos de jogo por estudante e 10 a 15 minutos de debate. Missão transversal — roda em qualquer ano, e o perfil que ela lê alimenta as missões dos outros.",

  avisos: [
    {
      tom: "error",
      titulo: 'Diga com todas as letras: o "Estudante 14" não foi um colega de verdade',
      texto:
        "O golpe do nível C se apresenta como alguém da turma. Sua sala é real e as crianças conhecem os nomes umas das outras — se alguém sair daqui achando que o Estudante 14 fez alguma coisa, a missão causou dano. Esta frase não é opcional.",
    },
    {
      tom: "warning",
      titulo: "Nunca pergunte quem clicou",
      texto:
        "Nem por levantar a mão. A missão foi desenhada para funcionar sem essa pergunta: quem caiu passa a defender que não caiu, e a lição vira vergonha.",
    },
  ],

  objetivos: [
    "Reconhecer que um golpe pode não ter nenhum dos sinais que se ensina a procurar — nem erro de português, nem link estranho, nem promessa absurda.",
    "Identificar a pressa como o único elemento comum a mensagens de engano de níveis muito diferentes.",
    "Descrever o que se faz para confirmar um pedido por um segundo caminho, em vez de responder pelo mesmo canal.",
    "Perceber que ter recebido uma mensagem diferente da do colega explica a diferença de reação melhor do que esperteza.",
    "Recusar a leitura de que “quem cai é bobo”, reconhecendo que não contar é o que faz o golpe seguinte funcionar.",
  ],

  bncc: [
    {
      codigo: "EF07CO07",
      texto:
        "Identificar problemas de segurança cibernética e experimentar formas de proteção.",
      eixo: "Mundo Digital",
      principal: true,
      ondeAcontece:
        "(6º ao 9º) O jogo é o experimento: as mensagens chegam durante a partida, sem pausa, e a proteção é a que a criança inventa na hora — e depois nomeia no debate.",
    },
    {
      codigo: "EF08CO08",
      texto:
        "Distinguir os tipos de dados pessoais que são solicitados em espaços digitais e os riscos associados.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "(8º ano) O golpe de nível C pede um passo pequeno, não um dado grande — é por aí que se conversa sobre o que é “pequeno demais para recusar”.",
    },
    {
      codigo: "EM13CO08",
      texto:
        "Entender como mudanças na tecnologia afetam a segurança, incluindo novas maneiras de preservar sua privacidade e dados pessoais on-line, reportando suspeitas e buscando ajuda em situações de risco.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "(Ensino Médio) O fechamento — “confere por outro caminho” — é literalmente buscar ajuda e reportar, e é a única coisa da aula para decorar.",
    },
    {
      codigo: "EF15CO09",
      texto:
        "Entender que as tecnologias devem ser utilizadas de maneira segura, ética e responsável, respeitando direitos autorais, de imagem e as leis vigentes.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "(1º ao 5º) Nos anos iniciais a bolha B não é servida, e o contraste A × C já sustenta a conversa sobre uso seguro.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Libere a missão para a turma.",
        texto:
          "Minhas turmas → a turma → Missões. A Vila aparece como “para qualquer ano”: ela é transversal e não pertence a nenhuma série.",
      },
      {
        titulo: "Teste um aparelho da sala antes.",
        texto:
          "É um jogo 3D no navegador, em primeira pessoa. Abra em uma das máquinas que a turma vai usar e ande um pouco: se o aparelho engasgar, é melhor descobrir agora do que com 30 crianças esperando.",
      },
      {
        titulo: "Confira nos resultados se as três bolhas estão na sua turma.",
        texto:
          "Sem as três, a revelação não tem o que comparar. Nos anos iniciais são duas (A e C), e a página da revelação avisa isso quando você escolhe a turma.",
      },
      {
        titulo: "Abra o guia com a SUA turma selecionada.",
        texto:
          "Mais abaixo, na revelação, há um seletor de turma. Com a turma escolhida, esta página mostra só as mensagens que aquela sala recebeu de verdade — projetar uma bolha que não foi servida faz você esperar a reação de um grupo que não existe ali.",
      },
      {
        titulo: "Deixe esta página aberta e projetável.",
        texto:
          "A revelação é feita projetando as três versões lado a lado. É a única aula da trilha em que o guia vai para a tela grande — e só na hora certa.",
      },
    ],
    pedagogico: [
      {
        titulo: "Não conte nada antes. Nada mesmo.",
        texto:
          "A instrução é só “vocês vão manter a vila acesa”. Nem “prestem atenção nas mensagens”. A missão mede o que a criança faz quando não sabe que está sendo lida, e a frase mais inocente destrói isso.",
      },
      {
        titulo: "Combine o tempo do jogo em voz alta.",
        texto:
          "Entre 15 e 25 minutos. Quem acabar antes não atrapalha quem ainda joga: peça que fique na vila explorando. Ninguém precisa terminar as 8 fogueiras para o debate funcionar.",
      },
      {
        titulo: "Prepare-se para não corrigir.",
        texto:
          "No debate você não valida nem desmente nenhum sinal que a turma citar. Só pergunta “o que te fez confiar ou desconfiar dessa?” e anota na lousa. É mais difícil do que parece, e é o que faz a revelação funcionar depois.",
      },
      {
        titulo: "Aceite que a aula tem um silêncio no meio.",
        texto:
          "Depois de “vocês não receberam as mesmas mensagens”, a sala fica quieta. Não preencha. Esse silêncio é o momento em que a coisa acontece.",
      },
    ],
    naoDiga: [
      "“Prestem atenção nas mensagens que aparecerem.” — a criança passa a jogar esperando o golpe, e o instrumento inteiro deixa de medir o que existe para medir.",
      "“É um jogo sobre golpes na internet.” — mesma coisa, mais direto.",
      "“Não cliquem em nada suspeito.” — instala o sinal antes do experimento, e depois é impossível saber o que ela teria feito.",
      "“Depois vocês vão ver uma surpresa.” — a expectativa muda a leitura de cada mensagem.",
      "Qualquer coisa sobre as três bolhas, antes da revelação. É a única informação que precisa chegar exatamente naquele momento.",
    ],
  },

  roteiro: {
    total: "1 aula · 45 a 50 min",
    linhas: [
      {
        tempo: "0–5",
        momento: "Enquadramento mínimo e entrada no jogo.",
        professor:
          "“A vila apagou. Vocês vão acender as oito fogueiras antes que a noite acabe.” Ponto final. Explique só os controles, se precisar.",
      },
      {
        tempo: "5–30",
        momento:
          "A partida. Cada estudante minera fagulha, acende fogueiras, recolhe as Chamas Sagradas — e recebe 5 mensagens que não pausam o jogo.",
        professor:
          "Circule sem olhar tela. Se alguém perguntar sobre uma mensagem, devolva “o que você acha?” e siga andando. Não reaja a nada do que aparecer no monitor de ninguém.",
      },
      {
        tempo: "30–33",
        momento: "Fim do jogo. Aparelhos fechados ou virados.",
        professor:
          "Escreva na lousa: “Em quem dava pra confiar?”. Só isso, sem introdução e sem pressupor que havia golpe.",
      },
      {
        tempo: "33–40",
        momento:
          "O debate. A turma cita sinais; você anota todos na lousa, sem corrigir nenhum.",
        professor:
          "Uma pergunta só, repetida: “o que te fez confiar ou desconfiar dessa?”. Anote também quem disse que não lembra de mensagem nenhuma — esse é o achado da aula.",
      },
      {
        tempo: "40–47",
        momento:
          "A revelação: as três versões projetadas lado a lado, desta página, com a sua turma selecionada.",
        professor:
          "Leia a frase da revelação inteira, sem resumir. Depois leia em voz alta a mensagem do nível C para quem disse que era óbvio. E diga, com todas as letras, que o Estudante 14 não foi um colega de verdade.",
      },
      {
        tempo: "47–50",
        momento: "Fechamento.",
        professor:
          "Escreva na lousa a única coisa da aula para decorar: “Confere por outro caminho.” Peça um exemplo a três estudantes — o caminho, não a regra.",
      },
    ],
    nota: "Não existe botão de condução nesta missão: o jogo é individual e roda inteiro no aparelho da criança. O que você controla é o relógio da sala e o momento de projetar a revelação — e esse momento é depois de a lousa estar cheia de sinais, nunca antes.",
  },

  debate: {
    aberturaNaLousa: "Em quem dava pra confiar?",
    tempo:
      "7 minutos de sinais na lousa e mais 7 na revelação. É metade do instrumento: a outra metade é o jogo, e sozinha ela não ensina nada — cada criança sai achando que a mensagem dela era a mensagem de todo mundo.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "O que te fez confiar ou desconfiar dessa mensagem?",
        porQue:
          "É a pergunta única do debate, repetida a cada estudante que fala. Anote todos os sinais na lousa sem julgar nenhum — eles vão ser confrontados pela própria revelação daqui a pouco, e é muito mais forte assim.",
      },
      {
        nivel: "retomada",
        pergunta: "Alguém não lembra de ter recebido mensagem nenhuma?",
        porQue:
          "Este é o achado da aula, e é o único grupo que a telemetria não separa sozinha. Cruze depois com os resultados da turma: quem não lembra e tem muitas mensagens ignoradas não viu; quem não lembra e tem muitas respondidas clicou para tirar da frente. São duas crianças diferentes e o mesmo silêncio.",
      },
      {
        nivel: "analise",
        pergunta:
          "(Depois da revelação) Vocês estão todos certos. Por que a mesma sala discordou tanto sobre o que era óbvio?",
        porQue:
          "Faz a turma nomear a diferença de contexto em vez de a diferença de esperteza. É a frase-chave da revelação, e vale repeti-la como pergunta.",
      },
      {
        nivel: "analise",
        pergunta:
          "Olhem os sinais na lousa. Qual deles pegaria a mensagem do nível C?",
        porQue:
          "Nenhum. Todos os sinais que a turma escreveu são verdadeiros e nenhum funciona contra um golpe bem-feito. Deixe a sala percorrer a lista sozinha — é o momento mais eficaz da aula.",
      },
      {
        nivel: "generalizacao",
        pergunta: "O que as três mensagens tinham em comum, apesar de tão diferentes?",
        porQue:
          "Pressa. É o único sinal que atravessa os três níveis, e é por isso que ele é a coisa que fica. Se a turma não chegar, dê a pista: “o que todas as três queriam que você fizesse RÁPIDO?”",
      },
      {
        nivel: "generalizacao",
        pergunta: "Se desconfiar de tudo resolvesse, o que a gente perderia?",
        porQue:
          "Duas das cinco mensagens eram verdadeiras e ajudavam de verdade. Quem recusou tudo recusou também o único aviso honesto da noite — desconfiar de tudo custa igual, e isola.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Chega uma mensagem dizendo que é a sua mãe, de um número novo, pedindo um favor rápido. O que você faz?",
        porQue:
          "É o golpe real mais comum no Brasil, e a resposta é a frase da aula: sai do chat e liga para a sua mãe. Peça o gesto, não a intenção.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Se acontecesse com você, você contaria para alguém? Por quê?",
        porQue:
          "Fecha o ciclo da frase “quem cai nisso é bobo”, que alguém vai ter dito. Não contar é o que faz o golpe seguinte funcionar na mesma casa — e essa é a razão pela qual a aula não pergunta quem clicou.",
      },
    ],
  },

  observacao: {
    intro:
      "Marque UMA letra ao lado do nome de cada estudante enquanto a sala discute. Nesta missão a folha é a avaliação inteira: o jogo não pontua nada, de propósito.",
    marcas: [
      { letra: "P", texto: "tomou posição e sustentou com um motivo tirado da mensagem" },
      { letra: "S", texto: "tomou posição, mas repetindo o que o colega disse" },
      { letra: "N", texto: "não participou" },
      { letra: "?", texto: "disse que não lembra de ter recebido mensagem" },
    ],
    nota:
      "Alguém vai dizer “quem cai nisso é bobo”. Vai ser dito. Anote quem disse — essa frase é a razão pela qual as pessoas não contam quando acontece com elas, e não contar é o que faz o golpe seguinte funcionar na mesma casa.",
  },

  mediacao: [
    {
      quando: "A bolha A diz que era tudo óbvio.",
      faca: "Concorde — para ela, era mesmo. Guarde a frase e devolva na revelação, lendo em voz alta a mensagem do nível C que ela nunca viu.",
      naoFaca:
        "Contra-argumentar na hora. Sem as três versões na tela, vira a palavra do professor contra a da criança, e ela tem razão sobre a mensagem dela.",
    },
    {
      quando: "A bolha C não consegue explicar por que caiu.",
      faca: "Não force. Diga que faz sentido não saber explicar e siga — a explicação chega sozinha quando as três versões aparecerem lado a lado.",
      naoFaca:
        "Insistir (“mas o que te convenceu?”). É a pergunta que transforma a criança em réu na frente da turma.",
    },
    {
      quando: "Alguém diz “quem cai nisso é bobo”.",
      faca: "Anote e não responda ainda. Depois da revelação, volte: “quem disse isso recebeu a mensagem A. Vamos ler a C.” A correção vem do material, não de você.",
    },
    {
      quando: "A turma quer saber quem, na sala, caiu.",
      faca: "Corte com clareza: “essa pergunta não vai ser feita nesta aula, e eu vou explicar por quê no fim.” E explique no fim — quem cai passa a defender que não caiu, e a lição vira vergonha.",
      naoFaca:
        "Perguntar por levantar a mão, nem “só de brincadeira”. A missão inteira foi desenhada para funcionar sem isso.",
    },
    {
      quando: "Um estudante afirma que o Estudante 14 é um colega da sala.",
      faca: "Interrompa na hora e desminta em voz alta, para todos: não foi um colega, foi uma personagem do jogo. Não espere a revelação para isso.",
    },
    {
      quando: "A conversa vira “então não dá para confiar em ninguém na internet”.",
      faca: "Lembre das duas mensagens verdadeiras. Pergunte quem as recusou e o que perdeu com isso. Desconfiar de tudo é uma resposta cara, e o jogo cobrou o preço dela.",
    },
    {
      quando: "Ninguém lembra de mensagem nenhuma.",
      faca: "É um resultado, e um bom debate. As mensagens chegam sem pausar o jogo, disputando atenção com uma tarefa — que é exatamente como elas chegam na vida. Comece por aí.",
    },
  ],

  depois: {
    sintese: [
      "“Cair não é burrice, é contexto. O melhor golpe não parece golpe: vem da pessoa certa, no momento em que você precisa, pedindo algo pequeno.”",
      "“Os sinais só pegam os golpes ruins. Todos os que vocês escreveram na lousa são verdadeiros — e nenhum funciona contra um golpe bem-feito.”",
      "“Desconfiar de tudo não é a resposta: custa igual, e isola. Duas das mensagens de vocês eram verdadeiras.”",
      "“A única coisa da aula para decorar: CONFERE POR OUTRO CAMINHO. Diz que é o suporte? Sai do chat e procura o suporte. Diz que é sua mãe? Liga pra sua mãe. Golpe nenhum sobrevive a uma segunda conversa — e é por isso que todo golpe tem pressa.”",
    ],
    registro:
      "Uma frase na lousa, copiada por todos: “Confere por outro caminho.” Peça a três estudantes que digam o caminho concreto de um caso — o suporte, a mãe, o colega. A regra sem o caminho não sobrevive à segunda-feira.",
    rubrica: {
      nota: "O jogo não pontua e não há nota possível a partir dele: o que ele registra é como a criança escolheu quando escolher custava algo, e isso não é desempenho. A avaliação é a folha de observação do debate, lida com estes critérios.",
      criterios: [
        {
          criterio: "Sinais nomeados",
          emDesenvolvimento: "Diz que confiou ou não confiou sem conseguir apontar o quê.",
          adequado: "Aponta um elemento concreto da mensagem que o fez confiar ou desconfiar.",
          avancado:
            "Percebe que o sinal que ele usou não funcionaria em outra das mensagens projetadas.",
        },
        {
          criterio: "Leitura do contexto",
          emDesenvolvimento:
            "Atribui a diferença entre os colegas a esperteza (“ele é mais atento”).",
          adequado:
            "Reconhece que receberam mensagens diferentes e que isso explica a diferença de reação.",
          avancado:
            "Generaliza: percebe que o mesmo vale fora do jogo, e que julgar quem caiu é julgar sem saber o que a pessoa recebeu.",
        },
        {
          criterio: "A ação",
          emDesenvolvimento: "Fica em “vou desconfiar mais”.",
          adequado: "Diz o gesto: confere por outro caminho.",
          avancado:
            "Diz o gesto e o caminho específico de um caso real da vida dele.",
        },
      ],
    },
    desdobramentos: [
      "Convivência / Projeto de vida: escrever com a turma o combinado da sala sobre pedidos por mensagem — inclusive entre eles, que é onde o pedido pequeno acontece de verdade.",
      "Língua Portuguesa: comparar as três mensagens como três textos com o mesmo objetivo e registros diferentes. Qual é mais educado? Qual é mais eficaz? As duas respostas não coincidem, e é esse o assunto.",
      "Matemática (anos finais): a pressa como variável. Quanto tempo cada mensagem dava para pensar? O que muda numa decisão com 5 segundos e com 5 minutos?",
      "Para o professor do 8º ano: o perfil que este jogo lê é o que decide de que lado nasce o feed do Unoovista. Rodar a Vila antes é o Ato 1 daquela missão — e a turma não pode saber disso.",
    ],
  },

  cuidados: [
    "Não conte nada antes. A instrução é só “vocês vão manter a vila acesa” — nem “prestem atenção nas mensagens”.",
    "Nunca pergunte quem clicou, nem por levantar a mão. A missão foi desenhada para funcionar sem essa pergunta.",
    "Na revelação, diga com todas as letras que o “Estudante 14” não foi um colega de verdade.",
    "Confira nos resultados se as três bolhas estão na sua turma: sem as três, a revelação não tem o que comparar. Nos anos iniciais são duas, e projetar a terceira é discutir uma mensagem que ninguém recebeu.",
    "O perfil de valores que o jogo lê não é rótulo de criança. Não vira apelido, categoria, nota nem adjetivo — é o que o jogo captou naquele dia.",
    "Se a turma souber que este jogo alimenta outra missão, o Ato 1 do Unoovista deixa de funcionar. Essa informação é sua.",
    "Se alguma criança contar que já caiu em um golpe de verdade, acolha na hora e sem plateia. A aula pode esperar; e essa criança acabou de fazer exatamente o que a missão pede que as pessoas façam.",
  ],

  adaptacoes: [
    {
      contexto: "Anos iniciais (1º ao 5º ano).",
      comoAdaptar:
        "A bolha B (autoridade com urgência) não é servida nessa faixa — a revelação projeta só A e C, e o contraste entre elas já divide a sala. Escolha a turma no seletor mais abaixo para que esta página mostre apenas o que ela recebeu.",
    },
    {
      contexto: "Você tem 30 minutos, não 50.",
      comoAdaptar:
        "Reduza o jogo para 15 minutos — ninguém precisa acender as 8 fogueiras. O que não se corta é a revelação: sem ela, a aula é um jogo, e as crianças saem com a impressão errada de que a mensagem delas era a de todos.",
    },
    {
      contexto: "Os aparelhos não dão conta do 3D.",
      comoAdaptar:
        "Jogue em duplas, alternando quem controla a cada fogueira. As mensagens chegam para a dupla, e o debate ganha um dado a mais: as duas viram a mesma mensagem e reagiram diferente.",
    },
    {
      contexto: "Turma que já rodou a Vila no ano passado.",
      comoAdaptar:
        "O golpe que cada criança recebe é de um nível só, e ela lembra do dela. Rode assim mesmo e mude o eixo do debate: “o que você fez diferente sabendo o que sabia?” — reconhecer o próprio aprendizado é um resultado legítimo.",
    },
    {
      contexto: "Uma criança se recusa a jogar ou trava no 3D.",
      comoAdaptar:
        "Ela participa do debate igual: convide-a a ser quem anota os sinais na lousa. A parte que vale da aula é a conversa, e essa função dá a ela um lugar de verdade nela.",
    },
  ],

  duvidas: [
    {
      pergunta: "A missão não aparece para a turma.",
      resposta:
        "Precisa estar liberada: Minhas turmas → a turma → Missões. A Vila aparece na grade de qualquer série, marcada como “para qualquer ano”.",
    },
    {
      pergunta: "A turma não recebeu as três bolhas.",
      resposta:
        "Nos anos iniciais são duas (A e C), de propósito. Nas demais séries, se faltar uma, é porque poucas crianças jogaram — a distribuição precisa de gente. Confira em Resultados da turma antes de projetar.",
    },
    {
      pergunta: "Um estudante não terminou as oito fogueiras.",
      resposta:
        "Não faz diferença. O que a missão lê são as escolhas ao longo do caminho e as mensagens; terminar a vila não é o objetivo e não muda nada no debate.",
    },
    {
      pergunta: "Posso mostrar esta página para a turma?",
      resposta:
        "Só a partir da revelação, e só a parte da revelação. O resto do guia — o que vai acontecer, a folha de observação, os cuidados — é material seu.",
    },
    {
      pergunta: "Dá para saber quem caiu em qual golpe?",
      resposta:
        "Os resultados da turma mostram como as mensagens foram tratadas, por estudante. Use para entender a sala, nunca para citar nome no debate: essa pergunta é a única que a missão proíbe.",
    },
    {
      pergunta: "A Vila serve para qual ano?",
      resposta:
        "Qualquer um, do 1º ano do Fundamental ao 3º do Médio. Ela é transversal porque o que lê — como alguém escolhe quando escolher custa algo — não é conteúdo de série nenhuma.",
    },
  ],
};
