import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula de O ENIGMA DA CAPA DA RÁDIO (exp02ef1b, 2º ano EF, unidade 1,
 * ADR-184). Escrito a partir do one-pager do PO v1.1 (§1, §4, §8, §9a, §10,
 * §13, §14 e §15), com os textos ditos ao estudante LITERAIS, e com as decisões
 * do Lucas de 2026-10-26: a virada é GERAL da turma (um botão, LIBERAR VIRADA,
 * e não por estudante como o one-pager descrevia), sessão individual, sem
 * narração e sem texto livre.
 *
 * O que vem por BLOCO VIVO (`guia/material-do-enigma.tsx`, de `GET
 * /enigma-capa/professor/material`): os três pacotes prontos com o gabarito
 * (as falas da visitante, os selos, os dois objetos iguais do fundo), o roteiro
 * oral com os três cartões, e o critério de cada nível. Tudo isso tem fonte na
 * api, e uma cópia aqui seria a que diverge.
 */
export const GUIA_EXP02EF1B: GuiaDaAula = {
  expId: "exp02ef1b",
  chamada:
    "Uma aula individual em que cada criança descobre, com as próprias mãos, que uma foto mostra só um pedaço do " +
    "lugar: duas fotos tiradas no mesmo minuto podem contar histórias opostas sem que nenhuma esteja mentindo.",

  avisos: [
    {
      tom: "error",
      titulo: "Sem uma atividade sua em andamento, a missão não abre para ninguém",
      texto:
        "Crie a atividade — USAR BANCO PADRÃO (BIBLIOTECA) é um toque —, ponha em andamento e libere a missão na " +
        "sala de aula. São as duas portas: sem qualquer uma delas, a criança vê a missão fechada.",
    },
    {
      tom: "warning",
      titulo: "Não conte que as duas fotos são do mesmo lugar",
      texto:
        "A virada é a criança descobrir, tocando no relógio e no cartaz iguais e arrastando o slider. Na abertura, " +
        "conte só a aflição do Bento.",
    },
    {
      tom: "info",
      titulo: "A virada é um botão só, para a turma toda",
      texto:
        "Quem publica a capa espera em AGUARDE O PROFESSOR. O painel mostra quantos estão esperando; depois da " +
        "conversa, LIBERAR VIRADA abre a comparação para todos de uma vez — e não volta.",
    },
  ],

  objetivos: [
    "Reconhecer que uma foto publicada numa rede social é um recorte escolhido por alguém, e não o lugar inteiro.",
    "Escolher e enquadrar uma foto, apenas mudando a posição dela, e dar a ela uma legenda coerente.",
    "Comparar duas fotos e encontrar os detalhes iguais do fundo que provam que é o mesmo lugar, no mesmo momento.",
    "Dizer o que ficou fora da própria foto e por que isso muda o que quem vê entende.",
    "Aplicar a ideia a uma foto nova: uma foto bem de perto mostra só um pedaço, não tudo.",
  ],

  bncc: [
    {
      codigo: "EF02CO05",
      texto: "Reconhecer as características e usos das tecnologias computacionais no cotidiano dentro e fora da escola.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Na missão inteira, registrada no voto da horta (E6): a lupa no fundo das duas fotos (E2), o selo coerente " +
        "com a foto (E3), os dois objetos iguais achados sem ajuda (E4) e SÓ UM PEDAÇO na horta (E6).",
    },
    {
      codigo: "EF02CO01",
      texto: "Criar e comparar modelos (representações) de objetos, identificando padrões e atributos essenciais.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "E4, depois da virada: tocar nos dois objetos iguais do fundo nas duas fotos. Registrada quando os quatro " +
        "toques certos completam, pelo número de erros e se a ajuda acendeu.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Um aparelho por criança",
        texto:
          "Tablet ou computador da escola, com a sessão dela. Se a turma dividir aparelhos, monte as equipes na " +
          "criação da atividade — o painel conta por computador.",
      },
      {
        titulo: "Atividade em andamento e missão liberada",
        texto:
          "USAR BANCO PADRÃO (BIBLIOTECA), um dos pacotes prontos (Horta, Museu) ou um espaço da sua disciplina " +
          "gerado com IA. Na geração com IA, você toca nos dois objetos iguais do fundo antes de aprovar.",
      },
      {
        titulo: "O painel aberto na sua tela",
        texto:
          "A página da atividade, na aba Aula ao vivo: onde cada criança está, quantas aguardam a virada e o botão " +
          "LIBERAR VIRADA.",
      },
    ],
    pedagogico: [
      {
        titulo: "Leia a cena com o gabarito",
        texto:
          "O bloco abaixo mostra, de cada pacote pronto, o que a visitante diz para cada foto, os dois selos e os " +
          "dois objetos iguais do fundo. Não projete: a criança precisa achar sozinha.",
      },
      {
        titulo: "Ensaie a frase do arraste",
        texto:
          "Em toda atividade de arrastar foto — a capa, os pares e a segunda foto —, a orientação é a mesma: “Você " +
          "pode mover a foto, mas não mudar o tamanho.”",
      },
      {
        titulo: "Prepare os três cartões",
        texto:
          "ENQUADRAMENTO, AUTORIA e O QUE FICOU DE FORA: é com eles que você nomeia, na conversa, o que a criança " +
          "viveu na tela.",
      },
    ],
    naoDiga: [
      "Que as duas fotos são do mesmo lugar, ou do mesmo minuto.",
      "Qual foto ou qual selo é o certo: nenhuma foto é certa ou errada, as duas são verdadeiras.",
      "Onde estão o relógio e o cartaz: na busca, leia a instrução e acompanhe, sem apontar.",
    ],
  },

  roteiro: {
    total: "50 min (20 em tela, 30 de conversa)",
    linhas: [
      {
        tempo: "0–10",
        momento: "Acolhimento e apresentação do enigma",
        professor:
          "Conte a aflição do Bento: “O Bento postou uma foto da biblioteca e os ouvintes entenderam tudo errado. " +
          "Escolha seu crachá de repórter e investigue o mistério da capa!”",
      },
      {
        tempo: "10–12",
        momento: "E1 — o crachá",
        professor: "Cada criança escolhe o crachá e abre o rascunho: INVESTIGAR A NOVA CAPA.",
      },
      {
        tempo: "12–16",
        momento: "E2 — a lupa",
        professor:
          "Deixe explorar. Quem tenta pular vê OLHE O FUNDO; não aponte o relógio nem o cartaz.",
      },
      {
        tempo: "16–19",
        momento: "E3 — a capa",
        professor:
          "Repita: “Você pode mover a foto, mas não mudar o tamanho.” A criança escolhe a foto, enquadra, cola o selo " +
          "e toca em PUBLICAR CAPA — não volta.",
      },
      {
        tempo: "19–24",
        momento: "E4 — a visitante e a pausa",
        professor:
          "Leia com a criança a resposta da visitante e pergunte: “O que a visitante conseguiu conhecer pela foto? " +
          "O que ficou de fora?” A tela espera em AGUARDE O PROFESSOR.",
      },
      {
        tempo: "24–30",
        momento: "E4 — a virada",
        professor:
          "Com a conversa feita, libere. A tela divide em SUA FOTO e OUTRA FOTO: TOQUE EM 2 COISAS IGUAIS, o slider " +
          "da cena inteira e o “Marque … o que ficou fora da sua foto.” Acompanhe sem indicar os alvos.",
        botao: "LIBERAR VIRADA",
      },
      {
        tempo: "30–40",
        momento: "E5 — pares, segunda foto e os cartões",
        professor:
          "Leia “Junte duas fotos da mesma atividade.”, “O que é parecido?” e “Foto de leitura: o que precisa " +
          "aparecer?”, sem dar a resposta. Depois, nomeie com os cartões ENQUADRAMENTO, AUTORIA e O QUE FICOU DE FORA.",
      },
      {
        tempo: "40–50",
        momento: "E6 — a horta e o fechamento",
        professor:
          "A HORTA ACABOU? A criança responde sozinha. Feche com a pergunta-ponte: “Quando alguém tira uma foto sua " +
          "triste ou fazendo careta, você é daquele jeito o dia inteiro?”",
      },
    ],
    nota:
      "Em duas sessões de 20 a 30 min, a pausa natural é o PUBLICAR CAPA: a primeira vai da E1 à E3; a segunda " +
      "começa na visitante, com a virada e a conversa.",
  },

  debate: {
    aberturaNaLousa: "Uma foto mostra o lugar inteiro, ou só um pedaço?",
    tempo: "10 min, na conversa individual depois da virada",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "O que a visitante viu na sua foto? O que ela ainda não conhece?",
        porQue: "É a pausa do one-pager: a criança diz, com as palavras dela, o que a foto deixou ver.",
      },
      {
        nivel: "analise",
        pergunta: "A foto da mesa de silêncio era mentirosa? E a foto do fantoche no tapete?",
        porQue: "Desmonta a ideia de foto “certa” e “errada”: as duas são verdadeiras, e cada uma é um recorte.",
      },
      {
        nivel: "analise",
        pergunta: "Quem olhou só uma das fotos conseguiu adivinhar o que estava acontecendo do outro lado da sala?",
        porQue: "Leva da própria foto para quem vê a foto: o que fica fora não chega a ninguém.",
      },
      {
        nivel: "generalizacao",
        pergunta: "Quem tirou a foto escolheu mostrar tudo ou só um pedaço?",
        porQue: "Nomeia a AUTORIA: alguém escolheu o enquadramento.",
      },
      {
        nivel: "generalizacao",
        pergunta: "O que ficou de fora da sua foto que mudou o que os ouvintes pensaram da escola?",
        porQue: "Liga O QUE FICOU DE FORA ao que os ouvintes da rádio entenderam.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Quando tiram uma foto sua na escola em um segundo em que você está bravo, aquela foto mostra como você é o dia inteiro?",
        porQue: "Leva a descoberta para a própria vida da criança, antes da horta.",
      },
    ],
  },

  observacao: {
    intro: "Enquanto cada criança está na tela, observe sem intervir:",
    marcas: [
      { letra: "L", texto: "Explorou o fundo com a lupa antes de tentar avançar." },
      { letra: "M", texto: "Moveu a foto na moldura para escolher o que mostrar." },
      { letra: "R", texto: "Reagiu ao slider (“Olha lá!”, “Era o mesmo lugar!”)." },
    ],
    nota: "As marcas são para a conversa, não para nota: o nível de cada habilidade está no painel de habilidades.",
  },

  mediacao: [
    {
      quando: "A criança tenta aumentar ou diminuir a foto com os dedos.",
      faca: "Repita a regra: “Você pode mover a foto, mas não mudar o tamanho.” A moldura e a foto têm tamanho fixo.",
    },
    {
      quando: "Na busca dos objetos iguais, a criança toca em qualquer lugar.",
      faca:
        "Leia de novo TOQUE EM 2 COISAS IGUAIS e pergunte o que aparece nas duas fotos. Depois de 3 toques fora, a " +
        "tela pulsa sozinha sobre os dois objetos.",
      naoFaca: "Não aponte o relógio nem o cartaz: achar é o que a EF02CO01 registra.",
    },
    {
      quando: "A criança acha que escolheu a foto “errada”.",
      faca: "Diga que as duas fotos são verdadeiras: cada uma mostra um pedaço da mesma sala.",
    },
    {
      quando: "A tela demora em AGUARDE O PROFESSOR.",
      faca:
        "Converse com quem está esperando enquanto os outros publicam. Depois de 3 minutos o Bento diz O PROFESSOR " +
        "JÁ VEM!; a criança não consegue passar sozinha.",
    },
  ],

  depois: {
    sintese: [
      "Toda foto é uma escolha: ela mostra um pedaço do lugar e esconde o resto.",
      "Duas pessoas podem fotografar o mesmo lugar, no mesmo minuto, e mostrar ideias diferentes — sem nenhuma mentir.",
      "Os detalhes iguais do fundo provam que é o mesmo lugar.",
      "A legenda ajuda quem olha a entender o que a foto quis mostrar.",
    ],
    registro:
      "O painel de habilidades da atividade mostra o nível da EF02CO05 e da EF02CO01 por criança, com o critério de " +
      "cada nível; você pode ajustar. O que a criança marcou fora da foto, os pares e a segunda foto ficam no painel da " +
      "aula, para a conversa.",
    rubrica: {
      nota: "A régua de cada habilidade, com o critério de cada nível, está no bloco do material e no painel de habilidades.",
      criterios: [
        {
          criterio: "O recorte da foto (EF02CO05)",
          emDesenvolvimento: "Escolhe MOSTRA TUDO na horta e ainda deixa de lado a lupa, o selo ou os objetos iguais.",
          adequado: "Faz parte do caminho sozinho e parte com o alerta, a ajuda ou a sua mediação.",
          avancado: "Explora o fundo, cola o selo coerente, acha os objetos sem ajuda e escolhe SÓ UM PEDAÇO.",
        },
        {
          criterio: "Os atributos iguais (EF02CO01)",
          emDesenvolvimento: "Não acha os objetos iguais nem depois da ajuda da tela.",
          adequado: "Acha os objetos com a ajuda da tela.",
          avancado: "Acha os dois objetos nas duas fotos com menos de 3 erros.",
        },
      ],
    },
    desdobramentos: [
      "Semanas 3 e 4 da apostila: planejar uma foto em partes (o que entra, o que fica de fora, quem é o autor).",
      "Fotolegenda (Língua Portuguesa, EF12LP14): escrever, junto com a turma, a legenda de uma foto do mural da escola.",
      "Tirar duas fotos do mesmo canto da sala, uma de perto e uma de longe, e comparar o que cada uma conta.",
    ],
  },

  cuidados: [
    "Nenhuma foto é certa ou errada: não elogie a escolha de uma foto nem a de um selo.",
    "A missão não coleta foto, nome, rosto nem texto da criança: o crachá é a assinatura dela.",
    "Toque o podcast de recapitulação só depois da missão: ele conta a virada.",
  ],

  adaptacoes: [
    {
      contexto: "Aparelhos divididos",
      comoAdaptar:
        "Monte as equipes na criação da atividade: quem entra representa a equipe, e as outras crianças decidem " +
        "junto. A evidência vale para a equipe.",
    },
    {
      contexto: "Duas sessões",
      comoAdaptar: "A primeira vai da E1 ao PUBLICAR CAPA; a segunda começa na visitante, com a virada.",
    },
    {
      contexto: "Leitura ainda em formação",
      comoAdaptar:
        "Leia em voz alta cada instrução curta da tela; as opções têm foto ou pictograma e não exigem leitura sozinha.",
    },
  ],

  duvidas: [
    {
      pergunta: "Posso liberar a virada para uma criança só?",
      resposta:
        "Não: LIBERAR VIRADA é da turma toda (decisão de produto). Quem já publicou passa para a comparação; quem " +
        "publicar depois passa direto da visitante para a busca.",
    },
    {
      pergunta: "A IA gera alguma coisa na frente da criança?",
      resposta:
        "Não. A IA só entra no seu preparo, se você gerar um espaço novo, e nada chega à turma sem a sua aprovação.",
    },
    {
      pergunta: "E se a criança fechar o aparelho no meio?",
      resposta:
        "A sessão volta exatamente à etapa em que ela estava. Falha de conexão não conta como “não atingiu”: fica " +
        "“não avaliado”.",
    },
  ],
};
