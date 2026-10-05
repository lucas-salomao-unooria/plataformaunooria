import type { GuiaDaAula } from "./tipos";

/**
 * O guia da aula da exp05ef1b v2.2 — Quem Mandou Isso?, 5º ano, unidade 1.
 * Escrito a partir do one-pager pedagógico da v2.2 (a aula de 50 min, as 6
 * etapas, o papel da professora) e da especificação aprovada.
 *
 * O que ele NÃO guarda, e vem por BLOCO VIVO (`guia/quem-mandou-o-pacote.tsx`,
 * lido de `GET /quem-mandou-isso/professor/material`): as 8 mensagens do banco
 * curado com o gabarito, o roteiro das 3 perguntas da roda de conversa, as
 * falas da Nina e do tio e as duas perguntas de evidência com o nível de cada
 * alternativa. Tudo isso tem fonte na api (`quem-mandou-isso/catalogo.ts` e a
 * ficha E14), e uma cópia aqui seria a que diverge na primeira revisão de copy
 * — o professor conduziria a conversa com palavras que ninguém leu na tela.
 *
 * O que ele guarda é o que só existe aqui: a pedagogia dos dois eixos, o que
 * NÃO dizer antes da hora, e o cuidado com a criança que se reconhece na conta
 * do telão.
 */
