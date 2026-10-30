/**
 * O ESQUELETO fixo da exp03ef1b — o que não é gerado pela IA nem editado pela
 * professora (spec §0.5): a ESTRUTURA das três reportagens (suportes, fichas,
 * lugar), os cartões K1–K6 com o gabarito, as fichas-teste da rotina (E5), o
 * caso Festival de Ciências (E6), o roteiro de mediação e os
 * PROMPTS das imagens. O texto das três reportagens do banco padrão mora em
 * `banco-padrao.ts`.
 *
 * Fonte: `dev/01e-banco-conteudo.md` (txt-exp03ef1b-01) e o sheet de copy
 * revisado (`design/06-copy-strings-revisada.md`), com os ajustes do PO da
 * spec §7. O Canal B (a enquete da gincana) SAIU (spec §0.1): nada dele aqui.
 *
 * O que é GABARITO aqui (`certo` dos cartões) nunca desce ao estudante: quem
 * corrige é o servidor (regra 3). O material do professor o recebe.
 */
import {
  CHAVES_DAS_CENAS_FIXAS,
  LUGAR_DO_EVENTO,
  QUANDO_DO_EVENTO,
  QUEM_DO_EVENTO,
  SUPORTES,
  type Carimbo,
  type Cartao,
  type ChaveDaCenaFixa,
  type ChaveDaImagem,
  type Dia,
  type Lugar,
  type Pessoa,
  type Suporte,
} from "./vocabulario";

// ------------------------------------------------------- a estrutura

/** A ficha de uma reportagem: os três campos, e `null` é o campo VAZIO. */
export type Ficha = { quem: Pessoa | null; onde: Lugar | null; quando: Dia | null };

/**
 * A FICHA de cada suporte — estrutura do servidor, nunca da IA: as três com
 * Quem = estudantes e Quando = sexta; Onde = pátio no mural e no portal, e
 * VAZIO no telão (a notícia que o filtro deixa de fora).
 */
export const FICHA_DO_SUPORTE: Readonly<Record<Suporte, Ficha>> = {
  mural: { quem: QUEM_DO_EVENTO, onde: LUGAR_DO_EVENTO, quando: QUANDO_DO_EVENTO },
  portal: { quem: QUEM_DO_EVENTO, onde: LUGAR_DO_EVENTO, quando: QUANDO_DO_EVENTO },
  telao: { quem: QUEM_DO_EVENTO, onde: null, quando: QUANDO_DO_EVENTO },
};

export type ImagemDescrita = { descricao: string; alt: string };

/** Uma reportagem do pacote como o servidor a guarda (o JSONB `conteudo`). */
export type Reportagem = {
  suporte: Suporte;
  manchete: string;
  legenda: string;
  /** O lugar que a FOTO mostra (o ícone "Pátio escolar" da E1) — sempre o pátio. */
  lugar: Lugar;
  ficha: Ficha;
  imagem: ImagemDescrita;
};

/** O pacote: o tema (o evento), o cartaz comum às três fotos e as três reportagens. */
export type ConteudoDoPacote = {
  tema: string;
  cartaz: { texto: string; imagem: ImagemDescrita };
  reportagens: Reportagem[];
};

/** O que a IA (ou a edição da professora) escreve de UMA reportagem: só texto. */
export type TextosDaReportagem = { suporte: Suporte; manchete: string; legenda: string; imagem: ImagemDescrita };

/** O que a IA escreve do pacote inteiro: só texto e descrição de cena. */
export type TextosDoPacote = {
  tema: string;
  cartaz: { texto: string; imagem: ImagemDescrita };
  reportagens: readonly TextosDaReportagem[];
};

/**
 * Põe a ESTRUTURA do servidor sobre o texto: ordena pelos suportes fixos e
 * escreve lugar e ficha de cada um. O que a IA mandou de estrutura (se
 * mandou) é ignorado — é aqui que a invariante nasce; `problemasDoPacote` só a
 * confere.
 */
export function aplicarEstrutura(textos: TextosDoPacote): ConteudoDoPacote {
  const porSuporte = new Map(textos.reportagens.map((r) => [r.suporte, r]));
  return {
    tema: textos.tema,
    cartaz: textos.cartaz,
    reportagens: SUPORTES.flatMap((suporte) => {
      const r = porSuporte.get(suporte);
      if (!r) return [];
      return [
        {
          suporte,
          manchete: r.manchete,
          legenda: r.legenda,
          lugar: LUGAR_DO_EVENTO,
          ficha: { ...FICHA_DO_SUPORTE[suporte] },
          imagem: r.imagem,
        },
      ];
    }),
  };
}

// ------------------------------------------------------- os cartões

export type CartaoDaMissao = {
  id: Cartao;
  /** A composição visual (o que a figura mostra). */
  figura: string;
  /** A pergunta lida no cartão. */
  pergunta: string;
  /** GABARITO — só no servidor e no material do professor. */
  certo: Carimbo;
};

/**
 * Os seis cartões-afirmação (01e §2 e §4; perguntas da spec §1). K3 traz o
 * selo gráfico de negação; K5 é o "não dá para saber" (fontes divergem, ficha
 * vazia: ausência de dado não prova falsidade).
 */
