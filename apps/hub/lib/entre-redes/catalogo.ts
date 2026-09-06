/**
 * Catálogo do **Entre Redes** — o produto de letramento digital da Unooria.
 *
 * O Entre Redes é uma trilha, não uma atividade solta: cada ano da Educação
 * Básica — 1º ao 9º do Fundamental e as 3 séries do Médio — tem **4 unidades**,
 * e cada unidade é uma **missão**. Hoje três missões existem de fato (8º ano
 * · Unidade 1, a bolha de filtro do Instanooria; 4º ano · Unidade 1, o
 * UnooTube; 2ª série do EM · Unidade 1, a Missão Tempestade do unooGPT). As
 * demais aparecem na trilha como "Em breve" porque a grade é a informação: o
 * professor precisa enxergar onde a missão dele mora.
 *
 * Este arquivo é a fonte da verdade da trilha. Ele descreve o CATÁLOGO
 * (o que a Unooria oferece); as **atividades** que o professor cria a partir de
 * uma missão são instâncias no banco (`exp_01_activities`), com rota própria em
 * `/professor/atividades/**`.
 *
 * NOTA DE MODELAGEM: enquanto existir uma única missão COM ATIVIDADES, toda
 * atividade pertence a `MISSAO_ATUAL` por construção — por isso `exp_01_activities`
 * ainda não tem coluna `missao`. Missões sem `exp_01_activities` (o UnooTube do 4º
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
 * A missão que existe hoje: o Instanooria, a bolha de filtro do 8º ano.
 * É a única com ficha, guia e atividades configuráveis.
 */
