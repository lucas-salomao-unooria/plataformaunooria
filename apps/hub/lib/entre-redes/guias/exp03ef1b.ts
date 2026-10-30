import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula de NINA E A NOTÍCIA QUE DESAPARECEU (exp03ef1b, 3º ano EF,
 * unidade 1, ADR-197). Escrito a partir do one-pager pedagógico aprovado (os
 * passos, a mediação, os tempos do §10, o que pode dar errado) e da spec da
 * frente, com os ajustes do PO de 27 e 28/10: "escolha" no lugar de "aposta" em
 * toda tela; os carimbos com as três opções à vista (É verdade, Não é verdade,
 * Não dá para saber); o reparo que monta a ficha inteira. Sem Canal B e sem
 * podcast nesta frente.
 *
 * As três perguntas do debate e os gatilhos de condução são CÓPIA do espelho
 * (`lib/nina-noticia-tipos.ts`), e não import: o gerador da base da Ajuda
 * carrega os guias direto pelo Node, que só apaga `import type` — um import de
 * valor quebra a carga (`scripts/gerar-base-da-ajuda.mjs`). Quem impede a cópia
 * de divergir é `nina-noticia-tipos.test.ts`, que a confere frase por frase.
 */
export const ROTEIRO_DO_GUIA = [
  {
    pergunta: "Nesta busca do jornal, o computador olhou a foto como nós olhamos ou consultou os campos da ficha?",
    cuidado:
      "Destacar que este filtro consulta campos cadastrados e que a máquina não adivinhou a imagem; não generalizar dizendo que o computador nunca reconhece imagens, pois outros sistemas possuem visão computacional.",
  },
  {
    pergunta:
      "Se a ficha do computador não tem o dia de um evento anotado, podemos dizer que aquele evento nunca aconteceu ou que a reportagem é mentirosa? Qual é a diferença entre uma mentira e uma informação que está faltando?",
    cuidado: "Consolidar que ausência de dado em um cadastro é uma lacuna que exige investigação, e não falsidade.",
  },
  {
    pergunta:
      "Por que é importante criar passos automáticos (algoritmos) com uma condição de parada clara quando temos muitas informações para conferir?",
    cuidado:
      "Evidenciar que rotinas automáticas poupam esforço humano em grandes acervos, mas precisam saber a hora exata de parar.",
  },
] as const;

export const GATILHOS_DO_GUIA = [
  "Verifique se todas as telas mostram a escolha travada no cadeado 'Travar Escolha' antes de autorizar o uso do filtro.",
  "A notícia do telão desapareceu: congele a sala no botão 'Pausar Turma' e faça a provocação coletiva antes de liberar a Etapa 4.",
  "Clique em 'Liberar Inspeção' para abrir as fichas técnicas nas telas dos estudantes.",
] as const;

const [PERGUNTA_DA_BUSCA, PERGUNTA_DA_LACUNA, PERGUNTA_DA_ROTINA] = ROTEIRO_DO_GUIA;
const GATILHOS_DE_CONDUCAO = GATILHOS_DO_GUIA;

