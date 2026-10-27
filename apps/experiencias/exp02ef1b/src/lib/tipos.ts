/**
 * O contrato desta experiência como o cliente o vê — ESPELHO do que a tela
 * precisa de `apps/api/src/enigma-capa/contrato-de-rotas.ts` (`EstadoSchema`,
 * `SessaoSchema`, `GateDoEstudanteSchema`, `RespostaDaLupaSchema`,
 * `RespostaDoPublicarSchema`, `RespostaDoToqueSchema`). A experiência não
 * importa de `apps/api`: mudou lá, muda aqui (e o typecheck não vê).
 *
 * O gabarito não está aqui porque NÃO desce (regra 3): a cena vem sem
 * `nucleo`, sem `visitante`, sem `seloCoerente`, sem os alvos dos invariantes
 * (exceto depois da AJUDA, para o pulso) e sem os `marcaveis`; as cartas da E5
 * vêm só com id e imagem. `src/contrato.test.ts` prende isso.
 */

export const EXP_ID = "exp02ef1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json` (`versao.test.ts` compara os três — ADR-84).
 */
export const EXP_VERSION = "2.1.0";

export type Passo =
  | "inicio"
  | "lupa"
  | "decidir"
  | "feed"
  | "invariantes"
  | "slider"
  | "fora"
  | "pares"
  | "segunda-foto"
  | "concluida";

export type Fase = "aberta" | "virada";
export type FotoId = "foto-1" | "foto-2";
export type SeloId = "selo-1" | "selo-2";
export type InvarianteId = "inv-1" | "inv-2";
export type Motivo = "atividade" | "roupa";
export type Elemento = "mochila" | "parede" | "crianca-lendo";
export type ChaveDeCena = "biblioteca" | "horta" | "museu" | "ia";
/** `"inv-1:foto-1"` — um invariante achado numa foto. */
export type Achado = `${InvarianteId}:${FotoId}`;

/** Retângulo em 0–100 da imagem (na panorâmica: x em % da largura, y em % da altura). */
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
/** A fração da folga da moldura: `{0,0}` = canto superior esquerdo, `{1,1}` = inferior direito. */
export interface Deslocamento {
  x: number;
  y: number;
}
/** A moldura como FRAÇÃO do recorte (`w: 0.8` = 80% da largura da foto). */
export interface Moldura {
  w: number;
  h: number;
}
export interface Alvo {
  id: InvarianteId;
  x: number;
  y: number;
  r: number;
}

export type Imagem = { tipo: "bundle"; nome: string } | { tipo: "url"; url: string };

export interface Atividade {
  pacoteId: string;
  rodada: number;
}

export interface Estado {
  passo: Passo;
  fase: Fase | null;
  preparada: boolean;
  aguardandoVirada: boolean;
  atividade: Atividade | null;
  lupa: {
    alvo1Ms: number;
    alvo2Ms: number;
    alertas: number;
    liberada: boolean;
    /** Os dois objetos do fundo, SÓ no passo `lupa`: o brilho da lente precisa do lugar (ADR-186). */
    alvos: Alvo[] | null;
  } | null;
  capa: {
    fotoId: FotoId;
    outraFotoId: FotoId;
    seloId: SeloId;
    deslocamento: Deslocamento;
    visivel: Retangulo;
    visitante: string;
    publicadaEm: string;
  } | null;
  invariantes: {
    encontrados: Achado[];
    erros: number;
    ajuda: boolean;
    alvos: Alvo[] | null;
    /** O alvo dos já achados (deixou de ser gabarito): redesenha os círculos depois de um F5. */
    achados: Alvo[];
    completo: boolean;
  } | null;
  panoramicaAberta: boolean;
  fora: { toques: Ponto[] } | null;
  pares: { cartas: string[]; motivo: Motivo } | null;
  segundaFoto: { elemento: Elemento; deslocamento: Deslocamento } | null;
  concluido: boolean;
}

export interface Cena {
  chave: ChaveDeCena;
  espaco: string;
  espacoCurto: string;
  hora: string;
  imagem: Imagem;
  alt: string;
  fotos: { id: FotoId; recorte: Retangulo; acao: string }[];
  selos: { id: SeloId; texto: string; emoji: string }[];
  invariantes: { id: InvarianteId; nome: string }[];
  fundo: Retangulo;
}

export interface Geometria {
  proporcaoDaPanoramica: number;
  recortes: Record<FotoId, Retangulo>;
  faixaComum: { de: number; ate: number };
  molduraDaCapa: Moldura;
  segundaFoto: { proporcao: number; moldura: Moldura };
  pisoDaLupaMs: number;
  toquesForaMax: number;
}

export interface Material {
  cartas: { id: string; imagem: Imagem }[];
  motivos: { id: Motivo; rotulo: string }[];
  segundaFoto: { imagem: Imagem; elementos: { id: Elemento; rotulo: string }[] };
}

export interface Tempos {
  toqueLiberadoMs: number;
  inatividadeMs: number;
  esperaDoProfessorMs: number;
  pollingMs: number;
}

export interface Sessao extends Estado {
  cena: Cena | null;
  geometria: Geometria;
  material: Material;
  textos: Record<string, Record<string, string>>;
  tempos: Tempos;
}

export interface Gate {
  preparada: boolean;
  fase: Fase | null;
  rodada: number | null;
  atividade: Atividade | null;
  passo: Passo;
  agora: string;
}

export interface RespostaDaLupa extends Estado {
  liberado: boolean;
  alerta: boolean;
}

export interface RespostaDoPublicar extends Estado {
  visitante: string;
}

export interface RespostaDoToque extends Estado {
  toque: {
    acerto: InvarianteId | null;
    encontrados: Achado[];
    erros: number;
    ajuda: boolean;
    alvos?: Alvo[];
    achados: Alvo[];
    completo: boolean;
  };
}

/** Os ms com o centro da lente sobre cada objeto do fundo (`inv-1`, `inv-2`), em qualquer das duas fotos. */
export interface RelatoDaLupa {
  alvo1Ms: number;
  alvo2Ms: number;
}
