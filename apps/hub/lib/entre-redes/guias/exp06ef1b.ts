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
 * - a REGRA do feed (os pesos e o limiar que o motor executou) e as peças da
 *   regra SE … ENTÃO COM o gabarito — é o que a turma lê e monta na tela, e
 *   descrever também é copiar.
 *
 * Por isso as perguntas de `debate.perguntas` abaixo NÃO são as da plenária:
 * são a escada do FECHAMENTO, depois da regra.
 *
 * OS AJUSTES DO TIME (0.7.0, ADR-176, 2026-10-20), depois de rodar a missão: a
 * separação da EF06CO01 passou para o FEED — o "Salvar" do post abre as quatro
 * pastas da mostra, e o voto só fecha com todo estande visto numa pasta; a
 * tela "Organize o que você viu" saiu. O caso Mariana saiu: a regra encerra a
 * missão. E a Galeria Oculta deixou de mostrar a contagem por área e o feed
 * "sem as suas curtidas": a comparação é feita pela grade e pela lousa.
 *
 * QUARENTA estandes (PO, 2026-10-14): dez por área, e o feed de dez posts deixa
 * 30 de fora para TODO computador. A "taxa de invisibilidade" deixou de ser o
 * assunto — com o total igual para todos, ela não distingue ninguém. O que a
 * Galeria Oculta prova é O QUE sumiu, área por área, na grade de cada hashtag;
 * na lousa, depois da auditoria, a concentração do feed (quem curtiu × quem não
 * curtiu). Nenhum percentual é cravado aqui: os números
 * são os da api, de cada sessão.
 *
 * O PRD v2 (0.4.0) e o one-pager pedagógico aprovado pelo PO: a cédula tem
 * quatro elementos (sem cartão de motivo nem frase grifada), a revisão tem dois
 * botões, e a rodada de desvio SAIU — da Galeria Oculta em diante, cada
 * computador segue no próprio ritmo. Um botão só: Liberar Auditoria. O
 * roteiro segue a tabela do one-pager (§10): 50 min — 29 em tela até a 0.6.0, cerca de 24 sem o caso Mariana —, e o corte de
 * 25 + 25 depois do Passo 3. Sem rodízio de quem toca a tela (o one-pager diz
 * por quê). O podcast é o recurso fixo do fechamento, depois da Etapa 4.
 *
 * Fontes: o PRD v2 (§5, as seis etapas; §7, as telas; Anexo §9–§11), o
 * one-pager pedagógico e a copy revisada (`design/06-copy-strings-revisada.md`). As habilidades são as da
 * ficha 6 da api (ADR-176, sobre o Canal A puro da ADR-174, revisado pelo PO com a equipe pedagógica contra o
 * TEXTO OFICIAL): EF06CO01 (a principal), pelas pastas em que a criança guarda os estandes no feed, e EF06CO03,
 * pela regra SE … ENTÃO. A EF06CO10 saiu —
 * o texto oficial (consumo, obsolescência, sustentabilidade) não é o que a missão trabalha —, e a EF06CO07
 * (os pacotes da curtida) saiu antes, com a tela dela (2026-10-06).
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
      titulo: "Um botão só, e ele não volta: Liberar Auditoria",
      texto:
        "Na página da atividade, projete o Painel Coletivo de Votos da Turma, conduza as quatro perguntas da " +
        "plenária e só então aperte Liberar Auditoria: as telas da turma inteira destravam a Galeria Oculta. " +
        "Daí em diante cada computador segue no próprio ritmo — galeria, revisão do voto e a regra do feed, que " +
        "encerra a missão. Quem ainda não votou continua no feed, guarda os estandes nas pastas, vota e entra na " +
        "auditoria em seguida.",
    },
    {
      tom: "info",
      titulo: "O que sumiu é diferente para cada computador — e é por área",
      texto:
        "A mostra tem quarenta estandes, dez por área, e o feed mostra até dez: todo computador fica com a mesma " +
        "quantidade fora do feed. O que muda é QUAIS áreas sumiram. A Galeria Oculta mostra a cada um os estandes " +
        "que não chegaram, área por área, pelas hashtags. Quem curtiu duas vezes a mesma área recebeu quase só ela; " +
        "quem não curtiu nada viu as quatro misturadas. Peça que comparem as pastas da aba Jurado com as do " +
        "colega: a diferença entre as telas, área por área, é o assunto da conversa.",
    },
  ],

  objetivos: [
    "Reconhecer que um feed que se adapta às curtidas mostra só uma parte do que existe, mesmo quando parece completo.",
    "Classificar os estandes que viu, agrupando cada um na coleção (a área) a que pertence — como o aplicativo fez com cada curtida.",
    "Descrever com precisão a regra que o feed executou, montando-a na forma “se… então…”: a condição e a ação.",
    "Auditar a Galeria Oculta e buscar de propósito outras áreas antes de manter ou revisar a própria decisão.",
    "Propor uma atitude para ver o que o feed esconde: buscar de propósito outros assuntos e conversar fora da rede antes de decidir.",
  ],

  bncc: [
    {
      /* A PRINCIPAL desde a ficha 5 (ADR-174), verbatim do complemento de
         Computação à BNCC (sem ponto final, como lá) — a mesma linha de
         `apps/api/src/curriculo/dados/habilidades-computacao.ts`. A ficha a
         mede pelas PASTAS do feed, corrigidas no voto (ADR-176). */
      codigo: "EF06CO01",
      texto: "Classificar informações, agrupando-as em coleções (conjuntos) e associando cada coleção a um ‘tipo de dados’",
      eixo: "Pensamento Computacional",
      principal: true,
      ondeAcontece:
        "No próprio feed: ao salvar um post, a criança escolhe uma das quatro pastas da mostra, como as coleções de posts salvos de uma rede social. Cada pasta é uma coleção, e ela guarda cada estande na sua, como o aplicativo fez com cada curtida. O voto só fecha com todo estande visto numa pasta, e é no voto que a separação conta: uma tentativa, e o painel de habilidades lê quantos ela guardou certo (9 ou 10 de cada 10 atingem). O post mostra o perfil e a hashtag da área — a pasta certa está ao alcance de quem lê o post com atenção.",
    },
    {
      /* Verbatim do mesmo documento. A ficha a mede pela REGRA SE … ENTÃO. */
      codigo: "EF06CO03",
      texto: "Descrever com precisão a solução de um problema, construindo o programa que implementa a solução descrita.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Depois da revisão do voto: a criança monta a regra que o programa do feed executou, escolhendo a condição (SE) e a ação (ENTÃO) entre três peças cada. Uma tentativa — as duas certas atingem, uma fica em processo. Depois do envio, a tela mostra a regra certa ligada ao feed dela.",
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
        titulo: "Prepare a mostra: banco padrão ou personalizada",
        texto:
          "Na ficha, em Nova atividade. O caminho curto é um toque: Usar Banco Padrão Oficial — a Feira de Ciências e Sustentabilidade, com quarenta estandes prontos em quatro áreas, sem uso de IA (cerca de 2 minutos de preparo). Para trabalhar a sua matéria, escolha o componente curricular, o título da mostra e os assuntos da semana e toque em Gerar com IA: os textos saem em cerca de 1 minuto, e a revisão dos quarenta estandes e das imagens fica com você — faça antes do dia da aula. Se a escola estiver sem saldo de IA, o aviso aparece e o Acervo Padrão da Mostra entra com um toque.",
      },
      {
        titulo: "Na mostra personalizada, revise os estandes e as imagens",
        texto:
          "São quatro áreas com dez estandes cada, uma aba por área; a aba avisa quantos estandes daquela área precisam de ajuste. Leia o título, a legenda e o bastidor de cada um, edite o que quiser e regenere o estande que não servir. Depois vêm as imagens, que a inteligência artificial gera em seguida, quatro por vez: as quarenta levam vários minutos, então deixe a tela aberta enquanto saem. Confira cada uma, gere outra para a que não servir e aprove — sem isso, a atividade personalizada não vai ao ar. Nada gerado por inteligência artificial chega à turma sem passar por você. O banco padrão não passa por estas fases: os estandes usam as imagens do banco, e o que ainda não tiver imagem aparece com a arte desenhada da missão.",
      },
      {
        titulo: "O podcast de recapitulação é o fechamento fixo",
        texto:
          "“A Mostra que Ninguém Viu Inteira”: cerca de 3 minutos e 45 segundos em que Bia e Rafa recapitulam a missão. Na mostra personalizada, revise as três falas que citam a mostra, logo abaixo dos estandes; no banco padrão, o roteiro é o fixo. O áudio fica em A aula e os resultados (Gerar o áudio do podcast), com a transcrição sempre ao lado. Este podcast recapitula toda a missão e revela a virada pedagógica. Deve ser transmitido aos estudantes estritamente após a conclusão da Etapa 4, nunca antes da aula.",
      },
      {
        titulo: "Monte as equipes se faltar aparelho",
        texto:
          "Na criação da atividade, no passo das equipes. Com 2 a 4 estudantes por computador, não há rodízio obrigatório de quem toca a tela: a organização do grupo fica com você e com a turma (veja “Menos aparelhos que estudantes”, em Adaptações). O painel conta por computador.",
      },
      {
        titulo: "Deixe o painel aberto e o projetor pronto",
        texto:
          "O número de votos anda sozinho no painel, e é por ele que você decide a hora da plenária. Ao lado do nome de quem está com a cédula aberta e parada há mais de um minuto aparece um ícone de alerta: é a hora de passar pela mesa. O gráfico dos votos por área é para a lousa; a folha com os nomes, não.",
      },
    ],
    pedagogico: [
      {
        titulo: "Leia a regra do feed e o gabarito antes",
        texto:
          "Estão no bloco logo abaixo: quanto vale uma curtida, quando o feed se fecha numa área e as peças certas da regra. Saber a regra é o que permite conduzir a plenária sem entregá-la.",
      },
      {
        titulo: "Prepare a plenária do pico",
        texto:
          "Entre o voto e a galeria, as telas esperam e você assume a palavra com o gráfico projetado. São cerca de sete minutos, com as quatro perguntas da seção do debate. É ali que a turma percebe que se dividiu sem saber por quê.",
      },
      {
        titulo: "A comissão se organiza do seu jeito",
        texto:
          "Com equipes, o voto é da comissão, e o sistema não distingue quem está tocando a tela: registra o que for confirmado. Como o grupo divide o toque e decide uma divergência fica com você e com a turma.",
      },
      {
        titulo: "Saiba como o voto é revisado",
        texto:
          "A cédula tem só quatro elementos: o título, o projeto escolhido entre os que passaram pelo feed, a certeza e o botão de confirmar — e trava. Depois da auditoria, a revisão tem dois botões: Manter meu voto inicial, que só acende depois de abrir ao menos um estande oculto, e Confirmar Voto Revisado. Nada disso vira nota.",
      },
    ],
    naoDiga: [
      '"Hoje vamos aprender sobre algoritmo" (nem bolha, nem filtro). Anunciado o tema, a turma desconfia do feed de propósito e a galeria não surpreende ninguém.',
      '"Curtam de vários assuntos" ou "não curtam nada". Qualquer conselho sobre o que curtir muda o feed que a aula precisa mostrar.',
      '"Todo mundo perdeu a mesma parte da mostra." A quantidade fora do feed é a mesma para todos, mas as áreas que sumiram não: peça que comparem as telas área por área.',
      '"Quem votou errado?" Não há voto errado: todo voto foi dado com o que cada feed mostrou, e é isso que a lousa revela.',
    ],
  },

  roteiro: {
    total: "1 aula · 50 min (cerca de 24 em tela)",
    linhas: [
      {
        tempo: "0–5",
        momento: "Passo 1 — Desafiar: a credencial de jurado",
        professor:
          "Diga apenas: “Vocês foram nomeados jurados oficiais de uma mostra escolar estadual. O papel de vocês é avaliar os projetos no feed e votar no melhor da feira.” Não mencione algoritmo, bolha nem filtro. Em tela: 2 min.",
      },
      {
        tempo: "5–13",
        momento: "Passo 2 — Navegar: o feed da mostra",
        professor:
          "Circule pela sala observando as reações, sem interferir no que cada um curte. No topo do feed, a comissão pede que cada estande seja salvo na pasta da área dele: salvar não muda o feed, só curtir e parar num post mudam. Acompanhe no painel a barra de quem já votou. O feed tem teto de 8 minutos, contado desde a primeira rolagem: depois disso, a cédula abre sozinha.",
      },
      {
        tempo: "13–18",
        momento: "Passo 3 — Decidir: a cédula lacrada",
        professor:
          "Lembre que o voto é oficial e não volta. A cédula pede só o projeto e a certeza, e trava com o carimbo da comissão. Ela só fecha com todo estande visto numa pasta: se faltar algum, a cédula diz quantos — sem ajuda, a separação conta uma vez só, no voto. Se alguém ficar com a cédula parada por mais de um minuto, a tela dele lembra que a comissão aguarda, e o ícone de alerta aparece no seu painel. Em tela: 5 min.",
      },
      {
        tempo: "18–33",
        momento: "Passo 4 — Resultado: a lousa, a plenária e a auditoria",
        professor:
          "Com a maioria votada, projete o Painel Coletivo de Votos da Turma: a turma nota que cada grupo votou numa área diferente. Conduza as quatro perguntas da plenária e, depois de ouvir as respostas, aperte Liberar Auditoria. Cada computador abre a Galeria Oculta — o que ficou fora do feed dele, área por área, pelas hashtags —, busca e decide entre manter o voto ou confirmar um voto revisado. Na lousa, aparece quanto do feed caiu numa área só para quem curtiu e para quem não curtiu: é o contraste para a conversa. Em tela: 6 min; fora dela: 9.",
        botao: "Liberar Auditoria",
      },
      {
        tempo: "33–41",
        momento: "Passo 5 — Explicar: a regra do feed",
        professor:
          "Cada computador no próprio ritmo. A tela pede a regra que o aplicativo seguiu, em duas partes: a condição (SE) e a ação (ENTÃO). Uma tentativa só; depois, a tela mostra a regra certa e o que ela fez no feed de cada um, e a missão termina com o crachá homologado. Ligue a regra ao livro didático (A Bolha do Léo). Em tela: 3 min; fora dela: 5.",
      },
      {
        tempo: "41–50",
        momento: "Passo 6 — Refletir: o fechamento",
        professor:
          "Fora da tela: quem termina antes lê o infográfico do crachá em silêncio. Feche com a pergunta-ponte, que leva a lição da mostra para a vida da turma: “Em que outras situações da nossa vida a gente acha que ‘todo mundo concorda comigo’ só porque o nosso feed só mostra aquilo?” Depois, toque o podcast de recapitulação para a sala. Fora da tela: 9 min.",
      },
    ],
    nota:
      "Sem o caso Mariana, a missão ocupa cerca de 24 minutos em tela numa aula de 50 (eram 29, a ressalva que o PO tinha aceitado). Em duas aulas de 50 minutos: na primeira, os Passos 1 a 3 e uma roda sobre quem vocês acham que venceu, sem revelar o segredo; na segunda, a lousa, a auditoria e a regra. Em duas sessões de 25 minutos: corte depois do Passo 3 — o voto travado congela o progresso com segurança — e abra a segunda sessão projetando a lousa e liberando a auditoria.",
  },

  debate: {
    aberturaNaLousa: "Estávamos todos na mesma mostra. Por que cada um julgou uma feira diferente?",
    tempo:
      "Cerca de 7 minutos no pico, entre o voto e a auditoria, com as quatro perguntas da plenária do bloco abaixo, e mais alguns no fechamento, com esta escada, depois da regra do feed.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Quantos estandes ficaram em cada uma das suas pastas? As suas pastas ficaram iguais às do colega do lado?",
        porQue:
          "Começa pelo que está na tela de cada um, não pelo conceito. O total escondido é o mesmo para todos; as áreas, não — e essa diferença é o fato a explicar: cada computador viu uma mostra diferente porque fez coisas diferentes no feed.",
      },
      {
        nivel: "analise",
        pergunta: "O que vocês fizeram que fez o feed mudar? Em que momento ele parou de mostrar as outras áreas?",
        porQue:
          "Liga a ação ao efeito. Cace a regra dita pela criança — “quando curti duas de robótica, só veio robótica” —, que é o “se… então…” que ela montou na tela (EF06CO03).",
      },
      {
        nivel: "analise",
        pergunta: "Um jurado disse que só viu robótica porque era a única área de verdade na feira. O que ele não percebeu sobre o aplicativo que usou?",
        porQue:
          "Confundir o que foi recomendado com tudo o que existe. Leva ao uso crítico da plataforma, como no capítulo 1 do livro didático — quem não audita acha que o feed é o mundo.",
      },
      {
        nivel: "generalizacao",
        pergunta: "O aplicativo separou as curtidas por área. Por que separar em grupos ajuda um sistema a decidir o que mostrar?",
        porQue:
          "Leva das pastas que a criança montou para a ideia de classificar dados em coleções (EF06CO01): sem saber de que área era cada curtida, o feed não teria como se fechar numa área só.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Numa eleição do grêmio, alguém só vê vídeos de uma chapa e acha que a outra não tem apoio. Onde, na vida de vocês, um feed pode estar mostrando só um lado — e o que vocês fariam para ver o resto?",
        porQue:
          "Tira a lição da mostra e a leva para a rede de casa. Cace a atitude com as palavras da criança: procurar de propósito o outro lado e conversar fora da rede antes de decidir.",
      },
    ],
  },

  observacao: {
    intro:
      "Anote ao lado do nome (ou da comissão) durante o feed, a plenária e a galeria. Nada disso é nota — e nada disso é a contagem da Galeria Oculta, que descreve o feed, não a criança.",
    marcas: [
      { letra: "D", texto: "Desconfiou do feed antes da galeria: disse que faltava alguma coisa." },
      { letra: "B", texto: "Usou a busca por hashtag para procurar outra área, sem ninguém pedir." },
      { letra: "R", texto: "Explicou por que manteve ou revisou o voto pelo que viu na Galeria Oculta." },
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
      quando: "O computador que não curtiu nada viu as quatro áreas misturadas",
      faca:
        "É o contraste que a aula precisa: o número de escondidos é o mesmo para os dois, mas peça que ele compare as pastas da aba Jurado dele com as de quem curtiu duas vezes a mesma área. A diferença entre as duas telas é a curtida.",
      naoFaca: "Tratar quem não curtiu como quem “acertou”. Não curtir também é um dado, e a mostra dele também ficou incompleta.",
    },
    {
      quando: "A turma conclui que “então o certo é não curtir nada”",
      faca:
        "A curtida é uma pista para o sistema, não um erro. O que muda é saber disso e procurar o resto de propósito: buscar outros assuntos e conversar fora da rede antes de decidir.",
      naoFaca: "Concordar. Deixar de curtir e deixar o aplicativo decidir não fura bolha nenhuma.",
    },
    {
      quando: "Alguém compara as próprias pastas com as do colega como se fosse nota",
      faca:
        "Diga que as pastas descrevem o feed, não a pessoa, e que não há contagem certa. Na lousa só vão os votos por área e a concentração da turma, sem nomes.",
      naoFaca: "Ler em voz alta quem viu menos áreas. Não há ranking nem exposição.",
    },
    {
      quando: "Um computador ainda não votou quando você liberou a galeria",
      faca:
        "Ele continua no feed, vota quando terminar e entra na galeria em seguida. Não espere todo mundo — espere a maioria.",
    },
    {
      quando: "A comissão não chega a um acordo sobre o voto",
      faca:
        "A decisão é da comissão, do jeito que a turma combinou: o sistema registra o que for confirmado na tela. Peça que cada um diga em uma frase o que viu no feed, e deixe o grupo decidir.",
    },
    {
      quando: "Um computador está com a cédula aberta e parada há mais de um minuto",
      faca:
        "O ícone de alerta aparece ao lado do nome no seu painel, e a tela dele já lembrou que a comissão aguarda. Passe pela mesa e pergunte qual projeto chamou mais a atenção no feed.",
      naoFaca: "Sugerir um projeto. O voto é dele, com o que o feed dele mostrou.",
    },
    {
      quando: "Alguém pede ajuda para escolher a pasta de um estande ou montar a regra",
      faca:
        "Devolva a pergunta: sobre o que era esse estande? Na regra, o que você fez antes de o feed mudar, e o que o aplicativo fez depois?",
      naoFaca: "Dizer a área ou a peça certa. As duas tarefas são uma tentativa só, e o que a criança escolhe é o que vai para o painel de habilidades.",
    },
  ],

  depois: {
    sintese: [
      "O feed não mostra tudo o que existe: ele escolhe, a partir do que a gente faz nele.",
      "Cada curtida vira um dado; o sistema agrupa os dados por assunto, e uma regra decide o que vem depois.",
      "Para ver o resto, é preciso procurar de propósito — buscar outros assuntos e conversar fora da rede antes de decidir.",
    ],
    registro:
      "As pastas dos estandes e a regra do feed, feitas por quem entrou no computador. A tela da criança não mostra nível nenhum: as duas vão para o painel de habilidades, na página da atividade.",
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
        "Formativa, e sobre o RACIOCÍNIO — nunca sobre o voto nem sobre o que a Galeria Oculta contou. O painel de habilidades já traz as pastas dos estandes e a regra do feed; esta rubrica é para a conversa.",
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
          avancado: "Propõe buscar o outro lado e conversar fora da rede antes de decidir.",
        },
      ],
    },
    desdobramentos: [
      "O podcast de recapitulação, em A aula e os resultados, é o fechamento fixo da missão: toque para a sala no fim da aula, depois da Etapa 4 — ou no começo da seguinte, para retomar a conversa. Nunca antes da aula: ele conta a virada.",
      "Na disciplina do tema da mostra: os estandes que ficaram de fora do feed da maioria são o material pronto da aula seguinte — a turma estuda o que quase ninguém viu.",
      "Língua Portuguesa: ler as legendas dos estandes como texto de divulgação científica — o que o título promete e o que a legenda entrega.",
      "Matemática: com os votos por área da lousa, calcular a parte de cada área e discutir como seria o gráfico se todo mundo tivesse visto os quarenta estandes.",
      "No dia seguinte, peça que cada um repare num assunto que aparece muito no próprio feed e num que nunca aparece — sem mostrar o celular a ninguém.",
    ],
  },

  cuidados: [
    "A contagem da Galeria Oculta — o que ficou fora do feed, área por área — é de cada computador: não a apresente como nota nem compare em voz alta quem viu menos. Na lousa vão só os votos por área e, depois da auditoria, a concentração da turma, sem nomes.",
    "A folha da turma, com os nomes, é para a sua tela, não para o projetor. Ela não tem voto, concentração nem acerto — só quem já votou, separou os estandes, abriu a galeria, buscou, revisou e concluiu, e o alerta de quem está parado na cédula.",
    "Os estandes, as escolas e os perfis da mostra são fictícios — os do banco padrão e os escritos pela inteligência artificial sobre o seu tema. Na mostra personalizada, revise para não sair pessoa real identificável, escola real nem marca de empresa.",
    "Durante a aula o feed não usa inteligência artificial: é uma regra fixa, que roda no servidor e é a mesma que a criança monta no fim. A IA só escreve os estandes no preparo.",
    "A busca da galeria não guarda o que a criança digita: fica só se buscou por hashtag ou por texto, e a área que encontrou.",
    "Na rodada nova (Reiniciar Missão) com a mesma atividade, todas as habilidades são medidas de novo, mas a turma já sabe que o feed se adapta e o voto deixa de ser espontâneo. Para reaplicar, prefira uma atividade com outro tema.",
  ],

  adaptacoes: [
    {
      contexto: "Menos aparelhos que estudantes (2 a 4 por computador)",
      comoAdaptar:
        "Escolha as equipes na criação da atividade: só um da comissão entra, e ele representa o grupo. A dinâmica funciona normalmente: a comissão conversa e debate antes de clicar e confirmar o voto em conjunto. Não há rodízio obrigatório de quem toca a tela — a realidade de cada escola varia, e a organização dos grupos fica a seu critério. Nos resultados, cada computador é uma linha.",
    },
    {
      contexto: "Um computador só (a aula projetada)",
      comoAdaptar:
        "Monte uma equipe só, com 1 computador, e projete o feed. A cada publicação a sala decide em voz alta se curte, e a turma vê nascer uma bolha coletiva. O botão Liberar Auditoria continua no seu painel, noutra aba; na galeria, você abre com a turma os estandes que a sala inteira fez o feed esconder. A evidência chega para todos a revisar, até você confirmar no painel de habilidades.",
    },
    {
      contexto: "Sem projetor",
      comoAdaptar:
        "Anote no quadro quantos estudantes votaram em cada categoria e desenhe as quatro barras, com o nome de cada área. Depois da auditoria, desenhe as barras de novo, ao lado. Nada de nomes na lousa.",
    },
    {
      contexto: "Duas sessões de 25 minutos",
      comoAdaptar:
        "Na primeira sessão, os Passos 1 a 3: a credencial, o feed e o voto travado, que congela o progresso com segurança. A segunda retoma exatamente a partir da projeção da lousa: a plenária, Liberar Auditoria, a Galeria Oculta e a regra.",
    },
    {
      contexto: "Turma com leitura ainda em construção",
      comoAdaptar:
        "Leia a credencial e o pedido das pastas em voz alta. Os botões têm ícones universais (coração para curtir, lupa para buscar, cadeado no voto travado), e a busca da galeria tem as hashtags prontas para tocar, sem digitar.",
    },
  ],

  duvidas: [
    {
      pergunta: "Preciso preparar alguma coisa antes?",
      resposta:
        "Pouco. Com o Banco Padrão Oficial, um toque cria a atividade com os quarenta estandes prontos (cerca de 2 minutos). Para personalizar o tema, gere com IA (os textos saem em cerca de 1 minuto), revise os quarenta estandes e aprove as imagens antes do dia da aula: elas saem quatro por vez e levam vários minutos — sem as imagens aprovadas, a mostra personalizada não vai ao ar.",
    },
    {
      pergunta: "E se eu estiver sem saldo de geração com IA?",
      resposta:
        "A plataforma mostra o aviso e oferece o Acervo Padrão da Mostra com um toque: a aula acontece do mesmo jeito, com a Feira de Ciências e Sustentabilidade.",
    },
    {
      pergunta: "Por que todo mundo ficou com o mesmo número de estandes escondidos?",
      resposta:
        "Porque a mostra tem quarenta estandes e o feed mostra até dez: o número de escondidos é igual para todo mundo. O que muda é QUAIS áreas sumiram — compare as pastas e a grade da galeria, área por área. Quem curtiu duas vezes a mesma área recebeu quase só ela; quem não curtiu nada viu as quatro misturadas: a diferença entre as duas telas é a curtida.",
    },
    {
      pergunta: "Apertei Liberar Auditoria cedo demais. Dá para voltar?",
      resposta:
        "Não: o botão abre a Galeria Oculta para a turma inteira e não fecha. Quem ainda não votou continua no feed e entra na auditoria depois de votar. Para recomeçar do zero, use Reiniciar Missão (Zerar Turma) — ele abre uma rodada nova, e os votos da anterior ficam no histórico.",
    },
    {
      pergunta: "O estudante vê o nível da habilidade?",
      resposta:
        "Não. As pastas e a regra não dizem quem acertou, e o crachá final é o mesmo para todos. O nível fica no painel de habilidades, que só você e a coordenação veem — e só você confirma e ajusta.",
    },
    {
      pergunta: "Posso aplicar de novo na mesma turma?",
      resposta:
        "Pode, com Reiniciar Missão (Zerar Turma) — mas a turma já sabe que o feed se adapta, e a galeria não surpreende. Para reaplicar, prefira uma atividade nova, com outro tema: ela começa na rodada 1, e a anterior fica no histórico.",
    },
    {
      pergunta: "E se uma imagem não aparecer?",
      resposta:
        "O estande aparece com uma arte desenhada, com o título e a legenda inteiros, e a criança julga do mesmo jeito.",
    },
  ],
};