export const CARTOES_DA_MISSAO: readonly CartaoDaMissao[] = [
  { id: "k1", figura: "Foto do telão + 📍 Pátio", pergunta: "A foto mostra o pátio?", certo: "v" },
  { id: "k2", figura: "Campo Onde + 📍 Pátio", pergunta: "A ficha diz pátio?", certo: "x" },
  { id: "k3", figura: "Campo Onde + 📍 Pátio + selo NÃO", pergunta: "A ficha NÃO diz pátio?", certo: "v" },
  { id: "k4", figura: "Cartaz da matéria A + cartaz da matéria B", pergunta: "As duas fotos tratam do Festival?", certo: "v" },
  { id: "k5", figura: "Festival + calendário de sexta", pergunta: "O Festival foi na sexta-feira?", certo: "duvida" },
  { id: "k6", figura: "Campo Quando + calendário de sábado", pergunta: "A ficha diz que foi no sábado?", certo: "x" },
];

// ------------------------------------------------ a rotina (E5)

export type FichaTeste = { manchete: string; ficha: Ficha };

/**
 * As três fichas da pilha de teste (01e §3), na ordem em que a rotina as
 * pega. A do Clube de Xadrez tem Onde vazio: é a que recebe a bandeira de
 * revisão na simulação.
 */
export const FICHAS_TESTE: readonly FichaTeste[] = [
  { manchete: "Oficina de Pipas", ficha: { quem: "estudantes", onde: "quadra", quando: "terca" } },
  { manchete: "Clube de Xadrez", ficha: { quem: "estudantes", onde: null, quando: "quarta" } },
  { manchete: "Horta da Escola", ficha: { quem: "estudantes", onde: "patio", quando: "quinta" } },
];

// --------------------------------------------- o caso novo (E6)

export const TEMA_DO_CASO = "Festival de Ciências";

export type MateriaDoCaso = {
  id: "a" | "b";
  chave: ChaveDaCenaFixa;
  titulo: string;
  /** O dia que o CARTAZ da foto mostra — a fonte diverge, a ficha não diz. */
  diaNoCartaz: Dia;
  ficha: Ficha;
  imagem: ImagemDescrita;
};

/** As duas matérias do caso (01e §4): o mesmo Festival, cartazes de sexta e de sábado, Quando vazio nas duas. */
export const MATERIAS_DO_CASO: readonly MateriaDoCaso[] = [
  {
    id: "a",
    chave: "caso-a",
    titulo: "Festival de Ciências",
    diaNoCartaz: "sexta",
    ficha: { quem: "estudantes", onde: "patio", quando: null },
    imagem: {
      descricao: "Alunos apresentando um vulcão de argila no pátio, com um cartaz do festival destacando o calendário de SEXTA.",
      alt: "Estudantes mostram um vulcão de argila; o cartaz do festival marca sexta.",
    },
  },
  {
    id: "b",
    chave: "caso-b",
    titulo: "Festival de Ciências",
    diaNoCartaz: "sabado",
    ficha: { quem: "estudantes", onde: "patio", quando: null },
    imagem: {
      descricao: "Outros alunos no mesmo pátio, com o mesmo cartaz do festival destacando o calendário de SÁBADO.",
      alt: "Outros estudantes no mesmo pátio; o cartaz do festival marca sábado.",
    },
  },
];

export const FERRAMENTAS_DO_CASO = ["filtrar", "fotos", "fontes"] as const;
export type FerramentaDoCaso = (typeof FERRAMENTAS_DO_CASO)[number];

/**
 * As três ferramentas investigativas (E6-ALU-01) e o retorno NEUTRO de cada
 * uma — não é gabarito, é o que a ferramenta mostra.
 */
export const FERRAMENTAS: readonly { id: FerramentaDoCaso; rotulo: string; retorno: string; aviso: string | null }[] =
  [
    { id: "filtrar", rotulo: "Filtrar por campo", retorno: "0 notícias encontradas", aviso: "Campo Quando está vazio." },
    { id: "fotos", rotulo: "Olhar as fotos", retorno: "A foto A mostra sexta e a foto B mostra sábado.", aviso: null },
    { id: "fontes", rotulo: "Comparar fontes", retorno: "Nenhuma outra fonte encontrada na redação.", aviso: null },
  ];

// --------------------------------------------- a mediação (professora)

