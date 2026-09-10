import {
  ETAPAS_DA_TURMA,
  FASES_DA_RUN,
  ehVoltar,
  faseAoVoltar,
  faseEfetiva,
  jaViuARevelacao,
  normalizarFase,
  type EtapaDaTurma,
  type FaseDaRun,
} from "../src/comum/insta/etapas";

/**
 * O RELÓGIO DA AULA do Instanooria, sem banco.
 *
 * Este módulo reconcilia dois relógios — a etapa da TURMA, que o professor
 * move, e a fase da RUN, que é a tela daquela criança — e nada nele aparece no
 * typecheck: trocar piso por teto, ou um `>=` por `<=`, compila e sai errado em
 * 30 telas ao mesmo tempo, no meio de uma aula.
 *
 * Ele viveu sem teste nenhum até 2026-09-10, e foi assim que o defeito da
 * ADR-92 passou: o ramo que devolvia o feed ao voltar para a investigação era
 * INALCANÇÁVEL, e o comentário logo acima dele descrevia exatamente o sintoma
 * que ele deixava acontecer.
 */

describe("faseEfetiva — a etapa é PISO", () => {
  it("puxa para frente quem ficou atrás da turma", () => {
    expect(faseEfetiva("feed", "reflexao")).toBe("reflexao");
    expect(faseEfetiva("conclusao", "perdidos")).toBe("perdidos");
  });

  it("NÃO puxa de volta quem leu mais rápido", () => {
    expect(faseEfetiva("perdidos", "explicabilidade")).toBe("perdidos");
    expect(faseEfetiva("reflexao", "conclusao")).toBe("reflexao");
  });

  it("o debate é a exceção: trava os dois lados", () => {
    expect(faseEfetiva("feed", "debate")).toBe("debate");
    expect(faseEfetiva("reflexao", "debate")).toBe("debate");
    expect(faseEfetiva("onboarding", "debate")).toBe("debate");
  });

  it("preserva o onboarding SÓ enquanto a turma investiga", () => {
    expect(faseEfetiva("onboarding", "investigacao")).toBe("onboarding");
    expect(faseEfetiva("onboarding", "conclusao")).toBe("conclusao");
  });
});

describe("faseAoVoltar — a etapa é TETO", () => {
  /**
   * O caso do card: o professor encerra a investigação por engano e volta.
   * A run está em `conclusao` porque `moverEtapa` a congelou ao sair — e é
   * exatamente por isso que ela TEM de voltar ao feed.
   */
  it("devolve o FEED a quem está na resposta", () => {
    expect(faseAoVoltar("conclusao", "investigacao")).toBe("feed");
  });

  it("devolve o feed também a quem estava mais adiante, mas antes da revelação", () => {
    expect(faseAoVoltar("encerramento", "investigacao")).toBe("feed");
    expect(faseAoVoltar("debate", "investigacao")).toBe("feed");
  });

  it("o teto da investigação é o feed, NUNCA o onboarding", () => {
    // Usar `PISO_DA_ETAPA.investigacao` literalmente jogaria a turma inteira de
    // volta ao seletor de figurinha.
    expect(faseAoVoltar("feed", "investigacao")).toBe("feed");
  });

  it("quem JÁ VIU a revelação para na resposta, não volta ao feed", () => {
    // O motivo é o instrumento: quem sabe que o feed era enviesado não pode ser
    // medido por ele de novo.
    for (const fase of ["explicabilidade", "perdidos", "reflexao", "fim"] as const) {
      expect(faseAoVoltar(fase, "investigacao")).toBe("conclusao");
    }
  });

  it("quem nunca entrou no aparelho não tem para onde voltar", () => {
    for (const etapa of ETAPAS_DA_TURMA) {
      if (etapa === "debate") continue; // o debate trava todo mundo, inclusive esses
      expect(faseAoVoltar("onboarding", etapa)).toBe("onboarding");
    }
  });

  it("voltar para uma etapa do meio usa o piso dela como teto", () => {
    expect(faseAoVoltar("reflexao", "explicabilidade")).toBe("explicabilidade");
    expect(faseAoVoltar("fim", "perdidos")).toBe("perdidos");
    // Quem já estava atrás do teto fica onde está: voltar não empurra ninguém.
    expect(faseAoVoltar("conclusao", "reflexao")).toBe("conclusao");
  });

  it("o debate trava, mesmo voltando", () => {
    expect(faseAoVoltar("reflexao", "debate")).toBe("debate");
    expect(faseAoVoltar("conclusao", "debate")).toBe("debate");
  });

  /**
   * A REGRESSÃO do card, dita como invariante: nenhuma fase anterior à
   * revelação pode terminar em `conclusao` ao voltar para a investigação.
   * Com o `sessaoCongelada` antigo, TODAS terminavam.
   */
  it("nenhuma fase pré-revelação fica presa na resposta", () => {
    const preRevelacao = FASES_DA_RUN.filter(
      (fase) => fase !== "onboarding" && !jaViuARevelacao(fase),
    );
    expect(preRevelacao).toContain("conclusao");
    for (const fase of preRevelacao) {
      expect(faseAoVoltar(fase, "investigacao")).toBe("feed");
    }
  });
});

