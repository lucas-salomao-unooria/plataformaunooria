import { z } from "zod";
import { NOTICIAS_PADRAO } from "../catalogo";
import {
  MateriaDaSimulacaoSchema,
  NoticiaDoPacoteSchema,
  type MateriaDaSimulacao,
  type NoticiaDoPacote,
} from "../contrato-de-rotas";
import {
  MEIOS_COM_IMAGEM_OBRIGATORIA,
  MEIOS_DA_SIMULACAO,
  normalizarParaRegua,
  problemasDaMateriaDaSimulacao,
  problemasDaNoticia,
  problemasDaSimulacao,
  problemasDoPacote,
} from "../invariantes";
import {
  IDS_DE_NOTICIA,
  IDS_DE_SIMULACAO,
  MEIOS,
  MEIOS_DIGITAIS,
  MEIOS_TRADICIONAIS,
  TIPOS_DE_PISTA,
  type IdDeNoticia,
  type IdDeSimulacao,
  type Meio,
  type PilarEmFalta,
} from "../vocabulario";

/**
 * O MOLDE do pacote gerado por IA — e a conferência do que ela devolve. Puro.
 *
 * Um modelo de linguagem conta mal: pedir "8 notícias, de 3 a 4 publicáveis,
 * 2 ou 3 antigas, e nenhum meio carregando a resposta" devolve, com
 * frequência, o conjunto que a régua recusa. Então a ESTRUTURA não é pedida,
 * é DADA: o servidor sorteia o molde (que id é de que meio, e que papel tem no
 * gabarito), a IA escreve o conteúdo de cada vaga, e o `validar` do
 * `generateJson` recusa a saída que mexeu no molde ou fere `invariantes.ts` —
 * lançar aqui faz a tentativa ser regerada.
 *
 * O molde é SORTEADO a cada geração, e não fixo, porque os ids são a posição
 * na mesa: com o papel amarrado à posição, a turma que já jogou um pacote
 * saberia que "a n2 é a antiga" em todos os outros.
 */

/** O papel de uma notícia no gabarito. `sem-*` = aviso sem confirmação. */
export const PAPEIS = ["publicavel", "antiga", "sem-fonte", "sem-autoria"] as const;
export type Papel = (typeof PAPEIS)[number];

export interface VagaDoMolde {
  id: IdDeNoticia;
  meio: Meio;
  papel: Papel;
  /** A notícia tem imagem (`descricaoImagem` não nula). */
  comImagem: boolean;
  /** A notícia tem falante: o locutor do rádio, a repórter da TV, quem mandou a mensagem. */
  comFalante: boolean;
}

export function papelDe(g: { publicavel: boolean; pilarEmFalta: PilarEmFalta | null }): Papel {
  if (g.publicavel) return "publicavel";
  if (g.pilarEmFalta === "data") return "antiga";
  return g.pilarEmFalta === "autoria" ? "sem-autoria" : "sem-fonte";
}

export function gabaritoDoPapel(papel: Papel): { publicavel: boolean; pilarEmFalta: PilarEmFalta | null } {
  if (papel === "publicavel") return { publicavel: true, pilarEmFalta: null };
  if (papel === "antiga") return { publicavel: false, pilarEmFalta: "data" };
  return { publicavel: false, pilarEmFalta: papel === "sem-autoria" ? "autoria" : "fonte" };
}

/** As composições que `invariantes.ts#COMPOSICAO` aceita: [publicáveis, antigas, sem confirmação]. */
const COMPOSICOES: ReadonlyArray<readonly [number, number, number]> = [
  [4, 2, 2],
  [3, 3, 2],
  [3, 2, 3],
];

/** Os meios com falante obrigatório ou natural. */
const MEIOS_COM_FALANTE: readonly Meio[] = ["radio", "tv", "mensagem"];

function embaralhar<T>(itens: readonly T[], aleatorio: () => number): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}

function misturaMeios(meios: readonly Meio[]): boolean {
  return meios.some((m) => MEIOS_TRADICIONAIS.includes(m)) && meios.some((m) => MEIOS_DIGITAIS.includes(m));
}

