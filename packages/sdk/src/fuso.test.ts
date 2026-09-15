import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import {
  CHAVE_DO_FUSO,
  ENV_DO_FUSO,
  FUSO_PADRAO,
  META_DO_FUSO,
  data,
  dataCurta,
  dataCurtaHora,
  dataHora,
  definirFusoDaPlataforma,
  diaDaPlataforma,
  esquecerFusoDaPlataforma,
  fusoDaPlataforma,
  fusoEhValido,
  hora,
  horaComSegundos,
} from "./fuso";

/**
 * O instante que expõe o defeito: **22h de Brasília**, que já é o dia seguinte
 * em UTC. É a janela das 21h à meia-noite — a única em que servidor e navegador
 * discordam, e por isso a única em que alguém percebe.
 */
const NOITE_DE_BRASILIA = "2026-09-11T01:30:00.000Z"; // 10/09 22:30 em São Paulo

/**
 * O módulo MEMORIZA o fuso resolvido (as funções o consultam a cada linha de
 * tabela). Sem isto, o primeiro `describe` a rodar decidiria o valor para o
 * arquivo inteiro e os outros passariam por acidente.
 */
beforeEach(() => {
  delete process.env[ENV_DO_FUSO];
  document.head.querySelectorAll(`meta[name="${META_DO_FUSO}"]`).forEach((m) => m.remove());
  esquecerFusoDaPlataforma();
});

afterEach(() => {
  delete process.env[ENV_DO_FUSO];
  esquecerFusoDaPlataforma();
});

describe("o fuso é CONFIGURÁVEL, e a prova é o texto mudar (ADR-99)", () => {
  /**
   * **O teste que o `OBJECTIVE` pediu.** Sem ele, "configurável" é promessa: o
   * valor podia estar sendo lido e jogado fora, e nada apontaria para isso.
   *
   * O mesmo instante, as mesmas funções, a mesma assinatura — só a variável de
   * ambiente muda. É o que a pessoa que opera a stack vai fazer.
   */
  test.each([
    // [o que o Lucas escreve na env, o dia, a hora]
    ["America/Sao_Paulo", "10/09/2026", "22:30"],
    ["America/Manaus", "10/09/2026", "21:30"], // UTC-4, uma rede no Amazonas
    ["America/Rio_Branco", "10/09/2026", "20:30"], // UTC-5, uma rede no Acre
    ["America/Noronha", "10/09/2026", "23:30"], // UTC-2, o outro extremo do país
    ["UTC", "11/09/2026", "01:30"], // o fuso do contêiner: OUTRO DIA
  ])("com %s, a mesma data sai como %s %s", (fuso, diaEsperado, horaEsperada) => {
    process.env[ENV_DO_FUSO] = fuso;
    esquecerFusoDaPlataforma();

    expect(fusoDaPlataforma()).toBe(fuso);
    expect(data(NOITE_DE_BRASILIA)).toBe(diaEsperado);
    expect(hora(NOITE_DE_BRASILIA)).toBe(horaEsperada);
    expect(dataHora(NOITE_DE_BRASILIA)).toBe(`${diaEsperado}, ${horaEsperada}`);
  });

  test("a variável ausente não quebra nada: vale o padrão", () => {
    expect(fusoDaPlataforma()).toBe(FUSO_PADRAO);
    expect(data(NOITE_DE_BRASILIA)).toBe("10/09/2026");
  });

  test("vazia conta como ausente — env em branco no compose é o caso comum", () => {
    process.env[ENV_DO_FUSO] = "";
    esquecerFusoDaPlataforma();
    expect(fusoDaPlataforma()).toBe(FUSO_PADRAO);
  });

  /**
   * `diaDaPlataforma` é CHAVE, não texto de tela: é por ele que o check-in de
   * bem-estar decide "já respondeu hoje". Configurar o fuso tem de mover o dia
   * junto, senão a rede no Acre grava o dia de Brasília.
   */
  test("o DIA (a chave, não o texto) acompanha a configuração", () => {
    process.env[ENV_DO_FUSO] = "UTC";
    esquecerFusoDaPlataforma();
    expect(diaDaPlataforma(NOITE_DE_BRASILIA)).toBe("2026-09-11");

    process.env[ENV_DO_FUSO] = "America/Rio_Branco";
    esquecerFusoDaPlataforma();
    expect(diaDaPlataforma(NOITE_DE_BRASILIA)).toBe("2026-09-10");
  });

  /**
   * O formatador do `Intl` é caro e fica em cache. Se o fuso não entrasse na
   * CHAVE do cache, trocar o fuso devolveria o formatador antigo e a tela
   * continuaria na hora de Brasília — sem erro nenhum para apontar a causa.
   */
  test("trocar o fuso invalida os formatadores já usados", () => {
    process.env[ENV_DO_FUSO] = "America/Sao_Paulo";
    esquecerFusoDaPlataforma();
    expect(hora(NOITE_DE_BRASILIA)).toBe("22:30"); // aquece o cache

    definirFusoDaPlataforma("America/Rio_Branco");
    expect(hora(NOITE_DE_BRASILIA)).toBe("20:30");
  });
});

