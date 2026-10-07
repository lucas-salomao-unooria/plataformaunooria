import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula da exp04ef1b — Jornal da Escola: A Edição de Bento, 4º ano,
 * unidade 1.
 *
 * O que ele NÃO guarda, e vem da rota professor-only
 * `GET /jornal-escola/professor/material` como BLOCO VIVO
 * (`guia/material-do-jornal.tsx`):
 *
 * - as TRÊS PERGUNTAS da mediação e os dois GATILHOS orais (o que dizer ao
 *   liberar o resultado e ao liberar a revisão) — verbatim da copy revisada
 *   (`design/06-copy-strings-revisada.md`, §4b), e na api para que corrigir uma
 *   frase não exija republicar o hub; o painel da aula mostra as mesmas frases
 *   ao lado do botão;
 * - as oito notícias do banco padrão COM o gabarito e a reação do leitor, e os
 *   seis blocos da Chave com as iscas marcadas — é o que a turma lê na tela, e
 *   descrever também é copiar.
 *
 * Por isso as perguntas de `debate.perguntas` abaixo NÃO são as três do
 * resultado: são a escada do FECHAMENTO, depois da 2ª edição, quando a turma já
 * comparou as duas capas.
 *
 * A fonte da ordem e do tempo da aula é o PDF "proposta revisada" (§11), que
 * vence o PRD: 5 min de apresentação, 12 de exploração e escolha, 3 de montagem
 * e publicação, 10 de resultado e mediação, 15 de checagem e revisão e 5 de
 * fechamento. E três decisões do dono do produto (2026-09-25) que o one-pager
 * pedagógico ainda não tinha: a pergunta de motivo vem DEPOIS da publicação, o
 * professor tem DOIS portões (resultado e revisão), e o Bento não tem áudio.
 */
