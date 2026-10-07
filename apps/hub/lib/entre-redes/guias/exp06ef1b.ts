import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula da exp06ef1b — O Júri Estadual de Projetos, 6º ano, unidade 1.
 *
 * O que ele NÃO guarda, e vem da rota professor-only
 * `GET /juri-estadual/professor/material` como BLOCO VIVO
 * (`guia/material-do-juri.tsx`):
 *
 * - as QUATRO PERGUNTAS DA PLENÁRIA (`PERGUNTAS_DA_PLENARIA`, na api) — a
 *   mediação do pico, entre o voto e a galeria; o painel da aula mostra as
 *   mesmas frases ao lado do botão, e uma fonte só não diverge;
 * - a REGRA do feed (os pesos e o limiar que o motor executou), a ordem da
 *   cadeia e os cartões do caso Mariana COM o gabarito — é o que a turma lê e monta na tela, e descrever também é
 *   copiar.
 *
 * Por isso as perguntas de `debate.perguntas` abaixo NÃO são as da plenária:
 * são a escada do FECHAMENTO, depois do caso Mariana.
 *
 * NENHUM número de invisibilidade aqui (decisão de 2026-10-02): a taxa que a
 * Galeria Oculta mostra é a REAL de cada sessão, calculada na api, e varia de
 * computador para computador. Um percentual cravado no guia faria o professor
 * anunciar à turma um número que a tela de quase ninguém mostra.
 *
 * Fontes: o PRD (§5, as seis etapas; §8, os requisitos; §10, as telas e quem
 * fala), a copy revisada (`design/06-copy-strings-revisada.md`, §4) e a spec
 * do ambiente simulado (§8.5, o painel e o relógio da turma; §8.6, a
 * plenária; §10, os cenários de dispositivo). As habilidades são as da spec
 * v1.5.2, como na ficha da api: EF06CO10 (a principal), EF06CO01 e EF06CO03. A
 * EF06CO07 (os pacotes da curtida) saiu com a tela dela, a pedido do PO
 * (2026-10-06). A EF06CO10 é ancorada no livro didático da coleção (Rodrigo
 * Assis, Entre Redes, cap. 1): o consumo crítico das plataformas, a mediação
 * algorítmica e o afunilamento informacional.
 */