/** O roteiro de debate (sheet, "Strings do professor" §3), na íntegra, com o cuidado de cada pergunta. */
export const ROTEIRO_DE_MEDIACAO: readonly { pergunta: string; cuidado: string }[] = [
  {
    pergunta:
      "Nesta busca do jornal, o computador olhou a foto como nós olhamos ou consultou os campos da ficha?",
    cuidado:
      "Destacar que este filtro consulta campos cadastrados e que a máquina não adivinhou a imagem; não generalizar dizendo que o computador nunca reconhece imagens, pois outros sistemas possuem visão computacional.",
  },
  {
    pergunta:
      "Se a ficha do computador não tem o dia de um evento anotado, podemos dizer que aquele evento nunca aconteceu ou que a reportagem é mentirosa? Qual é a diferença entre uma mentira e uma informação que está faltando?",
    cuidado:
      "Consolidar que ausência de dado em um cadastro é uma lacuna que exige investigação, e não falsidade.",
  },
  {
    pergunta:
      "Por que é importante criar passos automáticos (algoritmos) com uma condição de parada clara quando temos muitas informações para conferir?",
    cuidado:
      "Evidenciar que rotinas automáticas poupam esforço humano em grandes acervos, mas precisam saber a hora exata de parar.",
  },
];

/** Os gatilhos de condução, um por momento (sheet §2), com "escolha" no lugar de "aposta" (spec §7.1). */
export const GATILHOS_DE_CONDUCAO: readonly string[] = [
  "Verifique se todas as telas mostram a escolha travada no cadeado 'Travar Escolha' antes de autorizar o uso do filtro.",
  "A notícia do telão desapareceu: congele a sala no botão 'Pausar Turma' e faça a provocação coletiva antes de liberar a Etapa 4.",
  "Clique em 'Liberar Inspeção' para abrir as fichas técnicas nas telas dos estudantes.",
];

// --------------------------------------------- os prompts das imagens

/**
 * O ESTILO comum de toda imagem da missão: ilustração infantil, escola pública
 * brasileira, sem marca, sem texto legível além do cartaz.
 */
export const ESTILO_DAS_IMAGENS =
  "Ilustração digital colorida, estilo de livro infantil, traço limpo e luz de dia. Escola pública brasileira, crianças de cerca de 8 anos com diversidade de tons de pele e cabelos, roupas simples sem logotipos. Nenhuma marca, nenhum texto legível além do que for pedido no cartaz. Se aparecer qualquer outra palavra (menu de site, placa, faixa), ela está em português do Brasil, nunca em inglês. Enquadramento horizontal 4:3.";

/**
 * O que cada SUPORTE exige da cena. O do TELÃO é o que segura a missão: a
 * criança precisa ver o pátio na foto SEM AMBIGUIDADE (K1 é "A foto mostra o
 * pátio?" e o gabarito é ✔), porque a omissão só ensina se a foto disser
 * pátio e a ficha não. A tela de revisão da professora destaca essa imagem
 * ("confira se o pátio aparece").
 */
export const EXIGENCIA_DO_SUPORTE: Readonly<Record<Suporte, string>> = {
  mural:
    "A cena aparece como fotografia impressa presa num mural de cortiça, e mostra o pátio aberto da escola, com árvores, e o cartaz da feira visível.",
  portal:
    "A cena aparece como a foto principal de uma página simples de site escolar, e mostra o pátio aberto da escola e o mesmo cartaz da feira.",
  telao:
    "A cena aparece na tela de um telão pendurado no corredor da escola. Dentro do telão, o PÁTIO precisa estar INEQUIVOCAMENTE visível: céu aberto, árvores, bancos de pátio, piso de pátio escolar e o mesmo cartaz da feira preso numa pilastra ao fundo. Nada de sala de aula, biblioteca, quadra coberta ou ambiente fechado dentro do telão.",
};

/** O prompt de uma imagem do PACOTE (reportagem ou cartaz), a partir do texto revisado. */
export function promptDaImagem(chave: ChaveDaImagem, conteudo: ConteudoDoPacote): string {
  if (chave === "cartaz") {
    return [
      ESTILO_DAS_IMAGENS,
      `Um cartaz colorido de papel, pendurado numa parede do pátio, anunciando o evento "${conteudo.cartaz.texto}", com um calendário desenhado marcando sexta-feira.`,
      conteudo.cartaz.imagem.descricao,
    ].join(" ");
  }
  const reportagem = conteudo.reportagens.find((r) => r.suporte === chave);
  return [
    ESTILO_DAS_IMAGENS,
    `Evento: ${conteudo.tema}.`,
    reportagem?.imagem.descricao ?? "",
    `O cartaz do evento ("${conteudo.cartaz.texto}") aparece ao fundo.`,
    EXIGENCIA_DO_SUPORTE[chave],
  ]
    .filter(Boolean)
    .join(" ");
}

/** As cenas FIXAS do banco (o caso novo), geradas uma vez pelo `admin`. O Desafio Extra saiu (ADR-201). */
export const DESCRICAO_DA_CENA_FIXA: Readonly<Record<ChaveDaCenaFixa, ImagemDescrita>> = {
  "caso-a": MATERIAS_DO_CASO[0]!.imagem,
  "caso-b": MATERIAS_DO_CASO[1]!.imagem,
};

export function promptDaCenaFixa(chave: ChaveDaCenaFixa): string {
  return [ESTILO_DAS_IMAGENS, DESCRICAO_DA_CENA_FIXA[chave].descricao].join(" ");
}

/** Toda chave de cena fixa tem descrição (o teste confere a lista do vocabulário). */
export const CENAS_FIXAS = CHAVES_DAS_CENAS_FIXAS;
