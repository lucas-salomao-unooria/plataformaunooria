import { HttpException } from "@nestjs/common";
import type { AiProvider } from "../src/ai/provider";
import type { QuotaService } from "../src/ai/quota.service";
import type { AssetsService } from "../src/assets/assets.service";
import { noticiasPadrao } from "../src/jornal-escola/catalogo";
import {
  imagensProntasParaAula,
  midiaAprovada,
  noticiasQuePedemImagem,
  type JornalEscolaService,
  type PacoteLido,
} from "../src/jornal-escola/jornal-escola.service";
import { CUSTO_ESTIMADO_POR_IMAGEM, MidiaDaExp04ef1bService, nomeDaImagem } from "../src/jornal-escola/midia.service";
import type { IdDeNoticia } from "../src/jornal-escola/vocabulario";

/**
 * As imagens do Jornal da Escola que o professor vê e aprova (ADR-147) — SEM
 * banco: a regra do que chega à turma, o nome do arquivo regerado e o "Gerar
 * outra" com provider, bucket, quota e missão falsos. Molde:
 * `a-selecao-midia.spec.ts`. O que só o banco responde (a corrida das abas, a
 * condição no UPDATE) está em `jornal-escola-postgres.spec.ts`.
 */

const NOTICIAS = noticiasPadrao();
const COM_IMAGEM = noticiasQuePedemImagem(NOTICIAS)[0]!;
const SEM_IMAGEM = NOTICIAS.find((n) => n.descricaoImagem === null)!;

const url = (id: string, v = 1) => `https://cdn/${id}-v${v}.webp`;

function pacote(midia: Partial<Record<IdDeNoticia, string>>, aprovada: Partial<Record<IdDeNoticia, string>>): PacoteLido {
  return {
    id: "p1",
    escolaId: "escola",
    turmaId: "turma",
    disciplina: "d",
    tema: "t",
    topicos: null,
    origem: "padrao",
    noticias: NOTICIAS,
    midia,
    midiaAprovada: aprovada,
  };
}

const todas = (v = 1): Partial<Record<IdDeNoticia, string>> =>
  Object.fromEntries(noticiasQuePedemImagem(NOTICIAS).map((n) => [n.id, url(n.id, v)]));

describe("o que chega à turma", () => {
  test("só a imagem cuja URL atual é a aprovada", () => {
    const p = pacote({ ...todas(), [COM_IMAGEM.id]: url(COM_IMAGEM.id, 2) }, todas());
    const visivel = midiaAprovada(p);
    expect(visivel[COM_IMAGEM.id]).toBeUndefined();
    expect(Object.keys(visivel)).toHaveLength(noticiasQuePedemImagem(NOTICIAS).length - 1);
  });

  test("aprovação de notícia sem imagem gerada não inventa imagem", () => {
    expect(midiaAprovada(pacote({}, todas()))).toEqual({});
  });

  test("vai ao ar só com TODAS as que pedem imagem geradas e aprovadas", () => {
    expect(imagensProntasParaAula(pacote({}, {}))).toBe(false);
    expect(imagensProntasParaAula(pacote(todas(), {}))).toBe(false);
    expect(imagensProntasParaAula(pacote(todas(2), todas()))).toBe(false);
    expect(imagensProntasParaAula(pacote(todas(), todas()))).toBe(true);
  });
});

function montar({ saldo = true, falha = false } = {}) {
  const salvos: string[] = [];
  const registradas: Array<[IdDeNoticia, string]> = [];
  let consumido = 0;
  let geradas = 0;
  const ia = {
    generateImage: async () => {
      geradas += 1;
      if (falha) throw new Error("provedor fora");
      return Buffer.from("imagem");
    },
  } as unknown as AiProvider;
  const assets = {
    salvarMidiaDeExperiencia: async ({ nome }: { nome: string }) => {
      salvos.push(nome);
      return `https://cdn/${nome}`;
    },
  } as unknown as AssetsService;
  const quota = {
    temSaldo: async () => saldo,
    consumir: async (_e: string, _u: string, tokens: number) => {
      consumido += tokens;
    },
  } as unknown as QuotaService;
  const jornal = {
    pacoteParaMidia: async () => pacote(todas(), todas()),
    registrarMidia: async (_e: string, _p: string, noticia: IdDeNoticia, u: string) => {
      registradas.push([noticia, u]);
    },
  } as unknown as JornalEscolaService;
  const servico = new MidiaDaExp04ef1bService(ia, assets, quota, jornal);
  const regerar = (noticiaId: IdDeNoticia) => servico.regerar("escola", "turma", "prof", "prof", "professor", "p1", noticiaId);
  return { regerar, salvos, registradas, estado: () => ({ consumido, geradas }) };
}

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (erro) {
    return ((erro as HttpException).getResponse() as { codigo?: string }).codigo;
  }
}

describe("o nome do arquivo da imagem", () => {
  test("sem sal é o da descrição (a herança entre pacotes depende disso)", () => {
    expect(nomeDaImagem("Uma feira")).toBe(nomeDaImagem("  Uma feira "));
  });
  test("a regerada é OUTRO arquivo: a recusada não volta do bucket", () => {
    expect(nomeDaImagem("Uma feira", "a")).not.toBe(nomeDaImagem("Uma feira"));
    expect(nomeDaImagem("Uma feira", "a")).not.toBe(nomeDaImagem("Uma feira", "b"));
  });
});

describe('"Gerar outra"', () => {
  test("gera, grava num arquivo novo, debita a quota e registra na notícia", async () => {
    const m = montar();
    const r = await m.regerar(COM_IMAGEM.id);
    expect(r).toMatchObject({ pacoteId: "p1", noticiaId: COM_IMAGEM.id });
    expect(m.salvos).toHaveLength(1);
    expect(m.salvos[0]).not.toBe(nomeDaImagem(COM_IMAGEM.descricaoImagem ?? ""));
    expect(m.registradas).toEqual([[COM_IMAGEM.id, r.url]]);
    expect(m.estado().consumido).toBe(CUSTO_ESTIMADO_POR_IMAGEM);
  });

  test("dois cliques na mesma notícia pagam UMA imagem", async () => {
    const m = montar();
    const [a, b] = await Promise.all([m.regerar(COM_IMAGEM.id), m.regerar(COM_IMAGEM.id)]);
    expect(a).toEqual(b);
    expect(m.estado().geradas).toBe(1);
  });

  test("notícia sem imagem é 400; sem saldo é 429; o provedor fora é 503 e nada muda", async () => {
    expect(await codigoDe(montar().regerar(SEM_IMAGEM.id))).toBe("noticia-sem-imagem");
    const semSaldo = montar({ saldo: false });
    expect(await codigoDe(semSaldo.regerar(COM_IMAGEM.id))).toBe("sem-saldo-de-ia");
    expect(semSaldo.estado().geradas).toBe(0);
    const fora = montar({ falha: true });
    expect(await codigoDe(fora.regerar(COM_IMAGEM.id))).toBe("ia-indisponivel");
    expect(fora.registradas).toEqual([]);
    expect(fora.estado().consumido).toBe(0);
  });
});
