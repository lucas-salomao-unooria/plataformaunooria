import { HttpException } from "@nestjs/common";
import type { AiProvider } from "../src/ai/provider";
import type { QuotaService } from "../src/ai/quota.service";
import type { AssetsService } from "../src/assets/assets.service";
import type { ASelecaoService } from "../src/a-selecao/a-selecao.service";
import { POSTS_PADRAO, type IdDePost } from "../src/a-selecao/catalogo";
import { CUSTO_ESTIMADO_POR_IMAGEM, MidiaDaExp07ef1bService, nomeDaImagem } from "../src/a-selecao/midia.service";

/**
 * "GERAR OUTRA IMAGEM" da exp07ef1b (ADR-146) — SEM banco: o nome do arquivo
 * regerado e o serviço com provider, bucket, quota e missão falsos.
 */

const POST_COM_IMAGEM = POSTS_PADRAO.find((p) => !p.grafico)!;
const POST_DE_GRAFICO = POSTS_PADRAO.find((p) => p.grafico)!;

function montar({ saldo = true, aprovada = false } = {}) {
  const salvos: string[] = [];
  const registradas: Array<[IdDePost, string]> = [];
  let consumido = 0;
  let geradas = 0;
  const ia = {
    generateImage: async () => {
      geradas += 1;
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
  const selecao = {
    coberturaEmValidacao: async () => {
      if (aprovada) throw new HttpException({ codigo: "imagens-ja-aprovadas" }, 409);
      return { id: "c1", tema: "t", foco: null, origem: "padrao", posts: POSTS_PADRAO, midia: {}, podcast: null };
    },
    registrarMidia: async (_e: string, _c: string, post: IdDePost, url: string) => {
      registradas.push([post, url]);
    },
  } as unknown as ASelecaoService;
  const servico = new MidiaDaExp07ef1bService(ia, assets, quota, selecao);
  const regerar = (postId: IdDePost) => servico.regerar("escola", "turma", "prof", "prof", "professor", "c1", postId);
  return { servico, regerar, salvos, registradas, estado: () => ({ consumido, geradas }) };
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
  test("sem variação é o da descrição (a herança entre coberturas depende disso)", () => {
    expect(nomeDaImagem("Uma praça")).toBe(nomeDaImagem("  Uma praça "));
  });
  test("a regerada é OUTRO arquivo: não sobrescreve a de quem herdou a descrição", () => {
    expect(nomeDaImagem("Uma praça", "v1")).not.toBe(nomeDaImagem("Uma praça"));
    expect(nomeDaImagem("Uma praça", "v1")).not.toBe(nomeDaImagem("Uma praça", "v2"));
  });
});

describe("gerar outra imagem", () => {
  test("gera, grava num arquivo novo, debita a quota e registra no post", async () => {
    const m = montar();
    const r = await m.regerar(POST_COM_IMAGEM.id);
    expect(r.postId).toBe(POST_COM_IMAGEM.id);
    expect(m.salvos).toHaveLength(1);
    expect(m.salvos[0]).not.toBe(nomeDaImagem(POST_COM_IMAGEM.descricaoImagem));
    expect(m.registradas).toEqual([[POST_COM_IMAGEM.id, r.url]]);
    expect(m.estado().consumido).toBe(CUSTO_ESTIMADO_POR_IMAGEM);
  });

  test("dois cliques no mesmo post pagam UMA imagem", async () => {
    const m = montar();
    const [a, b] = await Promise.all([m.regerar(POST_COM_IMAGEM.id), m.regerar(POST_COM_IMAGEM.id)]);
    expect(a).toEqual(b);
    expect(m.estado().geradas).toBe(1);
  });

  test("post de gráfico não tem imagem; sem saldo é 429; aprovadas não mudam", async () => {
    expect(await codigoDe(montar().regerar(POST_DE_GRAFICO.id))).toBe("post-sem-imagem");
    const semSaldo = montar({ saldo: false });
    expect(await codigoDe(semSaldo.regerar(POST_COM_IMAGEM.id))).toBe("sem-saldo-de-ia");
    expect(semSaldo.estado().geradas).toBe(0);
    expect(await codigoDe(montar({ aprovada: true }).regerar(POST_COM_IMAGEM.id))).toBe("imagens-ja-aprovadas");
  });
});