export const MISSAO_ATUAL: Missao = {
  anoSlug: "8-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp-01-instanooria",
  titulo: "O Conteúdo que não chegou",
  resumo:
    "O estudante investiga uma pergunta do seu conteúdo dentro de uma rede social — e só na revelação final descobre que o feed dele foi montado para puxá-lo para um dos lados.",
  status: "disponivel",
  // Sem spoiler: a missão só funciona se a revelação chegar de surpresa.
  estudante: {
    titulo: "Instanooria",
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
 * 4º ano · Unidade 1 — o UnooTube: fontes confiáveis vs. sensacionalismo num
 * clone do YouTube Shorts. Sem atividades configuráveis: o conteúdo é fixo (21
 * vídeos de História), o professor só entra com a turma e lê os resultados.
 */
export const MISSAO_UNOOTUBE: Missao = {
  anoSlug: "4-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp-02-unootube",
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
 * 2ª série do EM · Unidade 1 — a Missão Tempestade (`exp-03-unoogpt`).
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
  expId: "exp-03-unoogpt",
  titulo: "unooGPT — Decidir com o que os dados mostram",
  resumo:
    "Uma tempestade chega em uma hora e há 2 equipes para 4 bairros. O estudante conversa com um assistente de IA, pede os dados que quiser e decide — com 3 perguntas e o relógio correndo. Cada fonte mostra um pedaço distorcido da cidade, e é essa distorção que a turma discute depois.",
  status: "disponivel",
  estudante: {
    titulo: "unooGPT",
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
        rotulo: "1 — Briefing, e a espera",
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
          "Ele manda cada equipe e responde 'por que aqui?', escolhendo entre as fontes que ABRIU — ou 'foi intuição, não olhei dado', que está sempre disponível. O software não julga a resposta: quem lê é você. A lista nunca oferece a fonte que ele não consultou.",
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
      "Guarde metade da aula para o debate: o software NÃO conta a ninguém qual fonte engana em quê. Esse é o seu material, e está no guia.",
      "Turma sem partida nenhuma? Confira se a largada foi dada — é o motivo nº 1 de 'não abre'.",
    ],
  },
};

/**
 * As missões publicadas, indexadas pelo ano em que moram. Tudo o que não
 * está aqui entra na grade como "Em breve".
 */
/**
 * 7º ano · Unidade 1 — O Eco no Grupo (`exp-07-o-eco-no-grupo`).
 *
 * Clone de WhatsApp móvel, em DUAS aulas com breakpoint entre elas — a
 * primeira missão da trilha em que a professora conduz a turma por etapas
 * (abrir a Aula 2, congelar o debate, liberar a reflexão). É isso que muda o
 * preparo dela em relação às outras: aqui ela tem botões para apertar durante
 * a aula, e a tela dos 30 estudantes anda junto.
 *
 * A copy abaixo sai do sheet congelado da missão (passada 2), com uma exceção
 * declarada: o podcast de recapitulação sai em ~2 min, não nos 3m30 que o
 * brief previu — o roteiro aprovado não dá essa duração, e o cronograma ganha
 * folga em vez de mentir sobre ela.
 */
export const MISSAO_ECO_NO_GRUPO: Missao = {
  anoSlug: "7-ano",
  unidadeSlug: "unidade-1",
  unidade: 1,
  expId: "exp-07-o-eco-no-grupo",
  titulo: "O Eco no Grupo — Quem decide o que roda?",
  resumo:
    "Um boato sobre o festival do bairro corre num grupo de WhatsApp, com print recortado e áudio alarmado. O estudante audita as mensagens, descobre o parágrafo que o print cortou e responde citando a matéria completa — e o grupo se acalma na frente dele.",
  status: "disponivel",
  estudante: {
    titulo: "O Eco no Grupo",
    chamada:
      "Amara te chama no privado: o grupo do bairro está em pânico por causa de um print. Descubra de onde saiu essa história.",
  },
  ficha: {
    competencia:
      "Letramento midiático — reconhecer que print e manchete isolados são recorte intencional, e intervir com a fonte completa em vez de opinião.",
    duracao: "2 aulas de 30–35 min, com pausa entre elas",
    formato:
      "Clone de WhatsApp móvel: um chat privado, um grupo de bairro com 8 mensagens, e a reportagem íntegra em tela cheia",
    atos: [
      {
        rotulo: "1 — Investigar o grupo (Aula 1)",
        texto:
          "O estudante entra no grupo 'Comunidade Alerta', ouve o áudio da moradora, lê os textos indignados e toca no print encaminhado. A reportagem completa abre e mostra o parágrafo que foi cortado: o evento tinha alvará e a polícia só organizava o trânsito. Amara fica em silêncio nesta etapa, de propósito — é o estudante que precisa achar o corte.",
      },
      {
        rotulo: "2 — Pausa entre as aulas",
        texto:
          "No fim da Aula 1 a tela trava num card de pausa com o progresso salvo. Ninguém avança até você abrir a Aula 2 no painel de resultados — é isso que faz a turma chegar junta à decisão.",
      },
      {
        rotulo: "3 — Responder no grupo (Aula 2)",
        texto:
          "Depois do episódio de recapitulação, abre o menu com 3 respostas: repassar o áudio alarmado, responder citando a matéria com o link, ou brigar e sair do grupo. Quem responde citando vê o administrador fixar a mensagem no topo do chat. Quem responde no impulso vê o bairro entrar em pânico — e pode apagar para todos e tentar de novo.",
      },
      {
        rotulo: "4 — Sistematizar e registrar",
        texto:
          "Três cards explicam o enquadramento parcial, o contexto omitido e o rótulo de encaminhamento. Você congela as telas para o debate e depois libera o 'Meu percurso', em que cada estudante marca 2 critérios de checagem e uma justificativa.",
      },
    ],
    preparo: [
      "Conferir fones de ouvido: há dois áudios no chat e um episódio de recapitulação. Sem fone, a transcrição na tela cobre tudo — ela está sempre visível.",
      "Preparar a mídia da missão no painel de resultados, uma vez por escola. Leva cerca de dois minutos e vale para todas as turmas.",
      "Você conduz a aula por três botões no painel: abrir a Aula 2, congelar o debate e liberar a reflexão. Sem o primeiro, ninguém passa da investigação.",
      "Reservar as duas aulas seguidas na agenda: o progresso fica salvo, mas a pausa foi desenhada para uma aula e a seguinte.",
    ],
  },
};

const MISSOES_PUBLICADAS: Record<string, Missao[]> = {
  "4-ano": [MISSAO_UNOOTUBE],
  "7-ano": [MISSAO_ECO_NO_GRUPO],
  "8-ano": [MISSAO_ATUAL],
  "2-serie": [MISSAO_UNOOGPT],
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
  expId: "exp-70-vila-do-lume",
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
