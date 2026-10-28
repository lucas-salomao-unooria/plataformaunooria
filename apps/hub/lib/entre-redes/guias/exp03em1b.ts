import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula de O PORTA-VOZ DOS DADOS (exp03em1b, 3ª série do EM, unidade
 * 1, ADR-198). Escrito a partir do one-pager do PO v2.0 (§5 — antes, durante e
 * depois; as três perguntas provocadoras; §6 — a régua de cada habilidade) e do
 * one-pager pedagógico (os tempos de cada etapa, em tela e fora dela), com as
 * decisões do Lucas de 2026-10-28: o podcast é só do professor, e a liberação é
 * por turma (não há código de sala).
 *
 * As perguntas do debate juntam as TRÊS provocadoras do one-pager (curtas, para
 * a lousa) e as três do roteiro do painel (`ROTEIRO_DO_DEBATE` da api, LITERAIS
 * — `porta-voz-tipos.test.ts` confere as duas cópias), mais a transferência.
 *
 * O que vem por BLOCO VIVO (`guia/material-do-porta-voz.tsx`, de `GET
 * /porta-voz-dos-dados/professor/material`): o banco padrão com a tabela e a
 * nota técnica, o laudo, os dois cartões da perícia com o gabarito e o critério
 * de cada nível. Tudo isso tem fonte na api, e uma cópia aqui seria a que
 * diverge.
 */