/** O molde passa na composição do PDF §3 — o mesmo que `problemasDoPacote` cobra. */
export function moldeValido(molde: readonly VagaDoMolde[]): boolean {
  if (molde.length !== IDS_DE_NOTICIA.length) return false;
  if (molde.map((v) => v.id).join(",") !== IDS_DE_NOTICIA.join(",")) return false;
  if (new Set(molde.map((v) => v.meio)).size !== MEIOS.length) return false;
  const pub = molde.filter((v) => v.papel === "publicavel");
  const nao = molde.filter((v) => v.papel !== "publicavel");
  const antigas = nao.filter((v) => v.papel === "antiga").length;
  if (pub.length < 3 || antigas < 2 || antigas > 3 || nao.length - antigas < 2 || nao.length - antigas > 3) return false;
  if (!misturaMeios(pub.map((v) => v.meio)) || !misturaMeios(nao.map((v) => v.meio))) return false;
  if (molde.filter((v) => v.comImagem).length < 4) return false;
  if (!pub.some((v) => v.comImagem) || !nao.some((v) => v.comImagem)) return false;
  if (molde.some((v) => MEIOS_COM_IMAGEM_OBRIGATORIA.includes(v.meio) && !v.comImagem)) return false;
  if (molde.some((v) => v.meio === "radio" && !v.comFalante)) return false;
  return true;
}

/**
 * Sorteia um molde que passa na composição. Amostragem com rejeição: a
 * aritmética fecha na maioria dos sorteios, e o teto de 200 existe só contra
 * um gerador quebrado — o molde do banco padrão é a rede.
 */
export function sortearMolde(aleatorio: () => number = Math.random): VagaDoMolde[] {
  for (let tentativa = 0; tentativa < 200; tentativa++) {
    const [p, a, s] = COMPOSICOES[Math.floor(aleatorio() * COMPOSICOES.length)] ?? [4, 2, 2];
    const semConfirmacao: Papel[] = Array.from({ length: s }, (_, i) =>
      i === 0 ? "sem-fonte" : i === 1 ? "sem-autoria" : aleatorio() < 0.5 ? "sem-fonte" : "sem-autoria",
    );
    const papeis: Papel[] = embaralhar(
      [...Array<Papel>(p).fill("publicavel"), ...Array<Papel>(a).fill("antiga"), ...semConfirmacao],
      aleatorio,
    );
    const meios = embaralhar(MEIOS, aleatorio);
    const extras = new Set(embaralhar(MEIOS, aleatorio).slice(0, 3));
    const molde: VagaDoMolde[] = IDS_DE_NOTICIA.map((id, i) => {
      const meio = meios[i] as Meio;
      return {
        id,
        meio,
        papel: papeis[i] as Papel,
        comImagem: MEIOS_COM_IMAGEM_OBRIGATORIA.includes(meio) || (meio !== "mensagem" && extras.has(meio)),
        comFalante: MEIOS_COM_FALANTE.includes(meio),
      };
    });
    if (moldeValido(molde)) return molde;
  }
  return moldeDoPacote(NOTICIAS_PADRAO);
}

/** O molde de um pacote que já existe — o do banco padrão, ou o da regeneração de uma notícia. */
export function moldeDoPacote(noticias: readonly NoticiaDoPacote[]): VagaDoMolde[] {
  return noticias.map((n) => ({
    id: n.id,
    meio: n.meio,
    papel: papelDe(n.gabarito),
    comImagem: n.descricaoImagem !== null,
    comFalante: n.falante !== null,
  }));
}

// ──────────────────────────────────────────────── a notícia como a IA a devolve

/**
 * A notícia na forma que a IA devolve — PLANA, porque modelo erra aninhamento
 * mais do que erra nome de campo, e com `""` no lugar de nulo (o schema neutro
 * de `ai/provider.ts` não tem `nullable`). A conversão para a interna é
 * `noticiaDaIa`.
 */
