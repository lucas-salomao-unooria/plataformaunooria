import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula de O DOSSIÊ INVISÍVEL (exp09ef1b, 9º ano do EF, unidade 1,
 * ADR-202). Escrito a partir do one-pager pedagógico v5 (o passo a passo, os
 * tempos, a régua das duas habilidades) e da copy revisada (`design/06`, as
 * strings do professor e o roteiro do debate), com as decisões do Lucas de
 * 2026-10-29: três travas do professor (a próxima pauta, a revisão da decisão
 * depois do debate e o Explicar), a missão termina no Editor de Protocolo, a
 * liberação é na hora (sem agendamento) e o podcast é só do professor.
 *
 * As perguntas do debate juntam as TRÊS do roteiro do painel
 * (`ROTEIRO_DO_DEBATE` da api, LITERAIS — `dossie-invisivel-tipos.test.ts`
 * confere as duas cópias), uma retomada e a transferência.
 *
 * O que vem por BLOCO VIVO (`guia/material-do-dossie-invisivel.tsx`, de `GET
 * /dossie-invisivel/professor/material`): o banco padrão com os três projetos
 * e os cadernos, a conta da virada (antes e depois), o gabarito do protocolo e
 * o critério de cada nível. Tudo isso tem fonte na api, e uma cópia aqui seria
 * a que diverge.
 */
