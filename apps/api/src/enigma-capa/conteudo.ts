/**
 * O CATÁLOGO da exp02ef1b — O Enigma da Capa da Rádio (2º ano EF, unidade 1,
 * ADR-184): vocabulários, a geometria fixa da panorâmica, os três pacotes
 * prontos (Biblioteca, Horta, Museu), a E5 e a E6 fixas e os textos da tela.
 *
 * Fonte: o one-pager do PO v1.1 (`artefatos_exp02ef1b/produto/00-material-anexado.md`),
 * LITERAL nos textos. As decisões do Lucas de 2026-10-26 vencem o one-pager
 * onde divergem: o clone é o Unoovista (não o instanooria), a virada é GERAL
 * da turma (um botão), sem Canal B, sem áudio de tela, sem texto livre.
 *
 * Puro — sem Nest e sem Prisma. A experiência e o hub espelham os TIPOS de
 * `contrato-de-rotas.ts`; os números daqui (os alvos, os núcleos, os
 * marcáveis) não descem ao cliente, exceto o que o contrato diz que desce.
 */

export const EXP_ID = "exp02ef1b";

/** Gravada em cada sessão: o histórico se reprocessa pela versão que o mediu. */
export const VERSAO_DO_INSTRUMENTO = "1.0.0";

// ──────────────────────────────────────────── vocabulários (CHECK na migration)

/** O componente curricular do recorte do professor (one-pager §3, "teste das três disciplinas"). */
export const DISCIPLINAS = ["lingua-portuguesa", "ciencias", "historia", "outra"] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

export const ROTULO_DA_DISCIPLINA: Readonly<Record<Disciplina, string>> = {
  "lingua-portuguesa": "Língua Portuguesa",
  ciencias: "Ciências",
  historia: "História",
  outra: "Outro componente",
};

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

/** Os crachás de repórter mirim (E1). */
export const CRACHAS = ["fone-azul", "fone-amarelo", "microfone-verde", "gravador-laranja"] as const;
export type Cracha = (typeof CRACHAS)[number];

export const ROTULO_DO_CRACHA: Readonly<Record<Cracha, { rotulo: string; emoji: string }>> = {
  "fone-azul": { rotulo: "FONE AZUL", emoji: "🎧" },
  "fone-amarelo": { rotulo: "FONE AMARELO", emoji: "⭐" },
  "microfone-verde": { rotulo: "MICROFONE VERDE", emoji: "🎙️" },
  "gravador-laranja": { rotulo: "GRAVADOR LARANJA", emoji: "📻" },
};

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

/** E6, o voto da transferência — o LATCH 2. */
export const VOTOS = ["so-um-pedaco", "mostra-tudo"] as const;
export type Voto = (typeof VOTOS)[number];

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

/** Alvo circular: centro na panorâmica e raio em % da LARGURA (o círculo é redondo na tela). */
export interface Alvo {
  x: number;
  y: number;
  r: number;
}

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
 * O raio de um invariante marcado pelo professor, em % da largura da
 * panorâmica: 7 ≈ um alvo de 44 px no celular (o toque de uma criança).
 */
export const RAIO_PADRAO = 7;
export const RAIO = { min: 2, max: 10 } as const;

/** Metade do núcleo visível: a visitante "viu" a ação da foto (e a 2ª foto "mostra a leitura"). */
export const NUCLEO_VISIVEL_MINIMO = 0.5;
/** Um marcável fica "fora" da capa quando metade (ou mais) da área dele está fora do retângulo publicado. */
export const FORA_MINIMO = 0.5;

/** Os erros antes de o relógio e o cartaz pulsarem (one-pager §7: "Após 3 toques incorretos"). */
export const ERROS_ATE_A_AJUDA = 3;
/** Os erros depois da ajuda que fazem a EF02CO01 "não atingiu" (o "apontamento do professor", medido). */
export const ERROS_POS_AJUDA_NAO_ATINGIU = 3;

/** O piso da lupa (E2): 3 s sobre CADA foto E o fundo das duas. */
export const PISO_DA_LUPA_MS = 3000;

