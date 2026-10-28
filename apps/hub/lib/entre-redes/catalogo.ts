/**
 * Catálogo do **Entre Redes** — o produto de letramento digital da Unooria.
 *
 * O Entre Redes é uma trilha, não uma atividade solta: cada ano da Educação
 * Básica — 1º ao 9º do Fundamental e as 3 séries do Médio — tem **4 unidades**,
 * e cada unidade é uma **missão**. As publicadas estão em `MISSOES_PUBLICADAS`,
 * mais abaixo; as demais aparecem na trilha como "Em breve" porque a grade é a
 * informação: o professor precisa enxergar onde a missão dele mora.
 *
 * Este arquivo é a fonte da verdade da trilha. Ele descreve o CATÁLOGO
 * (o que a Unooria oferece); as **atividades** que o professor cria a partir de
 * uma missão são instâncias no banco (`exp08ef1b_activities`), com rota própria em
 * `/professor/atividades/**`.
 *
 * NOTA DE MODELAGEM: enquanto existir uma única missão COM ATIVIDADES, toda
 * atividade pertence a `MISSAO_ATUAL` por construção — por isso `exp08ef1b_activities`
 * ainda não tem coluna `missao`. Missões sem `exp08ef1b_activities` (o UnooTube do 4º
 * ano: conteúdo fixo, resultados em tabela própria da api) não mudam isso.
 * Quando a segunda missão configurável entrar, o caminho é adicionar essa
 * coluna (default = slug da missão atual) e filtrar as listagens por ela; os
 * pontos que hoje assumem a missão única estão marcados com `MISSAO_ATUAL`.
 */

export type StatusMissao = "disponivel" | "em-breve";

/** Um ato do roteiro da missão, como o professor precisa entender. */
export type AtoDaMissao = {
  rotulo: string;
  texto: string;
  /**
   * Para onde ir para FAZER o que o ato descreve.
   *
   * Existe porque o Ato 1 do Instanooria manda a turma jogar a Vila do Lume e
   * não havia caminho nenhum até ela: o texto citava a missão pelo nome e o
   * professor tinha de encontrá-la sozinho na trilha. O `texto` é interpolado
   * como string, então o link não cabe dentro dele — ele é um campo à parte, e
   * a tela o renderiza depois do parágrafo.
   */
  link?: { href: string; rotulo: string };
};

/** Ficha pedagógica — só existe em missão publicada. */
export type FichaDaMissao = {
  /** O que a missão trabalha, em uma linha. */
  competencia: string;
  /** Tempo de aula previsto. */
  duracao: string;
  /** Como a missão se apresenta ao estudante. */
  formato: string;
  atos: AtoDaMissao[];
  /** O que o professor faz antes de rodar com a turma. */
  preparo: string[];
};

export type Missao = {
  anoSlug: string;
  unidadeSlug: string;
  unidade: number;
  /**
   * Id da experiência do estudante (`apps/experiencias/<expId>`): a chave que liga
   * catálogo, manifesto `experiencias` e `/exp/:expId`. Só em missão disponível.
   */
  expId?: string;
  titulo: string;
  resumo: string;
  status: StatusMissao;
  /** Presente apenas quando `status === 'disponivel'`. */
  ficha?: FichaDaMissao;
  /**
   * Como a missão se apresenta AO ESTUDANTE no hub dele (`/estudante`). Separado de
   * `titulo`/`resumo`, que são escritos para o professor: o estudante não lê
   * "competência" nem "o estudante investiga", e a copy dele não pode entregar a
   * virada da missão antes da hora.
   */
  estudante?: { titulo: string; chamada: string };
};

/** As três etapas da Educação Básica atendidas pela plataforma. */
export type Etapa = "anos-iniciais" | "anos-finais" | "ensino-medio";

export const ROTULO_DA_ETAPA: Record<Etapa, string> = {
  "anos-iniciais": "Ensino Fundamental — Anos Iniciais",
  "anos-finais": "Ensino Fundamental — Anos Finais",
  "ensino-medio": "Ensino Médio",
};

export type Ano = {
  slug: string;
  rotulo: string;
  etapa: Etapa;
  missoes: Missao[];
};

/** Toda unidade tem o mesmo slug em qualquer ano: unidade-1…unidade-4. */
export const UNIDADES_POR_ANO = 4;

function unidadeSlug(unidade: number): string {
  return `unidade-${unidade}`;
}

/**
 * Preenche as unidades que ainda não têm conteúdo. Sem título inventado: a
 * trilha mostra a lacuna honestamente, em vez de prometer uma missão que não
 * existe.
 */
function unidadesEmBreve(anoSlug: string, exceto: number[] = []): Missao[] {
  const unidades: Missao[] = [];
  for (let unidade = 1; unidade <= UNIDADES_POR_ANO; unidade += 1) {
    if (exceto.includes(unidade)) continue;
    unidades.push({
      anoSlug,
      unidadeSlug: unidadeSlug(unidade),
      unidade,
      titulo: `Unidade ${unidade}`,
      resumo: "Missão em produção.",
      status: "em-breve",
    });
  }
  return unidades;
}

/**
 * A missão que existe hoje: o Unoovista, a bolha de filtro do 8º ano.
 * É a única com ficha, guia e atividades configuráveis.
 */
export const MISSAO_ATUAL: Missao = {
  anoSlug: "8-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp08ef1b",
  titulo: "O Conteúdo que não chegou",
  resumo:
    "O estudante investiga uma pergunta do seu conteúdo dentro de uma rede social — e só na revelação final descobre que o feed dele foi montado para puxá-lo para um dos lados.",
  status: "disponivel",
  // Sem spoiler: a missão só funciona se a revelação chegar de surpresa.
  estudante: {
    titulo: "Unoovista",
    chamada:
      "Entre na rede social da turma, investigue a pergunta da missão pelo feed e escreva a sua conclusão.",
  },
  ficha: {
    competencia:
      "Letramento digital — como um feed decide o que cada pessoa vê, e o que isso faz com uma opinião em formação.",
    duracao: "2 aulas (100 min) no app, mais o jogo do Ato 1",
    formato: "Dois atos: um jogo fora da plataforma e uma missão dentro do app",
    atos: [
      {
        rotulo: "Ato 1 — o jogo",
        texto:
          "A turma joga a Vila do Lume (a missão transversal), e o perfil de valores dela decide de que lado o feed de cada estudante nasce. No momento em que joga, nada liga o jogo a esta missão — e é essa desconexão que faz a revelação funcionar. Traga os perfis na tela da atividade; quem não jogou entra no sorteio balanceado.",
        link: {
          href: "/professor/entre-redes/vila-do-lume",
          rotulo: "Abrir a Vila do Lume",
        },
      },
      {
        rotulo: "Ato 2 — a missão",
        texto:
          "Você informa o tema da sua disciplina; a IA propõe a pergunta-chave, você valida, e o banco de posts nasce com o mesmo argumento escrito em quatro linguagens. O feed de cada estudante já começa puxado para um lado — e o motor fecha a bolha pela rolagem.",
      },
      {
        rotulo: "Fechamento",
        texto:
          "O estudante escreve a própria conclusão, recebe a revelação, lê o relatório do que o feed fez com ele e vê a comparação lado a lado com a turma.",
      },
    ],
    preparo: [
      "Criar a atividade a partir do tema e do recorte da sua disciplina.",
      "Escolher (ou reescrever) a pergunta-chave que a IA propõe.",
      "Validar os dois lados destilados e a tabela de afinidade.",
      "Revisar os posts gerados na visão de matriz e ativar a atividade.",
    ],
  },
};

/**
 * O UnooTube, ARQUIVADO (ADR-116) — fontes confiáveis vs. sensacionalismo num
 * clone do YouTube Shorts. Foi a missão do 4º ano, unidade 1, até o Jornal da
 * Escola tomar o código `exp04ef1b` (`MISSAO_JORNAL_DA_ESCOLA`, logo abaixo).
 * Fica aqui, renomeado, como registro da ficha: NÃO está em
 * `MISSOES_PUBLICADAS`, e é isso que o tira da grade.
 */
export const MISSAO_BACKUP_UNOOTUBE: Missao = {
  anoSlug: "4-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "backup-exp04ef1b",
  titulo: "UnooTube — Em quais fontes você confiaria?",
  resumo:
    "Num feed de vídeos curtos sobre História, o estudante salva as 3 fontes em que confiaria. Quem escolhe sensacionalismo ganha mais inscritos — até a turma descobrir que popularidade não é credibilidade.",
  status: "disponivel",
  estudante: {
    titulo: "UnooTube",
    chamada:
      "Um feed de vídeos curtos sobre História: assista e salve as 3 fontes em que você confiaria.",
  },
  ficha: {
    competencia:
      "Letramento digital — distinguir fontes confiáveis de conteúdo sensacionalista em vídeos curtos, e perceber que inscritos não medem verdade.",
    duracao: "1 aula (50 min)",
    formato: "Clone do YouTube Shorts com 21 vídeos de História (Grandes Navegações, escrita, arqueologia)",
    atos: [
      {
        rotulo: "1 — Explorar o feed",
        texto:
          "O estudante assiste aos Shorts e salva até 3 vídeos que pareçam contar uma história confiável. Metade cita fonte verificável e tem poucos inscritos; a outra metade é sensacionalista e tem '1 mil inscritos'.",
      },
      {
        rotulo: "2 — Ranking por inscritos",
        texto:
          "Ao 3º salvo, o ranking da turma abre ordenado por inscritos — e quem escolheu fake aparece no topo. O estudante se vê perdendo por ter acertado.",
      },
      {
        rotulo: "3 — Adicionar credibilidade",
        texto:
          "Um botão revela a coluna 'fontes confiáveis' e a métrica vira. A frase que fica: ter muitos inscritos não significa contar a verdade.",
      },
    ],
    preparo: [
      "Conferir som ou fones: os vídeos começam mudos e o estudante liga o som.",
      "Avisar que a pesquisa do app está bloqueada durante a missão — é de propósito.",
      "Nada a configurar: é só entrar com a turma e acompanhar os resultados aqui.",
    ],
  },
};

