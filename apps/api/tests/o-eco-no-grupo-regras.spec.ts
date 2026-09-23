import {
  ESTRATEGIAS,
  ESTRATEGIAS_EXIGIDAS,
  FEED,
  JUSTIFICATIVAS,
  OPCOES,
  REACOES,
  TOTAL_DE_CARDS,
  opcaoDo,
  semGabarito,
} from "../src/o-eco-no-grupo/catalogo";
import {
  ETAPAS,
  PASSOS,
  aguardandoATurma,
  passoEfetivo,
  proximoPasso,
  normalizarPasso,
} from "../src/o-eco-no-grupo/regras/passos";
import {
  PERCURSO_COERENTE,
  SCORE_APOS_RECUPERACAO,
  SCORE_DE_PRIMEIRA,
  SCORE_SEM_CONTRAPROVA,
  avaliarPercurso,
  pontuar,
} from "../src/o-eco-no-grupo/regras/pontuacao";
import {
  ESTADO_INICIAL,
  aplicarAcao,
  aplicarDesfazer,
  aplicarIntervencao,
  aplicarReflexao,
  aplicarVerSintese,
  desfechoDe,
  type EstadoSessao,
} from "../src/o-eco-no-grupo/regras/sessao";

/**
 * Regras puras da exp07ef1b — sem Prisma, sem HTTP.
 *
 * O que estes testes protegem não é "a função devolve X": é a mecânica
 * pedagógica. Cada bloco abaixo corresponde a um não-negociável documentado, e
 * a falha de qualquer um significa que a missão passou a medir outra coisa.
 */

function estado(parcial: Partial<EstadoSessao> = {}): EstadoSessao {
  return { ...ESTADO_INICIAL, ...parcial };
}

/** O caminho até estar apto a responder: investigou e ouviu o podcast. */
function prontoParaResponder(parcial: Partial<EstadoSessao> = {}): EstadoSessao {
  return estado({ passo: "intervencao", inspecionouMateria: true, ouviuPodcast: true, ...parcial });
}

