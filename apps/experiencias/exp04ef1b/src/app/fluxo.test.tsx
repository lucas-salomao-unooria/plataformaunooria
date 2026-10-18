// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ExperienciaHandle } from "@edu/sdk";
import { BOATO_DE_TESTE, REFERENCIA_DE_TESTE, RedacaoFalsa } from "../teste/api-falsa";
import { ate, botao, dialogo, passar, radio, temBotao, textoDaTela, tocar } from "../teste/tela";

/**
 * O FLUXO PRINCIPAL renderizado de verdade (jsdom + os componentes do DS),
 * contra a api falsa de `teste/api-falsa.ts`: mesa → pista → "confio" →
 * publicar → motivo → espera → resultado → a Chave MONTADA (com isca, sem
 * correção) → revisão → republicar → comparativo → simulação → o boato → fim.
 * E a reconstrução por F5 em cada degrau. Nenhuma chamada a `/evidencias`.
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

/** Marca a opção `valor` do `RadioGroup` de nome `nome` (o Montador tem vários "A pista passa"). */
async function marcar(nome: string, valor: string) {
  const input = document.querySelector<HTMLInputElement>(`input[type="radio"][name="${nome}"][value="${valor}"]`);
  if (!input) throw new Error(`opção ${nome}=${valor} não está na tela. Tela: ${textoDaTela().slice(0, 600)}`);
  await tocar(input);
}

/** Uma vaga inteira do Montador: o bloco escolhido vai para a próxima vaga, com os dois cartões e o "se falhar". */
async function montarVaga(rotulo: string, bloco: string, lados: [string, string], seFalhar: string) {
  await tocar(botao(rotulo, document.querySelector(".chave__bandeja") ?? document.body));
  await tocar(botao("Adicionar na próxima vaga"));
  await marcar(`lado-${bloco}-0`, lados[0]);
  await marcar(`lado-${bloco}-1`, lados[1]);
  await marcar(`se-falhar-${bloco}`, seFalhar);
}

