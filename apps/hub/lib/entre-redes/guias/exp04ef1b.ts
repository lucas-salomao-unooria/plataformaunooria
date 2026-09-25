import type { GuiaDaAula } from "./tipos";

/**
 * Guia da aula do **UnooTube** (exp04ef1b, 4º ano · Unidade 1).
 *
 * ATENÇÃO À FAIXA ETÁRIA: 9 e 10 anos. A missão não tem revelação em texto
 * corrido como a do 8º ano — a virada é UM clique que muda a ordem de uma
 * tabela, e a lição só existe se o professor a nomear em voz alta na sala. É a
 * missão em que o guia carrega mais peso: sem ele, a criança sai achando que
 * jogou um joguinho de vídeo.
 *
 * **O que ele NÃO guarda é a lista dos vídeos.** Ela vem de
 * `GET /unootube/professor/videos` como BLOCO VIVO, ancorado ao Debate. Esteve
 * aqui em prosa — "metade cita fonte verificável, a outra metade é
 * sensacionalista" — e a prosa tinha derivado: são 11 e 10, porque 21 é ímpar.
 * Os números da pontuação saem do mesmo lugar, pela mesma razão.
 *
 * A copy sai do `README.md` da experiência e do módulo `unootube` da api. O
 * material pedagógico é autoral e ainda não passou por playtest em sala — está
 * escrito para ser corrigido por quem der a primeira aula.
 */