export const GUIA_EXP04EF1B: GuiaDaAula = {
  expId: "exp04ef1b",
  chamada:
    "Uma aula sobre publicar com responsabilidade. A turma monta a capa do jornal da escola com três de " +
    "oito notícias, vê o que a edição causou nos leitores e descobre que notícia bonita ou urgente não é o " +
    "mesmo que notícia confiável — antes de aprender a conferir de onde veio, quando aconteceu e quem assina.",

  avisos: [
    {
      tom: "error",
      titulo: "Não peça que abram as pistas antes da 1ª edição",
      texto:
        "As pistas de cada notícia — de onde veio, quando aconteceu, quem assina — estão na tela desde o " +
        "começo, e ninguém é obrigado a abri-las. A descoberta do resultado depende dessa escolha " +
        "espontânea: dito antes, “confiram a data” vira regra a cumprir, e a 1ª edição deixa de mostrar " +
        "como a turma escolhe de verdade (PDF §4).",
    },
    {
      tom: "warning",
      titulo: "Dois portões, num botão só, e ele não volta",
      texto:
        "Em A aula e os resultados, o mesmo botão mostra sempre a próxima etapa: primeiro Liberar " +
        "resultado, depois Liberar revisão. Ele avança uma etapa por vez, para a turma inteira, e não " +
        "desfaz. Entre os dois vem a conversa com as três perguntas.",
    },
  ],

  objetivos: [
    "Investigar uma notícia antes de publicá-la, conferindo de onde ela veio, quando aconteceu e quem a assina.",
    "Distinguir uma notícia antiga apresentada como atual de uma notícia falsa: a antiga pode ser verdadeira, o problema é usá-la como aviso de hoje.",
    "Reconhecer que um aviso sem autor ou sem confirmação não tem evidência suficiente para ir à capa.",
    "Revisar uma escolha própria a partir da evidência, e comparar o antes e o depois.",
    "Aplicar a mesma checagem a uma mensagem recebida no celular, fora do jornal.",
  ],

  bncc: [
    {
      /* A PRINCIPAL, verbatim do complemento de Computação à BNCC (a mesma
         linha de `apps/api/src/curriculo/dados/habilidades-computacao.ts`). A
         ficha pedagógica a mede pela 2ª edição e pelas duas perguntas finais. */
      codigo: "EF04CO08",
      texto: "Reconhecer a importância de verificar a confiabilidade das fontes de informações obtidas na Internet.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Na revisão e no desafio final: a turma troca as notícias sem evidência por verificadas na 2ª edição, e cada um responde a duas perguntas sobre um aviso de corte de água recebido no celular. O painel de habilidades lê as pistas abertas nas duas fases, a 2ª edição e as duas respostas.",
    },
    {
      /* Verbatim do mesmo documento. A ficha a mede pelas pistas abertas
         ANTES da 1ª publicação. */
      codigo: "EF15CO04",
      texto:
        "Aplicar a estratégia de decomposição para resolver problemas complexos, dividindo esse problema em partes menores, resolvendo-as e combinando suas soluções.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Na mesa, antes da 1ª edição: abrir as três pistas de uma notícia é desmontá-la em partes menores — de onde veio, quando aconteceu, quem assina — em vez de julgá-la inteira pela foto. Conta quem abriu os três tipos em pelo menos duas notícias.",
    },
    {
      /* Verbatim do mesmo documento. A ficha a mede pelas tentativas da Chave. */
      codigo: "EF15CO02",
      texto:
        "Construir e simular algoritmos, de forma independente ou em colaboração, que resolvam problemas simples e do cotidiano com uso de sequências, seleções condicionais e repetições de instruções.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Na Chave do Editor: montar a sequência da checagem com os três blocos certos, entre seis — três são iscas (foto, urgência, compartilhada). Formar na primeira tentativa é o nível mais alto; as iscas voltam para a bandeja e cada envio conta.",
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
        titulo: "Escolha o pacote de notícias",
        texto:
          "Sem preparo, a turma roda o banco padrão da Unooria, “Feira de Ciências e Notícias da Cidade”, já revisado. Em A aula e os resultados, Usar Banco Padrão o confirma em um toque. Para um tema da sua aula, escolha o componente curricular, escreva o tema e os tópicos, clique em Gerar Pacote de Notícias com IA, revise cada notícia — inclusive se ela pode ir para a capa e a reação do leitor —, revise também as três falas do podcast que contam a mesa e clique em Aprovar Pacote. Nada gerado por inteligência artificial chega à turma sem esse clique.",
      },
      {
        titulo: "Gere as imagens depois de aprovar",
        texto:
          "O botão Gerar imagens trabalha duas por vez e mostra quantas estão prontas; pode levar alguns minutos, então faça antes da aula. Notícia sem imagem aparece com o desenho do meio, e a missão roda igual.",
      },
      {
        titulo: "Gere o áudio do podcast, se for usá-lo",
        texto:
          "O podcast de recapitulação é seu: cerca de 3 minutos e 30 segundos em que Lucas e Clara, locutores da rádio da escola, retomam a missão com a turma. Fica em A aula e os resultados, com o botão Gerar o áudio do podcast, que sai um trecho por vez. As três falas que contam a mesa são as que você revisou ao criar a atividade; o resto do roteiro é o mesmo para todas. A transcrição está sempre ao lado, mesmo sem áudio.",
      },
      {
        titulo: "Monte as equipes se faltar aparelho",
        texto:
          "Na ficha da missão, em Equipes desta turma. Duplas é o arranjo recomendado: o painel conta por computador. Veja “Menos aparelhos que estudantes”, em Adaptações.",
      },
      {
        titulo: "Deixe o painel aberto e o projetor pronto",
        texto:
          "O número de computadores que publicaram anda sozinho, e é por ele que você decide a hora de liberar o resultado. O gráfico anônimo da turma é para projetar; o radar e a folha com nomes, não.",
      },
    ],
    pedagogico: [
      {
        titulo: "Leia as oito notícias e o gabarito antes",
        texto:
          "Estão no bloco logo abaixo, com a reação de cada leitor. Saber qual notícia é antiga, qual não tem confirmação e qual não tem assinatura é o que permite conduzir a conversa do resultado sem entregar a resposta.",
      },
      {
        titulo: "Combine como a dupla decide",
        texto:
          "Na 1ª edição, a dupla conversa e decide quem está no toque. Na revisão vale o veto: qualquer um pode tirar uma notícia da capa se apontar na tela a pista que falta — a fonte, a data ou a assinatura —, e quem estava no toque passa a vez. Não explique o veto antes do resultado: ele diria à turma o que procurar.",
      },
      {
        titulo: "Prepare a conversa entre os dois botões",
        texto:
          "São cerca de dez minutos, com o gráfico projetado e as três perguntas do bloco da seção do debate. É ali que a turma dá nome ao que viu nos balões dos leitores, antes de a Chave do Editor aparecer.",
      },
    ],
    naoDiga: [
      '"Hoje vamos aprender a identificar notícia falsa" (nem fake news). Anunciado o tema, a turma confere tudo para cumprir a regra, e a 1ª edição deixa de mostrar como ela escolhe.',
      '"Abram as três pistas antes de escolher." As pistas estão na tela para quem quiser; pedir que abram tira da aula a descoberta.',
      '"Essa notícia é mentira." A notícia antiga pode ser verdadeira, e a mensagem sem autor pode só não ter evidência. O que falta é prova para publicar.',
      '"Quem errou?" ou "Quanto vocês tiraram?" O número descreve a seleção de cada capa, não a criança, e não há ranking.',
    ],
  },

  roteiro: {
    total: "1 aula · 50 min",
    linhas: [
      {
        tempo: "0–5",
        momento: "Apresentação: o Bento e as três vagas",
        professor:
          "Forme as duplas e leia o desafio em voz alta: “Você é o editor do jornal da escola. Escolha três notícias para informar seus leitores e monte a edição de hoje.” O Bento não tem áudio — se a turma precisar, leia a fala dele também.",
      },
      {
        tempo: "5–17",
        momento: "Exploração e escolha na mesa",
        professor:
          "Circule sem comentar fonte, data nem autoria. O Bento fica calado de propósito. Quem travar, lembre só que a capa tem três vagas.",
      },
      {
        tempo: "17–20",
        momento: "Montagem e publicação da 1ª edição",
        professor:
          "A página se monta sozinha. Publicar é definitivo, e só depois a tela pergunta por que escolheram. Acompanhe no painel quantos computadores já publicaram; quem publicou espera, com curiosidades da imprensa.",
      },
      {
        tempo: "20–30",
        momento: "Resultado e mediação",
        professor:
          "Com a maioria publicada, aperte e projete o gráfico da turma. Cada computador vê as reações dos leitores e quantas das três notícias estavam verificadas. Conduza as três perguntas do bloco do debate — sem dizer quais notícias trocar.",
        botao: "Liberar resultado",
      },
      {
        tempo: "30–45",
        momento: "Checagem e revisão",
        professor:
          "Aperte depois da conversa. O Bento volta com a Chave do Editor; formada a Chave, cada vaga ganha um marcador e a dupla revisa a capa, publica a 2ª edição e compara as duas. Vale o veto na dupla.",
        botao: "Liberar revisão",
      },
      {
        tempo: "45–50",
        momento: "Fechamento",
        professor:
          "Cada um responde ao desafio final do aviso de corte de água, fora da redação. Feche com a comparação das duas capas e a síntese em voz alta.",
      },
    ],
    nota:
      "Em dois blocos de 25 min, corte depois da conversa do resultado e deixe a revisão para o segundo: a turma volta com tudo salvo, e Liberar revisão abre o segundo bloco. O que não se corta é a espera entre publicar e liberar o resultado — é ela que faz a turma ver os leitores junta.",
  },

  debate: {
    aberturaNaLousa: "Podemos confiar em tudo o que publicamos? O que precisamos conferir antes de informar outras pessoas?",
    tempo:
      "Cerca de 10 minutos entre os dois botões, com as três perguntas do bloco abaixo, e mais 5 no fechamento, com esta escada, depois de a turma comparar as duas edições.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "O que mudou da 1ª para a 2ª edição da sua capa? Qual notícia saiu, e qual entrou no lugar?",
        porQue:
          "Começa pelo que está na tela — as duas páginas lado a lado —, não pelo julgamento. Quem acertou de primeira também responde: o que confirmou que ela podia ficar?",
      },
      {
        nivel: "analise",
        pergunta: "Qual pista fez você trocar? Aponte na tela: foi a fonte, a data ou a assinatura?",
        porQue:
          "Liga a troca à evidência, que é o que a EF04CO08 pede. “Porque o marcador mandou” não basta: peça o campo que sustenta a decisão (PDF §9).",
      },
      {
        nivel: "generalizacao",
        pergunta: "Uma notícia antiga é sempre mentira? E uma mensagem sem autor?",
        porQue:
          "Nenhuma das duas: a antiga pode ser verdadeira, só não é de hoje; a sem autor pode só não ter prova. Deixe a turma chegar à diferença entre falso e sem evidência — é a distinção que o PDF §3 exige.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Se vocês receberem hoje à noite uma mensagem urgente dizendo que amanhã não vai ter aula, o que precisam olhar antes de acreditar e repassar no grupo?",
        porQue:
          "Tira a lição do jornal e a leva para o celular de casa. Cace as três perguntas do editor ditas pela criança, com as palavras dela: de onde veio, quando, quem assina.",
      },
    ],
  },

  observacao: {
    intro:
      "Anote ao lado do nome (ou da dupla) durante a mesa, a conversa e a revisão. Nada disso é nota — e nada disso é “quantas verificadas”, que a plataforma já mostra sem nome.",
    marcas: [
      { letra: "P", texto: "Abriu as pistas antes de escolher, sem ninguém pedir." },
      { letra: "V", texto: "Usou o veto na revisão: apontou na tela a pista que faltava." },
      { letra: "D", texto: "Distinguiu notícia antiga de notícia inventada, com as próprias palavras." },
      { letra: "E", texto: "Explicou a troca pela evidência (o campo), não pela aparência da notícia." },
    ],
    nota:
      "Abrir uma pista não comprova compreensão (PDF §11): a folha é o que separa quem abriu de quem entendeu. O D é a evidência que nenhum número do painel captura.",
  },

  mediacao: [
    {
      quando: "Alguém diz que a notícia antiga era “mentira”",
      faca:
        "Volte à pista da data: o fato aconteceu, só que em outro ano. Pergunte o que aconteceu com quem leu como se fosse de hoje — é o balão do leitor.",
      naoFaca:
        "Concordar que era falsa. A turma sai achando que conferir a data serve para achar mentira, e não para saber se o aviso vale agora.",
    },
    {
      quando: "A turma conclui que “mensagem sem autor é sempre falsa”",
      faca:
        "Não é: falta prova para publicar. A pergunta do editor é “dá para confirmar?”, não “é mentira?”.",
      naoFaca: "Deixar passar. É a conclusão errada mais comum desta aula, e ela troca critério por desconfiança.",
    },
    {
      quando: "Alguém pergunta “quanto eu tirei?” ou compara o próprio número com o do colega",
      faca:
        "Diga que o número descreve a capa, não a pessoa, e que a 2ª edição existe para mudá-lo. No projetor só vai o gráfico sem nomes.",
      naoFaca: "Ler em voz alta quem teve 0 de 3. Não há ranking nem exposição de quem errou (PDF §7).",
    },
    {
      quando: "Uma dupla acertou as três na 1ª edição",
      faca:
        "Na revisão ela confirma e explica as escolhas, sem precisar trocar nada. Peça que aponte a pista que sustenta cada notícia (PDF §9).",
    },
    {
      quando: "A 2ª edição de um computador não melhorou",
      faca:
        "Veja no radar qual notícia sem evidência continua nas capas e retome com a turma o critério que ainda falta — sem apontar o computador.",
    },
    {
      quando: "Um computador ainda não publicou quando você liberou o resultado",
      faca:
        "Ele continua montando a página e vê o resultado assim que publicar e disser por que escolheu. Não espere todo mundo — espere a maioria.",
    },
    {
      quando: "A dupla não chega a um acordo sobre uma notícia",
      faca:
        "Na 1ª edição decide quem está no toque, e o toque inverte na revisão. Na revisão vale o veto: quem apontar na tela a pista que falta tira a notícia.",
    },
  ],

  depois: {
    sintese: [
      "Notícia bonita ou urgente não é o mesmo que notícia confiável.",
      "Antes de publicar ou repassar, confira três coisas: de onde veio, quando aconteceu e quem assina.",
      "Uma notícia antiga pode ser verdadeira — o problema é usá-la como se fosse de hoje.",
    ],
    registro:
      "O desafio final da Etapa 6: duas perguntas sobre o aviso de corte de água, respondidas por quem entrou no computador. A síntese na tela é a mesma para todos, e a criança não vê nível nenhum; as respostas vão para o painel de habilidades, em A aula e os resultados.",
    produto: {
      titulo: "A capa da turma, no mural da sala",
      itens: [
        "Em grupos, escolham três notícias verificadas da mesa para uma capa coletiva.",
        "Ao lado de cada uma, escrevam à mão a pista que a sustenta: de onde veio, quando aconteceu ou quem assina.",
        "Uma linha final: a notícia que não foi para a capa, e o que faltaria para ela poder ir.",
      ],
    },
    rubrica: {
      nota:
        "Formativa, e sobre o RACIOCÍNIO — nunca sobre quantas notícias a capa acertou. O painel de habilidades já traz as pistas, a Chave e as perguntas finais; esta rubrica é para a conversa e para a revisão.",
      criterios: [
        {
          criterio: "Investigar antes de publicar",
          emDesenvolvimento: "Escolhe pela foto ou pela urgência, sem abrir as pistas.",
          adequado: "Abre as pistas de algumas notícias antes de escolher.",
          avancado: "Confere de onde veio, quando e quem assina antes de pôr qualquer notícia na capa.",
        },
        {
          criterio: "Distinguir antigo de inventado",
          emDesenvolvimento: "Chama de mentira toda notícia que não pode ir para a capa.",
          adequado: "Percebe que a notícia antiga aconteceu, só não é de hoje.",
          avancado: "Separa “falso” de “sem evidência” e explica a diferença com um exemplo da mesa.",
        },
        {
          criterio: "Justificar a revisão",
          emDesenvolvimento: "Troca porque o marcador mandou.",
          adequado: "Aponta a pista que faltava na notícia que saiu.",
          avancado: "Aponta a pista que sustenta cada notícia que ficou, inclusive as que não trocou.",
        },
      ],
    },
    desdobramentos: [
      "O podcast de recapitulação, em A aula e os resultados: toque para a turma no fim da aula ou no começo da seguinte, se ajudar a retomar a conversa. Ele fala com os estudantes, mas quem decide quando ele toca é você.",
      /* Os dois códigos de fora da Computação são os que o one-pager
         pedagógico conecta, conferidos em
         `apps/api/src/curriculo/dados/habilidades-ef.ts`. O texto segue as
         palavras deles sem citá-los por inteiro. */
      "Língua Portuguesa: identificar, em notícias, os fatos, os participantes, o local e o momento do fato noticiado (EF04LP14) — as oito notícias da mesa são o material pronto.",
      "História: as transformações dos meios de comunicação, da imprensa ao rádio, à televisão e à internet (EF04HI08) — a mesa tem uma notícia de cada meio, lado a lado.",
      "No dia seguinte, peça que cada um traga um aviso que recebeu em casa (sem nome de ninguém) e confira com a turma as três perguntas do editor.",
    ],
  },

  cuidados: [
    "O “X de 3 notícias verificadas” descreve a SELEÇÃO de cada capa na simulação: não é nota nem probabilidade de verdade, e é calculado pelo gabarito revisado antes da aula — nunca por um julgamento da inteligência artificial durante ela (PDF §6).",
    "Não há ranking nem exposição de quem errou: o gráfico para projetar não tem nomes, e a folha com nomes e o radar com a resposta de cada notícia são só para a sua tela.",
    "Em dupla, em equipe ou na aula projetada, o resultado não é avaliação individual: o desafio final respondido por quem entrou chega à equipe como “Copiado da equipe” no painel de habilidades, e quem confere é você (PDF §11).",
    "A inteligência artificial só escolhe o modelo da página (um de três) durante a aula: não escolhe notícia, não escreve nem corrige nada. Se ela não responder, um modelo automático monta a página (PDF §5).",
    "Se você gerar um pacote sobre um acontecimento real da cidade, avise que as notícias foram escritas para a aula — senão a família recebe em casa uma notícia que nasceu aqui. E nada de pessoa real identificável: todo o conteúdo é simulado (PDF §10).",
    "A referência fonte, data e autoria é provisória: se o material do 4º ano, 1º bimestre, trouxer outro critério ou outra ordem, siga o material (PDF §8).",
  ],

  adaptacoes: [
    {
      contexto: "Menos aparelhos que estudantes",
      comoAdaptar:
        "Monte as equipes em “Equipes desta turma”, na ficha da missão (Minhas turmas → a turma → Conduzir com esta turma): um computador por dupla ou grupo. Só um da equipe entra, e ele representa o grupo — a escolha é negociada em voz alta, e na revisão vale o veto. Nos resultados cada computador é uma linha, e o desafio final de quem entrou vale para a equipe, a revisar.",
    },
    {
      contexto: "Um computador só (a aula projetada)",
      comoAdaptar:
        "Monte uma equipe só, com 1 computador, e projete a mesa (PDF §11). Você abre cada notícia, a turma vota em voz alta, e você opera o jornal coletivo: adiciona, troca e publica. Os dois botões continuam no seu painel, noutra aba. O resultado não é de ninguém em particular: a evidência chega “a revisar” para todos até você confirmar, no painel de habilidades.",
    },
    {
      contexto: "Sem projetor",
      comoAdaptar:
        "Leia os números do gráfico em voz alta e desenhe na lousa as quatro faixas (0, 1, 2 e 3 de 3) com quantas capas caíram em cada uma. Nada de nomes na lousa.",
    },
    {
      contexto: "Turma com leitura ainda em construção",
      comoAdaptar:
        "Leia a fala do Bento e o desafio em voz alta — o Bento não tem áudio. Em dupla, uma criança lê a notícia e a outra toca nas pistas; os rótulos dos botões têm ícone.",
    },
    {
      contexto: "Sobrou tempo",
      comoAdaptar:
        "Peça que cada dupla escolha uma notícia que não foi para a capa e diga o que precisaria aparecer na pista para ela poder ir. É a checagem do avesso.",
    },
  ],

  duvidas: [
    {
      pergunta: "Preciso preparar alguma coisa antes?",
      resposta:
        "Não é obrigatório. O banco padrão da Unooria roda sozinho; Usar Banco Padrão o confirma em um toque. Um pacote sobre o seu tema e as imagens são opcionais.",
    },
    {
      pergunta: "Apertei Liberar resultado cedo demais. Dá para voltar?",
      resposta:
        "Não: o botão avança uma etapa por vez e não volta. Quem ainda não publicou continua montando a página e vê o resultado quando publicar. Para recomeçar do zero, use Zerar a turma — ele abre uma rodada nova sem apagar a anterior.",
    },
    {
      pergunta: "A inteligência artificial escolhe as notícias pela criança?",
      resposta:
        "Não. Na aula ela só escolhe um dos três modelos de página para as três notícias que a criança pôs na capa; não escreve, não troca e não corrige nada. Se não responder, um modelo automático monta a página e a missão segue.",
    },
    {
      pergunta: "Como a plataforma sabe se uma notícia está verificada?",
      resposta:
        "Pelo gabarito definido antes da aula: no banco padrão, revisado pela Unooria; num pacote seu, revisado por você no preparo, notícia por notícia. Nada é decidido durante a aula.",
    },
    {
      pergunta: "O estudante vê o nível da habilidade?",
      resposta:
        "Não. A síntese do desafio final é a mesma para todos. O nível fica no painel de habilidades, que só você e a coordenação veem — e só você confirma e ajusta.",
    },
    {
      pergunta: "Posso aplicar de novo na mesma turma?",
      resposta:
        "Pode, com Zerar a turma — mas com as mesmas notícias a descoberta se perde, porque a turma já sabe quais não podiam ir para a capa. Para reaplicar, prefira um pacote sobre outro tema: ele vira uma atividade nova, e a anterior fica no histórico.",
    },
    {
      pergunta: "E se uma imagem não aparecer?",
      resposta:
        "O cartão se desenha pelo meio — o ícone do jornal, do rádio, da TV — com o texto inteiro, e a criança decide do mesmo jeito.",
    },
  ],
};
