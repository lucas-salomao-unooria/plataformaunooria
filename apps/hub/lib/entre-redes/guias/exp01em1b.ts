import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula de O ASSISTENTE INVISÍVEL: DADOS QUE VIRAM DECISÕES
 * (exp01em1b, 1ª série EM, unidade 1, ADR-185). Escrito a partir do one-pager
 * do PO v1.5 (§1, §4, §7, §9a — o roteiro oral e as quatro perguntas —, §10 —
 * os tempos —, §13 e §14) e do Figma de 63 telas, que é a referência de tela e
 * de copy (decisão do Lucas, 2026-10-26): os nomes dos botões do painel aqui
 * são os do Figma, LITERAIS.
 *
 * O que vem por BLOCO VIVO (`guia/material-do-assistente-invisivel.tsx`, de
 * `GET /assistente-invisivel/professor/material`): as quatro perguntas do
 * roteiro com o caso de transferência, e o critério de cada nível das quatro
 * habilidades. Tudo isso tem fonte na api, e uma cópia aqui seria a que diverge.
 */
export const GUIA_EXP01EM1B: GuiaDaAula = {
  expId: "exp01em1b",
  chamada:
    "Uma aula em que a turma, como comissão de auditoria da escola, descobre que um assistente de estudos decidiu " +
    "pelo horário e pela conexão o que três colegas tinham pedido por escrito — e reconstrói as regras com " +
    "transparência e direito à revisão humana.",

  avisos: [
    {
      tom: "error",
      titulo: "Sem uma atividade sua em andamento, a missão não abre para ninguém",
      texto:
        "Crie a atividade — Usar Banco Padrão da Rede é o caminho curto —, ponha em andamento e libere a missão na " +
        "sala de aula. São as duas portas: sem qualquer uma delas, o estudante vê a missão fechada.",
    },
    {
      tom: "warning",
      titulo: "Não diga que o assistente usa horário e conexão",
      texto:
        "A aposta da Etapa 3 mede o que a turma acredita antes de ver o resultado. Na abertura, apresente só o papel " +
        "de comissão de auditoria e as três funções do assistente.",
    },
    {
      tom: "info",
      titulo: "A aula anda pelos seus botões, sempre para a frente",
      texto:
        "Cinco liberações e duas pausas na aba Aula ao vivo: Liberar Início dos Testes, Liberar Início da Simulação " +
        "(só com todas as apostas), Travar Telas da Turma, Liberar Bancada de Reconstrução, Pausar para Comparação e " +
        "Liberar Publicação e Transparência. Nenhum volta.",
    },
  ],

  objetivos: [
    "Distinguir dados fornecidos (o que a pessoa declara) de dados observados (o que o sistema grava sozinho).",
    "Explicar como uma inferência algorítmica sobre horário e conexão virou uma decisão injusta sobre colegas.",
    "Reutilizar critérios de um repositório para reconstruir as regras de um sistema e testar se ficaram equitativas.",
    "Publicar uma página de transparência e um comunicado que nomeia o problema, a inferência, a regra corrigida e o direito à revisão humana (LGPD).",
    "Reconhecer, em outros serviços digitais, decisões automáticas tomadas a partir de dados que ninguém declarou.",
  ],

  bncc: [
    {
      codigo: "EM13CO20",
      texto:
        "Criar conteúdos, disponibilizando-os em ambientes virtuais para publicação e compartilhamento, avaliando a " +
        "confiabilidade e as consequências da disseminação dessas informações.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Etapa 6: o estudante liga a página de transparência e monta o comunicado em quatro blocos (problema, " +
        "inferência, regra corrigida e salvaguarda). Registrada na publicação.",
    },
    {
      codigo: "EM13CO01",
      texto: "Explorar e construir a solução de problemas por meio da reutilização de partes de soluções existentes.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Etapa 5, no banco de critérios: trocar 1B e 2B por critérios que não restringem por dado observado e " +
        "retestar. Vale o último reteste.",
    },
    {
      codigo: "EM13CO18",
      texto:
        "Planejar e gerenciar projetos integrados às áreas de conhecimento de forma colaborativa, solucionando " +
        "problemas, usando diversos artefatos computacionais.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Etapas 4 a 6, o ciclo inteiro da auditoria: investigar as fichas, obter equidade no reteste e publicar a " +
        "transparência com os quatro blocos.",
    },
    {
      codigo: "EM13CO03",
      texto:
        "Identificar o comportamento dos algoritmos no que diz respeito ao consumo de recursos como tempo de " +
        "execução, espaço de memória e energia, entre outros.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Etapa 5, no painel opcional das etapas de processamento: marcar quais dos cinco passos foram adicionados " +
        "pela inferência de perfil.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Um aparelho por estudante, ou por equipe",
        texto:
          "Computador ou celular da escola, com a sessão do estudante. Se a turma dividir aparelhos, monte as equipes " +
          "na criação da atividade: o painel conta por computador e a marca vai para cada integrante.",
      },
      {
        titulo: "Atividade em andamento e missão liberada",
        texto:
          "Usar Banco Padrão da Rede (Língua Portuguesa) ou o recorte da sua disciplina: Gerar Cenários de Teste com " +
          "IA, revisar item a item na curadoria (Editar Texto, Regenerar Este Item) e Aprovar Pacote Homologado.",
      },
      {
        titulo: "O painel aberto na sua tela",
        texto:
          "A página da atividade, na aba Aula ao vivo: as apostas da sala, quem falta apostar, os critérios escolhidos " +
          "e os seus botões. Em sala com um só computador, ele é a projeção: a turma vota de braço levantado e você " +
          "registra a escolha majoritária.",
      },
    ],
    pedagogico: [
      {
        titulo: "Leia o pacote que a turma vai ver",
        texto:
          "As trilhas, as dúvidas que Lucas, Beatriz e Thiago mandam ao chat e as respostas do assistente estão na aba " +
          "Conteúdo da atividade. As fichas, os avisos de sistema e o banco de critérios são fixos.",
      },
      {
        titulo: "Separe as quatro perguntas do roteiro",
        texto:
          "As perguntas 1 e 2 são da mediação da Etapa 4 (8 minutos); as 3 e 4, do fechamento (7 minutos). Estão no " +
          "bloco abaixo e no painel da aula.",
      },
      {
        titulo: "Prepare o quadro para 1A × 1C",
        texto:
          "Na pausa da Etapa 5 você projeta a comparação entre a escolha livre (1A) e a progressão por acertos (1C): " +
          "dois caminhos éticos diferentes para o mesmo problema.",
      },
    ],
    naoDiga: [
      "Que o assistente decide pelo horário de acesso ou pela estabilidade da conexão.",
      "Qual aposta está certa: a aposta é para ser confrontada pelo resultado, não pela sua voz.",
      "Quais critérios do banco são os “certos”: o reteste mostra, e você compara 1A e 1C depois.",
    ],
  },

  roteiro: {
    total: "50 min (25 em tela, 25 de mediação e debate)",
    linhas: [
      {
        tempo: "0–2",
        momento: "Abertura: a comissão de auditoria",
        professor:
          "Apresente o papel da turma como comissão de auditoria de tecnologia da escola: o assistente está em teste, " +
          "e a comissão confere se ele entrega o que cada estudante pediu no cadastro.",
        botao: "Liberar Início dos Testes",
      },
      {
        tempo: "2–5",
        momento: "Etapa 1 — Desafiar",
        professor: "A Zara recebe cada estudante e apresenta os três casos. Deixe abrir o módulo de teste.",
      },
      {
        tempo: "5–9",
        momento: "Etapa 2 — Navegar",
        professor: "Os estudantes exploram as três funções do assistente. Acompanhe sem explicar regra nenhuma.",
      },
      {
        tempo: "9–13",
        momento: "Etapa 3 — Decidir: a aposta",
        professor:
          "Cada estudante aposta (A, B ou C) e a previsão fica arquivada. Acompanhe no painel a distribuição e quem " +
          "falta apostar; o botão só acende com todas as sessões abertas apostadas.",
        botao: "Liberar Início da Simulação",
      },
      {
        tempo: "13–17",
        momento: "Etapa 4 — Resultado: o chat e as fichas",
        professor:
          "Lucas recebe o avançado, Beatriz é rebaixada e Thiago é bloqueado. O confronto retoma a aposta de cada um, " +
          "e as fichas de auditoria mostram horário e conexão.",
      },
      {
        tempo: "17–25",
        momento: "Mediação 1 — fora da tela (8 min)",
        professor:
          "Trave as telas e conduza as perguntas 1 e 2 do roteiro. Concluída a conversa, abra a Etapa 5.",
        botao: "Travar Telas da Turma → Liberar Bancada de Reconstrução",
      },
      {
        tempo: "25–31",
        momento: "Etapa 5 — Explicar: a bancada",
        professor:
          "Os estudantes classificam os seis cartões, abrem (se quiserem) as etapas do algoritmo e escolhem os " +
          "critérios para retestar. Olhe os Avisos Discretos: quem avançou mantendo 1B ou 2B.",
      },
      {
        tempo: "31–36",
        momento: "Mediação 2 — comparação no quadro (5 min)",
        professor:
          "Pause e projete os critérios escolhidos pela sala: 1A (autonomia) × 1C (progressão por acertos). Nomeie " +
          "dados fornecidos, observados e inferidos.",
        botao: "Pausar para Comparação → Liberar Publicação e Transparência",
      },
      {
        tempo: "36–40",
        momento: "Etapa 6 — Refletir: a publicação",
        professor:
          "Cada estudante liga a página de transparência, monta o comunicado em quatro blocos e publica. O botão é " +
          "sempre habilitado; bloco em branco só gera aviso.",
      },
      {
        tempo: "40–50",
        momento: "Fechamento e síntese oral (7 min)",
        professor:
          "Parta do caso do aplicativo de transporte, faça as perguntas 3 e 4 e amarre a síntese sobre LGPD e direito " +
          "à explicação. O relatório final está no painel, com a exportação para impressão.",
      },
    ],
    nota:
      "Em duas aulas de 50 min, a primeira vai até a Etapa 4 com o debate sobre metadados; a segunda abre na " +
      "bancada (Liberar Bancada de Reconstrução) e fecha com a publicação. Em duas sessões de 25 min, a mesma " +
      "divisão, sem o aprofundamento.",
  },

  debate: {
    aberturaNaLousa: "Lucas e Beatriz pediram a mesma coisa. O que fez a Beatriz cair para o básico?",
    tempo: "8 min depois das fichas, 5 min na comparação da bancada e 7 min no fechamento",
    perguntas: [
      {
        nivel: "retomada",
        pergunta:
          "Olhando as fichas de Beatriz e Lucas, os dois preencheram o mesmo formulário pedindo nível avançado. O que " +
          "exatamente o sistema analisou para decidir que a Beatriz deveria ir para o reforço básico?",
        porQue: "A pergunta 1 do roteiro do PO: a turma descreve, nas fichas, o dado observado que ninguém declarou.",
      },
      {
        nivel: "analise",
        pergunta:
          "Estudar às 23h45 significa necessariamente que um estudante não tem capacidade para resolver exercícios " +
          "difíceis? Quais motivos reais podem levar alguém a acessar a plataforma nesse horário?",
        porQue: "A pergunta 2: desmonta a premissa da inferência (“acesso noturno = cansaço”).",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Quem costuma ter conexões mais instáveis ou usar pacotes de dados limitados no nosso dia a dia? Se uma " +
          "inteligência artificial bloqueia o acesso dessas pessoas para “não sobrecarregar o sistema”, que tipo de " +
          "desigualdade ela está reforçando?",
        porQue: "A pergunta 3: leva do caso do Thiago para quem paga a conta da regra.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Por que a Lei Geral de Proteção de Dados (LGPD) proíbe que decisões tomadas exclusivamente por algoritmos " +
          "funcionem como “caixas-pretas”, sem que o usuário possa pedir explicação ou revisão humana?",
        porQue: "A pergunta 4: dá nome ao que a página de transparência garante.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Um aplicativo de transporte passou a usar o modelo do celular e o bairro de embarque para cobrar mais caro. " +
          "Onde mais um algoritmo pode estar decidindo sobre você a partir do que você nunca declarou?",
        porQue: "O caso de transferência da Etapa 6, como pergunta-ponte para a vida do estudante.",
      },
    ],
  },

  observacao: {
    intro: "Enquanto a turma está na tela, observe sem intervir:",
    marcas: [
      { letra: "F", texto: "Abriu as fichas e procurou a diferença entre Lucas e Beatriz antes de seguir." },
      { letra: "C", texto: "Comparou o critério novo com o antigo antes de retestar (não trocou ao acaso)." },
      { letra: "T", texto: "Releu o comunicado montado antes de publicar." },
    ],
    nota: "As marcas são para a conversa, não para nota: os níveis estão no relatório final e no painel de habilidades.",
  },

  mediacao: [
    {
      quando: "Alguém diz que o rebaixamento da Beatriz foi “bug” ou falha do servidor.",
      faca:
        "Volte às fichas: o sistema fez exatamente o que a regra mandava. Pergunte qual dado aparece na ficha dela e " +
        "não na do Lucas.",
      naoFaca: "Não confirme nem negue o bug: a ficha é a prova, e a turma precisa chegar a ela.",
    },
    {
      quando: "O botão Liberar Início da Simulação não acende.",
      faca:
        "O painel lista quem ainda não apostou. Quem abriu a missão e saiu segura o botão: peça para voltar e apostar.",
    },
    {
      quando: "Um estudante avança para a publicação mantendo 1B ou 2B.",
      faca:
        "Ele aparece nos Avisos Discretos. Não o exponha: use o caso, sem nome, na comparação do quadro.",
    },
    {
      quando: "A turma conclui que “então toda inteligência artificial é injusta”.",
      faca:
        "Mostre que 1A e 1C resolvem o problema sem inferência: o problema não é o assistente, é a regra que decide " +
        "por dado observado sem explicação.",
    },
  ],

  depois: {
    sintese: [
      "Não é só o que eu digito que fala sobre mim: o sistema também grava o que observa, como horário e conexão.",
      "Uma inferência sobre dados observados pode virar uma regra injusta, mesmo sem ninguém ter errado o cadastro.",
      "Existem critérios que resolvem o problema sem deduzir quem eu sou.",
      "A LGPD garante o direito de entender a decisão automática e de pedir revisão humana.",
    ],
    registro:
      "O relatório final (aba Aula ao vivo) traz a matriz das quatro habilidades da turma, os níveis por estudante e " +
      "os comunicados publicados, com a exportação para impressão. O painel de habilidades da atividade mostra o " +
      "critério de cada nível; você pode ajustar.",
    rubrica: {
      nota: "A régua de cada habilidade, com o critério de cada nível, está no bloco do material e no painel de habilidades.",
      criterios: [
        {
          criterio: "A publicação da transparência (EM13CO20)",
          emDesenvolvimento: "Não publicou, ou montou blocos que quebram a cadeia causal.",
          adequado: "Publicou com bloco em branco, ou montou os quatro blocos sem ligar a página.",
          avancado: "Ligou a página e articulou os quatro blocos: problema, inferência, regra corrigida e revisão humana.",
        },
        {
          criterio: "A reutilização de critérios (EM13CO01)",
          emDesenvolvimento: "Manteve 1B e 2B, ou não retestou.",
          adequado: "Corrigiu só uma das duas funções afetadas.",
          avancado: "Trocou as duas por critérios do repositório que não restringem por dado observado.",
        },
      ],
    },
    desdobramentos: [
      "Língua Portuguesa (EM13LP05): analisar o comunicado como texto institucional — quem fala, para quem e com que garantias.",
      "Levantar com a turma onde a escola usa sistemas automáticos e redigir uma proposta de página de transparência real.",
      "Capítulo 1 da apostila: a venda de perfis para publicidade, o conceito que esta missão deixou de fora de propósito.",
    ],
  },

  cuidados: [
    "Beatriz, Thiago e Lucas são personagens: não associe os casos a estudantes reais da turma.",
    "Não pergunte quem estuda de madrugada ou quem tem internet ruim de levantar a mão: a pergunta 2 é sobre motivos, não sobre pessoas.",
    "A missão não coleta texto livre: a aposta, os cartões, os critérios e os blocos são escolhas fechadas.",
    "Toque o podcast de recapitulação só depois da missão: ele conta a virada.",
  ],

  adaptacoes: [
    {
      contexto: "Aparelhos divididos",
      comoAdaptar:
        "Monte as equipes na criação da atividade: a tela vira “Bancada da Comissão”, com as instruções no plural, e " +
        "a evidência vai para cada integrante.",
    },
    {
      contexto: "Um computador e o projetor",
      comoAdaptar:
        "Você conduz a tela. A turma vota a aposta de braço levantado, você registra a majoritária, e o comunicado é " +
        "construído no quadro antes de você montá-lo.",
    },
    {
      contexto: "Duas aulas",
      comoAdaptar:
        "A primeira vai até as fichas e o debate da Etapa 4; a segunda começa em Liberar Bancada de Reconstrução.",
    },
  ],

  duvidas: [
    {
      pergunta: "Posso voltar uma etapa depois de liberar?",
      resposta:
        "Não: as liberações só andam para a frente. Para reaplicar com a turma, use Zerar Turma para Nova Aplicação, " +
        "que abre uma rodada nova da mesma atividade.",
    },
    {
      pergunta: "A IA conversa com os estudantes?",
      resposta:
        "Não. A IA só entra no seu preparo, para gerar o pacote do seu recorte, e nada chega à turma sem a sua " +
        "aprovação. As conversas do chat são roteirizadas a partir do pacote.",
    },
    {
      pergunta: "O que o medidor da turma mostra ao estudante?",
      resposta:
        "Só os percentuais da sala nas três apostas, e só com pelo menos três apostas: nunca quem apostou o quê.",
    },
  ],
};
