import { describe, expect, test } from "vitest";
import {
  atividadesDaSelecao,
  atividadesDoInstanooria,
  atividadesDoJornal,
  atividadesDoJuri,
  aceitaEquipes,
  atividadesDoPortaVoz,
  caminhoDoEmAndamento,
  corpoDoEmAndamento,
  estadoDoInstanooria,
  ordenarAtividades,
  rotaDaAtividade,
  rotaDaNovaAtividade,
  serieDaMissao,
  temAtividades,
  textoDasRodadas,
} from "./atividades";
import { concluirCriacao, destinoDepoisDeCriar } from "./criar-atividade";

/**
 * AS ATIVIDADES DA MISSÃO (ADR-130): a lista da ficha, para onde cada uma
 * leva, e o fim da criação — pôr no ar e montar as equipes, na ordem certa.
 */
describe("a lista de atividades", () => {
  test("as nove missões com atividade — as oito do par da api e a individual (exp03em1b)", () => {
    expect(["exp08ef1b", "exp07ef1b", "exp04ef1b", "exp05ef1b", "exp06ef1b", "exp02em1b", "exp02ef1b", "exp01em1b", "exp03em1b"].every(temAtividades)).toBe(true);
    /* A Missão Tempestade, versão anterior (ADR-181), segue sem atividade. */
    expect(temAtividades("exp02em1b-v0")).toBe(false);
    expect(temAtividades(undefined)).toBe(false);
  });

  test("a série sai do código da missão", () => {
    expect(serieDaMissao("exp07ef1b")).toBe("7EF");
    expect(serieDaMissao("exp04ef1b")).toBe("4EF");
    expect(serieDaMissao("exp06ef1b")).toBe("6EF");
    expect(serieDaMissao("exp02em1b")).toBe("2EM");
    expect(serieDaMissao("exp02ef1b")).toBe("2EF");
    expect(serieDaMissao("exp01em1b")).toBe("1EM");
    expect(serieDaMissao("exp03em1b")).toBe("3EM");
    expect(serieDaMissao("app-90-plano-de-aula")).toBeNull();
  });

  test("o Instanooria em três estados: ativa, pronta (revisão ou encerrada), em preparo", () => {
    expect(estadoDoInstanooria("ativa")).toBe("em-andamento");
    expect(estadoDoInstanooria("revisao")).toBe("pronta");
    expect(estadoDoInstanooria("encerrada")).toBe("pronta");
    expect(estadoDoInstanooria("gerando")).toBe("em-preparo");
    const [a] = atividadesDoInstanooria([
      {
        id: "a1",
        turmaId: "t",
        titulo: "Revolução",
        disciplina: "História",
        recorte: "França",
        perguntaChave: "Conquista ou terror?",
        status: "ativa",
        criadoEm: "2026-10-01T10:00:00Z",
        posts: 120,
        sessoes: 0,
      },
    ]);
    expect(a).toMatchObject({ estado: "em-andamento", rodadas: 0, complemento: "Conquista ou terror?", exclusao: { posts: 120, sessoes: 0 } });
  });

  test("a em andamento vem primeiro, e depois da mais nova à mais velha", () => {
    const lista = atividadesDaSelecao({
      ativa: null,
      historico: [
        { id: "velha", tema: "Velha", foco: null, origem: "padrao", ativa: false, criadaEm: "2026-09-01T00:00:00Z", rodadas: 2, imagensAprovadas: true },
        { id: "no-ar", tema: "No ar", foco: "Bairro", origem: "ia", ativa: true, criadaEm: "2026-09-10T00:00:00Z", rodadas: 1, imagensAprovadas: true },
        { id: "nova", tema: "Nova", foco: null, origem: "ia", ativa: false, criadaEm: "2026-09-20T00:00:00Z", rodadas: 0, imagensAprovadas: false },
      ],
    });
    expect(ordenarAtividades(lista).map((a) => a.id)).toEqual(["no-ar", "nova", "velha"]);
    expect(lista.find((a) => a.id === "no-ar")?.detalhe).toBe("Bairro · gerada com IA");
    // As imagens ainda não foram aprovadas (ADR-146): em preparo, sem "Usar esta atividade agora".
    expect(lista.find((a) => a.id === "nova")?.estado).toBe("em-preparo");
    expect(lista.find((a) => a.id === "velha")?.estado).toBe("pronta");
  });

  test("o Jornal: sem as imagens aprovadas, a atividade está em preparo (ADR-147)", () => {
    const lista = atividadesDoJornal({
      ativo: null,
      historico: [
        { id: "no-ar", disciplina: "Ciências", tema: "No ar", origem: "ia", ativo: true, criadoEm: "2026-10-01T00:00:00Z", rodadas: 1, imagensAprovadas: false },
        { id: "pronta", disciplina: "Ciências", tema: "Pronta", origem: "padrao", ativo: false, criadoEm: "2026-10-02T00:00:00Z", rodadas: 0, imagensAprovadas: true },
        { id: "nova", disciplina: "Ciências", tema: "Nova", origem: "ia", ativo: false, criadoEm: "2026-10-03T00:00:00Z", rodadas: 0, imagensAprovadas: false },
      ],
    });
    /* A que já está no ar continua em andamento: a regra só vale para ENTRAR no ar. */
    expect(lista.map((a) => [a.id, a.estado])).toEqual([
      ["no-ar", "em-andamento"],
      ["pronta", "pronta"],
      ["nova", "em-preparo"],
    ]);
  });

  test("o Júri: o pacote é a atividade, com o rótulo da disciplina", () => {
    const [a] = atividadesDoJuri(
      {
        ativo: null,
        historico: [
          { id: "p1", disciplina: "ciencias", tema: "Feira da água", origem: "ia", ativo: true, criadoEm: "2026-10-02T10:00:00Z", rodadas: 1, imagensAprovadas: true },
        ],
      },
      (slug) => (slug === "ciencias" ? "Ciências" : slug),
    );
    expect(a).toMatchObject({ id: "p1", titulo: "Feira da água", detalhe: "Ciências · gerada com IA", estado: "em-andamento", rodadas: 1 });
  });

  test("o Júri: sem as imagens aprovadas, a atividade está em preparo", () => {
    const lista = atividadesDoJuri(
      {
        ativo: null,
        historico: [
          { id: "no-ar", disciplina: "ciencias", tema: "No ar", origem: "ia", ativo: true, criadoEm: "2026-10-01T00:00:00Z", rodadas: 1, imagensAprovadas: true },
          { id: "pronta", disciplina: "ciencias", tema: "Pronta", origem: "ia", ativo: false, criadoEm: "2026-10-02T00:00:00Z", rodadas: 0, imagensAprovadas: true },
          { id: "nova", disciplina: "ciencias", tema: "Nova", origem: "ia", ativo: false, criadoEm: "2026-10-03T00:00:00Z", rodadas: 0, imagensAprovadas: false },
        ],
      },
      (slug) => slug,
    );
    expect(lista.map((a) => [a.id, a.estado])).toEqual([
      ["no-ar", "em-andamento"],
      ["pronta", "pronta"],
      ["nova", "em-preparo"],
    ]);
  });

  test("as rodadas em palavras", () => {
    expect(textoDasRodadas(0)).toBe("nunca rodou");
    expect(textoDasRodadas(1)).toBe("1 rodada");
    expect(textoDasRodadas(3)).toBe("3 rodadas");
  });
});