export const GUIA_EXP04EF1B: GuiaDaAula = {
  expId: "exp04ef1b",
  chamada:
    "Uma aula de 50 minutos. A missão dura ~25 min e o resto é a conversa — que é onde a lição acontece: o software mostra a virada, mas quem a explica é você.",

  avisos: [
    {
      tom: "warning",
      titulo: "O que você sabe e a turma não",
      texto:
        "Parte dos vídeos cita fonte verificável e tem poucos inscritos; o resto é sensacionalista e ostenta números grandes. Salvar um sensacionalista rende MUITO mais inscritos que salvar um confiável — então, no ranking que abre ao fim da escolha, quem escolheu bem aparece perdendo. É de propósito, e a criança precisa sentir isso antes de você explicar. A lista dos vídeos, com o gabarito e os números exatos, está no fim da seção Debate.",
    },
    {
      tom: "info",
      titulo: "Os 39 colegas do ranking são inventados",
      texto:
        "Nenhuma criança real da sua turma aparece no ranking, e nenhum resultado de colega é comparado com outro. Diga isso à turma no momento em que o ranking abrir — aos 9 anos, “estou em 37º lugar” é uma informação sobre si mesmo, não sobre uma lista fictícia, a menos que alguém avise.",
    },
  ],

  objetivos: [
    "Explicar o que faz uma informação ser confiável: dizer de onde ela veio.",
    "Diferenciar “muita gente viu” de “é verdade”.",
    "Procurar, num vídeo, o sinal de que ele mostra a origem do que conta.",
    "Dizer em voz alta uma coisa que dá para fazer antes de acreditar numa história da internet.",
  ],

  bncc: [
    {
      codigo: "EF04CO08",
      texto:
        "Reconhecer a importância de verificar a confiabilidade das fontes de informações obtidas na Internet.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "A escolha dos 3 vídeos e a virada do ranking: a coluna “fontes confiáveis” aparece e o critério da lista muda na frente da criança.",
    },
    {
      codigo: "EF15CO08",
      texto:
        "Reconhecer e utilizar tecnologias computacionais para pesquisar e acessar informações, expressar-se crítica e criativamente e resolver problemas.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "O feed é o ambiente de pesquisa da missão — com a busca bloqueada de propósito, para que a criança avalie o que chega em vez de procurar o que já espera encontrar.",
    },
    {
      codigo: "EF15CO09",
      texto:
        "Entender que as tecnologias devem ser utilizadas de maneira segura, ética e responsável, respeitando direitos autorais, de imagem e as leis vigentes.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Fechamento: citar de onde veio a informação é o gesto de respeito à autoria que a missão treina sem nomear.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Libere a missão para a turma.",
        texto:
          "Minhas turmas → a turma → Missões. Sem isso a criança vê cadeado. Não há nada mais a configurar: o conteúdo é fixo, os 21 vídeos são os mesmos para todo mundo.",
      },
      {
        titulo: "Confira som ou fones antes.",
        texto:
          "Os vídeos começam MUDOS e é a criança que liga o som, num item da trilha de ações (“Som”/“Mudo”). Com 30 aparelhos sem fone a sala vira ruído; com fone, cada uma assiste no seu ritmo.",
      },
      {
        titulo: "Abra a missão você mesmo, uma vez.",
        texto:
          "Entre com um usuário de estudante e salve 3 vídeos até ver o ranking virar. São cinco minutos, e é o que te permite reconhecer a cara de uma criança que acabou de chegar naquela tela.",
      },
      {
        titulo: "Deixe a tela de resultados aberta em outra aba.",
        texto:
          "Por estudante: quantos vídeos salvou, quantas fontes confiáveis escolheu, quantos inscritos “ganhou” e se já chegou à virada. Nesta missão você não conduz por botões — acompanha.",
      },
    ],
    pedagogico: [
      {
        titulo: "Não é aula de História, e é bom que a turma não saiba disso.",
        texto:
          "Os 21 vídeos falam de Grandes Navegações, escrita cuneiforme e arqueologia. Se você anunciar “vamos falar de fontes”, a criança passa a procurar a pegadinha em vez de assistir. Anuncie o assunto: “vídeos curtos de História; salvem os 3 em que vocês confiariam”.",
      },
      {
        titulo: "Combine a palavra “confiar” antes de começar.",
        texto:
          "Pergunte à turma, em um minuto, o que faz vocês acreditarem em alguém. Anote as respostas num canto da lousa e NÃO comente. Elas voltam no debate, e ver a própria frase escrita na lousa vale mais do que qualquer conclusão sua.",
      },
      {
        titulo: "Avise que a lupa não funciona.",
        texto:
          "A busca está bloqueada de propósito. Uma criança de 9 anos que aperta a lupa três vezes e não acontece nada acha que quebrou — e passa a aula tentando consertar em vez de assistir.",
      },
      {
        titulo: "Reserve metade da aula para a conversa.",
        texto:
          "A missão termina em ~25 min. A tela mostra a virada com uma frase só, e a criança dessa idade não a transforma sozinha em conclusão. Sem os 15 minutos de debate, esta aula não aconteceu.",
      },
    ],
    naoDiga: [
      "“Alguns desses vídeos são falsos.” — a criança para de avaliar e começa a caçar o vídeo errado, que é outra tarefa.",
      "“Prestem atenção em quem tem mais inscritos.” — entrega a virada do ranking antes de ela acontecer.",
      "“Salvem os melhores.” — “melhor” aos 9 anos é o mais divertido. A instrução é “os 3 em que você CONFIARIA”, e vale repetir com essa palavra.",
      "“No fim vocês vão descobrir uma coisa.” — a expectativa muda o jeito de assistir desde o primeiro vídeo.",
    ],
  },

  roteiro: {
    total: "1 aula · 50 min",
    linhas: [
      {
        tempo: "0–5",
        momento: "Enquadramento e a pergunta da lousa.",
        professor:
          "“O que faz você acreditar em alguém?” Recolha 4 ou 5 respostas, escreva num canto da lousa e não comente nenhuma. Depois: “vocês vão ver vídeos curtos de História e salvar os 3 em que confiariam”.",
      },
      {
        tempo: "5–8",
        momento: "Entrada dos estudantes e tela inicial da missão.",
        professor:
          "Lembre do som (os vídeos começam mudos) e avise que a lupa não funciona nesta missão.",
      },
      {
        tempo: "8–25",
        momento:
          "O feed. Cada criança assiste e salva até 3 vídeos. A bandeja mostra o que já foi salvo, e dá para tirar e trocar.",
        professor:
          "Circule sem opinar sobre vídeo nenhum — nem cara de aprovação. Se perguntarem “esse é bom?”, devolva: “o que você acha? o que ele mostra que te faz confiar?”. Acompanhe pela tela de resultados quem já chegou aos 3.",
      },
      {
        tempo: "25–28",
        momento:
          "“Concluir missão” e o ranking da turma: 39 colegas fictícios mais a criança, ordenados por inscritos. Quem escolheu sensacionalista está no topo.",
        professor:
          "Este é o momento. Diga em voz alta, para todos: “esses 39 nomes são inventados, não é ninguém da nossa sala”. Depois fique quieto e olhe as caras. Alguém vai reclamar que é injusto — segure essa palavra, ela é o começo do debate.",
      },
      {
        tempo: "28–32",
        momento:
          "“Adicionar credibilidade”: a coluna de fontes confiáveis aparece e a lista se reordena. Quem tinha escolhido bem sobe.",
        professor:
          "Peça que TODOS apertem juntos, e que ninguém aperte antes. Depois leia a frase da tela em voz alta: “ter muitos inscritos não significa contar a verdade”.",
      },
      {
        tempo: "32–45",
        momento: "Debate com a turma inteira.",
        professor:
          "Volte para a lousa do início: as respostas que eles deram sobre confiar continuam lá. Marque quais funcionaram nos vídeos e quais não.",
      },
      {
        tempo: "45–50",
        momento: "Fechamento e registro.",
        professor:
          "Cada criança escreve UMA frase no caderno: “antes de acreditar num vídeo, eu vou ___”. Recolha três em voz alta e escreva na lousa.",
      },
    ],
    nota: "Não há botões de condução nesta missão: a criança anda sozinha do feed ao ranking, e o único momento em que a turma precisa andar junta é o clique em “Adicionar credibilidade”. Se alguém apertar antes, não é problema — só peça que espere para contar o que viu.",
  },

  debate: {
    aberturaNaLousa: "Muita gente assistindo quer dizer que é verdade?",
    tempo:
      "13 minutos, com a turma inteira. Aos 9 anos o debate não funciona em duplas soltas: funciona com uma pergunta por vez, resposta de três ou quatro crianças, e a sua devolução escrita na lousa.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Qual vídeo você salvou primeiro? O que nele fez você confiar?",
        porQue:
          "Prende a conversa ao que está na tela dela. Anote as razões em duas colunas na lousa sem dizer que são duas colunas: de um lado “mostrou de onde tirou”, do outro “era legal / a voz era boa / tinha música”.",
      },
      {
        nivel: "retomada",
        pergunta: "Alguém salvou um vídeo e depois tirou da bandeja? Por que tirou?",
        porQue:
          "Revela a criança que revisou a própria escolha — é o comportamento que a missão mais quer, e ele é invisível no resultado final.",
      },
      {
        nivel: "analise",
        pergunta:
          "O vídeo que ficou em primeiro lugar tinha mil inscritos. O que ele mostrava para provar que a história era verdadeira?",
        porQue:
          "É a pergunta central, e a resposta é “nada”. Deixe a turma procurar. Quando ninguém achar, a lista da lousa já respondeu sozinha.",
      },
      {
        nivel: "analise",
        pergunta:
          "Olhem as duas colunas da lousa. Quais dessas coisas o vídeo do topo tinha, e quais o vídeo que você salvou tinha?",
        porQue:
          "Faz a turma comparar critérios em vez de vídeos. É aqui que “ter muitos inscritos” sai da coluna de razões para confiar.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Se um vídeo diz de onde tirou a história, isso quer dizer que ele é verdade?",
        porQue:
          "Segura o pêndulo. A missão ensina a procurar a fonte, não a acreditar em quem cita qualquer fonte. Aceite “não sei” — é a resposta honesta, e a próxima pergunta é “então como a gente descobre?”.",
      },
      {
        nivel: "generalizacao",
        pergunta: "Por que alguém faria um vídeo contando uma história que não é verdade?",
        porQue:
          "Introduz intenção sem teoria da conspiração. As respostas de 9 anos são ótimas aqui: “pra ficar famoso”, “pra ganhar dinheiro”, “pra fazer graça”. Todas servem.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Quando você conta uma novidade para um amigo, como sabe que é verdade?",
        porQue:
          "Tira o problema da internet e o põe na vida da criança, onde ela já tem prática — ela sabe distinguir “minha mãe falou” de “o menino da outra sala falou”.",
      },
      {
        nivel: "transferencia",
        pergunta: "O que dá para fazer ANTES de acreditar num vídeo?",
        porQue:
          "É a frase que vai para o caderno no fechamento. Recuse “pensar melhor”: peça uma coisa que dá para fazer com as mãos — procurar quem contou, perguntar a um adulto, ver se outro lugar conta igual.",
      },
    ],
  },

  observacao: {
    intro:
      "Durante o debate, marque UMA letra ao lado do nome. Nesta missão a folha vale mais que o resultado da tela: o número de fontes confiáveis mede a escolha de uma criança de 9 anos num feed novo, e não o que ela entendeu.",
    marcas: [
      { letra: "F", texto: "deu como razão algo que o vídeo MOSTRAVA (de onde veio a história)" },
      { letra: "P", texto: "deu como razão a popularidade, a graça ou a aparência do vídeo" },
      { letra: "M", texto: "mudou de ideia durante a conversa e disse por quê" },
      { letra: "N", texto: "não participou" },
    ],
    nota:
      "Um P no começo da aula e um F no fim, na mesma criança, é o melhor resultado possível — e é por isso que vale marcar durante, não depois.",
  },

  mediacao: [
    {
      quando: "Uma criança fica visivelmente chateada com a posição no ranking.",
      faca: "Vá até ela e diga baixo que os 39 nomes são inventados e que a lista vai mudar em dois minutos. Depois, quando virar, chame a atenção da turma para o que aconteceu com ela — sem citar o nome.",
      naoFaca:
        "Consolar em público (“não liga, é só um jogo”). Isso ensina que o resultado não importava, quando ele importava muito: era a experiência inteira.",
    },
    {
      quando: "Alguém percebe cedo e anuncia “os que têm mil inscritos são falsos!”.",
      faca: "Peça a prova: “o que nesse vídeo te fez pensar isso?” Se a criança tiver um motivo, escreva na lousa com o nome dela. Se não tiver, é palpite — e você pode dizer isso com carinho, porque é exatamente o assunto da aula.",
    },
    {
      quando: "A turma conclui “então não dá para acreditar em nada da internet”.",
      faca: "Redirecione com um exemplo concreto: “o vídeo do museu contou de onde tirou. Nesse dá para acreditar?” Desconfiar de tudo custa igual a acreditar em tudo, e deixa a criança sem ferramenta.",
      naoFaca:
        "Aceitar como fecho. É a conclusão que soa madura e não serve para nada na segunda-feira.",
    },
    {
      quando: "Uma criança pergunta se o vídeo X é verdadeiro.",
      faca: "Devolva para a turma: “como a gente poderia descobrir?” A resposta é o objetivo da aula; entregá-la pronta é resolver o problema no lugar dela.",
    },
    {
      quando: "Duas crianças começam a comparar quantos inscritos cada uma tem.",
      faca: "Corte na hora e lembre em voz alta que o número de inscritos nesta missão NÃO é uma nota — é o que acontece com quem escolhe pela popularidade. Em dois minutos a tela vai dizer o mesmo.",
      naoFaca:
        "Usar o número como incentivo (“vamos ver quem consegue mais”). Isso transforma a armadilha da missão no objetivo dela.",
    },
    {
      quando: "Ninguém fala no debate.",
      faca: "Pergunte por levantar a mão primeiro (“quem salvou algum vídeo sobre navio?”) e só depois peça o porquê a quem levantou. Aos 9 anos a mão vem antes da fala.",
    },
  ],

  depois: {
    sintese: [
      "“Muita gente assistindo não quer dizer que a história é verdade. Foi isso que aconteceu com o ranking.”",
      "“Confiar em alguém é olhar de onde a pessoa tirou o que está contando.”",
      "“Dá para descobrir: procurar quem contou, ver se outro lugar conta igual, perguntar a um adulto. Leva menos de um minuto.”",
    ],
    registro:
      "Uma frase no caderno, completada por cada criança: “antes de acreditar num vídeo, eu vou ___”. Três lidas em voz alta e escritas na lousa. Fotografe a lousa: ela é o combinado da turma e volta na próxima aula, quando alguém trouxer uma notícia duvidosa — e sempre traz.",
    rubrica: {
      nota: "Nunca avalie quantas fontes confiáveis a criança salvou. Ela escolheu num app que acabou de conhecer, sem nenhuma pista, e é justamente por isso que a escolha dela é honesta. O que se avalia é o que ela diz DEPOIS da virada.",
      criterios: [
        {
          criterio: "Razão para confiar",
          emDesenvolvimento:
            "Justifica pela aparência ou pela graça do vídeo (“era legal”, “a voz era boa”).",
          adequado:
            "Cita algo que o vídeo mostrava — de onde veio a história, quem contou, onde isso foi descoberto.",
          avancado:
            "Compara dois vídeos e aponta o que um tinha e o outro não.",
        },
        {
          criterio: "Popularidade × verdade",
          emDesenvolvimento:
            "Ainda usa o número de inscritos como sinal de que a história é verdadeira.",
          adequado:
            "Diz, com as próprias palavras, que muita gente assistindo não quer dizer que é verdade.",
          avancado:
            "Explica por que alguém faria um vídeo assim — percebe que existe intenção do outro lado.",
        },
        {
          criterio: "O que fazer",
          emDesenvolvimento: "Frase de intenção (“vou prestar mais atenção”).",
          adequado:
            "Ação concreta: procurar quem contou, ver se outro lugar conta igual, perguntar a um adulto.",
          avancado:
            "Ação concreta e a situação em que vai usá-la (“quando chegar áudio no grupo da família”).",
        },
      ],
    },
    desdobramentos: [
      "História: pegue um dos temas dos vídeos (Grandes Navegações, escrita cuneiforme) e peça que a turma encontre, no livro didático, de onde o livro tirou a informação. Livro também tem fonte, e quase nenhuma criança já procurou.",
      "Língua Portuguesa: reescrever a manchete de um vídeo sensacionalista de um jeito que conte a mesma história sem exagerar. A criança sente a diferença escrevendo, não ouvindo.",
      "Matemática: “1 mil inscritos” contra “50 inscritos”. Quantas vezes mais? E se cada inscrito fosse um aluno desta escola, quantas escolas seriam? O número grande deixa de ser abstrato.",
      "Projeto de vida / convivência: o combinado da lousa vira cartaz da sala. Quando alguém trouxer uma novidade da internet, a turma aponta para o cartaz — funciona melhor que qualquer lembrete do professor.",
    ],
  },

  cuidados: [
    "Nunca exponha quem salvou vídeos sensacionalistas. O resultado é individual e assim deve ficar: a virada do ranking já ensina o que precisa ser ensinado, sem nome.",
    "Diga com todas as letras que os 39 colegas do ranking são inventados. Aos 9 anos, uma lista com nomes ao lado do seu é uma lista de gente real até que um adulto diga o contrário.",
    "O número de inscritos não é nota, não vira placar da sala e não entra em nenhum quadro de destaque.",
    "Não transforme a aula em “a internet mente”. A missão ensina a procurar a origem da informação — e a criança precisa sair com uma ferramenta, não com medo.",
    "Os vídeos foram produzidos para a atividade. Se alguma criança perguntar se são reais, responda que não: foram feitos para a aula, e os canais não existem.",
    "Evite “quem acertou?”. Não há acerto: há critério. A criança que salvou três sensacionalistas e explica bem por que mudaria agora aprendeu mais que a que acertou por sorte.",
  ],

  adaptacoes: [
    {
      contexto: "Não há fones para a turma.",
      comoAdaptar:
        "Peça que assistam com o som baixo e avise que a legenda da tela conta o essencial. Se a sala ficar impossível, faça em duas levas: metade assiste enquanto a outra metade escreve a resposta da lousa (“o que faz você acreditar em alguém?”).",
    },
    {
      contexto: "Os vídeos não carregam.",
      comoAdaptar:
        "A missão continua funcionando: o vídeo que falha libera as ações e a criança consegue salvar assim mesmo. Avise a turma que alguns vídeos não vão abrir e que isso não é problema dela — sem esse aviso, a criança acha que quebrou o aparelho e para.",
    },
    {
      contexto: "Você tem 30 minutos, não 50.",
      comoAdaptar:
        "Corte a pergunta inicial da lousa e reduza o feed para 10 min. Não corte a virada nem o debate: o clique em “Adicionar credibilidade” sem conversa depois é um efeito visual, não uma aula.",
    },
    {
      contexto: "Turma com leitura ainda em formação.",
      comoAdaptar:
        "As descrições dos vídeos e as URLs das fontes são texto. Leia em voz alta a descrição de dois vídeos — um de cada tipo — antes de soltar o feed, sem dizer qual é qual.",
    },
    {
      contexto: "Menos aparelhos que estudantes.",
      comoAdaptar:
        "Monte as equipes em “Equipes desta turma”, na ficha da missão (Minhas turmas → a turma → Conduzir com esta turma): diga quantos computadores há e sorteie, ou separe você mesmo. Só um da equipe entra, e ele representa o grupo — os 3 vídeos salvos são da equipe, e nos resultados da turma cada computador é uma linha. Sem fone para todos, combine o volume antes de soltar o feed.",
    },
    {
      contexto: "Uma criança terminou muito antes.",
      comoAdaptar:
        "Peça que volte ao feed e escolha o vídeo em que MENOS confiaria, e prepare o motivo para contar no debate. É a mesma habilidade pelo avesso, e rende no debate.",
    },
  ],

  duvidas: [
    {
      pergunta: "A criança entra e vê cadeado.",
      resposta:
        "A missão só abre na turma em que você a liberou: Minhas turmas → a turma → Missões. É o motivo nº 1 de “não abre” em toda a trilha.",
    },
    {
      pergunta: "A lupa da busca não funciona.",
      resposta:
        "É de propósito. A missão avalia o que a criança faz com o que CHEGA até ela; com busca, ela procuraria o que já espera encontrar. Avise antes, ou vira suporte no meio da aula.",
    },
    {
      pergunta: "Um estudante quer fazer de novo.",
      resposta:
        "Dá: “Reiniciar missão”, no perfil dele dentro da experiência. Volta à tela de entrada e zera as escolhas. Depois da virada, salvar e remover ficam bloqueados até reiniciar.",
    },
    {
      pergunta: "Salvou só 2 vídeos e o ranking não abriu.",
      resposta:
        "O ranking desbloqueia no 3º salvo — é o que faz a virada acontecer no momento em que ela tem efeito. Peça que escolha o terceiro.",
    },
    {
      pergunta: "A tela de um estudante está escura e a dos outros clara.",
      resposta:
        "É escolha dele, em Perfil → Aparência, e fica lembrada no aparelho. Não interfere em nada da missão.",
    },
    {
      pergunta: "Preciso preparar alguma coisa antes, como nas outras missões?",
      resposta:
        "Não. O conteúdo é fixo e igual para todas as turmas: os mesmos 21 vídeos, o mesmo ranking. A única coisa que você faz é liberar a missão para a turma.",
    },
  ],
};
