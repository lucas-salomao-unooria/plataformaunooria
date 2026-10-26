// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import type { ExperienciaHandle } from "@edu/sdk";
import { App } from "./App";
import { definirExperiencia } from "./lib/api";
import type { Estado, Passo, Sessao } from "./lib/tipos";

/**
 * FUMAÇA das telas: cada passo do servidor renderiza a tela dele, com os
 * textos literais do PO, sem quebrar — contra uma sessão falsa no formato do
 * `SessaoSchema` da api (sem gabarito: é o que o cliente recebe). A rede é um
 * handle falso do SDK; nenhuma chamada sai daqui.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chamadas: string[] = [];
/** O "servidor": a sessão que o teste abriu; um POST aplica `resposta` sobre ela (e ela fica). */
let atual: Sessao | null = null;
let resposta: Partial<Estado> = {};

function handleFalso(): ExperienciaHandle {
  const ler = async <T,>(p: string): Promise<T> => {
    chamadas.push(p);
    const s = atual!;
    if (p.endsWith("/gate")) {
      return { preparada: s.preparada, fase: s.fase, rodada: 1, atividade: s.atividade, passo: s.passo, agora: "" } as T;
    }
    return s as T;
  };
  const jogar = async <T,>(p: string): Promise<T> => {
    chamadas.push(p);
    atual = { ...atual!, ...resposta };
    return atual as T;
  };
  return {
    estudante: { id: "e1", nome: "Estudante", serie: "2EF", turmaId: "t1", escolaId: "s1" },
    config: {},
    api: { get: ler, post: jogar, put: jogar, patch: jogar, delete: ler },
    ai: { gerar: vi.fn() },
    track: vi.fn(),
    progresso: { salvar: vi.fn(async () => undefined), carregar: vi.fn(async () => null) },
    concluir: vi.fn(),
    on: vi.fn(),
    enviarEstado: vi.fn(),
    reportarErro: vi.fn(),
  } as unknown as ExperienciaHandle;
}

const R = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

