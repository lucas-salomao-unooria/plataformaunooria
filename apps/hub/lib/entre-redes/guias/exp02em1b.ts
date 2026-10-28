import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula de O EFEITO AMPLIFICADOR (exp02em1b, 2ª série do EM, unidade
 * 1, ADR-181; 2.1.0, ADR-191). Escrito a partir do PRD 2.1.0 e do anexo do
 * one-pager aprovado (§9 — os quatro tempos da gestão em sala, o roteiro do
 * debate e "a mesma missão em três aulas"; §11 — o aviso do podcast), com as
 * orientações do PO: sem a etapa de transferência (o diário do Refletir), sem
 * Canal B e sem IA durante a aula.
 *
 * As três últimas perguntas do debate são o TC-22 a TC-24, LITERAIS — as mesmas
 * do roteiro do painel (`ROTEIRO_DO_DEBATE` da api); `efeito-amplificador-tipos.test.ts`
 * confere as duas cópias. A primeira é o pedido da revelação (§9: as chamadas
 * opostas leem os comentários), em forma de pergunta.
 *
 * O que vem por BLOCO VIVO (`guia/material-do-efeito.tsx`, de `GET
 * /efeito-amplificador/professor/material`): o pacote padrão com o gabarito
 * (a pauta, os três nós e a correção de cada um, os comentários e a categoria
 * de cada um), os indicadores do Explicar e o critério de cada nível. Tudo
 * isso tem fonte na api, e uma cópia aqui seria a que diverge.
 */