/**
 * 4º ano · Unidade 1 — Jornal da Escola: A Edição de Bento (`exp04ef1b`).
 *
 * Toma o código e o lugar do UnooTube arquivado (ADR-116). A criança é editora
 * do jornal da escola: oito notícias de oito meios, três vagas na capa. A
 * redação é da UNOORIA, e não um clone — o PDF "proposta revisada" pede um
 * ambiente próprio, sem Instagram nem WhatsApp de verdade; o post e a mensagem
 * aparecem como conteúdo simulado dentro dela.
 *
 * O professor tem DOIS portões, num botão só que avança: Liberar resultado
 * (as reações dos leitores e o "X de 3 notícias verificadas") e, depois da
 * conversa com a turma, Liberar revisão (a Chave do Editor, a 2ª edição, o
 * teste da Chave e a mensagem nova). Nenhum volta, e entre os dois cabe a
 * pausa de quem faz a missão em duas aulas (3.0.0, ADR-168). E a missão NÃO nasce vazia, como a exp07ef1b: sem preparo, a
 * turma roda o banco padrão "Feira de Ciências e Notícias da Cidade".
 *
 * Tem ficha pedagógica (E14): a atividade é o PACOTE homologado e a rodada é o
 * "Zerar"; o painel de habilidades mora nos resultados, com `?pacote=`. Nasce
 * com equipe (E13): o painel conta por computador.
 */
export const MISSAO_JORNAL_DA_ESCOLA: Missao = {
  anoSlug: "4-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp04ef1b",
  titulo: "Jornal da Escola: A Edição de Bento",
  resumo:
    "O Bento, que cuida do jornal da escola, recebe oito notícias de meios diferentes para uma " +
    "capa de três vagas. Cada computador escolhe as suas e publica a 1ª edição; quando você libera " +
    "o resultado, os leitores reagem ao que foi publicado. Depois da conversa com a turma, você " +
    "libera a revisão: cada dupla monta a sua Chave do Editor, revisa a capa, publica a 2ª edição, " +
    "testa a Chave em duas matérias novas e decide o que fazer com uma mensagem urgente.",
  status: "disponivel",
  // Sem spoiler: é o desafio do PDF (§4), palavra por palavra. A missão mede o
  // que a criança escolhe quando ninguém avisou para checar.
  estudante: {
    titulo: "Jornal da Escola",
    chamada:
      "Você é o editor do jornal da escola. Escolha três notícias para informar seus leitores e " +
      "monte a edição de hoje.",
  },
  ficha: {
    competencia:
      "Letramento midiático — conferir de onde veio, quando aconteceu e quem assina uma notícia " +
      "antes de publicá-la. BNCC Computação: EF04CO08 (verificar a confiabilidade das fontes), " +
      "EF15CO04 (decomposição) e EF15CO02 (algoritmos simples).",
    duracao: "1 aula de 50 min, ou 2 aulas com a pausa depois do resultado",
    formato:
      "Uma redação digital da Unooria, sem imitar rede social: a mesa com 8 notícias de 8 meios, a " +
      "primeira página com 3 vagas, o mural dos leitores e a Chave do Editor. A mensagem nova do fim " +
      "chega numa tela limpa da Unooria, fora da redação.",
    atos: [
      {
        rotulo: "1 — O Bento e as três vagas",
        texto:
          "O Bento abre a redação: chegaram 8 notícias e a capa só tem 3 vagas. Ele pede ajuda para " +
          "informar os colegas sem espalhar confusão — e depois fica calado até a revisão.",
      },
      {
        rotulo: "2 — A mesa: investigar as notícias",
        texto:
          "Oito cartões de meios diferentes — jornal impresso, rádio, telejornal, blog, portal, rede " +
          "social, mensagem encaminhada e mural da escola. Cada notícia abre no formato original, com " +
          "três botões: de onde veio, quando aconteceu e quem assina. Nada obriga a abrir: quem já sabe " +
          "checar checa sozinho. Cada pista aberta pede um Confio ou Não confio — é isso que o painel " +
          "de habilidades registra.",
      },
      {
        rotulo: "3 — A 1ª edição",
        texto:
          "Três notícias vão para a capa e podem ser trocadas até a publicação. A inteligência " +
          "artificial só escolhe o modelo da página (não escolhe notícia, não escreve nada), e um " +
          "modelo automático assume se ela não responder. Publicar é definitivo; só depois a tela " +
          "pergunta por que escolheram — antes, a pergunta anteciparia a descoberta. Aí a tela espera " +
          "por você.",
      },
      {
        rotulo: "4 — O resultado (o seu primeiro botão)",
        texto:
          "Liberar resultado mostra, em cada computador, as reações dos leitores às notícias " +
          "escolhidas e “X de 3 notícias verificadas nesta edição”. Você projeta o gráfico anônimo da " +
          "turma e conduz a conversa com as três perguntas do painel. Não há ranking nem exposição de " +
          "quem errou. Se a missão for em duas aulas, a primeira acaba aqui: o progresso fica salvo.",
      },
      {
        rotulo: "5 — A Chave e a revisão (o seu segundo botão)",
        texto:
          "Liberar revisão — na mesma aula ou no começo da segunda — traz o Bento de volta com seis " +
          "blocos: fonte, data, autoria e três armadilhas. Cada dupla monta a sua Chave do Editor, uma " +
          "vez só e sem correção: três blocos, quando cada pista passa ou falha, Não publico ou Olho a " +
          "próxima pista, e se vale para todas as notícias ou só para a primeira. Depois, cada vaga da " +
          "1ª edição ganha um marcador, a turma troca o que não tinha evidência, publica a 2ª edição e " +
          "compara as duas.",
      },
      {
        rotulo: "6 — O teste da Chave e a mensagem nova",
        texto:
          "A dupla aplica a própria Chave a duas matérias novas, sem imagem, e depois todos recebem a " +
          "mesma regra de referência. Por fim, numa tela limpa, chega uma mensagem urgente sobre um " +
          "corte de água, com Repassar à mão desde o começo. A tela não diz a ninguém se acertou: o " +
          "nível de cada um fica no painel de habilidades, só para você.",
      },
    ],
    preparo: [
      "Libere a missão para a turma na sala de aula — sem a liberação, o cartão fica com cadeado para as crianças.",
      "Nada é obrigatório antes da aula: sem preparo, a turma roda o banco padrão da Unooria, " +
        "“Feira de Ciências e Notícias da Cidade”. Em A aula e os resultados, Usar Banco Padrão o " +
        "confirma em um toque.",
      "Para um tema da sua aula: escolha o componente curricular, escreva o tema e os tópicos, " +
        "gere o pacote com IA e revise cada notícia — inclusive se ela pode ir para a capa e a " +
        "reação do leitor — e as duas matérias do teste da Chave. Nada gerado por inteligência " +
        "artificial chega à turma sem o seu clique em Aprovar Pacote.",
      "Depois de aprovar, gere as imagens no mesmo lugar: elas saem duas por vez. Notícia sem " +
        "imagem aparece desenhada pelo meio, e a missão roda igual.",
      "Se a turma divide computadores, monte as equipes aqui na ficha, em Equipes desta turma — " +
        "duplas é o arranjo recomendado. O painel conta por computador.",
      "Durante a aula são dois botões, na ordem — Liberar resultado e Liberar revisão —, e " +
        "nenhum volta. Em duas aulas, a pausa é entre os dois. Deixe o projetor pronto para o " +
        "gráfico da turma.",
      "Não diga que a aula é sobre notícia falsa, nem peça que abram as pistas: a missão mede o " +
        "que a turma escolhe quando ninguém avisou para checar.",
    ],
  },
};

/**
 * 2ª série do EM · Unidade 1 — a Missão Tempestade (`exp02em1b`).
 *
 * ATENÇÃO À COPY: os textos abaixo foram redigidos a partir das ADRs e dos dois
 * playtests documentados do projeto de origem, porque o guia do professor de lá
 * (`docs/09-guia-professor.md`) está VAZIO — o material de condução do debate
 * nunca foi escrito. E é no debate que a lição acontece: a missão
 * deliberadamente não revela nada por software, porque o viés de cada fonte é o
 * assunto da conversa depois. Esta ficha é ponto de partida para revisão
 * pedagógica, não palavra final.
 */
export const MISSAO_UNOOGPT: Missao = {
  anoSlug: "2-serie",
  unidadeSlug: "unidade-1",
  unidade: 1,
  /* A VERSÃO ANTERIOR (ADR-181): a reformulação tomou `exp02em1b`. Fora de
     `MISSOES_PUBLICADAS`, e é isso que a tira da grade — como o UnooTube. */
  expId: "exp02em1b-v0",
  titulo: "UnooriaAI — Decidir com o que os dados mostram",
  resumo:
    "Uma tempestade chega em uma hora e há 2 equipes para 4 bairros. O estudante conversa com um assistente de IA, pede os dados que quiser e decide — com 3 perguntas e o relógio correndo. Cada fonte mostra um pedaço distorcido da cidade, e é essa distorção que a turma discute depois.",
  status: "disponivel",
  estudante: {
    titulo: "UnooriaAI",
    chamada:
      "Uma tempestade chega a Serra do Sauá em uma hora. Você tem duas equipes, quatro bairros e um assistente que consulta os dados da cidade. Decida para onde mandar cada equipe.",
  },
  ficha: {
    competencia:
      "Letramento de dados — perguntar melhor, perceber que fontes discordam entre si e decidir sob incerteza, sem confundir 'não sabemos' com 'zero'.",
    duracao: "1 aula (50 min): ~5 min de missão por estudante, o resto é o debate",
    formato:
      "Clone de assistente de IA. O estudante conversa com um 'Cientista de Dados' que consulta 8 fontes sobre a cidade — cada uma com um viés que ele não vê",
    atos: [
      {
        rotulo: "1 — A missão, e a espera",
        texto:
          "A manchete, o mapa apagado e a frase que organiza tudo: não dá para atender todos. O cronômetro aparece PARADO — quem dá a largada é você, no painel, e ela vale para a turma inteira ao mesmo tempo. Enquanto não largar, ninguém fala com o assistente.",
      },
      {
        rotulo: "2 — Investigação: 3 perguntas, 5 minutos",
        texto:
          "O mapa começa VAZIO e só acende o que uma fonte carregada cobre. Conversar é de graça; investigar custa. Bairro sem cobertura fica em branco — e branco quer dizer 'não sabemos', nunca 'zero em risco'. É aqui que o estudante descobre que duas fontes discordam sobre o mesmo bairro.",
      },
      {
        rotulo: "3 — Decidir e dizer por quê",
        texto:
          "Ele manda cada equipe e responde 'por que aqui?', escolhendo entre as fontes que ABRIU — ou 'foi intuição, não olhei dado', que está sempre disponível. A plataforma não julga a resposta: quem lê é você. A lista nunca oferece a fonte que ele não consultou.",
      },
      {
        rotulo: "4 — Resultado: a faixa, não a nota",
        texto:
          "O desfecho é sorteado, e a manchete é uma FAIXA com 20 corridas da mesma decisão plotadas: a mesma escolha não repete igual. Vêm também um fato ('627 pessoas ficaram sem equipe no Morro Alto — você nunca consultou a previsão do tempo') e a lista do que ele nunca abriu. Não há pontuação.",
      },
    ],
    preparo: [
      "Abra /professor/entre-redes/2-serie/unidade-1/resultados ANTES da aula: é de lá que sai a largada, e nenhum estudante fala com o assistente antes dela.",
      "Combine a largada em voz alta. O relógio é da turma: quem chega antes espera, e a espera é a aula — não a tela travada.",
      "Você pode somar +2 minutos ou encerrar a qualquer momento. Somar não faz a chuva andar para trás.",
      "Guarde metade da aula para o debate: a missão NÃO conta a ninguém qual fonte engana em quê. Esse é o seu material, e está no guia.",
      "Turma sem partida nenhuma? Confira se a largada foi dada — é o motivo nº 1 de 'não abre'.",
    ],
  },
};