describe("para onde a atividade leva", () => {
  const rota = "/professor/entre-redes/7-ano/unidade-1";

  test("o Instanooria tem a tela dele; as outras, os resultados com a atividade na URL", () => {
    expect(rotaDaAtividade(rota, "exp08ef1b", "t1", "a1")).toBe("/professor/atividades/a1");
    expect(rotaDaAtividade(rota, "exp07ef1b", "t1", "c1")).toBe(`${rota}/resultados?turmaId=t1&cobertura=c1`);
    expect(rotaDaAtividade(rota, "exp04ef1b", "t1", "p1")).toBe(`${rota}/resultados?turmaId=t1&pacote=p1`);
    expect(rotaDaAtividade(rota, "exp05ef1b", "t1", "p1")).toBe(`${rota}/resultados?turmaId=t1&pacote=p1`);
    expect(rotaDaAtividade(rota, "exp06ef1b", "t1", "p1")).toBe(`${rota}/resultados?turmaId=t1&pacote=p1`);
  });

  test("a criação: a do Instanooria é a dele", () => {
    expect(rotaDaNovaAtividade(rota, "exp08ef1b", "t1")).toBe("/professor/atividades/nova?turmaId=t1");
    expect(rotaDaNovaAtividade(rota, "exp07ef1b", "t1")).toBe(`${rota}/atividades/nova?turmaId=t1`);
  });

  test("o 'Usar esta atividade agora' de cada missão", () => {
    expect(caminhoDoEmAndamento("exp08ef1b", "t", "a")).toBe("/atividades/a/ativar");
    expect(caminhoDoEmAndamento("exp07ef1b", "t", "c")).toBe("/a-selecao/turmas/t/coberturas/c/em-andamento");
    expect(caminhoDoEmAndamento("exp04ef1b", "t", "p")).toBe("/jornal-escola/turmas/t/pacotes/p/em-andamento");
    expect(caminhoDoEmAndamento("exp05ef1b", "t", "p")).toBe("/quem-mandou-isso/turmas/t/pacotes/p/em-andamento");
    expect(caminhoDoEmAndamento("exp06ef1b", "t", "p")).toBe("/juri-estadual/turmas/t/pacotes/p/em-andamento");
    expect(caminhoDoEmAndamento("exp01em1b", "t", "p")).toBe("/assistente-invisivel/turmas/t/pacotes/p/em-andamento");
    /* O Porta-Voz dos Dados: o em andamento é da turma, e o pacote vai no corpo. */
    expect(caminhoDoEmAndamento("exp03em1b", "t", "p")).toBe("/porta-voz-dos-dados/turmas/t/em-andamento");
    expect(corpoDoEmAndamento("exp03em1b", "p")).toEqual({ pacoteId: "p" });
    expect(corpoDoEmAndamento("exp08ef1b", "a", true)).toEqual({ forcar: true });
    expect(corpoDoEmAndamento("exp07ef1b", "c")).toEqual({});
  });

  test("a exp03em1b é individual: sem equipe", () => {
    expect(aceitaEquipes("exp03em1b")).toBe(false);
    expect(aceitaEquipes("exp02em1b")).toBe(true);
  });

  test("o Porta-Voz dos Dados: o rascunho da curadoria não é atividade", () => {
    const lista = atividadesDoPortaVoz(
      {
        turma: { id: "t", nome: "3A", serie: "3EM" },
        emAndamento: { pacoteId: "p1", rodada: 1 },
        pacotes: [
          { id: "p1", turmaId: "t", origem: "padrao", disciplina: "biologia", tema: "Água", ativo: true, aprovadoEm: "2026-10-28T10:00:00Z", criadoEm: "2026-10-28T10:00:00Z", rodadas: 1 },
          { id: "r1", turmaId: "t", origem: "ia", disciplina: "historia", tema: "Patrimônio", ativo: false, aprovadoEm: null, criadoEm: "2026-10-28T11:00:00Z", rodadas: 0 },
        ],
        padrao: {} as never,
        disciplinas: [],
      },
      (slug) => slug.toUpperCase(),
    );
    expect(lista).toEqual([
      { id: "p1", titulo: "Água", detalhe: "BIOLOGIA · conteúdo da Unooria", estado: "em-andamento", criadaEm: "2026-10-28T10:00:00Z", rodadas: 1 },
    ]);
  });

  test("'Eu separo' leva o número de computadores para a página", () => {
    expect(destinoDepoisDeCriar("/r?turmaId=t", { modo: "manual", computadores: 4 })).toBe("/r?turmaId=t&separar=4");
    expect(destinoDepoisDeCriar("/r?turmaId=t", { modo: "sorteio", computadores: 4 })).toBe("/r?turmaId=t");
  });
});