export const GUIA_EXP02EM1B: GuiaDaAula = {
  expId: "exp02em1b",
  chamada:
    "Uma aula em que a turma descobre que o alcance de um post não depende do cuidado com o texto. Cada " +
    "estudante audita o rascunho de uma IA e publica com responsabilidade — e mesmo assim a rede pinça uma " +
    "frase e entrega de madrugada, porque o que ela otimiza é tempo de tela, não verdade nem sono.",

  avisos: [
    {
      tom: "error",
      titulo: "Sem uma atividade sua em andamento, a missão não abre para ninguém",
      texto:
        "O tema do pacote entra na pauta do grêmio e nas falas do UnooriaAI. Crie a atividade (o pacote " +
        "padrão oficial em um toque, ou um tema da sua disciplina gerado com IA e homologado por você) e " +
        "use Iniciar Atividade com a Turma: ele põe a atividade no ar e libera a missão na sala de aula.",
    },
    {
      tom: "warning",
      titulo: "Não anuncie que a aula é sobre algoritmo ou economia da atenção",
      texto:
        "A missão mede o que o estudante faz quando ninguém avisou que a rede amplifica. Apresente só o " +
        "desafio do grêmio: criar a publicação oficial da campanha.",
    },
    {
      tom: "info",
      titulo: "O que vai para o projetor são os cartões sem nomes",
      texto:
        "No Painel de Condução em Tempo Real, o Balanço Editorial da Turma, a Distribuição Horária Coletiva " +
        "e a Matriz Consolidada de Evidências mostram só agregados. O Monitor de Ritmo e Inatividade, com " +
        "os nomes, é para a sua tela.",
    },
  ],

  objetivos: [
    "Reconhecer como as redes sociais interferem na saúde física (sono, dor de cabeça, horas na tela) e mental (ansiedade, humilhação) de quem as usa.",
    "Auditar um texto gerado por IA: perguntar a fonte de um dado e não publicar o que não se comprova.",
    "Aplicar o direito digital na própria produção: creditar o autor e não expor dados pessoais de colegas.",
    "Usar as ferramentas de proteção de uma rede — privacidade, denúncia e ajuda — sem esperar que alguém mande.",
    "Explicar a economia da atenção: a rede vende o tempo de tela, e o conflito retém mais do que a calma.",
  ],

  bncc: [
    {
      codigo: "EM13CO24",
      texto:
        "Identificar e reconhecer como as redes sociais e artefatos computacionais em geral interferem na saúde física e mental de seus usuários.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Etapa 4, o feed da madrugada: fixar o aviso de cuidado na publicação com o motivo de saúde. Vale a melhor ação no feed; quem publicou e não moderou fica “não atingiu” quando a turma avança para o Explicar.",
    },
    {
      codigo: "EM13CO14",
      texto:
        "Avaliar a confiabilidade das informações encontradas em meio digital, investigando seus modos de construção e considerando a autoria, a estrutura e o propósito da mensagem.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 2, no UnooriaAI: questionar a fonte dos dados e corrigir a estatística inventada na prévia antes de exportar. Registrada no Publicar.",
    },
    {
      codigo: "EM13CO26",
      texto:
        "Aplicar os conceitos e pressupostos do direito digital em sua conduta e experiências com o cotidiano da cultura digital, bem como na produção e uso de artefatos computacionais.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 2, no UnooriaAI: exigir o crédito do trecho copiado e anonimizar o colega exposto (LGPD). Registrada no Publicar.",
    },
    {
      codigo: "EM13CO08",
      texto:
        "Entender como mudanças na tecnologia afetam a segurança, incluindo novas maneiras de preservar sua privacidade e dados pessoais on-line, reportando suspeitas e buscando ajuda em situações de risco.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 4: as três proteções do Unoovista, sem ninguém pedir — a privacidade na Configuração da Publicação, a denúncia do perfil suspeito e o relato pela Central de Apoio. As três: atingiu.",
    },
  ],

  antes: {
    tecnico: [
      { titulo: "Um aparelho por estudante (ou por equipe)", texto: "A missão roda em celular, tablet ou computador, dentro do hub. Em duplas ou trios, monte as equipes na criação da atividade: o painel conta por computador." },
      { titulo: "Atividade em andamento e missão liberada", texto: "Crie a atividade (pacote padrão oficial ou IA) e use Iniciar Atividade com a Turma: ela entra no ar e a missão é liberada na sala de aula." },
      { titulo: "Projetor pronto", texto: "O Painel de Condução em Tempo Real, na página da atividade, é o material do debate: a Distribuição Horária Coletiva da turma, sem nomes." },
      {
        titulo: "O podcast de recapitulação é o fechamento",
        texto:
          "“Recapitulação Unooria: O Algoritmo Não Dorme”: cerca de 3 minutos e 30 segundos em que Alex e Sam retomam a missão. O roteiro é o mesmo para todas as turmas; o áudio fica na aba Podcast da atividade, com a transcrição ao lado. Este podcast deve ser reproduzido após a realização da missão em tela, pois revela a lógica da economia da atenção e o desfecho da experiência.",
      },
    ],
    pedagogico: [
      { titulo: "Leia o pacote com o gabarito", texto: "A pauta do grêmio, os três problemas do rascunho e os comentários da madrugada estão no bloco abaixo; é deles que a conversa parte." },
      { titulo: "Retome o capítulo 1 do livro", texto: "O caso de Nico (“A mesma plataforma, realidades distintas”, pp. 2–9) volta no Explicar e no debate." },
    ],
    naoDiga: [
      "Que a aula é sobre algoritmo, bolha ou economia da atenção.",
      "Que o rascunho do UnooriaAI tem problemas — quem procura, encontra.",
      "Que há ferramentas de proteção no card do post e na barra do feed: usar sem ninguém pedir é o que a EM13CO08 mede.",
    ],
  },

  roteiro: {
    total: "1 aula · 50 min (25 em tela, 25 fora)",
    linhas: [
      {
        tempo: "0–5",
        momento: "Antes da vivência",
        professor:
          "Apresente o desafio do grêmio sem revelar a virada do algoritmo; confira se todos os estudantes estão logados no hub.",
      },
      {
        tempo: "5–30",
        momento: "Durante a vivência (25 min em tela)",
        professor:
          "Circule pela sala, observe pelo painel as escolhas no UnooriaAI e gerencie os momentos de choque quando os estudantes veem os comentários no Unoovista. Não aponte os problemas do rascunho.",
      },
      {
        tempo: "30–40",
        momento: "A revelação (10 min coletivos, fora da tela)",
        professor:
          "Pause as telas. Peça que estudantes com chamadas opostas leiam os comentários que receberam, e revele que o sistema impulsionou todas as postagens na madrugada — a Distribuição Horária Coletiva desmonta a culpa individual.",
        botao: "Pausar Telas para Debate",
      },
      {
        tempo: "40–50",
        momento: "Depois da vivência",
        professor:
          "Avance a turma para o Explicar: nos bastidores, cada estudante aponta o horário de pico e a métrica de retenção. Depois, medeie o debate de fechamento e reproduza o podcast de recapitulação como síntese final.",
        botao: "Avançar Turma para Explicar",
      },
    ],
    nota: "Em duas aulas de 25 min, a pausa natural é o Publicar: a primeira aula vai até ele, a segunda começa no feed da madrugada.",
  },

  debate: {
    aberturaNaLousa: "100% das publicações da turma tiveram pico de entrega entre 01h00 e 03h30 — qualquer que fosse a manchete.",
    tempo: "10 min",
    perguntas: [
      {
        nivel: "retomada",
        pergunta:
          "Quem escolheu a manchete construtiva e quem escolheu a sensacionalista: leiam em voz alta os comentários que a publicação de vocês recebeu. O que eles têm em comum?",
        porQue:
          "É o pedido do roteiro da revelação (as chamadas opostas leem os comentários): a turma VÊ que o cuidado e a manchete forte viveram a mesma madrugada antes de alguém explicar.",
      },
      {
        nivel: "retomada",
        pergunta:
          "Por que uma postagem informativa e bem cuidada acabou gerando discussões agressivas às duas da manhã no Unoovista?",
        porQue: "Puxa a pergunta que a leitura dos comentários deixou no ar: se o texto era bom, de onde veio a briga?",
      },
      {
        nivel: "analise",
        pergunta:
          "A plataforma entregou esse conteúdo de madrugada porque ele era útil para o descanso dos estudantes ou porque brigas mantêm as pessoas rolando a tela?",
        porQue: "Nomeia o critério da rede: retenção, não relevância nem bem-estar.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Se o algoritmo lucra com o tempo de tela que passamos acordados, quem é o verdadeiro cliente da rede social e o que está sendo vendido?",
        porQue: "Leva à economia da atenção: a atenção é a mercadoria vendida aos anunciantes.",
      },
    ],
  },

  observacao: {
    intro: "Enquanto a turma está no feed, observe sem intervir:",
    marcas: [
      { letra: "C", texto: "Culpou o próprio texto (“eu escrevi errado”)." },
      { letra: "S", texto: "Fixou o aviso de cuidado pensando na saúde de quem lê." },
      { letra: "P", texto: "Procurou as proteções sozinho (privacidade, denúncia, Central de Apoio)." },
    ],
    nota: "As marcas são para o debate, não para nota: o nível de cada habilidade está no painel de habilidades.",
  },

  mediacao: [
    {
      quando: "Alguém diz “aconteceu isso porque eu errei na IA”.",
      faca: "Aponte para a tela de um colega que corrigiu tudo e recebeu exatamente o mesmo padrão de entrega noturna.",
      naoFaca: "Não confirme a culpa individual: o incentivo é da rede.",
    },
    {
      quando: "A turma só fala dos ataques e ignora o sono.",
      faca: "Peça para ler em voz alta o comentário da Clara (dor de cabeça, não consegue dormir): a saúde física também está no feed.",
    },
    {
      quando: "Ninguém usou as ferramentas de proteção.",
      faca: "Pergunte: “Vocês perceberam que o aplicativo tinha ferramentas de proteção no card do post e na barra do feed? Por que é tão comum a gente paralisar?”",
    },
  ],

  depois: {
    sintese: [
      "A rede não otimiza verdade nem bem-estar: otimiza tempo de tela.",
      "O conflito retém mais do que a calma — por isso a frase mais ambígua vai para o destaque.",
      "Metadados (horário, tempo de pausa) dizem à rede quando cada um está mais vulnerável.",
      "O cuidado de quem escreve importa (fonte, crédito, privacidade), mas não controla a entrega.",
    ],
    registro: "O painel de habilidades da atividade mostra o nível das quatro habilidades por estudante; você pode ajustar.",
    rubrica: {
      nota: "A régua de cada habilidade, com o critério de cada nível, está no bloco do material e no painel de habilidades.",
      criterios: [
        {
          criterio: "Saúde física e mental (EM13CO24)",
          emDesenvolvimento: "Não usa nenhuma ferramenta de moderação na publicação.",
          adequado: "Fixa o aviso com outro motivo, ou restringe os comentários sem fixar aviso.",
          avancado: "Fixa o aviso de cuidado com o motivo de saúde.",
        },
        {
          criterio: "Confiabilidade (EM13CO14)",
          emDesenvolvimento: "Aceita o primeiro rascunho sem investigar as fontes.",
          adequado: "Questiona a fonte mas publica o dado inventado, ou pede revisão sem checar a origem.",
          avancado: "Questiona a fonte e corrige a estatística inventada antes de exportar.",
        },
        {
          criterio: "Direito digital (EM13CO26)",
          emDesenvolvimento: "Publica o trecho copiado sem crédito e o colega exposto.",
          adequado: "Resolve só um dos dois dilemas.",
          avancado: "Exige o crédito do trecho e anonimiza o colega.",
        },
        {
          criterio: "Segurança (EM13CO08)",
          emDesenvolvimento: "Não usa proteção.",
          adequado: "Usa uma ou duas das três.",
          avancado: "Privacidade, denúncia e Central de Apoio, sem ninguém pedir.",
        },
      ],
    },
    desdobramentos: [
      "Capítulo 2 da unidade: a mesma lógica de eficiência na triagem automatizada de currículos e bolsas.",
      "Mapear, em casa, as notificações noturnas de um aplicativo que a família usa.",
    ],
  },

  cuidados: [
    "Os casos do feed são ficcionais; se um estudante relatar uma situação real de sofrimento, acolha fora da aula e siga o protocolo da escola.",
    "O que o estudante escreve ao UnooriaAI fica só no aparelho dele: não peça para projetar o chat.",
    "Este podcast deve ser reproduzido após a realização da missão em tela, pois revela a lógica da economia da atenção e o desfecho da experiência.",
  ],

  adaptacoes: [
    { contexto: "Duplas ou trios por aparelho", comoAdaptar: "Um digita no UnooriaAI e outro cuida da prévia; no feed, um navega e outro cuida das proteções. A evidência vale para a equipe." },
    { contexto: "Sem computadores individuais", comoAdaptar: "Projete a missão e conduza como plenária do grêmio: a turma vota nas correções e acompanha o feed. Sem registro individual de evidência." },
    { contexto: "Duas aulas de 25 min", comoAdaptar: "A primeira vai até o Publicar; a segunda começa no feed da madrugada." },
    {
      contexto: "A mesma missão em Língua Portuguesa / Redação",
      comoAdaptar:
        "Recorte: liberdade de expressão nas redes e combate ao cyberbullying no colégio. A IA gera argumentos citando um artigo de lei inventado e expõe o print vazado da conversa de uma estudante; o feed polariza entre punição severa e censura. Não muda: a alucinação, o dado pessoal exposto, a entrega às 02h e a ansiedade e a insônia nos comentários.",
    },
    {
      contexto: "A mesma missão em Biologia / Ciências da Natureza",
      comoAdaptar:
        "Recorte: o uso de telas, a qualidade do sono e o ritmo circadiano dos adolescentes. A IA cita dados inflados de um instituto inexistente e menciona o histórico de insônia de um estudante; o feed destaca uma briga sobre quem passa mais tempo on-line. Não muda: a validação da fonte, o sigilo de saúde (LGPD), a entrega noturna e o impacto físico.",
    },
    {
      contexto: "A mesma missão em História / Ciências Humanas",
      comoAdaptar:
        "Recorte: a preservação da memória local e o uso de imagens do patrimônio da comunidade. A IA gera legenda com texto literal de um livro sem crédito e expõe a foto de um morador sem autorização; o feed viraliza com acusações de apropriação. Não muda: o dilema autoral e de imagem, a checagem, a métrica de lucro da plataforma e a reação desmedida do público.",
    },
  ],

  duvidas: [
    { pergunta: "Por que o post de quem foi cuidadoso também vai para a madrugada?", resposta: "É a virada da missão: a entrega é a mesma para todos, para mostrar que o incentivo é da rede, não de quem escreveu." },
    { pergunta: "O UnooriaAI é uma IA de verdade na aula?", resposta: "Não. Na aula ele responde por uma lista fechada de intenções, igual para todos; a IA só entra no seu preparo, se você gerar um pacote, e passa pela sua curadoria." },
    { pergunta: "Por que não há perguntas nem diário no fim?", resposta: "As quatro habilidades são registradas pelo que o estudante faz na missão; a etapa de perguntas e a de transferência (o diário do Refletir) saíram por decisão de produto." },
    { pergunta: "Onde vejo o resultado de cada estudante?", resposta: "Na aba Habilidades da atividade: a matriz de cada estudante nas quatro habilidades, com os três níveis, para você confirmar ou ajustar." },
  ],
};
