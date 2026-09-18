import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula da exp-05 — 5º ano, unidade 1.
 *
 * O que ele NÃO guarda: as 8 mensagens do grupo. Elas vêm da rota
 * professor-only `GET /quem-mandou-isso/professor/material` como BLOCO VIVO
 * (`guia/quem-mandou-o-lote.tsx`), e por dois motivos. Primeiro, o lote é
 * PARAMETRIZÁVEL por turma: a professora escreve o tema da escola dela e gera o
 * grupo em cima disso, e um guia com o texto padrão projetaria uma mensagem que
 * ninguém recebeu. Segundo, é a regra dos blocos vivos — descrever também é
 * copiar, e a descrição é a cópia que ninguém atualiza (a do UnooTube dizia
 * "metade… a outra metade" quando a divisão real era 11 e 10).
 *
 * O que ele guarda é o que só existe aqui: a pedagogia do dedo rápido, o que
 * NÃO dizer antes da hora, e o cuidado com a criança que encaminhou a mentira
 * mais espalhada da sala e vai se reconhecer na barra mais longa do telão.
 */
export const GUIA_EXP_05: GuiaDaAula = {
  expId: "exp-05-quem-mandou-isso",
  chamada:
    "Uma aula em que a turma descobre o próprio comportamento, e não um conteúdo. O ponto de " +
    "virada não é saber qual mensagem era falsa: é ver no telão que a mentira mais encaminhada " +
    "da sala chegou longe pelo dedo de todo mundo, inclusive o dele.",

  avisos: [
    {
      tom: "error",
      titulo: "Sem o lote publicado por você, a missão não abre para ninguém",
      texto:
        "Esta missão nasce vazia: as mensagens falam da SUA escola, então não há conteúdo padrão " +
        "rodando sozinho. No painel da turma você escreve o assunto, gera (ou usa o lote curado " +
        "da Unooria, que já está lá pronto) e clica em Aprovar e publicar. Sem esse clique o " +
        "estudante entra e vê uma tela de espera.",
    },
    {
      tom: "warning",
      titulo: "Não anuncie que a aula é sobre notícia falsa",
      texto:
        "A missão mede o que a criança faz quando ninguém avisou que era para desconfiar. " +
        "Anunciado o tema, ela encaminha o que acha que você quer ver encaminhado — e a " +
        "revelação deixa de falar sobre ela. Diga só o que a direção diz: que o 5ºB vai ajudar a " +
        "organizar o que está circulando.",
    },
  ],

  objetivos: [
    "Reconhecer que encaminhar uma mensagem é uma escolha, e que ela leva a mensagem mais longe.",
    "Identificar as marcas que fazem uma mensagem parecer urgente: caixa alta, pressa, pedido de repasse, ameaça de perder alguma coisa.",
    "Comparar uma mensagem com quem a assina e com a data em que ela foi publicada antes de repassá-la.",
    "Formular, com as próprias palavras, o que fazer antes de encaminhar uma mensagem urgente sobre a escola ou o bairro.",
  ],

  bncc: [
    {
      /**
       * A PRINCIPAL, conferida VERBATIM no complemento de Computação à BNCC
       * (MEC, 2022 — `documentos-fonte/bncc/bncc-computacao-2022.pdf`; eixo
       * Cultura Digital, unidade "Segurança e responsabilidade no uso da
       * tecnologia"). O professor cola esta linha no plano que a coordenação
       * confere contra o documento: uma palavra trocada vira apontamento na
       * escola dele (ver `guias/tipos.ts`).
       *
       * Ela descreve a missão inteira — "distinguir os conteúdos confiáveis de
       * não confiáveis" é literalmente o que a criança faz entre entrar no
       * grupo e apertar "Confirmar envio".
       */
      codigo: "EF05CO08",
      texto:
        "Acessar as informações na Internet de forma crítica para distinguir os conteúdos confiáveis de não confiáveis.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "A Etapa 2 inteira: as oito mensagens chegam sem etiqueta, e o que separa o comunicado da coordenação do áudio do corredor é quem assina, o que dá para conferir e o que só apressa. A criança decide sem nenhuma dica na tela.",
    },
    {
      /* Código do 4º ano, retomado aqui de propósito: é a habilidade que a
         missão do UnooTube (exp-02, 4º · Unidade 1) introduziu, e esta cobra na
         prática — lá o estudante avaliava a fonte de um vídeo com calma, aqui
         ele decide em dez segundos, no grupo. Vale citar a retomada no plano. */
      codigo: "EF04CO08",
      texto:
        "Reconhecer a importância de verificar a confiabilidade das fontes de informações obtidas na Internet.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 2: quem assina o comunicado, quem gravou o áudio, e a data de 2022 no card do blog — as três pistas estão na tela, sem nenhum destaque.",
    },
    {
      /* Plurianual do 1º ao 5º, e é ela que sustenta a ÚLTIMA etapa: o dilema
         do tio não é sobre saber se a notícia é falsa — é sobre o que se faz
         com uma mensagem que se recebeu de alguém em quem se confia. Texto
         verbatim do mesmo documento. */
      codigo: "EF15CO09",
      texto:
        "Entender que as tecnologias devem ser utilizadas de maneira segura, ética e responsável, respeitando direitos autorais, de imagem e as leis vigentes.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Etapa 6: a pergunta do grupo da família. Encaminhar sem conferir é o uso irresponsável acontecendo na mão da criança, e o que ela escreve ali é o que pretende fazer da próxima vez.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Publique o lote da turma no painel — sem isso a aula não existe",
        texto:
          "Em Resultados da turma, escreva o assunto que está circulando na sua escola, escolha o gatilho emocional, gere com inteligência artificial se quiser, edite o que for preciso e clique em Aprovar e publicar. O lote curado da Unooria já está na tela: aprovar sem editar também é curadoria.",
      },
      {
        titulo: "Deixe o painel aberto no projetor desde o começo",
        texto:
          "As etiquetas de veracidade só aparecem depois que você inicia a revelação — até lá o telão mostra apenas quantas pessoas encaminharam cada mensagem, e projetá-lo não entrega nada.",
      },
      {
        titulo: "Confira a barra de prontidão antes de revelar",
        texto:
          "Ela diz quantos já confirmaram o envio ao Mural. Espere cerca de 90%: quando o telão acende, quem não confirmou para de poder encaminhar, e a escolha dele não entra na conta da sala.",
      },
      {
        titulo: "Não há mídia para preparar",
        texto:
          "O áudio do grupo é transcrito na tela e o player é simulado; a foto é uma legenda com o rótulo do que ela mostra; o episódio de fechamento é lido. Fone é bem-vindo, mas nada depende dele.",
      },
    ],
    pedagogico: [
      {
        titulo: "Use um assunto que a turma reconheça",
        texto:
          "Mudança na cantina, obra na quadra, horário do transporte. O reconhecimento é o que faz o dedo coçar — com um tema distante, a criança lê com calma e a missão mede outra coisa.",
      },
      {
        titulo: "Prepare-se para a sala que encaminha tudo",
        texto:
          "Acontece, e não é erro de aplicação: encaminhar as oito é a versão extrema do mesmo comportamento. Se for o caso, o debate começa em outra pergunta — o que aconteceu com o Mural quando tudo virou importante.",
      },
      {
        titulo: "Decida o que vai fazer com a criança que se reconhecer",
        texto:
          "Alguém vai perceber, em voz alta, que encaminhou a mensagem mais espalhada da sala. O telão é anônimo; se ela se expuser sozinha, o que a aula precisa é de você dizendo que foi exatamente isso que todo mundo fez — e não de um elogio à coragem dela.",
      },
    ],
    naoDiga: [
      '"Hoje vamos falar sobre notícias falsas." É a frase que desliga a missão: a partir dela a turma escolhe para a aula, não para o Mural.',
      '"Prestem atenção, tem mensagem mentirosa aí." Vira caça ao erro, e a criança passa a procurar o truque em vez de decidir como decidiria no celular dela.',
      '"Quem encaminhou a falsa?" Nem no debate. O telão é anônimo por desenho, e uma pergunta dessas transforma a revelação em confissão pública.',
      '"Era fácil ver que essa era mentira." Ela não era: o áudio tem voz de colega e o link é de um site real. Dizer isso ensina que quem caiu foi bobo, que é o oposto do que a aula conclui.',
    ],
  },

  roteiro: {
    total: "1 aula · 50 min",
    linhas: [
      {
        tempo: "0–5",
        momento: "O pedido da direção",
        professor:
          "Leia o convite em voz alta, do jeito que está na tela. Nada além disso: o 5ºB vai ajudar a organizar o que está sendo dito sobre a escola.",
      },
      {
        tempo: "5–20",
        momento: "O grupo da turma, e o Mural",
        professor:
          "Circule sem responder “essa é verdade?”. Devolva a pergunta: o que te faz achar que é? Quem travar no botão, lembre só que são 3 mensagens no mínimo e que o grupo continua abaixo.",
      },
      {
        tempo: "20–25",
        momento: "Confirmação e espera",
        professor:
          "Acompanhe a barra de prontidão no painel. Enquanto os últimos terminam, não comente nada do conteúdo — quem já confirmou está em silêncio de propósito.",
        botao: "—",
      },
      {
        tempo: "25–30",
        momento: "A revelação coletiva",
        professor:
          "Projete e aperte. Leia o telão com a turma: comece pela barra mais longa e pergunte o que aquela mensagem tinha, ANTES de dizer se era verdadeira.",
        botao: "Iniciar revelação coletiva",
      },
      {
        tempo: "30–42",
        momento: "O debate",
        professor:
          "As quatro perguntas abaixo, na ordem. A terceira é a que vira a chave: a responsabilidade é de quem inventou ou de quem repassou?",
      },
      {
        tempo: "42–50",
        momento: "A pergunta do tio, e o fechamento",
        professor:
          "Libere a reflexão e deixe escrever em silêncio. Feche com a síntese em voz alta — a frase precisa caber na boca de uma criança de 10 anos contando em casa.",
        botao: "Liberar reflexão final",
      },
    ],
    nota:
      "Em duas sessões de 25 min, corte depois da revelação: o debate abre a segunda sessão, com o telão já projetado. O que NÃO se corta é a espera entre confirmar e revelar — é ela que faz a turma chegar junta.",
  },

  debate: {
    aberturaNaLousa: "Por que a mentira correu mais rápido?",
    tempo:
      "12 minutos, e eles não são folga: é o único momento em que a turma vê que trinta pessoas leram as mesmas oito mensagens e espalharam a mesma.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta:
          "Qual foi a mensagem que mais gente encaminhou? O que ela tinha que fez todo mundo querer repassar na hora?",
        porQue:
          "Começa pelo que está no telão, não pelo julgamento. Nomear as marcas — caixa alta, pressa, “passa pra todo mundo” — é o que a criança leva para o celular dela; “era mentira” não é.",
      },
      {
        nivel: "analise",
        pergunta:
          "Ela era verdadeira ou falsa? E por que a mentira correu tão rápido enquanto o comunicado da coordenação, que era o mais completo, quase ninguém encaminhou?",
        porQue:
          "Põe o mecanismo à vista: a mensagem calma não corre porque não assusta. É a comparação que sustenta a aula inteira, e ela está desenhada no gráfico — ninguém precisa acreditar na sua palavra.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Quem foi o responsável por a mentira chegar à escola inteira: quem inventou ou quem ajudou a espalhar?",
        porQue:
          "É a virada. Deixe a turma discordar e não feche rápido — a resposta útil é “os dois”, e ela só vale se for deles. Quem inventou mandou para cinco pessoas; foram os outros vinte e cinco que a levaram até a direção.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Se você receber uma mensagem urgente sobre a escola ou sobre o bairro, qual é a primeira coisa a fazer antes de tocar em encaminhar?",
        porQue:
          "Tira a lição da ficção e a transforma em gesto. Cace o verbo: parar, olhar quem mandou, ver a data, perguntar para um adulto, procurar no site da escola. É a mesma resposta que vai para o campo escrito logo depois.",
      },
    ],
  },

  observacao: {
    intro:
      "Anote ao lado do nome durante a Etapa 2 e no debate. Nada disso é nota — e nada disso é “quantas falsas ele encaminhou”, que a plataforma não calcula de propósito.",
    marcas: [
      {
        letra: "P",
        texto:
          "Parou para reler antes de encaminhar alguma coisa. Vale mesmo que ela tenha encaminhado a falsa depois.",
      },
      {
        letra: "Q",
        texto:
          "Perguntou a um colega ou a você se alguma mensagem era verdade. É a checagem nascendo, e ela aparece como conversa, não como clique.",
      },
      {
        letra: "N",
        texto:
          "Nomeou uma marca da mensagem no debate (“tava em maiúscula”, “ele mandou passar adiante”) em vez de dizer só que era mentira.",
      },
      {
        letra: "R",
        texto:
          "Assumiu no debate que encaminhou sem conferir. É a fala mais valiosa da aula, e ela custa caro para uma criança de 10 anos.",
      },
    ],
    nota:
      "Um R vale mais que um N: a missão inteira existe para produzir esse reconhecimento, e ele não aparece em nenhum número do painel.",
  },

  mediacao: [
    {
      quando: 'Alguém pergunta "essa é verdade, professora?"',
      faca:
        "Devolva: o que te faz achar que é? E quem mandou essa? A pergunta é a tarefa, e responder por ela encerra a etapa antes de ela acontecer.",
      naoFaca: "Confirmar ou negar. Uma resposta sua se espalha pela sala em trinta segundos — literalmente o mecanismo da aula.",
    },
    {
      quando: "A turma inteira encaminhou tudo",
      faca:
        "Mude a pergunta do debate: se tudo foi para o Mural, o que a direção consegue fazer com ele? Selecionar é o trabalho, e não selecionar é uma resposta sobre o trabalho.",
      naoFaca: "Tratar como aplicação perdida. É o mesmo comportamento, na versão extrema.",
    },
    {
      quando: "Uma criança percebe em voz alta que encaminhou a mensagem mais espalhada",
      faca:
        "Assuma junto: foi o que quase todo mundo fez, e é por isso que o gráfico tem uma barra daquele tamanho. O telão é anônimo — quem se expôs foi ela, e o seu papel é fazer disso o argumento, não o exemplo.",
      naoFaca: "Elogiar a coragem dela. Vira prêmio por se expor, e a próxima turma aprende a se expor.",
    },
    {
      quando: "Alguém diz que nunca cairia nessa",
      faca:
        "Pergunte o que ela faria com o áudio do tio, no grupo da família, sobre a escola do bairro fechar. A distância cai quando a mensagem vem de alguém em quem ela confia.",
    },
    {
      quando: "A turma conclui que “não se pode acreditar em nada da internet”",
      faca:
        "Volte ao telão: o comunicado da coordenação era verdadeiro, a foto do mural era verdadeira, o professor estava certo. A lição não é desconfiar de tudo — é conferir quem mandou e quando.",
      naoFaca: "Deixar passar. É a conclusão errada mais comum desta aula, e ela produz cinismo em vez de critério.",
    },
  ],

  depois: {
    sintese: [
      "A mentira não corre sozinha pelo celular: é o dedo apressado que a faz voar longe.",
      "Mensagem que manda você repassar AGORA é a que mais merece um minuto de espera.",
      "Antes de encaminhar: quem mandou, quando foi, e onde dá para conferir.",
    ],
    registro:
      "A resposta escrita à pergunta do tio, no fim da missão. Fica no portfólio da criança, e é o que você lê depois, uma por uma, na folha da turma.",
    produto: {
      titulo: "O cartaz do 5ºB: antes de encaminhar",
      itens: [
        "As três perguntas que a turma decidir fazer antes de repassar qualquer mensagem, escritas com as palavras deles.",
        "A barra mais longa do telão desenhada no cartaz, com o número de quantos encaminharam — sem nome nenhum.",
        "Uma linha final assinada pela turma, com a data, para ficar na parede da sala.",
      ],
    },
    rubrica: {
      nota:
        "Formativa, e sobre o RACIOCÍNIO — nunca sobre o que a criança encaminhou. Quem caiu no boato fez exatamente o que a missão existe para tornar visível; pontuar isso seria dar nota pela armadilha ter funcionado.",
      criterios: [
        {
          criterio: "Reconhecer as marcas da urgência",
          emDesenvolvimento: "Diz que a mensagem era mentira, sem dizer o que nela indicava isso.",
          adequado: "Aponta uma marca concreta (caixa alta, pedido de repasse, pressa).",
          avancado: "Aponta a marca E explica que ela serve para você reagir antes de pensar.",
        },
        {
          criterio: "Conferir origem e data",
          emDesenvolvimento: "Não menciona quem mandou nem quando.",
          adequado: "Cita quem assina ou a data como critério de decisão.",
          avancado: "Usa os dois, e percebe que uma notícia real pode estar velha demais para servir.",
        },
        {
          criterio: "Assumir a própria parte na corrente",
          emDesenvolvimento: "A culpa é toda de quem inventou.",
          adequado: "Reconhece que quem repassa também espalha.",
          avancado: "Diz o que fará antes de encaminhar da próxima vez, com um gesto concreto.",
        },
      ],
    },
    desdobramentos: [
      /* O código aqui era `EF05LP01`, e ele é de ORTOGRAFIA — "grafar palavras
         utilizando regras de correspondência fonema-grafema" (conferido em
         `apps/api/src/curriculo/dados/habilidades-ef.ts`). A professora cola
         esta linha no plano de curso, a coordenação confere contra o documento,
         e ela leva o apontamento — que é exatamente o custo que a nota do bloco
         `bncc`, acima, diz querer evitar. A `EF05LP16` é a que descreve este
         desdobramento sem forçar nada: "comparar informações sobre um mesmo
         fato veiculadas em diferentes mídias e concluir sobre qual é mais
         confiável e por quê". O texto abaixo segue as palavras dela de
         propósito. */
      "Língua Portuguesa: comparar o comunicado da coordenação com o boato em caixa alta (EF05LP16) — o mesmo fato em dois lugares, e qual dos dois é mais confiável, e por quê.",
      "Matemática: ler o gráfico do telão como tratamento da informação (EF05MA24) — quantos de quantos, e o que a barra mais longa quer dizer.",
      "Projeto de vida / convivência: escrever com a turma o combinado do grupo de WhatsApp da sala, se houver um, e colar o cartaz ao lado.",
    ],
  },

  cuidados: [
    "A criança que encaminhou a mentira mais espalhada não é exemplo de nada. O telão é anônimo, e nenhuma pergunta sua pode pedir que alguém se identifique.",
    "Se o assunto que você escolher for real e estiver quente na escola (uma obra, uma mudança de cantina, uma saída de funcionário), diga antes que as mensagens da missão são inventadas para a aula — senão a família recebe em casa o boato que nasceu aqui.",
    "A resposta escrita é lida por você e mais ninguém. Diga isso em voz alta antes de liberar: é o que faz a criança escrever o que pensa em vez do que soa bem.",
    "Nenhuma mensagem da missão fala de pessoa real da escola, e o gerador recusa termos que rotulem a criança. Se você editar os textos, mantenha isso: o selo diz o que a MENSAGEM é, nunca o que quem a encaminhou é.",
  ],

  adaptacoes: [
    {
      contexto: "Um dispositivo para 2 ou 3 estudantes",
      comoAdaptar:
        "Modo dupla: eles precisam concordar antes de cada encaminhamento, e isso já é a checagem acontecendo em voz alta. O que se perde é o retrato individual da folha — nesse caso a resposta final vai no caderno.",
    },
    {
      contexto: "Só o computador do professor, projetado",
      comoAdaptar:
        "Leia as oito mensagens em voz alta e a turma vota o que vai para o Mural, por levantamento de mãos. Anote os números na lousa: eles viram o telão, e o debate continua inteiro.",
    },
    {
      contexto: "Turma com leitura ainda em construção",
      comoAdaptar:
        "Leia as mensagens longas em voz alta uma vez, sem comentar nenhuma. O comunicado da coordenação é o texto mais denso da missão de propósito — é ele que quase ninguém encaminha.",
    },
    {
      contexto: "Sobrou tempo",
      comoAdaptar:
        "Peça que escrevam, em duplas, a mensagem que a coordenação deveria ter mandado para que ela fosse encaminhada tanto quanto o boato. É a aula inteira do avesso, e ela mostra o quanto é difícil.",
    },
  ],

  duvidas: [
    {
      pergunta: "As mensagens vêm de um WhatsApp de verdade?",
      resposta:
        "Não. É um clone, dentro da plataforma, e as oito mensagens são as que VOCÊ publicou no painel. Ninguém envia nem recebe nada fora dali, e não existe digitação livre no grupo.",
    },
    {
      pergunta: "Por que a missão não abre para a minha turma?",
      resposta:
        "Porque o lote ainda não foi publicado. Esta missão nasce vazia de propósito — as mensagens falam da sua escola. No painel da turma, clique em Aprovar e publicar; o lote curado da Unooria já está preenchido se você não quiser gerar nada.",
    },
    {
      pergunta: "A inteligência artificial escreve o que quiser?",
      resposta:
        "Não. A posição de cada mensagem fixa o formato e se ela é verdadeira, falsa ou ambígua — o modelo só reescreve o texto para o seu tema, e o que ele devolve fora do molde é recusado. Se ele falhar, o lote curado volta inteiro e a tela diz isso, em vez de fingir que a IA respondeu.",
    },
    {
      pergunta: "Uma criança encaminhou só mensagens verdadeiras. Ela “ganhou”?",
      resposta:
        "Não existe ganhar aqui, e o painel não tem coluna de acerto. O que ela fez é material do debate como qualquer outra escolha — vale perguntar à turma o que ela olhou, porque a resposta serve à sala inteira.",
    },
    {
      pergunta: "Posso ver o que cada um escreveu na pergunta final?",
      resposta:
        "Sim, na folha da turma, e só você da turma. Não vai para gestor, não vai para relatório e não sai da escola — é texto escrito por menor de idade.",
    },
    {
      pergunta: "Apertei revelar cedo demais. E agora?",
      resposta:
        "Use Voltar para a exploração, no mesmo painel. Nada é apagado: quem já confirmou continua confirmado e quem já respondeu continua concluído. Não é preciso zerar a turma.",
    },
    {
      pergunta: "Dá para aplicar de novo na turma seguinte, no mesmo dia?",
      resposta:
        "Dá. Zerar a turma apaga as respostas e mantém o lote publicado — a próxima turma entra no mesmo grupo, sem você refazer a preparação.",
    },
  ],
};
