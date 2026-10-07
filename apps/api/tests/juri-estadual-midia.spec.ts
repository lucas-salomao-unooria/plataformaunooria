import { HttpException } from "@nestjs/common";
import type { AiProvider } from "../src/ai/provider";
import type { QuotaService } from "../src/ai/quota.service";
import type { AssetsService } from "../src/assets/assets.service";
import type { JuriEstadualService, PacoteLido } from "../src/juri-estadual/juri-estadual.service";
import { CUSTO_ESTIMADO_POR_IMAGEM, MidiaDaExp06ef1bService, nomeDaImagem } from "../src/juri-estadual/midia.service";
import { PARAMETROS_DE_TESTE, conteudoDeTeste } from "./juri-estadual-fixture";

/**
 * "GERAR OUTRA IMAGEM" de um estande do Júri Estadual (o pedido do PO: o
 * professor vê e valida as imagens antes da turma) — SEM banco: o nome do
 * arquivo refeito e o serviço com provider, bucket, quota e missão falsos.
 * Molde: `a-selecao-midia.spec.ts`.
 */

const CONTEUDO = conteudoDeTeste();
const PROJETO = CONTEUDO.projetos[0]!;

function montar({ saldo = true, aprovada = false, falhaNaIa = false } = {}) {
  const salvos: string[] = [];
  const registradas: Array<[string, string]> = [];
  let consumido = 0;
  let geradas = 0;
  const ia = {
    generateImage: async () => {
      geradas += 1;
      if (falhaNaIa) throw new Error("provedor fora");
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
  const pacote: PacoteLido = {
    id: "p1",
    escolaId: "escola",
    turmaId: "turma",
    disciplina: PARAMETROS_DE_TESTE.disciplina,
    tema: CONTEUDO.tema,
    assuntos: PARAMETROS_DE_TESTE.assuntos,
    contexto: null,
    origem: "ia",
    conteudo: CONTEUDO,
    midia: { [PROJETO.id]: "https://cdn/antiga.webp" },
  };
  const juri = {
    pacoteParaMidia: async () => {
      if (aprovada) throw new HttpException({ codigo: "imagens-ja-aprovadas" }, 409);
      return pacote;
    },
    registrarMidia: async (_e: string, _p: string, projetoId: string, url: string) => {
      registradas.push([projetoId, url]);
    },
  } as unknown as JuriEstadualService;
  const servico = new MidiaDaExp06ef1bService(ia, assets, quota, juri);
  const refazer = (projetoId: string) => servico.refazer("escola", "turma", "prof", "prof", "professor", "p1", projetoId);
  return { servico, refazer, salvos, registradas, estado: () => ({ consumido, geradas }) };
}

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (erro) {
    return ((erro as HttpException).getResponse() as { codigo?: string }).codigo;
  }
}

describe("o nome do arquivo da imagem do estande", () => {
  test("sem variação é o da descrição (a herança entre pacotes depende disso)", () => {
    expect(nomeDaImagem("Um estande")).toBe(nomeDaImagem("  Um estande "));
    expect(nomeDaImagem("Um estande")).toMatch(/^mostra\/[0-9a-f]{32}\.webp$/);
  });
  test("a refeita é OUTRO arquivo: não sobrescreve a de quem herdou a descrição", () => {
    expect(nomeDaImagem("Um estande", "v1")).not.toBe(nomeDaImagem("Um estande"));
    expect(nomeDaImagem("Um estande", "v1")).not.toBe(nomeDaImagem("Um estande", "v2"));
  });
});

describe("gerar outra imagem de um estande", () => {
  test("gera, grava num arquivo novo, debita a quota e troca a URL do estande", async () => {
    const m = montar();
    const r = await m.refazer(PROJETO.id);
    expect(r).toMatchObject({ pacoteId: "p1", projetoId: PROJETO.id });
    expect(m.salvos).toHaveLength(1);
    expect(m.salvos[0]).not.toBe(nomeDaImagem(PROJETO.imagem.descricao));
    expect(m.registradas).toEqual([[PROJETO.id, r.url]]);
    expect(m.estado().consumido).toBe(CUSTO_ESTIMADO_POR_IMAGEM);
  });

  test("dois cliques no mesmo estande pagam UMA imagem", async () => {
    const m = montar();
    const [a, b] = await Promise.all([m.refazer(PROJETO.id), m.refazer(PROJETO.id)]);
    expect(a).toEqual(b);
    expect(m.estado().geradas).toBe(1);
  });

  test("estande que não é do pacote é 400; sem saldo é 429; aprovadas não mudam", async () => {
    expect(await codigoDe(montar().refazer("proj-z9"))).toBe("payload-invalido");
    const semSaldo = montar({ saldo: false });
    expect(await codigoDe(semSaldo.refazer(PROJETO.id))).toBe("sem-saldo-de-ia");
    expect(semSaldo.estado().geradas).toBe(0);
    expect(await codigoDe(montar({ aprovada: true }).refazer(PROJETO.id))).toBe("imagens-ja-aprovadas");
  });

  test("o provedor fora do ar é 503, e o estande fica com a imagem que tinha (nada gravado, nada cobrado)", async () => {
    const m = montar({ falhaNaIa: true });
    expect(await codigoDe(m.refazer(PROJETO.id))).toBe("ia-indisponivel");
    expect(m.registradas).toEqual([]);
    expect(m.estado().consumido).toBe(0);
  });

  test("a geração em lote também para depois da aprovação", async () => {
    expect(await codigoDe(montar({ aprovada: true }).servico.gerar("escola", "turma", "prof", "prof", "professor", "p1"))).toBe(
      "imagens-ja-aprovadas",
    );
  });
});
