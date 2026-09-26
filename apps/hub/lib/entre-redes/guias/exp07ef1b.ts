import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula da exp07ef1b — A Seleção, 7º ano, unidade 1.
 *
 * O que ele NÃO guarda, e vem da rota professor-only
 * `GET /a-selecao/professor/material` como BLOCO VIVO
 * (`guia/material-da-selecao.tsx`):
 *
 * - as TRÊS PERGUNTAS da Etapa 4 e o aviso de proteção do gap — verbatim do
 *   sheet (`design/06-copy-strings-revisada.md`, "Strings do professor"), e na
 *   api para que corrigir uma pergunta não exija republicar o hub;
 * - QUANDO apertar cada botão (`prof.gatilho.*`), a mesma frase que o painel
 *   da aula mostra ao lado do botão;
 * - as seleções do Tomás e da Malu e os 12 posts com as fichas — é o que a
 *   turma lê na tela, e descrever também é copiar.
 *
 * Por isso as perguntas de `debate.perguntas` abaixo NÃO são as três do
 * roteiro: são a escada para depois das fichas acesas, quando a turma já viu
 * quem cada post ouviu. As do roteiro são para o Mural nu.
 *
 * O que ele guarda é o que só existe aqui: o que NÃO dizer antes do Mural, a
 * condução de uma sala que acha que o colega "errou", e as duas adaptações que
 * esta missão trata de um jeito próprio — equipes (o Mural pareia
 * COMPUTADORES) e a aula projetada (o par é um colega virtual, e a evidência
 * chega "a revisar").
 */
