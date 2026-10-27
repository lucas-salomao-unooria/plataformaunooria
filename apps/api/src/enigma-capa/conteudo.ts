/**
 * O CATÁLOGO da exp02ef1b — O Enigma da Capa da Rádio (2º ano EF, unidade 1,
 * ADR-184; revisão 2.0.0, ADR-186): vocabulários, a geometria fixa da
 * panorâmica, os três pacotes prontos (Biblioteca, Horta, Museu), a E5 fixa e
 * os textos da tela.
 *
 * Fonte: o one-pager do PO v1.1 (`artefatos_exp02ef1b/produto/00-material-anexado.md`)
 * e o protótipo validado pelo time (`design/08-prototipo.html`), LITERAIS nos
 * textos. As decisões do Lucas de 2026-10-26 vencem os dois onde divergem: o
 * clone é o Unoovista (não o instanooria), a virada é GERAL da turma (um
 * botão), a missão é 100% ações em tela (Canal A), sem áudio de tela e sem
 * texto livre; a 2.0.0 segue o protótipo e termina na segunda foto (a E5).
 *
 * Puro — sem Nest e sem Prisma. A experiência e o hub espelham os TIPOS de
 * `contrato-de-rotas.ts`; os números daqui (os alvos, os núcleos, os
 * marcáveis) não descem ao cliente, exceto o que o contrato diz que desce.
 */

import { componentePorSlug } from "../curriculo/componentes";

export const EXP_ID = "exp02ef1b";

/** Gravada em cada sessão: o histórico se reprocessa pela versão que o mediu. */
export const VERSAO_DO_INSTRUMENTO = "2.2.0";

// ──────────────────────────────────────────── vocabulários (CHECK na migration)

/**
 * O componente curricular do recorte do professor: TODOS os do 2º ano na matriz
 * da plataforma (`curriculo/componentes.ts#componentesDoAno("2EF")`, na ordem
 * do catálogo), mais Computação (o complemento de 2022 à BNCC) e "Outro
 * componente" no fim (decisão do Lucas, ADR-186). Literal, e não derivado em
 * tempo de execução: o CHECK da migration precisa do texto, e
 * `tests/enigma-capa-regras.spec.ts` confere a lista contra o catálogo.
 */