export const GUIA_EXP05EF1B: GuiaDaAula = {
  expId: "exp05ef1b",
  chamada:
    "Uma aula em que a turma descobre o que a faz repassar uma mensagem antes de conferir. O ponto " +
    "de virada não é saber qual mensagem era falsa: é ver, nos próprios selos e no Termômetro da " +
    "Turma, que a mensagem séria podia ser falsa e a alarmada, verdadeira.",

  avisos: [
    {
      tom: "error",
      titulo: "Sem o pacote aprovado por você, a missão não abre para ninguém",
      texto:
        "O tema do pacote entra na fala da Nina, então esta missão nasce vazia: sem pacote aprovado, " +
        "a criança entra e vê uma tela de espera. Em A aula e os resultados, gere as 8 mensagens com IA " +
        "para o seu tema ou use o pacote curado padrão, leia, e clique em Aprovar Pacote. E libere a " +
        "missão na sala de aula — são as duas portas.",
    },
    {
      tom: "warning",
      titulo: "Não anuncie que a aula é sobre fake news",
      texto:
        "A missão mede o que a criança encaminha quando ninguém avisou para desconfiar. Anunciado o " +
        "tema, ela escolhe o que acha que você quer ver no Mural — e a revelação deixa de falar sobre " +
        "ela. Diga só o que a Nina diz: que ela precisa de ajuda com uma confusão na escola.",
    },
    {
      tom: "info",
      titulo: "O que vai para o telão é só o Termômetro",
      texto:
        "A tela A aula e os resultados tem os selos de cada mensagem e a folha com o nome de cada " +
        "estudante: ela é para a sua tela. Para projetar, use Projetar o Termômetro, que mostra só as " +
        "contas da turma, sem nome nenhum.",
    },
  ],

  objetivos: [
    "Reconhecer que a aparência de uma mensagem — séria ou alarmada — não diz se ela é verdadeira.",
    "Separar os dois eixos de uma mensagem: se ela é verdadeira ou falsa, e se o tom é emocional ou neutro.",
    "Identificar o que pesou na própria decisão de encaminhar: a pressa, a confiança em quem mandou, a emoção ou a aparência de real.",
    "Formular uma regra do tipo “Se a mensagem for…, então eu…” para usar antes de repassar uma mensagem.",
  ],

  bncc: [
    {
      /* A PRINCIPAL, e a que a evidência (E14) registra pela SELEÇÃO do Mural.
         Texto verbatim do Complemento de Computação à BNCC (conferido em
         `apps/api/src/curriculo/dados/habilidades-computacao.ts`). */
      codigo: "EF05CO08",
      texto:
        "Acessar as informações na Internet de forma crítica para distinguir os conteúdos confiáveis de não confiáveis.",
      eixo: "Cultura Digital",
      principal: true,
      ondeAcontece:
        "Etapas 2 e 3: as oito mensagens chegam sem etiqueta, e a criança escolhe as 3 que vão para o Mural. O painel registra o nível pela seleção — três verdadeiras é “atingiu”; duas verdadeiras e uma falsa, seja emocional ou neutra, “em processo”; duas falsas ou mais, “não atingiu”. O tipo da falsa que cada um repassou está na folha da turma, para você conversar. Ao zerar a turma com o mesmo pacote, quem já jogou não é medido de novo: ele já viu a resposta.",
    },
    {
      codigo: "EF05CO03",
      texto:
        "Realizar operações de negação, conjunção e disjunção sobre sentenças lógicas e valores 'verdadeiro' e 'falso'.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Etapa 4, na revelação: cada mensagem ganha DOIS selos independentes — verdadeira ou falsa, e emocional ou neutra —, e a criança vê que “séria” não quer dizer “verdadeira”. O painel registra a habilidade pela primeira pergunta da Nina, no fim da missão: uma colega diz que a mensagem calma e cheia de números é verdadeira “porque é séria”, e a criança diz se concorda.",
    },
    {
      codigo: "EF05CO04",
      texto:
        "Criar e simular algoritmos representados em linguagem oral, escrita ou pictográfica, que incluam sequências, repetições e seleções condicionais para resolver problemas de forma independente e em colaboração.",
      eixo: "Pensamento Computacional",
      ondeAcontece:
        "Etapa 6: a criança monta a própria regra “Se a mensagem for…, então eu…” para o áudio do tio. Na segunda pergunta da Nina a criança reconhece, entre três regras de colegas, a que funciona de verdade — condição que dá para conferir, ação concreta e a ordem certa. O CRIAR é a regra que ela escreveu, e quem a classifica é você, com um clique, na folha da turma — o seu clique vale sobre a pergunta.",
    },
  ],

  antes: {
    tecnico: [
      {
        titulo: "Libere a missão na sala de aula",
        texto:
          "Sem a liberação, o cartão fica com cadeado para as crianças. É na sala, em Missões, e vale só para a turma em que você liberar.",
      },
      {
        titulo: "Aprove o pacote da turma — sem ele a aula não existe",
        texto:
          "Em A aula e os resultados: escolha o componente curricular, escreva o tema (ele completa a fala da Nina, “Rolou uma confusão sobre…”, então vai em minúscula e sem ponto, como “o passeio ao museu”), liste de 3 a 6 fatos da aula e clique em Gerar Atividade com IA — ou em Usar Pacote Curado Padrão. Leia as 8 mensagens, edite o que quiser e clique em Aprovar Pacote.",
      },
      {
        titulo: "Monte as equipes, se a turma divide computadores",
        texto:
          "Na ficha da missão, aberta pela turma: quem entra na missão representa a equipe, e o painel e o Termômetro passam a contar por computador.",
      },
      {
        titulo: "Deixe o painel no seu computador e projete só o Termômetro",
        texto:
          "São três botões durante a aula — Liberar Revelação, Apresentar Síntese e Liberar Reflexão —, na ordem, e nenhum volta atrás. Os selos e a folha da turma são para a sua tela; o botão Projetar o Termômetro abre, em tela cheia, só as contas da turma.",
      },
      {
        titulo: "Não há mídia para preparar",
        texto:
          "A imagem é um comunicado desenhado a partir do texto e o link é uma prévia com a manchete. Nada depende de fone nem de download.",
      },
    ],
    pedagogico: [
      {
        titulo: "Escolha um tema que a turma reconheça",
        texto:
          "Um acontecimento fictício da vida da escola, ligado à sua disciplina: a feira do livro, a água do bebedouro, o acervo da biblioteca. O reconhecimento é o que faz a criança querer repassar — com um tema distante, ela lê com calma e a missão mede outra coisa.",
      },
      {
        titulo: "Leia as oito mensagens pelos selos antes da aula",
        texto:
          "A falsa neutra é a que mais engana: calma, organizada, com cara de comunicado. A verdadeira emocional é a que mais se descarta, porque parece exagero. Saber qual é qual antes da aula é o que deixa você acolher a surpresa sem entregar a resposta.",
      },
      {
        titulo: "Decida o que fazer com a criança que se reconhecer",
        texto:
          "Alguém vai dizer, em voz alta, que encaminhou a falsa que parecia mais séria. O telão é anônimo; se ela se expuser sozinha, o que a aula precisa é de você dizendo que foi exatamente isso que a turma inteira fez — e não de um elogio à coragem dela.",
      },
    ],
    naoDiga: [
      "“Hoje vamos falar sobre fake news.” É a frase que desliga a missão: a partir dela a turma escolhe para a aula, não para o Mural.",
      "“Prestem atenção, tem mensagem mentirosa aí.” Vira caça ao erro, e a criança passa a procurar o truque em vez de decidir como decidiria no celular dela.",
      "“Quem encaminhou a falsa?” Nem no debate. O telão é anônimo por desenho, e uma pergunta dessas transforma a revelação em confissão pública.",
      "“Era fácil ver que essa era mentira.” Não era: a falsa neutra tem cara de comunicado oficial. Dizer isso ensina que quem caiu foi bobo, o oposto do que a aula conclui.",
    ],
  },

  roteiro: {
    total: "1 aula · 50 min",
    linhas: [
      {
        tempo: "0–5",
        momento: "Desafiar: o pedido da Nina",
        professor:
          "Peça que abram a missão e leiam a conversa da Nina. Não explique nada além da tarefa: ajudar a Nina encaminhando 3 mensagens para o Mural da Turma.",
      },
      {
        tempo: "5–20",
        momento: "Navegar e decidir: o grupo, o Mural e a enquete",
        professor:
          "Circule sem responder “essa é verdade?”: devolva a pergunta — o que te faz achar que é? Acompanhe no painel quantos confirmaram o Mural e quantos votaram na enquete.",
      },
      {
        tempo: "20–27",
        momento: "Resultado: a revelação",
        professor:
          "Quando a maioria tiver votado, chame a atenção da turma para o telão e aperte. Projete o Termômetro e deixe a surpresa acontecer antes de explicar qualquer coisa.",
        botao: "Liberar Revelação",
      },
      {
        tempo: "27–35",
        momento: "Explicar: a síntese e a roda de conversa",
        professor:
          "Apresente a síntese e conduza as 3 perguntas do roteiro, de 5 a 7 minutos. Ninguém precisa dizer o que encaminhou.",
        botao: "Apresentar Síntese",
      },
      {
        tempo: "35–45",
        momento: "Refletir: a regra Se/Então e as perguntas da Nina",
        professor:
          "Diga que a regra vai só para você e libere. Deixe escrever em silêncio; quem terminar responde às duas perguntas da Nina e vê a missão concluída.",
        botao: "Liberar Reflexão",
      },
      {
        tempo: "45–50",
        momento: "Fechamento",
        professor:
          "Feche com a síntese em voz alta — as frases precisam caber na boca de uma criança de 10 anos contando em casa.",
      },
    ],
    nota:
      "Em duas sessões de 25 min, pare depois do voto na enquete: a tela de cada um espera por você, o servidor guarda o que cada um escolheu, e a revelação abre a segunda sessão. A síntese pode ser pulada — depois da revelação, Liberar Reflexão já está disponível.",
  },

  debate: {
    aberturaNaLousa: "Dá para saber se é verdade só pelo jeito da mensagem?",
    tempo:
      "5 a 7 minutos. Comece pelas 3 perguntas do roteiro — as mesmas que o painel mostra, no quadro logo abaixo — e use estas se a conversa pedir mais.",
    perguntas: [
      {
        nivel: "retomada",
        pergunta: "Qual das suas 3 mensagens mais surpreendeu quando os selos apareceram?",
        porQue:
          "Começa pelo que cada um viu no próprio aparelho, sem obrigar ninguém a dizer o que encaminhou. A surpresa é o material: é ali que os dois eixos se separaram.",
      },
      {
        nivel: "analise",
        pergunta: "O que a mensagem falsa e calma tinha que fazia ela parecer confiável?",
        porQue:
          "Põe o mecanismo à vista: formato de comunicado, número, palavra difícil, remetente com cara de oficial. Cace as marcas, não o veredito.",
      },
      {
        nivel: "generalizacao",
        pergunta: "Então, o tom de uma mensagem diz se ela é verdadeira?",
        porQue:
          "É a EF05CO03 em voz alta: a resposta útil é que são duas perguntas diferentes — uma sobre o jeito, outra sobre a verdade. Deixe a turma chegar lá; não feche por ela.",
      },
      {
        nivel: "transferencia",
        pergunta: "Se chegar um áudio assustado no grupo da família pedindo para repassar correndo, o que você faz antes?",
        porQue:
          "Tira a lição da ficção e a transforma em gesto — e é a ponte para a regra Se/Então que vem logo depois. Cace o verbo: parar, comparar com outra fonte, perguntar a um adulto.",
      },
    ],
  },

  observacao: {
    intro:
      "Anote ao lado do nome durante o debate. Nada disso é nota — e nada disso é “quantas falsas encaminhou”: a seleção de cada um já está no painel de habilidades.",
    marcas: [
      {
        letra: "S",
        texto: "Separou os dois eixos: disse que uma mensagem era séria E falsa, ou alarmada E verdadeira.",
      },
      {
        letra: "M",
        texto: "Nomeou o que pesou na própria escolha — a pressa, quem mandou, a emoção, a aparência — com as palavras dele.",
      },
      {
        letra: "C",
        texto: "Falou em comparar com outra fonte ou perguntar a alguém antes de repassar.",
      },
      {
        letra: "R",
        texto: "Assumiu no debate que encaminhou sem conferir. É a fala mais valiosa da aula, e custa caro para uma criança de 10 anos.",
      },
    ],
    nota:
      "O painel de habilidades registra o que a criança escolheu e respondeu; esta folha registra o que ela DISSE. É com as duas, e com a regra Se/Então que ela escreveu, que você ajusta um nível no painel.",
  },

  mediacao: [
    {
      quando: "Alguém pergunta “essa é verdade, professora?” durante o grupo",
      faca:
        "Devolva: o que te faz achar que é? E quem mandou essa? A pergunta é a tarefa, e responder por ela encerra a etapa antes de ela acontecer.",
      naoFaca: "Confirmar ou negar. Uma resposta sua se espalha pela sala em trinta segundos — literalmente o mecanismo da aula.",
    },
    {
      quando: "Uma criança percebe em voz alta que encaminhou a falsa que parecia mais séria",
      faca:
        "Assuma junto: foi o que muita gente fez, e é por isso que o Termômetro tem aquela barra. A mensagem foi feita para parecer confiável — quem se expôs foi ela, e o seu papel é fazer disso o argumento, não o exemplo.",
      naoFaca: "Elogiar a coragem dela. Vira prêmio por se expor, e a próxima turma aprende a se expor.",
    },
    {
      quando: "A turma conclui que “mensagem com exclamação é sempre mentira”",
      faca:
        "Volte aos selos: havia verdadeiras emocionais no grupo, e a segunda barra do Termômetro conta quantas ficaram de fora. A lição não é trocar uma aparência por outra — é conferir.",
      naoFaca: "Deixar passar. É a heurística que a missão existe para desmontar, só que do avesso.",
    },
    {
      quando: "Alguém diz que nunca cairia nessa",
      faca:
        "Pergunte o que ela faria com o áudio do tio, no grupo da família, dizendo que as aulas vão ser canceladas. A distância cai quando a mensagem vem de alguém em quem ela confia.",
    },
    {
      quando: "A turma conclui que “não dá para acreditar em nada”",
      faca:
        "Volte ao grupo: metade das mensagens era verdadeira. A lição não é desconfiar de tudo — é ter um jeito de conferir antes de repassar, que é a regra que eles vão montar a seguir.",
      naoFaca: "Encerrar aí. É a conclusão errada mais comum, e ela produz cinismo em vez de critério.",
    },
  ],

  depois: {
    sintese: [
      "A verdade de uma mensagem não está na roupa que ela veste: a mentira pode vir calma e organizada, e a verdade pode vir num grito de alerta.",
      "Mensagem que pede para repassar correndo é a que mais merece um minuto de espera.",
      "Antes de encaminhar: compare com uma fonte confiável e não deixe a emoção apertar o botão por você.",
    ],
    registro:
      "A regra “Se a mensagem for…, então eu…” que cada um montou no fim da missão. Ela vai para você e mais ninguém, e você a lê na folha da turma — é por ela que você confere, e ajusta se precisar, a EF05CO04 no painel de habilidades.",
    produto: {
      titulo: "O cartaz das regras do 5º ano",
      itens: [
        "As regras Se/Então que a turma quiser compartilhar, escritas de novo pelas crianças que as fizeram — sem nome, se preferirem.",
        "As duas barras do Termômetro desenhadas no cartaz, com os números da turma.",
        "Uma frase final da turma para ficar no mural real da escola.",
      ],
    },
    rubrica: {
      nota:
        "Formativa, e sobre o RACIOCÍNIO — nunca sobre ter caído no truque. Os níveis da plataforma saem da seleção e das duas perguntas da Nina, e a EF05CO04 você também classifica pela regra escrita, na folha da turma; esta rubrica é para você ler a regra escrita e o que a criança disse.",
      criterios: [
        {
          criterio: "Separar tom e verdade (EF05CO03)",
          emDesenvolvimento: "Diz que a mensagem séria era verdadeira “porque era séria”.",
          adequado: "Reconhece que uma mensagem pode ser séria e falsa, ou alarmada e verdadeira.",
          avancado: "Explica que são duas perguntas diferentes e dá um exemplo do grupo.",
        },
        {
          criterio: "Distinguir o confiável do não confiável (EF05CO08)",
          emDesenvolvimento: "Encaminha pelo que assusta ou pelo que parece oficial, sem conferir nada.",
          adequado: "Aponta uma pista concreta que faltou conferir — quem mandou, de onde veio.",
          avancado: "Diz onde compararia a mensagem antes de encaminhar.",
        },
        {
          criterio: "Montar a regra condicional (EF05CO04)",
          emDesenvolvimento: "A regra não tem relação de “se… então” compreensível.",
          adequado: "A regra tem condição e ação, mas a ação é vaga (“eu olho se é verdade”).",
          avancado: "A ação é um gesto verificável de checagem antes de repassar.",
        },
      ],
    },
    desdobramentos: [
      "Língua Portuguesa: comparar a mensagem falsa neutra com uma notícia real sobre o mesmo assunto (EF05LP16) — o mesmo fato em dois lugares, qual é mais confiável e por quê.",
      "Matemática: ler o Termômetro como tratamento da informação (EF05MA24) — quantos de quantos, e o que cada barra quer dizer.",
      "Na sua disciplina: aplicar de novo com um tema dela. Um pacote novo é uma atividade nova, e o painel de habilidades mostra as duas.",
    ],
  },

  cuidados: [
    "A criança que caiu na falsa neutra não é exemplo de nada. O telão é anônimo, e nenhuma pergunta sua pode pedir que alguém se identifique.",
    "Se o tema que você escolher for real e estiver quente na escola, diga antes que as mensagens da missão são inventadas para a aula — senão a família recebe em casa o boato que nasceu aqui.",
    "A regra escrita é lida por você e mais ninguém: a coordenação não a vê. Diga isso em voz alta antes de liberar — é o que faz a criança escrever o que pensa em vez do que soa bem.",
    "Ao editar as mensagens, não use pessoa real da escola nem palavras que denunciem a aula (a plataforma recusa “atividade”, “gabarito”, “nota” e “exercício” no que a criança lê). O selo diz o que a MENSAGEM é, nunca o que quem a encaminhou é.",
  ],

  adaptacoes: [
    {
      contexto: "Um computador para 2 ou 3 estudantes",
      comoAdaptar:
        "Monte as equipes na ficha: a equipe negocia cada encaminhamento e vota a enquete em consenso — já é a checagem acontecendo em voz alta. O painel conta por computador, e a habilidade de quem entrou é copiada para a equipe.",
    },
    {
      contexto: "Só o computador do professor, projetado",
      comoAdaptar:
        "Na ficha, monte as equipes com um computador só: a turma inteira vira uma equipe, e um estudante entra na missão no computador projetado. Leia as mensagens em voz alta e a turma decide, por votação, as 3 que vão para o Mural. O resultado chega ao painel de habilidades “a revisar” e só conta depois de você confirmar para a turma.",
    },
    {
      contexto: "Duas aulas de 25 minutos",
      comoAdaptar:
        "Na primeira, as etapas 1 a 3, até o voto na enquete. Na segunda, a revelação, a roda de conversa e a regra. Nada se perde entre as duas.",
    },
    {
      contexto: "Turma com leitura ainda em construção",
      comoAdaptar:
        "Leia a conversa da Nina e as mensagens longas em voz alta uma vez, sem comentar nenhuma. Cada balão tem no máximo 45 palavras.",
    },
    {
      contexto: "Sobrou tempo",
      comoAdaptar:
        "Peça que, em duplas, reescrevam a falsa neutra como uma mensagem verdadeira e calma sobre o mesmo assunto. É a aula do avesso, e ela mostra que a aparência se copia.",
    },
  ],

  duvidas: [
    {
      pergunta: "As mensagens vêm de um WhatsApp de verdade?",
      resposta:
        "Não. É um clone, dentro da plataforma, e as oito mensagens são as do pacote que VOCÊ aprovou. Ninguém envia nem recebe nada fora dali, e não há digitação livre no grupo.",
    },
    {
      pergunta: "Por que a missão não abre para a minha turma?",
      resposta:
        "Há duas portas: a missão precisa estar liberada na sala de aula e ter um pacote aprovado para a turma. Sem a liberação, o cartão fica com cadeado; sem o pacote, a criança entra e vê uma tela de espera.",
    },
    {
      pergunta: "A inteligência artificial escreve o que quiser?",
      resposta:
        "Não. A posição, o formato e o gabarito de cada mensagem são sorteados na plataforma; o modelo só escreve os textos para o seu tema, e o que ele devolve passa pela mesma régua da aprovação. Se não houver saldo de IA ou o serviço falhar, o pacote curado vem no lugar, e a tela diz isso. Nada chega à turma sem o seu clique em Aprovar Pacote.",
    },
    {
      pergunta: "Apertei a revelação cedo demais. E agora?",
      resposta:
        "A fase não volta, e nada se perde: quem ainda não tinha confirmado o Mural continua no grupo, confirma, vota e vê a própria revelação depois. Só entra no Termômetro quando confirmar.",
    },
    {
      pergunta: "Dá para aplicar de novo na mesma turma?",
      resposta:
        "Dá. Zerar Turma para Nova Aplicação abre uma rodada nova com o mesmo pacote e guarda a anterior: o painel de habilidades mostra as rodadas e fica com a melhor de cada habilidade. Aprovar um pacote diferente abre uma atividade nova.",
    },
    {
      pergunta: "Posso ver a regra que cada um escreveu?",
      resposta:
        "Sim, na folha da turma — e só quem leciona na turma lê o texto: é escrito por menor de idade, e a plataforma não o entrega a mais ninguém.",
    },
    {
      pergunta: "Como a missão registra as habilidades da BNCC?",
      resposta:
        "A EF05CO08 pela seleção do Mural, só três verdadeiras atingem; a EF05CO03 e a EF05CO04 pelas duas perguntas da Nina, no fim; e a EF05CO04 também pela regra que a criança escreveu, que você classifica na folha da turma. Quem sai antes das perguntas fica “Não avaliado” nelas, nunca “Não atingiu”. Refazer com o mesmo pacote não mede de novo quem já jogou. Você confere e ajusta tudo no painel de habilidades.",
    },
  ],
};