export const GUIA_EXP07EF1B: GuiaDaAula = {
  expId: "exp07ef1b",
  chamada:
    "Uma aula sobre o poder de quem escolhe. Ninguém mente na cobertura: os doze posts são " +
    "verdadeiros. O ponto de virada é ver no Mural que o colega, com o mesmo feed, contou outra " +
    "história — e perceber que a sua também tinha um lado.",

  avisos: [
    {
      tom: "error",
      titulo: "Não leia as perguntas do debate antes do Mural",
      texto:
        "Aviso de proteção do gap: as três perguntas da Etapa 4 só depois que o Mural estiver na " +
        "tela. Lidas antes, elas dizem à turma o que procurar no feed — e a seleção deixa de ser " +
        "espontânea, que é justamente o que o Mural compara.",
    },
    {
      tom: "warning",
      titulo: "Um botão só conduz a aula, e ele não volta",
      texto:
        "Em A aula e os resultados, o mesmo botão mostra sempre a próxima etapa: Liberar Mural " +
        "da Turma, Revelar Fichas Técnicas e Liberar Conclusão Individual. Ele avança uma etapa " +
        "por vez, para a turma inteira, e não desfaz. Espere cerca de 80% dos computadores " +
        "publicarem antes do primeiro clique.",
    },
  ],

  objetivos: [
    "Selecionar conteúdos de um feed e publicá-los com uma legenda que justifique a escolha.",
    "Reconhecer que toda seleção de notícias destaca algumas vozes e deixa outras de fora, mesmo quando todos os fatos são verdadeiros.",
    "Comparar a própria publicação com a de um colega sobre o mesmo acontecimento, identificando quem cada uma ouviu.",
    "Tratar a versão do colega como legítima, mesmo quando ela contradiz a sua.",
  ],

  bncc: [
    {
      /* A PRINCIPAL, verbatim do complemento de Computação à BNCC (a mesma
         linha de `apps/api/src/curriculo/dados/habilidades-computacao.ts`).
         É a que a ficha pedagógica mede pela legenda (Canal A) e pela
         primeira enquete da Amara. */
      codigo: "EF07CO11",
      texto:
        "Criar, documentar e publicar, de forma individual ou colaborativa, produtos (vídeos, podcasts, web sites) usando recursos de tecnologia.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Etapas 2 e 3: o estudante garimpa o feed, poda os salvos até três, documenta a intenção editorial na legenda e publica nos Stories do grêmio — sem volta. A inteligência artificial lê a legenda e sugere um nível no painel de habilidades, que você confere.",
    },
    {
      /* Verbatim do mesmo documento. A segunda enquete da Amara mede esta. */
      codigo: "EF07CO08",
      texto: "Demonstrar empatia sobre opiniões divergentes na web.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 4: no Mural, a publicação do colega conta outra história com os mesmos fatos. A mediação pede que a turma entenda a escolha do outro antes de julgá-la, e a última enquete registra essa leitura.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Decida se vai trocar o tema",
        texto:
          "Sem preparo, a turma roda a cobertura curada da Unooria: a reforma e ocupação da praça central. Para um tema da sua cidade, vá em A aula e os resultados, escreva o evento, clique em Gerar Lote com IA, edite as legendas que quiser e clique em Aprovar Cobertura e Abrir Turma. Nenhum texto gerado por inteligência artificial chega à turma sem esse clique.",
      },
      {
        titulo: "Gere as imagens depois de aprovar",
        texto:
          "O botão Gerar imagens trabalha duas por vez e mostra quantas estão prontas; pode levar alguns minutos, então faça antes da aula. Post sem imagem aparece com a descrição da cena, e a missão roda igual. Os posts de números da cobertura curada já têm gráfico e não pedem imagem.",
      },
      {
        titulo: "Monte as equipes se faltar computador",
        texto:
          "Na ficha da missão, em Equipes desta turma. O Mural pareia COMPUTADORES: dois estudantes no mesmo aparelho nunca são pareados entre si. Veja “Menos aparelhos que estudantes”, em Adaptações.",
      },
      {
        titulo: "Deixe o painel aberto no seu computador",
        texto:
          "O número de computadores que publicaram anda sozinho, e é por ele que você decide a hora do Mural. O projetor é muito recomendado para o debate — sem ele, cada um vê a comparação na própria tela.",
      },
    ],
    pedagogico: [
      {
        titulo: "Leia os 12 posts e as fichas antes",
        texto:
          "Estão no fim da seção do debate. Conhecer as três lentes — quem cada veículo ouviu e que ângulo a imagem mostra — é o que permite reconhecer, no Mural, o que cada publicação deixou de fora.",
      },
      {
        titulo: "Prepare-se para quem escolhe “um de cada”",
        texto:
          "Algum estudante vai pegar um post de cada veículo achando que resolveu o problema. Não resolveu, e isso é material de debate: equilibrar também é escolher, e nove posts ficaram de fora do mesmo jeito.",
      },
      {
        titulo: "Mantenha o debate curto, em dois tempos",
        texto:
          "A avaliação pedagógica apontou que quinze minutos seguidos de conversa com a turma toda dispersam. A aula já divide o debate em dois: um com o Mural nu, outro com as fichas acesas. Cinco a oito minutos em cada.",
      },
    ],
    naoDiga: [
      '"Hoje vamos falar de viés" (nem de fake news). Anunciado o tema, a turma escolhe um de cada veículo para cumprir a regra, e o Mural deixa de mostrar o recorte de verdade.',
      '"Escolham os posts mais neutros." Não existe post neutro na cobertura — e a descoberta da aula é exatamente essa.',
      '"Esse veículo está mentindo." Nenhum mente: os doze posts são verdadeiros. O que muda é quem cada um ouviu.',
      '"Quem escolheu errado?" Não há seleção errada. A plataforma rotula a publicação (a lente de cada post), nunca a criança.',
    ],
  },

  roteiro: {
    total: "1 aula · 50 min",
    linhas: [
      {
        tempo: "0–3",
        momento: "O pedido da Amara",
        professor:
          "Deixe a mensagem falar sozinha. Se perguntarem o que é “o que realmente aconteceu”, devolva: é você quem decide.",
      },
      {
        tempo: "3–15",
        momento: "O feed e os salvos",
        professor:
          "Circule sem comentar fonte nem veículo. Quem travar, lembre só que no fim ficam exatamente três.",
      },
      {
        tempo: "15–20",
        momento: "A legenda e a publicação",
        professor:
          "Acompanhe no painel quantos computadores já publicaram. Quem publicou espera em silêncio, de propósito — não comente o conteúdo.",
      },
      {
        tempo: "20–28",
        momento: "O Mural da Turma",
        professor:
          "Com cerca de 80% publicado, peça atenção e aperte. Deixe a turma olhar os Stories pareados antes de qualquer pergunta; depois, as perguntas 1 e 2 do roteiro da Etapa 4.",
        botao: "Liberar Mural da Turma",
      },
      {
        tempo: "28–36",
        momento: "As fichas técnicas",
        professor:
          "Aperte depois de ouvir os primeiros comentários sobre as diferenças. As etiquetas mostram quem cada post ouviu; puxe a pergunta 3 e a escada abaixo.",
        botao: "Revelar Fichas Técnicas",
      },
      {
        tempo: "36–44",
        momento: "A conclusão individual",
        professor:
          "Os três cards e a mensagem final da Amara. Cada card segura 8 segundos: não apresse quem está lendo.",
        botao: "Liberar Conclusão Individual",
      },
      {
        tempo: "44–50",
        momento: "A reflexão e as enquetes",
        professor:
          "Diga antes que só você lê o texto, e deixe escrever em silêncio. Feche com a síntese em voz alta.",
      },
    ],
    nota:
      "Em dois blocos de 25 min, corte depois da publicação: a turma volta com tudo salvo, e o Mural abre o segundo bloco. O que não se corta é a espera entre publicar e abrir o Mural — é ela que faz a turma chegar junta.",
  },

  debate: {
    aberturaNaLousa: "Os fatos eram os mesmos. Por que as histórias ficaram tão diferentes?",
    tempo:
      "Cerca de 15 minutos, em dois tempos: as três perguntas do roteiro da Etapa 4 (no bloco abaixo) são para o Mural nu; as quatro desta escada, para quando as fichas acenderem.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta:
          "Quem cada post da sua publicação ouviu? Olhe a ficha técnica: a fonte ouvida e o ângulo da imagem.",
        porQue:
          "Começa pelo que está na tela, não pelo julgamento. Nomear a fonte a partir da ficha — a prefeitura, os moradores, os números — é o que a criança leva para o celular dela.",
      },
      {
        nivel: "analise",
        pergunta:
          "Por que a sua seleção pendeu para esse lado? Foi a imagem, a legenda, as curtidas?",
        porQue:
          "Põe o mecanismo à vista: nessa idade se julga pela forma, e a foto bonita da maquete puxa a escolha tanto quanto o texto. Ninguém precisa dizer que errou para responder.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Dá para publicar uma cobertura sem escolher um lado? E quem escolheu um post de cada veículo — o que ficou de fora mesmo assim?",
        porQue:
          "É a ilusão da neutralidade, o primeiro card da conclusão. Deixe a turma chegar lá antes do card: a resposta útil é que decidir o que mostrar já é tomar um lado.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Pense numa notícia sobre a nossa cidade que você viu esta semana. Quem estava falando nela — e quem não apareceu?",
        porQue:
          "Tira a lição da ficção e a leva para o feed de verdade. Cace o verbo: perguntar quem foi ouvido. É a mesma pergunta que a reflexão final faz sobre o repórter e a diretoria.",
      },
    ],
  },

  observacao: {
    intro:
      "Anote ao lado do nome (ou da equipe) durante o Mural e o debate. Nada disso é nota — e nada disso é “qual lente ele escolheu”, que a plataforma já mostra sem julgar.",
    marcas: [
      {
        letra: "C",
        texto:
          "Comentou a diferença entre a própria publicação e a do colega antes de você perguntar.",
      },
      {
        letra: "F",
        texto:
          "Nomeou quem foi ouvido (a prefeitura, os moradores, os números) em vez de dizer que o outro errou.",
      },
      {
        letra: "O",
        texto:
          "Disse o que ficou de fora da própria seleção — não só da do colega.",
      },
      {
        letra: "E",
        texto:
          "Defendeu a publicação do colega como verdadeira, mesmo discordando dela.",
      },
    ],
    nota:
      "O E é a evidência que nenhum número do painel captura: a empatia com a versão do outro acontecendo em voz alta. A última enquete da Amara mede a mesma habilidade, num toque.",
  },

  mediacao: [
    {
      quando: "Alguém diz que o colega “errou” ou “mentiu” na publicação",
      faca:
        "Volte à ficha: o post do colega é verdadeiro, só ouviu outra fonte. Pergunte o que aquela escolha mostra que a outra não mostra.",
      naoFaca:
        "Concordar que alguém escolheu errado. Não há seleção errada, e a próxima turma aprende a esconder o que escolheu.",
    },
    {
      quando: "A turma conclui que “então tudo é mentira”",
      faca:
        "Não é: nenhum veículo mentiu. A lição é perguntar quem foi ouvido, não desconfiar de tudo.",
      naoFaca: "Deixar passar. É a conclusão errada mais comum desta aula, e ela produz cinismo em vez de critério.",
    },
    {
      quando: "O Mural de alguém mostra o Tomás ou a Malu",
      faca:
        "Diga que é uma seleção pré-gravada, escolhida para contrastar com a dele: acontece com quem publicou depois do Mural aberto, com a sala ímpar ou com a sala de um computador só. A comparação vale igual.",
    },
    {
      quando: "Um computador ainda não publicou quando você abriu o Mural",
      faca:
        "Ele continua no feed e publica quando terminar: recebe o par na hora (um colega virtual, se não houver outro livre) e alcança a turma. Não espere todo mundo — espere cerca de 80%.",
    },
    {
      quando: "A legenda não passa e aparece um aviso para reescrever",
      faca:
        "A legenda vai aparecer para outro colega no Mural, então link, telefone, e-mail, marcação de @ e palavrão são barrados. As contas dos veículos (@folhaoficial_, @voz_coletiva, @metrica_urbana) podem ser citadas — citar a fonte é justamente o que a missão espera.",
    },
    {
      quando: "Alguém usa a legenda para provocar o colega",
      faca:
        "O filtro barra link, telefone e palavrão, não uma frase maldosa. Leia o Mural com a turma e interrompa: a legenda fala da cobertura, não de quem vai lê-la.",
    },
  ],

  depois: {
    sintese: [
      "Escolher o que publicar já é contar a história por um lado.",
      "Os fatos podem ser todos verdadeiros e a história, mesmo assim, ficar pela metade.",
      "Antes de acreditar numa cobertura, pergunte: quem foi ouvido, e quem ficou de fora?",
    ],
    registro:
      "A reflexão individual da Etapa 6 — o repórter que cobre a reforma de uma escola ouvindo só a diretoria. Fica na folha da turma, e só você a lê. As duas enquetes da Amara, logo depois, alimentam o painel de habilidades.",
    produto: {
      titulo: "Os Stories da turma: a cobertura por inteiro",
      itens: [
        "Em grupos, escolham três posts que, juntos, ouçam as três lentes — e digam o que ainda ficou de fora.",
        "Uma legenda coletiva que cite quem foi ouvido em cada post.",
        "Uma linha final: a voz que nenhum dos doze posts ouviu, e onde a turma a procuraria.",
      ],
    },
    rubrica: {
      nota:
        "Formativa, e sobre o RACIOCÍNIO — nunca sobre qual lente a criança escolheu. O painel de habilidades já traz a leitura da legenda (sugerida pela IA, que você confere) e as enquetes; esta rubrica é para a conversa e para a reflexão escrita.",
      criterios: [
        {
          criterio: "Justificar a seleção",
          emDesenvolvimento: "A legenda diz que os posts são “os melhores”, sem dizer por quê.",
          adequado: "A legenda diz o que os três posts mostram sobre o acontecimento.",
          avancado: "A legenda nomeia quem foi ouvido e admite o que ficou de fora.",
        },
        {
          criterio: "Reconhecer o recorte",
          emDesenvolvimento: "Acha que a própria publicação conta a história toda.",
          adequado: "Percebe que a do colega mostra algo que a sua não mostrou.",
          avancado: "Explica que toda seleção deixa vozes de fora, inclusive a “equilibrada”.",
        },
        {
          criterio: "Respeitar a versão do outro",
          emDesenvolvimento: "Diz que o colega errou ou foi enganado.",
          adequado: "Aceita que a publicação do colega também é verdadeira.",
          avancado: "Usa a publicação do colega para completar a própria leitura do acontecimento.",
        },
      ],
    },
    desdobramentos: [
      /* Os dois códigos de Língua Portuguesa são os que a spec da missão
         conecta, conferidos em `apps/api/src/curriculo/dados/habilidades-ef.ts`.
         O texto abaixo segue as palavras deles sem citá-los por inteiro. */
      "Língua Portuguesa: comparar notícias e reportagens sobre um mesmo fato divulgadas em diferentes mídias (EF07LP02) — os três veículos são o material pronto.",
      "Língua Portuguesa: identificar em notícias o fato central e a perspectiva de abordagem (EF69LP03) — reescrever um post ouvindo uma voz que ele deixou de fora.",
      "Leitura do bimestre: A Reportagem Que Não Saiu, o jornal que encerrou o caso ouvindo só o secretário da prefeitura. Peça que a turma diga quem mais deveria ter sido ouvido.",
    ],
  },

  cuidados: [
    "A legenda aparece para o colega pareado no Mural, com o primeiro nome de quem publicou (ou o nome da equipe). O filtro barra link, telefone, e-mail, @ e palavrão, mas não uma frase maldosa: leia o Mural com a turma.",
    "A reflexão é lida só por você. A coordenação vê apenas que ela foi entregue. Diga isso em voz alta antes de liberar a conclusão: é o que faz a criança escrever o que pensa, e não o que soa bem.",
    "A inteligência artificial lê a legenda e sugere um nível da EF07CO11 no painel de habilidades. O estudante não vê o nível, e a sugestão não é nota: confira e corrija o que não concordar. Quando a IA não responde, fica “Não avaliado” e quem decide é você.",
    "Se você trocar o tema por um acontecimento real e quente da cidade, avise que os posts foram escritos para a aula — senão a família recebe em casa uma notícia que nasceu aqui. E evite pessoa real identificável no tema: o gerador recusa, mas quem aprova é você.",
  ],

  adaptacoes: [
    {
      contexto: "Menos aparelhos que estudantes.",
      comoAdaptar:
        "Monte as equipes em “Equipes desta turma”, na ficha da missão (Minhas turmas → a turma → Conduzir com esta turma): um computador por equipe. Só um da equipe entra, e ele representa o grupo — a seleção e a legenda são negociadas em voz alta, e o Mural pareia COMPUTADORES, nunca dois estudantes do mesmo aparelho. Nos resultados da turma cada computador é uma linha, e o nível de quem entrou vale para a equipe. Na aula projetada, monte uma equipe só, com 1 computador: a turma escolhe junto no seu computador, o par no Mural é um colega virtual, e o resultado da evidência chega “a revisar” para todos até você confirmar, no painel de habilidades.",
    },
    {
      contexto: "Dois computadores, com a sala em duas alas",
      comoAdaptar:
        "Monte duas equipes (Ala A e Ala B), cada uma num computador projetado ou lado a lado. As duas alas são pareadas entre si no Mural — o contraste acontece entre as metades da sala, e o debate fica mais vivo.",
    },
    {
      contexto: "Turma com leitura ainda em construção",
      comoAdaptar:
        "Leia a mensagem da Amara em voz alta, uma vez, sem comentar. As legendas dos posts têm no máximo 45 palavras; em dupla, uma pessoa lê e a outra decide o que salvar.",
    },
    {
      contexto: "Sobrou tempo",
      comoAdaptar:
        "Peça que cada um reescreva a própria legenda citando uma voz que ficou de fora. É a aula do avesso, e mostra o quanto é difícil ouvir todo mundo em uma frase.",
    },
  ],

  duvidas: [
    {
      pergunta: "Preciso preparar alguma coisa antes?",
      resposta:
        "Não é obrigatório. A cobertura curada da Unooria roda sozinha, com os 12 posts e os gráficos prontos. Trocar o tema e gerar as imagens é opcional.",
    },
    {
      pergunta: "Os posts falam de um lugar de verdade?",
      resposta:
        "Não. A praça, os três veículos e as pessoas citadas são fictícios. Com um tema seu, a IA escreve sobre o seu evento, mas os veículos e a proporção — quatro posts de cada — são fixos.",
    },
    {
      pergunta: "Apertei o botão cedo demais. Dá para voltar?",
      resposta:
        "Não: o botão avança uma etapa por vez e não volta. Se o Mural abriu antes da hora, quem ainda não publicou continua no feed e publica depois, com o par na hora. Para recomeçar do zero, use Zerar a turma — ele abre uma rodada nova sem apagar a anterior.",
    },
    {
      pergunta: "A IA dá nota para a legenda?",
      resposta:
        "Não dá nota. Ela lê a legenda e sugere um de três níveis da EF07CO11 no painel de habilidades, que só você vê — e vale o melhor entre essa leitura e a primeira enquete. Você confere e corrige. O estudante não vê o nível.",
    },
    {
      pergunta: "Posso aplicar de novo na mesma turma?",
      resposta:
        "Pode, com Zerar a turma — mas com o mesmo tema a surpresa do Mural se perde, porque a turma já sabe que a cobertura tem lados. Para reaplicar, prefira um tema novo: ele vira uma atividade nova, e a anterior fica no histórico.",
    },
    {
      pergunta: "Quem vê a legenda e a reflexão?",
      resposta:
        "A legenda: você e o colega pareado no Mural. A reflexão: só você. A coordenação vê apenas que cada uma foi entregue — é texto escrito por menor de idade.",
    },
  ],
};