export const NoticiaDaIaSchema = z.object({
  id: z.enum(IDS_DE_NOTICIA),
  meio: z.enum(MEIOS),
  veiculo: z.string(),
  falante: z.string(),
  manchete: z.string(),
  resumo: z.string(),
  corpo: z.string(),
  legenda: z.string(),
  descricao_imagem: z.string(),
  pista_fonte: z.string(),
  pista_data: z.string(),
  pista_autoria: z.string(),
  publicavel: z.boolean(),
  pilar_em_falta: z.enum([...TIPOS_DE_PISTA, "nenhum"]),
  explicacao: z.string(),
  leitor: z.string(),
  fala_do_leitor: z.string(),
});
export type NoticiaDaIa = z.infer<typeof NoticiaDaIaSchema>;

const ouNulo = (texto: string): string | null => (texto.trim() ? texto.trim() : null);

/**
 * Converte UMA notícia da IA e a confere contra a vaga do molde: o id, o meio
 * e o papel são da vaga (a IA não os escolhe), a imagem e o falante também, e
 * o texto passa pela régua de `invariantes.ts`. Lança com a lista de problemas.
 */
export function noticiaDaIa(bruto: unknown, vaga: VagaDoMolde): NoticiaDoPacote {
  const n = NoticiaDaIaSchema.parse(bruto);
  const problemas: string[] = [];
  if (n.id !== vaga.id || n.meio !== vaga.meio) problemas.push(`A notícia ${vaga.id} mudou de id ou de meio.`);

  const g = gabaritoDoPapel(vaga.papel);
  const pilar = n.pilar_em_falta === "nenhum" ? null : n.pilar_em_falta;
  if (n.publicavel !== g.publicavel || pilar !== g.pilarEmFalta) {
    problemas.push(`A notícia ${vaga.id} mudou de papel no gabarito.`);
  }
  const descricaoImagem = ouNulo(n.descricao_imagem);
  if ((descricaoImagem !== null) !== vaga.comImagem) problemas.push(`A notícia ${vaga.id} mudou a presença da imagem.`);
  const falante = ouNulo(n.falante);
  if (vaga.comFalante && falante === null) problemas.push(`A notícia ${vaga.id} precisa de falante.`);

  const convertida = {
    id: vaga.id,
    meio: vaga.meio,
    veiculo: n.veiculo.trim(),
    falante: vaga.comFalante ? falante : null,
    manchete: n.manchete.trim(),
    resumo: n.resumo.trim(),
    corpo: n.corpo.trim(),
    legenda: descricaoImagem === null ? null : ouNulo(n.legenda),
    descricaoImagem,
    pistas: { fonte: n.pista_fonte.trim(), data: n.pista_data.trim(), autoria: n.pista_autoria.trim() },
    gabarito: { ...g, explicacao: n.explicacao.trim() },
    consequencia: { leitor: n.leitor.trim(), fala: n.fala_do_leitor.trim() },
  };
  const tetos = NoticiaDoPacoteSchema.safeParse(convertida);
  if (!tetos.success) problemas.push(`A notícia ${vaga.id} passou dos limites de tamanho.`);
  problemas.push(...problemasDaNoticia(convertida));
  if (problemas.length > 0) throw new Error(problemas.join(" "));
  return tetos.success ? tetos.data : (convertida as NoticiaDoPacote);
}

export const PacoteDaIaSchema = z.object({ noticias: z.array(z.unknown()).length(IDS_DE_NOTICIA.length) });

/** O pacote inteiro da IA, contra o molde e a régua do conjunto. Lançar = regerar. */
export function pacoteDaIa(bruto: unknown, molde: readonly VagaDoMolde[]): NoticiaDoPacote[] {
  const { noticias } = PacoteDaIaSchema.parse(bruto);
  const problemas: string[] = [];
  const convertidas: NoticiaDoPacote[] = [];
  noticias.forEach((n, i) => {
    const vaga = molde[i];
    if (!vaga) return;
    try {
      convertidas.push(noticiaDaIa(n, vaga));
    } catch (erro) {
      problemas.push(erro instanceof Error ? erro.message : `A notícia ${vaga.id} veio fora do formato.`);
    }
  });
  if (problemas.length === 0) problemas.push(...problemasDoPacote(convertidas));
  if (problemas.length > 0) throw new Error(problemas.join(" "));
  return convertidas;
}

