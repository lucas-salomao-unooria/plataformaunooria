// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ExperienciaHandle } from "@edu/sdk";
import { BOATO_DE_TESTE, DETALHE_DE_TESTE, RedacaoFalsa } from "../teste/api-falsa";
import { ate, botao, dialogo, passar, radio, temBotao, textoDaTela, tocar } from "../teste/tela";

/**
 * O FLUXO PRINCIPAL renderizado de verdade (jsdom + os componentes do DS),
 * contra a api falsa de `teste/api-falsa.ts`: mesa → pista → publicar → motivo
 * → espera → resultado → Chave com isca → revisão → republicar → comparativo →
 * P1/P2 → fim. E a reconstrução por F5 em cada degrau.
 *
 * O `createExperiencia` do SDK é o único substituto: o resto — bootstrap,
 * conexão, polling, as telas e as peças das três seções — é o código que vai
 * para o bundle.
 */

const sdk = vi.hoisted(() => ({ handle: null as ExperienciaHandle | null }));
vi.mock("@edu/sdk", async (importOriginal) => {
  const real = await importOriginal<typeof import("@edu/sdk")>();
  return { ...real, createExperiencia: vi.fn(async () => sdk.handle) };
});

import { Bootstrap } from "../bootstrap";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function montarHandle(api: RedacaoFalsa) {
  const handle = {
    estudante: { id: "e1", nome: "Estudante de Teste", serie: "4EF", turmaId: "t1", escolaId: "s1" },
    config: {},
    api: {
      get: <T,>(p: string) => api.get(p) as Promise<T>,
      post: <T,>(p: string, b?: unknown) => api.post(p, b) as Promise<T>,
      put: <T,>(p: string, b?: unknown) => api.post(p, b) as Promise<T>,
      patch: <T,>(p: string, b?: unknown) => api.post(p, b) as Promise<T>,
      delete: <T,>(p: string) => api.get(p) as Promise<T>,
    },
    ai: { gerar: vi.fn() },
    track: vi.fn(),
    progresso: { salvar: vi.fn(async () => undefined), carregar: vi.fn(async () => null) },
    concluir: vi.fn(),
    on: vi.fn(),
    enviarEstado: vi.fn(),
    reportarErro: vi.fn(),
  } satisfies ExperienciaHandle;
  return handle;
}

let raiz: Root | null = null;
let recipiente: HTMLDivElement | null = null;

async function abrir() {
  recipiente = document.createElement("div");
  document.body.appendChild(recipiente);
  const r = createRoot(recipiente);
  raiz = r;
  await act(async () => {
    r.render(<Bootstrap />);
  });
  await passar();
  await passar();
}

async function fechar() {
  const r = raiz;
  if (r) {
    await act(async () => {
      r.unmount();
    });
  }
  recipiente?.remove();
  raiz = null;
  recipiente = null;
}

/** O F5: a aba cai inteira e volta — a `sessionStorage` fica, a memória do React não. */
async function f5() {
  await fechar();
  await abrir();
}

const quantas = (api: RedacaoFalsa, chamada: string) => api.chamadas.filter((c) => c === chamada).length;

async function abrirCartao(manchete: string) {
  await tocar(botao(manchete));
  await ate(() => document.querySelector('[role="dialog"]') !== null, `a gaveta de "${manchete}"`);
}

async function adicionar(manchete: string) {
  await abrirCartao(manchete);
  await tocar(botao("Adicionar ao Jornal", dialogo()));
}

async function publicarNaCapa(rotulo: string) {
  await tocar(botao("Primeira Página"));
  await ate(() => !botao(rotulo).disabled, `"${rotulo}" acender (a diagramação voltar)`);
  await tocar(botao(rotulo));
  await ate(() => textoDaTela().includes("Confirmar Publicação da Capa"), "o modal de confirmação");
  await tocar(botao("Distribuir Jornal Agora"));
}

beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  document.body.innerHTML = "";
});

afterEach(async () => {
  await fechar();
  vi.useRealTimers();
});

