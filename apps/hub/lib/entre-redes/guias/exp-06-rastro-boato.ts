import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula de **O Rastro do Boato** (6º ano, unidade 2).
 *
 * A missão irmã da exp-07, e a diferença entre as duas é o objeto de análise —
 * é ela que separa as duas na trilha. Lá se audita o RECORTE de um print e a
 * resposta é citar a matéria completa; aqui se auditam os DADOS DE ENVIO
 * (quantos saltos anônimos, quem assina, quando nasceu) e a resposta é ler a
 * própria decisão desenhada como topologia.
 *
 * O professor tem UM botão durante a aula (abrir a Aula 2) e o inverso dele —
 * menos que os três da exp-07, porque esta missão pede menos: o debate acontece
 * DEPOIS do mapa, não no meio dele.
 */
export const GUIA_EXP_06: GuiaDaAula = {
  expId: "exp-06-rastro-boato",
  chamada:
    "Duas aulas de 30 a 35 min, com uma pausa entre elas. Você abre a segunda por um botão no painel — e sem ele a turma para no card de pausa.",

  avisos: [
    {
      tom: "warning",
      titulo: "Esta missão tem duas aulas, e é você que abre a segunda",
      texto:
        "No fim da Aula 1 a turma trava num card de pausa com o progresso salvo. O botão “Abrir a Aula 2” fica em Resultados da turma, e o inverso dele devolve a turma à investigação. Sem o primeiro, ninguém vê o mapa da rede.",
    },
    {
      tom: "info",
      titulo: "A decisão é cronometrada, e o relógio é do estudante",
      texto:
        "O tempo entre a crise chegar e o envio é medido no aparelho, não na api: ele distingue impulso de reflexão. Quem trava nos 90 segundos não travou por preguiça — a tela do pico não dá dica nenhuma, de propósito. É a tensão ética que a missão existe para produzir.",
    },
  ],

  objetivos: [
    "Ler os dados de envio de uma mensagem — saltos anônimos, autoria, data de origem — e dizer o que cada um informa.",
    "Distinguir volume de circulação de veracidade: uma mensagem muito encaminhada é uma mensagem muito encaminhada.",
    "Escolher, sob pressão de tempo, uma resposta que interrompa a corrente em vez de alimentá-la.",
    "Reconhecer no mapa da rede que apagar para si mesmo e encaminhar produzem o mesmo desenho.",
    "Nomear o gatilho emocional que acelera o repasse e um gesto próprio de checagem que caiba no tempo real.",
  ],

  bncc: [
    {
      codigo: "EF06CO08",
      texto:
        "Compreender e utilizar diferentes formas de armazenar, manipular, compactar e recuperar arquivos, documentos e metadados.",
      eixo: "Mundo Digital",
      principal: true,
      ondeAcontece:
        "A auditoria: o modal “Dados da mensagem” traz saltos, autor, detalhe e carimbo — e nenhum campo diz qual é a falsa. Reconhecer o padrão a partir dos números É a tarefa.",
    },
    {
      codigo: "EF06CO01",
      texto:
        "Classificar informações, agrupando-as em coleções (conjuntos) e associando cada coleção a um ‘tipo de dados’.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Os quatro grupos de mensagens são quatro coleções, e o estudante separa o que é dado de envio do que é conteúdo — a distinção que faz a auditoria funcionar.",
    },
    {
      codigo: "EF06CO07",
      texto:
        "Entender o processo de transmissão de dados, como a informação é quebrada em pedaços, transmitida em pacotes através de múltiplos equipamentos.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "O mapa da rede, depois da decisão: a mensagem aparece atravessando aparelhos, e o desenho muda conforme a escolha de cada um.",
    },
    {
      codigo: "EF06CO09",
      texto:
        "Apresentar conduta e linguagem apropriadas ao se comunicar em ambiente digital, considerando a ética e o respeito.",
      eixo: "Mundo Digital",
      ondeAcontece:
        "As três opções são três condutas: encaminhar para avisar, denunciar e fixar o laudo, ou apagar para si e calar. Cada uma tem consequência dentro da ficção.",
    },
    {
      codigo: "EF06CO10",
      texto:
        "Analisar o consumo de tecnologia na sociedade, compreendendo criticamente o caminho da produção dos recursos bem como aspectos ligados à privacidade e à segurança.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "O ciclo: quatro blocos causais que a turma monta na ordem — gatilho, repasse, ausência de checagem, desfecho. É a generalização que sobrevive à aula.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Libere a missão para a turma.",
        texto: "Minhas turmas → a turma → Missões. Sem isso a criança vê cadeado.",
      },
      {
        titulo: "Confira os fones.",
        texto:
          "Há áudio no fio das conversas. A transcrição está sempre na tela, por acessibilidade — sem fone a missão roda igual, mas o áudio alarmado é metade da cena.",
      },
      {
        titulo: "Reserve as duas aulas seguidas na agenda.",
        texto:
          "O progresso fica salvo, mas a pausa foi desenhada para uma aula e a seguinte. Com uma semana no meio, a turma volta sem a tensão que a decisão produziu.",
      },
      {
        titulo: "Deixe o painel de Resultados aberto numa aba.",
        texto:
          "É de lá que você abre a Aula 2. Vale abrir antes de a aula começar, para não procurar a tela com a turma esperando.",
      },
    ],
    pedagogico: [
      {
        titulo: "Não anuncie que é uma aula sobre fake news.",
        texto:
          "Aos 11 anos a expressão já vem com resposta pronta (“não pode acreditar em tudo”), e a criança passa a missão procurando a mentira em vez de investigar de onde a mensagem veio. Anuncie o enredo: “o Tomás te chama, está correndo um aviso sobre a água da escola”.",
      },
      {
        titulo: "Combine antes o que fazer se a turma pedir a resposta.",
        texto:
          "Vão pedir. A devolutiva pronta — “o que os dados de envio já te contam?” — precisa sair sem hesitação, porque uma única confirmação sua encerra a investigação de quem estava ouvindo.",
      },
      {
        titulo: "Aceite que a maioria vai escolher mal na primeira vez.",
        texto:
          "A missão foi desenhada assim: o mapa da rede fica interessante justamente porque a turma alimentou a corrente. Se você conduzir para o acerto, a Aula 2 perde o objeto.",
      },
      {
        titulo: "Pense em como tratar um boato real que apareça.",
        texto:
          "É provável que surja um caso da escola no debate. Acolha e não investigue ali: a missão é o ensaio, e o caso real tem gente envolvida na sala.",
      },
    ],
    naoDiga: [
      "“Uma dessas mensagens é falsa.” — entrega o padrão que a criança tem de reconhecer sozinha nos dados de envio. É a habilidade avaliada.",
      "“Olhem quantos encaminhamentos tem.” — é exatamente a pista central; dita por você, a auditoria acaba antes de começar.",
      "“Não encaminhem nada.” — vira regra moral e a turma responde o que você quer ouvir. A missão quer que descubram POR QUE, não que obedeçam.",
      "“Quem escolheu errado levanta a mão.” — expõe a criança e transforma o mapa, que é anônimo de propósito, em julgamento.",
    ],
  },

  roteiro: {
    total: "2 aulas de 30–35 min, com pausa entre elas",
    linhas: [
      {
        tempo: "Aula 1 · 0–4",
        momento: "Enquadramento.",
        professor:
          "“O Tomás vai chamar vocês. Está correndo um aviso sobre a água da escola, e ninguém sabe de onde saiu. Descubram.” Nada além disso — não diga que há uma mensagem falsa.",
      },
      {
        tempo: "Aula 1 · 4–8",
        momento: "Entrada: Tomás chama no privado e aponta os grupos.",
        professor:
          "Lembre dos fones e avise que a transcrição de cada áudio está na tela.",
      },
      {
        tempo: "Aula 1 · 8–24",
        momento:
          "Auditoria dos quatro grupos. Tocando numa mensagem, o modal “Dados da mensagem” abre: saltos anônimos, quem assina, o carimbo de origem.",
        professor:
          "Circule em silêncio. A quem perguntar “qual é a falsa?”, devolva: “o que os dados de envio já te contam?”. Se alguém achar e comemorar alto, peça segredo — com cumplicidade, não com bronca.",
      },
      {
        tempo: "Aula 1 · 24–30",
        momento:
          "A crise chega e o relógio começa. Três opções: encaminhar para avisar, denunciar e fixar o laudo, ou apagar só para si.",
        professor:
          "Não ajude a escolher. O tempo que cada um leva é dado da missão, e a hesitação é a parte que interessa. A aula termina no card de pausa.",
      },
      {
        tempo: "entre as aulas",
        momento: "A turma fica no card de pausa, com o progresso salvo.",
        professor:
          "Abra a Aula 2 em Resultados da turma quando a turma estiver reunida de novo. Antes disso, ninguém passa.",
        botao: "Abrir a Aula 2",
      },
      {
        tempo: "Aula 2 · 0–8",
        momento:
          "O mapa da rede: a decisão de cada um desenhada como topologia, com o alcance que ela produziu.",
        professor:
          "Deixe olharem em silêncio antes de falar qualquer coisa. O desenho de quem encaminhou e o de quem apagou para si são parecidos — e é essa semelhança que abre o debate.",
      },
      {
        tempo: "Aula 2 · 8–20",
        momento: "O debate, com as telas paradas.",
        professor:
          "A pergunta da lousa primeiro, sozinha. Só depois as outras. Ninguém precisa dizer o que escolheu.",
      },
      {
        tempo: "Aula 2 · 20–28",
        momento:
          "O ciclo: quatro blocos embaralhados que a turma monta na ordem causal.",
        professor:
          "Deixe montarem errado e discutirem. A ordem certa aparece depois; a conversa sobre por que “repasse” vem antes de “sem checagem” vale mais que o acerto.",
      },
      {
        tempo: "Aula 2 · 28–35",
        momento: "Meu percurso: a pergunta escrita, individual.",
        professor:
          "Silêncio de verdade nesses minutos. É o registro que vira portfólio, e ele não melhora com plateia.",
      },
    ],
  },

  debate: {
    aberturaNaLousa:
      "A mensagem tinha 200 encaminhamentos. Por que isso não a torna mais verdadeira?",
    tempo:
      "12 minutos, na Aula 2, com as telas paradas. A pergunta da lousa é a única que precisa ser feita exatamente assim: ela ataca de saída a confusão entre circular muito e ser verdade.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta:
          "Que dados vocês olharam antes de decidir? Quais deles diziam algo sobre quem escreveu aquilo primeiro?",
        porQue:
          "Separa o que é dado de envio do que é conteúdo. Muita gente decide pelo texto e nem abre os dados — e é bom que isso apareça sem acusação.",
      },
      {
        nivel: "retomada",
        pergunta:
          "A mensagem que tinha muitos saltos anônimos tinha autor? E a que tinha autor, quantos saltos tinha?",
        porQue:
          "O padrão da missão em uma frase: o que corre mais é justamente o que perdeu a assinatura pelo caminho.",
      },
      {
        nivel: "analise",
        pergunta:
          "Quem apagou a mensagem só para si mudou alguma coisa no mapa? Compare com quem encaminhou.",
        porQue:
          "O achado central. Os dois desenhos se parecem, porque nenhum dos dois interrompe a corrente — só um deles a acelera de propósito, mas o resultado no bairro é o mesmo.",
      },
      {
        nivel: "analise",
        pergunta:
          "Por que a opção que funcionou foi a que respondeu no grupo em vez de sair dele?",
        porQue:
          "Interromper exige aparecer. Sair, bloquear ou apagar tira a pessoa da cena e deixa a mensagem correndo.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "O que faz uma mensagem correr tão rápido? O que ela mexe na gente para conseguir isso?",
        porQue:
          "Traz o gatilho emocional para o centro — medo e urgência — e prepara a montagem do ciclo.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Se a escola tivesse publicado o laudo três horas antes, o boato teria corrido do mesmo jeito?",
        porQue:
          "Introduz a assimetria de velocidade: o desmentido chega sempre depois, e por isso quem recebe primeiro decide muito.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Qual foi a última mensagem que vocês encaminharam sem abrir os dados dela? O que teriam olhado se tivessem 10 segundos?",
        porQue:
          "Tira a lição da ficção. Dez segundos é o tempo real de quem recebe — a checagem tem de caber nele para existir.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "O que dizer para alguém da família que acabou de repassar algo assim, sem brigar?",
        porQue:
          "Fecha na conduta, e é a ponte com a EF06CO09: interromper sem hostilizar quem repassou de boa-fé.",
      },
    ],
  },

  observacao: {
    intro:
      "Enquanto a turma investiga, marque na lista de presença. Não é nota — é o que você vai citar no debate, sem dizer nomes.",
    marcas: [
      { letra: "D", texto: "Abriu os DADOS da mensagem por conta própria, antes de perguntar." },
      { letra: "S", texto: "Comparou os SALTOS de duas mensagens em voz alta." },
      { letra: "H", texto: "HESITOU visivelmente na decisão — releu antes de escolher." },
      { letra: "P", texto: "Perguntou se era verdade em vez de procurar (PISTA de que espera gabarito)." },
    ],
    nota:
      "A marca P não é defeito: é a criança fazendo o que a escola ensinou. Vale mencioná-la no debate como hábito, nunca como erro de alguém.",
  },

  mediacao: [
    {
      quando: "A turma inteira acerta em dois minutos.",
      faca:
        "Peça que expliquem COMO souberam. O caminho é o que interessa; quem acertou por sorte aparece aqui.",
      naoFaca: "Confirmar rápido e seguir. O acerto sem método não sobrevive à próxima mensagem.",
    },
    {
      quando: "Alguém pergunta “é verdade ou mentira?”.",
      faca: "Devolva: “o que os dados de envio já te contam?”. A pergunta é a tarefa.",
      naoFaca: "Responder. Um “sim” encerra a investigação de toda a turma que ouviu.",
    },
    {
      quando: "O debate vira caça a quem escolheu errado.",
      faca:
        "Traga o mapa de volta: “o desenho de quem apagou para si é quase igual ao de quem encaminhou — por quê?”. O objeto é a corrente, não a pessoa.",
      naoFaca: "Pedir para levantarem a mão quem escolheu A. Ninguém precisa se expor.",
    },
    {
      quando: "Alguém trava nos 90 segundos e fica visivelmente incomodado.",
      faca:
        "Diga, para a turma toda, que a tela não dá dica de propósito e que travar ali é a resposta honesta. A hesitação é o dado.",
      naoFaca: "Sugerir uma opção. A escolha sob incerteza é o que a missão mede.",
    },
    {
      quando: "A turma monta o ciclo errado e insiste.",
      faca:
        "Pergunte o que vem primeiro na vida real: a vontade de avisar ou o botão de encaminhar. A ordem sai da experiência deles.",
      naoFaca: "Corrigir de imediato. A discussão sobre a ordem vale mais que a ordem.",
    },
  ],

  depois: {
    sintese: [
      "“Muito encaminhada quer dizer muito encaminhada. Não quer dizer verdadeira — o aplicativo real diz exatamente isso no selo.”",
      "“O que corre mais rápido costuma ser o que perdeu a assinatura pelo caminho: muitos saltos, nenhum autor.”",
      "“Apagar só para mim não interrompe nada. A corrente segue sem mim — o mapa mostrou isso.”",
    ],
    registro:
      "O “Meu percurso”, dentro da missão: o gatilho emocional que cada um identificou e o que fará antes de encaminhar da próxima vez. Recolha três gestos diferentes em voz alta e escreva na lousa — vira o combinado da turma. Quando chegar um áudio alarmado de verdade em algum grupo da escola, aponte para a lousa: é quando esta aula prova que serviu.",
    produto: {
      titulo: "Entregável opcional, em duplas (mais uma aula)",
      itens: [
        "Escrevam a mensagem que mandariam no grupo para interromper a corrente — no máximo 3 linhas, citando a fonte e sem culpar quem repassou.",
        "Listem os três dados que vocês olhariam antes de encaminhar qualquer coisa, em ordem de rapidez.",
        "Desenhem como o bairro ficaria se metade da turma tivesse respondido com o laudo.",
      ],
    },
    rubrica: {
      nota:
        "A escolha da decisão não é nota. A missão mede o tempo de hesitação justamente porque escolher sob pressão é o que se está treinando — punir a primeira escolha desfaz o desenho. O que se avalia é o que a criança sustenta no debate e escreve no “Meu percurso”.",
      criterios: [
        {
          criterio: "Leitura dos dados de envio",
          emDesenvolvimento: "Decide pelo texto da mensagem, sem abrir os dados.",
          adequado: "Abre os dados e cita saltos ou autoria como razão da escolha.",
          avancado:
            "Compara duas mensagens pelos dados e nomeia o padrão: muitos saltos com autoria perdida.",
        },
        {
          criterio: "Volume × veracidade",
          emDesenvolvimento: "Trata “muito encaminhada” como sinal de que é verdade.",
          adequado: "Diz que o número de encaminhamentos não informa nada sobre ser verdade.",
          avancado:
            "Explica por que o que mais circula tende a ser o mais emocional, e não o mais checado.",
        },
        {
          criterio: "Efeito da própria escolha",
          emDesenvolvimento: "Acha que apagar para si já resolve.",
          adequado: "Reconhece no mapa que apagar para si não muda a corrente.",
          avancado:
            "Explica por que interromper exige aparecer no grupo, e o que isso custa para quem responde.",
        },
        {
          criterio: "Transferência",
          emDesenvolvimento: "Promete “não repassar nada”.",
          adequado: "Nomeia um gesto de checagem concreto para a próxima mensagem.",
          avancado:
            "Propõe um gesto que cabe em 10 segundos e explica por que aquele, e não outro.",
        },
      ],
    },
    desdobramentos: [
      "Língua Portuguesa: reescrever o aviso falso como uma nota oficial da escola — o que muda no texto quando alguém assina.",
      "Matemática: se cada pessoa encaminha para 3 grupos de 30, quantas telas em 4 rodadas? Compare com o alcance do laudo oficial.",
      "Ciências: por que a água da escola foi o assunto? Que teste real responderia a essa dúvida, e quanto tempo ele leva?",
      "História: um boato anterior à internet — como corria, em quanto tempo, e quem o desmentia.",
    ],
  },

  cuidados: [
    "Não peça que ninguém revele a escolha. O mapa mostra o padrão da turma sem precisar de nomes.",
    "Se surgir um boato real que circula na escola, acolha e não investigue ali: a missão é o ensaio, e o caso real tem gente envolvida.",
    "Evite “vocês caíram”. A missão foi desenhada para que a maioria escolha mal na primeira vez — é assim que o mapa fica interessante.",
  ],

  adaptacoes: [
    {
      contexto: "Turma com leitores em desenvolvimento.",
      comoAdaptar:
        "Faça a auditoria do primeiro grupo coletivamente, projetando: você abre o modal e a turma lê os números em voz alta. Os outros três ficam individuais.",
    },
    {
      contexto: "Uma aula de 50 minutos em vez de duas de 30.",
      comoAdaptar:
        "Rode a Aula 1 inteira, abra a Aula 2 na hora e faça o mapa e o debate. Deixe o ciclo e o Meu percurso para a aula seguinte — são os dois que menos dependem da tensão do momento.",
    },
    {
      contexto: "Estudante que já viu a missão em outra turma.",
      comoAdaptar:
        "Peça que observe e anote quantos colegas abrem os dados antes de decidir. Ele vira seu segundo par de olhos na folha de observação.",
    },
    {
      contexto: "Sem fones na sala.",
      comoAdaptar:
        "A transcrição está sempre na tela. Leia o áudio da crise em voz alta você mesmo, no tom apressado — a pressa é parte do que está sendo medido.",
    },
  ],

  duvidas: [
    {
      pergunta: "Qual é a mensagem falsa?",
      resposta:
        "A que combina muitos saltos anônimos com ausência de autor e carimbo antigo. Mas não diga: o catálogo não manda essa resposta para a tela justamente porque reconhecer o padrão é a habilidade avaliada.",
    },
    {
      pergunta: "Posso deixar a turma refazer a decisão?",
      resposta:
        "O botão que devolve à investigação existe e apaga o percurso da turma. Use antes de aplicar a missão de novo com a mesma turma, não no meio da aula — refazer com o mapa já visto mede outra coisa.",
    },
    {
      pergunta: "A opção B é a “certa”?",
      resposta:
        "É a que interrompe a corrente, e é assim que a pontuação a trata. Mas trate no debate como conduta, não como gabarito: o que se aprende é por que responder no grupo funciona e sair dele não.",
    },
    {
      pergunta: "Por que o tempo de decisão é guardado?",
      resposta:
        "Para distinguir impulso de reflexão no retrato da turma. Não vira nota e não aparece com nome no painel.",
    },
    {
      pergunta: "Dá para fazer sem a Aula 2?",
      resposta:
        "Dá, mas fica pela metade: a Aula 1 produz a decisão e a Aula 2 é onde ela vira aprendizado. Sem o mapa, a turma sai achando que a missão era adivinhar qual era a falsa.",
    },
  ],
};
