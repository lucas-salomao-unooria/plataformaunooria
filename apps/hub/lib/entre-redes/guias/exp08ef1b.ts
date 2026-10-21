import type { GuiaDaAula } from "./tipos";

/**
 * Guia da aula de **O Conteúdo que não chegou** (exp08ef1b, 8º ano · Unidade 1).
 *
 * É o guia mais antigo da trilha e continua sendo a referência dos outros: foi
 * nele que a ordem das seções foi decidida. O que ele NÃO guarda é o que tem
 * fonte viva — a tabela dos momentos vem de `CONTROLE_DO_PROFESSOR` e as telas
 * da revelação de `lib/insta/copy-da-revelacao.ts`, os dois injetados como bloco vivo pela
 * página do guia. Copiá-los para cá criaria a segunda cópia que diverge na
 * primeira revisão de copy.
 *
 * A missão tem DOIS atos e o Ato 1 (a Vila do Lume) acontece fora daqui. Nada
 * neste guia pode ser dito à turma antes da revelação: é a desconexão entre o
 * jogo e o feed que faz o relatório final funcionar.
 */
export const GUIA_EXP08EF1B: GuiaDaAula = {
  expId: "exp08ef1b",
  chamada:
    "Cobre o Ato 2 — duas aulas (100 min), da entrada no feed ao fechamento escrito. O Ato 1 é a Vila do Lume, jogada antes e sem nenhuma menção a esta missão.",

  avisos: [
    {
      tom: "warning",
      titulo: "O que você sabe e a turma não",
      texto:
        "Cada estudante recebe um feed já puxado para um dos dois lados, e o lado vem do perfil que o jogo mediu — não é sorteio. O mesmo argumento foi escrito em quatro linguagens, e cada um recebe mais a que combina com ele. O outro lado nunca desaparece: passa sempre pelo menos 1 post em 6, o mais calmo, para que virar de lado seja possível. Nada disso é dito antes da revelação.",
    },
  ],

  objetivos: [
    "Descrever, com as próprias palavras, o critério que um feed usa para decidir o que mostrar a cada pessoa.",
    "Identificar no próprio percurso quais comportamentos alimentaram esse critério — o que parou de rolar, o que abriu, o que salvou.",
    "Comparar a própria coleção de posts com a de um colega e explicar como duas pessoas na mesma sala saíram com versões diferentes do mesmo tema.",
    "Reconhecer que o mesmo argumento muda de forma conforme quem o recebe, e que a forma — não só o conteúdo — influencia a adesão.",
    "Formular duas ações concretas para ampliar o próprio repertório de fontes sobre um tema em disputa.",
  ],

  bncc: [
    {
      codigo: "EF08CO11",
      texto:
        "Avaliar a precisão, relevância, adequação, abrangência e vieses que ocorrem em fontes de informação eletrônica.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "O estudante vê a própria coleção ao lado da do colega e descobre que a abrangência do que ele leu foi decidida por outra pessoa. Medida em duas tarefas, e vale a melhor: o Raio-x do feed, logo depois da resposta (de 6 posts, primeiro os que ele viu, o que cada um faz — mede os vieses), e a reflexão escrita, lida pela IA uma vez só (mede o mecanismo e o que ficou de fora; o nível é sugestão, e você confere). Precisão e relevância das fontes não são medidas nesta missão.",
    },
    {
      codigo: "EF08CO07",
      texto:
        "Compartilhar informações por meio de redes sociais, compreendendo a sua dinâmica de funcionamento, de forma responsável e avaliando sua confiabilidade, considerando o respeito e a ética.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "A explicação individual mostra a dinâmica pelo avesso: quais gestos dele o feed leu, e o que fez com eles. Medida no envio, depois do feed em cinza: de 9 posts, ele escolhe até 3 e uma mensagem para um colega de outra turma que não viu nada. Os dois lados, nenhuma página de fofoca ou de humor e a mensagem que avisa que é só um pedaço levam a \"Atingiu\".",
    },
    {
      codigo: "EF08CO09",
      texto:
        "Analisar criticamente as políticas de termos de uso das redes sociais e demais plataformas.",
      eixo: "Cultura Digital",
      ondeAcontece:
        "Os termos de uso aparecem na entrada, como num app real: texto longo e o botão \u201cAceitar e continuar\u201d. Depois do feed em cinza, o estudante volta a eles e marca, das 5 regras, as que explicam o que aconteceu no feed (0 erros, atingiu; 1 ou 2, em processo; 3 ou mais, não atingiu). Desdobramento para a aula seguinte: ler nos termos de uso de uma rede real o trecho que descreve a personalização do feed.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Crie a atividade a partir do seu tema.",
        texto:
          "Você não escreve mais a pergunta-chave: informe disciplina, tema/recorte e o que já foi trabalhado. A IA propõe 2–3 perguntas com dois lados defensáveis e uma nota de equilíbrio. Escolha uma, edite à vontade ou escreva a sua — a palavra final é sempre sua.",
      },
      {
        titulo: "Valide os dois lados",
        texto:
          "que a IA destilou (rótulo, tese, argumentos, tom) e a tabela de afinidade perfil → lado.",
      },
      {
        titulo: "Configure os neutros.",
        texto:
          "Dentro do tema, fora do tema, os dois ou nenhum. Recomendação: deixe os dois ligados — sem neutros o feed fica visivelmente monotemático desde o primeiro post e o disfarce enfraquece.",
      },
      {
        titulo: "Revise os posts gerados.",
        texto:
          "Use a visão de matriz (2 lados × 4 perfis) para checar se alguma linguagem ficou fraca.",
      },
      {
        titulo: "Revise as falas do podcast antes de ativar.",
        texto:
          "O podcast de recapitulação é seu: cerca de 3 minutos e meio em que Duda e Téo retomam a missão com a turma. Logo abaixo da revisão dos posts, revise as três falas que contam a pergunta e os dois lados — elas vão junto com o Ativar; o resto do roteiro é o mesmo para todas as turmas. O áudio fica na página da atividade, com o botão Gerar o áudio do podcast, e a transcrição está sempre ao lado. Ele é opcional e conta a virada da missão: toque só depois da revelação.",
      },
      {
        titulo: "Ative a atividade e teste você mesmo",
        texto: "com um usuário de estudante, antes de a turma entrar.",
      },
      {
        titulo: "Libere a missão para a turma.",
        texto:
          "Na sala de aula (Minhas turmas → a turma → Missões). Sem essa liberação o estudante vê o cadeado, e é o motivo nº 1 de “não abre”.",
      },
      {
        titulo: "Confira os perfis e a distribuição da turma.",
        texto:
          "Você vê, antes de começar, em que lado cada estudante vai cair. Se a turma cair quase toda num lado, use o botão de redistribuir: ele move primeiro os de perfil menos decidido, preservando a pedagogia onde o sinal é forte.",
      },
      {
        titulo: "Decida se os perfis respondem.",
        texto:
          "Um botão nesta atividade liga a interação ao vivo: quando um estudante publica algo, os perfis do feed comentam de verdade, com texto gerado na hora. Passa por quatro camadas de proteção — elenco fechado, vocabulário bloqueado, sem link/contato/dado pessoal e nada que instrua comportamento. Se qualquer camada reprovar, o comentário não aparece: nunca entra texto substituto.",
      },
    ],
    pedagogico: [
      {
        titulo: "Escolha um tema que a turma já estudou.",
        texto:
          "A missão não ensina o conteúdo: ela usa o conteúdo como campo de disputa. Se o tema for novo, o estudante lê os posts como aula e não como opinião, e não há de que discordar.",
      },
      {
        titulo: "O tema precisa ter dois lados defensáveis — e nenhum deles pode ser desumano.",
        texto:
          "“A Terra é plana” não é um lado; “quanto do orçamento da cidade deve ir para ciclovia” é. A nota de equilíbrio da IA ajuda, mas quem conhece a turma é você: um tema que toca a vida de um estudante específico da sala não vira debate, vira exposição.",
      },
      {
        titulo: "Reserve as duas aulas juntas, ou pelo menos no mesmo dia.",
        texto:
          "O momento-espelho depende de todos terem acabado de sair do feed. Com uma semana no meio, o estudante já não lembra do que salvou e a comparação vira exercício de memória.",
      },
      {
        titulo: "Combine o silêncio durante o uso.",
        texto:
          "Cada um na sua experiência. Não é disciplina: dois estudantes comentando o feed em voz alta vazam a variação entre eles antes da hora, e a sala inteira passa a rolar procurando a diferença.",
      },
      {
        titulo: "Em sala, apresente a missão pequena.",
        texto:
          "“Vocês vão investigar uma pergunta num app e, no fim, me dizer o que acham.” Diga também a instrução que faz o debate funcionar: “salvem os posts que vão ajudar vocês a responder”. Nada de algoritmo, bolha ou perfil.",
      },
    ],
    naoDiga: [
      "“Vocês vão ver como o algoritmo manipula as pessoas.” — é a revelação inteira, entregue antes de a criança ter o que revelar.",
      "“Prestem atenção nos posts, tem coisa estranha aí.” — põe a turma em modo de auditoria; ninguém rola como rola de verdade, e a medida perde o sentido.",
      "“Cada um de vocês vai receber um feed diferente.” — é exatamente a frase que a tela da revelação existe para dizer, na hora certa.",
      "“Isso tem a ver com aquele jogo que vocês jogaram.” — o Ato 1 tem de continuar desconectado até o fim.",
      "“No fim vai ter uma surpresa.” — a expectativa de virada muda a leitura de cada post desde o primeiro.",
    ],
  },

  roteiro: {
    total: "2 aulas · 100 min",
    linhas: [
      {
        tempo: "0–5",
        momento: "Enquadramento da missão e entrada dos estudantes.",
        professor:
          "“Vocês vão investigar uma pergunta num app e, no fim, me dizer o que acham.” Nada além disso.",
        botao: "Começar investigação",
      },
      {
        tempo: "5–25",
        momento:
          "Investigação individual no feed. O monitor mostra em tempo real quem salvou o quê — clique em qualquer estudante e abre o aparelho dele numa janela.",
        professor:
          "Diga em voz alta a única instrução que importa: “salvem os posts que vão ajudar vocês a responder”. Circule pela sala sem comentar conteúdo nenhum. Fique de olho no alerta de ocioso: é o único que pede ação sua na hora.",
      },
      {
        tempo: "25–33",
        momento:
          "A resposta e o Raio-x. Cada estudante escolhe um dos três lados e, na mesma tela, diz de 6 posts o que cada um faz: puxa para um lado, puxa para o outro, ou informa sem tomar lado. Os posts são os que ele viu; quem rolou pouco recebe, para completar, posts do lado dele e neutros que não chegou a ver. Ninguém escreve nada ainda.",
        professor:
          "Encerre quando o monitor mostrar a maioria com coleção formada — não espere o último. Não explique o Raio-x além do que a tela diz: falar de lado, de bolha ou de algoritmo aqui entrega a revelação. Quem não terminar o Raio-x antes do debate faz na entrada da explicação.",
        botao: "Encerrar investigação",
      },
      {
        tempo: "33–48",
        momento:
          "Debate. As telas travam na coleção de cada um: dá para abrir e fechar o que salvou, e nada mais.",
        professor:
          "Projete a pergunta-chave e peça que defendam a resposta usando os posts que salvaram. Quem está em dúvida fala por último. Você ainda não revelou nada — e é isso que faz funcionar: dois estudantes citam posts diferentes sobre o mesmo tema e a sala estranha sozinha.",
        botao: "Iniciar debate",
      },
      {
        tempo: "48–50",
        momento: "Momento-espelho, antes de liberar a explicação.",
        professor:
          "“Quem respondeu A, levanta a mão.” Depois: “e quem viu mais posts defendendo A?” A correlação aparece a olho nu, e está medida na aba de análise. Não comente o resultado — deixe a sala olhar para as próprias mãos.",
      },
      {
        tempo: "50–62",
        momento:
          "Explicação + relatório individual, no ritmo de cada um: dez telas (nove para quem não fez o Raio-x), com a devolutiva do Raio-x, os termos de uso e o registro; depois o relatório — por que o feed dele começou daquele lado, o que prendeu a atenção dele, e a resposta que ele deu.",
        professor:
          "Silêncio. Não narre a tela e não ande pela sala lendo por cima do ombro: é uma frase por vez, e a leitura é individual de propósito. O monitor mostra quantos ainda não chegaram à última tela.",
        botao: "Encerrar debate",
      },
      {
        tempo: "62–63",
        momento:
          "Os termos de uso, lidos em voz alta. Projete as 5 regras e leia para todos, sem comentar: (1) “Registramos suas curtidas, salvamentos, comentários e o tempo que você passa em cada publicação.” (2) “Você pode desligar os avisos de novas curtidas e comentários a qualquer momento.” (3) “Usamos o seu histórico de interações para escolher quais publicações você vê e em que ordem.” (4) “Um algoritmo confere se cada perfil com selo de verificado pertence mesmo a quem diz ser.” (5) “Guardamos o histórico das suas interações no app enquanto a sua conta existir.”",
        professor:
          "Diga que os termos são fictícios — são os que a turma aceitou na entrada do Unoovista, quase sempre sem ler. Deixe as 5 regras projetadas durante todo o bloco seguinte: são iguais para todos e não entregam a resposta de ninguém.",
        botao: "Mostrar o que perderam",
      },
      {
        tempo: "63–72",
        momento:
          "O que eles perderam, e duas tarefas. O feed volta em cinza, só com o que nunca chegou; depois, no ritmo de cada um, os termos que aceitaram na entrada (que regras explicam o feed) e o envio (de 9 posts, até 3 e uma mensagem para um colega que não viu nada).",
        professor:
          "Um a dois minutos de silêncio olhando o número vale mais que qualquer explicação sua. Quem ainda está na revelação vê a revelação antes das tarefas — ninguém perde nada pelo relógio da turma.",
      },
      {
        tempo: "72–82",
        momento: "Duplas de bolhas opostas: o relatório comparativo.",
        professor:
          "Use o monitor para formar as duplas — ele mostra quem recebeu qual lado. Circule ouvindo; a pergunta 5 (lado inicial × resposta dada) é a que trava mais, e é a mais importante.",
      },
      {
        tempo: "82–87",
        momento: "Socialização das duplas e conexão com a disciplina.",
        professor:
          "Amarre no seu conteúdo: história/ciência é disputa de narrativa; o algoritmo escolheu a sua — e escolheu como te falar. Uma dupla por lado apresenta; não passe por todas.",
      },
      {
        tempo: "87–100",
        momento: "Reflexão escrita individual e combinados para furar a bolha.",
        professor:
          "Escrita livre, sem limite de caracteres. Quem ainda tem tarefa pendente faz antes de escrever. A tela avisa que você lê o texto e que a IA lê o primeiro texto salvo e sugere um nível; quem decide é você. Recolha dois combinados da turma inteira e escreva-os na lousa — eles voltam na próxima aula.",
        botao: "Abrir reflexão",
      },
    ],
    nota: "O bloco de feed é de 18 min / 60 posts, com piso de 8 min: rolagem muito rápida não encerra a sessão antes disso. A missão é investigativa, e investigar leva mais segundos por post que passar o tempo. Outro “8” aparece na análise e não se confunde com esse: só entra na média de imersão quem viu 8 posts ou mais — o relatório fecha para todo mundo, inclusive para quem viu menos.",
  },

  debate: {
    aberturaNaLousa: "Vocês estudaram o mesmo tema. Por que não concordam?",
    tempo:
      "15 minutos entre o Raio-x e a explicação, mais 5 na socialização das duplas. É o único momento em que a turma discute SEM saber o que aconteceu — e é isso que produz o estranhamento. Depois da revelação, a conversa muda de natureza: vira análise, não disputa.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Qual post você salvou primeiro, e o que nele te fez parar?",
        porQue:
          "Tira a conversa do “acho que” e a prende ao que está na tela dele. Anote se a razão citada é do conteúdo (“porque tinha dado”) ou da forma (“porque era engraçado”, “porque parecia justo”): a segunda é a linguagem do perfil dele operando, e volta na revelação.",
      },
      {
        nivel: "retomada",
        pergunta: "Quem salvou um post que defendia o outro lado? Como ele era?",
        porQue:
          "Sempre passa pelo menos 1 post em 6 do outro lado, o mais calmo. Quem salvou um deles é a prova viva de que virar era possível — e vale ouro na hora em que alguém disser que foi obrigado a pensar assim.",
      },
      {
        nivel: "analise",
        pergunta:
          "Vocês dois responderam coisas diferentes citando posts diferentes. Os dois posts existiam no app. Por que cada um encontrou o seu?",
        porQue:
          "É a pergunta central, e ela precisa ficar sem resposta. A sala vai propor sorte, tempo de rolagem, coincidência. Anote as hipóteses na lousa: a revelação vai bater uma por uma, e é bem mais forte quando a turma reconhece a própria hipótese sendo derrubada.",
      },
      {
        nivel: "analise",
        pergunta:
          "Alguém mudou de ideia no meio da rolagem? O que apareceu que fez mudar?",
        porQue:
          "Localiza o momento em que a escalada do feed pegou — o tom dos posts endurece ao longo do bloco. Quem percebeu isso sozinho é o estudante que vai puxar a sistematização depois.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Se o app mostrasse a mesma coisa para todo mundo, o que teria mudado nesta conversa?",
        porQue:
          "Faz a turma nomear o mecanismo sem ainda saber o nome dele. Guarde a resposta: é o critério de avaliação da rubrica — “reconhece o mecanismo” é responder isto, não repetir a palavra “algoritmo”.",
      },
      {
        nivel: "generalizacao",
        pergunta:
          "Quem decidiu o que cada um de vocês leu hoje? Não o app: a decisão foi tomada com base em quê?",
        porQue:
          "Depois da revelação. É onde a turma sai de “o algoritmo mostrou” para “o algoritmo leu o que eu fiz e devolveu mais do mesmo” — a diferença entre vítima e participante.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "Pense na última coisa que te deixou com raiva na internet esta semana. Quem te mostrou aquilo?",
        porQue:
          "Puxa o mecanismo para fora da aula sem pedir confissão. Aceite silêncio: a pergunta funciona por dentro. Se ninguém falar, responda você primeiro com um exemplo seu — adulto cai igual, e dizer isso é metade da lição.",
      },
      {
        nivel: "transferencia",
        pergunta:
          "O que você faria para descobrir o que NÃO está te chegando sobre um assunto que te interessa?",
        porQue:
          "É a pergunta que vira os combinados da lousa. Recuse respostas de intenção (“ser mais crítico”) e peça ação verificável: procurar quem discorda, abrir o que passou batido, perguntar a alguém de outra turma.",
      },
    ],
  },

  observacao: {
    intro:
      "Durante o debate, marque UMA letra ao lado do nome de cada estudante. É a avaliação que a plataforma não produz — ela mede o que a criança fez no feed, não o que ela sustentou na sala.",
    marcas: [
      { letra: "F", texto: "defendeu a resposta citando um post que ele mesmo salvou" },
      { letra: "R", texto: "repetiu o argumento do colega sem acrescentar nada" },
      { letra: "V", texto: "mudou de posição durante o debate E disse por quê" },
      { letra: "N", texto: "não participou" },
    ],
    nota:
      "O V é o mais valioso da folha e o mais fácil de perder: mudar de ideia em público, aos 13 anos, na frente da turma, custa. Diga em voz alta que mudar de posição com um motivo é o melhor resultado possível desta aula — antes de o debate começar, não depois.",
  },

  mediacao: [
    {
      quando: "A turma descobre a bolha antes da revelação.",
      faca: "Trate como hipótese: “anota aí, a gente confere no fim”. Escreva na lousa com o nome de quem propôs. Na revelação, volte à lousa.",
      naoFaca:
        "Confirmar (“isso mesmo!”). Um “isso mesmo” apaga a revelação para os outros 29, que ainda não chegaram lá — e a tela que vem depois vira repetição do que o professor já contou.",
    },
    {
      quando: "Alguém diz “então eu sou o tipo de pessoa que cai nisso”.",
      faca: "Corte na hora e devolva para a sala: o perfil não é defeito nem destino, e a prova está ali mesmo — nos colegas que viraram de lado com o feed puxando contra.",
      naoFaca:
        "Deixar passar para não interromper o fluxo. Essa frase é a que vira apelido de sala na semana seguinte.",
    },
    {
      quando: "A sala conclui “então rede social é ruim, o certo é sair”.",
      faca: "Redirecione para o critério, não para a plataforma: “o que exatamente você desligaria?” Ninguém consegue responder — e é aí que fica claro que o alvo é o critério de ordenação, que também organiza a busca, a loja e o serviço de streaming.",
      naoFaca:
        "Aceitar a conclusão como fecho da aula. Ela é confortável, moralizante e não muda comportamento nenhum — e no dia seguinte todos continuam no mesmo app.",
    },
    {
      quando: "O debate vira briga sobre o TEMA em vez de sobre o feed.",
      faca: "Deixe correr uns três minutos — a disputa quente é o que torna o espelho eficaz — e então pergunte: “vocês estão discordando dos fatos ou dos posts que cada um viu?”",
    },
    {
      quando: "Um estudante se recusa a aceitar que foi influenciado.",
      faca: "Não insista, e não peça que a turma o convença. Mostre a comparação dele com o colega e deixe em aberto: “pode ser mesmo que não tenha mudado nada em você. Olha aí o que você não viu.”",
      naoFaca:
        "Transformar em prova pública. Adolescente que cede sob pressão da turma não mudou de ideia, aprendeu a ceder — e é o oposto do que a missão trabalha.",
    },
    {
      quando: "Ninguém fala no debate.",
      faca: "Não comece pelo grande grupo: peça 90 segundos em duplas (“conte pro colega qual post você salvou”) e só depois abra. A sala precisa ter dito em voz alta uma vez antes de dizer para 30 pessoas.",
    },
    {
      quando: "Um estudante pergunta por que caiu naquele lado, e ele não jogou o Ato 1.",
      faca: "Responda a verdade: no caso dele foi sorteio, e a tela da revelação dele diz exatamente isso — as três origens (perfil, redistribuição, sorteio) leem versões diferentes daquela tela.",
      naoFaca:
        "Improvisar que “foi pelo seu jeito de usar”. A única tela da missão que existe para não mentir não pode ser desmentida por você.",
    },
    {
      quando: "Alguém acusa você de ter manipulado a turma.",
      faca: "Assuma inteiro: “sim, e é por isso que vocês estão sabendo agora. Nenhuma rede social faz essa parte.” É a melhor coisa que pode acontecer na aula.",
    },
  ],

  depois: {
    sintese: [
      "“Vocês leram o mesmo tema e saíram com versões diferentes. Não foi sorte, e não foi porque alguém é mais esperto: o app decidiu, a partir do que cada um fez, o que valia a pena mostrar.”",
      "“Isso não é defeito de uma rede social específica. É o critério que organiza quase tudo o que chega até vocês — a busca, a loja, o vídeo que começa sozinho.”",
      "“Ninguém escapa por ser inteligente. Escapa quem procura de propósito o que não chegou.”",
    ],
    registro:
      "A reflexão escrita individual (últimos 13 min, sem limite de caracteres) fecha a missão dentro do app, e o texto fica no relatório do estudante. O nível de cada habilidade sai das tarefas — o Raio-x, os termos, o envio e a leitura da reflexão pela IA — e aparece em “Habilidades da BNCC”, na página da atividade, dizendo de qual tarefa veio; você pode ajustá-lo. Quem não fez uma tarefa (faltou, atrasou, não terminou) fica “Não avaliado” naquela habilidade, e você ajusta à mão se tiver como avaliar. Recolha da turma inteira dois combinados para furar a bolha, escreva-os na lousa e retome-os na aula seguinte: sem essa retomada, a aula vira um evento isolado e a semana engole o combinado.",
    produto: {
      titulo: "Relatório comparativo (entregável, em duplas de bolhas opostas)",
      itens: [
        "O que UM viu que o OUTRO nunca viu? (usem a tela cinza dos posts perdidos)",
        "Como duas pessoas na mesma sala saíram com versões diferentes do mesmo tema?",
        "Quais comportamentos de vocês o algoritmo usou? Expliquem com suas palavras.",
        "Olhem a “escalada”: o que aconteceu com o tom dos posts ao longo do feed? Por quê?",
        "Comparem o lado inicial de cada um com a resposta que cada um deu. O lado que vocês receberam influenciou? Como vocês sabem?",
        "Olhem a seção “o jeito de falar com você”. O que mais prendeu cada um: descoberta, justiça, mérito ou segurança? Vocês receberam o mesmo argumento escrito de jeitos diferentes — isso muda algo no que concluíram?",
      ],
    },
    rubrica: {
      nota: "A rubrica nunca avalia o LADO em que o estudante caiu nem a resposta que ele deu à pergunta-chave: as duas coisas são produto do feed que ele recebeu, e dar nota a elas é dar nota ao sorteio. O que se avalia é a análise — e ela é possível para quem virou de lado, para quem não virou e para quem respondeu “em dúvida”.",
      criterios: [
        {
          criterio: "Leitura do próprio percurso",
          emDesenvolvimento:
            "Repete o que a tela disse (“meu feed era do lado A”) sem ligar a nenhum gesto seu.",
          adequado:
            "Cita ao menos um comportamento próprio que o feed leu — o que parou de rolar, o que abriu, o que salvou.",
          avancado:
            "Relaciona o comportamento ao efeito seguinte: percebe que aquilo que ele fez mudou o que veio depois.",
        },
        {
          criterio: "Comparação com o colega",
          emDesenvolvimento:
            "Lista diferenças entre as duas coleções sem explicar de onde vieram.",
          adequado:
            "Explica que as duas coleções vêm do mesmo banco de posts, e que a diferença está na ordem em que cada um os recebeu.",
          avancado:
            "Usa a tela dos posts perdidos como evidência e nomeia o que ficou de fora da própria formação de opinião.",
        },
        {
          criterio: "Reconhecimento do mecanismo",
          emDesenvolvimento:
            "Personaliza o sistema (“o app quis me enganar”) ou culpa a plataforma em geral.",
          adequado:
            "Descreve um critério de ordenação: o app mostra mais do que a pessoa demonstrou interesse.",
          avancado:
            "Reconhece o mesmo critério fora da missão — na busca, na loja, no serviço de vídeo — e não só na rede social.",
        },
        {
          criterio: "Ação",
          emDesenvolvimento: "Declara intenção genérica (“vou ser mais crítico”).",
          adequado: "Propõe uma ação verificável (procurar quem discorda antes de opinar).",
          avancado:
            "Propõe uma ação verificável e antecipa o que ela custa — tempo, desconforto, sair do que é agradável de ler.",
        },
      ],
    },
    desdobramentos: [
      "História e Geografia: pegue o mesmo tema em dois livros didáticos de épocas diferentes. Mesma pergunta da missão, outro suporte — a seleção de fontes é anterior ao algoritmo.",
      "Língua Portuguesa: a missão escreveu o MESMO argumento em quatro linguagens. Peça que cada dupla reescreva o post que mais prendeu o colega na linguagem que prenderia a ela.",
      "Matemática: o relatório traz contagens (posts vistos, salvos, proporção por lado). É base honesta para trabalhar proporção e amostragem enviesada com dado que a própria turma produziu.",
      "Ciências: método científico contra confirmação — o que seria preciso encontrar para que você mudasse de posição? Se nada muda, não é hipótese.",
      "BNCC EF08CO09: leiam nos termos de uso de uma rede real o trecho que descreve a personalização do feed. Está escrito, em público, e ninguém lê.",
    ],
  },

  cuidados: [
    "Nunca avaliar o “lado” em que o estudante caiu; avaliar a análise.",
    "O perfil de valores não é rótulo de estudante. Não usar como apelido, categoria de turma, nota ou adjetivo (“o competitivo”, “a que se importa com os outros”). É o que o jogo captou naquele dia, e a divergência entre o jogo e o feed é dado interessante — não erro de ninguém.",
    "Reforçar: todos caem em bolhas, inclusive adultos — o exercício mede o poder do sistema, não a inteligência de ninguém.",
    "Deixar explícito que perfis e posts foram gerados por IA para a atividade.",
    "No Raio-x, quem aderiu mais ao próprio lado tende a ver o post neutro como do outro lado. É um efeito conhecido, não descuido: o nível mede se o estudante enxerga o viés da fonte, não em que lado ele está.",
    "O nível da reflexão é uma sugestão da IA, que lê uma vez só o primeiro texto salvo. Confira na janela do estudante (o texto lido aparece lá) e ajuste se discordar.",
    "Se a turma perguntar por que ninguém avisou: é exatamente a pergunta certa. Nenhuma rede social avisa.",
    "Se alguém disser “então eu sou o tipo que cai nisso”: corte na hora. O perfil não é defeito nem destino — e a prova está na própria sala, nos colegas que viraram de lado.",
    "Não peça que ninguém leia a própria reflexão em voz alta. Ela é escrita para o estudante e para você; lida para a turma, ela vira redação para agradar.",
  ],

  adaptacoes: [
    {
      contexto: "As duas aulas de 50 minutos são separadas (até em dias diferentes).",
      comoAdaptar:
        "Aula 1, até a revelação: entrada 4 min, investigação 11 (acima do piso de 8 do feed), resposta 3, Raio-x 3, debate 15 (os 15 inteiros), espelho 2, revelação e relatório 11, fechamento 1. No fechamento, você diz a frase da última tela da revelação (“Isso acontece com todo mundo — inclusive com adultos”); a turma não repete em coro. Aula 2: retomada 3 (a pergunta-chave e o resultado do espelho na lousa; a turma entra de novo no app), leitura das 5 regras 1, cinza e as duas tarefas 9, duplas 10 (cada um com o relatório aberto de novo, pelo botão “Rever meu relatório”), socialização 5, reflexão 17 e combinados 5. A atividade continua no ar entre as duas aulas: ela só sai quando você põe outra na mesma turma. Não dá para fazer a missão numa aula só: o debate e o espelho não se cortam.",
    },
    {
      contexto: "A turma não jogou a Vila do Lume.",
      comoAdaptar:
        "A missão roda igual: quem entra sem perfil cai no sorteio balanceado, e a tela da revelação dele diz a verdade sobre isso. O que muda é a conversa do fim — sem o Ato 1 você não pode perguntar “por que justo esse lado para você?”, então fique na comparação entre colegas, que continua inteira.",
    },
    {
      contexto: "Menos aparelhos que estudantes.",
      comoAdaptar:
        "Duplas funcionam, com uma consequência que vale dizer em voz alta depois: a bolha passa a ser da dupla, não da pessoa, e as duas leram o mesmo feed. Forme as duplas por afinidade — assim a comparação do fim ainda é entre bolhas diferentes, e não dentro da mesma. No nível das habilidades, o que a dupla fez no computador vale para os dois (o colega recebe o nível de quem estava logado); ajuste um a um em “Habilidades da BNCC” se um dos dois não participou.",
    },
    {
      contexto: "Um estudante faltou no dia.",
      comoAdaptar:
        "Ele pode fazer depois, mas sozinho a missão perde a metade que importa: não há com quem comparar. Melhor emparelhá-lo com um colega que já fez, na função de entrevistador — ele investiga, e depois lê o relatório do colega ao lado do seu.",
    },
    {
      contexto: "Turma com leitura ainda em formação.",
      comoAdaptar:
        "Os posts são curtos, mas as dez telas da revelação são texto puro. Leia-as em voz alta com a turma, projetando — a leitura individual é preferível, mas a tela lida em conjunto é infinitamente melhor que a tela pulada.",
    },
    {
      contexto: "Estudante com deficiência ou com PEI.",
      comoAdaptar:
        "Você ou o AEE leem com ele os posts do Raio-x, as 5 regras dos termos e as mensagens do envio. Se a leitura atrapalhou, ajuste o nível em “Habilidades da BNCC”: ele mede a análise, não a velocidade de leitura.",
    },
    {
      contexto: "Um estudante não chegou à reflexão no fim da aula.",
      comoAdaptar:
        "Quem gastou o fim da aula numa tarefa pendente escreve a reflexão no começo da aula seguinte. A atividade continua no ar, e a IA lê o primeiro texto quando ele vier.",
    },
  ],

  duvidas: [
    {
      pergunta: "A página da atividade avisou que ela não tem página de fofoca ou de humor nos dois lados.",
      resposta:
        "É uma atividade criada antes de a geração passar a exigir essas páginas. Nela, o envio não mede a confiabilidade e vai no máximo a “Em processo” — a célula do estudante diz isso. Para medir, crie uma atividade nova com a mesma pergunta: o acervo novo já vem com essas páginas.",
    },
    {
      pergunta: "Um estudante pediu para apagar o que escreveu.",
      resposta:
        "O caminho é reiniciar a sessão dele (na página da atividade). O reinício apaga tudo o que ele produziu — posts, comentários, reflexão e tarefas —, mas não o nível que ele já tinha: vale o primeiro envio de cada tarefa, e quem refizer aparece como “refeito após reinício”. Para apagar também os níveis, só “Apagar as sessões” da turma inteira.",
    },
    {
      pergunta: "O que é “refeito após reinício”?",
      resposta:
        "O estudante foi reiniciado e fez a tarefa de novo. Vale o primeiro envio: o nível de antes fica, e a página da atividade marca que ele refez.",
    },
    {
      pergunta: "O estudante entra e vê cadeado, ou a missão não aparece para ele.",
      resposta:
        "A missão só abre na turma em que você a liberou. Vá em Minhas turmas → a turma → Missões e libere. É o motivo nº 1 de “não abre”, e vale para todas as missões da trilha.",
    },
    {
      pergunta: "A turma inteira caiu no mesmo lado. Isso está errado?",
      resposta:
        "Não está errado, mas estraga o debate: sem duas bolhas na sala não há o que comparar. Use o botão de redistribuir antes de começar — ele move primeiro os de perfil menos decidido, preservando o sinal onde ele é forte.",
    },
    {
      pergunta: "Um estudante terminou muito antes dos outros.",
      resposta:
        "A etapa da turma é piso, não teto: ele não fica preso, mas não passa do que você liberou. A exceção é o debate, que trava todo mundo na mesma tela de propósito. O piso de 8 minutos no feed também segura quem rola sem ler.",
    },
    {
      pergunta: "Posso usar a mesma atividade em duas turmas?",
      resposta:
        "Pode, e é o uso previsto: a atividade é a configuração da missão para um tema seu. Mas os momentos são conduzidos por você ao vivo — então rode uma turma de cada vez, ou crie uma atividade por turma se as aulas forem simultâneas.",
    },
    {
      pergunta: "Apareceu um alerta de estudante ocioso. O que faço?",
      resposta:
        "É o único alerta do monitor que pede ação na hora. Clique no nome: o aparelho dele abre numa janela e você vê em que tela ele parou. Normalmente é aba trocada ou vídeo pausado, não falha da missão.",
    },
    {
      pergunta: "Liguei a interação ao vivo e um comentário não apareceu.",
      resposta:
        "É o comportamento correto. O texto gerado passa por quatro camadas de proteção e, se qualquer uma reprovar, o comentário simplesmente não aparece — nunca entra texto substituto. Do lado do estudante isso é indistinguível de um perfil que não respondeu.",
    },
  ],
};