/**
 * As missões publicadas, indexadas pelo ano em que moram. Tudo o que não
 * está aqui entra na grade como "Em breve".
 */
/**
 * 6º ano · Unidade 2 — O Rastro do Boato (`exp06ef2b`).
 *
 * Clone de mensageiro móvel, em DUAS aulas com breakpoint entre elas, como a do
 * 7º ano — mas o objeto de análise é outro, e é isso que separa as duas na
 * trilha: aqui o estudante lê **dados de envio** (quantos saltos anônimos, quem
 * assinou, quando nasceu) e depois vê a própria decisão desenhada como
 * TOPOLOGIA. No 7º ano o que se audita é o recorte de um print, e a resposta é
 * citar a matéria completa.
 *
 * A professora tem UM botão durante a aula (abrir a Aula 2) e o inverso dele.
 * É menos do que os três da exp07ef1b porque esta missão pede menos: o debate
 * acontece depois do mapa, não no meio dele.
 *
 * A copy sai do sheet congelado da missão (passada 2), com uma exceção
 * declarada: o episódio de recapitulação é servido em TEXTO — a locução de
 * 3m20 do brief ainda não foi gravada, e a transcrição já está sempre na tela
 * por acessibilidade.
 */
export const MISSAO_RASTRO_BOATO: Missao = {
  anoSlug: "6-ano",
  unidadeSlug: "unidade-2",
  unidade: 2,
  expId: "exp06ef2b",
  titulo: "O Rastro do Boato — Por que a mentira voa?",
  resumo:
    "Um aviso de que a água da escola está contaminada corre quatro grupos em dez minutos, e a nota da direção com o laudo quase não sai do lugar. O estudante abre os dados de envio de cada mensagem, descobre que o alerta veio de seis encaminhamentos anônimos sem autor — e decide o que fazer quando chega o áudio convocando um protesto.",
  status: "disponivel",
  estudante: {
    titulo: "O Rastro do Boato",
    chamada:
      "Tomás te chama: um aviso sobre a água da escola está correndo os grupos. Descubra de onde essa mensagem saiu.",
  },
  ficha: {
    competencia:
      "Letramento midiático — ler os dados de envio de uma mensagem antes de repassá-la, e reconhecer que cada encaminhamento é uma escolha com consequência na rede.",
    duracao: "2 aulas de 30–35 min, com pausa entre elas",
    formato:
      "Clone de mensageiro móvel: quatro conversas com 6 mensagens auditáveis, a janela de dados de envio, e o mapa da rede depois da decisão",
    atos: [
      {
        rotulo: "1 — Auditar as mensagens (Aula 1)",
        texto:
          "O estudante percorre o Grêmio, a turma, o grupo do bairro e a conversa com Tomás. Cada balão abre um painel com os dados de envio: quantas vezes foi encaminhado, quem assinou, quando apareceu pela primeira vez. É preciso abrir os dados de TRÊS mensagens diferentes — e elas estão em conversas diferentes de propósito, para a investigação não caber numa rolagem só.",
      },
      {
        rotulo: "2 — Decidir sob pressão (Aula 1)",
        texto:
          "Quando a terceira mensagem é auditada, chega um áudio no grupo da turma convocando um protesto. Três respostas possíveis, uma escolha, sem volta. Nesta tela não há dica nenhuma: se o estudante travar por 90 segundos, e só então, uma frase lembra que o silêncio também deixa o boato correr.",
      },
      {
        rotulo: "3 — Pausa entre as aulas",
        texto:
          "Depois da decisão a missão para numa tela de pausa, com o progresso salvo. Ninguém vê o mapa até você abrir a Aula 2 no painel de resultados — é isso que faz a turma chegar junta à revelação.",
      },
      {
        rotulo: "4 — Ver o rastro e nomear o ciclo (Aula 2)",
        texto:
          "O gráfico mostra o aviso correndo 26 vezes mais rápido que a nota da direção. Depois o mapa da rede desenha o que a decisão de cada um produziu: a corrente cortada no terceiro nó, ou 1.200 conexões acesas. Quem não respondeu nada vê 850 — e é essa diferença que sustenta a descoberta. Em seguida o estudante monta os quatro blocos do ciclo do boato e registra no Meu percurso o que fará antes de encaminhar da próxima vez.",
      },
    ],
    preparo: [
      "Não há mídia para preparar: os áudios trazem a transcrição na tela, e o episódio de recapitulação é lido, não ouvido. Fone é bem-vindo, mas nada depende dele.",
      "Você conduz a aula por um botão no painel: abrir a Aula 2. Sem ele, ninguém passa da decisão — e a Etapa 4 foi desenhada para a turma ler o mapa junta.",
      "Reservar as duas aulas seguidas na agenda: o progresso fica salvo, mas a pausa foi desenhada para uma aula e a seguinte.",
      "Vale olhar a distribuição das respostas antes do debate: ela é o material das três perguntas, e não uma lista de quem acertou.",
    ],
  },
};

/**
 * 8º ano · Unidade 4 — O Manifesto da IA (`exp08ef4b`).
 *
 * A SEGUNDA missão do 8º ano, e a que fecha o ano letivo dele. Clone do
 * ChatGPT, como a exp02em1b — mas o que se audita aqui é outra coisa, e é isso que
 * separa as duas na trilha: na Missão Tempestade o estudante confere as FONTES
 * que o agente cita; aqui ele confronta a PREMISSA do sistema (a de que
 * algoritmo é neutro) e fixa uma regra que o código passa a obedecer.
 *
 * É a única missão do produto em que o estudante ESCREVE uma regra em vez de
 * escolher uma resposta — as quatro cláusulas são todas válidas, e o dado
 * pedagógico é qual delas ele defende e por quê.
 *
 * A professora tem UM botão durante a aula ("Pausar para Debate") e o inverso
 * dele, e ele é OPCIONAL: a missão corre inteira sem ninguém apertar nada,
 * porque a spec admite a sessão individual assíncrona. O congelamento é para a
 * turma confrontar os argumentos antes de cada um assinar por escrito.
 *
 * A copy sai do sheet congelado da missão (passada 2), com uma exceção
 * declarada: o episódio de recapitulação é servido em TEXTO — a locução de 4
 * minutos do brief ainda não foi gravada, e a transcrição já está sempre na
 * tela por acessibilidade.
 */
export const MISSAO_MANIFESTO_IA: Missao = {
  anoSlug: "8-ano",
  unidadeSlug: "unidade-4",
  unidade: 4,
  expId: "exp08ef4b",
  titulo: "O Manifesto da IA — Nossos direitos em código",
  resumo:
    "A direção quer instalar uma inteligência artificial para prever notas e monitorar presença, " +
    "e o sistema afirma que decide de forma neutra. O estudante audita a origem dos dados, " +
    "derruba a tese da neutralidade e fixa uma cláusula de governança que o código passa a obedecer.",
  status: "disponivel",
  estudante: {
    titulo: "O Manifesto da IA",
    chamada:
      "Amara descobriu que a escola vai instalar uma inteligência artificial para te avaliar. " +
      "Entre na conversa e veja o que ela responde.",
  },
  ficha: {
    competencia:
      "Identificar as questões éticas de um sistema de inteligência artificial escolar e propor " +
      "parâmetros de governança algorítmica que garantam direitos (EF08CO05, EF08CO07, EF08CO08).",
    duracao: "1 aula de 50 min, com pausa de 10 min para debate — ou 2 sessões de 25 min",
    formato:
      "Conversa com um assistente de inteligência artificial simulado, sem digitação livre: os " +
      "questionamentos são cartões prontos, e as respostas da máquina são autorais e fixas.",
    atos: [
      {
        rotulo: "1 — Ouvir Amara e abrir a conversa",
        texto:
          "Amara conta que o conselho escolar está homologando a compra do EduPredict IA e que o " +
          "sistema já está online. O estudante abre a conversa e lê a primeira fala da máquina: " +
          "que estudantes não precisam auditar os dados, porque algoritmos são neutros.",
      },
      {
        rotulo: "2 — Auditar a máquina (o que a aula mede)",
        texto:
          "Três questionamentos prontos, e ele precisa disparar ao menos dois para seguir. O " +
          "primeiro a máquina responde com estatística; o segundo — sobre os preconceitos do " +
          "passado — a obriga a admitir que assume as punições antigas como probabilidade válida. " +
          "É essa contradição que a missão inteira existe para tornar visível. Amara fica em " +
          "silêncio nesta etapa, de propósito.",
      },
      {
        rotulo: "3 — Fixar a cláusula inegociável",
        texto:
          "A máquina cede e pede uma regra prioritária. São quatro salvaguardas concorrentes — " +
          "transparência dos dados, auditoria de viés, veto humano e anonimização — e ele escolhe " +
          "UMA, em decisão irreversível. Nenhuma é a certa: o que se lê depois é qual a turma " +
          "escolheu e com que argumento.",
      },
      {
        rotulo: "4 — O manifesto, e a pausa para o debate",
        texto:
          "O sistema processa por dois segundos e compila o Manifesto de Direitos Digitais dos " +
          "Estudantes com a cláusula dele em destaque. É aqui que você congela as telas pelo " +
          "painel: a turma discute os quatro caminhos antes de cada um assinar o seu.",
      },
      {
        rotulo: "5 — Assinar e fechar",
        texto:
          "No Meu Percurso ele marca 2 palavras-chave e escreve por que aquela cláusula é " +
          "inegociável para ele. Depois vem o episódio de fechamento e o selo Guardião de " +
          "Direitos Digitais.",
      },
    ],
    preparo: [
      "Você pode personalizar o caso com um dilema real da escola no painel de resultados — ou " +
        "usar o pacote curado da Unooria, que é homologado e roda a aula inteira. Nada gerado por " +
        "inteligência artificial chega aos estudantes sem o seu clique em Aprovar.",
      "Leia as réplicas da máquina antes da aula: elas estão no painel, e é sobre elas que o " +
        "debate acontece. A segunda é a que faz a turma virar os votos.",
      "Não há mídia para preparar: os áudios não foram gravados ainda, e o episódio de " +
        "fechamento é lido, não ouvido. Fone é bem-vindo, mas nada depende dele.",
      "Reserve os 10 minutos do debate. O botão Pausar para Debate congela as telas; sem ele a " +
        "missão corre até o fim no ritmo de cada um, e a discussão coletiva não acontece.",
      "Vale olhar a distribuição das cláusulas antes de falar: ela é o material das três " +
        "perguntas, e não uma lista de quem acertou — as quatro são válidas.",
    ],
  },
};