function sessao(passo: Passo, extra: Partial<Estado> = {}): Sessao {
  const publicada = !["cracha", "lupa", "decidir"].includes(passo);
  return {
    passo,
    fase: ["cracha", "lupa", "decidir", "feed"].includes(passo) ? "aberta" : "virada",
    preparada: true,
    aguardandoVirada: passo === "feed",
    atividade: { pacoteId: "p1", rodada: 1 },
    cracha: passo === "cracha" ? null : "fone-azul",
    lupa: null,
    capa: publicada
      ? {
          fotoId: "foto-1",
          outraFotoId: "foto-2",
          seloId: "selo-1",
          deslocamento: { x: 0.5, y: 0.5 },
          visivel: R(6.8, 10, 54.4, 80),
          visitante: "Na foto, vi a biblioteca!",
          publicadaEm: "2026-10-26T14:15:00.000Z",
        }
      : null,
    invariantes: ["invariantes", "slider", "fora"].includes(passo)
      ? { encontrados: [], erros: 0, ajuda: false, alvos: null, achados: [], completo: passo !== "invariantes" }
      : null,
    panoramicaAberta: passo === "fora",
    fora: null,
    pares: null,
    segundaFoto: null,
    transferencia: passo === "concluida" ? { voto: "so-um-pedaco" } : null,
    concluido: passo === "concluida",
    cena: {
      chave: "biblioteca",
      espaco: "Biblioteca Escolar",
      espacoCurto: "a biblioteca",
      hora: "14:15",
      imagem: { tipo: "bundle", nome: "cenas/biblioteca.webp" },
      alt: "A biblioteca inteira.",
      fotos: [
        { id: "foto-1", recorte: R(0, 0, 68, 100), acao: "Mesa de leitura em silêncio" },
        { id: "foto-2", recorte: R(32, 0, 68, 100), acao: "Tapete com fantoches" },
      ],
      selos: [
        { id: "selo-1", texto: "SILÊNCIO PARA LER", emoji: "📖" },
        { id: "selo-2", texto: "CONTAÇÃO DE HISTÓRIAS", emoji: "🎭" },
      ],
      invariantes: [
        { id: "inv-1", nome: "RELÓGIO" },
        { id: "inv-2", nome: "CARTAZ AMARELO" },
      ],
      fundo: R(32, 3, 36, 33),
    },
    geometria: {
      proporcaoDaPanoramica: 16 / 9,
      recortes: { "foto-1": R(0, 0, 68, 100), "foto-2": R(32, 0, 68, 100) },
      faixaComum: { de: 32, ate: 68 },
      molduraDaCapa: { w: 0.8, h: 0.8 },
      segundaFoto: { proporcao: 4 / 3, moldura: { w: 0.55, h: 0.85 } },
      pisoDaLupaMs: 3000,
      toquesForaMax: 10,
    },
    material: {
      crachas: [
        { id: "fone-azul", rotulo: "FONE AZUL", emoji: "🎧" },
        { id: "fone-amarelo", rotulo: "FONE AMARELO", emoji: "⭐" },
        { id: "microfone-verde", rotulo: "MICROFONE VERDE", emoji: "🎙️" },
        { id: "gravador-laranja", rotulo: "GRAVADOR LARANJA", emoji: "📻" },
      ],
      cartas: ["carta-a", "carta-b", "carta-c", "carta-d"].map((id) => ({ id, imagem: { tipo: "bundle" as const, nome: `fixas/${id}.webp` } })),
      motivos: [
        { id: "atividade", rotulo: "A atividade" },
        { id: "roupa", rotulo: "A cor da roupa" },
      ],
      segundaFoto: {
        imagem: { tipo: "bundle", nome: "fixas/leitura.webp" },
        elementos: [
          { id: "mochila", rotulo: "Mochila" },
          { id: "parede", rotulo: "Parede" },
          { id: "crianca-lendo", rotulo: "Criança lendo" },
        ],
      },
      transferencia: {
        imagem: { tipo: "bundle", nome: "fixas/lagarta.webp" },
        opcoes: [
          { id: "so-um-pedaco", rotulo: "SÓ UM PEDAÇO", emoji: "🌿" },
          { id: "mostra-tudo", rotulo: "MOSTRA TUDO", emoji: "💥" },
        ],
      },
    },
    /* Como a api manda: com o espaço e a hora já no lugar, e o {cracha} por preencher antes do crachá. */
    textos: { e2: { rotuloDaFoto1: "FOTO 1 — BIBLIOTECA ESCOLAR 14:15", rotuloDaFoto2: "FOTO 2 — BIBLIOTECA ESCOLAR 14:15" } },
    tempos: { toqueLiberadoMs: 3000, inatividadeMs: 45_000, esperaDoProfessorMs: 180_000, pollingMs: 3000 },
    ...extra,
  };
}

let raiz: Root | null = null;
let recipiente: HTMLDivElement | null = null;

async function abrir(s: Sessao) {
  atual = s;
  recipiente = document.createElement("div");
  document.body.appendChild(recipiente);
  const r = createRoot(recipiente);
  raiz = r;
  await act(async () => {
    r.render(<App inicial={s} />);
  });
}