export const GUIA_EXP06EF1B: GuiaDaAula = {
  expId: "exp06ef1b",
  chamada:
    "Uma aula sobre o que o feed não mostra. A turma julga uma mostra científica estadual num aplicativo de " +
    "fotos, vota com certeza no melhor estande e descobre, na Galeria Oculta, que cada um julgou uma feira " +
    "diferente — montada pelas próprias curtidas. Depois, desmonta a engrenagem que fez isso.",

  avisos: [
    {
      tom: "error",
      titulo: "Não anuncie que a aula é sobre algoritmo, bolha ou filtro",
      texto:
        "Diga só que a turma foi convidada como jurada oficial para escolher o melhor projeto escolar do " +
        "estado. Dito antes, o tema faz todo mundo desconfiar do feed de propósito, e a descoberta da Galeria " +
        "Oculta — “eu tinha certeza de que tinha visto tudo” — não acontece.",
    },
    {
      tom: "warning",
      titulo: "Um botão só, e ele não volta",
      texto:
        "Na página da atividade, Liberar a Galeria Oculta abre a galeria para a turma inteira. Aperte depois " +
        "da plenária, com a maioria votada: quem ainda não votou continua no feed e entra na galeria quando " +
        "votar. Não há como fechar a galeria de novo nesta rodada.",
    },
    {
      tom: "info",
      titulo: "A taxa de invisibilidade é real, e muda de computador para computador",
      texto:
        "A Galeria Oculta mostra a cada computador a parte dos dezesseis estandes que não chegou ao feed dele, " +
        "calculada a partir do que ele fez. Quem curtiu duas vezes a mesma área recebeu só ela e vê a taxa mais " +
        "alta; quem não curtiu nada viu um feed mais misturado e vê uma taxa menor. Não anuncie um número: a " +
        "diferença entre as telas é o assunto da conversa.",
    },
  ],

  objetivos: [
    "Reconhecer que um feed que se adapta às curtidas mostra só uma parte do que existe, mesmo quando parece completo.",
    "Explicar que o aplicativo classificou cada curtida pela área do estande, agrupando os dados para decidir o que mostrar.",
    "Descrever com precisão a regra que o feed executou, na forma “se… então…”, e montar a cadeia interações, dados, algoritmo, bolha.",
    "Analisar criticamente o consumo de uma plataforma: perceber que o que se vê nela é mediado por um algoritmo e se afunila a cada interação, e auditar o que ficou de fora antes de decidir.",
    "Propor uma atitude para ver o que o feed esconde: buscar de propósito outros assuntos e conversar fora da rede antes de decidir.",
  ],

  bncc: [
    {
      /* A PRINCIPAL (o foco primário da spec), verbatim do complemento de
         Computação à BNCC — a mesma linha de
         `apps/api/src/curriculo/dados/habilidades-computacao.ts`. A ficha a
         mede pela auditoria da Galeria Oculta e pela enquete `p1` (a frase do
         jurado). O texto oficial fala em consumo de tecnologia; a missão o
         recorta como no livro didático da coleção. */
      codigo: "EF06CO10",
      texto:
        "Analisar o consumo de tecnologia na sociedade, compreendendo criticamente o caminho da produção dos recursos bem como aspectos ligados à obsolescência e a sustentabilidade.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Na Galeria Oculta e na enquete da frase do jurado. É o recorte do livro didático da coleção (Rodrigo Assis, Entre Redes, cap. 1): consumir uma plataforma de forma crítica, percebendo a mediação algorítmica — o feed escolhe o que chega à tela — e o afunilamento informacional que as próprias curtidas produzem. A criança audita os estandes que o feed escondeu antes de manter ou trocar o voto; o painel de habilidades lê quantos concorrentes ocultos ela foi ver e a resposta da enquete.",
    },
    {
      /* Verbatim do mesmo documento (sem ponto final, como lá). A ficha a mede
         pela busca por categoria na galeria e pela enquete `p2`. */
      codigo: "EF06CO01",
      texto: "Classificar informações, agrupando-as em coleções (conjuntos) e associando cada coleção a um ‘tipo de dados’",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Na Galeria Oculta: os dezesseis estandes aparecem agrupados pelas quatro áreas da mostra, cada uma com a sua hashtag, e a busca por hashtag é a chave de cada coleção. O painel de habilidades lê se a criança buscou a hashtag de outra área e abriu um estande que o feed escondeu dela, e a enquete sobre como o aplicativo organizou as curtidas.",
    },
    {
      /* Verbatim do mesmo documento. A ficha a mede pelas tentativas da cadeia
         e pela enquete `p3`. */
      codigo: "EF06CO03",
      texto: "Descrever com precisão a solução de um problema, construindo o programa que implementa a solução descrita.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Na cadeia do feed: a criança monta, com quatro blocos, a engrenagem que controlou o feed dela — interações do jurado, registro de dados e padrões, algoritmo de recomendação, formação de bolha temática — e, na enquete, escolhe a regra “se… então…” que o programa executou. Montar na primeira tentativa é o nível mais alto.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Libere a missão na sala de aula",
        texto:
          "Em Minhas turmas, na aba Missões da turma. Sem a liberação, o cartão fica com cadeado para as crianças.",
      },
      {
        titulo: "Crie a atividade com antecedência",
        texto:
          "A missão não tem banco pronto: os dezesseis estandes são escritos pela inteligência artificial sobre o seu tema. Na ficha, em Nova atividade, escolha o componente curricular, escreva o tema da feira e os assuntos da semana e gere a mostra. Sem saldo de geração com IA, a atividade não sai até o saldo voltar — por isso, prepare antes do dia.",
      },
      {
        titulo: "Revise os estandes antes de criar",
        texto:
          "São quatro áreas com quatro estandes cada. Leia o título, a legenda e o bastidor de cada um, edite o que quiser e regenere o estande que não servir. Nada gerado por inteligência artificial chega à turma sem passar por você.",
      },
      {
        titulo: "Aprove as imagens antes de abrir a turma",
        texto:
          "A aprovação tem duas fases. Primeiro os textos dos estandes; depois as imagens, que a inteligência artificial gera em seguida, duas por vez (pode levar alguns minutos). Confira cada imagem junto do estande, use Gerar outra imagem na que não servir e aprove: sem as imagens aprovadas, a atividade não vai ao ar. Estande sem imagem aparece com uma arte desenhada, marcado na grade antes de você aprovar.",
      },
      {
        titulo: "Revise as falas do podcast e gere o áudio, se for usá-lo",
        texto:
          "O podcast de recapitulação é seu: cerca de 3 minutos e 45 segundos em que Bia e Rafa retomam a missão com a turma. Ao criar a atividade, logo abaixo dos estandes, revise as três falas que citam a mostra — elas são aprovadas junto dos textos; o resto do roteiro é o mesmo para todas as turmas. O áudio fica em A aula e os resultados, com o botão Gerar o áudio do podcast, que sai um trecho por vez. A transcrição está sempre ao lado, mesmo sem áudio. O episódio conta a virada da missão: só toque depois da Galeria Oculta.",
      },
      {
        titulo: "Monte as equipes se faltar aparelho",
        texto:
          "Na criação da atividade, no passo das equipes. Com 2 a 4 estudantes por computador, combine o revezamento antes de começar (veja “Menos aparelhos que estudantes”, em Adaptações). O painel conta por computador.",
      },
      {
        titulo: "Deixe o painel aberto e o projetor pronto",
        texto:
          "O número de votos anda sozinho no painel, e é por ele que você decide a hora da plenária. O gráfico dos votos por área é para a lousa; a folha com os nomes, não.",
      },
    ],
    pedagogico: [
      {
        titulo: "Leia a regra do feed e o gabarito antes",
        texto:
          "Estão no bloco logo abaixo: quanto vale uma curtida, quando o feed se fecha numa área, a ordem da cadeia e os cartões do caso Mariana. Saber a regra é o que permite conduzir a plenária sem entregá-la.",
      },
      {
        titulo: "Prepare a plenária do pico",
        texto:
          "Entre o voto e a galeria, as telas esperam e você assume a palavra com o gráfico projetado. São cerca de oito minutos, com as quatro perguntas da seção do debate. É ali que a turma percebe que se dividiu sem saber por quê.",
      },
      {
        titulo: "Combine como a comissão decide",
        texto:
          "Com equipes, o voto é da comissão: em caso de divergência, decide a maioria de braços erguidos antes de confirmar. Não explique o revezamento como estratégia: ele é só para todo mundo tocar na tela.",
      },
    ],
    naoDiga: [
      '"Hoje vamos aprender sobre algoritmo" (nem bolha, nem filtro). Anunciado o tema, a turma desconfia do feed de propósito e a galeria não surpreende ninguém.',
      '"Curtam de vários assuntos" ou "não curtam nada". Qualquer conselho sobre o que curtir muda o feed que a aula precisa mostrar.',
      '"Todo mundo perdeu a mesma parte da mostra." A taxa é de cada computador, e nenhum número vale para a turma inteira: peça que comparem as telas.',
      '"Quem votou errado?" Não há voto errado: todo voto foi dado com o que cada feed mostrou, e é isso que a lousa revela.',
    ],
  },

  roteiro: {
    total: "1 aula · 50 min (24 em tela)",
    linhas: [
      {
        tempo: "0–5",
        momento: "Abertura: a credencial de jurado",
        professor:
          "Acolha a turma com seriedade institucional: foram convidados como jurados oficiais para escolher o melhor projeto escolar do estado. Não mencione algoritmo, bolha nem filtro. Se há equipes, combine o revezamento agora.",
      },
      {
        tempo: "5–15",
        momento: "O feed da mostra",
        professor:
          "Circule pela sala sem interferir no que cada um curte. Garanta o revezamento nos aparelhos divididos (posts 1 a 5 com o Jurado 1; 6 a 10 com o Jurado 2). Acompanhe no painel quantos já votaram.",
      },
      {
        tempo: "15–18",
        momento: "A cédula lacrada",
        professor:
          "Lembre que o voto é oficial e não volta. Quem votou vê a tela de espera da comissão, pedindo atenção à projeção da sala.",
      },
      {
        tempo: "18–26",
        momento: "A plenária (o pico)",
        professor:
          "Com a maioria votada, projete o painel de votação da turma e explore a divergência com as quatro perguntas do bloco do debate. Não diga ainda que o feed se adaptou: deixe a pergunta “como nos dividimos tanto?” no ar.",
      },
      {
        tempo: "26–36",
        momento: "A Galeria Oculta e a revisão do voto",
        professor:
          "Aperte depois da plenária. Cada computador vê os estandes que não chegaram ao feed dele, com a taxa real, busca por hashtag e mantém ou troca o voto. Quando a maioria tiver revisado, projete o gráfico dos votos depois da galeria e compare com o de antes.",
        botao: "Liberar a Galeria Oculta",
      },
      {
        tempo: "36–45",
        momento: "A cadeia, Mariana e as enquetes",
        professor:
          "Cada computador no próprio ritmo. A tela da cadeia abre ligando o que a turma viveu ao livro didático. Quem trava na cadeia recebe uma dica na tela, sem punição: pergunte o que veio primeiro, sem dizer a ordem. Quem termina antes lê o infográfico em silêncio.",
      },
      {
        tempo: "45–50",
        momento: "Fechamento",
        professor:
          "Conduza a escada do debate abaixo, ligue o caso Mariana ao que a turma viveu na mostra e feche com a síntese em voz alta. Se for usar o podcast de recapitulação (cerca de 3 min 45 s, com Bia e Rafa), toque aqui, depois da Galeria Oculta e da revisão do voto — nunca antes: ele conta a virada da missão.",
      },
    ],
    nota:
      "Em dois blocos de 25 min, corte depois da revisão do voto: no segundo, cada computador volta direto à cadeia, com tudo salvo. O que não se corta é a plenária entre o voto e a galeria — é ela que faz a turma ver junta que se dividiu.",
  },

  debate: {
    aberturaNaLousa: "Estávamos todos na mesma mostra. Por que cada um julgou uma feira diferente?",
    tempo:
      "Cerca de 8 minutos no pico, entre o voto e a galeria, com as quatro perguntas da plenária do bloco abaixo, e mais 5 no fechamento, com esta escada, depois do caso Mariana.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Quantos estandes chegaram ao seu feed, e quantos ficaram de fora? O número da sua tela foi igual ao do colega do lado?",
        porQue:
          "Começa pelo que está na tela de cada um, não pelo conceito. Os números diferentes são o fato a explicar: cada computador viu uma mostra diferente porque fez coisas diferentes no feed.",
      },
      {
        nivel: "analise",
        pergunta: "O que vocês fizeram que fez o feed mudar? Em que momento ele parou de mostrar as outras áreas?",
        porQue:
          "Liga a ação ao efeito. Cace a regra dita pela criança — “quando curti duas de robótica, só veio robótica” —, que é o “se… então…” da EF06CO03.",
      },
      {
        nivel: "analise",
        pergunta: "Um jurado disse que só viu robótica porque era a única área de verdade na feira. O que ele não percebeu sobre o aplicativo que usou?",
        porQue:
          "É a frase da enquete da EF06CO10, agora em voz alta: confundir o que foi recomendado com tudo o que existe. Leva ao consumo crítico da plataforma, como no capítulo 1 do livro didático — quem consome sem auditar acha que o feed é o mundo.",
      },
      {
        nivel: "generalizacao",
        pergunta: "O aplicativo separou as curtidas por área. Por que separar em grupos ajuda um sistema a decidir o que mostrar?",
        porQue:
          "Leva da mostra para a ideia de classificar dados em coleções (EF06CO01): sem saber de que área era cada curtida, o feed não teria como se fechar numa área só.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Mariana achou que a Chapa B não tinha apoio nenhum. Onde, na vida de vocês, um feed pode estar mostrando só um lado — e o que vocês fariam para ver o resto?",
        porQue:
          "Tira a lição da mostra e a leva para a rede de casa. Cace a atitude com as palavras da criança: procurar de propósito o outro lado e conversar fora da rede antes de decidir.",
      },
    ],
  },

  observacao: {
    intro:
      "Anote ao lado do nome (ou da comissão) durante o feed, a plenária e a galeria. Nada disso é nota — e nada disso é a taxa de invisibilidade, que descreve o feed, não a criança.",
    marcas: [
      { letra: "D", texto: "Desconfiou do feed antes da galeria: disse que faltava alguma coisa." },
      { letra: "B", texto: "Usou a busca por hashtag para procurar outra área, sem ninguém pedir." },
      { letra: "R", texto: "Explicou a troca (ou a manutenção) do voto pelo que viu na galeria." },
      { letra: "E", texto: "Descreveu a regra do feed com as próprias palavras, na forma “se… então…”." },
    ],
    nota:
      "Abrir estandes na galeria não comprova que entendeu: a folha é o que separa quem abriu de quem explicou. O E é a evidência que nenhum número do painel captura.",
  },

  mediacao: [
    {
      quando: "Alguém diz que o aplicativo “leu a mente” ou “adivinhou” o que ele gostava",
      faca:
        "Volte às pistas: o que você fez antes de o feed mudar? Cada curtida e cada parada longa num post foram dados que o aplicativo usou.",
      naoFaca: "Confirmar a mágica. A turma sai achando que o sistema sabe o que ela pensa, e não que ele segue uma regra.",
    },
    {
      quando: "O computador que não curtiu nada tem a taxa mais baixa da sala",
      faca:
        "É o contraste que a aula precisa: peça que compare a tela dele com a de quem curtiu duas vezes a mesma área. A diferença entre as duas é a curtida.",
      naoFaca: "Tratar quem não curtiu como quem “acertou”. Não curtir também é um dado, e a mostra dele também ficou incompleta.",
    },
    {
      quando: "A turma conclui que “então o certo é não curtir nada”",
      faca:
        "A curtida é uma pista para o sistema, não um erro. O que muda é saber disso e procurar o resto de propósito — a atitude do caso Mariana.",
      naoFaca: "Concordar. É o cartão distrator do caso Mariana: deixar de curtir e deixar o aplicativo decidir não fura bolha nenhuma.",
    },
    {
      quando: "Alguém compara a própria taxa com a do colega como se fosse nota",
      faca:
        "Diga que a taxa descreve o feed, não a pessoa, e que não há taxa certa. Na lousa só vão os votos por área e a média da turma, sem nomes.",
      naoFaca: "Ler em voz alta quem teve a taxa mais alta. Não há ranking nem exposição.",
    },
    {
      quando: "Um computador ainda não votou quando você liberou a galeria",
      faca:
        "Ele continua no feed, vota quando terminar e entra na galeria em seguida. Não espere todo mundo — espere a maioria.",
    },
    {
      quando: "A comissão não chega a um acordo sobre o voto",
      faca:
        "Decide a maioria de braços erguidos. Na dupla, quem está no toque da cédula decide, e o outro fica com a busca na galeria.",
    },
    {
      quando: "Um computador erra a ordem da cadeia várias vezes",
      faca:
        "Pergunte o que veio primeiro: o toque do jurado ou a resposta do aplicativo? E o que o aplicativo guardou antes de decidir?",
      naoFaca: "Dizer a ordem. Cada envio conta no painel de habilidades, e a dica da tela já não pune o erro.",
    },
  ],

  depois: {
    sintese: [
      "O feed não mostra tudo o que existe: ele escolhe, a partir do que a gente faz nele.",
      "Cada curtida vira um dado; o sistema agrupa os dados por assunto, e uma regra decide o que vem depois.",
      "Para ver o resto, é preciso procurar de propósito — buscar outros assuntos e conversar fora da rede antes de decidir.",
    ],
    registro:
      "As três enquetes nos Stories, respondidas por quem entrou no computador, depois do caso Mariana. A tela da criança não mostra nível nenhum; a auditoria da galeria, a busca por hashtag, a cadeia e as enquetes vão para o painel de habilidades, na página da atividade.",
    produto: {
      titulo: "A mostra inteira, no mural da sala",
      itens: [
        "Em grupos, cada um escolhe um estande de uma área que não chegou ao feed dele.",
        "Numa folha, o título do estande e uma frase sobre por que ele merecia ter sido visto.",
        "Uma linha final: o que o grupo faria, numa rede de verdade, para não perder um estande assim.",
      ],
    },
    rubrica: {
      nota:
        "Formativa, e sobre o RACIOCÍNIO — nunca sobre o voto nem sobre a taxa de invisibilidade. O painel de habilidades já traz a auditoria, a busca por hashtag, a cadeia e as enquetes; esta rubrica é para a conversa.",
      criterios: [
        {
          criterio: "Perceber o recorte",
          emDesenvolvimento: "Continua achando que viu a mostra inteira, mesmo depois da galeria.",
          adequado: "Reconhece que o feed mostrou só uma parte dos estandes.",
          avancado: "Explica que a parte que viu dependeu do que ele mesmo fez no feed.",
        },
        {
          criterio: "Descrever a regra",
          emDesenvolvimento: "Diz que foi sorte ou que o aplicativo adivinhou.",
          adequado: "Liga a curtida à mudança do feed.",
          avancado: "Descreve a regra na forma “se… então…”, com a área e a repetição da curtida.",
        },
        {
          criterio: "Agir diante da bolha",
          emDesenvolvimento: "Propõe parar de curtir e deixar o aplicativo decidir.",
          adequado: "Propõe procurar outros assuntos.",
          avancado: "Propõe buscar o outro lado e conversar fora da rede antes de decidir, como no caso Mariana.",
        },
      ],
    },
    desdobramentos: [
      "O podcast de recapitulação, em A aula e os resultados: toque para a turma no fim da aula ou no começo da seguinte, se ajudar a retomar a conversa — sempre depois da Galeria Oculta, porque ele revela o que o feed escondeu. Ele fala com os estudantes, mas quem decide quando ele toca é você.",
      "Na disciplina do tema da mostra: os estandes que ficaram de fora do feed da maioria são o material pronto da aula seguinte — a turma estuda o que quase ninguém viu.",
      "Língua Portuguesa: ler as legendas dos estandes como texto de divulgação científica — o que o título promete e o que a legenda entrega.",
      "Matemática: com os votos por área da lousa, calcular a parte de cada área e discutir como seria o gráfico se todo mundo tivesse visto os dezesseis estandes.",
      "No dia seguinte, peça que cada um repare num assunto que aparece muito no próprio feed e num que nunca aparece — sem mostrar o celular a ninguém.",
    ],
  },

  cuidados: [
    "A taxa da Galeria Oculta é real e de cada computador: não a apresente como nota nem compare em voz alta quem teve mais. Na lousa vão só os votos por área e a média da turma, sem nomes.",
    "A folha da turma, com os nomes, é para a sua tela, não para o projetor. Ela não tem voto nem taxa — só quem já votou, abriu a galeria, buscou, revisou e concluiu.",
    "Os estandes, as escolas e os perfis da mostra são fictícios, escritos pela inteligência artificial sobre o seu tema. Revise para não sair pessoa real identificável, escola real nem marca de empresa.",
    "Durante a aula o feed não usa inteligência artificial: é uma regra fixa, que roda no servidor e é a mesma que a cadeia ensina. A IA só escreve os estandes no preparo.",
    "A busca da galeria não guarda o que a criança digita: fica só se buscou por hashtag ou por texto, e a área que encontrou.",
    "Na rodada nova (Zerar a turma) com a mesma atividade, todas as habilidades são medidas de novo, mas a turma já sabe que o feed se adapta e o voto deixa de ser espontâneo. Para reaplicar, prefira uma atividade com outro tema.",
  ],

  adaptacoes: [
    {
      contexto: "Menos aparelhos que estudantes (2 a 4 por computador)",
      comoAdaptar:
        "Escolha as equipes na criação da atividade: só um da comissão entra, e ele representa o grupo. Combine o revezamento do toque antes de começar — Jurado 1: a rolagem e as curtidas dos posts 1 a 5; Jurado 2: os posts 6 a 10; Jurado 3: a cédula e o voto; Jurado 4 (ou a comissão reunida): a busca e a auditoria na Galeria Oculta. Com três, o Jurado 3 fica também com a galeria; com dois, um faz os posts 1 a 5 e a cédula, o outro os posts 6 a 10 e a galeria. Na divergência, vale a maioria de braços erguidos. Nos resultados, cada computador é uma linha.",
    },
    {
      contexto: "Um computador só (a aula projetada)",
      comoAdaptar:
        "Monte uma equipe só, com 1 computador, e projete o feed. A cada publicação a sala decide em voz alta se curte, e a turma vê nascer uma bolha coletiva. O botão continua no seu painel, noutra aba; na galeria, você abre com a turma os estandes que a sala inteira fez o feed esconder. A evidência chega para todos a revisar, até você confirmar no painel de habilidades.",
    },
    {
      contexto: "Sem projetor",
      comoAdaptar:
        "Leia em voz alta os votos por área e desenhe as quatro barras na lousa, com o nome de cada área. Depois da galeria, desenhe as barras de novo, ao lado. Nada de nomes na lousa.",
    },
    {
      contexto: "Duas aulas de 25 minutos",
      comoAdaptar:
        "No primeiro bloco, a credencial, o feed, o voto, a plenária e a galeria, até a revisão do voto. No segundo, cada computador volta direto à cadeia, com tudo salvo, e a aula fecha com Mariana, as enquetes e a escada do debate.",
    },
    {
      contexto: "Turma com leitura ainda em construção",
      comoAdaptar:
        "Leia a credencial e o caso Mariana em voz alta. Na comissão, um lê a legenda e o outro toca; a busca da galeria tem as hashtags prontas para tocar, sem digitar.",
    },
  ],

  duvidas: [
    {
      pergunta: "Preciso preparar alguma coisa antes?",
      resposta:
        "Sim: a missão não tem banco pronto. Crie a atividade sobre o seu tema (a geração dos dezesseis estandes pode levar perto de um minuto), aprove os textos e depois as imagens antes da aula — sem as imagens aprovadas, a atividade não vai ao ar. Estande sem imagem fica com a arte desenhada.",
    },
    {
      pergunta: "E se eu estiver sem saldo de geração com IA?",
      resposta:
        "A atividade não sai até o saldo voltar — o limite é diário. Por isso, prepare com antecedência. Uma atividade criada fica pronta na lista da turma e pode ser reaplicada com Zerar a turma.",
    },
    {
      pergunta: "Por que a taxa de um computador é diferente da do outro?",
      resposta:
        "Porque ela é real: é a parte dos dezesseis estandes que não chegou àquele feed. Quem curtiu duas vezes a mesma área recebeu só ela e vê a taxa mais alta; quem não curtiu nada viu um feed mais misturado e vê uma taxa menor. A diferença é o assunto da conversa.",
    },
    {
      pergunta: "Apertei Liberar a Galeria Oculta cedo demais. Dá para voltar?",
      resposta:
        "Não: o botão abre a galeria para a turma inteira e não fecha. Quem ainda não votou continua no feed e entra na galeria depois de votar. Para recomeçar do zero, use Zerar a turma — ele abre uma rodada nova sem apagar a anterior.",
    },
    {
      pergunta: "O estudante vê o nível da habilidade?",
      resposta:
        "Não. As enquetes respondem com uma confirmação neutra, e o crachá final é o mesmo para todos. O nível fica no painel de habilidades, que só você e a coordenação veem — e só você confirma e ajusta.",
    },
    {
      pergunta: "Posso aplicar de novo na mesma turma?",
      resposta:
        "Pode, com Zerar a turma — mas a turma já sabe que o feed se adapta, e a galeria não surpreende. Para reaplicar, prefira uma atividade nova, com outro tema: ela começa na rodada 1, e a anterior fica no histórico.",
    },
    {
      pergunta: "E se uma imagem não aparecer?",
      resposta:
        "O estande aparece com uma arte desenhada, com o título e a legenda inteiros, e a criança julga do mesmo jeito.",
    },
  ],
};