describe("o fluxo principal, da mesa ao modo leitura", () => {
  test("mesa → pista → publicar → motivo → espera → resultado → Chave com isca → revisão → republicar → comparativo → P1/P2 → fim", async () => {
    const api = new RedacaoFalsa();
    const handle = montarHandle(api);
    sdk.handle = handle;
    await abrir();

    // E1 — o Bento e a restrição.
    expect(textoDaTela()).toContain("A redação recebeu 8 notícias. Temos só 3 vagas na capa.");
    await tocar(botao("Explorar Mesa de Notícias"));

    // E2 — a mesa: oito cartões, o Bento calado, nenhum polling.
    await ate(() => textoDaTela().includes("Pautas da Semana"), "a mesa");
    expect(document.querySelectorAll(".unooria-news-card")).toHaveLength(8);
    expect(textoDaTela()).not.toContain("Bento");

    // A gaveta: a matéria original na seção de cada meio (o post no Instanooria, a mensagem no WhatsApp).
    await abrirCartao("Manchete da notícia n6");
    expect(dialogo().querySelector(".insta-post-card")).not.toBeNull();
    await tocar(botao("Voltar para a Mesa"));
    await abrirCartao("Manchete da notícia n7");
    expect(dialogo().querySelector(".wa-messagebubble .wa-messagebubble__forwarded")).not.toBeNull();
    expect(dialogo().querySelector('.peca-whatsapp[data-wa-theme="dark"]')).not.toBeNull();
    await tocar(botao("Voltar para a Mesa"));

    // A pista é revelada pelo SERVIDOR: o texto só existe depois do POST.
    await abrirCartao("Manchete da notícia n1");
    expect(dialogo().querySelector(".unooria-news-article")).not.toBeNull();
    expect(textoDaTela()).not.toContain("Pista de fonte da notícia n1");
    await tocar(botao("Fonte", dialogo()));
    await ate(() => textoDaTela().includes("Pista de fonte da notícia n1"), "o texto da pista");
    expect(quantas(api, "POST /jornal-escola/pista")).toBe(1);
    await tocar(botao("Adicionar ao Jornal", dialogo()));

    await adicionar("Manchete da notícia n2");
    await adicionar("Manchete da notícia n3");
    expect(textoDaTela()).toContain("3/3");

    // A quarta: o aviso da capa cheia, e a ação não entra.
    await abrirCartao("Manchete da notícia n4");
    expect(textoDaTela()).toContain("A capa cabe só 3 matérias.");
    await tocar(botao("Voltar para a Mesa"));

    // E3 — a diagramação é pedida com as três vagas cheias; o modal NÃO tem a pergunta.
    await tocar(botao("Primeira Página"));
    await ate(() => quantas(api, "POST /jornal-escola/diagramar") === 1, "o POST diagramar");
    await ate(() => !botao("Publicar 1ª Edição").disabled, "o botão de publicar");
    await tocar(botao("Publicar 1ª Edição"));
    await ate(() => textoDaTela().includes("Confirmar Publicação da Capa"), "o modal");
    expect(textoDaTela()).not.toContain("Como a dupla escolheu");
    expect(quantas(api, "GET /jornal-escola/gate")).toBe(0);
    await tocar(botao("Distribuir Jornal Agora"));
    expect(api.edicao1?.slots).toEqual(["n1", "n2", "n3"]);
    expect(api.edicao1?.layout).toBe("columns");

    // O motivo, DEPOIS do latch.
    await ate(() => textoDaTela().includes("Como a dupla escolheu essas três matérias para a capa?"), "a tela de motivo");
    await tocar(radio("Checamos quem postou"));
    await tocar(botao("Enviar resposta"));
    expect(api.motivo).toBe("checagem");

    // A espera neutra, com o polling de 5 s.
    await ate(() => textoDaTela().includes("Edição em Análise na Escola"), "a espera");
    await passar(5_100);
    expect(quantas(api, "GET /jornal-escola/gate")).toBeGreaterThanOrEqual(1);
    expect(textoDaTela()).toContain("Edição em Análise na Escola");

    // O professor libera o resultado.
    api.liberar("resultado");
    await passar(5_100);
    await ate(() => textoDaTela().includes("1 de 3 notícias verificadas nesta edição (33%)"), "o resultado");
    expect(document.querySelectorAll(".unooria-speech-bubble")).toHaveLength(3);
    expect(textoDaTela()).toContain("Mural da Escola: Edição em Circulação");

    // O professor libera a revisão: a Chave.
    api.liberar("revisao");
    await passar(5_100);
    await ate(() => textoDaTela().includes("Ferramenta de Checagem do Bento"), "a Chave");
    const gatesAntes = quantas(api, "GET /jornal-escola/gate");

    // Uma isca: ela volta à bandeja, os pilares ficam na calha.
    await tocar(botao("Foto"));
    await tocar(botao("Fonte"));
    await tocar(botao("Data"));
    await ate(() => textoDaTela().includes("Esse bloco não abre a chave. Tente outro."), "a isca devolvida");
    expect(textoDaTela()).toContain("Voltou para a bandeja");
    expect(document.querySelectorAll(".unooria-puzzle-track .unooria-puzzle-block")).toHaveLength(2);
    await tocar(botao("Autoria"));
    await ate(() => textoDaTela().includes("Chave do Editor ativada!"), "a Chave formada");
    expect(api.tentativas).toBe(2);
    // O número de cada envio é `estado.chaveTentativas + 1`, desde o primeiro.
    expect(api.numerosDaChave).toEqual([1, 2]);
    await passar(10_000);
    expect(quantas(api, "GET /jornal-escola/gate")).toBe(gatesAntes);

    // A revisão: os marcadores por vaga.
    await tocar(botao("Abrir a Mesa de Revisão"));
    await ate(() => textoDaTela().includes("Mesa de Revisão Pericial"), "a revisão");
    await tocar(botao("Primeira Página"));
    await ate(() => textoDaTela().includes("Fato que já passou"), "os marcadores");
    expect(textoDaTela()).toContain("Fonte sem confirmação");
    expect(textoDaTela()).toContain("Matéria verificada");

    // Na revisão, a pista já lida na mesa nasce FECHADA e o toque registra a fase 2 (o texto aparece na hora).
    const pistasAntes = quantas(api, "POST /jornal-escola/pista");
    await tocar(botao("Pautas da Semana"));
    await abrirCartao("Manchete da notícia n1");
    expect(botao("Fonte", dialogo()).getAttribute("aria-expanded")).toBe("false");
    await tocar(botao("Fonte", dialogo()));
    expect(textoDaTela()).toContain("Pista de fonte da notícia n1");
    expect(quantas(api, "POST /jornal-escola/pista")).toBe(pistasAntes + 1);
    await tocar(botao("Voltar para a Mesa"));
    await tocar(botao("Primeira Página"));

    // Troca a notícia antiga (vaga 2) por outra.
    const trocas = Array.from(document.querySelectorAll("button")).filter((b) => (b.textContent ?? "").includes("Trocar Matéria"));
    expect(trocas).toHaveLength(3);
    await tocar(trocas[1] as HTMLButtonElement);
    await adicionar("Manchete da notícia n4");
    await publicarNaCapa("Publicar 2ª Edição Revisada");
    expect(api.edicao2?.slots).toEqual(["n1", "n4", "n3"]);

    // O comparativo.
    await ate(() => textoDaTela().includes("1ª Edição: 1 de 3 verificadas ➔ 2ª Edição: 2 de 3 verificadas!"), "o comparativo");
    expect(textoDaTela()).not.toContain("Agora sim!");
    await tocar(botao("Avançar para Desafio Final"));

    // E6 — fora da redação, sem o Bento: o boato encaminhado e P1/P2.
    await ate(() => textoDaTela().includes("Desafio Individual de Checagem"), "o desafio final");
    await ate(() => textoDaTela().includes(BOATO_DE_TESTE), "o boato");
    expect(textoDaTela()).toContain(DETALHE_DE_TESTE);
    expect(document.querySelector(".peca-whatsapp .wa-messagebubble__forwarded")).not.toBeNull();
    expect(textoDaTela()).not.toContain("Bento");
    await tocar(radio("Se veio de canal oficial"));
    await tocar(botao("Responder"));
    await ate(() => textoDaTela().includes("O que acontece quando as pessoas repassam"), "a P2");
    await tocar(radio("Pode fazer a escola inteira parar."));
    await tocar(botao("Responder"));
    expect(api.respostas).toEqual({ p1: "p1a", p2: "p2a" });

    // A síntese ÚNICA, e o fim.
    await ate(() => textoDaTela().includes("Antes de repassar qualquer aviso"), "a síntese");
    expect(textoDaTela()).not.toContain("Você comprovou");
    await tocar(botao("Concluir Missão"));
    await ate(() => textoDaTela().includes("Edição Publicada — Modo Leitura"), "o modo leitura");
    expect(temBotao("Ver 1ª Edição")).toBe(true);
    expect(temBotao("Ver 2ª Edição")).toBe(true);

    expect(handle.concluir).toHaveBeenCalledTimes(1);
    const concluido = handle.concluir.mock.calls[0]?.[0] as { score?: number; dados?: Record<string, unknown> };
    expect(concluido.score).toBeUndefined();
    expect(concluido.dados).toEqual({ publicouAPrimeira: true, publicouASegunda: true, respondidas: 2 });

    // A telemetria: os eventos do PRD §13, só com ids e números.
    const eventos = handle.track.mock.calls.map((c) => `${String(c[0])} ${String(c[1])}`);
    for (const esperado of [
      "attempted missao:iniciar",
      "progressed etapa:entrar",
      "interacted noticia:inspecionar",
      "scored edicao:publicar",
      "progressed resultado:ver",
      "interacted algoritmo:ordenar",
      "interacted transferencia:responder",
      "completed exp04ef1b",
    ]) {
      expect(eventos).toContain(esperado);
    }
    expect(eventos.filter((e) => e === "scored edicao:publicar")).toHaveLength(2);
    const carga = JSON.stringify(handle.track.mock.calls);
    for (const proibido of ["Manchete", "Pista de", "Estudante de Teste", "p1a", "p2a", "URGENTE"]) {
      expect(carga).not.toContain(proibido);
    }
  }, 60_000);
});

