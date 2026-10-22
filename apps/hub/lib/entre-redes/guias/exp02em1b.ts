import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula de O EFEITO AMPLIFICADOR (exp02em1b, 2ª série do EM, unidade
 * 1, ADR-180). Escrito a partir do one-pager aprovado v1.2 (§1, §4, §7, §9, §10,
 * §13 e §17), com as duas orientações do PO de 2026-10-22: sem a etapa de
 * transferência e sem as perguntas finais (Canal B).
 *
 * O que vem por BLOCO VIVO (`guia/material-do-efeito.tsx`, de `GET
 * /efeito-amplificador/professor/material`): o pacote padrão com o gabarito
 * (os três nós e a correção de cada um, os comentários e a categoria de cada
 * um), os indicadores do Explicar, o roteiro do debate e o critério de cada
 * nível. Tudo isso tem fonte na api, e uma cópia aqui seria a que diverge.
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
        "O tema do pacote entra na fala de abertura do UnooriaAI. Crie a atividade (o pacote padrão em um " +
        "toque, ou um tema da sua disciplina gerado com IA e revisado por você), coloque em andamento e " +
        "libere a missão na sala de aula — são as duas portas.",
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
      titulo: "O que vai para o projetor é a lousa da condução",
      texto:
        "A lousa mostra só agregados: quantos publicaram, a curva de entrega e as manchetes escolhidas. A " +
        "folha com os nomes é para a sua tela.",
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
        "Etapa 4, o feed da madrugada: abrir relatos das duas dimensões (física e mental) e usar uma moderação. Registrada a cada ação no feed; quem não fez nada fica “não atingiu” quando a Etapa 5 abre.",
    },
    {
      codigo: "EM13CO14",
      texto:
        "Avaliar a confiabilidade das informações encontradas em meio digital, investigando seus modos de construção e considerando a autoria, a estrutura e o propósito da mensagem.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 2, no UnooriaAI: perguntar a fonte da estatística e tirar ou corrigir o dado inventado. Registrada no Publicar.",
    },
    {
      codigo: "EM13CO26",
      texto:
        "Aplicar os conceitos e pressupostos do direito digital em sua conduta e experiências com o cotidiano da cultura digital, bem como na produção e uso de artefatos computacionais.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 2, no UnooriaAI: creditar o trecho copiado e tirar do post o colega exposto (LGPD). Registrada no Publicar.",
    },
    {
      codigo: "EM13CO08",
      texto:
        "Entender como mudanças na tecnologia afetam a segurança, incluindo novas maneiras de preservar sua privacidade e dados pessoais on-line, reportando suspeitas e buscando ajuda em situações de risco.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 4: as três proteções nos três pontos — conta privada, denúncia e Central de Apoio —, sem aviso que obrigue. As três: atingiu.",
    },
  ],

  antes: {
    tecnico: [
      { titulo: "Um aparelho por estudante (ou por equipe)", texto: "A missão roda em celular, tablet ou computador, dentro do hub. Em duplas ou trios, monte as equipes na criação da atividade: o painel conta por computador." },
      { titulo: "Atividade em andamento e missão liberada", texto: "Crie a atividade (pacote padrão ou IA), ponha em andamento e libere a missão na sala de aula." },
      { titulo: "Projetor pronto", texto: "A lousa da condução, na página da atividade, é o material do debate: a curva de entrega da turma, sem nomes." },
    ],
    pedagogico: [
      { titulo: "Leia o pacote com o gabarito", texto: "Os três problemas do rascunho e os comentários da madrugada estão no bloco abaixo; é deles que a conversa parte." },
      { titulo: "Retome o capítulo 1 do livro", texto: "O caso de Nico (“A mesma plataforma, realidades distintas”, pp. 2–9) volta no Explicar e no debate." },
    ],
    naoDiga: [
      "Que a aula é sobre algoritmo, bolha ou economia da atenção.",
      "Que o rascunho do UnooriaAI tem problemas — quem procura, encontra.",
      "Que há ferramentas de proteção nos três pontos: usar sem ninguém pedir é o que a EM13CO08 mede.",
    ],
  },

  roteiro: {
    total: "50 min (25 em tela, 25 fora)",
    linhas: [
      { tempo: "5 min", momento: "Abertura", professor: "Apresente o desafio do grêmio sem revelar a virada; confira se todos entraram." },
      { tempo: "8 min", momento: "UnooriaAI e Publicar", professor: "Circule. Não aponte os problemas do rascunho; deixe cada um decidir a manchete e publicar." },
      { tempo: "5 min", momento: "O feed da madrugada", professor: "Observe os rostos quando o feed abrir. Não explique ainda." },
      { tempo: "10 min", momento: "A revelação", professor: "Pause as telas, projete a lousa e conduza o debate com as perguntas.", botao: "Pausar Telas para Debate" },
      { tempo: "8 min", momento: "Os bastidores (Etapa 5)", professor: "Libere a Etapa 5: cada um aponta o pico das 02h30 e o tempo de tela.", botao: "Liberar Etapa 5" },
      { tempo: "14 min", momento: "Fechamento e podcast", professor: "Feche a conversa sobre economia da atenção e toque o podcast de recapitulação." },
    ],
    nota: "Em duas aulas de 25 min, a pausa natural é o Publicar: a primeira aula vai até ele, a segunda começa no feed.",
  },

  debate: {
    aberturaNaLousa: "100% dos posts da turma tiveram pico de entrega entre 01h00 e 03h30 — qualquer que fosse a manchete.",
    tempo: "10 min",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Peça a três estudantes que escolheram manchetes diferentes que leiam os comentários que receberam. O que eles têm em comum?",
        porQue: "Quem foi cuidadoso e quem usou a manchete forte viveram a mesma madrugada: é a prova de que o efeito não veio do texto.",
      },
      {
        nivel: "analise",
        pergunta: "Vocês acham que a rede entregou essa postagem às duas da manhã porque ela era importante para os estudos da Clara, ou porque a discussão reteria as pessoas conectadas até o amanhecer?",
        porQue: "Nomeia o critério da rede: retenção, não relevância.",
      },
      {
        nivel: "generalizacao",
        pergunta: "Se o algoritmo lucra com o tempo de tela que passamos acordados, quem é o verdadeiro cliente da rede social e o que está sendo vendido?",
        porQue: "Leva à economia da atenção: a atenção é a mercadoria vendida aos anunciantes.",
      },
      {
        nivel: "transferencia",
        pergunta: "Que outro aplicativo que vocês usam muda de comportamento à noite? O que ele ganha com isso?",
        porQue: "O mecanismo vale para além do Unoovista — streaming, jogos, vídeos curtos.",
      },
    ],
  },

  observacao: {
    intro: "Enquanto a turma está no feed, observe sem intervir:",
    marcas: [
      { letra: "C", texto: "Culpou o próprio texto (“eu escrevi errado”)." },
      { letra: "F", texto: "Abriu relatos de saúde física, não só os ataques." },
      { letra: "P", texto: "Procurou os três pontos sozinho." },
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
      faca: "Pergunte: “Vocês perceberam que o aplicativo tinha ferramentas de proteção naqueles três pontinhos? Por que é tão comum a gente paralisar?”",
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
          emDesenvolvimento: "Não abre relatos nem modera.",
          adequado: "Abre relatos de uma dimensão, ou das duas sem moderar.",
          avancado: "Abre relatos das duas dimensões e modera.",
        },
        {
          criterio: "Confiabilidade (EM13CO14)",
          emDesenvolvimento: "Publica sem perguntar a fonte.",
          adequado: "Pergunta a fonte ou tira o dado, não os dois.",
          avancado: "Pergunta a fonte e tira o dado inventado.",
        },
        {
          criterio: "Direito digital (EM13CO26)",
          emDesenvolvimento: "Publica o trecho copiado e o colega exposto.",
          adequado: "Resolve um dos dois.",
          avancado: "Credita o trecho e tira o colega do post.",
        },
        {
          criterio: "Segurança (EM13CO08)",
          emDesenvolvimento: "Não usa proteção.",
          adequado: "Usa uma ou duas das três.",
          avancado: "Conta privada, denúncia e Central de Apoio.",
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
    "Toque o podcast só depois da missão: ele conta a virada.",
  ],

  adaptacoes: [
    { contexto: "Duplas ou trios por aparelho", comoAdaptar: "Um digita no UnooriaAI e outro cuida da prévia; no feed, um navega e outro usa os três pontos. A evidência vale para a equipe." },
    { contexto: "Sem computadores individuais", comoAdaptar: "Projete a missão e conduza como plenária do grêmio: a turma vota nas correções e acompanha o feed. Sem registro individual de evidência." },
    { contexto: "Duas aulas de 25 min", comoAdaptar: "A primeira vai até o Publicar; a segunda começa no feed da madrugada." },
  ],

  duvidas: [
    { pergunta: "Por que o post de quem foi cuidadoso também vai para a madrugada?", resposta: "É a virada da missão: a entrega é a mesma para todos, para mostrar que o incentivo é da rede, não de quem escreveu." },
    { pergunta: "O UnooriaAI é uma IA de verdade na aula?", resposta: "Não. Na aula ele responde por uma lista fechada de intenções, igual para todos; a IA só entra no seu preparo, se você gerar um pacote, e passa pela sua curadoria." },
    { pergunta: "Por que não há perguntas no fim?", resposta: "As quatro habilidades são registradas pelo que o estudante faz na missão; a etapa de perguntas e a de transferência saíram por decisão de produto." },
  ],
};