describe("o fim da criação", () => {
  type Chamada = { url: string; metodo: string; corpo: unknown };

  function buscaFalsa(respostas: Record<string, { status: number; corpo: unknown }>) {
    const chamadas: Chamada[] = [];
    const busca = async (url: string, init?: RequestInit) => {
      const metodo = init?.method ?? "GET";
      chamadas.push({ url, metodo, corpo: init?.body ? JSON.parse(String(init.body)) : null });
      const chave = Object.keys(respostas).find((k) => `${metodo} ${url}`.endsWith(k));
      const r = chave ? respostas[chave] : { status: 200, corpo: {} };
      return new Response(JSON.stringify(r?.corpo ?? {}), { status: r?.status ?? 200 });
    };
    return { busca, chamadas };
  }

  const alvo = { expId: "exp07ef1b" as const, turmaId: "t", atividadeId: "c" };

  test("sorteio: põe no ar, pede o sorteio e grava o que a api sorteou — nessa ordem", async () => {
    const { busca, chamadas } = buscaFalsa({
      "/sugestao": {
        status: 200,
        corpo: { modo: "sorteio", computadores: 2, equipes: [{ nome: "Equipe 1", membros: [{ id: "e1", nome: "Ana" }], grupo: null, mista: false }], semEquipe: [], agrupamento: null },
      },
    });
    const fim = await concluirCriacao({ ...alvo, equipes: { modo: "sorteio", computadores: 2 }, porNoAr: true }, busca);
    expect(fim.avisos).toEqual([]);
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      "POST /api/plataforma/a-selecao/turmas/t/coberturas/c/em-andamento",
      "PUT /api/plataforma/salas/turma/t/missoes/exp07ef1b",
      "GET /api/plataforma/equipes/turma/t/missao/exp07ef1b/atividade/c",
      "POST /api/plataforma/equipes/turma/t/missao/exp07ef1b/atividade/c/sugestao",
      "PUT /api/plataforma/equipes/turma/t/missao/exp07ef1b/atividade/c",
    ]);
    expect(chamadas[1]?.corpo).toEqual({ estado: "liberada" });
    expect(chamadas[4]?.corpo).toEqual({
      versao: 0,
      modo: "sorteio",
      computadores: 2,
      ausentes: [],
      equipes: [{ nome: "Equipe 1", membros: ["e1"] }],
    });
  });

  test("um aluno por computador grava a montagem sem equipes; 'Eu separo' não grava nada", async () => {
    const individual = buscaFalsa({});
    await concluirCriacao({ ...alvo, equipes: { modo: "individual" }, porNoAr: false }, individual.busca);
    expect(individual.chamadas).toEqual([
      { url: "/api/plataforma/equipes/turma/t/missao/exp07ef1b/atividade/c", metodo: "GET", corpo: null },
      {
        url: "/api/plataforma/equipes/turma/t/missao/exp07ef1b/atividade/c",
        metodo: "PUT",
        corpo: { versao: 0, modo: "individual", computadores: null, ausentes: [], equipes: [] },
      },
    ]);

    const manual = buscaFalsa({});
    await concluirCriacao({ ...alvo, equipes: { modo: "manual", computadores: 3 }, porNoAr: false }, manual.busca);
    expect(manual.chamadas).toEqual([]);
  });

  test("atividade que JÁ tinha equipes (o 'Criar atividade' idempotente): grava com a versão atual, sem 409", async () => {
    const { busca, chamadas } = buscaFalsa({
      "GET /api/plataforma/equipes/turma/t/missao/exp07ef1b/atividade/c": {
        status: 200,
        corpo: { permitida: true, montagem: { versao: 3 }, equipes: [] },
      },
    });
    const fim = await concluirCriacao({ ...alvo, equipes: { modo: "individual" }, porNoAr: false }, busca);
    expect(fim.avisos).toEqual([]);
    expect(chamadas.find((c) => c.metodo === "PUT")?.corpo).toMatchObject({ versao: 3, modo: "individual" });
  });

  test("o Porta-Voz dos Dados: o pacote vai no corpo do em andamento, e nenhuma equipe é gravada", async () => {
    const { busca, chamadas } = buscaFalsa({});
    const fim = await concluirCriacao(
      { expId: "exp03em1b", turmaId: "t", atividadeId: "p", equipes: { modo: "individual" }, porNoAr: true },
      busca,
    );
    expect(fim.avisos).toEqual([]);
    expect(chamadas).toEqual([
      { url: "/api/plataforma/porta-voz-dos-dados/turmas/t/em-andamento", metodo: "POST", corpo: { pacoteId: "p" } },
      { url: "/api/plataforma/salas/turma/t/missoes/exp03em1b", metodo: "PUT", corpo: { estado: "liberada" } },
    ]);
  });

  test("pôr no ar libera a missão na sala (ADR-146); sem pôr no ar, a sala não é tocada", async () => {
    const noAr = buscaFalsa({});
    await concluirCriacao({ ...alvo, equipes: { modo: "manual", computadores: 2 }, porNoAr: true }, noAr.busca);
    expect(noAr.chamadas).toEqual([
      { url: "/api/plataforma/a-selecao/turmas/t/coberturas/c/em-andamento", metodo: "POST", corpo: {} },
      { url: "/api/plataforma/salas/turma/t/missoes/exp07ef1b", metodo: "PUT", corpo: { estado: "liberada" } },
    ]);

    const pronta = buscaFalsa({});
    await concluirCriacao({ ...alvo, equipes: { modo: "manual", computadores: 2 }, porNoAr: false }, pronta.busca);
    expect(pronta.chamadas.some((c) => c.url.includes("/salas/"))).toBe(false);
  });

  test("a liberação na sala falhou (ex.: gestor, que não libera): a atividade fica no ar e o aviso diz onde terminar", async () => {
    const { busca } = buscaFalsa({
      "PUT /api/plataforma/salas/turma/t/missoes/exp07ef1b": { status: 404, corpo: { mensagem: "Turma não encontrada." } },
    });
    const fim = await concluirCriacao({ ...alvo, equipes: { modo: "manual", computadores: 2 }, porNoAr: true }, busca);
    expect(fim.avisos).toEqual([
      "A atividade está em andamento, mas a missão não foi liberada na Sala de Aula: Turma não encontrada.",
    ]);
  });

  test("uma falha no meio NÃO desfaz nada: a atividade existe, e o aviso diz o que faltou", async () => {
    const { busca } = buscaFalsa({
      "/em-andamento": { status: 403, corpo: { mensagem: "Recurso desligado." } },
      "/sugestao": { status: 400, corpo: { mensagem: "Turma sem estudantes." } },
    });
    const fim = await concluirCriacao({ ...alvo, equipes: { modo: "sorteio", computadores: 2 }, porNoAr: true }, busca);
    expect(fim.avisos).toEqual([
      "A atividade foi criada, mas não entrou em andamento: Recurso desligado.",
      "A atividade foi criada, mas as equipes não foram salvas: Turma sem estudantes.",
    ]);
  });
});