const texto = () => recipiente?.textContent ?? "";
const botao = (nome: string) =>
  Array.from(recipiente?.querySelectorAll<HTMLElement>("button, [role=button]") ?? []).find(
    (b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").includes(nome),
  );

beforeAll(() => {
  definirExperiencia(handleFalso());
  /* O jsdom não faz layout: a bancada e a virada medem 375 × 600. */
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 375, bottom: 600, width: 375, height: 600, toJSON: () => ({}),
  } as DOMRect);
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

afterEach(async () => {
  const r = raiz;
  if (r) await act(async () => r.unmount());
  recipiente?.remove();
  raiz = null;
  chamadas.length = 0;
  resposta = {};
  vi.useRealTimers();
});

describe("cada passo do servidor desenha a sua tela, com o texto do PO", () => {
  test.each<[Passo, string[]]>([
    ["cracha", ["ESCOLHA SEU CRACHÁ"]],
    ["lupa", ["INVESTIGAR A NOVA CAPA", "FOTO 1 — BIBLIOTECA ESCOLAR 14:15", "AVANÇAR"]],
    ["decidir", ["POSTAGEM DE: FONE AZUL", "ESCOLHA 1 FOTO", "PUBLICAR CAPA"]],
    ["feed", ["Na foto, vi a biblioteca!", "POSTAGEM DE: FONE AZUL"]],
    ["invariantes", ["TOQUE EM 2 COISAS IGUAIS", "SUA FOTO", "OUTRA FOTO"]],
    ["slider", ["AGORA EU ENTENDI!"]],
    ["fora", ["ERA O MESMO LUGAR!", "Marque na biblioteca o que ficou fora da sua foto.", "Pronto"]],
    ["pares", ["Junte duas fotos da mesma atividade."]],
    ["segunda-foto", ["Foto de leitura: o que precisa aparecer?", "Mochila", "Criança lendo", "Colocar no álbum"]],
    ["transferencia", ["HORTA DA ESCOLA", "A HORTA ACABOU?", "SÓ UM PEDAÇO", "MOSTRA TUDO"]],
    ["concluida", ["MISSÃO CUMPRIDA!", "SELEÇÃO ENVIADA"]],
  ])("%s", async (passo, esperados) => {
    await abrir(sessao(passo));
    for (const t of esperados) expect(texto()).toContain(t);
  });

  test("lupa reidratada (F5): o mural é pulado — volta direto à bancada", async () => {
    await abrir(sessao("lupa"));
    expect(texto()).not.toContain("ESCOLHA SEU CRACHÁ");
  });

  test("sem pacote no ar: a espera, sem o seletor", async () => {
    await abrir(sessao("cracha", { preparada: false }));
    expect(texto()).toContain("AGUARDE O PROFESSOR");
    expect(texto()).not.toContain("ESCOLHA SEU CRACHÁ");
  });
});

describe("os gestos que vão à api", () => {
  test("E1: o crachá só responde depois de 3 s", async () => {
    vi.useFakeTimers();
    resposta = { passo: "lupa", cracha: "fone-azul" };
    await abrir(sessao("cracha"));
    await act(async () => botao("FONE AZUL")?.click());
    expect(chamadas).not.toContain("/enigma-capa/cracha");
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
    await act(async () => botao("FONE AZUL")?.click());
    expect(chamadas).toContain("/enigma-capa/cracha");
  });

  test("E3: escolher a foto abre a moldura e os selos; o selo por toque acende PUBLICAR CAPA", async () => {
    await abrir(sessao("decidir"));
    const publicar = () => botao("PUBLICAR CAPA") as HTMLButtonElement;
    expect(publicar().disabled).toBe(true);
    const fotos = recipiente!.querySelectorAll<HTMLButtonElement>(".decidir__miniatura");
    await act(async () => fotos[1]!.click());
    expect(texto()).toContain("Arraste a foto");
    await act(async () => botao("CONTAÇÃO DE HISTÓRIAS")!.click());
    expect(publicar().disabled).toBe(false);
    await act(async () => publicar().click());
    expect(chamadas).toContain("/enigma-capa/publicar");
  });

  test("E4: o feed segura a visitante 5 s antes do cadeado", async () => {
    vi.useFakeTimers();
    await abrir(sessao("feed"));
    expect(texto()).not.toContain("AGUARDE O PROFESSOR");
    await act(async () => {
      vi.advanceTimersByTime(5100);
    });
    expect(texto()).toContain("AGUARDE O PROFESSOR");
    expect(texto()).not.toContain("O PROFESSOR JÁ VEM!");
    await act(async () => {
      vi.advanceTimersByTime(180_000);
    });
    expect(texto()).toContain("O PROFESSOR JÁ VEM!");
  });

  test("E4: tocar na foto manda o ponto DA PANORÂMICA", async () => {
    resposta = {
      passo: "invariantes",
      ...({ toque: { acerto: null, encontrados: [], erros: 1, ajuda: false, completo: false } } as object),
    };
    await abrir(sessao("invariantes"));
    const foto = recipiente!.querySelector<HTMLElement>(".dividida__foto")!;
    await act(async () => foto.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 100, clientY: 300 })));
    expect(chamadas).toContain("/enigma-capa/invariantes");
  });

  test("E4: o fim do slider abre a panorâmica (`POST /slider`)", async () => {
    await abrir(sessao("slider"));
    const slider = recipiente!.querySelector<HTMLInputElement>("input[type=range]")!;
    const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      definir.call(slider, "100");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(chamadas).toContain("/enigma-capa/slider");
  });
});