/**
 * 1º ano · Unidade 1 — O Que a Foto Conta (`exp01ef1b`).
 *
 * A porta de entrada do Entre Redes: leitura de imagem no mural da turma
 * (clone do Instagram), para crianças em alfabetização inicial. A missão é
 * SÍNCRONA por desenho — os tablets congelam na Etapa 5 (a Roda de Conversa) e
 * só o professor libera a reflexão final; e é 100% formativa: não existe nota,
 * não existe "foto errada", e a resposta ingênua na síntese vira retry gentil.
 *
 * O professor tem DOIS controles ao vivo (liberar a reflexão e zerar a turma)
 * e UMA preparação opcional (gerar o pacote de legendas com IA e aprovar).
 * Sem preparação, o banco curado padrão — "O Mistério das Peças no Pátio" —
 * assume sozinho: a aula nunca fica sem material.
 */
export const MISSAO_FOTO_CONTA: Missao = {
  anoSlug: "1-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp01ef1b",
  titulo: "O Que a Foto Conta — toda foto mostra uma escolha",
  resumo:
    "No mural da turma, duas fotos do mesmo pátio contam histórias opostas: uma celebra o brinquedo que a turma montou, a outra mostra o chão cheio de peças. O estudante escolhe UMA foto e UMA legenda, publica — e descobre, pelos comentários dos colegas simulados, que o pedaço que ele escolheu mostrar mudou o que os outros viram.",
  status: "disponivel",
  estudante: {
    titulo: "O Que a Foto Conta",
    chamada:
      "Nina te espera no mural da turma: escolha a sua marca, olhe as fotos da escola e conte a sua história com uma foto e uma legenda.",
  },
  ficha: {
    competencia:
      "Letramento visual inicial — perceber que a imagem fotográfica é fruto de uma escolha de enquadramento e legenda, e que o que fica de fora da foto também faz parte da história.",
    duracao: "1 aula de 50 min (ou 2 sessões de ~25 min)",
    formato:
      "Mural da turma simulado (clone do Instagram) em tablet: feed com 3 fotos, escolha binária de foto e legenda, eco dos colegas e roda de conversa presencial",
    atos: [
      {
        rotulo: "1 — A marca do fotógrafo (Etapa 1)",
        texto:
          "Nina dá as boas-vindas em áudio e a criança escolhe uma das três marcas (Coruja Azul, Estrela Amarela, Sol Laranja) — a identidade dela dentro do mural. Tudo em CAIXA ALTA, com pictograma e locução: nenhuma instrução depende de leitura fluente.",
      },
      {
        rotulo: "2 — Explorar o mural (Etapa 2)",
        texto:
          "O feed da @turma_mural tem exatamente 3 fotos do cotidiano escolar. A criança rola e dá o toque duplo de curtir — familiarização com o gesto, sem nada valendo registro. Se ficar 30 segundos sem rolar, uma seta discreta aponta o caminho.",
      },
      {
        rotulo: "3 — O dilema da lente (Etapa 3)",
        texto:
          "Duas fotos do MESMO lugar, tiradas no mesmo minuto: o plano geral com as peças espalhadas e o plano detalhe do brinquedo montado. Duas legendas prontas, cada uma com pictograma e áudio. A criança escolhe uma foto E uma legenda e toca em COMPARTILHAR — a tela de confirmação tem só três elementos, de propósito.",
      },
      {
        rotulo: "4 — O eco dos colegas (Etapa 4)",
        texto:
          "O post sobe para o topo do mural e, em cadência fixa, Leo e Sofia comentam exatamente o que a foto deixou ver — e o que ela escondeu. A combinação cruzada (foto de uma coisa, legenda de outra) produz o estranhamento que vira material do debate.",
      },
      {
        rotulo: "5 — A Roda de Conversa (Etapa 5)",
        texto:
          "Todos os tablets congelam numa tela sem nenhum botão: HORA DA RODA DE CONVERSA! Você projeta as duas fotos lado a lado no painel de resultados, conduz o debate com as três perguntas do guia e, quando a conversa fechar, toca em LIBERAR REFLEXÃO FINAL.",
      },
      {
        rotulo: "6 — O olhar de detetive (Etapa 6)",
        texto:
          "Nina pergunta O QUE A FOTO MOSTRA? com duas respostas ilustradas. A Lupa (alguém escolheu o que mostrar) conclui com confete e a insígnia Olhar de Detetive; o Globo (a foto mostra tudo) recebe um lembrete gentil e a criança escolhe de novo — sem nota, sem penalidade, sem teto de tentativas.",
      },
    ],
    preparo: [
      "Libere a missão para a turma na sala de aula — sem a liberação, o cartão fica com cadeado para as crianças.",
      "Opcional: no painel da missão, gere com IA o pacote de legendas para o tema da semana (Pátio do Recreio, Horta, Sala de Aula ou Parquinho), confira o preview e aprove. Sem aprovação, o banco curado padrão assume sozinho até 10 minutos antes da aula.",
      "Fones de ouvido fazem diferença: toda instrução tem locução, e trinta tablets em autoplay ao mesmo tempo viram cacofonia sem eles.",
      "Rode a missão você mesmo uma vez, com calma — são ~12 minutos de tela. O que a criança NÃO pode saber de antemão: que os comentários de Leo e Sofia mudam conforme a foto escolhida.",
      "Na segunda aplicação no mesmo ano, TROQUE o tema do pacote (Recreio → Horta, por exemplo): repetir o cenário mede memória, não leitura de imagem.",
    ],
  },
};

/**
 * 5º ano · Unidade 1 — Quem Mandou Isso? v2.2 (`exp05ef1b`).
 *
 * A v1 saiu na ADR-114 e esta volta com o MESMO código e outra mecânica: oito
 * mensagens num grupo do WhatsApp simulado, na matriz verdadeira/falsa ×
 * emocional/neutra; exatamente três vão para o Mural da Turma, e só a
 * revelação do professor mostra os dois selos de cada uma. A descoberta
 * (EF05CO03) é que os dois eixos são INDEPENDENTES: a mensagem séria pode ser
 * falsa e a alarmada, verdadeira.
 *
 * Duas coisas que mudam a condução e não cabem no resumo:
 *
 * 1. **A missão NASCE VAZIA.** O tema do pacote entra na fala da Nina ("Rolou
 *    uma confusão sobre {tema}."), então sem um pacote aprovado pelo professor
 *    a criança vê espera, não um grupo — nem o banco curado assumindo sozinho.
 * 2. **São TRÊS botões durante a aula**, só para a frente: a revelação, a
 *    síntese (que pode ser pulada) e a reflexão.
 *
 * As habilidades avaliadas são SÓ as de Computação — EF05CO08 pela seleção do
 * Mural, EF05CO03 pelo alerta do grupo e EF05CO04 pelo robô do grupo (a ficha
 * E14 da api, v5: só ações). Os códigos de Língua Portuguesa do one-pager ("a confirmar") não
 * entram como habilidade avaliada.
 */
export const MISSAO_QUEM_MANDOU_ISSO: Missao = {
  anoSlug: "5-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp05ef1b",
  titulo: "Quem Mandou Isso?",
  resumo:
    "A Nina pede ajuda: rolou uma confusão na escola. No grupo da turma chegam 8 mensagens — " +
    "verdadeiras e falsas, calmas e alarmadas —, e cada estudante encaminha exatamente 3 para o " +
    "Mural da Turma e diz, numa enquete, o que pesou na escolha. Quando você libera a revelação, o " +
    "telão mostra o Termômetro da Turma e cada um descobre que a mensagem séria podia ser falsa, e a " +
    "alarmada, verdadeira.",
  status: "disponivel",
  // Sem spoiler: a missão mede o que a criança encaminha quando ninguém avisou
  // para desconfiar, e a copy dela é só a tarefa.
  estudante: {
    titulo: "Quem Mandou Isso?",
    chamada:
      "A Nina precisa da sua ajuda: rolou uma confusão na escola. Entre no grupo da turma e veja o que estão falando.",
  },
  ficha: {
    competencia:
      "Letramento digital, dinâmica de repasse e checagem crítica em mensagens instantâneas " +
      "(EF05CO08, EF05CO03, EF05CO04).",
    duracao: "1 aula de 50 min (ou 2 sessões de 25 min)",
    formato:
      "Unoochat, o aplicativo de mensagens da Unooria, em tema claro: a conversa com a Nina, o grupo da " +
      "turma com 8 mensagens, o Mural da Turma, a enquete e o alerta do grupo; o desafio final, o robô do grupo, é na tela da escola.",
    atos: [
      {
        rotulo: "1 — Desafiar: o pedido da Nina",
        texto:
          "A missão abre na lista de conversas. A Nina conta que rolou uma confusão sobre o tema que " +
          "você escreveu no preparo e manda o convite do grupo Turma 5ºB. É por isso que a missão só " +
          "abre depois que você aprova o pacote: a fala da Nina é sobre ele.",
      },
      {
        rotulo: "2 — Navegar: o grupo da turma",
        texto:
          "Oito mensagens de colegas: 4 textos, 2 imagens de comunicado e 2 links com prévia, duas de " +
          "cada quadrante (verdadeira ou falsa × emocional ou neutra). Ninguém digita — só " +
          "administradores falam no grupo —, e a única ação é a seta de encaminhar. Nenhuma mensagem " +
          "chega marcada.",
      },
      {
        rotulo: "3 — Decidir: o Mural e a enquete",
        texto:
          "Exatamente 3 mensagens vão para o Mural da Turma. Confirmado o envio, não dá para desfazer, " +
          "e surge a enquete “O que mais te fez escolher essas mensagens?”, com quatro opções. Depois " +
          "do voto a tela espera por você.",
      },
      {
        rotulo: "4 — Resultado: a revelação (o seu primeiro botão)",
        texto:
          "Você aperta Liberar Revelação: o painel mostra o Termômetro da Turma para projetar, e cada " +
          "aparelho ganha os dois selos sobre as 3 mensagens encaminhadas, com o motivo votado e o " +
          "lembrete do bimestre — e, logo abaixo, o alerta do grupo: as 8 mensagens com os dois selos e " +
          "4 pedidos em que a criança monta um filtro com E, OU e NÃO, vê quem passa e envia o alerta ao " +
          "grupo. É o alerta que registra a EF05CO03, e ele fecha quando você apresenta a síntese. Quem " +
          "ainda não tinha confirmado continua, confirma e vê a própria revelação depois.",
      },
      {
        rotulo: "5 — Explicar: a síntese e a roda de conversa",
        texto:
          "Apresentar Síntese leva aos aparelhos a ideia central — a embalagem da mensagem desarma a " +
          "checagem —, e você conduz a roda de conversa com as 3 perguntas do painel, de 5 a 7 " +
          "minutos. A síntese pode ser pulada.",
      },
      {
        rotulo: "6 — Refletir: o robô do grupo",
        texto:
          "Liberar Reflexão leva cada aparelho ao desafio do tio: a criança monta com blocos o robô do " +
          "grupo (“para cada mensagem nova”, “SE a mensagem for…”, “ENTÃO o robô…”), liga e vê o que ele " +
          "faz com 4 mensagens, a primeira delas o áudio assustado do tio, e envia. O robô registra a " +
          "EF05CO04 no painel de habilidades.",
      },
    ],
    preparo: [
      "Libere a missão para a turma na sala de aula — sem a liberação, o cartão fica com cadeado para as crianças.",
      "Crie a atividade em Nova atividade, aqui na ficha: escolha o componente curricular, escreva o " +
        "tema (ele completa a fala da Nina, “Rolou uma confusão sobre…”), liste de 3 a 6 fatos da " +
        "aula, um por linha, e gere com IA — ou use o pacote curado padrão, “O Mistério do Passeio ao " +
        "Museu”. Sem atividade em andamento, a criança entra e vê uma tela de espera.",
      "Leia as 8 mensagens antes de aprovar: os selos de verdadeira ou falsa e de emocional ou " +
        "neutra são só seus, e dá para editar qualquer texto. Nada gerado por inteligência artificial " +
        "chega à turma sem o seu clique em Aprovar Pacote.",
      "Se a turma divide computadores, monte as equipes ao criar a atividade: quem entra na missão " +
        "representa a equipe, e o painel conta por computador.",
      "Deixe o painel aberto no seu computador: são três botões durante a aula — Liberar Revelação, " +
        "Apresentar Síntese e Liberar Reflexão —, na ordem, e nenhum deles volta atrás.",
      "Não diga que a aula é sobre notícia falsa: a missão mede o que a criança encaminha quando " +
        "ninguém avisou para desconfiar.",
    ],
  },
};