export const GUIA_EXP09EF1B: GuiaDaAula = {
  expId: "exp09ef1b",
  chamada:
    "Uma aula em que a turma descobre que um assistente de inteligência artificial não avalia o trabalho de um " +
    "projeto: avalia os rastros digitais que ele deixou. Cada estudante é conselheiro de uma comissão municipal, " +
    "decide para onde vão R$ 12.000 com a ajuda do assistente — e vê o parecer da máquina se inverter quando os " +
    "cadernos em papel entram na conta.",

  avisos: [
    {
      tom: "error",
      titulo: "Sem uma atividade sua em andamento, a missão não abre para ninguém",
      texto:
        "Os três projetos, os documentos e os cadernos vêm do pacote da atividade. Crie a atividade (Usar banco " +
        "padrão, em dois toques, ou um tema da sua disciplina gerado com IA e aprovado por você) e libere para a " +
        "turma: a missão também é liberada na sala de aula.",
    },
    {
      tom: "warning",
      titulo: "Não anuncie que a aula é sobre viés algorítmico",
      texto:
        "A missão mede se o conselheiro investiga a falta de documentos de um projeto antes de alguém mostrar os " +
        "cadernos. Apresente só o papel: conselheiros de uma comissão que decide uma verba única e indivisível.",
    },
    {
      tom: "info",
      titulo: "O que vai para o projetor são as contagens",
      texto:
        "Na aba Aula ao vivo, a distribuição de votos por projeto, os caminhos da investigação e a migração do " +
        "segundo voto são só números da turma. A lista com os nomes é para a sua tela.",
    },
  ],

  objetivos: [
    "Reconhecer que um sistema automatizado calcula sobre os dados que recebeu, e não sobre a realidade inteira.",
    "Perceber que o acesso desigual a computadores e a formatos digitais pesa na decisão de uma máquina.",
    "Investigar uma lacuna de dados antes de aceitar uma recomendação automatizada.",
    "Revisar critérios de decisão diante de evidência nova, sem mudar os critérios só para mudar o resultado.",
    "Propor regras de conferência humana para um assistente que apoia decisões públicas.",
  ],

  bncc: [
    {
      codigo: "EF09CO08",
      texto:
        "Discutir como a distribuição desigual de recursos de computação em uma economia global levanta questões de equidade, acesso e poder.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Na conversa com o assistente (perguntar pela falta de documentos e digitalizar os cadernos) e no segundo voto (pôr a urgência social acima da regularidade documental).",
    },
    {
      codigo: "EF09CO07",
      texto:
        "Avaliar aplicações e implicações políticas, socioambientais e culturais das tecnologias digitais para propor alternativas aos desafios do mundo contemporâneo, incluindo aqueles relativos ao mundo do trabalho.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "No Editor de Protocolo da IA do Conselho: as três verificações na ordem certa e a prática danosa na Área de Descarte.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Um computador por estudante",
        texto:
          "A missão roda no computador ou no tablet com teclado, dentro do hub, e é individual. Em bancada de 2 a 4, combine quem digita; o registro fica no login de quem entrou.",
      },
      {
        titulo: "Atividade em andamento e missão liberada",
        texto:
          "Usar banco padrão põe Mesa Aberta, Ponto de Apoio e Conexão para Continuar no ar em dois toques. Com o tema da sua disciplina, confira os três projetos e os cadernos, aprove o pacote e libere para a turma: a missão é liberada na sala de aula junto, na hora.",
      },
      {
        titulo: "Projetor pronto",
        texto:
          "A aba Aula ao vivo da atividade mostra a distribuição de votos da primeira deliberação, em tipografia grande, sem nomes: é o material do debate.",
      },
      {
        titulo: "O podcast de recapitulação é o fechamento",
        texto:
          "“Recapitulação Unooria — O Dossiê Invisível”: cerca de 3 minutos e 30 segundos em que Lucas e Bianca retomam a missão. Fica só na aba Podcast da atividade, com a transcrição; o estudante não o recebe na tela. Toque depois da missão em tela: ele conta a virada.",
      },
    ],
    pedagogico: [
      {
        titulo: "Leia o banco padrão, a conta da virada e o gabarito do protocolo",
        texto:
          "Os três projetos, os cadernos, o índice antes e depois da digitalização e as três verificações do protocolo estão no bloco abaixo; é deles que a conversa parte.",
      },
      {
        titulo: "Retome o que a turma já sabe sobre inteligência artificial",
        texto:
          "Uma pergunta basta: “a IA decide sozinha ou calcula com o que alguém deu a ela?”. Não corrija a resposta agora: ela volta no Explicar.",
      },
      {
        titulo: "Prepare a lousa",
        texto:
          "Deixe espaço para anotar a distribuição de votos da primeira deliberação, caso o projetor falhe.",
      },
    ],
    naoDiga: [
      "Que a aula é sobre viés algorítmico ou sobre a injustiça da inteligência artificial.",
      "Que existem cadernos em papel de um dos projetos — quem pergunta descobre.",
      "Qual projeto merece a verba, ou qual critério é o mais justo.",
      "Qual é a ordem certa das verificações no Editor de Protocolo.",
    ],
  },

  roteiro: {
    total: "1 aula · 50 min (24 em tela, 16 fora e 10 de folga)",
    linhas: [
      {
        tempo: "0–5",
        momento: "Desafiar (3 min em tela, 2 min fora)",
        professor:
          "Apresente o papel antes do primeiro toque na tela: a turma é a comissão de conselheiros que decide uma verba única de R$ 12.000. Confira se todos entraram.",
      },
      {
        tempo: "5–13",
        momento: "Navegar (8 min em tela)",
        professor:
          "Circule pela sala. Não aponte a falta de documentos de nenhum projeto: observe quem pergunta por ela e quem digitaliza os cadernos.",
      },
      {
        tempo: "13–17",
        momento: "Decidir (4 min em tela)",
        professor:
          "Acompanhe pelo painel quantos já registraram a escolha. As telas ficam à espera da presidência da mesa.",
      },
      {
        tempo: "17–22",
        momento: "Resultado: a próxima pauta (4 min em tela, 1 min fora)",
        professor:
          "Libere a próxima pauta: os cadernos e a tabela de confronto aparecem, e o parecer da máquina se inverte. Projete a distribuição de votos da primeira deliberação.",
        botao: "Liberar Próxima Pauta",
      },
      {
        tempo: "22–32",
        momento: "Debate (10 min fora)",
        professor:
          "Com as telas na tabela, faça as perguntas do roteiro. Ajude a turma a notar que os critérios não mudaram: mudou o que a máquina conseguia ler.",
      },
      {
        tempo: "32–35",
        momento: "Revisão da decisão (3 min em tela)",
        professor: "Abra o segundo voto: cada um mantém ou revisa o projeto e reordena os critérios.",
        botao: "Abrir Revisão da Decisão",
      },
      {
        tempo: "35–40",
        momento: "Explicar e Protocolo (5 min em tela)",
        professor:
          "Destrave o Explicar: Amara dá nome aos conceitos, e cada um marca onde o assistente errou e monta o protocolo. Projete a migração de escolhas e faça a pergunta de fechamento.",
        botao: "Destravar Explicar e Protocolo",
      },
      {
        tempo: "40–50",
        momento: "Fechamento coletivo (fora da tela)",
        professor: "Toque o podcast de recapitulação e feche com a pergunta de transferência.",
      },
    ],
    nota:
      "Em duas aulas de 25 min, a pausa natural é a espera depois da primeira escolha: a primeira aula vai até o Registrar Decisão, a segunda começa no Liberar Próxima Pauta — a missão guarda o progresso de cada um.",
  },

  debate: {
    aberturaNaLousa: "Os critérios do sistema não mudaram. O que mudou foi o que o robô conseguia ler.",
    tempo: "10 min",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Antes dos cadernos, por que o assistente recomendou o projeto da nuvem?",
        porQue:
          "A turma recupera o parecer da máquina — “menor risco documental e maior governança técnica” — e nota que ele falava de documentos, não de refeições servidas.",
      },
      {
        nivel: "analise",
        pergunta:
          "A qualidade real do trabalho do projeto Mesa Aberta aumentou quando descobrimos os cadernos de campo, ou o trabalho já existia e era a máquina que não conseguia enxergar?",
        porQue: "A primeira pergunta do roteiro do painel: separa o trabalho do registro do trabalho.",
      },
      {
        nivel: "analise",
        pergunta:
          "Por que um projeto comunitário que lida diretamente com urgência de alimentação tem muito mais dificuldade de gerar planilhas e relatórios em PDF do que uma oficina de informática?",
        porQue:
          "A segunda pergunta do roteiro do painel: leva à desigualdade de acesso a computadores (EF09CO08), não à preguiça de quem não digitalizou.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Se a prefeitura cortar uma verba ou suspender o passe de um estudante com base exclusiva na nota que a IA calculou, a culpa da injustiça é do algoritmo ou de quem aceitou a recomendação sem auditar os dados?",
        porQue:
          "A terceira pergunta do roteiro do painel, a de fechamento da plenária: a responsabilidade pela decisão continua humana.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Onde na sua vida um sistema decide alguma coisa sobre você a partir do que está registrado — e o que fica de fora desse registro?",
        porQue:
          "Leva a descoberta para fora da aula: boletim, cadastro, aplicativo, matrícula. Quem tem condições de pôr dados no sistema?",
      },
    ],
  },

  observacao: {
    intro: "Enquanto a turma conversa com o assistente e decide, observe sem intervir:",
    marcas: [
      { letra: "P", texto: "Perguntou por que um dos projetos tem tão poucos documentos." },
      { letra: "D", texto: "Digitalizou os cadernos antes de registrar a escolha." },
      { letra: "R", texto: "Aceitou a recomendação do assistente sem perguntar mais nada." },
    ],
    nota: "As marcas são para o debate, não para nota: o nível de cada habilidade está no painel de habilidades.",
  },

  mediacao: [
    {
      quando: "Alguém diz “a culpa é do João, que não usou o computador”.",
      faca: "Pergunte quem tinha computador, internet e tempo para digitar relatório enquanto servia 24 refeições por dia.",
      naoFaca: "Não transforme o projeto em papel em vítima nem em herói: o ponto é o que o sistema consegue ler.",
    },
    {
      quando: "A turma conclui que a inteligência artificial é sempre injusta.",
      faca:
        "Lembre que, com os cadernos digitalizados e os MESMOS critérios, a máquina acertou. O problema não é calcular: é aceitar o cálculo sem conferir o que ficou de fora.",
    },
    {
      quando: "Ninguém perguntou pela falta de documentos.",
      faca: "Pergunte: “Alguém sabe por que um projeto tinha 12 documentos e o outro só 1? Onde estava o resto?”",
    },
  ],

  depois: {
    sintese: [
      "Um sistema automatizado calcula padrões sobre os dados que recebeu — o que não foi registrado não existe para ele.",
      "Ter computador, internet e formato digital não é igual para todos, e essa diferença pesa na decisão da máquina.",
      "Antes de aceitar uma recomendação, investigue o que pode estar faltando nos dados.",
      "Mudar de ideia diante de evidência nova é diferente de mudar os critérios para chegar a um resultado.",
      "A responsabilidade por uma decisão pública continua sendo de quem a assina, não do algoritmo.",
    ],
    registro:
      "O painel de habilidades da atividade mostra o nível das duas habilidades por estudante; você pode confirmar e ajustar.",
    rubrica: {
      nota: "A régua de cada habilidade, com o critério de cada nível, está no bloco do material e no painel de habilidades.",
      criterios: [
        {
          criterio: "A investigação e a revisão (EF09CO08)",
          emDesenvolvimento:
            "Não investiga a falta de documentos, não muda de projeto depois da revelação e mantém os critérios idênticos.",
          adequado:
            "Não investiga no início, mas no segundo voto troca de projeto ou reordena os critérios sem pôr a urgência social acima da regularidade.",
          avancado:
            "Investiga a falta de documentos na conversa, ou, depois da revelação, põe a urgência social acima da regularidade documental.",
        },
        {
          criterio: "O protocolo do assistente (EF09CO07)",
          emDesenvolvimento: "Monta qualquer outra combinação.",
          adequado: "Posiciona duas das três verificações certas, ou as três sem descartar a prática danosa.",
          avancado: "Posiciona as três verificações na ordem certa e descarta a prática danosa.",
        },
      ],
    },
    desdobramentos: [
      "Levantar com a turma um cadastro público da cidade e listar quem tem mais dificuldade de aparecer nele.",
      "Matemática: refazer a conta da virada com outros pesos e ver quando o vencedor muda.",
    ],
  },

  cuidados: [
    "Os projetos, os coordenadores e a comissão são ficcionais; se alguém trouxer um caso real da família, acolha sem expor e volte aos dados do sistema.",
    "A missão não coleta texto de redação: as perguntas ao assistente ficam na conversa, e a escolha, o ranking e o protocolo são escolhas fechadas.",
    "Toque o podcast depois da missão em tela: ele conta a virada.",
  ],

  adaptacoes: [
    {
      contexto: "Duas aulas de 25 min",
      comoAdaptar:
        "A primeira vai do Desafiar ao Registrar Decisão, com a primeira escolha salva; a segunda começa no Liberar Próxima Pauta, passa pelo debate e pelo segundo voto e fecha no Editor de Protocolo, com o podcast no fim.",
    },
    {
      contexto: "Aula única apertada",
      comoAdaptar: "Encurte o debate para 6 minutos, com as duas primeiras perguntas; o podcast fica para a próxima aula.",
    },
    {
      contexto: "Bancada de 2 a 4 por aparelho",
      comoAdaptar: "Um digita, os outros discutem as perguntas ao assistente e a ordem dos critérios. O registro fica no login de quem entrou.",
    },
    {
      contexto: "A mesma missão em Língua Portuguesa",
      comoAdaptar:
        "Recorte: acesso à literatura e combate à desinformação. A IA gera três projetos (um slam com registros em cadernos, um coletivo com relatórios parciais, um podcast com relatórios em PDF). Não muda: a verba de R$ 12.000, o volume de documentos de cada papel, os cadernos, as travas e o protocolo.",
    },
  ],

  duvidas: [
    {
      pergunta: "A IA participa da aula?",
      resposta:
        "Só para entender a pergunta do estudante e escolher qual resposta do assistente mostrar; as respostas são fixas, iguais para todos. No seu preparo, se você escolher um tema próprio, a IA escreve os três projetos e os cadernos, e nada chega à turma sem a sua conferência.",
    },
    {
      pergunta: "Por que um projeto tem sempre 1 documento, outro 7 e outro 12?",
      resposta:
        "Porque a virada depende disso: com os mesmos critérios, o projeto em papel perde antes dos cadernos e vence depois. O seu tema muda os nomes, as áreas e os textos; o volume de documentos, a verba e os cadernos são fixos.",
    },
    {
      pergunta: "Quem não registrou a escolha quando eu liberei a próxima pauta perde a aula?",
      resposta: "Não. Quem registra depois da liberação vai direto para os cadernos e a tabela de confronto.",
    },
    {
      pergunta: "Onde vejo o resultado de cada estudante?",
      resposta:
        "Na aba Habilidades da atividade: o nível de cada estudante nas duas habilidades, para você confirmar ou ajustar.",
    },
  ],
};
