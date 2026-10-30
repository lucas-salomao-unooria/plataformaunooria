/**
 * O contrato desta experiência como o cliente o vê — espelho do que a TELA
 * precisa de `apps/api/src/porta-voz-dos-dados/contrato-de-rotas.ts`
 * (`SessaoSchema` e as entradas `PublicarSchema`, `ParecerSchema`,
 * `MarcoSchema`). TODA rota do estudante devolve a mesma `Sessao`.
 *
 * O gabarito da perícia NÃO está aqui porque não desce (regra 3): os cartões
 * chegam como peças (título, partido, eixo, fonte), e a resposta ao parecer
 * não diz se acertou.
 */

export const EXP_ID = "exp03em1b";

/**
 * A versão vive em TRÊS lugares: aqui, no `package.json` e no
 * `public/experiencia.json` (`versao.test.ts`). A 1.0.0 é a primeira (ADR-198).
 */
export const EXP_VERSION = "1.1.1";

/** O passo é DERIVADO no servidor (`regras/passos.ts` da api). */
export type Passo = "abertura" | "dados" | "compositor" | "feed" | "errata" | "laudo" | "pericia" | "concluida";
export type EtapaDoGate = "exploracao" | "pausa" | "liberada";
export type Escala = 0 | 80;
export type Motivo = "escala" | "fonte" | "titulo";
export type Marco = "chat_aberto" | "anexo_aberto" | "nudge_e2" | "compositor_aberto" | "pericia_aberta";
export type IdDoCartao = "A" | "B";

/** As quatro camadas do compositor; a ordem em que aparecem vem do servidor (`conteudo.camadas.ordem`). */
export type Camada = "explicacao" | "fonte" | "contexto" | "projecao";

/** O corpo do publicar (1ª e errata): a escala e as quatro camadas. */
export interface Publicar {
  escala: Escala;
  explicacao: boolean;
  fonte: boolean;
  contexto: boolean;
  projecao: boolean;
}

export interface Publicacao extends Publicar {
  publicadaEm: string;
}

/** O corpo do parecer: sinalizou ⇒ motivo; não sinalizou ⇒ `null`. */
export interface Parecer {
  sinalizouA: boolean;
  motivoA: Motivo | null;
  sinalizouB: boolean;
  motivoB: Motivo | null;
}

export interface Fala {
  autor: string;
  perfil: string;
  texto: string;
}

export interface Cartao {
  id: IdDoCartao;
  titulo: string;
  partido: string;
  tituloDoGrafico: string;
  eixo: { origem: number; teto: number };
  fonte: string;
}

export interface PontoDaSerie {
  periodo: string;
  valor: number;
  coletadas: number;
  conformes: number;
  inconformes: number;
  situacao: string;
}

export interface Sessao {
  preparada: boolean;
  atividade: { pacoteId: string; rodada: number } | null;
  etapaDaTurma: EtapaDoGate | null;
  passo: Passo;
  pausada: boolean;
  slotsRestantes: number;
  marcos: {
    chatAberto: boolean;
    anexoAberto: boolean;
    nudgeE2: boolean;
    compositorAberto: boolean;
    periciaAberta: boolean;
  };
  publicacoes: { inicial: Publicacao | null; errata: Publicacao | null; errataPulada: boolean };
  errataLiberada: boolean;
  feed: {
    reacoes: Fala[];
    rival: { escola: string; escala: Escala; chip: string };
    conflito: Fala;
    coordenador: Fala;
  } | null;
  pericia: (Parecer & { pulou: boolean; decididaEm: string }) | null;
  concluido: boolean;
  conteudo: {
    grupo: { nome: string; recorte: string };
    servico: {
      orgao: string;
      indicador: string;
      unidade: string;
      abrangencia: string;
      periodicidade: string;
      serie: PontoDaSerie[];
    };
    notaTecnica: {
      arquivo: string;
      titulo: string;
      orgao: string;
      resumo: string;
      secoes: { titulo: string; texto: string }[];
    };
    camadas: {
      explicacao: { zero: string; oitenta: string };
      fonte: string;
      contexto: string;
      projecao: string;
      ordem: Camada[];
    };
  } | null;
  textos: {
    chat: {
      bot: string;
      previaDoBot: string;
      statusDoGrupo: string;
      posse: string;
      iniciar: string;
      nudgeE1: string;
      introDaTabela: string;
      perguntaDaPrevia: string;
      nudgeE2SemPrevias: string;
      nudgeE2: string;
      nudgeE2ComPrevia: string;
      escalas: { zero: string; oitenta: string };
      errata: string;
      publicarErrata: string;
      pularErrata: string;
      cotaEsgotada: string;
      foraDoTema: string;
      pausa: string;
    };
    laudo: {
      titulo: string;
      desmontagem: string;
      fatorDeMentira: string;
      fator: string;
      variacaoVisual: string;
      variacaoReal: string;
      quedaEmPontos: number;
      alturas: { origem0: { primeiro: number; ultimo: number }; origem80: { primeiro: number; ultimo: number } };
      regua: { instrucao: string; minimo: string; maximo: string };
      acao: string;
    };
    pericia: {
      canal: string;
      chamado: string;
      dados: {
        titulo: string;
        origem: string;
        indicador: string;
        periodos: { rotulo: string; ocorrencias: number; populacao: string; taxa: number }[];
      };
      cartoes: Cartao[];
      sinalizar: string;
      motivoTitulo: string;
      motivos: Record<Motivo, string>;
      emitir: string;
      pular: string;
    };
    conclusao: { selo: string; somenteLeitura: string };
  };
}

/** A sessão com o pacote no ar — o que toda tela depois da abertura recebe. */
export type SessaoPreparada = Sessao & { conteudo: NonNullable<Sessao["conteudo"]> };