export const GUIA_EXP03EM1B: GuiaDaAula = {
  expId: "exp03em1b",
  chamada:
    "Uma aula em que a turma descobre que dois gráficos com os mesmos números verdadeiros podem contar histórias " +
    "opostas. Cada estudante é o porta-voz de dados da escola: escolhe onde o eixo do gráfico começa, decide o que " +
    "explicar junto e publica no grupo da cidade — e vê a comunidade reagir ao desenho, não aos números.",

  avisos: [
    {
      tom: "error",
      titulo: "Sem uma atividade sua em andamento, a missão não abre para ninguém",
      texto:
        "O recorte da aula entra no nome do grupo, na tabela e nas falas dos moradores. Crie a atividade (Usar Banco " +
        "Padrão e Liberar, em dois toques, ou um tema da sua disciplina preparado com IA e homologado por você) e " +
        "libere para a turma: a missão também é liberada na sala de aula.",
    },
    {
      tom: "warning",
      titulo: "Não anuncie que a aula é sobre gráficos que enganam",
      texto:
        "A missão mede a escolha da escala antes de alguém mostrar o outro gráfico. Apresente só o papel: o " +
        "porta-voz oficial de dados da escola, com 3 publicações para usar com responsabilidade.",
    },
    {
      tom: "info",
      titulo: "O que vai para o projetor são as contagens",
      texto:
        "Na aba Aula ao vivo, a divisão da turma entre as duas escalas, o anexo, a errata e a perícia são só " +
        "números da turma. A lista com os nomes é para a sua tela.",
    },
  ],

  objetivos: [
    "Reconhecer que um gráfico não é neutro: quem desenha escolhe o que destacar, mesmo com dados verdadeiros.",
    "Explicar como o ponto onde o eixo vertical começa faz uma variação pequena parecer gigante ou sumir.",
    "Publicar dados com responsabilidade: dizer a escala, citar a fonte e dar o contexto da variação.",
    "Corrigir publicamente uma publicação que induziu leituras erradas.",
    "Conferir os eixos, a régua e a fonte de um gráfico antes de acreditar no título.",
  ],

  bncc: [
    {
      codigo: "EM13CO12",
      texto: "Produzir, analisar, gerir e compartilhar informações a partir de dados, utilizando princípios de ciência de dados.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "O boletim publicado: a escala escolhida e a fonte dos dados ligada. Vale a publicação final — a errata, se houve; senão a primeira.",
    },
    {
      codigo: "EM13CO13",
      texto:
        "Analisar e utilizar as diferentes formas de representação e consulta a dados em formato digital para pesquisas científicas.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Etapa Navegar: abrir a nota técnica anexa antes de montar o boletim. Abrir só depois do lembrete do Assistente conta como em processo.",
    },
    {
      codigo: "EM13CO14",
      texto:
        "Avaliar a confiabilidade das informações encontradas em meio digital, investigando seus modos de construção e considerando a autoria, a estrutura e o propósito da mensagem.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Perícia técnica: sinalizar para revisão o cartão eleitoral que distorce a escala, com o motivo certo, sem sinalizar o outro.",
    },
    {
      codigo: "EM13CO21",
      texto:
        "Comunicar ideias complexas de forma clara por meio de objetos digitais como mapas conceituais, infográficos, hipertextos e outros.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "No compositor: ligar a explicação da escala já na primeira publicação. Ligar só na errata conta como em processo.",
    },
    {
      codigo: "EM13CO22",
      texto:
        "Produzir e publicar conteúdo como textos, imagens, áudios, vídeos e suas associações, bem como ferramentas para sua integração, organização e apresentação, utilizando diferentes mídias digitais.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "O boletim final com o gráfico e pelo menos duas das três informações ligadas (explicação da escala, fonte e contexto).",
    },
    {
      codigo: "EM13CO26",
      texto:
        "Aplicar os conceitos e pressupostos do direito digital em sua conduta e experiências com o cotidiano da cultura digital, bem como na produção e uso de artefatos computacionais.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "A errata: corrigir o que a primeira publicação distorceu. Quem já publicou adequado não precisa de errata; trocar o eixo de 0% para 80% não conta como correção.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Um aparelho por estudante",
        texto:
          "A missão roda em celular, tablet ou computador, dentro do hub, e é individual. Em bancada de 2 a 4, combine quem toca na tela; o registro fica no login de quem entrou.",
      },
      {
        titulo: "Atividade em andamento e missão liberada",
        texto:
          "Usar Banco Padrão e Liberar põe a Vigilância Sanitária da Água no ar em dois toques. Com o recorte da sua disciplina, revise os textos, homologue e libere a atividade para a turma: a missão é liberada na sala de aula junto.",
      },
      {
        titulo: "Projetor pronto",
        texto:
          "A aba Aula ao vivo da atividade mostra quantos estão em cada etapa e a divisão da turma entre as duas escalas, sem nomes: é o material do debate.",
      },
      {
        titulo: "O podcast de recapitulação é o fechamento",
        texto:
          "“Por Trás do Gráfico: Quem Controla o Eixo?”: cerca de 3 minutos e 40 segundos em que Alex e Sam retomam a missão. Fica só na aba Podcast da atividade, com a transcrição; o estudante não o recebe na tela. Toque depois da missão em tela: ele conta a virada.",
      },
    ],
    pedagogico: [
      {
        titulo: "Leia o banco padrão e a perícia com o gabarito",
        texto:
          "A tabela, a nota técnica, o laudo e os dois cartões eleitorais estão no bloco abaixo; é deles que a conversa parte.",
      },
      {
        titulo: "Retome a unidade do livro",
        texto:
          "“Visualizar dados é contar histórias”: gráficos comunicam pontos de vista, e o corte do eixo muda a percepção pública.",
      },
      {
        titulo: "Prepare a lousa",
        texto:
          "Deixe espaço para desenhar as duas colunas do mesmo dado — o eixo começando em 0% e em 80% — durante o Explicar.",
      },
    ],
    naoDiga: [
      "Que a aula é sobre gráficos que enganam ou sobre o corte do eixo.",
      "Que a escola rival vai publicar a mesma planilha.",
      "Qual escala é a certa, ou que a nota técnica anexa importa — abrir é escolha do estudante.",
      "Qual dos dois cartões eleitorais está distorcido.",
    ],
  },

  roteiro: {
    total: "1 aula · 50 min (25 em tela, 25 fora)",
    linhas: [
      {
        tempo: "0–5",
        momento: "Desafiar (3 min em tela, 2 min fora)",
        professor:
          "Apresente o papel antes do primeiro toque na tela: a turma é o grupo de porta-vozes oficiais de dados das escolas. Confira se todos entraram.",
      },
      {
        tempo: "5–10",
        momento: "Navegar (5 min em tela)",
        professor: "Circule pela sala. Não aponte o anexo nem a escala: observe quem abre a nota técnica.",
      },
      {
        tempo: "10–14",
        momento: "Decidir (4 min em tela)",
        professor: "Acompanhe pelo painel a divisão da sala entre o eixo em 0% e o eixo em 80% na primeira publicação.",
      },
      {
        tempo: "14–26",
        momento: "Resultado e debate (2 min em tela, 10 min fora)",
        professor:
          "Quando os gráficos da escola rival aparecerem, pause as telas e assuma o centro da sala. Faça as três perguntas provocadoras e ajude a turma a notar que ninguém adulterou a planilha: a diferença nasceu de onde a régua começou.",
        botao: "Pausar para o debate",
      },
      {
        tempo: "26–29",
        momento: "Errata (3 min em tela)",
        professor:
          "Libere a retomada: o compositor volta com as escolhas da primeira publicação, e cada um decide se corrige com a segunda publicação.",
        botao: "Liberar Retomada da Turma",
      },
      {
        tempo: "29–36",
        momento: "Explicar (4 min em tela, 3 min fora)",
        professor:
          "Com o laudo na tela, desenhe na lousa as duas colunas do mesmo dado e faça a síntese do Fator de Mentira.",
      },
      {
        tempo: "36–40",
        momento: "Perícia técnica (4 min em tela)",
        professor: "Deixe cada um examinar os dois cartões eleitorais sozinho. Não diga qual está distorcido.",
      },
      {
        tempo: "40–50",
        momento: "Fechamento coletivo (10 min fora)",
        professor: "Toque o podcast de recapitulação e feche com a pergunta de transferência.",
      },
    ],
    nota:
      "Em duas aulas de 50 min, a pausa natural é o debate: a primeira vai até a pausa, a segunda começa no Liberar Retomada da Turma — a missão guarda o progresso de cada um.",
  },

  debate: {
    aberturaNaLousa: "Os dois gráficos usaram a mesma planilha oficial: 95% no primeiro mês e 88% no último.",
    tempo: "10 min",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Quem alterou os números da prefeitura?",
        porQue:
          "A turma confere que ninguém mexeu na planilha: as duas escolas publicaram os mesmos números. A diferença está em outro lugar.",
      },
      {
        nivel: "analise",
        pergunta:
          "Ambas as escolas usaram a mesma planilha oficial com 95% e 88% de conformidade. Por que os dois desenhos parecem dizer coisas totalmente opostas?",
        porQue: "A primeira pergunta do roteiro do painel: leva a turma a olhar onde cada eixo começa.",
      },
      {
        nivel: "analise",
        pergunta: "Qual gráfico protege os moradores e qual evita histeria?",
        porQue:
          "Mostra que as duas escalas servem a interesses diferentes — nenhuma é neutra, e quem publica escolhe.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Se você fosse um morador da rua onde a tubulação quebrou, qual gráfico defenderia seus direitos? E se você fosse o diretor do hospital geral, qual gráfico evitaria histeria desnecessária?",
        porQue: "A versão do roteiro do painel para a mesma ideia, com dois lugares de fala concretos.",
      },
      {
        nivel: "analise",
        pergunta: "O que faltou explicar na postagem?",
        porQue: "Leva às três informações do compositor: a escala, a fonte e o contexto da queda em duas ruas.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Por que apenas postar a imagem do gráfico sem a Nota de Intenção causou tanto caos no grupo comunitário?",
        porQue: "A terceira pergunta do roteiro do painel: quem publica dados deve explicar a escolha que fez.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Na próxima vez que você vir um gráfico numa campanha ou numa notícia, onde vai olhar antes de acreditar no título?",
        porQue:
          "Leva a descoberta para fora da aula: conferir onde o eixo começa e de onde vieram os números, antes da cor e do título.",
      },
    ],
  },

  observacao: {
    intro: "Enquanto a turma navega e decide, observe sem intervir:",
    marcas: [
      { letra: "A", texto: "Abriu a nota técnica antes de montar o boletim." },
      { letra: "E", texto: "Trocou entre as duas escalas na prévia antes de publicar." },
      { letra: "R", texto: "Reagiu ao post da escola rival comparando os dois eixos." },
    ],
    nota: "As marcas são para o debate, não para nota: o nível de cada habilidade está no painel de habilidades.",
  },

  mediacao: [
    {
      quando: "Alguém diz “a outra escola mentiu”.",
      faca: "Peça para comparar os números das duas tabelas: são iguais. Pergunte o que mudou entre os dois desenhos.",
      naoFaca: "Não confirme a mentira: a planilha é a mesma, e é isso que a turma precisa enxergar.",
    },
    {
      quando: "A turma conclui que o eixo em 80% é sempre errado.",
      faca:
        "Lembre o morador da rua da obra: para ele, ver a queda importa. O problema não é a escala em si, é publicar sem explicar a escolha.",
    },
    {
      quando: "Ninguém abriu a nota técnica.",
      faca: "Pergunte: “Alguém sabe POR QUE o índice caiu? Onde estava essa informação?”",
    },
  ],

  depois: {
    sintese: [
      "Gráficos não são verdades neutras: quem desenha escolhe o que destacar.",
      "Mudar onde o eixo vertical começa muda a reação das pessoas aos mesmos números.",
      "Quem publica dados deve dizer a escala, citar a fonte e dar o contexto.",
      "Corrigir em público uma publicação que induziu ao erro é parte da responsabilidade de quem publica.",
      "Antes de acreditar num gráfico, confira o eixo e a fonte — não a cor nem o título.",
    ],
    registro:
      "O painel de habilidades da atividade mostra o nível das seis habilidades por estudante; você pode confirmar e ajustar.",
    rubrica: {
      nota: "A régua de cada habilidade, com o critério de cada nível, está no bloco do material e no painel de habilidades.",
      criterios: [
        {
          criterio: "O boletim publicado (EM13CO12)",
          emDesenvolvimento: "Publica com o eixo em 80% e sem a fonte.",
          adequado: "Publica com o eixo em 0% sem a fonte, ou com o eixo em 80% e a fonte.",
          avancado: "Publica com o eixo em 0% e a fonte dos dados.",
        },
        {
          criterio: "A nota técnica (EM13CO13)",
          emDesenvolvimento: "Publica sem abrir o anexo.",
          adequado: "Abre o anexo só depois do lembrete do Assistente.",
          avancado: "Abre o anexo por conta própria antes de montar o boletim.",
        },
        {
          criterio: "A perícia (EM13CO14)",
          emDesenvolvimento: "Não sinaliza o cartão distorcido, ou pula a perícia.",
          adequado: "Sinaliza o cartão distorcido com o motivo errado, ou sinaliza também o outro.",
          avancado: "Sinaliza só o cartão distorcido, pela escala.",
        },
        {
          criterio: "A explicação da escala (EM13CO21)",
          emDesenvolvimento: "Nunca liga a explicação da escala.",
          adequado: "Liga a explicação só na errata.",
          avancado: "Liga a explicação já na primeira publicação.",
        },
        {
          criterio: "O gráfico com as informações (EM13CO22)",
          emDesenvolvimento: "Publica o gráfico sozinho.",
          adequado: "Publica com uma informação.",
          avancado: "Publica com duas ou três informações.",
        },
        {
          criterio: "A errata (EM13CO26)",
          emDesenvolvimento: "Mantém a publicação distorcida sem errata, ou leva o eixo de 0% para 80%.",
          adequado: "Usa a errata sem corrigir o problema central.",
          avancado: "Já publicou adequado, ou corrige na errata o que distorceu.",
        },
      ],
    },
    desdobramentos: [
      "Trazer um gráfico de notícia ou de campanha e redesenhá-lo com o eixo começando em zero.",
      "Matemática: calcular a proporção entre a altura das colunas e a variação real dos números.",
    ],
  },

  cuidados: [
    "Os moradores, as escolas e os cartões eleitorais são ficcionais; se a conversa sobre política esquentar, volte aos eixos e às fontes.",
    "A missão não coleta texto livre do estudante: escala, informações e parecer são escolhas fechadas.",
    "Toque o podcast depois da missão em tela: ele conta a virada.",
  ],

  adaptacoes: [
    {
      contexto: "Duas aulas de 50 min",
      comoAdaptar:
        "A primeira vai do Desafiar ao debate, com as telas pausadas; a segunda começa no Liberar Retomada da Turma e vai da errata à perícia, com o podcast no fechamento.",
    },
    {
      contexto: "Aula única apertada",
      comoAdaptar: "Encurte o debate para 8 minutos e o fechamento para 3; o podcast fica para a saída ou para a próxima aula.",
    },
    {
      contexto: "Bancada de 2 a 4 por aparelho",
      comoAdaptar: "Um toca na tela, os outros discutem a escala antes de publicar. O registro fica no login de quem entrou.",
    },
    {
      contexto: "A mesma missão em Língua Portuguesa",
      comoAdaptar:
        "Recorte: a cobertura sobre atrasos no transporte escolar. A IA gera a planilha de pontualidade da frota, a nota sobre obras viárias e as postagens inflamadas no grupo. Não muda: os números, a cota de 3 publicações, a escolha entre 0% e 80%, o post rival e a pausa.",
    },
    {
      contexto: "A mesma missão em História",
      comoAdaptar:
        "Recorte: a preservação e o fluxo de visitantes em patrimônios públicos. A IA gera a planilha de visitação, a nota sobre reformas em alas e as cobranças dos conselheiros. Não muda: os números, a cota, a escolha da escala, o post rival e a pausa.",
    },
  ],

  duvidas: [
    {
      pergunta: "A IA participa da aula?",
      resposta:
        "Não. A IA só ajuda no seu preparo, se você escolher um tema próprio: ela escreve a tabela, a nota técnica e as falas dos moradores, e nada chega à turma sem a sua revisão. Na aula, o Assistente de Dados responde por botões, igual para todos.",
    },
    {
      pergunta: "Por que os números são sempre 95%, 94%, 92% e 88%?",
      resposta:
        "Porque o laudo e o Fator de Mentira dependem deles. O seu recorte muda o serviço público, a nota e as falas; os números e os cartões da perícia são fixos.",
    },
    {
      pergunta: "Quem não publicou quando eu pausei perde a aula?",
      resposta:
        "Não. Quem publica depois da retomada vê o post da escola rival e segue direto para a oferta da errata.",
    },
    {
      pergunta: "Onde vejo o resultado de cada estudante?",
      resposta:
        "Na aba Habilidades da atividade: o nível de cada estudante nas seis habilidades, para você confirmar ou ajustar.",
    },
  ],
};