/**
 * A notícia regenerada no lugar de uma do pacote (E0-PROF-04): a mesma vaga
 * (id, meio, papel, imagem) e uma manchete que não repete a de outra notícia.
 * O resto do pacote não é conferido aqui — a professora pode estar no meio de
 * uma edição, e a régua do conjunto é da homologação.
 */
export function noticiaRegeneradaDaIa(
  bruto: unknown,
  vaga: VagaDoMolde,
  outras: readonly { id: string; manchete: string }[],
): NoticiaDoPacote {
  const n = noticiaDaIa(bruto, vaga);
  const manchetes = new Set(outras.filter((o) => o.id !== vaga.id).map((o) => normalizarParaRegua(o.manchete)));
  if (manchetes.has(normalizarParaRegua(n.manchete))) throw new Error(`A notícia ${vaga.id} repete a manchete de outra.`);
  return n;
}

/**
 * A vaga da regeneração, a partir do que a tela manda da notícia que sai (o
 * `NoticiaDeContextoSchema`: id, meio e papel, sem o texto). A imagem vai em
 * todo meio menos a mensagem: acrescentar imagem nunca fere a composição
 * (pelo menos 4, e dos dois lados do gabarito), e tirar poderia.
 */
export function vagaDoContexto(ctx: {
  id: IdDeNoticia;
  meio: Meio;
  gabarito: { publicavel: boolean; pilarEmFalta: PilarEmFalta | null };
}): VagaDoMolde {
  return {
    id: ctx.id,
    meio: ctx.meio,
    papel: papelDe(ctx.gabarito),
    comImagem: ctx.meio !== "mensagem",
    comFalante: MEIOS_COM_FALANTE.includes(ctx.meio),
  };
}

/** A notícia interna no formato da IA — o inverso de `noticiaDaIa` (o teste e o prompt usam). */
export function emFormatoDaIa(n: NoticiaDoPacote): NoticiaDaIa {
  return {
    id: n.id,
    meio: n.meio,
    veiculo: n.veiculo,
    falante: n.falante ?? "",
    manchete: n.manchete,
    resumo: n.resumo,
    corpo: n.corpo,
    legenda: n.legenda ?? "",
    descricao_imagem: n.descricaoImagem ?? "",
    pista_fonte: n.pistas.fonte,
    pista_data: n.pistas.data,
    pista_autoria: n.pistas.autoria,
    publicavel: n.gabarito.publicavel,
    pilar_em_falta: n.gabarito.pilarEmFalta ?? "nenhum",
    explicacao: n.gabarito.explicacao,
    leitor: n.consequencia.leitor,
    fala_do_leitor: n.consequencia.fala,
  };
}

// ───────────────────────────────────────────── a simulação (3.0.0, ADR-168)

/** A vaga de uma matéria da simulação: o id, o meio (sem imagem) e o papel. */
export interface VagaDaSimulacao {
  id: IdDeSimulacao;
  meio: Meio;
  papel: Papel;
}

/**
 * O molde das duas matérias da simulação: uma publicável e uma com UM furo,
 * em meios diferentes dos que existem sem imagem. Qual das duas é a
 * publicável e qual pista falta na outra são SORTEADOS — fixo, a turma
 * saberia que "a segunda é a ruim".
 */
export function sortearMoldeDaSimulacao(aleatorio: () => number = Math.random): VagaDaSimulacao[] {
  const [m1, m2] = embaralhar(MEIOS_DA_SIMULACAO, aleatorio) as [Meio, Meio];
  const furos: readonly Papel[] = ["antiga", "sem-fonte", "sem-autoria"];
  const furo = furos[Math.floor(aleatorio() * furos.length)] ?? "sem-autoria";
  const primeiraPublica = aleatorio() < 0.5;
  return [
    { id: "s1", meio: m1, papel: primeiraPublica ? "publicavel" : furo },
    { id: "s2", meio: m2, papel: primeiraPublica ? furo : "publicavel" },
  ];
}