/** Uma pista da matéria em teste na simulação (as da Chave travada têm o mesmo nome). */
function pistaDaMateria(rotulo: string): HTMLButtonElement {
  const materia = document.querySelector(".simulacao__materia");
  if (!materia) throw new Error(`nenhuma matéria na tela. Tela: ${textoDaTela().slice(0, 600)}`);
  return botao(rotulo, materia);
}

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
  test("mesa → pista → confio → publicar → motivo → espera → resultado → Chave montada → revisão → republicar → comparativo → simulação → boato → fim", async () => {
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

    // A gaveta: a matéria original na seção de cada meio (o post no Unoovista, a mensagem no Unoochat).
    await abrirCartao("Manchete da notícia n6");
    expect(dialogo().querySelector(".unv-post-card")).not.toBeNull();
    await tocar(botao("Voltar para a Mesa"));
    await abrirCartao("Manchete da notícia n7");
    expect(dialogo().querySelector(".unc-messagebubble .unc-messagebubble__forwarded")).not.toBeNull();
    expect(dialogo().querySelector('.peca-unoochat[data-unc-theme="light"]')).not.toBeNull();
    await tocar(botao("Voltar para a Mesa"));

    // A pista é revelada pelo SERVIDOR: o texto (e o julgamento) só existem depois do POST.
    await abrirCartao("Manchete da notícia n1");
    expect(dialogo().querySelector(".unooria-news-article")).not.toBeNull();
    expect(textoDaTela()).not.toContain("Pista de fonte da notícia n1");
    expect(temBotao("✓ Confio", dialogo())).toBe(false);
    await tocar(botao("Fonte", dialogo()));
    await ate(() => textoDaTela().includes("Pista de fonte da notícia n1"), "o texto da pista");
    expect(quantas(api, "POST /jornal-escola/pista")).toBe(1);
    // Sem "Deixar de fora": a decisão é a capa.
    expect(temBotao("Deixar de fora", dialogo())).toBe(false);

    // O julgamento, logo abaixo do texto: o símbolo SEMPRE com o texto.
    await tocar(botao("✓ Confio", dialogo()));
    await ate(() => textoDaTela().includes("Marcado: ✓ Confio"), "o veredito marcado");
    expect(api.julgamentos).toEqual([{ noticiaId: "n1", tipo: "fonte", veredito: "confio" }]);
    expect(temBotao("✗ Não confio", dialogo())).toBe(false);
    // Fechar sem marcar só não conta: a Data abre e fica sem julgamento.
    await tocar(botao("Data", dialogo()));
    await ate(() => textoDaTela().includes("Pista de data da notícia n1"), "a segunda pista");
    expect(temBotao("✓ Confio", dialogo())).toBe(true);
    await tocar(botao("Adicionar ao Jornal", dialogo()));
    expect(quantas(api, "POST /jornal-escola/julgamento")).toBe(1);

    await adicionar("Manchete da notícia n2");
    await adicionar("Manchete da notícia n3");
    expect(textoDaTela()).toContain("3/3");

    // A terceira leva a mesa SOZINHA à capa, onde está o publicar (ajuste do PO), com o foco na aba.
    expect(botao("Primeira Página").getAttribute("aria-selected")).toBe("true");
    await ate(() => document.activeElement === botao("Primeira Página"), "o foco na aba da capa");
    expect(temBotao("Publicar 1ª Edição")).toBe(true);

    // A quarta: o aviso da capa cheia, e a ação não entra.
    await tocar(botao("Pautas da Semana"));
    await abrirCartao("Manchete da notícia n4");
    expect(textoDaTela()).toContain("A capa cabe só 3 matérias.");
    await tocar(botao("Voltar para a Mesa"));

    // E3 — a diagramação é pedida com as três vagas cheias; o modal NÃO tem a pergunta.
    await tocar(botao("Primeira Página"));
    await ate(() => quantas(api, "POST /jornal-escola/diagramar") === 1, "o POST diagramar");
    await ate(() => !botao("Publicar 1ª Edição").disabled, "o botão de publicar");
    await tocar(botao("Publicar 1ª Edição"));
    await ate(() => textoDaTela().includes("Confirmar Publicação da Capa"), "o modal");
    expect(textoDaTela()).not.toContain("Como as três matérias foram escolhidas?");
    expect(quantas(api, "GET /jornal-escola/gate")).toBe(0);
    await tocar(botao("Distribuir Jornal Agora"));
    expect(api.edicao1?.slots).toEqual(["n1", "n2", "n3"]);
    expect(api.edicao1?.layout).toBe("columns");

    // O motivo, DEPOIS do latch, com os rótulos novos.
    await ate(() => textoDaTela().includes("Como as três matérias foram escolhidas?"), "a tela de motivo");
    expect(textoDaTela()).not.toContain("dupla");
    expect(textoDaTela()).toContain("Escolhi porque chamou atenção");
    await tocar(radio("Escolhi porque conferi as pistas"));
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

    // O professor libera a revisão: o Montador da Chave.
    api.liberar("revisao");
    await passar(5_100);
    await ate(() => textoDaTela().includes("Ferramenta de Checagem do Bento"), "a Chave");
    expect(textoDaTela()).toContain("Combinem antes de tocar.");
    const gatesAntes = quantas(api, "GET /jornal-escola/gate");
    expect(botao("Pronto").disabled).toBe(true);

    // Tocar no bloco e depois na vaga: a Foto (uma isca) vai para a 1ª vaga.
    await tocar(botao("Foto", document.querySelector(".chave__bandeja") ?? document.body));
    expect(textoDaTela()).toContain("Foto escolhido. Toque numa vaga para colocar.");
    await tocar(botao("Colocar aqui"));
    expect(document.querySelectorAll(".unooria-puzzle-track .chave__vaga")).toHaveLength(1);
    // Tocar na vaga cheia devolve o bloco à bandeja; e põe de novo.
    await tocar(botao("Foto", document.querySelector(".unooria-puzzle-track") ?? document.body));
    expect(document.querySelectorAll(".unooria-puzzle-track .chave__vaga")).toHaveLength(0);
    await montarVaga("Foto", "foto", ["aprova", "reprova"], "seguir");
    // Os cartões da Fonte vêm embaralhados (o de índice 1 primeiro): a escolha vai pela posição CANÔNICA.
    await montarVaga("Fonte", "fonte", ["aprova", "reprova"], "parar");
    expect(botao("Pronto").disabled).toBe(true);
    await montarVaga("Data", "data", ["aprova", "reprova"], "parar");
    expect(botao("Pronto").disabled).toBe(true);
    expect(textoDaTela()).toContain("Escolha os três blocos e marque todas as opções");
    await marcar("repeticao", "todas");
    expect(botao("Pronto").disabled).toBe(false);

    // O Pronto pede confirmação; o envio é um só, sem correção.
    await tocar(botao("Pronto"));
    await ate(() => textoDaTela().includes("Depois de enviar, a Chave não muda."), "a confirmação");
    expect(api.chave).toBeNull();
    await tocar(botao("Enviar a Chave"));
    await ate(() => textoDaTela().includes("Chave do Editor montada!"), "a Chave montada");
    expect(api.chave).toEqual({
      vagas: [
        { bloco: "foto", lados: ["aprova", "reprova"], seFalhar: "seguir" },
        { bloco: "fonte", lados: ["aprova", "reprova"], seFalhar: "parar" },
        { bloco: "data", lados: ["aprova", "reprova"], seFalhar: "parar" },
      ],
      repeticao: "todas",
    });
    expect(api.enviosDaChave).toBe(1);
    expect(textoDaTela()).not.toMatch(/Voltou para a bandeja|não abre a chave|Tente outro/);
    await passar(10_000);
    expect(quantas(api, "GET /jornal-escola/gate")).toBe(gatesAntes);

    // A revisão: os marcadores por vaga.
    await tocar(botao("Abrir a Mesa de Revisão"));
    await ate(() => textoDaTela().includes("Mesa de Revisão Pericial"), "a revisão");
    expect(botao("Primeira Página").getAttribute("aria-selected")).toBe("true");
    expect(textoDaTela()).toContain("Troque os furos por matérias verificadas!");
    await ate(() => textoDaTela().includes("Fato que já passou"), "os marcadores");
    expect(textoDaTela()).toContain("Fonte sem confirmação");
    expect(textoDaTela()).toContain("Matéria verificada");

    // Na revisão, a pista já lida na mesa nasce FECHADA, o toque registra a fase 2 — e NÃO há julgamento.
    const pistasAntes = quantas(api, "POST /jornal-escola/pista");
    await tocar(botao("Pautas da Semana"));
    await abrirCartao("Manchete da notícia n1");
    expect(botao("Fonte", dialogo()).getAttribute("aria-expanded")).toBe("false");
    await tocar(botao("Fonte", dialogo()));
    expect(textoDaTela()).toContain("Pista de fonte da notícia n1");
    expect(quantas(api, "POST /jornal-escola/pista")).toBe(pistasAntes + 1);
    expect(temBotao("✓ Confio", dialogo())).toBe(false);
    expect(textoDaTela()).not.toContain("Marcado:");
    await tocar(botao("Voltar para a Mesa"));
    await tocar(botao("Primeira Página"));

    // Troca a notícia antiga (vaga 2) por outra.
    const trocas = Array.from(document.querySelectorAll("button")).filter((b) => (b.textContent ?? "").includes("Trocar Matéria"));
    expect(trocas).toHaveLength(3);
    await tocar(trocas[1] as HTMLButtonElement);
    expect(botao("Pautas da Semana").getAttribute("aria-selected")).toBe("true");
    await adicionar("Manchete da notícia n4");
    expect(botao("Primeira Página").getAttribute("aria-selected")).toBe("true");
    await publicarNaCapa("Publicar 2ª Edição Revisada");
    expect(api.edicao2?.slots).toEqual(["n1", "n4", "n3"]);

    // O comparativo, e o "Testar a minha Chave".
    await ate(() => textoDaTela().includes("1ª Edição: 1 de 3 verificadas ➔ 2ª Edição: 2 de 3 verificadas!"), "o comparativo");
    expect(textoDaTela()).not.toContain("Agora sim!");
    await tocar(botao("Testar a minha Chave"));

    // A simulação: a Chave dela como roteiro, a isca pulada, e as matérias uma por vez.
    await ate(() => textoDaTela().includes("Teste da Chave do Editor"), "a simulação");
    await ate(() => textoDaTela().includes("Matéria 1 de 2"), "a primeira matéria");
    expect(textoDaTela()).toContain("Sua Chave do Editor");
    expect(textoDaTela()).toContain("Esta matéria não tem foto. Siga para o próximo passo.");
    expect(textoDaTela()).toContain("Se falhar: Não publico");
    expect(textoDaTela()).not.toContain("Bento");

    // A ordem NÃO é forçada: a Autoria (fora da Chave) abre primeiro; aberta, ela exige a marcação.
    await tocar(pistaDaMateria("Autoria"));
    expect(textoDaTela()).toContain("Pista de autoria da s1");
    expect(textoDaTela()).toContain("Marque se você confia nesta pista para seguir.");
    expect(botao("Não publicar").disabled).toBe(true);
    await tocar(pistaDaMateria("Fonte"));
    expect(pistaDaMateria("Fonte").getAttribute("aria-expanded")).toBe("false");
    await tocar(pistaDaMateria("Autoria"));
    expect(pistaDaMateria("Autoria").getAttribute("aria-expanded")).toBe("true");
    await tocar(botao("✗ Não confio"));
    expect(botao("Não publicar").disabled).toBe(false);
    await tocar(pistaDaMateria("Fonte"));
    await tocar(botao("✓ Confio"));
    await tocar(botao("Não publicar"));

    await ate(() => textoDaTela().includes("Matéria 2 de 2"), "a segunda matéria");
    await tocar(pistaDaMateria("Data"));
    await tocar(botao("✓ Confio"));
    expect(api.simulacao).toBeNull();
    await tocar(botao("Publicar"));

    // O envio é um só, com as pistas na ordem em que ela abriu; a referência é a mesma para todos.
    await ate(() => textoDaTela().includes(REFERENCIA_DE_TESTE), "a frase de referência");
    expect(api.simulacao).toEqual({
      materias: [
        {
          id: "s1",
          passos: [
            { tipo: "autoria", veredito: "nao_confio" },
            { tipo: "fonte", veredito: "confio" },
          ],
          decisao: "nao_publicar",
        },
        { id: "s2", passos: [{ tipo: "data", veredito: "confio" }], decisao: "publicar" },
      ],
    });
    expect(textoDaTela()).not.toMatch(/acert|nível|nota/i);
    await tocar(botao("Continuar"));

    // E6 — o boato, numa tela NEUTRA: sem Bento, e as duas decisões à mão desde o início.
    await ate(() => textoDaTela().includes("Chegou uma mensagem"), "a transferência");
    await ate(() => textoDaTela().includes(BOATO_DE_TESTE.mensagem), "o boato");
    expect(document.querySelector(".peca-unoochat .unc-messagebubble__forwarded")).not.toBeNull();
    expect(textoDaTela()).not.toContain("Bento");
    expect(botao("Repassar para o grupo").disabled).toBe(false);
    expect(botao("Não repassar").disabled).toBe(false);
    expect(temBotao("✓ Confio")).toBe(false);
    // As pistas abertas ANTES da decisão, na ordem (abrir não vai à api).
    const chamadasAntes = api.chamadas.length;
    await tocar(botao("Data"));
    expect(textoDaTela()).toContain("Pista de data do boato");
    await tocar(botao("Fonte"));
    await tocar(botao("Data"));
    await tocar(botao("Data"));
    expect(api.chamadas.length).toBe(chamadasAntes);
    await tocar(botao("Não repassar"));
    expect(api.transferencia).toEqual({ pistas: ["data", "fonte"], decisao: "nao_repassar" });

    // A síntese ÚNICA, a conversa com a professora, e o fim.
    await ate(() => textoDaTela().includes("Antes de repassar qualquer aviso"), "a síntese");
    expect(textoDaTela()).toContain("a turma vai conversar sobre esta mensagem com a professora");
    expect(textoDaTela()).not.toContain("Você comprovou");
    expect(temBotao("Repassar para o grupo")).toBe(false);
    await tocar(botao("Concluir Missão"));
    await ate(() => textoDaTela().includes("Edição Publicada — Modo Leitura"), "o modo leitura");
    expect(temBotao("Ver 1ª Edição")).toBe(true);
    expect(temBotao("Ver 2ª Edição")).toBe(true);

    expect(handle.concluir).toHaveBeenCalledTimes(1);
    const concluido = handle.concluir.mock.calls[0]?.[0] as { score?: number; dados?: Record<string, unknown> };
    expect(concluido.score).toBeUndefined();
    expect(concluido.dados).toEqual({ publicouAPrimeira: true, publicouASegunda: true, simulou: true, decidiu: true });

    // Nenhuma chamada a /evidencias: P1/P2 saíram.
    expect(api.chamadas.filter((c) => c.includes("/evidencias"))).toEqual([]);

    // A telemetria: os eventos do PRD §13 e os do Canal A, só com ids e números.
    const eventos = handle.track.mock.calls.map((c) => `${String(c[0])} ${String(c[1])}`);
    for (const esperado of [
      "attempted missao:iniciar",
      "progressed etapa:entrar",
      "interacted noticia:inspecionar",
      "interacted pista:julgar",
      "scored edicao:publicar",
      "progressed resultado:ver",
      "interacted chave:montar",
      "interacted simulacao:enviar",
      "interacted transferencia:decidir",
      "completed exp04ef1b",
    ]) {
      expect(eventos).toContain(esperado);
    }
    expect(eventos.filter((e) => e === "scored edicao:publicar")).toHaveLength(2);
    const carga = JSON.stringify(handle.track.mock.calls);
    for (const proibido of [
      "Manchete",
      "Pista de",
      "Estudante de Teste",
      "URGENTE",
      '"confio"',
      '"nao_confio"',
      '"aprova"',
      '"reprova"',
      '"nao_repassar"',
      '"nao_publicar"',
    ]) {
      expect(carga).not.toContain(proibido);
    }
  }, 60_000);

  test("o veredito que vale é o da RESPOSTA (o primeiro do par), e a pista julgada não muda mais", async () => {
    const api = new RedacaoFalsa();
    sdk.handle = montarHandle(api);
    await abrir();
    await tocar(botao("Explorar Mesa de Notícias"));
    await ate(() => textoDaTela().includes("Pautas da Semana"), "a mesa");
    await abrirCartao("Manchete da notícia n2");
    await tocar(botao("Autoria", dialogo()));
    await ate(() => textoDaTela().includes("Pista de autoria da notícia n2"), "a pista");
    // Outra aba do mesmo computador já marcou "não confio": o primeiro vale.
    api.julgamentos.push({ noticiaId: "n2", tipo: "autoria", veredito: "nao_confio" });
    await tocar(botao("✓ Confio", dialogo()));
    await ate(() => textoDaTela().includes("Marcado: ✗ Não confio"), "o veredito da resposta");
    expect(textoDaTela()).not.toContain("Marcado: ✓ Confio");
    expect(temBotao("✓ Confio", dialogo())).toBe(false);
  });
});