describe("a cascata: cada superfície lê de onde tem", () => {
  /**
   * O NAVEGADOR do hub. Ele não lê `process.env`, e é por isso que o layout
   * raiz escreve o valor num `<meta>` — a mesma env, a mesma resposta HTTP.
   */
  test("sem env, o navegador lê o <meta> que o layout raiz escreveu", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", META_DO_FUSO);
    meta.setAttribute("content", "America/Manaus");
    document.head.appendChild(meta);
    esquecerFusoDaPlataforma();

    expect(fusoDaPlataforma()).toBe("America/Manaus");
    expect(hora(NOITE_DE_BRASILIA)).toBe("21:30");
  });

  /** No SERVIDOR do Next os dois existem, e a env é a fonte — o `<meta>` veio dela. */
  test("a env vence o <meta>", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", META_DO_FUSO);
    meta.setAttribute("content", "America/Manaus");
    document.head.appendChild(meta);
    process.env[ENV_DO_FUSO] = "America/Rio_Branco";
    esquecerFusoDaPlataforma();

    expect(fusoDaPlataforma()).toBe("America/Rio_Branco");
  });

  /**
   * A EXPERIÊNCIA. O bundle é estático, construído uma vez, e não tem env nem o
   * `<meta>` do hub — o iframe é outro documento. O `hub:init` é o único canal,
   * e `createExperiencia` chama isto antes de a tela montar.
   */
  test("`definirFusoDaPlataforma` (o hub:init) vence os dois", () => {
    process.env[ENV_DO_FUSO] = "America/Sao_Paulo";
    esquecerFusoDaPlataforma();

    expect(definirFusoDaPlataforma("America/Noronha")).toBe("America/Noronha");
    expect(hora(NOITE_DE_BRASILIA)).toBe("23:30");
  });

  /**
   * O caminho REAL da experiência, com a forma que o `hub:init` tem: o valor
   * vem de `config`, que é `Record<string, unknown>` — por isso
   * `definirFusoDaPlataforma` aceita `unknown` e não `string`.
   */
  test("o fuso chega pelo `config` do hub:init, na chave que o hub escreve", () => {
    const config: Record<string, unknown> = {
      clarityProjectId: "abc123",
      [CHAVE_DO_FUSO]: "America/Rio_Branco",
    };
    expect(definirFusoDaPlataforma(config[CHAVE_DO_FUSO])).toBe("America/Rio_Branco");
    expect(hora(NOITE_DE_BRASILIA)).toBe("20:30");
  });

  test.each([
    ["um número", 3],
    ["um objeto", { timeZone: "UTC" }],
    ["nulo", null],
  ])("%s no `config` é ignorado — postMessage é entrada externa", (_rotulo, valor) => {
    process.env[ENV_DO_FUSO] = "America/Manaus";
    esquecerFusoDaPlataforma();
    expect(definirFusoDaPlataforma(valor)).toBe("America/Manaus");
  });

  test("hub antigo, que não manda fuso, não estraga nada", () => {
    process.env[ENV_DO_FUSO] = "America/Manaus";
    esquecerFusoDaPlataforma();

    // É o que o `.default()` do HubInitSchema entrega quando o campo falta —
    // e também o que chega se alguém mandar string vazia.
    expect(definirFusoDaPlataforma(undefined)).toBe("America/Manaus");
    expect(definirFusoDaPlataforma("")).toBe("America/Manaus");
  });
});