/** A matéria da simulação como a IA a devolve — plana, como a notícia. */
export const MateriaDaIaSchema = z.object({
  id: z.enum(IDS_DE_SIMULACAO),
  meio: z.enum(MEIOS),
  veiculo: z.string(),
  manchete: z.string(),
  resumo: z.string(),
  pista_fonte: z.string(),
  pista_data: z.string(),
  pista_autoria: z.string(),
  publicavel: z.boolean(),
  pilar_em_falta: z.enum([...TIPOS_DE_PISTA, "nenhum"]),
  explicacao: z.string(),
});

/** Converte UMA matéria da simulação e a confere contra a vaga. Lança com os problemas. */
export function materiaDaIa(bruto: unknown, vaga: VagaDaSimulacao): MateriaDaSimulacao {
  const m = MateriaDaIaSchema.parse(bruto);
  const problemas: string[] = [];
  if (m.id !== vaga.id || m.meio !== vaga.meio) problemas.push(`A matéria ${vaga.id} da simulação mudou de id ou de meio.`);
  const g = gabaritoDoPapel(vaga.papel);
  const pilar = m.pilar_em_falta === "nenhum" ? null : m.pilar_em_falta;
  if (m.publicavel !== g.publicavel || pilar !== g.pilarEmFalta) {
    problemas.push(`A matéria ${vaga.id} da simulação mudou de papel no gabarito.`);
  }
  const convertida = {
    id: vaga.id,
    meio: vaga.meio,
    veiculo: m.veiculo.trim(),
    falante: null,
    manchete: m.manchete.trim(),
    resumo: m.resumo.trim(),
    pistas: { fonte: m.pista_fonte.trim(), data: m.pista_data.trim(), autoria: m.pista_autoria.trim() },
    gabarito: { ...g, explicacao: m.explicacao.trim() },
  };
  const tetos = MateriaDaSimulacaoSchema.safeParse(convertida);
  if (!tetos.success) problemas.push(`A matéria ${vaga.id} da simulação passou dos limites de tamanho.`);
  problemas.push(...problemasDaMateriaDaSimulacao(convertida));
  if (problemas.length > 0) throw new Error(problemas.join(" "));
  return tetos.success ? tetos.data : (convertida as MateriaDaSimulacao);
}

const PreparoDaIaSchema = z.object({
  noticias: z.array(z.unknown()).length(IDS_DE_NOTICIA.length),
  simulacao: z.array(z.unknown()).length(IDS_DE_SIMULACAO.length),
});

/**
 * O preparo inteiro da IA (3.0.0): as oito notícias contra o molde e a régua do
 * conjunto, e as duas matérias da simulação contra o molde delas. Lançar = regerar.
 */
export function preparoDaIa(
  bruto: unknown,
  molde: readonly VagaDoMolde[],
  moldeDaSimulacao: readonly VagaDaSimulacao[],
): { noticias: NoticiaDoPacote[]; simulacao: MateriaDaSimulacao[] } {
  const corpo = PreparoDaIaSchema.parse(bruto);
  const problemas: string[] = [];
  let noticias: NoticiaDoPacote[] = [];
  try {
    noticias = pacoteDaIa({ noticias: corpo.noticias }, molde);
  } catch (erro) {
    problemas.push(erro instanceof Error ? erro.message : "As notícias vieram fora do formato.");
  }
  const simulacao: MateriaDaSimulacao[] = [];
  corpo.simulacao.forEach((m, i) => {
    const vaga = moldeDaSimulacao[i];
    if (!vaga) return;
    try {
      simulacao.push(materiaDaIa(m, vaga));
    } catch (erro) {
      problemas.push(erro instanceof Error ? erro.message : `A matéria ${vaga.id} da simulação veio fora do formato.`);
    }
  });
  if (problemas.length === 0) problemas.push(...problemasDaSimulacao(simulacao));
  if (problemas.length > 0) throw new Error(problemas.join(" "));
  return { noticias, simulacao };
}