describe("F5 relê da api e reconstrói a tela", () => {
  test("em cada degrau, a aba que cai volta ao mesmo lugar", async () => {
    const api = new RedacaoFalsa();
    sdk.handle = montarHandle(api);
    await abrir();
    await tocar(botao("Explorar Mesa de Notícias"));
    await ate(() => textoDaTela().includes("Pautas da Semana"), "a mesa");

    // A página em montagem, a pista aberta e julgada.
    await abrirCartao("Manchete da notícia n1");
    await tocar(botao("Data", dialogo()));
    await ate(() => textoDaTela().includes("Pista de data da notícia n1"), "a pista");
    await tocar(botao("✗ Não confio", dialogo()));
    await ate(() => textoDaTela().includes("Marcado: ✗ Não confio"), "o julgamento");
    await tocar(botao("Adicionar ao Jornal", dialogo()));
    await adicionar("Manchete da notícia n5");

    await f5();
    await ate(() => textoDaTela().includes("Pautas da Semana"), "a mesa depois do F5");
    expect(textoDaTela()).toContain("2/3");
    await abrirCartao("Manchete da notícia n1");
    const data = botao("Data", dialogo());
    expect(data.getAttribute("aria-expanded")).toBe("true");
    expect(textoDaTela()).toContain("Pista de data da notícia n1");
    // O julgamento volta do `estado.julgamentos`, travado.
    expect(textoDaTela()).toContain("Marcado: ✗ Não confio");
    expect(temBotao("✓ Confio", dialogo())).toBe(false);
    expect(quantas(api, "POST /jornal-escola/pista")).toBe(1);
    await tocar(botao("Voltar para a Mesa"));

    // Publica; o F5 no motivo volta ao motivo.
    await adicionar("Manchete da notícia n6");
    await publicarNaCapa("Publicar 1ª Edição");
    await ate(() => textoDaTela().includes("Como as três matérias foram escolhidas?"), "o motivo");
    await f5();
    await ate(() => textoDaTela().includes("Como as três matérias foram escolhidas?"), "o motivo depois do F5");
    await tocar(radio("Escolhi porque chamou atenção"));
    await tocar(botao("Enviar resposta"));

    // Espera → resultado, com F5 no meio.
    await ate(() => textoDaTela().includes("Edição em Análise na Escola"), "a espera");
    await f5();
    await ate(() => textoDaTela().includes("Edição em Análise na Escola"), "a espera depois do F5");
    api.liberar("resultado");
    await f5();
    await ate(() => textoDaTela().includes("notícias verificadas nesta edição"), "o resultado depois do F5");
    expect(textoDaTela()).toContain("2 de 3 notícias verificadas nesta edição (67%)");

    // A Chave em montagem sobrevive ao F5; montada, o F5 cai na revisão.
    api.liberar("revisao");
    await f5();
    await ate(() => textoDaTela().includes("Ferramenta de Checagem do Bento"), "a Chave depois do F5");
    await montarVaga("Fonte", "fonte", ["aprova", "reprova"], "parar");
    await f5();
    await ate(() => textoDaTela().includes("Ferramenta de Checagem do Bento"), "a Chave em montagem depois do F5");
    expect(document.querySelectorAll(".unooria-puzzle-track .chave__vaga")).toHaveLength(1);
    expect(document.querySelector<HTMLInputElement>('input[name="se-falhar-fonte"][value="parar"]')?.checked).toBe(true);
    await montarVaga("Data", "data", ["aprova", "reprova"], "parar");
    await montarVaga("Autoria", "autoria", ["aprova", "reprova"], "parar");
    await marcar("repeticao", "todas");
    await tocar(botao("Pronto"));
    await tocar(botao("Enviar a Chave"));
    await ate(() => textoDaTela().includes("Chave do Editor montada!"), "a Chave montada");
    await f5();
    await ate(() => textoDaTela().includes("Mesa de Revisão Pericial"), "a revisão depois do F5");
    expect(botao("Primeira Página").getAttribute("aria-selected")).toBe("true");
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
    await tocar(botao("Pautas da Semana"));
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

    // A simulação: a pista marcada na 1ª matéria sobrevive ao F5, na ordem.
    await tocar(botao("Testar a minha Chave"));
    await ate(() => textoDaTela().includes("Matéria 1 de 2"), "a simulação");
    await tocar(pistaDaMateria("Fonte"));
    await tocar(botao("✗ Não confio"));
    await f5();
    await ate(() => textoDaTela().includes("Matéria 1 de 2"), "a simulação depois do F5");
    expect(pistaDaMateria("Fonte").getAttribute("aria-expanded")).toBe("true");
    expect(textoDaTela()).toContain("Marcado: ✗ Não confio");
    await tocar(botao("Não publicar"));
    await ate(() => textoDaTela().includes("Matéria 2 de 2"), "a segunda matéria");
    await tocar(botao("Publicar"));
    await ate(() => textoDaTela().includes(REFERENCIA_DE_TESTE), "a referência");
    expect(api.simulacao?.materias[0]).toEqual({ id: "s1", passos: [{ tipo: "fonte", veredito: "nao_confio" }], decisao: "nao_publicar" });

    // O F5 depois do envio cai direto no boato; a pista aberta antes do F5 continua contando.
    await f5();
    await ate(() => textoDaTela().includes(BOATO_DE_TESTE.mensagem), "o boato depois do F5");
    await tocar(botao("Autoria"));
    await f5();
    await ate(() => textoDaTela().includes(BOATO_DE_TESTE.mensagem), "o boato depois do segundo F5");
    expect(botao("Autoria").getAttribute("aria-expanded")).toBe("true");
    await tocar(botao("Repassar para o grupo"));
    expect(api.transferencia).toEqual({ pistas: ["autoria"], decisao: "repassar" });
    await ate(() => textoDaTela().includes("Antes de repassar qualquer aviso"), "a síntese");

    // Decidida, o F5 volta à síntese, sem os botões.
    await f5();
    await ate(() => textoDaTela().includes("Antes de repassar qualquer aviso"), "a síntese depois do F5");
    expect(temBotao("Repassar para o grupo")).toBe(false);
    await tocar(botao("Concluir Missão"));
    await ate(() => textoDaTela().includes("Edição Publicada — Modo Leitura"), "o modo leitura");

    await f5();
    await ate(() => textoDaTela().includes("Edição Publicada — Modo Leitura"), "o modo leitura depois do F5");
    expect(api.chamadas.filter((c) => c.includes("/evidencias"))).toEqual([]);
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