/** Até 10 toques no "o que ficou fora" (E4, Momento 5). */
export const TOQUES_FORA_MAX = 10;
export const MARCAVEIS = { min: 2, max: 6 } as const;

/** Tetos dos textos do pacote (one-pager §15: rótulos e botões curtos). */
export const SELO_MAX_PALAVRAS = 3;
export const VISITANTE_MAX_CARACTERES = 60;
export const TEMA = { min: 3, max: 60 } as const;
export const PALAVRAS = { min: 3, max: 6, maxCaracteres: 20 } as const;
export const NOTA_MAX = 200;

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
  /** CAIXA ALTA ("RELÓGIO") — desce: é o "Toque no RELÓGIO" da curadoria. */
  nome: string;
  /** Gabarito. `null` na cena da IA até o professor tocar no objeto. */
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
 * (1920×1080), em 2026-10-26.
 *
 * Mexeu numa imagem? Reanote e edite SÓ este objeto: núcleos, alvos, fundo e
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
        alt: "A biblioteca da escola inteira: à esquerda, crianças lendo numa mesa; à direita, crianças contando histórias com fantoches num tapete; na parede do meio, um relógio e um cartaz amarelo.",
        fotos: [
          {
            id: "foto-1",
            recorte: recorte("foto-1"),
            nucleo: { x: 5, y: 38, w: 41, h: 52 },
            acao: "Mesa de leitura em silêncio",
            visitante: "Na foto, vi crianças lendo!",
            seloCoerente: "selo-1",
          },
          {
            id: "foto-2",
            recorte: recorte("foto-2"),
            nucleo: { x: 59, y: 50, w: 35, h: 42 },
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
          { id: "inv-1", nome: "RELÓGIO", alvo: { x: 44, y: 19, r: 7.5 } },
          { id: "inv-2", nome: "CARTAZ AMARELO", alvo: { x: 60, y: 21, r: 7 } },
        ],
        fundo: { x: 32, y: 3, w: 36, h: 33 },
        marcaveis: [
          { id: "mesa-leitura", nome: "MESA DE LEITURA", area: { x: 3, y: 38, w: 43, h: 58 } },
          { id: "tapete-fantoches", nome: "TAPETE COM FANTOCHES", area: { x: 56, y: 48, w: 43, h: 52 } },
          { id: "estante-esquerda", nome: "ESTANTE", area: { x: 0, y: 4, w: 32, h: 36 } },
          { id: "estante-direita", nome: "ESTANTE", area: { x: 69, y: 4, w: 31, h: 36 } },
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
        alt: "A horta da escola inteira: à esquerda, uma criança regando um canteiro de alfaces; à direita, crianças com minhocas num canteiro de terra escura; no meio, ao fundo, um espantalho e um regador vermelho.",
        fotos: [
          {
            id: "foto-1",
            recorte: recorte("foto-1"),
            nucleo: { x: 7, y: 30, w: 38, h: 62 },
            acao: "Canteiro de alfaces",
            visitante: "Na foto, vi alfaces!",
            seloCoerente: "selo-1",
          },
          {
            id: "foto-2",
            recorte: recorte("foto-2"),
            nucleo: { x: 63, y: 40, w: 33, h: 45 },
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
          { id: "inv-1", nome: "ESPANTALHO", alvo: { x: 44, y: 32, r: 8 } },
          { id: "inv-2", nome: "REGADOR VERMELHO", alvo: { x: 61, y: 33, r: 6.5 } },
        ],
        fundo: { x: 32, y: 15, w: 36, h: 45 },
        marcaveis: [
          { id: "canteiro-alfaces", nome: "CANTEIRO DE ALFACES", area: { x: 0, y: 58, w: 35, h: 42 } },
          { id: "crianca-regando", nome: "CRIANÇA REGANDO", area: { x: 7, y: 30, w: 14, h: 48 } },
          { id: "canteiro-terra", nome: "CANTEIRO DE TERRA", area: { x: 55, y: 63, w: 45, h: 37 } },
          { id: "criancas-minhocas", nome: "CRIANÇAS COM MINHOCAS", area: { x: 63, y: 38, w: 32, h: 45 } },
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
        alt: "O museu da escola inteiro: à esquerda, uma estante antiga com tinteiros e penas; à direita, crianças desenhando numa bancada com canetas coloridas e cadernos; na parede do meio, uma placa dourada e uma janela de madeira.",
        fotos: [
          {
            id: "foto-1",
            recorte: recorte("foto-1"),
            nucleo: { x: 1, y: 16, w: 40, h: 72 },
            acao: "Estante com tinteiros e penas",
            visitante: "Na foto, vi tinteiros!",
            seloCoerente: "selo-1",
          },
          {
            id: "foto-2",
            recorte: recorte("foto-2"),
            nucleo: { x: 58, y: 40, w: 40, h: 50 },
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
          { id: "inv-1", nome: "PLACA DOURADA", alvo: { x: 44, y: 30, r: 7 } },
          { id: "inv-2", nome: "JANELA DE MADEIRA", alvo: { x: 58, y: 30, r: 6.5 } },
        ],
        fundo: { x: 32, y: 15, w: 36, h: 30 },
        marcaveis: [
          { id: "estante-antiga", nome: "ESTANTE ANTIGA", area: { x: 1, y: 16, w: 24, h: 75 } },
          { id: "criancas-observando", nome: "CRIANÇAS OLHANDO", area: { x: 22, y: 40, w: 20, h: 48 } },
          { id: "bancada", nome: "BANCADA COM CANETAS", area: { x: 58, y: 60, w: 40, h: 38 } },
          { id: "criancas-desenhando", nome: "CRIANÇAS DESENHANDO", area: { x: 63, y: 40, w: 33, h: 30 } },
        ],
      },
    },
  },
};

/** O banco padrão do PO: o caminho curto ("USAR BANCO PADRÃO (BIBLIOTECA)"). */
export const CHAVE_PADRAO: ChavePronta = "biblioteca";

/** Sem saldo de IA ou com o vendor fora: o rascunho sai do pacote pronto da disciplina. */
export const PRONTO_DA_DISCIPLINA: Readonly<Record<Disciplina, ChavePronta>> = {
  "lingua-portuguesa": "biblioteca",
  ciencias: "horta",
  historia: "museu",
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
 * professor os marca tocando na imagem (`POST …/rascunho/invariantes`), com o
 * raio `RAIO_PADRAO`.
 */
export const GEOMETRIA_DA_CENA_GERADA = {
  nucleos: { "foto-1": { x: 4, y: 38, w: 38, h: 55 }, "foto-2": { x: 58, y: 38, w: 38, h: 55 } },
  fundo: { x: 32, y: 3, w: 36, h: 40 },
  /** Os dois marcáveis da cena gerada são as próprias ações (a outra foto fica "fora"). */
  marcaveis: { "foto-1": { x: 2, y: 36, w: 42, h: 60 }, "foto-2": { x: 56, y: 36, w: 42, h: 60 } },
} as const satisfies { nucleos: Record<FotoId, Retangulo>; fundo: Retangulo; marcaveis: Record<FotoId, Retangulo> };

// ──────────────────────────────────────────── E5 e E6 — FIXAS em todo pacote

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

export const ROTULO_DO_VOTO: Readonly<Record<Voto, { rotulo: string; emoji: string }>> = {
  "so-um-pedaco": { rotulo: "SÓ UM PEDAÇO", emoji: "🌿" },
  "mostra-tudo": { rotulo: "MOSTRA TUDO", emoji: "💥" },
};

export const ROTULO_DO_MOTIVO: Readonly<Record<MotivoDoPar, string>> = {
  atividade: "A atividade",
  roupa: "A cor da roupa",
};

/** E6: a lagarta na alface. */
export const TRANSFERENCIA = { imagem: "fixas/lagarta.webp" } as const;

// ──────────────────────────────────────────── os textos da tela (literais do PO)

/**
 * Os textos da tela do estudante, LITERAIS do one-pager (CAIXA ALTA onde o PO
 * usa). `{espacoCurto}`, `{espaco}`, `{hora}` e `{cracha}` são preenchidos pela
 * tela. Descem em `GET /enigma-capa/sessao`.
 */
export const TEXTOS = {
  e1: {
    titulo: "ESCOLHA SEU CRACHÁ",
    bento: "BENTO PRECISA DE AJUDA!",
    card: "INVESTIGAR A NOVA CAPA",
  },
  e2: {
    rotuloDaFoto1: "FOTO 1 — {ESPACO} {hora}",
    rotuloDaFoto2: "FOTO 2 — {ESPACO} {hora}",
    alerta: "OLHE O FUNDO",
    inatividade: "VAMOS INVESTIGAR?",
  },
  e3: {
    titulo: "ESCOLHA 1 FOTO",
    arraste: "Arraste a foto",
    assinatura: "POSTAGEM DE: {cracha}",
    publicar: "PUBLICAR CAPA",
  },
  e4: {
    aguarde: "AGUARDE O PROFESSOR",
    professorJaVem: "O PROFESSOR JÁ VEM!",
    suaFoto: "SUA FOTO",
    outraFoto: "OUTRA FOTO",
    invariantes: "TOQUE EM 2 COISAS IGUAIS",
    bentoEntendeu: "AGORA EU ENTENDI!",
    bentoMesmoLugar: "ERA O MESMO LUGAR!",
    fora: "Marque n{espacoCurto} o que ficou fora da sua foto.",
    pronto: "Pronto",
  },
  e5: {
    pares: "Junte duas fotos da mesma atividade.",
    motivo: "O que é parecido?",
    segunda: "Foto de leitura: o que precisa aparecer?",
    arraste: "Arraste a foto",
    album: "Colocar no álbum",
  },
  e6: {
    cabecalho: "HORTA DA ESCOLA",
    pergunta: "A HORTA ACABOU?",
    enviada: "SELEÇÃO ENVIADA",
    fim: "MISSÃO CUMPRIDA!",
  },
  erros: {
    semSinal: "SEM SINAL NA RÁDIO",
    carregando: "CARREGANDO CAPA...",
    tentarDeNovo: "TENTAR DE NOVO",
  },
} as const;

/**
 * A frase do "o que ficou fora" com o espaço da cena. O PO escreveu "Marque na
 * biblioteca…" e "Marque no pátio…": o artigo vem do `espacoCurto` ("a
 * biblioteca" → "na biblioteca", "o museu" → "no museu").
 */
export function fraseDoFora(espacoCurto: string): string {
  const t = espacoCurto.trim();
  const m = /^(a|o|as|os)\s+(.+)$/i.exec(t);
  const lugar = m ? `${({ a: "na", o: "no", as: "nas", os: "nos" } as Record<string, string>)[m[1]!.toLowerCase()]} ${m[2]}` : `em ${t}`;
  return `Marque ${lugar} o que ficou fora da sua foto.`;
}

/** Os tempos da tela (o one-pager §4 e §7; o 45 s e os 3 min são o "[PARÂMETRO]" sugerido pelo PO). */
export const TEMPOS = {
  toqueLiberadoMs: 3000,
  inatividadeMs: 45_000,
  esperaDoProfessorMs: 180_000,
  pollingMs: 3000,
} as const;

// ──────────────────────────────────────────── o professor

/** O roteiro da conversa individual: a pausa (E4), as perguntas (§9a e §4 E5) e a ponte (E6). */
export const ROTEIRO = {
  introducao:
    "O Bento postou uma foto da biblioteca e os ouvintes entenderam tudo errado. Escolha seu crachá de repórter e investigue o mistério da capa!",
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
  ponte: "Quando alguém tira uma foto sua triste ou fazendo careta, você é daquele jeito o dia inteiro?",
  liberar: "Depois da conversa, toque em LIBERAR VIRADA: as telas da turma mostram a foto de cada um ao lado da outra foto.",
} as const;