/**
 * 7º ano · Unidade 1 — A Seleção (`exp07ef1b`).
 *
 * Clone do Instagram (a seção `instanooria` do DS), como a exp08ef1b — mas o
 * que se mede aqui é outra coisa, e é isso que separa as duas na trilha: no 8º
 * ano o feed se adapta ao estudante e a bolha é do algoritmo; no 7º o feed é o
 * MESMO para todos, e a bolha é a própria criança quem monta, escolhendo três
 * posts de doze. Nenhum veículo mente: a descoberta é que fatos verdadeiros,
 * selecionados, já contam a história por um lado.
 *
 * Substitui O Eco no Grupo, que ocupava esta unidade (decisão de 2026-09-23).
 *
 * Tem ficha pedagógica (E14), a segunda depois de Quem Mandou Isso? v2.2: a
 * atividade é a COBERTURA homologada, a rodada é o "Zerar", e o painel de habilidades mora nos
 * resultados dela. E nasce com equipe (E13): o Mural pareia COMPUTADORES.
 *
 * A professora tem UM botão durante a aula, que sempre mostra a próxima
 * etapa — Liberar Mural da Turma, Revelar Fichas Técnicas, Liberar Conclusão
 * Individual — e nunca volta. A missão NÃO nasce vazia, ao contrário da
 * exp05ef1b: sem preparo, a turma roda a cobertura curada da praça central.
 */
export const MISSAO_A_SELECAO: Missao = {
  anoSlug: "7-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp07ef1b",
  titulo: "A Seleção",
  resumo:
    "A Amara, do grêmio, pede ajuda para cobrir um evento do bairro nos Stories. O estudante " +
    "rola um feed com 12 publicações de três veículos locais sobre o mesmo acontecimento, salva " +
    "as que acha mais completas, fica com exatamente três e publica com uma legenda — sem volta. " +
    "Quando você abre o Mural, cada publicação aparece ao lado da de um colega que contou outra " +
    "história com os mesmos fatos verdadeiros; as fichas técnicas mostram quem cada um decidiu " +
    "ouvir.",
  status: "disponivel",
  estudante: {
    titulo: "A Seleção",
    chamada:
      "A Amara, do grêmio, precisa de uma força: escolha 3 posts da cobertura do bairro e " +
      "publique nos Stories do grêmio.",
  },
  ficha: {
    competencia:
      "Letramento midiático — perceber que escolher o que publicar já é contar a história por " +
      "um lado, e reconhecer que o colega que contou outra versão partiu dos mesmos fatos " +
      "verdadeiros. BNCC Computação: EF07CO11 (criar, documentar e publicar produtos digitais) " +
      "e EF07CO08 (empatia sobre opiniões divergentes na web).",
    duracao: "1 aula de 50 min, com o Mural da Turma no meio",
    formato:
      "Clone de rede social de fotos (o Instanooria): um feed com 12 publicações de três " +
      "veículos locais, a aba Salvos, os Stories do grêmio e o Mural da Turma. A conclusão e a " +
      "reflexão são na Unooria.",
    atos: [
      {
        rotulo: "1 — O pedido da Amara",
        texto:
          "A missão abre com uma mensagem direta da Amara, do grêmio: ela precisa fechar a " +
          "cobertura do evento de ontem no bairro e pede que o estudante escolha exatamente 3 " +
          "posts salvos e publique nos Stories do grêmio, com uma legenda explicando a escolha. " +
          "Nenhuma palavra sobre fontes, lados ou veículos — a Amara só volta no fechamento.",
      },
      {
        rotulo: "2 — O feed da cobertura",
        texto:
          "São 12 publicações intercaladas de três veículos locais — @folhaoficial_, " +
          "@voz_coletiva e @metrica_urbana —, quatro de cada, todas sobre o mesmo acontecimento " +
          "e todas verdadeiras. O estudante rola, curte e salva o que acha mais completo. Não há " +
          "busca nem comentário livre.",
      },
      {
        rotulo: "3 — A poda e a publicação",
        texto:
          "Na aba Salvos ele corta até ficar com exatamente três, escreve uma legenda de 10 a " +
          "140 caracteres e confirma: a publicação é definitiva. Depois disso a tela espera por " +
          "você, mostrando quantos colegas já publicaram. Quem publica atrasado, depois do Mural " +
          "aberto, ainda entra.",
      },
      {
        rotulo: "4 — O Mural da Turma (o seu primeiro e segundo botões)",
        texto:
          "Com cerca de 80% publicado, você aperta Liberar Mural da Turma: cada publicação " +
          "aparece ao lado da de um colega que escolheu diferente (outro computador, ou um " +
          "colega virtual quando não há par). A tela fica nua de propósito — é o choque de ver " +
          "outra história com o mesmo feed. Depois dos primeiros comentários, Revelar Fichas " +
          "Técnicas acende quem cada post ouviu, o ângulo da imagem e o equilíbrio editorial de " +
          "cada seleção.",
      },
      {
        rotulo: "5 — A conclusão (o seu terceiro botão)",
        texto:
          "Liberar Conclusão Individual abre três cards curtos — a ilusão da neutralidade, as " +
          "três lentes, e quem fala define a história —, cada um com leitura mínima de 8 " +
          "segundos, e a mensagem de fechamento da Amara, que liga a aula a A Reportagem Que Não " +
          "Saiu.",
      },
      {
        rotulo: "6 — A reflexão e as enquetes",
        texto:
          "Cada um escreve de 100 a 500 caracteres sobre um repórter que cobre a reforma de uma " +
          "escola ouvindo só a diretoria. Só você lê. Por fim, duas enquetes de um toque na " +
          "mensagem da Amara, que alimentam o painel de habilidades da turma.",
      },
    ],
    preparo: [
      "Nada é obrigatório antes da aula: sem preparo, a turma roda a cobertura curada da " +
        "Unooria sobre a reforma da praça central, com as 12 publicações e os gráficos prontos.",
      "Para um tema da sua cidade: em A aula e os resultados, escreva o evento, clique em Gerar " +
        "Lote com IA, leia e edite as legendas e clique em Aprovar Cobertura e Abrir Turma. " +
        "Nenhum texto gerado por inteligência artificial chega à turma sem esse clique.",
      "Depois de aprovar, gere as imagens dos posts no mesmo lugar — elas saem duas por vez e " +
        "podem levar alguns minutos. Post sem imagem aparece com a descrição da cena, e a missão " +
        "roda igual.",
      "Se a turma divide computadores, monte as equipes aqui na ficha, em Equipes desta turma: " +
        "o Mural pareia computadores, nunca dois estudantes do mesmo aparelho.",
      "Durante a aula é um botão só, e ele não volta. Espere cerca de 80% dos computadores " +
        "publicarem antes de liberar o Mural — o número anda sozinho no painel.",
      "Não leia as perguntas do debate antes do Mural: elas diriam à turma o que procurar no " +
        "feed, e a seleção deixaria de ser espontânea.",
    ],
  },
};

/**
 * 6º ano · Unidade 1 — O Júri Estadual de Projetos (`exp06ef1b`).
 *
 * O estudante é jurado de uma mostra científica estadual num feed de rede
 * social (o Unoovista). As curtidas dele afunilam o feed em silêncio; depois de
 * dez posts ele lacra o voto e espera — é o PICO: o professor projeta como os
 * votos da turma se dividiram e libera a Galeria Oculta, onde cada um vê o que
 * nunca chegou à tela dele. Com QUARENTA estandes (PO, 2026-10-14) e dez posts,
 * o total escondido é o mesmo para todos; a galeria prova O QUE sumiu — a
 * contagem por área e o feed "sem as suas curtidas" (calculados na api para
 * cada sessão: quem curte duas vezes a mesma área recebe quase só ela; quem não
 * curte nada vê as quatro misturadas). Nenhum número cravado na copy, de
 * propósito.
 *
 * As habilidades são as da ficha 6 (ADR-176, sobre o Canal A puro da ADR-174):
 * EF06CO01 (o foco primário), pelas PASTAS em que a criança guarda cada
 * estande no próprio feed, e EF06CO03, pela regra SE … ENTÃO, que encerra a
 * missão (o caso Mariana saiu na ADR-176), com o TEXTO OFICIAL de `apps/api/src/curriculo/dados/
 * habilidades-computacao.ts`. O PO, revisando com a equipe pedagógica contra o
 * texto oficial, tirou a EF06CO10 (consumo, obsolescência e sustentabilidade
 * não são o que a missão trabalha) e as enquetes; a EF06CO07 saiu antes.
 *
 * Tem ficha pedagógica (E14): a atividade é o PACOTE homologado e a rodada é o
 * "Zerar". Desde a 0.4.0 (PRD v2) tem BANCO PADRÃO: o professor usa a Feira
 * de Ciências e Sustentabilidade em um toque, ou gera os quarenta estandes
 * com IA sobre o tema dele; sem saldo de IA, o banco padrão entra no lugar. A
 * rodada de desvio saiu: o único botão da aula é Liberar Auditoria.
 */