describe("catálogo", () => {
  test("o feed tem exatamente 8 mensagens, 2 com o selo de encaminhada e 1 que abre a matéria", () => {
    // A cardinalidade é regra: o teto do 7º ano foi contado para 8, e o selo é
    // o padrão que a missão pede para o estudante reconhecer.
    expect(FEED).toHaveLength(8);
    expect(FEED.filter((m) => m.encaminhada)).toHaveLength(2);
    expect(FEED.filter((m) => m.abreMateria)).toHaveLength(1);
  });

  test("todo áudio tem transcrição — é o canal que sustenta a acessibilidade e o fallback", () => {
    for (const m of FEED.filter((m) => m.tipo === "audio")) {
      expect(m.transcricao?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test("são 3 opções, exatamente uma correta, e `semGabarito` remove os dois campos", () => {
    expect(OPCOES).toHaveLength(3);
    expect(OPCOES.filter((o) => o.correta)).toHaveLength(1);
    const publica = semGabarito(OPCOES[1]!);
    expect(Object.keys(publica).sort()).toEqual(["id", "texto"]);
    expect(JSON.stringify(OPCOES.map(semGabarito))).not.toContain("correta");
    expect(JSON.stringify(OPCOES.map(semGabarito))).not.toContain("desfecho");
  });

  test("a cadência da cascata é 2s → 3s → 2s nos três desfechos", () => {
    // Não-negociável de ofício: a espera é o pico da missão, e o suspense
    // depende de o bairro não responder instantaneamente.
    for (const desfecho of ["checada", "ruido", "conflito"] as const) {
      expect(REACOES[desfecho].map((r) => r.atrasoMs)).toEqual([2000, 3000, 2000]);
    }
  });

  test("o Admin fecha a cascata nos três caminhos — a autoridade do grupo é a última fala", () => {
    for (const desfecho of ["checada", "ruido", "conflito"] as const) {
      expect(REACOES[desfecho].at(-1)?.autor).toBe("Marcos Admin");
    }
  });

  test("há 2 estratégias prioritárias, e o formulário pede exatamente 2", () => {
    expect(PERCURSO_COERENTE).toBe(true);
    expect(ESTRATEGIAS.filter((e) => e.prioritaria)).toHaveLength(ESTRATEGIAS_EXIGIDAS);
    expect(JUSTIFICATIVAS.filter((j) => j.correta)).toHaveLength(1);
  });
});

describe("gate da turma", () => {
  test("a etapa é PISO: quem está atrás é empurrado para a frente", () => {
    // Empurrar é o que sincroniza a turma quando a professora abre a aula.
    expect(passoEfetivo("grupo", "aula2")).toBe("podcast");
    expect(passoEfetivo("chat_amara", "reflexao")).toBe("reflexao");
  });

  test("a etapa é TETO: quem terminou a Aula 1 espera no breakpoint", () => {
    // Sem teto, quem investigasse rápido decidiria e acabaria a missão sozinho
    // antes da segunda aula — e a Aula 2 da professora ficaria sem assunto.
    expect(passoEfetivo("breakpoint", "investigacao")).toBe("breakpoint");
    expect(passoEfetivo("intervencao", "investigacao")).toBe("breakpoint");
    expect(passoEfetivo("fim", "investigacao")).toBe("fim");
  });

  test("`congelar-debate` trava a turma na síntese, dos dois lados", () => {
    // No debate a turma tem de estar na mesma tela: a conversa é entre pares.
    expect(passoEfetivo("intervencao", "debate")).toBe("sintese");
    expect(passoEfetivo("reflexao", "debate")).toBe("sintese");
    expect(passoEfetivo("sintese", "debate")).toBe("sintese");
  });

  test("quem já entregou o percurso NÃO volta, nem quando a turma retrocede", () => {
    // O latch é do estudante, não da turma: uma volta de etapa não pode pedir
    // um percurso já entregue de novo.
    for (const etapa of ETAPAS) expect(passoEfetivo("fim", etapa)).toBe("fim");
  });

  test("estudante sem turma não tem gate — a missão corre no ritmo dele", () => {
    // Prendê-lo no breakpoint seria um beco sem saída: não há quem dê a largada.
    for (const passo of PASSOS) expect(passoEfetivo(passo, null)).toBe(passo);
    expect(aguardandoATurma("intervencao", null)).toBe(false);
  });

  test("`aguardandoATurma` é verdade só quando o teto puxa para trás", () => {
    expect(aguardandoATurma("intervencao", "investigacao")).toBe(true);
    expect(aguardandoATurma("grupo", "investigacao")).toBe(false);
    // Ser empurrado para a frente não é esperar: o estudante avança com a turma.
    expect(aguardandoATurma("grupo", "aula2")).toBe(false);
  });

  test("`normalizarPasso` não devolve ninguém ao começo por valor desconhecido", () => {
    expect(normalizarPasso("sintese")).toBe("sintese");
    expect(normalizarPasso("passo-de-uma-versao-futura")).toBe("chat_amara");
    expect(proximoPasso("fim")).toBeNull();
  });
});

describe("investigação", () => {
  test("as marcas são idempotentes: abrir a matéria de novo não muda nada", () => {
    const primeira = aplicarAcao(estado({ passo: "grupo" }), "inspecionar-materia", "investigacao");
    expect(primeira).toMatchObject({ ok: true, mudou: true });
    if (!primeira.ok) throw new Error("inesperado");
    const segunda = aplicarAcao(primeira.estado, "inspecionar-materia", "investigacao");
    expect(segunda).toMatchObject({ ok: true, mudou: false });
  });

  test("o podcast só conta na Aula 2", () => {
    // Marcá-lo durante a investigação destravaria a decisão antes da largada.
    expect(aplicarAcao(estado({ passo: "grupo" }), "ouvir-podcast", "investigacao")).toMatchObject({
      ok: false,
      codigo: "passo-invalido",
    });
    const r = aplicarAcao(estado({ passo: "podcast" }), "ouvir-podcast", "aula2");
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) throw new Error("inesperado");
    expect(r.estado).toMatchObject({ ouviuPodcast: true, passo: "intervencao" });
  });

  test("encerrar a investigação para no breakpoint", () => {
    const r = aplicarAcao(estado({ passo: "grupo" }), "encerrar-investigacao", "investigacao");
    if (!r.ok) throw new Error("inesperado");
    expect(r.estado.passo).toBe("breakpoint");
  });

  test("os cards só avançam na síntese, e param em 3", () => {
    let atual = estado({ passo: "sintese", cardsLidos: 0 });
    for (let i = 0; i < TOTAL_DE_CARDS; i += 1) {
      const r = aplicarAcao(atual, "avancar-card", "aula2");
      if (!r.ok) throw new Error("inesperado");
      atual = r.estado;
    }
    expect(atual.cardsLidos).toBe(TOTAL_DE_CARDS);
    expect(aplicarAcao(atual, "avancar-card", "aula2")).toMatchObject({ ok: true, mudou: false });
  });
});

describe("a intervenção e seus dois portões", () => {
  test("sem a Aula 2 aberta, a resposta é recusada com a frase de espera", () => {
    const r = aplicarIntervencao(prontoParaResponder(), "B", 30, "investigacao");
    expect(r).toMatchObject({ ok: false, codigo: "aula2-nao-liberada" });
  });

  test("sem ter aberto a matéria, a resposta é recusada — este é o portão da missão", () => {
    // É o comportamento que a experiência inteira existe para desfazer:
    // responder a um boato sem checar a fonte.
    const r = aplicarIntervencao(
      prontoParaResponder({ inspecionouMateria: false }),
      "B",
      30,
      "aula2",
    );
    expect(r).toMatchObject({ ok: false, codigo: "sem-inspecao" });
  });

  test("sem ouvir o podcast até o fim, a decisão não abre", () => {
    const r = aplicarIntervencao(prontoParaResponder({ ouviuPodcast: false }), "B", 30, "aula2");
    expect(r).toMatchObject({ ok: false, codigo: "podcast-incompleto" });
  });

  test("com os portões vencidos, grava a opção e a latência de decisão", () => {
    const r = aplicarIntervencao(prontoParaResponder(), "B", 42, "aula2");
    if (!r.ok) throw new Error("inesperado");
    expect(r.estado).toMatchObject({ passo: "desfecho", opcao: "B", latenciaSeg: 42 });
  });

  test("o desfecho sai do catálogo, nunca do cliente", () => {
    expect(desfechoDe("A")).toEqual({ desfecho: "ruido", correta: false });
    expect(desfechoDe("B")).toEqual({ desfecho: "checada", correta: true });
    expect(desfechoDe("C")).toEqual({ desfecho: "conflito", correta: false });
  });

  test("responder duas vezes é recusado — uma resposta, uma mensagem no grupo", () => {
    const enviada = aplicarIntervencao(prontoParaResponder(), "B", 10, "aula2");
    if (!enviada.ok) throw new Error("inesperado");
    expect(aplicarIntervencao(enviada.estado, "A", 10, "aula2")).toMatchObject({
      ok: false,
      codigo: "resposta-ja-enviada",
    });
  });
});

describe("recuperação formativa", () => {
  test("a resposta impulsiva pode ser apagada, e o contador sobe", () => {
    const impulsiva = aplicarIntervencao(prontoParaResponder(), "A", 5, "aula2");
    if (!impulsiva.ok) throw new Error("inesperado");
    const desfeita = aplicarDesfazer(impulsiva.estado);
    if (!desfeita.ok) throw new Error("inesperado");
    expect(desfeita.estado).toMatchObject({
      passo: "intervencao",
      opcao: null,
      latenciaSeg: null,
      desfazerUsado: 1,
    });
  });

  test("a contraprova aceita NÃO pode ser desfeita", () => {
    // Desfazer aqui desmontaria a única cena em que a criança vê a checagem
    // funcionar: o Admin fixando a mensagem dela no topo do chat.
    const checada = aplicarIntervencao(prontoParaResponder(), "B", 30, "aula2");
    if (!checada.ok) throw new Error("inesperado");
    expect(aplicarDesfazer(checada.estado)).toMatchObject({
      ok: false,
      codigo: "resposta-ja-enviada",
    });
  });

  test("sem resposta no grupo não há o que apagar", () => {
    expect(aplicarDesfazer(prontoParaResponder())).toMatchObject({
      ok: false,
      codigo: "sem-resposta-para-desfazer",
    });
  });
});

describe("síntese e latch final", () => {
  test("a sistematização abre só depois da contraprova", () => {
    const impulsiva = aplicarIntervencao(prontoParaResponder(), "C", 5, "aula2");
    if (!impulsiva.ok) throw new Error("inesperado");
    expect(aplicarVerSintese(impulsiva.estado, "aula2")).toMatchObject({
      ok: false,
      codigo: "passo-invalido",
    });

    const checada = aplicarIntervencao(prontoParaResponder(), "B", 30, "aula2");
    if (!checada.ok) throw new Error("inesperado");
    const sintese = aplicarVerSintese(checada.estado, "aula2");
    if (!sintese.ok) throw new Error("inesperado");
    expect(sintese.estado.passo).toBe("sintese");
  });

  test("a reflexão exige a etapa liberada pela professora", () => {
    const pronto = estado({ passo: "sintese", cardsLidos: 3, opcao: "B", inspecionouMateria: true });
    expect(aplicarReflexao(pronto, ["buscar_fonte", "reparar_selo"], "debate", new Date())).toMatchObject({
      ok: false,
      codigo: "reflexao-nao-liberada",
    });
  });

  test("submeter fecha a missão, grava o score e não aceita segunda entrega", () => {
    const pronto = estado({ passo: "reflexao", cardsLidos: 3, opcao: "B", inspecionouMateria: true });
    const agora = new Date("2026-09-03T14:00:00Z");
    const r = aplicarReflexao(pronto, ["buscar_fonte", "reparar_selo"], "reflexao", agora);
    if (!r.ok) throw new Error("inesperado");
    expect(r.estado).toMatchObject({ passo: "fim", score: SCORE_DE_PRIMEIRA, concluidoEm: agora });
    expect(aplicarReflexao(r.estado, ["buscar_fonte", "reparar_selo"], "reflexao", agora)).toMatchObject({
      ok: false,
      codigo: "reflexao-ja-enviada",
    });
  });

  test("estratégia repetida não conta como duas escolhas", () => {
    const pronto = estado({ passo: "reflexao", cardsLidos: 3, opcao: "B", inspecionouMateria: true });
    expect(
      aplicarReflexao(pronto, ["buscar_fonte", "buscar_fonte"], "reflexao", new Date()),
    ).toMatchObject({ ok: false, codigo: "payload-invalido" });
  });
});

describe("pontuação", () => {
  test("100 para a contraprova de primeira, com a evidência aberta", () => {
    expect(pontuar({ inspecionouMateria: true, opcao: "B", desfazerUsado: 0 })).toBe(
      SCORE_DE_PRIMEIRA,
    );
  });

  test("70 para quem se corrigiu — a recuperação é o caminho, não a punição", () => {
    expect(pontuar({ inspecionouMateria: true, opcao: "B", desfazerUsado: 1 })).toBe(
      SCORE_APOS_RECUPERACAO,
    );
  });

  test("0 sem contraprova, e 0 para quem nunca respondeu", () => {
    expect(pontuar({ inspecionouMateria: true, opcao: "A", desfazerUsado: 0 })).toBe(
      SCORE_SEM_CONTRAPROVA,
    );
    expect(pontuar({ inspecionouMateria: true, opcao: null, desfazerUsado: 0 })).toBe(
      SCORE_SEM_CONTRAPROVA,
    );
  });

  test("100 exige a evidência: acertar sem ter aberto a matéria vale 70", () => {
    // Em produção o portão impede este estado. A regra existe para uma linha
    // antiga (ou um caminho novo que esqueça o portão) não render 100 de graça.
    expect(pontuar({ inspecionouMateria: false, opcao: "B", desfazerUsado: 0 })).toBe(
      SCORE_APOS_RECUPERACAO,
    );
  });

  test("o score só assume os três valores que o CHECK do banco aceita", () => {
    const possiveis = new Set<number>();
    for (const opcao of [null, "A", "B", "C"]) {
      for (const inspecionou of [true, false]) {
        for (const desfazer of [0, 1, 5]) {
          possiveis.add(
            pontuar({ inspecionouMateria: inspecionou, opcao, desfazerUsado: desfazer }),
          );
        }
      }
    }
    expect([...possiveis].sort((a, b) => a - b)).toEqual([0, 70, 100]);
  });

  test("o percurso é avaliado à parte, e não entra na nota", () => {
    expect(avaliarPercurso(["buscar_fonte", "reparar_selo"], "evidencia_desarma")).toEqual({
      estrategiasPrioritarias: 2,
      justificativaCorreta: true,
    });
    expect(avaliarPercurso(["espalhar_rapido", "concordar_emocao"], "vencer_grito")).toEqual({
      estrategiasPrioritarias: 0,
      justificativaCorreta: false,
    });
  });
});

describe("gabarito não vaza", () => {
  test("o payload público do catálogo não contém nenhum campo de gabarito", () => {
    const publico = JSON.stringify({
      feed: FEED,
      opcoes: OPCOES.map(semGabarito),
      estrategias: ESTRATEGIAS.map(({ prioritaria: _p, ...e }) => e),
      justificativas: JUSTIFICATIVAS.map(({ correta: _c, ...j }) => j),
    });
    for (const campo of ["correta", "desfecho", "prioritaria"]) {
      expect(publico).not.toContain(campo);
    }
  });

  test("`opcaoDo` falha alto em id fora do catálogo", () => {
    expect(() => opcaoDo("D")).toThrow(/desconhecida/);
  });
});