describe("a proteção da revelação lê a FASE ATUAL, não o histórico", () => {
  /**
   * LIMITAÇÃO CONHECIDA E DELIBERADA (ADR-92).
   *
   * `jaViuARevelacao` olha onde a run ESTÁ, e a fase é regressiva: voltando um
   * momento de cada vez, a run desce até `conclusao` antes de a turma chegar à
   * investigação — e daquele degrau a proteção já não se aplica. O resultado
   * depende do CAMINHO:
   *
   * - pulo direto (`explicabilidade` → `investigacao`): para na resposta;
   * - passo a passo (5 cliques, cada um com aviso na tela): volta ao feed.
   *
   * Fechar isso exige PERSISTIR o marco ("esta criança já viu a revelação"),
   * porque a fase não o guarda. É coluna nova para um caminho de cinco cliques
   * deliberados — sofisticação sem demanda medida. Este teste existe para que a
   * escolha seja vista, e não descoberta por acidente.
   */
  it("pulo direto de explicabilidade para investigação: para na resposta", () => {
    expect(faseAoVoltar("explicabilidade", "investigacao")).toBe("conclusao");
  });

  it("passo a passo do fim até a investigação: termina no feed", () => {
    const caminho: EtapaDaTurma[] = [
      "reflexao",
      "perdidos",
      "explicabilidade",
      "debate",
      "conclusao",
      "investigacao",
    ];
    let fase: FaseDaRun = "fim";
    for (const etapa of caminho) fase = faseAoVoltar(fase, etapa);
    expect(fase).toBe("feed");
  });
});

describe("jaViuARevelacao", () => {
  it("é verdade da explicabilidade em diante", () => {
    expect(jaViuARevelacao("debate")).toBe(false);
    expect(jaViuARevelacao("conclusao")).toBe(false);
    expect(jaViuARevelacao("explicabilidade")).toBe(true);
    expect(jaViuARevelacao("fim")).toBe(true);
  });

  it("cobre as fases legadas pela normalização", () => {
    // `revelacao` e `dossie` são de runs congeladas antes do fluxo v2.
    expect(jaViuARevelacao(normalizarFase("revelacao"))).toBe(true);
    expect(jaViuARevelacao(normalizarFase("dossie"))).toBe(true);
  });
});

describe("ehVoltar", () => {
  it("decide qual das duas regras vale", () => {
    expect(ehVoltar("conclusao", "investigacao")).toBe(true);
    expect(ehVoltar("investigacao", "conclusao")).toBe(false);
    expect(ehVoltar("debate", "debate")).toBe(false);
  });
});

describe("normalizarFase", () => {
  it("traduz fase legada para a equivalente, nunca para o começo", () => {
    // O fallback ingênuo era `onboarding`, e uma run em `dossie` era EXPULSA
    // para o seletor de avatar no meio da explicabilidade.
    expect(normalizarFase("revelacao")).toBe("explicabilidade");
    expect(normalizarFase("dossie")).toBe("explicabilidade");
    expect(normalizarFase("comparacao")).toBe("perdidos");
  });

  it("fase desconhecida de verdade cai no onboarding", () => {
    expect(normalizarFase("coisa-que-nunca-existiu")).toBe("onboarding");
  });
});

describe("as duas regras juntas, como o servidor as aplica", () => {
  /**
   * `GET /runs/:id/fase` devolve `faseEfetiva(fase, etapa)`. Voltar só funciona
   * se a fase GRAVADA por `faseAoVoltar` sobreviver a essa segunda passagem —
   * foi o par que quebrou no card: a run não voltava, e o GET confirmava a
   * `conclusao` para o cliente a cada 5 segundos.
   */
  const oQueOEstudanteVe = (gravada: FaseDaRun, etapa: EtapaDaTurma) =>
    faseEfetiva(gravada, etapa);

  it("depois de voltar para a investigação, o estudante vê o feed", () => {
    const gravada = faseAoVoltar("conclusao", "investigacao");
    expect(oQueOEstudanteVe(gravada, "investigacao")).toBe("feed");
  });

  it("quem viu a revelação continua vendo a resposta", () => {
    const gravada = faseAoVoltar("perdidos", "investigacao");
    expect(oQueOEstudanteVe(gravada, "investigacao")).toBe("conclusao");
  });
});