export const MISSAO_JURI_ESTADUAL: Missao = {
  anoSlug: "6-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp06ef1b",
  titulo: "O Júri Estadual de Projetos",
  resumo:
    "Simulação de rede social onde as curtidas do estudante revelam como funcionam as bolhas " +
    "algorítmicas e os sistemas de recomendação. Ele é jurado de uma mostra estadual com quarenta " +
    "estandes de quatro áreas — do banco padrão ou escritos sobre o tema da sua aula —, lacra o " +
    "voto e, quando você libera a auditoria, descobre na Galeria Oculta os estandes que as " +
    "próprias curtidas esconderam dele.",
  status: "disponivel",
  // Sem spoiler: é o mandato da credencial (`e1.instrucao.missao_jurado`), e
  // nada nele diz que o feed se adapta.
  estudante: {
    titulo: "O Júri Estadual de Projetos",
    chamada:
      "Você foi nomeado jurado oficial. Explore as publicações das escolas concorrentes e eleja o " +
      "Grande Campeão Estadual.",
  },
  ficha: {
    competencia:
      "Letramento digital — perceber que um feed que se adapta às curtidas esconde parte do que " +
      "existe, e que essa engrenagem é uma regra que se pode descrever. BNCC Computação, com o foco " +
      "na EF06CO01 (classificar informações, agrupando-as em coleções (conjuntos) e associando " +
      "cada coleção a um ‘tipo de dados’) e na EF06CO03 (descrever com precisão a solução de um " +
      "problema, construindo o programa que implementa a solução descrita).",
    duracao: "1 aula de 50 min, cerca de 24 em tela (ou 2 sessões de 25 min)",
    formato:
      "Clone de rede social de fotos (o Unoovista): a credencial de jurado, o feed da mostra com as " +
      "pastas dos posts salvos, a cédula lacrada e a Galeria Oculta com a busca por hashtag. A " +
      "regra do feed é numa tela da Unooria.",
    atos: [
      {
        rotulo: "1 — A credencial de jurado",
        texto:
          "A Comissão Estadual da Mostra nomeia o estudante jurado oficial: ele vai explorar as " +
          "publicações das escolas concorrentes e eleger o grande campeão. Nenhuma palavra sobre " +
          "algoritmo, bolha ou filtro.",
      },
      {
        rotulo: "2 — O feed da mostra",
        texto:
          "As quatro primeiras publicações são uma de cada área. Daí em diante, cada curtida e cada " +
          "parada longa num post mudam o que vem a seguir, sem nenhum aviso na tela: quem curte " +
          "duas vezes a mesma área passa a receber só ela — outros projetos da mesma área, nenhum " +
          "repetido. A comissão pede que ele salve cada estande na pasta da área dele, como as " +
          "coleções de posts salvos de uma rede social. Depois de dez publicações, ou de 8 minutos, " +
          "a cédula abre.",
      },
      {
        rotulo: "3 — A cédula lacrada",
        texto:
          "Quatro elementos: o título, um dos estandes que ele viu, a certeza (as duas opções " +
          "afirmam certeza, de propósito) e o botão de confirmar. O voto é lacrado e não volta. Se a " +
          "cédula ficar parada mais de um minuto, a tela lembra que a comissão aguarda, e o seu " +
          "painel mostra um alerta ao lado do nome. O voto só fecha com todo estande visto numa " +
          "pasta: é nesse momento que a separação conta para a habilidade, uma vez só.",
      },
      {
        rotulo: "4 — A lousa e a Galeria Oculta (o seu botão)",
        texto:
          "Com a maioria votada, você projeta o Painel Coletivo de Votos da Turma e conduz as " +
          "perguntas da plenária. Aí você aperta Liberar Auditoria. Cada computador vê os estandes " +
          "que não chegaram ao feed dele — o total é igual para todos, as áreas não — e abre os de " +
          "cada área pelas hashtags. Busca e decide entre manter o voto inicial ou confirmar um voto " +
          "revisado. Na lousa, " +
          "você mostra quanto do feed caiu numa área só para quem curtiu e para quem não curtiu.",
      },
      {
        rotulo: "5 — A regra do feed",
        texto:
          "Numa tela da Unooria, o estudante monta a regra que o aplicativo seguiu: a condição (SE) " +
          "e a ação (ENTÃO), entre três peças cada, uma vez só. Depois, a tela mostra a regra certa " +
          "e o que ela fez no feed dele, e a missão termina com o crachá homologado. O podcast de " +
          "recapitulação fecha a aula, depois da Etapa 4.",
      },
    ],
    preparo: [
      "Libere a missão para a turma na sala de aula — sem a liberação, o cartão fica com cadeado para as crianças.",
      "Crie a atividade aqui na ficha, em Nova atividade. O caminho curto é Usar Banco Padrão Oficial: " +
        "um toque, sem IA. Para personalizar, escolha o componente curricular, o título da mostra e os " +
        "assuntos da semana e gere com IA; sem saldo de IA, o Acervo Padrão da Mostra entra no lugar.",
      "Na mostra personalizada, revise os quarenta estandes, uma aba por área (título, legenda e bastidor; " +
        "regenere o que não servir), e aprove em duas fases: os textos, depois as imagens — que saem quatro " +
        "por vez e levam vários minutos; sem elas aprovadas, a mostra não vai ao ar. Faça antes do dia da aula. " +
        "Nada gerado por inteligência artificial chega à turma sem a sua revisão.",
      "Se a turma divide computadores, escolha as equipes na criação. Não há rodízio obrigatório de quem " +
        "toca a tela: a organização do grupo fica com você. O painel conta por computador.",
      "Durante a aula é um botão só — Liberar Auditoria —, e ele não volta. Deixe o projetor pronto: o " +
        "painel de votos é para a lousa.",
      "Não diga que a aula é sobre algoritmo, bolha ou filtro: a missão mede o que a turma vota quando " +
        "ninguém avisou que o feed se adapta.",
    ],
  },
};

/**
 * 2ª série · Unidade 1 — O Efeito Amplificador (`exp02em1b`, ADR-181).
 *
 * Toma o código e o lugar da Missão Tempestade, que virou `exp02em1b-v0`
 * (`MISSAO_UNOOGPT`, acima) — no ar, mas fora da trilha. Vem da esteira
 * (artefatos de 2026-10-22), com as duas orientações do PO: sem a etapa de
 * transferência e sem o Canal B. A 2.1.0 (ADR-191, revisão de 2026-10-27) tirou a
 * IA da aula, trouxe a pauta do grêmio e o resumo do catálogo da copy.
 */
export const MISSAO_EFEITO_AMPLIFICADOR: Missao = {
  anoSlug: "2-serie",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp02em1b",
  titulo: "O Efeito Amplificador",
  // Copy `prof.catalogo.card_resumo`, literal: é texto do PROFESSOR, e não conta a virada.
  resumo: "Economia da atenção, letramento em IA generativa e impactos na saúde física e mental.",
  status: "disponivel",
  // Sem spoiler: a missão mede o que o estudante faz quando ninguém avisou que a rede amplifica.
  estudante: {
    titulo: "O Efeito Amplificador",
    chamada:
      "Você assumiu a comunicação do Grêmio Estudantil: crie com o UnooriaAI a publicação da campanha e publique no Unoovista.",
  },
  ficha: {
    competencia:
      "Economia da atenção, algoritmos de recomendação, direito digital e impactos das redes na saúde " +
      "física e mental (EM13CO24, EM13CO14, EM13CO26, EM13CO08).",
    duracao: "1 aula de 50 min (25 min em tela, 25 min fora da tela)",
    formato:
      "Dois aplicativos da Unooria: o UnooriaAI, o assistente editorial, para criar e auditar o post, e o " +
      "Unoovista, a rede social, para a repercussão de madrugada e os bastidores da entrega. Na aula não há " +
      "IA: o assistente responde por uma lista fechada de intenções; a IA só entra no seu preparo.",
    atos: [
      {
        rotulo: "1 — Desafiar: a pauta do grêmio",
        texto:
          "A tela da escola entrega a pauta da campanha — o título, a descrição e as orientações que você " +
          "homologou no preparo. É por isso que a missão só abre com uma atividade sua em andamento.",
      },
      {
        rotulo: "2 — Navegar: o rascunho do UnooriaAI",
        texto:
          "O assistente monta o post com três problemas escondidos: uma estatística de um instituto " +
          "inventado, um trecho copiado sem crédito e o nome e a turma de um colega exposto. O estudante " +
          "pode perguntar a fonte, pedir o crédito e a anonimização e aprovar a prévia — até 5 mensagens. " +
          "Nada avisa que há um problema.",
      },
      {
        rotulo: "3 — Decidir: a manchete e o Publicar",
        texto:
          "Três manchetes (neutra, construtiva, sensacionalista) e o botão Publicar no Unoovista, que não " +
          "volta. É aqui que a EM13CO14 e a EM13CO26 são registradas, pelo que o estudante pediu antes de publicar.",
      },
      {
        rotulo: "4 — Resultado: a madrugada (o seu primeiro botão)",
        texto:
          "A rede destaca uma frase fora de contexto e entrega o post entre 01h00 e 03h30. O feed enche de " +
          "comentários: insônia e dor de cabeça, ansiedade, contas anônimas agressivas. O aviso de cuidado, a " +
          "Configuração da Publicação, a denúncia e a Central de Apoio estão à mão, sem ninguém pedir, e " +
          "registram a EM13CO24 e a EM13CO08. Você aperta Pausar Telas para Debate e conduz a revelação: " +
          "todos os posts, cuidadosos ou não, foram entregues de madrugada.",
      },
      {
        rotulo: "5 — Explicar: os bastidores (o seu segundo botão)",
        texto:
          "Avançar Turma para Explicar leva cada aparelho aos bastidores da distribuição: o estudante " +
          "seleciona os dois indicadores que revelam o critério de entrega do algoritmo (o horário de pico e " +
          "a métrica de retenção), e a tela formaliza a economia da atenção e os metadados. Depois, conclui.",
      },
    ],
    preparo: [
      "Escolha o recorte: o pacote padrão oficial (Convivência Escolar e Celular, um toque) ou um tema da sua disciplina gerado com IA.",
      "Se gerar com IA, revise o pacote inteiro antes de homologar: nada da IA chega à turma sem a sua curadoria.",
      "Coloque a atividade em andamento: sem ela o estudante entra e vê uma tela de espera.",
      "Não conte que a aula é sobre algoritmo ou economia da atenção: a missão mede o que a turma faz sem esse aviso.",
      "Deixe o projetor pronto: o painel mostra a Distribuição Horária Coletiva da turma, sem nomes, para o debate.",
      "Reproduza o podcast de recapitulação só depois da missão em tela: ele revela a lógica da economia da atenção e o desfecho.",
    ],
  },
};

