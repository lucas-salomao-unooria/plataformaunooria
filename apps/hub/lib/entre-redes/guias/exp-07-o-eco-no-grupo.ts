import type { GuiaDaAula } from "./tipos";

/**
 * Guia da aula de **O Eco no Grupo** (exp-07, 7º ano · Unidade 1).
 *
 * A única missão da trilha em DUAS aulas, e a única em que a professora aperta
 * botões durante a aula: abrir a Aula 2, congelar para o debate e liberar o
 * "Meu percurso". Sem o primeiro, a turma inteira fica na tela de pausa — é o
 * suporte nº 1 desta missão.
 *
 * O risco pedagógico específico daqui não é a criança não entender: é ela
 * entender e sair caçando culpado em casa. A tia que encaminha áudio no grupo
 * da família é a primeira pessoa em quem um estudante de 12 anos pensa, e a
 * missão não é sobre ela. Os cuidados desta página existem por causa disso.
 *
 * **O que ele NÃO guarda são as três respostas.** Elas vêm de
 * `GET /o-eco-no-grupo/professor/material` como BLOCO VIVO, ancorado ao Debate,
 * com o desfecho e as falas que o bairro devolve. É da reação que a turma fala
 * depois, e reação não cabe em paráfrase.
 */
export const GUIA_EXP_07: GuiaDaAula = {
  expId: "exp-07-o-eco-no-grupo",
  chamada:
    "Duas aulas de 30 a 35 min, com uma pausa entre elas. Você conduz por três botões no painel — e sem o primeiro deles a turma não passa da investigação.",

  avisos: [
    {
      tom: "warning",
      titulo: "Esta missão tem duas aulas, e é você que abre a segunda",
      texto:
        "No fim da Aula 1 a turma trava numa tela de pausa com o progresso salvo. Os três momentos — abrir a Aula 2, congelar para o debate e liberar o Meu percurso — ficam em Resultados da turma. Sem o primeiro, ninguém avança.",
    },
    {
      tom: "info",
      titulo: "Prepare a mídia uma vez, antes da primeira turma",
      texto:
        "As vozes e as fotos são geradas e ficam prontas no painel de resultados. Leva cerca de dois minutos e vale para todas as turmas da escola. Sem preparar, a missão roda igual: o áudio cai na transcrição (que está sempre na tela) e a foto na ilustração — mas a cena perde força.",
    },
  ],

  objetivos: [
    "Identificar, num conteúdo que circula, o que foi recortado — e distinguir recorte de mentira.",
    "Localizar a fonte completa de uma informação antes de repassá-la ou responder a ela.",
    "Explicar por que um selo de “encaminhada com frequência” fala de volume, e não de veracidade.",
    "Intervir num grupo com a informação verificada, sem hostilizar quem repassou.",
    "Nomear dois critérios próprios de checagem que caibam no tempo real de quem recebe uma mensagem.",
  ],

  bncc: [
    {
      codigo: "EF07CO08",
      texto: "Demonstrar empatia sobre opiniões divergentes na web.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "A escolha da resposta: a opção que funciona cita a matéria sem atacar ninguém, e a que briga e sai do grupo faz o bairro entrar em pânico na frente do estudante.",
    },
    {
      codigo: "EF69CO11",
      texto:
        "Apresentar conduta e linguagem apropriadas ao se comunicar em ambiente digital, considerando a ética e o respeito.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "As três respostas são três condutas, e cada uma tem consequência dentro da ficção — inclusive a possibilidade de apagar para todos e tentar de novo.",
    },
    {
      codigo: "EF07CO09",
      texto: "Reconhecer e debater sobre cyberbullying.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "O debate: o grupo em pânico procura um culpado, e é aí que se conversa sobre o que acontece com a pessoa apontada — inclusive quando ela repassou de boa-fé.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Libere a missão para a turma.",
        texto: "Minhas turmas → a turma → Missões. Sem isso a criança vê cadeado.",
      },
      {
        titulo: "Prepare a mídia da missão no painel.",
        texto:
          "Uma vez por escola, cerca de dois minutos, em Resultados da turma. Vale para todas as turmas — não é por aula.",
      },
      {
        titulo: "Confira os fones.",
        texto:
          "Há dois áudios no chat e um episódio de recapitulação na Aula 2. Sem fone, a transcrição na tela cobre tudo (ela está sempre visível, por acessibilidade), mas o áudio alarmado é metade da força da cena.",
      },
      {
        titulo: "Reserve as duas aulas seguidas na agenda.",
        texto:
          "O progresso fica salvo, mas a pausa foi desenhada para uma aula e a seguinte. Com uma semana no meio, o episódio de recapitulação vira a única lembrança que a turma tem — e ele foi feito para reforçar, não para substituir.",
      },
      {
        titulo: "Deixe o painel aberto durante as duas aulas.",
        texto:
          "É de lá que saem os três botões. Você vai apertá-los no meio da aula, com a turma olhando: não dá para procurar a tela na hora.",
      },
    ],
    pedagogico: [
      {
        titulo: "Não anuncie que é uma aula sobre fake news.",
        texto:
          "Aos 12 anos essa expressão já vem com resposta pronta (“não pode acreditar em tudo”), e a criança passa a missão inteira procurando a mentira em vez de investigar a história. Anuncie o enredo: “uma amiga te chama, o grupo do bairro está em pânico”.",
      },
      {
        titulo: "Decida antes como vai tratar o grupo da família.",
        texto:
          "Ele VAI aparecer no debate, e com nome de gente real. Prepare a frase que devolve a conversa ao mecanismo: “a sua tia recebeu o mesmo print que vocês receberam aqui. O que ela tinha para saber que faltava um pedaço?”",
      },
      {
        titulo: "Combine que ninguém conta a resposta.",
        texto:
          "Quem chega ao fim da Aula 1 descobre o parágrafo cortado. Se contar em voz alta, tira dos colegas a única coisa que a Aula 1 pede: achar sozinho.",
      },
      {
        titulo: "Guarde 13 minutos da Aula 2 para o debate.",
        texto:
          "Os três quadros de sistematização explicam os conceitos, mas nomear não é entender. É no debate que a turma liga o enquadramento parcial ao print que ela mesma quase repassou.",
      },
    ],
    naoDiga: [
      "“Uma dessas mensagens é falsa.” — nenhuma é. A foto é real, a moradora está com medo de verdade, e o print não inventou nada: cortou. É esse o assunto.",
      "“Prestem atenção no print.” — entrega a investigação inteira; a Aula 1 existe para que a criança chegue nele sozinha.",
      "“Amara vai te ajudar.” — ela fica em silêncio absoluto durante a investigação, de propósito. A criança que espera ajuda dela para de procurar.",
      "“Vocês vão ver o que acontece com quem repassa boato.” — transforma a missão em punição e a turma passa a responder o que o professor quer ouvir.",
    ],
  },

  roteiro: {
    total: "2 aulas de 30–35 min, com pausa entre elas",
    linhas: [
      {
        tempo: "Aula 1 · 0–5",
        momento: "Enquadramento.",
        professor:
          "“Uma amiga de vocês, a Amara, vai chamar no privado. O grupo do bairro dela está em pânico por causa de um print. Descubram de onde saiu essa história.” Nada além disso.",
      },
      {
        tempo: "Aula 1 · 5–8",
        momento: "Entrada: Amara chama no privado e manda o estudante olhar o grupo.",
        professor:
          "Lembre dos fones. Avise que a transcrição de cada áudio está na tela, para quem não tiver.",
      },
      {
        tempo: "Aula 1 · 8–25",
        momento:
          "Investigação do grupo “Comunidade Alerta”: o áudio da moradora, as mensagens indignadas, o print encaminhado. Tocando no print, a reportagem completa abre — e mostra o parágrafo que foi cortado.",
        professor:
          "Circule em silêncio. Quem perguntar “é verdade ou mentira?”, devolva: “o que dá para saber com o que está aí?”. Se alguém achar o parágrafo e comemorar alto, peça segredo — com cumplicidade, não com bronca.",
      },
      {
        tempo: "Aula 1 · 25–30",
        momento:
          "A missão para na tela de pausa, com o progresso salvo. A Aula 1 acaba aqui, de propósito.",
        professor:
          "Não abra a Aula 2 hoje, mesmo que sobre tempo. A pausa é o que faz a turma chegar junta à decisão — e a noite entre as aulas é onde a criança pensa no assunto sozinha.",
      },
      {
        tempo: "Aula 2 · 0–2",
        momento: "Retomada e liberação da Aula 2.",
        professor:
          "“Onde a gente parou?” Ouça duas respostas antes de apertar o botão — assim quem faltou entra na conversa.",
        botao: "Abrir a Aula 2",
      },
      {
        tempo: "Aula 2 · 2–5",
        momento: "O episódio de recapitulação (cerca de 2 min) recoloca a turma na história.",
        professor: "Silêncio. É curto.",
      },
      {
        tempo: "Aula 2 · 5–12",
        momento:
          "O menu com as 3 respostas. Quem cita a matéria vê o administrador fixar a mensagem no topo; quem responde no impulso vê o bairro entrar em pânico — e ganha um botão para apagar para todos e tentar de novo.",
        professor:
          "Não olhe por cima do ombro de ninguém neste momento. A escolha impulsiva precisa ser possível sem plateia: é o erro com reparo imediato que ensina, e ele não sobrevive à vergonha.",
      },
      {
        tempo: "Aula 2 · 12–15",
        momento:
          "Os três quadros de sistematização: enquadramento parcial, contexto omitido e rótulo de encaminhamento.",
        professor:
          "Congele as telas quando a maioria tiver respondido. A partir daqui a conversa é da sala, não do aparelho.",
        botao: "Congelar para o debate",
      },
      {
        tempo: "Aula 2 · 15–28",
        momento: "Debate com a turma inteira.",
        professor:
          "Comece pela foto, não pela mensagem: “a foto do print era falsa?”. A resposta é não, e é dela que sai a aula toda.",
      },
      {
        tempo: "Aula 2 · 28–35",
        momento:
          "“Meu percurso”: cada estudante marca 2 critérios de checagem e escreve uma justificativa.",
        professor:
          "Libere e deixe escrever em silêncio. Recolha em voz alta três critérios diferentes e escreva na lousa — eles viram o combinado da turma.",
        botao: "Liberar o Meu percurso",
      },
    ],
    nota: "Os três botões são um caminho só, sem volta: abrir a Aula 2, congelar, liberar. Se a turma andar mais rápido que o previsto, adiante — mas não congele antes de a maioria ter respondido, ou o pico da missão (a cascata de reações no grupo) acontece com metade da sala olhando para uma tela parada.",
  },

  debate: {
    aberturaNaLousa: "A foto do print era verdadeira. Então por que ela enganou o bairro inteiro?",
    tempo:
      "13 minutos, na Aula 2, com as telas congeladas. A pergunta da lousa é a única que precisa ser feita exatamente assim: ela recusa de saída a explicação fácil (“era mentira”) e obriga a turma a procurar outra coisa.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "O que a moradora dizia no áudio? Ela mentiu?",
        porQue:
          "Não mentiu: ela estava com medo, e o medo dela era real. Instalar isso cedo evita que o debate vire caça ao culpado — que é o desfecho errado mais provável desta missão.",
      },
      {
        nivel: "retomada",
        pergunta:
          "O que aparecia no print? E o que aparecia na foto inteira, na matéria completa?",
        porQue:
          "A mesma cena. O print mostra só a viatura; a foto inteira mostra a feira acontecendo em paz ao lado. Deixe a turma dizer a diferença antes de você nomeá-la.",
      },
      {
        nivel: "analise",
        pergunta: "Quem cortou a foto tinha que mentir para enganar?",
        porQue:
          "É o coração da missão. Recortar é uma escolha sobre o que mostrar, e ela funciona melhor que a mentira justamente porque cada pedaço é verdadeiro e checável.",
      },
      {
        nivel: "analise",
        pergunta:
          "O parágrafo que sumiu dizia que o evento tinha alvará e que a polícia estava organizando o trânsito. Por que justo esse pedaço?",
        porQue:
          "Leva a turma a perceber intenção sem precisar de teoria da conspiração: o pedaço retirado é exatamente o que desmontaria a história. Recorte não é descuido.",
      },
      {
        nivel: "analise",
        pergunta:
          "O selo “Encaminhada com frequência” fez vocês confiarem mais ou menos na mensagem? Por quê?",
        porQue:
          "O selo diz volume de repasse, e o aplicativo real diz a mesma coisa. Muita gente encaminhando é sinal de que a mensagem é boa de encaminhar — não de que é verdadeira.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "De quem é a responsabilidade por um boato: de quem inventou ou de quem repassou?",
        porQue:
          "A pergunta que abre a conversa sobre empatia (EF07CO08). Não force consenso: o valor está em a turma perceber que quem repassa quase sempre está de boa-fé, e que isso não anula o estrago.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "O que muda quando a resposta certa chega ao grupo de um jeito agressivo?",
        porQue:
          "Quem escolheu brigar e sair viu o bairro entrar em pânico. Ligue a consequência à conduta: estar certo não é suficiente para consertar um grupo.",
      },
      {
        nivel: "transferencia",
        pergunta: "Qual foi a última coisa que você encaminhou sem ter aberto o link?",
        porQue:
          "Faça essa pergunta respondendo primeiro, com um exemplo seu. Adulto faz isso o tempo todo, e admitir muda a temperatura da sala inteira.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Chega um print no grupo da sua família agora. O que você faz nos próximos 30 segundos?",
        porQue:
          "Trinta segundos é o tempo real que a pessoa tem. Recuse respostas que não caibam nele (“pesquisar em três sites”) e peça o gesto possível: procurar a matéria inteira, olhar a data, perguntar de onde veio.",
      },
    ],
  },

  observacao: {
    intro:
      "Marque UMA letra por estudante durante o debate. A tela já registra quem abriu a matéria completa antes de responder; o que ela não registra é como a criança trata quem errou — e é isso que esta missão avalia.",
    marcas: [
      { letra: "F", texto: "usou o conteúdo da matéria completa para sustentar o que disse" },
      { letra: "R", texto: "reconheceu o recorte: disse que a foto era verdadeira E enganava" },
      { letra: "E", texto: "falou de quem repassou sem hostilizar — nomeou o engano, não a pessoa" },
      { letra: "N", texto: "não participou" },
    ],
    nota:
      "O E é o objetivo principal desta missão (EF07CO08) e o mais fácil de não ver: ele aparece em meia frase, do tipo “ela não sabia”. Vale marcar na hora, porque some do registro escrito.",
  },

  mediacao: [
    {
      quando: "A turma quer descobrir quem inventou o boato.",
      faca: "A missão não diz, e isso é resposta: na vida também quase nunca se sabe. Redirecione: “vamos supor que a gente nunca descubra. O que dava para fazer mesmo assim?”",
      naoFaca:
        "Deixar a caçada correr “só um pouquinho”. Ela consome o tempo do debate e termina em nada, porque não há nada para achar.",
    },
    {
      quando: "Alguém diz que a moradora do áudio mentiu.",
      faca: "Volte ao áudio: o que ela afirmou de falso? Nada. Ela contou o que viu, com medo, sem o pedaço que faltava — que é exatamente o que aconteceu com a própria turma na Aula 1.",
    },
    {
      quando: "A conversa vira “minha tia vive fazendo isso”.",
      faca: "Acolha e mova para o mecanismo na mesma frase: “e o que a sua tia tinha, na tela dela, para saber que faltava um pedaço?”. A resposta é “nada” — e aí a conversa deixa de ser sobre a tia.",
      naoFaca:
        "Deixar a sala rir da família de alguém. Aos 12 anos isso vira apelido, e o estudante que contou não conta mais nada.",
    },
    {
      quando: "Um estudante escolheu brigar e sair do grupo.",
      faca: "Não comente com nome. No debate, pergunte à turma inteira o que acontece quando a resposta certa chega gritando — e deixe que ele reconheça a própria escolha sozinho, se quiser.",
    },
    {
      quando: "Ninguém abriu a matéria completa antes de responder.",
      faca: "É o melhor debate possível, e você tem o dado no painel. Diga o número sem nomes: “nenhum de vocês abriu a matéria antes de decidir. O que a gente faz com isso?”",
    },
    {
      quando: "A turma conclui que “não dá para acreditar em nada que chega em grupo”.",
      faca: "Segure o pêndulo com um contraexemplo da própria missão: a matéria completa existia, era acessível, e bastava um toque. O problema não era falta de informação — era ninguém ter ido buscá-la.",
    },
    {
      quando: "Alguém pergunta qual era a resposta certa.",
      faca: "Diga que a missão avalia o percurso, não a letra — e devolva: “o que o grupo precisava para se acalmar?”. A turma responde “a matéria”, e responde sozinha.",
      naoFaca:
        "Confirmar “era a B”. A letra não existe no aparelho de propósito: a tela nunca compara a escolha com um gabarito, e transformar a aula num acerto de alternativa desfaz isso.",
    },
  ],

  depois: {
    sintese: [
      "“A foto era verdadeira. A matéria era verdadeira. O que enganou o bairro foi o pedaço que ficou de fora.”",
      "“Encaminhada com frequência quer dizer que muita gente repassou. Não quer dizer que é verdade — o aplicativo real diz exatamente a mesma coisa.”",
      "“Quem repassou não estava mentindo, estava com medo. Corrigir a informação sem atacar a pessoa é o que faz o grupo se acalmar.”",
    ],
    registro:
      "O “Meu percurso”, dentro da missão: dois critérios de checagem marcados e uma justificativa escrita. Recolha três critérios diferentes em voz alta e escreva na lousa — vira o combinado da turma. Na semana seguinte, quando chegar um print de verdade em algum grupo da escola, aponte para a lousa: é o momento em que essa aula prova que serviu.",
    produto: {
      titulo: "Entregável opcional, em duplas (mais uma aula)",
      itens: [
        "Reescrevam a mensagem que vocês mandariam no grupo — em no máximo 3 linhas, citando a matéria e sem culpar ninguém.",
        "Encontrem, num grupo real de vocês (com autorização de quem mandou), uma mensagem encaminhada. Que pedaço dela dá para checar em 30 segundos?",
        "Escrevam as duas perguntas que vocês fariam para si mesmos antes de encaminhar qualquer coisa.",
      ],
    },
    rubrica: {
      nota: "A escolha da resposta não é nota. A missão dá, de propósito, a chance de apagar para todos e tentar de novo — punir a primeira escolha desfaz o desenho. O que se avalia é o que a criança sustenta no debate e escreve no “Meu percurso”.",
      criterios: [
        {
          criterio: "Reconhecimento do recorte",
          emDesenvolvimento: "Diz que o print era mentira.",
          adequado:
            "Diz que o print era verdadeiro e ainda assim enganava, porque faltava um pedaço.",
          avancado:
            "Aponta QUAL pedaço faltava e por que justamente aquele — percebe que o recorte foi escolhido.",
        },
        {
          criterio: "Busca da fonte",
          emDesenvolvimento: "Confia ou desconfia sem procurar nada.",
          adequado: "Diz que foi (ou iria) atrás da matéria completa antes de responder.",
          avancado:
            "Propõe um jeito de checar que cabe em 30 segundos e explica por que aquele.",
        },
        {
          criterio: "Empatia com quem repassou",
          emDesenvolvimento: "Culpa quem repassou (“burrice”, “tinha que ver”).",
          adequado: "Reconhece que quem repassou estava de boa-fé e mesmo assim causou estrago.",
          avancado:
            "Formula uma correção que o outro conseguiria aceitar — corrige a informação sem atacar a pessoa.",
        },
        {
          criterio: "Critérios próprios",
          emDesenvolvimento: "Critério genérico (“ver se é verdade”).",
          adequado: "Dois critérios aplicáveis: procurar a fonte, olhar a data, ver quem publicou.",
          avancado:
            "Critérios aplicáveis e a situação em que cada um serve — sabe que o critério muda conforme o que chega.",
        },
      ],
    },
    desdobramentos: [
      "Língua Portuguesa: comparar a manchete, a legenda da foto e o parágrafo cortado. É análise de enquadramento com material que a turma já viveu — e cabe direto no trabalho com gêneros jornalísticos.",
      "Arte: recortar uma foto de jornal de três jeitos diferentes, cada um contando uma história. A turma sente o enquadramento fazendo, não ouvindo.",
      "História: a mesma operação em fonte histórica — a fotografia oficial que mostra a multidão e esconde o cordão de isolamento.",
      "Convivência / Projeto de vida: escrever o combinado do grupo da turma no WhatsApp real (se houver). É o único desdobramento que muda o comportamento na mesma semana.",
      "EF07CO09: se o debate levar ao que acontece com a pessoa apontada como culpada, você já está no conteúdo de cyberbullying — não desvie, aprofunde.",
    ],
  },

  cuidados: [
    "Não deixe a turma sair caçando quem repassa boato na vida real. É o risco desta missão: o alvo mais próximo de um estudante de 12 anos é a própria família. Toda vez que um nome real aparecer, devolva a conversa ao mecanismo.",
    "Nunca exponha quem escolheu a resposta impulsiva. A missão dá o apagar-para-todos justamente para que o erro tenha reparo — e reparo não convive com plateia.",
    "Em nenhum momento a tela diz que alguém errou, e você também não deve dizer. O bairro entra em pânico dentro da ficção: a consequência é da história, não da criança.",
    "Deixe explícito no fechamento que as vozes e as fotos foram geradas por IA para a atividade, e que o bairro, a matéria e as pessoas não existem.",
    "O clone é escuro e não tem tema claro — é o que o design system publica. Não é preferência do estudante nem defeito.",
    "Se algum estudante contar que já foi alvo de um boato, pare a aula e trate isso primeiro. É mais importante que o resto do roteiro, e é a única situação em que a missão sai de cena.",
  ],

  adaptacoes: [
    {
      contexto: "Você só tem uma aula, não duas.",
      comoAdaptar:
        "Rode a Aula 1 inteira (investigação) e abra a Aula 2 na sequência, cortando o episódio de recapitulação e reduzindo o debate para 8 minutos. O que não se corta: a descoberta do parágrafo cortado e a pergunta da lousa.",
    },
    {
      contexto: "Um estudante faltou à Aula 1.",
      comoAdaptar:
        "O progresso é dele e fica salvo, então ele entra na Aula 2 sem ter investigado. Emparelhe-o com um colega durante o episódio de recapitulação e peça que o colega conte o que achou — contar é a melhor revisão que existe.",
    },
    {
      contexto: "Não há fones.",
      comoAdaptar:
        "A transcrição de cada áudio está sempre na tela, então nada se perde de conteúdo. Se puder, toque o áudio da moradora uma vez na caixa de som da sala, para todos ao mesmo tempo: é o tom da voz que faz o pânico do grupo ser crível.",
    },
    {
      contexto: "Turma agitada, difícil de parar para o debate.",
      comoAdaptar:
        "Use o congelamento a seu favor: aperte o botão e espere em silêncio. Com as telas travadas na mesma imagem, a sala se volta para você sozinha em cerca de 30 segundos — bem mais rápido que pedir silêncio.",
    },
    {
      contexto: "Turma com leitura em desenvolvimento.",
      comoAdaptar:
        "A reportagem completa é o texto mais longo da missão, e é justamente o que precisa ser lido. Leia o parágrafo cortado em voz alta depois que todos tiverem chegado nele — antes disso, não.",
    },
  ],

  duvidas: [
    {
      pergunta: "A turma travou numa tela de pausa e não avança.",
      resposta:
        "É o fim da Aula 1, e o desbloqueio é seu: “Abrir a Aula 2”, em Resultados da turma. É o suporte nº 1 desta missão.",
    },
    {
      pergunta: "Os áudios não tocam e as fotos são desenhos.",
      resposta:
        "A mídia não foi preparada. Vá ao painel de resultados e prepare — dois minutos, uma vez por escola. A missão funciona sem, com a transcrição e a ilustração no lugar.",
    },
    {
      pergunta: "Um estudante respondeu errado e quer desfazer.",
      resposta:
        "Quem responde no impulso ganha um botão para apagar para todos e tentar de novo, dentro da própria ficção. Não é preciso fazer nada pelo painel.",
    },
    {
      pergunta: "Dá para saber quem escolheu cada resposta?",
      resposta:
        "O painel mostra a distribuição das respostas da turma e quem abriu a matéria completa antes de responder. Use para conduzir o debate, não para cobrar ninguém — a lista não tem coluna de pontos de propósito.",
    },
    {
      pergunta: "A tela do estudante está escura. Dá para clarear?",
      resposta:
        "Não, e não é defeito: a seção do design system que veste esta missão publica só o tema escuro. O contraste passa o critério de acessibilidade com folga.",
    },
    {
      pergunta: "Preciso preparar a mídia para cada turma?",
      resposta:
        "Não. É uma vez por escola e vale para todas as turmas, inclusive as do ano que vem.",
    },
  ],
};
