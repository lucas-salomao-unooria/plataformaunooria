import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula de O QUE A FOTO CONTA (1º ano · Unidade 1).
 *
 * O leitor deste guia conduz uma sala de 6 anos: as crianças não leem
 * fluentemente, e TODA a mediação é oral. O material do debate — as duas fotos
 * e as duas legendas do pacote da turma — vive na tela de resultados (a
 * projeção da lousa), servido pela api: este guia ensina a conduzir, nunca
 * duplica o conteúdo que a aula projeta.
 */
export const GUIA_EXP01EF1B: GuiaDaAula = {
  expId: "exp01ef1b",
  chamada:
    "Uma aula de 50 minutos em que a turma descobre, publicando no mural simulado, que toda foto mostra uma escolha — e que o que ficou de fora também conta.",
  avisos: [
    {
      tom: "warning",
      titulo: "Os tablets congelam de propósito no meio da aula",
      texto:
        "Quando a turma chega à Roda de Conversa, as telas travam numa tela sem nenhum botão — parece defeito, e não é. Avise as crianças ANTES: quando aparecer HORA DA RODA DE CONVERSA, é para pousar o tablet na mesa e olhar para você. Quem destrava a turma é o seu botão LIBERAR REFLEXÃO FINAL, nos resultados.",
    },
    {
      tom: "info",
      titulo: "Sem fones, o autoplay vira cacofonia",
      texto:
        "Toda instrução tem locução automática. Trinta tablets falando juntos atrapalham a sala inteira: distribua fones, ou baixe o volume dos aparelhos e conte com a leitura mediada.",
    },
  ],
  objetivos: [
    "Perceber que a mesma cena muda de sentido quando o enquadramento muda.",
    "Escolher intencionalmente uma foto e uma legenda para contar uma história.",
    "Reconhecer, pelos comentários dos colegas simulados, o efeito da própria escolha em quem vê.",
    "Dizer com as próprias palavras que uma foto mostra um pedaço, não o mundo inteiro.",
  ],
  bncc: [
    {
      codigo: "EF01CO01",
      texto:
        "Organizar objetos físicos ou digitais considerando diferentes características, explicitando semelhanças (padrões) e diferenças.",
      eixo: "Pensamento Computacional",
      principal: true,
      ondeAcontece:
        "No dilema da lente: a criança compara o plano geral e o plano detalhe da MESMA cena e diferencia o que cada um mostra e esconde.",
    },
    {
      codigo: "EF01CO04",
      texto:
        "Reconhecer que a informação pode ser armazenada e transmitida como mensagem por diversos meios e descrita em várias linguagens.",
      eixo: "Mundo Digital",
      ondeAcontece:
        "Na publicação e no eco: a foto com legenda vira mensagem no mural, e os comentários de Leo e Sofia mostram a mensagem chegando aos colegas.",
    },
    {
      codigo: "EF01CO05",
      texto: "Representar informação usando diferentes codificações (imagem, ícone e legenda).",
      eixo: "Mundo Digital",
      ondeAcontece:
        "Em toda a missão: marca (ícone), foto (imagem) e legenda (texto com pictograma) são três codificações da mesma história — e a criança opera as três.",
    },
  ],
  antes: {
    tecnico: [
      {
        titulo: "Libere a missão para a turma.",
        texto:
          "Na sala de aula, abra a turma e libere O Que a Foto Conta. Sem a liberação o card fica com cadeado nos tablets.",
      },
      {
        titulo: "Opcional: gere e aprove o pacote do tema da semana.",
        texto:
          "No painel da missão, escolha o espaço da escola (Recreio, Horta, Sala, Parquinho) e o nível de leitura, gere a proposta com IA, confira o preview — as legendas e os comentários que a turma vai ver — e toque em Aprovar. Sem aprovação, o banco padrão (O Mistério das Peças no Pátio) assume sozinho: a aula nunca fica sem material.",
      },
      {
        titulo: "Abra os Resultados da turma ANTES da aula começar.",
        texto:
          "É a tela que você vai projetar na Roda: as duas fotos lado a lado, o termômetro da turma e o botão de liberar a reflexão.",
      },
    ],
    pedagogico: [
      {
        titulo: "Rode a missão você mesmo, uma vez.",
        texto:
          "São ~12 minutos de tela. Escolha de propósito a combinação cruzada (a foto do brinquedo com a legenda da bagunça) para ver o estranhamento que ela produz — é o seu melhor material de mediação.",
      },
      {
        titulo: "Combine o gesto da Roda em voz alta.",
        texto:
          "\"Quando o tablet mostrar HORA DA RODA DE CONVERSA, ele vai travar de propósito: pousa na mesa e olha para mim.\" Dito antes, o congelamento vira ritual; sem avisar, vira 'quebrou'.",
      },
      {
        titulo: "Não prometa foto certa.",
        texto:
          "Não existe. As duas fotos são verdadeiras e as duas escondem algo — é exatamente isso que a missão mede. Se uma criança perguntar qual é a certa, devolva: \"o que VOCÊ quer que os colegas vejam primeiro?\".",
      },
    ],
    naoDiga: [
      "Que os comentários de Leo e Sofia mudam conforme a foto escolhida — a surpresa do eco é o instrumento da missão.",
      "Qual das duas respostas da síntese final \"é a certa\": a Lupa precisa ser descoberta, não obedecida.",
      "Que a foto do brinquedo \"esconde a bagunça\" — é a conclusão que a RODA deve produzir, não a instrução de entrada.",
    ],
  },
  roteiro: {
    total: "1 aula · 50 min",
    linhas: [
      {
        tempo: "0–5 min",
        momento: "Enquadramento. Nina lança a pergunta e cada criança escolhe a sua marca.",
        professor:
          "Circule ajudando quem travou na escolha — a marca é gosto, não teste. Confira fones e volume.",
      },
      {
        tempo: "5–12 min",
        momento: "O mural: rolagem e toque duplo nas 3 fotos da escola.",
        professor:
          "Deixe explorar. A seta de rolagem aparece sozinha para quem parar 30 segundos; não adiante o gesto — o app ensina.",
      },
      {
        tempo: "12–20 min",
        momento: "O dilema da lente: uma foto, uma legenda, COMPARTILHAR.",
        professor:
          "O painel mostra quem está há mais de 1 minuto parado na decisão (a lista de mediação de leitura): sente ao lado, leia as legendas em voz alta com a criança e devolva a escolha a ela.",
      },
      {
        tempo: "20–25 min",
        momento: "O eco: Leo e Sofia comentam, e os tablets entram sozinhos na Roda.",
        professor:
          "Observe as reações — o riso e o espanto de quem percebeu que o colega \"só viu o brinquedo\" são o material do debate. O painel avisa quando a turma inteira chegou.",
        botao: "Acompanhe em Resultados da turma",
      },
      {
        tempo: "25–40 min",
        momento: "A RODA DE CONVERSA, com as duas fotos projetadas lado a lado.",
        professor:
          "Conduza pelas três perguntas do debate (abaixo). Peça exemplos nominais das escolhas: \"quem escolheu a foto de pertinho? o que você queria mostrar?\".",
      },
      {
        tempo: "40 min",
        momento: "Você libera a reflexão final.",
        professor:
          "Quando a conversa fechar, toque em LIBERAR REFLEXÃO FINAL — todos os tablets destravam juntos.",
        botao: "LIBERAR REFLEXÃO FINAL",
      },
      {
        tempo: "40–50 min",
        momento: "O olhar de detetive: a síntese, o emblema e o mural da turma.",
        professor:
          "Quem tocar no Globo recebe o lembrete gentil de Nina e escolhe de novo — não corrija por cima; deixe a segunda olhada acontecer. Feche ouvindo o resumo (quando o episódio estiver disponível) ou releia a descoberta em voz alta.",
      },
    ],
    nota: "Em duas sessões de ~25 min: Etapas 1–3 na primeira (a publicação fecha a sessão), 4–6 na segunda — o progresso fica salvo e o eco reabre de onde parou.",
  },
  debate: {
    aberturaNaLousa: "A CÂMERA MOSTRA TUDO?",
    tempo:
      "15 minutos, com as duas fotos projetadas. É a metade que vale: a missão não explica nada por software — quem revela o recorte é a conversa.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Quem escolheu a foto do brinquedo bem de perto, o que queria que todo mundo visse primeiro?",
        porQue:
          "Nomeia a INTENÇÃO da escolha — a criança percebe que escolheu por um motivo, mesmo sem ter palavras para ele ainda.",
      },
      {
        nivel: "analise",
        pergunta:
          "Se uma pessoa que nunca veio na nossa escola olhar só a foto do chão espalhado, o que ela vai pensar do nosso recreio?",
        porQue:
          "Desloca o olhar para QUEM VÊ: a mesma foto verdadeira produz uma conclusão errada em quem não estava lá — o coração do letramento midiático, em escala de 6 anos.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "A câmera fotográfica consegue mostrar tudo o que existe ou ela só mostra o pedaço que a gente escolheu?",
        porQue:
          "É a descoberta central dita pela turma, não por você. Se a sala responder em coro \"só um pedaço!\", a missão cumpriu o que veio fazer.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Quando você vir uma foto no celular da sua família, o que você vai perguntar para os seus olhos?",
        porQue:
          "Leva a descoberta para fora da missão — a resposta esperada (\"o que ficou de fora?\") é o hábito de leitura de imagem que a unidade inteira quer plantar, e vira o desafio de casa.",
      },
    ],
  },
  observacao: {
    intro:
      "Durante o dilema da lente e a Roda, marque discretamente na sua lista quem apresenta cada conduta — é registro formativo, nunca nota.",
    marcas: [
      { letra: "A", texto: "Escolheu foto e legenda com intenção declarada (\"quero mostrar o brinquedo\")." },
      { letra: "B", texto: "Precisou de leitura mediada para as legendas (apareceu na lista de hesitação)." },
      { letra: "C", texto: "Reagiu ao eco (riso, espanto, comentário) percebendo o efeito da escolha." },
      { letra: "D", texto: "Na Roda, disse com as próprias palavras que a foto mostra um pedaço." },
    ],
    nota: "A lista de hesitação do painel mostra quem passou de 1 minuto parado na decisão — é ponto de mediação de leitura, não de desempenho.",
  },
  mediacao: [
    {
      quando: "Uma criança fica parada na tela de decisão (aparece na lista de hesitação do painel).",
      faca:
        "Sente ao lado, toque o botão de áudio de cada legenda com ela e pergunte qual foto conta a história que ELA quer contar. Devolva a escolha; não escolha por ela.",
      naoFaca: "Não aponte uma foto \"melhor\" — não existe, e a sua indicação viraria a resposta da sala inteira.",
    },
    {
      quando: "Alguém bate na tela congelada da Roda dizendo que o tablet quebrou.",
      faca:
        "Lembre o combinado: \"é a HORA DA RODA — pousa o tablet e vem conversar\". Se a ansiedade for geral, mostre na lousa o contador de quem já chegou.",
    },
    {
      quando: "Uma criança toca no Globo, recebe o lembrete e toca no Globo de novo.",
      faca:
        "Pergunte o que ficou de fora da foto que ELA publicou — a resposta concreta (\"o resto do pátio\") costuma destravar a Lupa sozinha.",
      naoFaca: "Não diga \"é a lupa\": a síntese obedecida não é síntese.",
    },
    {
      quando: "A turma terminou em ritmos muito diferentes e os primeiros estão dispersos.",
      faca:
        "Quem concluiu cai no mural da turma (galeria passiva): peça que procurem a foto de um colega e adivinhem o que ele quis mostrar — vira aquecimento do debate.",
    },
  ],
  depois: {
    sintese: [
      "Toda foto mostra uma escolha: quem segura a câmera decide o que fica no meio.",
      "O que ficou de fora da foto também faz parte da história — a foto não mente, mas não mostra tudo.",
      "Quando você vir uma foto no celular da família, pergunte aos seus olhos: o que será que ficou de fora?",
    ],
    registro:
      "Cada criança diz (ou desenha) UMA coisa que ficou de fora da foto que publicou. É o registro individual da aula — oral ou desenhado, nunca escrito obrigatório no 1º ano.",
    rubrica: {
      nota:
        "Rubrica FORMATIVA, para o seu olhar — a missão não gera nota e o painel não ranqueia ninguém.",
      criterios: [
        {
          criterio: "Intencionalidade da escolha",
          emDesenvolvimento: "Escolhe foto e legenda ao acaso, sem relacionar as duas.",
          adequado: "Escolhe com intenção e nomeia o que quis mostrar.",
          avancado: "Antecipa o efeito: prevê o que os colegas vão ver antes do eco.",
        },
        {
          criterio: "Percepção do recorte",
          emDesenvolvimento: "Trata a foto como o mundo inteiro (\"a foto mostra tudo\").",
          adequado: "Reconhece, com apoio da Roda, que a foto mostra um pedaço.",
          avancado: "Aponta sozinho o que ficou de fora e por que isso muda a história.",
        },
      ],
    },
    desdobramentos: [
      "Língua Portuguesa (EF01LP17): produzir coletivamente uma legenda nova para a foto do plano geral — desta vez celebrando o trabalho da turma.",
      "Arte (EF15AR01): caça-enquadramentos no pátio real — com molduras de papelão, cada dupla \"fotografa\" a mesma cena de perto e de longe.",
      "Casa: o desafio do episódio de recapitulação — olhar uma foto no celular da família e perguntar o que ficou de fora.",
    ],
  },
  cuidados: [
    "Nenhuma foto real de criança entra na missão: as imagens são do banco curado (sem rostos identificáveis). Não fotografe a turma para \"personalizar\" — a Semana 4 do material impresso é o lugar disso, com as autorizações da escola.",
    "A lista de hesitação nomeia crianças para VOCÊ mediar leitura — ela não sai do seu painel e não vira registro de desempenho.",
    "Na reaplicação no mesmo ano, TROQUE o tema do pacote (Recreio → Horta): repetir o cenário mede memória, não leitura de imagem.",
    "Zerar a turma arquiva as publicações da rodada anterior e rearma a Roda — use para recomeçar uma aula que desandou, nunca para apagar uma aula que valeu.",
  ],
  adaptacoes: [
    {
      contexto: "Duplas ou trios por tablet",
      comoAdaptar:
        "Combine a alternância antes: um escolhe a foto, o outro a legenda, e os dois assistem ao eco juntos. A conversa da dupla É a missão acontecendo — não a apresse.",
    },
    {
      contexto: "Projeção única (só a lousa)",
      comoAdaptar:
        "Você conduz a missão na tela grande e a turma vota levantando a mão em cada escolha. A descoberta chega igual pela roda oral; a reflexão final pode ser respondida em coro.",
    },
    {
      contexto: "Criança em fase pré-silábica",
      comoAdaptar:
        "Toda decisão tem pictograma e áudio: acione o botão de som COM a criança e deixe o dedo dela tocar a escolha. A missão foi desenhada para não depender de leitura.",
    },
  ],
  duvidas: [
    {
      pergunta: "A turma inteira precisa terminar a publicação para a Roda começar?",
      resposta:
        "Não — mas o debate rende mais com todos no congelamento. O painel mostra quantos chegaram; quem ainda decide entra na Roda quando publicar. Você decide o momento, não o sistema.",
    },
    {
      pergunta: "Liberei a reflexão cedo demais. Dá para voltar?",
      resposta:
        "Não nessa rodada — a liberação é o fim da Roda. Se a conversa precisava de mais tempo, siga oralmente: a reflexão individual não expira. Para uma nova rodada completa, use Zerar e Reiniciar Turma (as publicações anteriores ficam arquivadas).",
    },
    {
      pergunta: "O que acontece se a IA não gerar o pacote, ou se eu não aprovar nada?",
      resposta:
        "O banco padrão assume sozinho: O Mistério das Peças no Pátio, com fotos, legendas e comentários autorais completos. A geração por IA é personalização, nunca dependência.",
    },
    {
      pergunta: "Uma criança publicou a combinação \"errada\" (foto de uma coisa, legenda de outra). Estrago?",
      resposta:
        "Ao contrário: os comentários dos colegas simulados reagem ao estranhamento (\"cadê as coisas do chão?\") e essa criança tem o melhor material da Roda. Não existe publicação errada nesta missão.",
    },
  ],
};