export const DISCIPLINAS = [
  "lingua-portuguesa",
  "arte",
  "educacao-fisica",
  "matematica",
  "ciencias",
  "geografia",
  "historia",
  "ensino-religioso",
  "computacao",
  "outra",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

/** O rótulo vem do catálogo de componentes (uma fonte só); "outra" não está nele. */
export const ROTULO_DA_DISCIPLINA: Readonly<Record<Disciplina, string>> = Object.fromEntries(
  DISCIPLINAS.map((slug) => [slug, slug === "outra" ? "Outro componente" : (componentePorSlug(slug)?.rotulo ?? slug)]),
) as Record<Disciplina, string>;

export const ORIGENS = ["padrao", "ia"] as const;
export type Origem = (typeof ORIGENS)[number];

/** As cenas: os três pacotes prontos e a cena gerada pela IA do preparo. */
export const CHAVES_DE_CENA = ["biblioteca", "horta", "museu", "ia"] as const;
export type ChaveDeCena = (typeof CHAVES_DE_CENA)[number];
export const CHAVES_PRONTAS = ["biblioteca", "horta", "museu"] as const;
export type ChavePronta = (typeof CHAVES_PRONTAS)[number];

/** As fases da TURMA, que o professor move: só para a frente (decisão do Lucas: a virada é GERAL). */
export const FASES = ["aberta", "virada"] as const;
export type Fase = (typeof FASES)[number];

export const FOTOS = ["foto-1", "foto-2"] as const;
export type FotoId = (typeof FOTOS)[number];
export const SELOS = ["selo-1", "selo-2"] as const;
export type SeloId = (typeof SELOS)[number];
export const INVARIANTES = ["inv-1", "inv-2"] as const;
export type InvarianteId = (typeof INVARIANTES)[number];

/** E5, o motivo do par: "A atividade" / "A cor da roupa". */
export const MOTIVOS_DO_PAR = ["atividade", "roupa"] as const;
export type MotivoDoPar = (typeof MOTIVOS_DO_PAR)[number];

/** E5, a segunda foto: "Mochila" / "Parede" / "Criança lendo". */
export const ELEMENTOS_DA_SEGUNDA_FOTO = ["mochila", "parede", "crianca-lendo"] as const;
export type ElementoDaSegundaFoto = (typeof ELEMENTOS_DA_SEGUNDA_FOTO)[number];

// ──────────────────────────────────────────── a geometria fixa

/** Retângulo em coordenadas normalizadas 0–100 da PANORÂMICA 16:9 (x em % da largura, y em % da altura). */
export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Ponto {
  x: number;
  y: number;
}

/**
 * A ÁREA de um objeto do fundo: o retângulo que o PROFESSOR desenha em volta
 * dele no preparo (2.2.0, ADR-188). Era um círculo de raio fixo, e objeto maior
 * que o círculo fazia a lupa "errar" com a lente em cima do objeto certo.
 */
export type Alvo = Retangulo;

/** O deslocamento da foto dentro da moldura, como FRAÇÃO da folga: `{0,0}` = canto superior esquerdo. */
export interface Deslocamento {
  x: number;
  y: number;
}

/** A panorâmica é 16:9: um ponto na vertical vale 9/16 de um ponto na horizontal. */
export const ALTURA_POR_LARGURA = 9 / 16;

/**
 * As duas fotos SÃO recortes da panorâmica, FIXOS em todo pacote (a IA desenha
 * a cena para eles). A faixa comum x ∈ [32, 68] aparece nas duas: é lá que os
 * invariantes moram, e é por isso que o slider revela a panorâmica sem emenda.
 * (Era [38, 62] na spec; o líder alargou para 68% ao anotar as imagens.)
 */
export const RECORTE_DA_FOTO: Readonly<Record<FotoId, Retangulo>> = {
  "foto-1": { x: 0, y: 0, w: 68, h: 100 },
  "foto-2": { x: 32, y: 0, w: 68, h: 100 },
};
export const FAIXA_COMUM = { de: 32, ate: 68 } as const;

/** A moldura da capa (E3): tamanho FIXO, 80% × 80% da foto. Sem zoom, sem alça. */
export const MOLDURA_DA_CAPA = { w: 0.8, h: 0.8 } as const;

/**
 * A moldura da segunda foto (E5): 55% × 85% da imagem `leitura.webp` (4:3) —
 * estreita o bastante para o enquadramento PODER deixar a criança de fora.
 */
export const MOLDURA_DA_SEGUNDA_FOTO = { w: 0.55, h: 0.85 } as const;
export const PROPORCAO_DA_SEGUNDA_FOTO = 4 / 3;
export const PROPORCAO_DA_PANORAMICA = 16 / 9;

/**
 * Os limites da área que o professor desenha, em % da panorâmica. O mínimo é o
 * toque de uma criança (3% da largura ≈ 22 px num celular de 375 px, que a
 * margem do toque completa); o máximo impede que uma caixa do tamanho da
 * parede deixe a lupa achar o objeto em qualquer lugar.
 */
export const AREA_DO_ALVO = { minW: 3, minH: 5, maxW: 30, maxH: 60 } as const;

/**
 * A folga em volta da área, em % da LARGURA (na vertical, convertida pela
 * proporção 16:9): o centro da lente e o dedo de 7 anos ficam PERTO do objeto,
 * não exatamente em cima. A tela recebe o número em `geometria.margemDoAlvo`.
 */
export const MARGEM_DO_ALVO = 1.5;

/** Metade do núcleo visível: a visitante "viu" a ação da foto (e a 2ª foto "mostra a leitura"). */
export const NUCLEO_VISIVEL_MINIMO = 0.5;
/** Um marcável fica "fora" da capa quando metade (ou mais) da área dele está fora do retângulo publicado. */
export const FORA_MINIMO = 0.5;

/** Os erros antes de o relógio e o cartaz pulsarem (one-pager §7: "Após 3 toques incorretos"). */
export const ERROS_ATE_A_AJUDA = 3;
/** Os erros depois da ajuda que fazem a EF02CO01 "não atingiu" (o "apontamento do professor", medido). */
export const ERROS_POS_AJUDA_NAO_ATINGIU = 3;

/**
 * O piso da lupa (E2): 3 s com o centro da lente sobre CADA um dos dois
 * objetos do fundo (os invariantes, os mesmos da E4) EM CADA UMA das duas
 * fotos — quatro achados (2.2.0, ADR-188: achar na foto 1 não acha na 2).
 */
export const PISO_DA_LUPA_MS = 3000;

/** De 1 a 10 toques no "o que ficou fora" (E4, Momento 5): o "Pronto" exige ao menos um. */
export const TOQUES_FORA_MAX = 10;
export const MARCAVEIS = { min: 2, max: 6 } as const;

/** Tetos dos textos do pacote (one-pager §15: rótulos e botões curtos). */
export const SELO_MAX_PALAVRAS = 3;
export const VISITANTE_MAX_CARACTERES = 60;
export const TEMA = { min: 3, max: 60 } as const;
export const PALAVRAS = { min: 3, max: 6, maxCaracteres: 20 } as const;
export const NOTA_MAX = 200;
/**
 * O pedido de imagem que o professor pode editar na curadoria (ADR-188): só a
 * descrição da cena. As regras fixas (ilustração, crianças sem rosto, nenhum
 * texto, os objetos na faixa do meio) a api acrescenta sempre, fora dele.
 */
export const PEDIDO_DA_IMAGEM = { min: 40, max: 2000 } as const;

// ──────────────────────────────────────────── o pacote

export type ImagemDaCena = { tipo: "bundle"; nome: string } | { tipo: "url"; url: string };

export interface FotoDaCena {
  id: FotoId;
  recorte: Retangulo;
  /** A ação principal da foto. Gabarito: decide a fala da visitante. */
  nucleo: Retangulo;
  /** O que a foto mostra ("Mesa de leitura em silêncio") — desce: não é gabarito. */
  acao: string;
  /** A fala da visitante quando o núcleo ficou na capa ("Na foto, vi crianças lendo!"). Gabarito. */
  visitante: string;
  /** O selo que descreve esta foto. Gabarito (o "selo coerente" da régua). */
  seloCoerente: SeloId;
}

export interface SeloDaCena {
  id: SeloId;
  /** CAIXA ALTA, até 3 palavras ("SILÊNCIO PARA LER"). */
  texto: string;
  emoji: string;
}

export interface InvarianteDaCena {
  id: InvarianteId;
  /** CAIXA ALTA ("RELÓGIO") — desce: é o "Desenhe a área do RELÓGIO" da curadoria. */
  nome: string;
  /** Gabarito: a área do objeto. `null` na cena da IA até o professor desenhá-la. */
  alvo: Alvo | null;
}

export interface MarcavelDaCena {
  id: string;
  nome: string;
  area: Retangulo;
}

export interface Cena {
  chave: ChaveDeCena;
  espaco: string;
  espacoCurto: string;
  hora: string;
  imagem: ImagemDaCena;
  alt: string;
  fotos: FotoDaCena[];
  selos: SeloDaCena[];
  invariantes: InvarianteDaCena[];
  /** O retângulo grosso da parede comum: a DICA da lupa (desce), não o gabarito. */
  fundo: Retangulo;
  /** O que pode ficar "fora da foto" (E4). Gabarito. */
  marcaveis: MarcavelDaCena[];
}

/**
 * O conteúdo de um pacote — o que o professor aprova. O schema real é o Zod de
 * `contrato-de-rotas.ts#ConteudoDoPacoteSchema`; a régua é
 * `regras/pacote.ts#problemasDoConteudo`.
 */
export interface ConteudoDoPacote {
  versao: 1;
  cena: Cena;
}

export interface PacotePronto {
  nome: string;
  disciplina: Disciplina;
  tema: string;
  palavras: readonly string[];
  conteudo: ConteudoDoPacote;
}

// ──────────────────────────────────────────── OS PACOTES PRONTOS

const recorte = (id: FotoId): Retangulo => ({ ...RECORTE_DA_FOTO[id] });

/**
 * OS TRÊS PACOTES PRONTOS (origem `padrao`). Os textos são LITERAIS do one-pager
 * (§3 "teste das três disciplinas", §9b); a geometria é a ANOTAÇÃO MEDIDA pelo
 * líder sobre `apps/experiencias/exp02ef1b/public/cenas/{chave}.webp`
 * (1920×1080). As imagens foram REFEITAS na 2.0.0 (ADR-186), com a composição
 * limpa que o time pediu, e de novo na 2.2.0 (ADR-188): limpas ficaram ÓBVIAS
 * (só os dois objetos na parede), e agora eles são de tamanho médio, entre
 * outros objetos comuns. Os alvos são as ÁREAS dos objetos (retângulos),
 * medidas sobre a imagem com grade de 1%.
 *
 * Mexeu numa imagem? Reanote e edite SÓ este objeto: núcleos, áreas, fundo e
 * marcáveis. `tests/enigma-capa-regras.spec.ts` passa os três pela régua
 * (alvos dentro da faixa comum, núcleo dentro do recorte, marcáveis na cena).
 *
 * Um desvio do one-pager, forçado pela imagem: no Museu o invariante é a
 * PLACA DOURADA, não a "placa da fundação 1952" — a imagem não tem texto
 * escrito (a regra do pedido de imagem), e um alvo chamado "1952" pediria à
 * criança um número que ela não acha.
 */
export const PACOTES_PRONTOS: Readonly<Record<ChavePronta, PacotePronto>> = {
  biblioteca: {
    nome: "Biblioteca Escolar",
    disciplina: "lingua-portuguesa",
    tema: "Leitura e contação de histórias na rádio",
    palavras: ["biblioteca", "leitura", "fantoches"],
    conteudo: {
      versao: 1,
      cena: {
        chave: "biblioteca",
        espaco: "Biblioteca Escolar",
        espacoCurto: "a biblioteca",
        hora: "14:15",
        imagem: { tipo: "bundle", nome: "cenas/biblioteca.webp" },
        alt: "A biblioteca da escola inteira: à esquerda, duas crianças lendo numa mesa; à direita, duas crianças contando histórias com fantoches num tapete colorido; na parede do meio, um relógio de moldura vermelha, um cartaz amarelo com um livro, uma prateleira com livros, um vaso de planta e uma mochila pendurada.",
        fotos: [
          {
            id: "foto-1",
            recorte: recorte("foto-1"),
            nucleo: { x: 12, y: 50, w: 31, h: 40 },
            acao: "Mesa de leitura em silêncio",
            visitante: "Na foto, vi crianças lendo!",
            seloCoerente: "selo-1",
          },
          {
            id: "foto-2",
            recorte: recorte("foto-2"),
            nucleo: { x: 60, y: 60, w: 26, h: 30 },
            acao: "Tapete com fantoches",
            visitante: "Na foto, vi crianças contando histórias!",
            seloCoerente: "selo-2",
          },
        ],
        selos: [
          { id: "selo-1", texto: "SILÊNCIO PARA LER", emoji: "📖" },
          { id: "selo-2", texto: "CONTAÇÃO DE HISTÓRIAS", emoji: "🎭" },
        ],
        invariantes: [
          { id: "inv-1", nome: "RELÓGIO", alvo: { x: 45, y: 19.5, w: 10, h: 17.5 } },
          { id: "inv-2", nome: "CARTAZ AMARELO", alvo: { x: 57, y: 20, w: 10.2, h: 21.2 } },
        ],
        fundo: { x: 32, y: 10, w: 36, h: 35 },
        marcaveis: [
          { id: "mesa-leitura", nome: "MESA DE LEITURA", area: { x: 12, y: 50, w: 32, h: 42 } },
          { id: "tapete-fantoches", nome: "TAPETE COM FANTOCHES", area: { x: 54, y: 60, w: 39, h: 34 } },
          { id: "estante-esquerda", nome: "ESTANTE", area: { x: 0, y: 54, w: 16, h: 36 } },
          { id: "estante-direita", nome: "ESTANTE", area: { x: 84, y: 54, w: 16, h: 36 } },
        ],
      },
    },
  },
  horta: {
    nome: "Horta Escolar",
    disciplina: "ciencias",
    tema: "Canteiro de hortaliças e decomposição do solo",
    palavras: ["horta", "plantas", "adubo"],
    conteudo: {
      versao: 1,
      cena: {
        chave: "horta",
        espaco: "Horta Escolar",
        espacoCurto: "a horta",
        hora: "14:15",
        imagem: { tipo: "bundle", nome: "cenas/horta.webp" },
        alt: "A horta da escola inteira: à esquerda, duas crianças regando um canteiro de alfaces com regadores azuis; à direita, duas crianças com minhocas num canteiro de terra escura; no muro do meio, um espantalho, um regador vermelho pendurado, uma pá, um carrinho de mão e um balde.",
        fotos: [
          {
            id: "foto-1",
            recorte: recorte("foto-1"),
            nucleo: { x: 5, y: 38, w: 40, h: 56 },
            acao: "Canteiro de alfaces",
            visitante: "Na foto, vi alfaces!",
            seloCoerente: "selo-1",
          },
          {
            id: "foto-2",
            recorte: recorte("foto-2"),
            nucleo: { x: 59, y: 50, w: 38, h: 46 },
            acao: "Adubação com minhocas",
            visitante: "Na foto, vi minhocas!",
            seloCoerente: "selo-2",
          },
        ],
        selos: [
          { id: "selo-1", texto: "PLANTA CRESCENDO", emoji: "🌱" },
          { id: "selo-2", texto: "TERRA ADUBADA", emoji: "🪱" },
        ],
        invariantes: [
          { id: "inv-1", nome: "ESPANTALHO", alvo: { x: 34.8, y: 12.8, w: 13.6, h: 29.2 } },
          { id: "inv-2", nome: "REGADOR VERMELHO", alvo: { x: 48.8, y: 18.6, w: 8.6, h: 14.4 } },
        ],
        fundo: { x: 32, y: 12, w: 36, h: 35 },
        marcaveis: [
          { id: "canteiro-alfaces", nome: "CANTEIRO DE ALFACES", area: { x: 2, y: 50, w: 43, h: 42 } },
          { id: "crianca-regando", nome: "CRIANÇAS REGANDO", area: { x: 5, y: 36, w: 40, h: 58 } },
          { id: "canteiro-terra", nome: "CANTEIRO DE TERRA", area: { x: 55, y: 50, w: 43, h: 40 } },
          { id: "criancas-minhocas", nome: "CRIANÇAS COM MINHOCAS", area: { x: 59, y: 52, w: 38, h: 46 } },
        ],
      },
    },
  },
  museu: {
    nome: "Museu da Escola",
    disciplina: "historia",
    tema: "Objetos do passado e do presente escolar",
    palavras: ["museu", "objetos antigos", "escola"],
    conteudo: {
      versao: 1,
      cena: {
        chave: "museu",
        espaco: "Museu da Escola",
        espacoCurto: "o museu",
        hora: "14:15",
        imagem: { tipo: "bundle", nome: "cenas/museu.webp" },
        alt: "O museu da escola inteiro: à esquerda, duas crianças olhando uma vitrine antiga com tinteiros e penas; à direita, duas crianças desenhando numa bancada com canetas coloridas e cadernos; na parede do meio, uma placa dourada, uma janela de madeira, um quadro de montanhas, um vaso antigo e um banco.",
        fotos: [
          {
            id: "foto-1",
            recorte: recorte("foto-1"),
            nucleo: { x: 2, y: 33, w: 31, h: 60 },
            acao: "Estante com tinteiros e penas",
            visitante: "Na foto, vi tinteiros!",
            seloCoerente: "selo-1",
          },
          {
            id: "foto-2",
            recorte: recorte("foto-2"),
            nucleo: { x: 69, y: 50, w: 30, h: 46 },
            acao: "Bancada com canetas e cadernos",
            visitante: "Na foto, vi canetas!",
            seloCoerente: "selo-2",
          },
        ],
        selos: [
          { id: "selo-1", texto: "TEMPO ANTIGO", emoji: "⏳" },
          { id: "selo-2", texto: "TEMPO DE HOJE", emoji: "✏️" },
        ],
        invariantes: [
          { id: "inv-1", nome: "PLACA DOURADA", alvo: { x: 35.3, y: 13.6, w: 16.4, h: 18.4 } },
          { id: "inv-2", nome: "JANELA DE MADEIRA", alvo: { x: 53.8, y: 12.8, w: 11, h: 19.6 } },
        ],
        fundo: { x: 32, y: 10, w: 36, h: 28 },
        marcaveis: [
          { id: "estante-antiga", nome: "VITRINE ANTIGA", area: { x: 2, y: 33, w: 31, h: 58 } },
          { id: "criancas-observando", nome: "CRIANÇAS OLHANDO", area: { x: 9, y: 51, w: 23, h: 45 } },
          { id: "bancada", nome: "MESA COM CANETAS", area: { x: 73, y: 57, w: 27, h: 30 } },
          { id: "criancas-desenhando", nome: "CRIANÇAS DESENHANDO", area: { x: 69, y: 51, w: 26, h: 45 } },
        ],
      },
    },
  },
};

/** O banco padrão do PO: o caminho curto ("USAR BANCO PADRÃO (BIBLIOTECA)"). */
export const CHAVE_PADRAO: ChavePronta = "biblioteca";

/**
 * Sem saldo de IA ou com o vendor fora: o rascunho sai do pacote pronto da
 * disciplina. Ciências → Horta; História e Geografia → Museu; o resto →
 * Biblioteca (o banco padrão).
 */
export const PRONTO_DA_DISCIPLINA: Readonly<Record<Disciplina, ChavePronta>> = {
  "lingua-portuguesa": "biblioteca",
  arte: "biblioteca",
  "educacao-fisica": "biblioteca",
  matematica: "biblioteca",
  ciencias: "horta",
  geografia: "museu",
  historia: "museu",
  "ensino-religioso": "biblioteca",
  computacao: "biblioteca",
  outra: "biblioteca",
};

/** Uma CÓPIA do conteúdo do pacote pronto — quem grava pode mexer sem sujar o catálogo. */
export function conteudoPronto(chave: ChavePronta): ConteudoDoPacote {
  return structuredClone(PACOTES_PRONTOS[chave].conteudo) as ConteudoDoPacote;
}

/**
 * A GEOMETRIA da cena gerada pela IA — um GABARITO de layout, porque a IA
 * escreve o texto e desenha a imagem, mas não devolve coordenada: o pedido de
 * imagem (`prompts.ts#pedidoDeImagem`) põe a atividade 1 na metade esquerda, a
 * 2 na direita e os dois objetos na parede do meio. Os alvos nascem `null`: o
 * professor desenha a área de cada um na imagem (`POST …/rascunho/invariantes`).
 */
export const GEOMETRIA_DA_CENA_GERADA = {
  nucleos: { "foto-1": { x: 4, y: 38, w: 38, h: 55 }, "foto-2": { x: 58, y: 38, w: 38, h: 55 } },
  fundo: { x: 32, y: 3, w: 36, h: 40 },
  /** Os dois marcáveis da cena gerada são as próprias ações (a outra foto fica "fora"). */
  marcaveis: { "foto-1": { x: 2, y: 36, w: 42, h: 60 }, "foto-2": { x: 56, y: 36, w: 42, h: 60 } },
} as const satisfies { nucleos: Record<FotoId, Retangulo>; fundo: Retangulo; marcaveis: Record<FotoId, Retangulo> };

// ──────────────────────────────────────────── E5 — FIXA em todo pacote

/**
 * E5, os pares: quatro cartas de ids OPACOS (o cliente recebe só id e imagem).
 * Par certo = a mesma ATIVIDADE (a+c, b+d); o distrator é a COR da camiseta
 * (a+d, b+c). Nada da E5 bloqueia nem entra na régua — vai ao painel.
 */
export const CARTAS_DOS_PARES = [
  { id: "carta-a", imagem: "fixas/carta-a.webp", descricao: "Menina de camiseta azul lendo um livro", atividade: "leitura", cor: "azul" },
  { id: "carta-b", imagem: "fixas/carta-b.webp", descricao: "Menino de camiseta vermelha chutando bola", atividade: "brincadeira", cor: "vermelha" },
  { id: "carta-c", imagem: "fixas/carta-c.webp", descricao: "Menino de camiseta vermelha lendo gibi", atividade: "leitura", cor: "vermelha" },
  { id: "carta-d", imagem: "fixas/carta-d.webp", descricao: "Menina de camiseta azul pulando corda", atividade: "brincadeira", cor: "azul" },
] as const;
export const IDS_DAS_CARTAS: readonly string[] = CARTAS_DOS_PARES.map((c) => c.id);

/**
 * E5, a segunda foto: a cena de leitura (criança lendo, mochila no chão,
 * parede), 4:3, numa moldura fixa de `MOLDURA_DA_SEGUNDA_FOTO`. As
 * coordenadas são da PRÓPRIA imagem (0–100), anotadas pelo líder. Gabarito.
 */
export const SEGUNDA_FOTO = {
  imagem: "fixas/leitura.webp",
  /** A criança e o livro: o que precisa aparecer para alguém reconhecer a leitura. */
  nucleo: { x: 6, y: 40, w: 36, h: 58 } satisfies Retangulo,
  mochila: { x: 70, y: 63, w: 26, h: 35 } satisfies Retangulo,
  essencial: "crianca-lendo" as ElementoDaSegundaFoto,
} as const;

export const ROTULO_DO_ELEMENTO: Readonly<Record<ElementoDaSegundaFoto, string>> = {
  mochila: "Mochila",
  parede: "Parede",
  "crianca-lendo": "Criança lendo",
};

export const ROTULO_DO_MOTIVO: Readonly<Record<MotivoDoPar, string>> = {
  atividade: "A atividade",
  roupa: "A cor da roupa",
};

// ──────────────────────────────────────────── os textos da tela (literais do protótipo)

/**
 * Os textos da tela do estudante, LITERAIS do protótipo validado pelo time
 * (CAIXA ALTA onde ele usa). O servidor preenche `{espacoCurto}`, `{ESPACO}`,
 * `{hora}` e as frases que dependem do artigo do espaço (`e1.missao`,
 * `e4.fora`); `{n}` (o contador) fica para a tela. Descem em
 * `GET /enigma-capa/sessao`.
 */
export const TEXTOS = {
  e1: {
    tag: "RASCUNHO PENDENTE",
    titulo: "INVESTIGAR A NOVA CAPA",
    contexto: "A capa sobre {espacoCurto} causou confusão entre os ouvintes.",
    missao: "ENCONTRE OS 2 OBJETOS IGUAIS NAS DUAS FOTOS {DO_ESPACO}",
    abrir: "ABRIR BANCADA",
  },
  e2: {
    titulo: "INVESTIGUE COM A LUPA",
    instrucao: "Ache os 2 objetos iguais na FOTO 1 e na FOTO 2. Segure a lupa em cima de cada um.",
    segure: "SEGURE A LUPA AQUI!",
    contador: "{n} DE 4 ENCONTRADOS",
    contadorDaFoto: "{n} DE 2",
    completa: "INVESTIGAÇÃO COMPLETA!",
    completaTexto: "Você observou atentamente as duas fotos e os detalhes da parede!",
    rotuloDaFoto1: "FOTO 1 — {ESPACO} {hora}",
    rotuloDaFoto2: "FOTO 2 — {ESPACO} {hora}",
    alerta: "OLHE O FUNDO",
    alertaTexto: "Antes de avançar, passe a lupa nas paredes do fundo de cada foto para encontrar pistas importantes!",
    voltar: "VOLTAR À INVESTIGAÇÃO",
    mao: "ARRASTE A LUPA ATÉ A PAREDE DO FUNDO",
    inatividade: "VAMOS INVESTIGAR?",
  },
  e3: {
    titulo: "ESCOLHA 1 FOTO",
    tituloSelo: "SELECIONE O SELO",
    tituloPronta: "CAPA PRONTA!",
    prontaTexto: "Foto enquadrada e selo carimbado!",
    arraste: "Enquadre a foto",
    arrasteNota: "(Tamanho fixo, sem zoom)",
    publicar: "PUBLICAR CAPA",
    publicada: "CAPA PUBLICADA!",
    publicadaTexto: "Sua capa foi para o feed da rádio.",
    irParaOFeed: "IR PARA O FEED",
  },
  e4: {
    aguarde: "AGUARDE O PROFESSOR",
    professorJaVem: "O PROFESSOR JÁ VEM!",
    respire: "Respire fundo enquanto o professor conversa com a turma.",
    suaFoto: "SUA FOTO",
    outraFoto: "OUTRA FOTO",
    invariantes: "TOQUE EM 2 COISAS IGUAIS",
    invariantesTexto: "Toque na mesma coisa nas duas fotos.",
    contador: "{n} DE 2 ENCONTRADOS",
    bentoEntendeu: "AGORA EU ENTENDI!",
    revelar: "DESLIZE PARA REVELAR",
    revelarTexto: "Arraste o botão e veja o lugar inteiro.",
    cenaInteira: "A CENA COMPLETA",
    mesmoLugar: "MESMO LUGAR · MESMO MINUTO ({hora})",
    bentoMesmoLugar: "ERA O MESMO LUGAR!",
    avancar: "AVANÇAR",
    fora: "Marque n{espacoCurto} o que ficou fora da sua foto.",
    alfinete: "ARRASTE O ALFINETE",
    pronto: "Pronto",
  },
  e5: {
    pares: "Junte duas fotos da mesma atividade.",
    parFormado: "PAR FORMADO!",
    motivo: "O que é parecido?",
    segunda: "Foto de leitura: o que precisa aparecer?",
    arraste: "Enquadre a foto",
    album: "Colocar no álbum",
    guardada: "FOTO GUARDADA NO ÁLBUM!",
    fim: "MISSÃO CUMPRIDA!",
    fimTexto: "Agora conversem com o professor.",
  },
  erros: {
    semSinal: "SEM SINAL NA RÁDIO",
    carregando: "CARREGANDO CAPA...",
    tentarDeNovo: "TENTAR DE NOVO",
  },
} as const;

const ARTIGO = /^(a|o|as|os)\s+(.+)$/i;

/**
 * A frase do "o que ficou fora" com o espaço da cena. O PO escreveu "Marque na
 * biblioteca…" e "Marque no pátio…": o artigo vem do `espacoCurto` ("a
 * biblioteca" → "na biblioteca", "o museu" → "no museu").
 */
export function fraseDoFora(espacoCurto: string): string {
  const t = espacoCurto.trim();
  const m = ARTIGO.exec(t);
  const lugar = m ? `${({ a: "na", o: "no", as: "nas", os: "nos" } as Record<string, string>)[m[1]!.toLowerCase()]} ${m[2]}` : `em ${t}`;
  return `Marque ${lugar} o que ficou fora da sua foto.`;
}

/**
 * A missão do card da E1, em CAIXA ALTA, com o artigo contraído do
 * `espacoCurto`: "a biblioteca" → "ENCONTRE OS 2 OBJETOS IGUAIS NAS DUAS FOTOS
 * DA BIBLIOTECA", "o museu" → "…DO MUSEU", "as salas" → "…DAS SALAS"; sem
 * artigo, "…DE {X}". IGUAIS e NAS DUAS FOTOS são o pedido (2.2.0): "2 objetos"
 * sozinho deixava a criança procurar dois objetos quaisquer. A tela tem uma
 * cópia (como a de `fraseDoFora`).
 */
export function fraseDaMissao(espacoCurto: string): string {
  const t = espacoCurto.trim();
  const m = ARTIGO.exec(t);
  const lugar = m ? `${({ a: "da", o: "do", as: "das", os: "dos" } as Record<string, string>)[m[1]!.toLowerCase()]} ${m[2]}` : `de ${t}`;
  return `ENCONTRE OS 2 OBJETOS IGUAIS NAS DUAS FOTOS ${lugar}`.toLocaleUpperCase("pt-BR");
}

/** Os tempos da tela (o one-pager §4 e §7; o 45 s e os 3 min são o "[PARÂMETRO]" sugerido pelo PO). */
export const TEMPOS = {
  toqueLiberadoMs: 3000,
  inatividadeMs: 45_000,
  esperaDoProfessorMs: 180_000,
  pollingMs: 3000,
} as const;

// ──────────────────────────────────────────── o professor

/** O roteiro da conversa: a introdução, a pausa (E4) e as perguntas (§9a e §4 E5). */
export const ROTEIRO = {
  introducao:
    "O Bento postou uma foto da biblioteca e os ouvintes entenderam tudo errado. Encontre os 2 objetos iguais nas duas fotos da biblioteca e descubra o mistério da capa!",
  regraDoArraste: "Você pode mover a foto, mas não mudar o tamanho.",
  pausa: "O que a visitante conseguiu conhecer pela foto? O que ficou de fora?",
  cartoes: ["ENQUADRAMENTO", "AUTORIA", "O QUE FICOU DE FORA"],
  perguntas: [
    "A foto da mesa de silêncio era mentirosa? E a foto do fantoche no tapete?",
    "Quem olhou só uma das fotos conseguiu adivinhar o que estava acontecendo do outro lado da sala?",
    "Quando tiram uma foto sua na escola em um segundo em que você está bravo, aquela foto mostra como você é o dia inteiro?",
    "A foto da mesa de silêncio era mentirosa? E a foto do fantoche?",
    "Quem tirou a foto escolheu mostrar tudo ou só um pedaço?",
    "O que ficou de fora da sua foto que mudou o que os ouvintes pensaram da escola?",
  ],
  liberar: "Depois da conversa, toque em LIBERAR VIRADA: as telas da turma mostram a foto de cada um ao lado da outra foto.",
} as const;