describe("configuração errada degrada, não derruba a tela", () => {
  let erros: string[];
  beforeEach(() => {
    erros = [];
    vi.spyOn(console, "error").mockImplementation((m: unknown) => {
      erros.push(String(m));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * O typo que a api barra no boot. Aqui não dá para barrar: derrubar a tela da
   * rede inteira por causa de uma string é pior que mostrar a hora de Brasília
   * numa rede do Acre. O aviso é alto, e a api é quem falha cedo.
   */
  test("um typo na env cai no padrão e GRITA no console", () => {
    process.env[ENV_DO_FUSO] = "America/SaoPaulo"; // sem o sublinhado
    esquecerFusoDaPlataforma();

    expect(fusoDaPlataforma()).toBe(FUSO_PADRAO);
    expect(erros.join("\n")).toContain("America/SaoPaulo");
    expect(erros.join("\n")).toContain(ENV_DO_FUSO);
  });

  test("um `hub:init` com fuso inválido não muda o que já valia", () => {
    process.env[ENV_DO_FUSO] = "America/Manaus";
    esquecerFusoDaPlataforma();

    expect(definirFusoDaPlataforma("Marte/Olympus")).toBe("America/Manaus");
    expect(erros.join("\n")).toContain("Marte/Olympus");
  });

  test.each([
    ["America/Sao_Paulo", true],
    ["America/Manaus", true],
    ["UTC", true],
    // Alias legado: o `Intl` aceita, e `Intl.supportedValuesOf` não o lista —
    // é por isso que a validação constrói o formatador em vez de olhar a lista.
    ["Brazil/East", true],
    // Offset FIXO: o `Intl` aceita (ECMA-402), e por isso a validação não o
    // recusa. Mas ele congela o deslocamento: uma rede que um dia volte a ter
    // horário de verão ficaria uma hora atrasada sem nada acusar. Prefira o
    // nome IANA — está dito no `.env.example` e no apêndice B.
    ["-03:00", true],
    ["America/SaoPaulo", false],
    ["", false],
    ["Marte/Olympus", false],
  ])("`fusoEhValido(%s)` é %s", (fuso, esperado) => {
    expect(fusoEhValido(fuso)).toBe(esperado);
  });
});

describe("a regressão da ADR-98: o fuso de QUEM EXECUTA não decide nada", () => {
  /**
   * O processo roda em UTC aqui dentro — como o container do Cloud Run. Se as
   * funções lessem o fuso do ambiente, este bloco devolveria `11/09` e a tela
   * da professora, `10/09`. O React chamaria isso de "hydration failed",
   * regeneraria a árvore e engoliria o clique dela.
   */
  describe("com o processo em UTC, como o container", () => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = "UTC";
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    test("uma data da noite de Brasília NÃO vira o dia seguinte", () => {
      expect(data(NOITE_DE_BRASILIA)).toBe("10/09/2026");
      expect(dataCurta(NOITE_DE_BRASILIA)).toBe("10/09");
      expect(diaDaPlataforma(NOITE_DE_BRASILIA)).toBe("2026-09-10");
    });

    test("e a hora é a do relógio da escola, não a do servidor", () => {
      expect(hora(NOITE_DE_BRASILIA)).toBe("22:30");
      expect(dataHora(NOITE_DE_BRASILIA)).toBe("10/09/2026, 22:30");
      expect(dataCurtaHora(NOITE_DE_BRASILIA)).toBe("10/09, 22:30");
    });
  });

  /**
   * O outro lado do mesmo teste: o navegador da professora. Os dois blocos
   * afirmam o MESMO texto de propósito — é essa igualdade que impede a
   * hidratação de quebrar, e ela é o produto desta correção.
   */
  describe("com o processo em America/Sao_Paulo, como o navegador dela", () => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = "America/Sao_Paulo";
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    test("devolve exatamente o mesmo texto que devolveu em UTC", () => {
      expect(data(NOITE_DE_BRASILIA)).toBe("10/09/2026");
      expect(dataCurta(NOITE_DE_BRASILIA)).toBe("10/09");
      expect(dataHora(NOITE_DE_BRASILIA)).toBe("10/09/2026, 22:30");
      expect(diaDaPlataforma(NOITE_DE_BRASILIA)).toBe("2026-09-10");
    });
  });

  /**
   * O `TZ` do processo é ruído: ele não configura nada. Quem configura é a env
   * `FUSO_DA_PLATAFORMA` — e o teste prova que as duas coisas são diferentes,
   * que é o que a ADR-98 fixou e a ADR-99 preservou.
   */
  test("máquina no Acre e plataforma em Manaus: quem manda é a plataforma", () => {
    const original = process.env.TZ;
    process.env.TZ = "America/Rio_Branco";
    process.env[ENV_DO_FUSO] = "America/Manaus";
    esquecerFusoDaPlataforma();
    try {
      expect(hora(NOITE_DE_BRASILIA)).toBe("21:30");
    } finally {
      process.env.TZ = original;
    }
  });

  test("segundos só onde a ordem dentro do minuto importa", () => {
    expect(horaComSegundos("2026-09-11T01:30:07.000Z")).toBe("22:30:07");
  });

  describe("o que não é data vira travessão, nunca 'Invalid Date'", () => {
    test.each([
      ["nulo", null],
      ["ausente", undefined],
      ["texto que não é data", "ontem à tarde"],
      ["vazio", ""],
    ])("%s", (_rotulo, entrada) => {
      expect(data(entrada as string | null | undefined)).toBe("—");
      expect(dataHora(entrada as string | null | undefined)).toBe("—");
      expect(hora(entrada as string | null | undefined)).toBe("—");
    });
  });

  test("aceita `Date` além de string — a api devolve ISO, o código local não", () => {
    expect(data(new Date(NOITE_DE_BRASILIA))).toBe("10/09/2026");
  });
});
