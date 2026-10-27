import type { ExperienciaHandle } from "@edu/sdk";

/**
 * Telemetria ANALÍTICA da missão — `verbo:objeto`, e nada além disso. O que a
 * evidência mede (a lupa, o selo, os invariantes, o "fora") é gravado pela api,
 * na rota de cada gesto: aqui ficam só os sinais de produto.
 *
 * Contrato: `track(verbo, objeto, { resultado?, contexto? })`, com OBJETOS de
 * número, booleano ou vocabulário fechado — string livre em `resultado`
 * derruba o lote inteiro. O que NUNCA sai daqui: o gabarito (se o selo é
 * coerente, se o toque acertou qual objeto), nome e e-mail (regra 6).
 */
let exp: ExperienciaHandle | null = null;

export function ligarTelemetria(handle: ExperienciaHandle) {
  exp = handle;
}

function track(verbo: string, objeto: string, dados?: { resultado?: Record<string, unknown>; contexto?: Record<string, unknown> }) {
  exp?.track(verbo, objeto, dados);
}

export const telemetria = {
  /** A primeira tela, depois do handshake. */
  entrou: (retomada: boolean) => track("attempted", "missao:iniciar", { resultado: { retomada } }),
  /** A entrada em cada passo (derivado do servidor). */
  etapa: (passo: string) => track("progressed", "etapa:entrar", { contexto: { passo } }),
  /** E2: um objeto do fundo achado com a lupa (o anel encheu) — nunca qual. */
  achouNaLupa: () => track("interacted", "lupa:achar"),
  /** E2: o avanço tentado sem o piso da lupa ("OLHE O FUNDO"). */
  alertaDaLupa: () => track("interacted", "lupa:alerta"),
  /** E2/E3: 45 s sem ação — o Bento aparece ("VAMOS INVESTIGAR?"). */
  inatividade: (passo: string) => track("interacted", "aviso:inatividade", { contexto: { passo } }),
  /** E3: o LATCH 1, do lado do produto (os ids são vocabulário fechado, não gabarito). */
  publicou: (fotoId: string) => track("interacted", "capa:publicar", { resultado: { fotoId } }),
  /** E4: um toque na busca dos invariantes — se a ajuda está acesa, nunca o que ele acertou. */
  tocouInvariante: (ajuda: boolean) => track("interacted", "invariante:tocar", { resultado: { ajuda } }),
  /** E4: a divisória dissolvida (a panorâmica revelada). */
  revelou: () => track("interacted", "panoramica:revelar"),
  /** E4: o "Pronto" do que ficou fora — só a QUANTIDADE de marcas. */
  marcouFora: (marcas: number) => track("interacted", "fora:marcar", { resultado: { marcas } }),
  /** E5: o par e a segunda foto (registrados, sem régua). */
  formouPar: () => track("interacted", "par:formar"),
  colocouNoAlbum: () => track("interacted", "album:colocar"),
  /** A faixa "SEM SINAL NA RÁDIO". */
  rede: () => track("attempted", "erro:exibir", { resultado: { codigo: "sem-sinal" } }),
  /** Uma imagem do pacote que não carregou ("CARREGANDO CAPA..."). */
  imagem: () => track("attempted", "erro:exibir", { resultado: { codigo: "imagem" } }),
  /** O "Colocar no álbum", que conclui a missão. */
  concluiu: () => track("completed", "missao:concluida"),
};
