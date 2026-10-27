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
  const publicada = !["inicio", "lupa", "decidir"].includes(passo);
  return {
    passo,
    fase: ["inicio", "lupa", "decidir", "feed"].includes(passo) ? "aberta" : "virada",
    preparada: true,
    aguardandoVirada: passo === "feed",
    atividade: { pacoteId: "p1", rodada: 1 },
    lupa:
      passo === "lupa"
        ? {
            alvo1Ms: 0,
            alvo2Ms: 0,
            alertas: 0,
            liberada: false,
            alvos: [
              { id: "inv-1", x: 41, y: 33, r: 8 },
              { id: "inv-2", x: 60, y: 33, r: 7 },
            ],
          }
        : null,
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
    },
    /* Como a api manda: com o espaço e a hora já no lugar. */
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

/* O `body` inteiro: o aviso (o `BottomSheet` do DS) pode desenhar fora do recipiente. */
const texto = () => document.body.textContent ?? "";
const botao = (nome: string) =>
  Array.from(document.body.querySelectorAll<HTMLElement>("button, [role=button]")).find(
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
    ["inicio", ["RASCUNHO PENDENTE", "INVESTIGAR A NOVA CAPA", "ENCONTRE NAS FOTOS 2 OBJETOS DA BIBLIOTECA", "ABRIR BANCADA"]],
    ["lupa", ["INVESTIGUE COM A LUPA", "0 DE 2 ENCONTRADOS", "FOTO 1 — BIBLIOTECA ESCOLAR 14:15", "AVANÇAR"]],
    ["decidir", ["ESCOLHA 1 FOTO", "PUBLICAR CAPA"]],
    ["feed", ["Na foto, vi a biblioteca!"]],
    ["invariantes", ["TOQUE EM 2 COISAS IGUAIS", "0 DE 2 ENCONTRADOS", "SUA FOTO", "OUTRA FOTO"]],
    ["slider", ["DESLIZE PARA REVELAR", "AGORA EU ENTENDI!", "SUA FOTO"]],
    ["fora", ["Marque na biblioteca o que ficou fora da sua foto.", "ARRASTE O ALFINETE", "Pronto"]],
    ["pares", ["Junte duas fotos da mesma atividade."]],
    ["segunda-foto", ["Foto de leitura: o que precisa aparecer?", "Mochila", "Criança lendo", "Colocar no álbum"]],
    ["concluida", ["FOTO GUARDADA NO ÁLBUM!", "MISSÃO CUMPRIDA!"]],
  ])("%s", async (passo, esperados) => {
    await abrir(sessao(passo));
    for (const t of esperados) expect(texto()).toContain(t);
  });

  test("lupa reidratada (F5): volta direto à bancada, sem o card da missão", async () => {
    await abrir(sessao("lupa"));
    expect(texto()).not.toContain("ABRIR BANCADA");
  });

  test("sem pacote no ar: a espera, só a mensagem", async () => {
    await abrir(sessao("inicio", { preparada: false }));
    expect(texto()).toContain("AGUARDE O PROFESSOR");
    expect(texto()).not.toContain("ABRIR BANCADA");
  });
});

describe("os gestos que vão à api", () => {
  test("E1: ABRIR BANCADA abre a sessão (`POST /iniciar`)", async () => {
    resposta = { passo: "lupa" };
    await abrir(sessao("inicio"));
    await act(async () => botao("ABRIR BANCADA")?.click());
    expect(chamadas).toContain("/enigma-capa/iniciar");
  });

  test("E2: AVANÇAR antes de achar os dois objetos abre o aviso OLHE O FUNDO", async () => {
    resposta = { ...({ liberado: false, alerta: true } as object) };
    await abrir(sessao("lupa"));
    await act(async () => botao("AVANÇAR")!.click());
    expect(chamadas).toContain("/enigma-capa/lupa");
    expect(texto()).toContain("OLHE O FUNDO");
    expect(texto()).toContain("VOLTAR À INVESTIGAÇÃO");
  });

  test("E3: escolher a foto abre a moldura e os selos; o selo por toque acende PUBLICAR CAPA", async () => {
    await abrir(sessao("decidir"));
    const publicar = () => botao("PUBLICAR CAPA") as HTMLButtonElement;
    expect(publicar().disabled).toBe(true);
    const fotos = recipiente!.querySelectorAll<HTMLButtonElement>(".decidir__miniatura");
    await act(async () => fotos[1]!.click());
    expect(texto()).toContain("Enquadre a foto");
    await act(async () => botao("CONTAÇÃO DE HISTÓRIAS")!.click());
    expect(publicar().disabled).toBe(false);
    expect(texto()).toContain("CAPA PRONTA!");
    expect(texto()).toContain("Foto enquadrada e selo carimbado!");
    resposta = { passo: "feed", aguardandoVirada: true, capa: sessao("feed").capa };
    await act(async () => publicar().click());
    expect(chamadas).toContain("/enigma-capa/publicar");
    expect(texto()).toContain("CAPA PUBLICADA!");
    await act(async () => botao("IR PARA O FEED")!.click());
    expect(texto()).toContain("Na foto, vi a biblioteca!");
  });

  test("E4: o feed segura a visitante 5 s antes do aviso, que é só a mensagem", async () => {
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
    const aviso = document.body.querySelector(".aviso");
    expect(aviso).not.toBeNull();
    expect(aviso!.querySelector("[class*='avatar']")).toBeNull();
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

  test("E4: a alça parte do centro; no fim do lado escondido, `POST /slider` e A CENA COMPLETA", async () => {
    resposta = { passo: "fora", panoramicaAberta: true };
    await abrir(sessao("slider"));
    const alca = recipiente!.querySelector<HTMLElement>("[role=slider]")!;
    expect(alca.getAttribute("aria-valuenow")).toBe("50");
    for (let i = 0; i < 10; i++) {
      await act(async () => alca.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    }
    expect(chamadas).toContain("/enigma-capa/slider");
    expect(texto()).toContain("A CENA COMPLETA");
    expect(texto()).toContain("ERA O MESMO LUGAR!");
    await act(async () => botao("AVANÇAR")!.click());
    expect(texto()).toContain("Marque na biblioteca o que ficou fora da sua foto.");
  });

  test("E4: o Pronto só acende com um alfinete fincado", async () => {
    await abrir(sessao("fora"));
    const pronto = () => botao("Pronto") as HTMLButtonElement;
    expect(pronto().disabled).toBe(true);
    await act(async () => botao("ARRASTE O ALFINETE")!.click());
    expect(pronto().disabled).toBe(false);
    await act(async () => pronto().click());
    expect(chamadas).toContain("/enigma-capa/fora");
  });
});