describe("F5 relê da api e reconstrói a tela", () => {
  test("em cada degrau, a aba que cai volta ao mesmo lugar", async () => {
    const api = new RedacaoFalsa();
    sdk.handle = montarHandle(api);
    await abrir();
    await tocar(botao("Explorar Mesa de Notícias"));
    await ate(() => textoDaTela().includes("Pautas da Semana"), "a mesa");

    // A página em montagem e a pista aberta.
    await abrirCartao("Manchete da notícia n1");
    await tocar(botao("Data", dialogo()));
    await ate(() => textoDaTela().includes("Pista de data da notícia n1"), "a pista");
    await tocar(botao("Adicionar ao Jornal", dialogo()));
    await adicionar("Manchete da notícia n5");

    await f5();
    await ate(() => textoDaTela().includes("Pautas da Semana"), "a mesa depois do F5");
    expect(textoDaTela()).toContain("2/3");
    await abrirCartao("Manchete da notícia n1");
    const data = botao("Data", dialogo());
    expect(data.getAttribute("aria-expanded")).toBe("true");
    expect(textoDaTela()).toContain("Pista de data da notícia n1");
    expect(quantas(api, "POST /jornal-escola/pista")).toBe(1);
    await tocar(botao("Voltar para a Mesa"));

    // Publica; o F5 no motivo volta ao motivo.
    await adicionar("Manchete da notícia n6");
    await publicarNaCapa("Publicar 1ª Edição");
    await ate(() => textoDaTela().includes("Como a dupla escolheu"), "o motivo");
    await f5();
    await ate(() => textoDaTela().includes("Como a dupla escolheu"), "o motivo depois do F5");
    await tocar(radio("Escolhemos as fotos mais chamativas"));
    await tocar(botao("Enviar resposta"));

    // Espera → resultado, com F5 no meio.
    await ate(() => textoDaTela().includes("Edição em Análise na Escola"), "a espera");
    await f5();
    await ate(() => textoDaTela().includes("Edição em Análise na Escola"), "a espera depois do F5");
    api.liberar("resultado");
    await f5();
    await ate(() => textoDaTela().includes("notícias verificadas nesta edição"), "o resultado depois do F5");
    expect(textoDaTela()).toContain("2 de 3 notícias verificadas nesta edição (67%)");

    // A Chave; o F5 depois dela cai na revisão, com a página da 1ª edição.
    api.liberar("revisao");
    await f5();
    await ate(() => textoDaTela().includes("Ferramenta de Checagem do Bento"), "a Chave depois do F5");
    await tocar(botao("Fonte"));
    await tocar(botao("Data"));
    await tocar(botao("Autoria"));
    await ate(() => textoDaTela().includes("Chave do Editor ativada!"), "a Chave formada");
    await f5();
    await ate(() => textoDaTela().includes("Mesa de Revisão Pericial"), "a revisão depois do F5");
    await tocar(botao("Primeira Página"));
    await ate(() => textoDaTela().includes("Ninguém assina"), "o marcador da n5");
    expect(textoDaTela()).toContain("3/3");

    // A pista lida na mesa nasce fechada na revisão; consultada na fase 2, o F5 a devolve ABERTA, sem novo POST.
    await tocar(botao("Pautas da Semana"));
    await abrirCartao("Manchete da notícia n1");
    expect(botao("Data", dialogo()).getAttribute("aria-expanded")).toBe("false");
    await tocar(botao("Data", dialogo()));
    await ate(() => api.pistas.some((p) => p.noticiaId === "n1" && p.tipo === "data" && p.fase === 2), "o registro da fase 2");
    const pistasNaRevisao = quantas(api, "POST /jornal-escola/pista");
    await f5();
    await ate(() => textoDaTela().includes("Mesa de Revisão Pericial"), "a revisão depois do segundo F5");
    await abrirCartao("Manchete da notícia n1");
    expect(botao("Data", dialogo()).getAttribute("aria-expanded")).toBe("true");
    expect(quantas(api, "POST /jornal-escola/pista")).toBe(pistasNaRevisao);
    await tocar(botao("Voltar para a Mesa"));
    await tocar(botao("Primeira Página"));

    // Republica as mesmas três (caminho previsto); F5 no comparativo.
    await ate(() => !botao("Publicar 2ª Edição Revisada").disabled, "o botão da 2ª");
    await tocar(botao("Publicar 2ª Edição Revisada"));
    await tocar(botao("Distribuir Jornal Agora"));
    await ate(() => textoDaTela().includes("Comparativo das Edições"), "o comparativo");
    await f5();
    await ate(() => textoDaTela().includes("2ª Edição: 2 de 3 verificadas!"), "o comparativo depois do F5");

    // O desafio final: P1 respondida sobrevive ao F5.
    await tocar(botao("Avançar para Desafio Final"));
    await ate(() => textoDaTela().includes(BOATO_DE_TESTE), "o boato");
    await tocar(radio("Se tem a palavra URGENTE."));
    await tocar(botao("Responder"));
    await ate(() => textoDaTela().includes("O que acontece quando"), "a P2");
    await f5();
    await ate(() => textoDaTela().includes("O que acontece quando"), "a P2 depois do F5");
    expect(textoDaTela()).toContain(BOATO_DE_TESTE);
    await tocar(radio("O celular apaga as mensagens."));
    await tocar(botao("Responder"));
    await tocar(botao("Concluir Missão"));
    await ate(() => textoDaTela().includes("Edição Publicada — Modo Leitura"), "o modo leitura");

    await f5();
    await ate(() => textoDaTela().includes("Edição Publicada — Modo Leitura"), "o modo leitura depois do F5");
  }, 60_000);

  test("o 429 fala de muitos pedidos (não de conexão caída) e a chamada se repete sozinha", async () => {
    const api = new RedacaoFalsa();
    const post = api.post.bind(api);
    let recusas = 1;
    api.post = async (caminho: string, corpo?: unknown) => {
      if (caminho === "/jornal-escola/passo" && recusas > 0) {
        recusas -= 1;
        throw new Error(`API POST ${caminho} → 429`);
      }
      return post(caminho, corpo);
    };
    sdk.handle = montarHandle(api);
    await abrir();
    await tocar(botao("Explorar Mesa de Notícias"));
    expect(textoDaTela()).toContain("A gráfica está com muitos pedidos agora.");
    expect(textoDaTela()).not.toContain("Conexão com a gráfica oscilou");
    await passar(2_100);
    await ate(() => textoDaTela().includes("Pautas da Semana"), "a mesa depois da repetição");
    expect(textoDaTela()).not.toContain("muitos pedidos");
  });

  test("o professor zerou no meio (409 `rodada-mudou`): a tela relê a sessão nova e avisa na voz da redação", async () => {
    const api = new RedacaoFalsa();
    sdk.handle = montarHandle(api);
    await abrir();
    await tocar(botao("Explorar Mesa de Notícias"));
    await ate(() => textoDaTela().includes("Pautas da Semana"), "a mesa");
    for (const n of ["n1", "n4", "n6"]) await adicionar(`Manchete da notícia ${n}`);
    // O professor zera a turma: outra sessão, rodada 2, de volta ao desafio.
    api.sessaoId = "33333333-3333-4333-8333-333333333333";
    api.rodada = 2;
    api.passo = "desafio";
    await publicarNaCapa("Publicar 1ª Edição");
    await ate(() => textoDaTela().includes("O professor atualizou a mesa de notícias."), "o aviso da rodada nova");
    expect(textoDaTela()).toContain("Explorar Mesa de Notícias");
    expect(api.edicao1).toBeNull();
  });

  test("a missão fechada nesta turma (403) mostra a tela da escola", async () => {
    const api = new RedacaoFalsa();
    api.get = async (caminho: string) => {
      api.chamadas.push(`GET ${caminho}`);
      throw new Error(`API GET ${caminho} → 403`);
    };
    sdk.handle = montarHandle(api);
    await abrir();
    await ate(() => textoDaTela().includes("Esta missão ainda não foi aberta para a sua turma."), "a tela da escola");
  });
});