/**
 * 2º ano · Unidade 1 — O Enigma da Capa da Rádio (`exp02ef1b`, ADR-184; 2.0.0, ADR-186).
 *
 * Do one-pager do PO v1.1 e do protótipo validado pelo time, com as decisões do
 * Lucas de 2026-10-26: o clone é o Unoovista (não o instanooria), a virada é
 * GERAL da turma — um botão, LIBERAR VIRADA —, sessão individual, sem narração
 * e sem texto livre, em cinco atos que terminam na segunda foto. A criança de 7
 * a 8 anos escolhe e enquadra a foto da capa da Rádio Escola e descobre, na
 * virada, que a outra foto é do mesmo lugar no mesmo minuto.
 */
export const MISSAO_ENIGMA_CAPA: Missao = {
  anoSlug: "2-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp02ef1b",
  titulo: "O Enigma da Capa da Rádio",
  resumo:
    "O Bento publicou uma foto da biblioteca na capa da Rádio Escola e os ouvintes entenderam tudo errado. Cada " +
    "estudante procura com a lupa os 2 objetos do fundo das duas fotos, escolhe uma, arrasta para enquadrar — sem " +
    "mudar o tamanho —, cola um selo e publica. A visitante só conta o que viu no recorte; depois da sua conversa, " +
    "a tela mostra a outra foto ao lado, os objetos iguais no fundo e a cena inteira: era o mesmo lugar, no mesmo " +
    "minuto.",
  status: "disponivel",
  // Sem spoiler: a criança não pode saber antes que as duas fotos são do mesmo lugar.
  estudante: {
    titulo: "O Enigma da Capa da Rádio",
    chamada: "O Bento precisa de ajuda com a capa da Rádio Escola: abra a bancada e investigue as fotos!",
  },
  ficha: {
    competencia:
      "EF02CO05 — Reconhecer as características e usos das tecnologias computacionais no cotidiano dentro e fora " +
      "da escola (o foco: a foto publicada na rede é um recorte escolhido por alguém). EF02CO01 — Criar e comparar " +
      "modelos (representações) de objetos, identificando padrões e atributos essenciais (os dois objetos iguais " +
      "no fundo das duas fotos).",
    duracao: "1 aula de 50 min (20 min em tela, 30 min de conversa) — ou 2 sessões, com a pausa no Publicar",
    formato:
      "Individual, um estudante por aparelho, no perfil @radio_escola do Unoovista (a rede social da Unooria, em " +
      "modo anos iniciais): toques e arrastes, sem texto para ler sozinho e sem campo para escrever.",
    atos: [
      {
        rotulo: "1 — Desafiar: o card da missão",
        texto:
          "Você conta a aflição do Bento em voz alta. No mural da rádio, a criança vê o card RASCUNHO PENDENTE: " +
          "INVESTIGAR A NOVA CAPA, com a missão ENCONTRE OS 2 OBJETOS IGUAIS NAS DUAS FOTOS DA BIBLIOTECA, e toca em ABRIR " +
          "BANCADA.",
      },
      {
        rotulo: "2 — Navegar: a lupa",
        texto:
          "Duas fotos do mesmo espaço, com o mesmo horário no rótulo. A criança arrasta a lupa sobre elas: parada " +
          "sobre um dos 2 objetos da parede do fundo, a lupa brilha e um anel se enche em 3 segundos, e o objeto " +
          "conta como encontrado. Com os dois, INVESTIGAÇÃO COMPLETA!. Quem tenta avançar antes vê OLHE O FUNDO.",
      },
      {
        rotulo: "3 — Decidir: a capa",
        texto:
          "Escolhe 1 foto, arrasta para enquadrar na moldura de tamanho fixo, cola um dos dois selos e toca em " +
          "PUBLICAR CAPA. Não volta: a tela confirma CAPA PUBLICADA! e leva ao feed da rádio.",
      },
      {
        rotulo: "4 — Resultado: a visitante e a virada (o seu botão)",
        texto:
          "A visitante responde só o que viu no recorte (“Na foto, vi crianças lendo!”) e a tela espera em AGUARDE " +
          "O PROFESSOR. Depois da conversa, você toca em LIBERAR VIRADA, uma vez, para a turma toda: a tela divide " +
          "em SUA FOTO e OUTRA FOTO, a criança toca nos 2 objetos iguais do fundo, desliza a comparação — que " +
          "começa no meio, com a cena inteira de um lado e só a foto dela do outro — até ver o lugar inteiro, e " +
          "arrasta o alfinete até o que ficou fora da foto dela.",
      },
      {
        rotulo: "5 — Explicar: pares e segunda foto",
        texto:
          "Junta duas fotos da mesma atividade, diz o que é parecido (a atividade ou a cor da roupa) e enquadra uma " +
          "segunda foto escolhendo o que precisa aparecer. Colocar no álbum encerra a missão: MISSÃO CUMPRIDA!. " +
          "Você nomeia com os cartões ENQUADRAMENTO, AUTORIA e O QUE FICOU DE FORA.",
      },
    ],
    preparo: [
      "Crie a atividade: USAR BANCO PADRÃO (BIBLIOTECA) em um toque, os pacotes prontos da Horta ou do Museu, ou um espaço da sua disciplina gerado com IA — aí você pode editar o pedido da imagem e desenha a área dos dois objetos iguais do fundo antes de aprovar.",
      "Ponha a atividade em andamento e libere a missão na sala de aula: sem as duas, a criança vê a missão fechada.",
      "Ensaie a frase que você vai repetir em todo arraste: “Você pode mover a foto, mas não mudar o tamanho.”",
      "Não conte que as duas fotos são do mesmo lugar: a virada é a criança descobrir.",
      "Deixe à mão os três cartões — ENQUADRAMENTO, AUTORIA e O QUE FICOU DE FORA — para a conversa depois da virada.",
      "Toque o podcast de recapitulação só depois da missão: ele conta a virada.",
    ],
  },
};

/**
 * 1ª série do EM · Unidade 1 — O Assistente Invisível: Dados que viram decisões
 * (`exp01em1b`, ADR-185).
 *
 * Do one-pager do PO v1.5 e do Figma de 63 telas (decisão do Lucas,
 * 2026-10-26: o Figma é a referência de tela e de copy). O estudante é auditor
 * da comissão de tecnologia da escola: testa o UnooriaAI com três colegas que
 * pediram a mesma trilha, aposta no resultado, vê dois deles barrados por
 * horário e conexão, reconstrói as regras com o banco de critérios e publica a
 * página de transparência. Individual, com equipe opcional (E13), cinco
 * liberações e duas pausas do professor.
 */
export const MISSAO_ASSISTENTE_INVISIVEL: Missao = {
  anoSlug: "1-serie",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp01em1b",
  titulo: "O Assistente Invisível: Dados que viram decisões",
  resumo:
    "Auditoria algorítmica escolar: o estudante, como auditor da comissão de tecnologia da escola, testa o " +
    "assistente UnooriaAI com três colegas que pediram a mesma Trilha Avançada no cadastro, aposta no que vai " +
    "acontecer e vê dois deles barrados — um pelo horário de acesso, outro pela conexão instável. Nas fichas de " +
    "auditoria ele descobre a inferência que ninguém declarou, reconstrói as regras com o banco de critérios da " +
    "rede e publica a página de transparência com o direito à revisão humana.",
  status: "disponivel",
  // Sem spoiler: a aposta só mede a crença de entrada se o estudante não souber que o sistema usa metadados.
  estudante: {
    titulo: "O Assistente Invisível",
    chamada: "A escola pôs um assistente de estudos em teste. A comissão de auditoria precisa de você para conferir se ele cumpre o que cada estudante pediu.",
  },
  ficha: {
    competencia:
      "EM13CO20 — Criar conteúdos, disponibilizando-os em ambientes virtuais para publicação e compartilhamento, " +
      "avaliando a confiabilidade e as consequências da disseminação dessas informações (o foco: a página de " +
      "transparência e o comunicado da comissão). Com EM13CO01 (reutilizar critérios do repositório), EM13CO18 " +
      "(o ciclo da auditoria) e, opcional, EM13CO03 (as etapas de processamento do algoritmo).",
    duracao: "1 aula de 50 min (25 min em tela, 25 min de mediação e debate) — ou 2 aulas, com a pausa depois da Etapa 4",
    formato:
      "Individual, um estudante por aparelho (ou uma equipe por computador), alternando o módulo escolar de " +
      "homologação da Unooria e as telas do UnooriaAI. Sem texto livre: a aposta, os cartões, os critérios e os " +
      "blocos do comunicado são escolhas fechadas.",
    atos: [
      {
        rotulo: "1 — Desafiar: a comissão de auditoria",
        texto:
          "Você apresenta o papel da turma como comissão de tecnologia da escola e toca em Liberar Início dos " +
          "Testes. A Zara recebe cada estudante e abre o módulo de teste.",
      },
      {
        rotulo: "2 — Navegar: as três funções",
        texto: "O estudante expande as três funções do assistente (Exercícios, Dúvidas e Sugestões) e vê a prévia do UnooriaAI.",
      },
      {
        rotulo: "3 — Decidir: a aposta",
        texto:
          "Três fichas com a mesma escolha no cadastro: Trilha Avançada. O estudante aposta (A, B ou C) e a previsão " +
          "fica arquivada. Liberar Início da Simulação só acende quando toda sessão aberta tiver apostado.",
      },
      {
        rotulo: "4 — Resultado: as fichas de auditoria (a sua primeira pausa)",
        texto:
          "No chat, o Lucas recebe o avançado, a Beatriz é rebaixada e o Thiago é bloqueado. As fichas mostram o " +
          "horário e a conexão por trás de cada decisão. Você trava as telas e conduz as perguntas 1 e 2; depois, " +
          "Liberar Bancada de Reconstrução.",
      },
      {
        rotulo: "5 — Explicar: a bancada (a sua segunda pausa)",
        texto:
          "Seis cartões entre dados fornecidos e observados, as etapas do algoritmo (opcional) e o banco de critérios " +
          "com a configuração B-B-A no ar. O estudante retesta; você projeta 1A × 1C e libera a publicação.",
      },
      {
        rotulo: "6 — Refletir: a página de transparência",
        texto:
          "O estudante liga a página, monta o comunicado em quatro blocos e publica. Você fecha com as perguntas " +
          "3 e 4 sobre desigualdade e LGPD.",
      },
    ],
    preparo: [
      "Crie a atividade: Usar Banco Padrão da Rede (Língua Portuguesa) ou o recorte da sua disciplina gerado com IA, que você revisa item a item antes de aprovar.",
      "Ponha a atividade em andamento e libere a missão na sala de aula: sem as duas, o estudante vê a missão fechada.",
      "Deixe a página da atividade aberta na aba Aula ao vivo: são cinco botões seus, sempre para a frente.",
      "Não diga que o assistente usa horário e conexão: a aposta só mede a crença da turma se ninguém souber antes.",
      "Toque o podcast de recapitulação só depois da missão: ele conta a virada.",
    ],
  },
};