export const GUIA_EXP03EF1B: GuiaDaAula = {
  expId: "exp03ef1b",
  chamada:
    "Uma aula — individual, em duplas ou em equipes — em que a criança de 8 anos descobre, com as próprias mãos, que a busca do computador não " +
    "olha a foto como nós olhamos: ela consulta os campos da ficha — e o campo vazio faz uma notícia desaparecer.",

  avisos: [
    {
      tom: "error",
      titulo: "Sem uma atividade sua em andamento, a missão não abre para ninguém",
      texto:
        "Crie a atividade — Usar Banco Padrão é um clique — e toque em Liberar Atividade para a Turma no fim da " +
        "criação: ela entra em andamento e a missão fica liberada na sala de aula.",
    },
    {
      tom: "warning",
      titulo: "Não conte que uma notícia vai sumir",
      texto:
        "A força da descoberta vem da escolha travada ANTES do filtro. Na abertura, conte só o pedido da Nina: " +
        "encontrar todas as reportagens da feira de livros.",
    },
    {
      tom: "info",
      titulo: "Os dois portões são seus, e só avançam",
      texto:
        "Quem trava a escolha espera o seu Liberar Filtro; quem vê a notícia sumir espera o seu Liberar Inspeção. " +
        "Pausar Turma congela todas as telas para a conversa, e Retomar Turma as devolve.",
    },
  ],

  objetivos: [
    "Usar uma busca por campos (Quem, Onde, Quando) e explicar por que uma informação ficou de fora.",
    "Distinguir o que a foto mostra do que está anotado nos campos da ficha.",
    "Associar É verdade, Não é verdade e Não dá para saber a afirmações em figuras, inclusive com negação.",
    "Conferir a ficha campo a campo, achar o campo vazio e montá-la de novo.",
    "Montar e testar uma rotina com repetição e condição de parada.",
  ],

  bncc: [
    {
      codigo: "EF15CO08",
      texto:
        "Reconhecer e utilizar tecnologias computacionais para pesquisar e acessar informações, expressar-se crítica e criativamente e resolver problemas.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Etapas 3 e 4: a busca Onde: Pátio e a ficha do telão aberta. Registrada quando a ficha do telão é aberta — se acertou o filtro de primeira e se precisou do pulso do botão.",
    },
    {
      codigo: "EF03CO01",
      texto:
        "Associar os valores 'verdadeiro' e 'falso' a sentenças lógicas que dizem respeito a situações do dia a dia, fazendo uso de termos que indicam negação.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Os seis carimbos: três na Etapa 4 (um deles com o selo de negação) e três no caso do Festival de Ciências, na Etapa 6. Registrada quando os da Etapa 6 são enviados.",
    },
    {
      codigo: "EF03CO02",
      texto:
        "Criar e simular algoritmos representados em linguagem oral, escrita ou pictográfica, que incluam sequências e repetições simples com condição (iterações indefinidas), para resolver problemas de forma independente e em colaboração.",
      eixo: "Pensamento Computacional",
      ondeAcontece: "Etapa 5: a rotina da pilha de fichas, registrada no teste que para — e quantas tentativas levou.",
    },
    {
      codigo: "EF03CO03",
      texto:
        "Aplicar a estratégia de decomposição para resolver problemas complexos, dividindo esse problema em partes menores, resolvendo-as e combinando suas soluções.",
      eixo: "Pensamento Computacional",
      ondeAcontece: "Etapa 4: a ficha do telão montada com as três etiquetas, registrada no Concluir.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Um computador por estudante ou por equipe",
        texto:
          "De 1 a 4 crianças por computador. Se forem equipes, monte-as na criação da atividade: o painel conta por computador.",
      },
      {
        titulo: "Atividade criada e liberada",
        texto:
          "Usar Banco Padrão traz a Feira de Troca de Livros em um clique. Se gerar com IA, confira as três notícias, homologue e aprove as imagens — a do telão precisa mostrar o pátio sem dúvida.",
      },
      {
        titulo: "O painel aberto na sua tela",
        texto:
          "A página da atividade, na aba Aula ao vivo: os portões, a pausa, as escolhas da Etapa 2, os alertas e a folha da turma.",
      },
    ],
    pedagogico: [
      {
        titulo: "Combine os papéis, se houver equipes",
        texto: "Com mais de uma criança no computador, uma toca na tela e as outras apontam as pistas nas fotos; trocam na metade.",
      },
      {
        titulo: "Ensaie a provocação do sumiço",
        texto:
          "Na pausa depois do filtro: “O que acabou de acontecer? A foto mostra o pátio e a reportagem sumiu! Por que o computador fez isso?”",
      },
      {
        titulo: "Leia em voz alta",
        texto: "No 3º ano a mediação é oral: as instruções na tela são curtas e servem de apoio para você ler.",
      },
    ],
    naoDiga: [
      "Que uma das notícias vai sumir da busca.",
      "Que a ficha do telão está com o campo Onde vazio — a turma descobre ao abrir a ficha.",
      "Que o computador “não enxerga foto”: este filtro consulta campos; outros sistemas reconhecem imagens.",
    ],
  },

  roteiro: {
    total: "50 min (22 em tela, 28 de conversa e mediação)",
    linhas: [
      {
        tempo: "0–5",
        momento: "Acolhimento e organização da turma",
        professor:
          "Organize a turma nos computadores (individual ou em equipes) e conte o pedido da Nina: ela precisa encontrar, no jornal da escola, todas as reportagens da feira de livros.",
      },
      {
        tempo: "5–8",
        momento: "Etapa 1 — as três fotos da feira",
        professor:
          "A turma abre as fotos do mural, do portal e do telão e toca no cartaz da feira, que se repete: cada cartão ganha Mesma feira.",
      },
      {
        tempo: "8–12",
        momento: "Etapa 2 — a escolha travada",
        professor: `Cada computador põe na caixa as notícias que acha que a busca pelo pátio vai achar e toca em Travar Escolha. ${GATILHOS_DE_CONDUCAO[0]}`,
        botao: "Liberar Filtro",
      },
      {
        tempo: "12–18",
        momento: "Etapa 3 — o filtro e a pausa",
        professor: `A turma busca Onde: Pátio e vê só 2 notícias; a do telão deixa a moldura vazia. ${GATILHOS_DE_CONDUCAO[1]}`,
        botao: "Pausar Turma",
      },
      {
        tempo: "18–26",
        momento: "Etapa 4 — a ficha, os carimbos e o reparo",
        professor: `${GATILHOS_DE_CONDUCAO[2]} Cada computador abre a ficha do telão, carimba três cartões e monta a ficha com as três etiquetas. Com o Pátio no Onde, a busca refeita traz as 3; em outro campo, a tela explica como ficariam.`,
        botao: "Liberar Inspeção",
      },
      {
        tempo: "26–34",
        momento: "Etapa 5 — a rotina da pilha",
        professor:
          "Circule pela sala enquanto a turma organiza os blocos embaralhados: pergunte quando o computador deve parar de conferir as fichas.",
      },
      {
        tempo: "34–41",
        momento: "Etapa 6 — o caso do Festival de Ciências",
        professor:
          "A turma investiga duas fotos com uma ficha sem o dia, usa as três ferramentas e carimba. O Painel da Investigação fica congelado no fim.",
      },
      {
        tempo: "41–50",
        momento: "Debate coletivo",
        professor: "Conduza as três perguntas do roteiro de mediação, em voz alta, com a turma reunida.",
      },
    ],
    nota:
      "Em duas aulas de 50 min, a primeira vai das Etapas 1 a 4, com a conversa do sumiço; a segunda faz a rotina, o caso novo e o debate. A missão guarda o passo de cada computador.",
  },

  debate: {
    aberturaNaLousa: "A busca do jornal olha a foto ou a ficha?",
    tempo: "9 min, com a turma reunida",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Quantas notícias vocês puseram na caixa? Quantas a busca pelo pátio encontrou?",
        porQue: "Põe lado a lado o que a turma esperava e o que aconteceu, antes de qualquer explicação.",
      },
      {
        nivel: "analise",
        pergunta: PERGUNTA_DA_BUSCA.pergunta,
        porQue: `Primeira pergunta do roteiro aprovado. Cuidado: ${PERGUNTA_DA_BUSCA.cuidado}`,
      },
      {
        nivel: "generalizacao",
        pergunta: PERGUNTA_DA_LACUNA.pergunta,
        porQue: `Segunda pergunta do roteiro aprovado, que o caso do Festival prepara. Cuidado: ${PERGUNTA_DA_LACUNA.cuidado}`,
      },
      {
        nivel: "generalizacao",
        pergunta: PERGUNTA_DA_ROTINA.pergunta,
        porQue: `Terceira pergunta do roteiro aprovado. Cuidado: ${PERGUNTA_DA_ROTINA.cuidado}`,
      },
    ],
  },

  observacao: {
    intro: "Enquanto a turma está na tela, observe sem intervir:",
    marcas: [
      { letra: "F", texto: "Escolheu o filtro do lugar sem ajuda." },
      { letra: "C", texto: "Abriu a ficha e apontou o campo vazio." },
      { letra: "P", texto: "Falou da condição de parada ao montar a rotina." },
    ],
    nota:
      "As marcas são para a conversa, não para nota: o nível de cada habilidade está no painel de habilidades, e o painel da aula nunca mostra acerto.",
  },

  mediacao: [
    {
      quando: "Alguém quer travar a escolha com a caixa vazia.",
      faca: "O botão fica apagado e a tela pede ao menos uma notícia na caixa. Pergunte quais fotos mostram o pátio.",
    },
    {
      quando: "O filtro escolhido devolve 0 notícias.",
      faca: "A pastilha Onde pulsa. Pergunte: “Vocês querem achar pelo quem, pelo quando ou pelo lugar?”",
      naoFaca: "Não toque na pastilha pela criança: tentar outro filtro antes conta na habilidade da busca.",
    },
    {
      quando: "Um computador testa a rotina várias vezes sem parar (o painel acende o alerta).",
      faca: "Aproxime-se e pergunte quando o computador deve parar de conferir as fichas.",
      naoFaca: "Não monte a sequência pela turma.",
    },
    {
      quando: "Um computador carimba o mesmo símbolo em todos os cartões (o painel acende o alerta).",
      faca: "Estimule a conferência visual: leia cada cartão em voz alta e peça para olharem a figura de novo.",
    },
  ],

  depois: {
    sintese: [
      "A busca do jornal consulta os campos da ficha; ela não olha a foto como nós olhamos.",
      "Um campo vazio não é mentira: é uma informação que está faltando, e precisa de investigação.",
      "Uma rotina automática confere muitas fichas, mas precisa saber a hora exata de parar.",
    ],
    registro:
      "Peça que cada estudante ou equipe desenhe uma ficha com os três campos (Quem, Onde, Quando) de um evento da escola, com o ícone de cada um.",
    rubrica: {
      nota: "Os níveis registrados pela plataforma, por habilidade, a partir do que cada computador fez — confira no painel de habilidades.",
      criterios: [
        {
          criterio: "Busca por campos (EF15CO08)",
          emDesenvolvimento: "Não abre a ficha da notícia que sumiu.",
          adequado: "Tenta outros filtros antes, ou precisa do pulso do botão para abrir a ficha.",
          avancado: "Escolhe o filtro do lugar de primeira e abre a ficha sem ajuda.",
        },
        {
          criterio: "Verdadeiro, falso e negação (EF03CO01)",
          emDesenvolvimento: "Carimba o mesmo símbolo nos três cartões de uma etapa.",
          adequado: "Acerta os carimbos simples, mas confunde dado ausente com dado falso.",
          avancado: "Carimba o cartão com negação e marca Não dá para saber no dado que falta.",
        },
        {
          criterio: "Rotina com parada (EF03CO02)",
          emDesenvolvimento: "Não chega a uma rotina que para.",
          adequado: "Chega à rotina que para em mais de duas tentativas.",
          avancado: "Monta a rotina que para em até duas tentativas.",
        },
        {
          criterio: "Decomposição da ficha (EF03CO03)",
          emDesenvolvimento: "Não localiza o campo vazio.",
          adequado: "Conclui com o Pátio em outro campo e segue com a explicação da tela.",
          avancado: "Põe o Pátio no campo Onde no Concluir.",
        },
      ],
    },
    desdobramentos: [
      "Reaplique com outro tema (a horta da escola, a exposição de fotos antigas): com o mesmo pacote, a descoberta se perde.",
      "Organize um mural da turma em que cada reportagem tem a ficha completa colada ao lado.",
    ],
  },

  cuidados: [
    "Não generalize para “o computador nunca reconhece imagens”: este filtro consulta campos, outros sistemas têm visão computacional.",
    "Ausência de dado não é falsidade: evite chamar a notícia do telão de errada ou mentirosa.",
    "Não compare estudantes nem equipes: o painel não faz ranking, e os carimbos não mostram cor de certo ou errado.",
  ],

  adaptacoes: [
    {
      contexto: "Crianças ainda não leem com fluência",
      comoAdaptar:
        "As instruções têm até oito palavras e servem para você ler em voz alta; tudo na tela é ícone, figura e toque.",
    },
    {
      contexto: "Dificuldade de coordenação motora fina",
      comoAdaptar: "Nada precisa ser arrastado: toque para pegar e toque de novo para soltar, em todos os componentes.",
    },
    {
      contexto: "Duas aulas em vez de uma",
      comoAdaptar: "Pare depois da Etapa 4 e da conversa do sumiço; a missão retoma no passo de cada computador.",
    },
  ],

  duvidas: [
    {
      pergunta: "E se a turma puser as três notícias na caixa?",
      resposta: "A do telão some do mesmo jeito na busca: três prometidas contra duas entregues, e o mesmo susto.",
    },
    {
      pergunta: "E se alguém puser o Pátio no campo errado?",
      resposta:
        "Não há punição nem “tentar de novo”: a tela explica que o pátio é um lugar, mostra como ficariam as três notícias e segue com Continuar.",
    },
    {
      pergunta: "A internet caiu no meio da aula. Perdi o trabalho?",
      resposta: "Não. A tela avisa que as anotações continuam salvas e reenvia quando a conexão volta.",
    },
    {
      pergunta: "Posso voltar um portão?",
      resposta: "Não: os portões só avançam. Para recomeçar a turma, use Zerar Turma, que abre uma rodada nova.",
    },
  ],
};
