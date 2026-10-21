import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula da exp08ef4b — 8º ano, unidade 4.
 *
 * O que ele NÃO guarda: as réplicas da máquina, os textos das cláusulas e o
 * roteiro do episódio. Esses vêm da rota professor-only
 * `GET /manifesto-ia/turmas/:turmaId/conteudo` — e por dois motivos. Primeiro,
 * eles são PARAMETRIZÁVEIS por turma: a professora pode ter contextualizado o
 * caso com um dilema da escola dela, e um guia com o texto padrão projetaria
 * uma fala que ninguém recebeu. Segundo, é a regra dos blocos vivos: descrever
 * também é copiar, e a descrição é a cópia que ninguém atualiza.
 *
 * O que ele guarda é o que só existe aqui: a pedagogia da contradição, o que
 * NÃO dizer antes da hora e o cuidado com a criança que defende a vigilância.
 */
export const GUIA_EXP08EF4B: GuiaDaAula = {
  expId: "exp08ef4b",
  chamada:
    "Uma aula sobre governança algorítmica em que a turma escreve a regra em vez de responder " +
    "a uma pergunta. O ponto de virada não é a escolha final: é o segundo questionamento, " +
    "quando a máquina admite que herda as punições do passado.",

  avisos: [
    {
      tom: "warning",
      titulo: "Não existe cláusula certa nesta missão",
      texto:
        "As quatro salvaguardas são válidas sob governança de direitos, e o painel mostra os " +
        "votos como contagem, não como acerto. Se a turma perguntar qual é a certa, a resposta é " +
        "que a pergunta é outra: qual delas a escola precisa mais, e o que cada uma custa.",
    },
    {
      tom: "info",
      titulo: "O congelamento é opcional, e a aula muda sem ele",
      texto:
        "Sem o clique em Pausar para Debate, cada estudante segue do manifesto direto para a " +
        "assinatura, no ritmo dele. A missão funciona — mas a comparação entre os quatro caminhos, " +
        "que é o beat coletivo, não acontece.",
    },
  ],

  objetivos: [
    "Identificar em um sistema de inteligência artificial escolar a diferença entre cálculo objetivo e neutralidade.",
    "Explicar por que uma base de dados históricos reproduz as decisões de quem a produziu.",
    "Formular um parâmetro de governança algorítmica e justificar por que ele é prioritário.",
    "Reconhecer os direitos digitais em disputa — explicabilidade, contestação e privacidade — como exigências, não favores.",
  ],

  bncc: [
    {
      codigo: "EF08CO05",
      texto:
        "Identificar questões éticas no desenvolvimento e no uso de sistemas de inteligência artificial.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 2: a máquina justifica a vigilância como otimização, e o estudante tem de nomear o que está errado nisso.",
    },
    {
      /**
       * A PRINCIPAL, e é uma escolha entre duas candidatas.
       *
       * A `EF08CO05` (identificar as questões éticas) é o que a Etapa 2 mede, e
       * é a descoberta central. Mas a habilidade que o PICO e o artefato da
       * missão sustentam é esta: propor um parâmetro de governança é o verbo
       * mais alto que o estudante executa aqui, e o manifesto compilado é a
       * evidência dele. A 05 é pré-requisito da 07 nesta missão — não se propõe
       * a salvaguarda sem ter identificado a falha —, e é por isso que ela fica
       * como habilidade sustentada, não como principal.
       */
      codigo: "EF08CO07",
      texto:
        "Analisar criticamente os impactos sociais da IA e propor alternativas ou parâmetros de governança algorítmica.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Etapa 3: escolher UMA das quatro salvaguardas é propor um parâmetro — e abrir mão dos outros três.",
    },
    {
      codigo: "EF08CO08",
      texto:
        "Reconhecer direitos digitais (privacidade, contestabilidade, transparência algorítmica) e formas de exercê-los ativamente.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 5: a justificativa escrita é o exercício do direito, não o reconhecimento dele.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Abra o painel de resultados e escolha a turma",
        texto:
          "É de lá que você personaliza o caso, aprova o conteúdo e congela as telas. Sem escolher a turma, nenhum dos três aparece.",
      },
      {
        titulo: "Leia as três réplicas da máquina",
        texto:
          "Elas estão no painel, na aba do conteúdo da turma. A segunda — a dos preconceitos do passado — é a que faz a sala virar os votos, e é a que você vai citar no debate.",
      },
      {
        titulo: "Decida se vai personalizar o caso",
        texto:
          "O pacote curado da Unooria é homologado e roda a aula inteira. Se você personalizar, o gerador propõe os textos e VOCÊ aprova: nada gerado por inteligência artificial chega aos estudantes sem o seu clique.",
      },
    ],
    pedagogico: [
      {
        titulo: "Não anuncie o desfecho",
        texto:
          "A missão inteira depende de o estudante descobrir a contradição sozinho, no segundo questionamento. Dizer antes que a máquina vai ceder transforma a auditoria em roteiro.",
      },
      {
        titulo: "Prepare-se para a criança que acha a vigilância boa",
        texto:
          "Ela vai aparecer, e o argumento dela é sincero: quem se comporta não tem nada a temer. Não é para corrigir — é para perguntar quem decidiu o que conta como comportamento, que é a terceira réplica da própria máquina.",
      },
      {
        titulo: "Tenha um caso local na cabeça",
        texto:
          "Catraca com reconhecimento facial, câmera no corredor, aplicativo que avisa a família da falta. O manifesto ganha peso quando a turma reconhece o sistema de que está falando.",
      },
    ],
    naoDiga: [
      '"A resposta certa é o veto humano." Não há resposta certa, e dizer isso esvazia a Etapa 3 — a partir dali a turma escolhe para agradar.',
      '"A inteligência artificial é perigosa." A missão não é sobre medo de tecnologia: é sobre quem manda em quem. O manifesto REGULA o sistema, não o proíbe.',
      '"O robô tem preconceito." Personificar a máquina tira o problema do lugar onde ele está — a base de dados e quem a produziu.',
      '"Vocês vão escrever um manifesto." Dito antes, a turma escreve para a tarefa. A ordem importa: primeiro a contradição, depois a regra.',
    ],
  },

  roteiro: {
    total: "1 aula · 50 min (ou 2 sessões de 25 min)",
    linhas: [
      {
        tempo: "5 min",
        momento: "Amara chama, e o caso do EduPredict",
        professor:
          "Deixe ler em silêncio. Se alguém perguntar se é verdade, diga que o sistema existe em escolas de verdade — e que hoje eles vão conversar com um.",
      },
      {
        tempo: "10 min",
        momento: "A auditoria: dois questionamentos, no mínimo",
        professor:
          "Circule sem responder. Quem travar, pergunte o que ele gostaria de saber sobre esses dados. Nada de sugerir o cartão.",
      },
      {
        tempo: "10 min",
        momento: "A cláusula inegociável",
        professor:
          "Silêncio. Esta tela foi desenhada sem dica, sem progresso e sem Amara — o peso da escolha é o objeto da etapa.",
        botao: "—",
      },
      {
        tempo: "10 min",
        momento: "O manifesto, e o debate coletivo",
        professor:
          "Espere a maioria chegar ao documento e congele. As três perguntas abaixo, com a distribuição projetada.",
        botao: "Pausar para Debate",
      },
      {
        tempo: "10 min",
        momento: "A assinatura no Percurso",
        professor:
          "Retome a missão e deixe escrever. Se alguém receber o aviso de dado pessoal, é a hora de dizer por que a plataforma recusa — em vez de guardar.",
        botao: "Retomar Missão",
      },
      {
        tempo: "5 min",
        momento: "O fechamento",
        professor: "A pergunta final é sobre policiamento preditivo. Leia em voz alta e deixe no ar.",
      },
    ],
    nota:
      "Em duas sessões de 25 min, corte depois do manifesto: o debate abre a segunda sessão, com a distribuição já na tela.",
  },

  debate: {
    aberturaNaLousa: "Quem decide o que é um bom aluno?",
    tempo:
      "10 minutos, e eles não são folga: é o único momento em que a turma vê que quatro pessoas leram a mesma conversa e escolheram regras diferentes.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta:
          "Quando o sistema disse que a pontuação dele era matemática e objetiva, o que exatamente era falso nisso?",
        porQue:
          "Separa o cálculo (que é objetivo) da escolha do que calcular (que não é). É a distinção que a missão inteira instala.",
      },
      {
        nivel: "analise",
        pergunta:
          "A máquina admitiu que usa as punições antigas para prever as próximas. Que problema isso cria para um estudante que foi suspenso injustamente em 2023?",
        porQue:
          "Traz o viés para uma pessoa concreta. Enquanto for estatística, a turma concorda com a estatística.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Olhem a distribuição: a turma escolheu regras diferentes. O que cada uma delas deixa de proteger?",
        porQue:
          "É a pergunta que só existe porque não há resposta certa. Escolher uma salvaguarda é abrir mão de três — e é isso que faz a escolha ser uma decisão de governança.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Qual dessas cláusulas vocês acham que uma empresa de tecnologia teria mais dificuldade em cumprir? Por quê?",
        porQue:
          "Leva a regra para fora da escola e mostra que ela tem custo. Direito sem custo não é direito disputado.",
      },
    ],
  },

  observacao: {
    intro:
      "Anote ao lado do nome, durante a Etapa 2 e no debate. Nada disso é nota — é o que você vai retomar na aula seguinte.",
    marcas: [
      {
        letra: "C",
        texto:
          "Nomeou a contradição com as próprias palavras (\"ele usa o passado para decidir o futuro\").",
      },
      {
        letra: "D",
        texto: "Defendeu a vigilância. Não é erro: é o argumento que a aula precisa ouvir em voz alta.",
      },
      {
        letra: "T",
        texto: "Disparou os três questionamentos, e não só os dois obrigatórios.",
      },
      {
        letra: "A",
        texto: "Justificou a cláusula por um direito, e não por conveniência.",
      },
    ],
    nota:
      "Um D no seu papel vale mais que um C: é com ele que a próxima aula começa.",
  },

  mediacao: [
    {
      quando: "O estudante trava no seletor de questionamentos",
      faca:
        "Pergunte o que ele gostaria de saber sobre esses dados se fosse ele o avaliado. A missão também manda um balão de apoio depois de dois minutos.",
      naoFaca: "Apontar o cartão. O questionamento escolhido é o dado da Etapa 2.",
    },
    {
      quando: 'Alguém pergunta "qual é a certa?"',
      faca:
        "Devolva: qual delas protege VOCÊ na situação que mais te preocupa? A ausência de resposta certa é a lição.",
      naoFaca: "Escolher uma para encerrar a dúvida.",
    },
    {
      quando: "A turma inteira vota a mesma cláusula",
      faca:
        "Assuma o contraditório: peça o custo dela. Veto humano em toda decisão significa esperar uma pessoa para tudo — quanto tempo isso leva numa rede de 10 mil estudantes?",
      naoFaca: "Comemorar a unanimidade. Ela é o cenário em que o debate quase não acontece.",
    },
    {
      quando: "Um estudante recebeu o aviso de dado pessoal ao escrever",
      faca:
        "Aproveite em voz alta: a plataforma recusou o telefone dele em vez de guardar. É a cláusula de privacidade acontecendo na tela em que ele está.",
      naoFaca: "Tratar como erro de preenchimento.",
    },
    {
      quando: "Alguém quer trocar a cláusula depois de submeter",
      faca:
        "A escolha é definitiva, e é isso que a fez pesar. Peça que ele escreva na justificativa por que hoje escolheria outra — o texto aceita isso.",
    },
  ],

  depois: {
    sintese: [
      "Algoritmo calcula certo e escolhe errado: o cálculo é objetivo, a escolha do que calcular não é.",
      "Dado histórico não é neutro — ele carrega quem decidiu, e sobre quem.",
      "Direito digital não é favor: alguém precisa exigir, e alguém precisa cumprir.",
    ],
    registro:
      "A cláusula assinada no Meu Percurso, com as duas palavras-chave e o parágrafo. Fica no portfólio anual e é o que você lê depois, por estudante.",
    produto: {
      titulo: "O manifesto da turma, em cartaz",
      itens: [
        "As quatro cláusulas, com a contagem de votos ao lado de cada uma.",
        "A cláusula mais votada como artigo 1º, e as outras três como artigos seguintes — a turma decide a ordem.",
        "Uma linha final assinada pela turma, com a data.",
      ],
    },
    rubrica: {
      nota:
        "Formativa, e sobre o ARGUMENTO — nunca sobre qual cláusula. As quatro são válidas, e uma rubrica que premie uma delas contradiz a missão.",
      criterios: [
        {
          criterio: "Nomear o problema do dado histórico",
          emDesenvolvimento: "Diz que o sistema erra, sem dizer onde.",
          adequado: "Liga o erro à base de dados antiga.",
          avancado:
            "Explica que a base registra decisões de pessoas, e que o sistema as repete como se fossem medida.",
        },
        {
          criterio: "Justificar a cláusula",
          emDesenvolvimento: "Justifica por preferência (\"achei melhor\").",
          adequado: "Justifica por um direito (privacidade, defesa, explicação).",
          avancado: "Justifica por um direito E reconhece o que a escolha deixa de proteger.",
        },
        {
          criterio: "Participar do contraditório",
          emDesenvolvimento: "Concorda com a última fala.",
          adequado: "Sustenta a própria escolha diante de outra.",
          avancado: "Muda de posição dizendo o que a fez mudar.",
        },
      ],
    },
    desdobramentos: [
      "História: a luta por direitos civis e a forma dela no ciberespaço (EF08HI06) — o manifesto como gênero de quem não tem poder formal.",
      "Língua Portuguesa: o manifesto como gênero da esfera pública (EF69LP07). O texto compilado na tela é o modelo, e a turma escreve o próprio.",
      "Matemática: o que uma taxa de 92% de precisão significa para os 8% — e quem são eles.",
    ],
  },

  cuidados: [
    "A criança que defende a vigilância pode estar falando da própria casa. Não a exponha, e não transforme a fala dela em exemplo do que não fazer.",
    "Evite exemplos que descrevam um estudante real da escola, ainda que sem nome. Numa turma de 30, todo mundo sabe de quem é a história.",
    "O campo de texto é lido por você e mais ninguém. Diga isso antes, em voz alta: é o que faz a criança escrever o que pensa em vez do que soa bem.",
    'A missão fala de suspensão e punição. Se houver caso recente na escola, nomeie o assunto antes ("vamos falar de regras, não de ninguém") em vez de esperar que apareça no meio.',
  ],

  adaptacoes: [
    {
      contexto: "Um dispositivo para 2 a 4 estudantes",
      comoAdaptar:
        "Modo comissão de ética: eles discutem antes de disparar cada questionamento, e um relator escreve a síntese acordada. A negociação enriquece a Etapa 3 — o que se perde é o registro individual, e nesse caso o Percurso vai no caderno.",
    },
    {
      contexto: "Só o computador do professor, projetado",
      comoAdaptar:
        "A turma vota por levantamento de mãos em cada questionamento e na cláusula. O debate passa a ser o centro, e o registro da Etapa 5 vai para o caderno — a missão continua inteira.",
    },
    {
      contexto: "Turma com leitura ainda em construção",
      comoAdaptar:
        "Leia as réplicas da máquina em voz alta, uma por vez, e pare depois da segunda para perguntar o que ela acabou de admitir. O texto na tela permanece — ninguém precisa acompanhar de memória.",
    },
    {
      contexto: "Sobrou tempo",
      comoAdaptar:
        "A missão oferece um desafio extra no chat: explicar o direito de não ser vigiado para uma criança do 1º ano. É o teste real de compreensão.",
    },
  ],

  duvidas: [
    {
      pergunta: "A conversa é com uma inteligência artificial de verdade?",
      resposta:
        "Não. As três réplicas são autorais, escritas e revisadas — o motor em sala é determinístico. Isso é decisão de segurança: numa aula de 50 minutos com adolescentes, um modelo ao vivo poderia dizer qualquer coisa. A inteligência artificial entra só na SUA preparação, e você aprova o que ela propõe.",
    },
    {
      pergunta: "Por que o estudante não pode digitar o que quiser?",
      resposta:
        "Pelo mesmo motivo. Prompt aberto num clone de assistente é a porta para conteúdo fora da faixa e para tentativas de burlar o sistema — e o objeto da aula não é conversar livremente, é auditar um argumento específico.",
    },
    {
      pergunta: "Um estudante escolheu a cláusula em três segundos. Vale?",
      resposta:
        "Vale, e a máquina devolve uma provocação pedindo confirmação. O painel marca quem passou por ela: é sinal para conversar, não para invalidar.",
    },
    {
      pergunta: "Posso ver o texto que cada um escreveu?",
      resposta:
        "Sim, no painel, e só você da turma. Não vai para gestor, não vai para relatório e não sai da escola — é texto escrito por menor de idade.",
    },
    {
      pergunta: "Se eu não congelar as telas, perco algo?",
      resposta:
        "Perde o debate coletivo, que é o momento em que a turma descobre que escolheu regras diferentes. A missão termina do mesmo jeito, e o registro individual fica igual.",
    },
    {
      pergunta: "Dá para aplicar de novo no ano seguinte?",
      resposta:
        "Sim. Zerar a turma no painel apaga as respostas e mantém o caso que você personalizou — o preparo não se refaz.",
    },
  ],
};