const MISSOES_PUBLICADAS: Record<string, Missao[]> = {
  "1-ano": [MISSAO_FOTO_CONTA],
  "2-ano": [MISSAO_ENIGMA_CAPA],
  "4-ano": [MISSAO_JORNAL_DA_ESCOLA],
  "5-ano": [MISSAO_QUEM_MANDOU_ISSO],
  "6-ano": [MISSAO_JURI_ESTADUAL, MISSAO_RASTRO_BOATO],
  "7-ano": [MISSAO_A_SELECAO],
  "8-ano": [MISSAO_ATUAL, MISSAO_MANIFESTO_IA],
  "1-serie": [MISSAO_ASSISTENTE_INVISIVEL],
  "2-serie": [MISSAO_EFEITO_AMPLIFICADOR],
};

function montarAno(slug: string, rotulo: string, etapa: Etapa): Ano {
  const publicadas = MISSOES_PUBLICADAS[slug] ?? [];
  const ocupadas = publicadas.map((missao) => missao.unidade);
  return {
    slug,
    rotulo,
    etapa,
    missoes: [...publicadas, ...unidadesEmBreve(slug, ocupadas)].sort(
      (a, b) => a.unidade - b.unidade,
    ),
  };
}

/**
 * A grade inteira da Educação Básica: 1º ao 9º ano do Fundamental e as 3
 * séries do Médio. Anos sem missão publicada continuam na lista — a rede
 * contrata a plataforma inteira, e o professor de qualquer ano precisa
 * encontrar o seu lugar na trilha (e ver que ele existe) antes de a missão
 * dele sair.
 */
export const ANOS: Ano[] = [
  ...Array.from({ length: 9 }, (_, indice) => {
    const ano = indice + 1;
    return montarAno(
      `${ano}-ano`,
      `${ano}º ano`,
      ano <= 5 ? "anos-iniciais" : "anos-finais",
    );
  }),
  ...Array.from({ length: 3 }, (_, indice) => {
    const serie = indice + 1;
    return montarAno(`${serie}-serie`, `${serie}ª série`, "ensino-medio");
  }),
];

/* ==========================================================================
   MISSÕES TRANSVERSAIS — fora da grade de ano/unidade
   ========================================================================== */

/**
 * Uma missão que NÃO pertence a nenhum ano.
 *
 * Tipo próprio, e não um `Missao` com `anoSlug: "transversal"`: `anoSlug` e
 * `unidade` são carga estrutural em `ANOS`, `buscarAno`, `rotuloDaMissao`, no
 * breadcrumb e na rota `/{ano}/{unidade}`. Um ano falso passaria por todos esses
 * lugares parecendo um ano de verdade, e cada um deles precisaria de uma exceção
 * que alguém esqueceria.
 *
 * No manifesto a contrapartida é `series: []`, que significa **todas as séries**
 * — não nenhuma. Quando o filtro por série voltar a valer, vazio tem de
 * continuar querendo dizer "todas", senão a experiência desaparece da tela
 * sozinha.
 */
export type MissaoTransversal = {
  slug: string;
  expId: string;
  titulo: string;
  resumo: string;
  /** Por que ela não tem ano — a frase aparece no card. */
  porQueTransversal: string;
  status: StatusMissao;
  ficha?: FichaDaMissao;
  estudante?: { titulo: string; chamada: string };
};

/**
 * Vila do Lume — o jogo 3D que a ficha do Instanooria sempre chamou de "Ato 1":
 * *"fora da plataforma, um jogo mede o perfil de valores do estudante"*. Ele deixou
 * de estar fora.
 *
 * É transversal porque não é a missão de um ano: é o instrumento que alimenta
 * missões de vários anos (o perfil dele decide de que lado o feed do Instanooria
 * nasce) e porque o que ele lê — como uma criança escolhe quando escolher custa
 * algo — não é conteúdo de série nenhuma.
 */
export const MISSAO_VILA: MissaoTransversal = {
  slug: "vila-do-lume",
  expId: "app-70-vila-do-lume",
  titulo: "Vila do Lume — A Noite Longa",
  resumo:
    "A turma reacende as oito fogueiras de uma vila no escuro. Pelo caminho chegam mensagens: duas são verdadeiras, e cada estudante recebe um golpe de um nível diferente — é isso que faz o debate funcionar.",
  porQueTransversal:
    "Não pertence a nenhum ano: o que ela lê é como a criança escolhe quando escolher custa algo, e alimenta as missões dos outros anos.",
  status: "disponivel",
  // Sem spoiler: a criança não pode saber que está sendo lida, e a copy dela é
  // só a tarefa. Ver a regra de ouro no README da experiência.
  estudante: {
    titulo: "Vila do Lume",
    chamada: "A vila apagou. Acenda as oito fogueiras antes que a noite acabe.",
  },
  ficha: {
    competencia:
      "Letramento digital — reconhecer golpe quando ele não tem nenhum dos sinais que se ensina a procurar; e, no fundo, como cada criança decide quando decidir custa algo.",
    duracao: "1 aula de jogo (15–25 min por estudante) + 10 a 15 min de debate",
    formato: "Jogo 3D em primeira pessoa, no navegador. Roda no aparelho da plataforma.",
    atos: [
      {
        rotulo: "1 — A vila no escuro",
        texto:
          "O estudante minera fagulha, acende as 8 fogueiras e recolhe as Chamas Sagradas. Pelo caminho aparecem coisas que ele pode fazer ou não — ajudar um aldeão, acender um lampião, gravar o nome na Pedra — e nada disso pontua. É aí que está o sinal.",
      },
      {
        rotulo: "2 — As mensagens",
        texto:
          "Durante a partida chegam 5 mensagens, sem pausar o jogo. Duas são VERDADEIRAS e ajudam de verdade. O golpe principal chega em três níveis, e cada estudante recebe um só: grosseiro, autoridade com urgência, ou um colega pedindo um passo pequeno no minuto em que ele está travado.",
      },
      {
        rotulo: "3 — O debate",
        texto:
          'Uma pergunta na lousa: "Em quem dava pra confiar?". Você não corrige nada — anota os sinais que a turma cita. A bolha A vai dizer que era óbvio; a C não vai conseguir explicar por que caiu.',
      },
      {
        rotulo: "4 — A revelação",
        texto:
          'Você projeta as mensagens das três bolhas lado a lado: "vocês não receberam as mesmas mensagens, e não foi sorteado quem é mais esperto". Aí lê o golpe do nível C para quem disse que era óbvio.',
      },
    ],
    preparo: [
      "Não conte nada antes. A instrução é só \u201cvocês vão manter a vila acesa\u201d — nem \u201cprestem atenção nas mensagens\u201d.",
      "Confira nos resultados se as três bolhas estão na sua turma: sem as três, a revelação não tem o que comparar.",
      "Na revelação, diga com todas as letras que o \u201cEstudante 14\u201d não foi um colega de verdade.",
      "Nunca pergunte quem clicou — nem por levantar a mão. A missão foi desenhada para funcionar sem essa pergunta.",
    ],
  },
};

export const MISSOES_TRANSVERSAIS: MissaoTransversal[] = [MISSAO_VILA];

export function buscarMissaoTransversal(slug: string): MissaoTransversal | null {
  return MISSOES_TRANSVERSAIS.find((m) => m.slug === slug) ?? null;
}

export function rotaDaTransversal(missao: MissaoTransversal): string {
  return `/professor/entre-redes/${missao.slug}`;
}

/** A mesma lista agrupada por etapa — como a trilha do professor é lida. */
export const ETAPAS: Array<{ id: Etapa; rotulo: string; anos: Ano[] }> = (
  ["anos-iniciais", "anos-finais", "ensino-medio"] as const
).map((id) => ({
  id,
  rotulo: ROTULO_DA_ETAPA[id],
  anos: ANOS.filter((ano) => ano.etapa === id),
}));

export function buscarAno(anoSlug: string): Ano | null {
  return ANOS.find((ano) => ano.slug === anoSlug) ?? null;
}

export function buscarMissao(
  anoSlug: string,
  unidadeSlug: string,
): { ano: Ano; missao: Missao } | null {
  const ano = buscarAno(anoSlug);
  if (!ano) return null;
  const missao = ano.missoes.find((m) => m.unidadeSlug === unidadeSlug);
  return missao ? { ano, missao } : null;
}

/** Quantas missões estão de fato jogáveis hoje (rótulo do card do produto).
 *  Inclui as transversais: para o professor, "quantas posso rodar" não distingue
 *  se a missão mora num ano ou fora dele. */
export const MISSOES_DISPONIVEIS: Array<Missao | MissaoTransversal> = [
  ...ANOS.flatMap((ano) => ano.missoes),
  ...MISSOES_TRANSVERSAIS,
].filter((missao) => missao.status === "disponivel");

export function rotaDaMissao(missao: Missao): string {
  return `/professor/entre-redes/${missao.anoSlug}/${missao.unidadeSlug}`;
}

/** Rótulo curto usado em breadcrumb e cabeçalhos: "8º ano · Unidade 1". */
export function rotuloDaMissao(ano: Ano, missao: Missao): string {
  return `${ano.rotulo} · Unidade ${missao.unidade}`;
}
