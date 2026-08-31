import { CARTOES, cartoesDaBolha, semGabarito, type Bolha } from "../src/vila/catalogo";
import { validarPayload, VOCABULARIO_DE_EVENTO, type PayloadVilaV1 } from "../src/vila/contrato";
import { linhasDeLeitura, resumoHonesto } from "../src/vila/leitura";
import { calcularPerfil, VERSAO_MAPEAMENTO } from "../src/vila/mapeamento";
import { lerMensagens } from "../src/vila/mensagens";
import { bolhasElegiveis, corrigirCartoes, escolherBolha } from "../src/vila/regras";

/**
 * Invariantes PUROS da exp-70 — sem banco.
 *
 * Cada `test` aqui é um "nunca" que o CLAUDE.md ou o desenho da missão afirma em
 * prosa. Prosa não é controle: foi assim que o app de origem quase entregou uma
 * trava decorativa (as recusas mais importantes do contrato estavam em
 * `.refine()`, que zod roda DEPOIS de descartar chave desconhecida — então
 * `{ nome: "Lara" }` era removido em silêncio e o refine recebia um objeto limpo).
 */

/* ---------------------------------------------------------------- fixtures */

/** Uma partida completa e rica: 8 fogueiras, 2 dilemas, mapa bem coberto. */
function partidaCompleta(): Record<string, unknown> {
  return {
    v: 1,
    bundleVersion: "2026.08.26",
    duracaoSeg: 900,
    duracaoTotalSeg: 1200,
    status: "completa",
    resumo: {
      fogueirasAcesas: 8,
      pedrasQuebradas: 14,
      aldeoesAjudados: 3,
      lampioesAcesos: 4,
      tochasAcesas: 9,
      dilemasVistos: 3,
      dilemasResolvidos: 2,
      distanciaM: 950,
    },
    medidas: {
      cobertura: { celulas: 180, total: 400, pisoObrigatorio: 120 },
      movimento: { movendoSeg: 620, escuroSeg: 140, luzSeg: 480, atalhos: 3, desvioM: 210, raioMax: 28.4 },
      lume: { conversas: 5, perguntasCaminho: 2, lore: 2, ajuda: 1, sugestaoSeguida: true },
      tocha: { aldeao: 3, lampiao: 4, pedra: 1, passarela: 1, retomadas: 1 },
      pedra: { borda: true, destaque: false, nomesApagados: 0, nomesLidos: 2 },
      fumaca: { avistadas: 2, seguidas: 1 },
      brinquedos: 4,
      resgates: [{ at: 120.5, firesLit: 2 }],
    },
    oportunidades: {
      selfDirection: 1, stimulation: 1, hedonism: 1, achievement: 1, power: 1,
      security: 1, conformity: 1, tradition: 1, benevolence: 1, universalism: 1,
    },
    dilemas: [
      { pairId: 0, escolha: "aldeao", emMs: 120_000 },
      { pairId: 1, escolha: "lampiao", emMs: 300_000 },
    ],
    eventos: [
      { tipo: "fogueira_acesa", emMs: 40_000, dados: { zona: "praca" } },
      { tipo: "tocha_gasta", emMs: 90_000, dados: { destino: "aldeao" } },
      { tipo: "pedra_dos_nomes", emMs: 500_000, dados: { acao: "borda", passo: null } },
    ],
    seguranca: {
      apareceram: 4,
      respondidas: 3,
      ignoradas: 1,
      cartoes: [
        { id: "fagulha-infinita", emMs: 25_000, viuOpcoes: true, escolha: 2, decisaoMs: 3400 },
        { id: "lume-dica", emMs: 60_000, viuOpcoes: true, escolha: 1, decisaoMs: 2100 },
        { id: "jogador-1000", emMs: 240_000, viuOpcoes: true, escolha: 1, decisaoMs: 1800 },
        { id: "aviso-colega", emMs: 400_000, viuOpcoes: false, escolha: null, decisaoMs: null },
      ],
    },
  };
}

function aceito(bruto: unknown): PayloadVilaV1 {
  const r = validarPayload(bruto);
  if (!r.ok) throw new Error(`payload devia ser válido: ${r.motivo} — ${r.detalhes.join("; ")}`);
  return r.payload;
}

/* ------------------------------------------------------------------ contrato */

describe("contrato do payload", () => {
  test("a partida completa de referência é aceita", () => {
    expect(validarPayload(partidaCompleta()).ok).toBe(true);
  });

  test("campo de nome de criança é RECUSADO, nunca descartado em silêncio", () => {
    // O bug do app de origem: com `.refine()`, zod removia a chave antes de
    // checar, e o nome sumia sem ninguém saber que tinha chegado.
    for (const chave of ["nome", "nomeCompleto", "playerName", "nome_do_aluno", "cpf"]) {
      const r = validarPayload({ ...partidaCompleta(), [chave]: "Lara" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(/nome de criança/);
    }
  });

  test("nome enterrado no fundo de `dados` também é recusado", () => {
    const p = partidaCompleta() as { eventos: Array<Record<string, unknown>> };
    p.eventos[0]!.dados = { nome: 1 };
    expect(validarPayload(p).ok).toBe(false);
  });

  test("`nomesApagados` e `nomesLidos` passam: contam nomes, não são nomes", () => {
    expect(validarPayload(partidaCompleta()).ok).toBe(true);
  });

  test("perfil já calculado é recusado — o servidor recalcula", () => {
    for (const chave of ["valores", "graus", "perfil", "schwartz", "eixos"]) {
      const r = validarPayload({ ...partidaCompleta(), [chave]: {} });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(/perfil calculado/);
    }
  });

  test("chave desconhecida é ERRO (strict), não descarte silencioso", () => {
    expect(validarPayload({ ...partidaCompleta(), inventado: 1 }).ok).toBe(false);
  });

  test("texto livre em `dados` é recusado: vocabulário fechado", () => {
    const p = partidaCompleta() as { eventos: Array<Record<string, unknown>> };
    p.eventos[0]!.dados = { zona: "qualquer coisa que alguém digitou" };
    expect(validarPayload(p).ok).toBe(false);
  });

  test("o vocabulário fechado aceita os ids que o jogo de fato manda", () => {
    for (const palavra of VOCABULARIO_DE_EVENTO) {
      const p = partidaCompleta() as { eventos: Array<Record<string, unknown>> };
      p.eventos[0]!.dados = { zona: palavra };
      expect(validarPayload(p).ok).toBe(true);
    }
  });

  test("o log fino tem teto, e o teto tem folga sobre o que o jogo produz", () => {
    // O jogo tem 7 pontos de log, todos atos discretos com guarda: ~22 no
    // máximo. O cap é a única coisa que limita o tamanho da linha se um cliente
    // adulterado mandar lixo.
    const um = { tipo: "chama_pega", emMs: 1, dados: { zona: "praca" } };
    const cabe = partidaCompleta() as Record<string, unknown>;
    cabe.eventos = Array.from({ length: 200 }, () => ({ ...um }));
    expect(validarPayload(cabe).ok).toBe(true);

    const naoCabe = partidaCompleta() as Record<string, unknown>;
    naoCabe.eventos = Array.from({ length: 201 }, () => ({ ...um }));
    expect(validarPayload(naoCabe).ok).toBe(false);
  });

  test("id de cartão é palavra válida no log — vem derivado do catálogo", () => {
    const p = partidaCompleta() as { eventos: Array<Record<string, unknown>> };
    p.eventos[0] = { tipo: "dm_respondida", emMs: 1, dados: { cartao: "colega-fagulha", escolha: 2 } };
    expect(validarPayload(p).ok).toBe(true);
  });

  test("partida `completa` sem as 8 fogueiras é recusada", () => {
    const p = partidaCompleta() as { resumo: Record<string, unknown> };
    p.resumo.fogueirasAcesas = 5;
    expect(validarPayload(p).ok).toBe(false);
  });

  test("incoerência interna é recusada", () => {
    const semRespostas = partidaCompleta() as { seguranca: Record<string, unknown> };
    semRespostas.seguranca.respondidas = 9;
    expect(validarPayload(semRespostas).ok).toBe(false);

    const tempoTorto = partidaCompleta() as Record<string, unknown>;
    tempoTorto.duracaoTotalSeg = 10;
    expect(validarPayload(tempoTorto).ok).toBe(false);
  });
});

/* ------------------------------------------------------------------- bolhas */

describe("a bolha", () => {
  test("é balanceada dentro da turma: 30 estudantes dão 10/10/10", () => {
    const contagem: Partial<Record<Bolha, number>> = {};
    for (let i = 0; i < 30; i += 1) {
      const b = escolherBolha(contagem, "8EF");
      contagem[b] = (contagem[b] ?? 0) + 1;
    }
    expect(contagem).toEqual({ A: 10, B: 10, C: 10 });
  });

  test("numa sala de 25, nenhuma bolha fica com menos de 8", () => {
    // O debate depende de as TRÊS estarem na sala. `nº do estudante mod 3` dava isso
    // de graça; hash de uuid poderia dar 14/6/5.
    const contagem: Partial<Record<Bolha, number>> = {};
    for (let i = 0; i < 25; i += 1) {
      const b = escolherBolha(contagem, "8EF");
      contagem[b] = (contagem[b] ?? 0) + 1;
    }
    for (const b of ["A", "B", "C"] as const) expect(contagem[b] ?? 0).toBeGreaterThanOrEqual(8);
  });

  test("nos anos iniciais a bolha B não é servida", () => {
    // Nota de aplicação da missão: "para 8–10, corte a bolha B — 'suporte' exige
    // entender o que é suporte". No app de origem isso era inaplicável, porque a
    // bolha saía de `mod 3` no navegador, que não sabe a série de ninguém.
    for (const serie of ["1EF", "3EF", "5EF"]) {
      expect(bolhasElegiveis(serie)).toEqual(["A", "C"]);
      const contagem: Partial<Record<Bolha, number>> = {};
      for (let i = 0; i < 12; i += 1) {
        const b = escolherBolha(contagem, serie);
        contagem[b] = (contagem[b] ?? 0) + 1;
      }
      expect(contagem.B ?? 0).toBe(0);
    }
    expect(bolhasElegiveis("6EF")).toEqual(["A", "B", "C"]);
    expect(bolhasElegiveis(null)).toEqual(["A", "B", "C"]);
  });

  test("cada bolha recebe as MESMAS duas legítimas e um golpe só", () => {
    for (const b of ["A", "B", "C"] as const) {
      const cartoes = cartoesDaBolha(b);
      expect(cartoes.filter((c) => c.legitima).length).toBe(2);
      expect(cartoes.filter((c) => !c.legitima && c.nivel !== "comum").length).toBe(1);
      expect(cartoes.length).toBe(4);
    }
  });

  test("a ordem é preservada: o aviso da batida 4 nunca vem antes do golpe", () => {
    for (const b of ["A", "B", "C"] as const) {
      const ids = cartoesDaBolha(b).map((c) => c.id);
      expect(ids.indexOf("aviso-colega")).toBe(ids.length - 1);
      // `aposCartao:3` conta posição nesta lista, e o 3º é sempre o golpe da bolha.
      expect(cartoesDaBolha(b)[2]!.nivel).toBe(b);
    }
  });
});

/* --------------------------------------------------- gabarito não sai da api */

describe("o gabarito não sai da api", () => {
  test("`semGabarito` remove nivel, legitima e aceita", () => {
    for (const c of CARTOES) {
      const publico = semGabarito(c) as unknown as Record<string, unknown>;
      expect(publico.legitima).toBeUndefined();
      expect(publico.nivel).toBeUndefined();
      for (const o of publico.options as Array<Record<string, unknown>>) {
        expect(o.aceita).toBeUndefined();
      }
    }
  });

  test("o JSON servido ao cliente não contém a palavra `legitima` em lugar nenhum", () => {
    // Serializado, porque é isso que sai no fio.
    const fio = JSON.stringify(cartoesDaBolha("C").map(semGabarito));
    expect(fio).not.toMatch(/legitima|aceita"|"nivel"/);
  });

  test("os cartões das OUTRAS bolhas não vão para o cliente", () => {
    const fio = JSON.stringify(cartoesDaBolha("A").map(semGabarito));
    expect(fio).not.toMatch(/Suporte da Vila|sentei atrás de ti/);
  });
});

/* ------------------------------------------------------------- correção */

describe("correção dos cartões (regra nº 3)", () => {
  const respondidos = partidaCompleta().seguranca as { cartoes: PayloadVilaV1["seguranca"]["cartoes"] };

  test("`aceitou` é derivado do catálogo, não recebido", () => {
    const r = corrigirCartoes(respondidos.cartoes, "A");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const golpe = r.cartoes.find((c) => c.id === "jogador-1000")!;
    expect(golpe.legitima).toBe(false);
    expect(golpe.aceitou).toBe(true); // escolha 1 = "Clicar e resgatar"
    const legitima = r.cartoes.find((c) => c.id === "lume-dica")!;
    expect(legitima.legitima).toBe(true);
    expect(legitima.aceitou).toBe(true);
    const naoRespondeu = r.cartoes.find((c) => c.id === "aviso-colega")!;
    expect(naoRespondeu.aceitou).toBeNull();
  });

  test("cartão de outra bolha é recusado — substitui o `bolha` que vinha no payload", () => {
    const r = corrigirCartoes(respondidos.cartoes, "C");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detalhes.join(" ")).toMatch(/jogador-1000.*bolha C/);
  });

  test("cartão desconhecido, duplicado ou com opção inexistente é recusado", () => {
    const base = { emMs: 1000, viuOpcoes: true, escolha: 1, decisaoMs: 500 };
    expect(corrigirCartoes([{ ...base, id: "inventado" }], "A").ok).toBe(false);
    expect(
      corrigirCartoes([{ ...base, id: "lume-dica" }, { ...base, id: "lume-dica" }], "A").ok,
    ).toBe(false);
  });
});

/* ------------------------------------------------------- leitura das mensagens */

describe("leitura das mensagens", () => {
  test("a frase nomeia o NÍVEL antes do que ela fez", () => {
    const r = corrigirCartoes(
      (partidaCompleta().seguranca as { cartoes: PayloadVilaV1["seguranca"]["cartoes"] }).cartoes,
      "A",
    );
    if (!r.ok) throw new Error("correção devia passar");
    const leitura = lerMensagens("A", r.cartoes)!;
    // fagulha-infinita: escolha 2 = "Ignorar" ⇒ golpe RECUSADO.
    // jogador-1000: escolha 1 = "Clicar e resgatar" ⇒ golpe ACEITO.
    expect(leitura.golpeRecusado).toBe(1);
    expect(leitura.golpeAceito).toBe(1);
    expect(leitura.legitimaAceita).toBe(1); // lume-dica, escolha 1 = "Quero"
    // Caiu no golpe ⇒ a frase abre pelo NÍVEL, não pelo ato.
    expect(leitura.leitura).toMatch(/^Entregou o que foi pedido no golpe de nível "golpe grosseiro"/);
  });

  test("nenhum cartão que apareceu ⇒ `null`, e NÃO zeros que parecem escolha", () => {
    expect(lerMensagens("B", [])).toBeNull();
  });

  test("a frase NÃO afirma o que não aconteceu", () => {
    // O app de origem dizia "Recusou o golpe ... e aceitou o que era verdadeiro"
    // mesmo quando só o golpe tinha aparecido — uma frase sobre uma criança
    // afirmando o que o dado não sustenta.
    const soOGolpe = [{
      id: "fagulha-infinita", nivel: "comum" as const, legitima: false,
      emMs: 25_000, viuOpcoes: true, escolha: 2, aceitou: false, decisaoMs: 400,
    }];
    const r = lerMensagens("A", soOGolpe)!;
    expect(r.legitimaAceita).toBe(0);
    expect(r.leitura).toMatch(/Recusou o golpe/);
    expect(r.leitura).not.toMatch(/aceitou o que era verdadeiro/);

    // E quando as duas coisas aconteceram, a frase diz as duas.
    const asDuas = [
      ...soOGolpe,
      { id: "lume-dica", nivel: "comum" as const, legitima: true,
        emMs: 60_000, viuOpcoes: true, escolha: 1, aceitou: true, decisaoMs: 900 },
    ];
    expect(lerMensagens("A", asDuas)!.leitura).toMatch(/e aceitou o que era verdadeiro/);
  });

  test("separa `nemViu` de `deixouPassar` — são crianças diferentes", () => {
    const cartoes = [
      { id: "lume-dica", nivel: "comum" as const, legitima: true, emMs: 1, viuOpcoes: false, escolha: null, aceitou: null, decisaoMs: null },
      { id: "aviso-colega", nivel: "comum" as const, legitima: true, emMs: 2, viuOpcoes: true, escolha: null, aceitou: null, decisaoMs: null },
    ];
    const leitura = lerMensagens("A", cartoes)!;
    expect(leitura.nemViu).toBe(1);
    expect(leitura.deixouPassar).toBe(1);
  });
});

/* ----------------------------------------------------------------- perfil */

describe("perfil e leitura", () => {
  test("a versão do mapeamento continua 3 (comparável com o piloto)", () => {
    expect(VERSAO_MAPEAMENTO).toBe(3);
  });

  test("ausência em `oportunidades` é `none`, e `none` NÃO é zero", () => {
    const p = partidaCompleta() as Record<string, unknown>;
    // Tradição sem oportunidade E sem sinal: a chance não chegou até ela.
    p.oportunidades = { benevolence: 1, universalism: 1 };
    (p.medidas as { lume: Record<string, unknown> }).lume.lore = 0;
    const perfil = calcularPerfil(aceito(p));
    expect(perfil.graus.tradition).toBe("none");
    expect(perfil.valores.tradition).toBeNull();
  });

  test("teve a chance e não foi por ali é `zero`, e zero ENTRA na conta", () => {
    const p = partidaCompleta() as Record<string, unknown>;
    (p.medidas as { pedra: Record<string, unknown> }).pedra.destaque = false;
    (p.medidas as { pedra: Record<string, unknown> }).pedra.nomesApagados = 0;
    const perfil = calcularPerfil(aceito(p));
    expect(perfil.graus.power).toBe("zero");
    expect(perfil.valores.power).toBe(0);
  });

  test("valor com UMA fonte de medida não recebe número", () => {
    const perfil = calcularPerfil(aceito(partidaCompleta()));
    for (const [valor, grau] of Object.entries(perfil.graus)) {
      if (grau === "indicative") {
        expect(perfil.valores[valor as keyof typeof perfil.valores]).toBeNull();
      }
    }
    // e a partida de referência TEM pelo menos um `indicative` — se deixar de
    // ter, este teste passa vazio e não prova nada.
    expect(Object.values(perfil.graus)).toContain("indicative");
  });

  test("a api não devolve número onde o grau não autoriza — nem se o JSONB tiver um", () => {
    // Perfil gravado por versão anterior, ou por bug: número presente com grau
    // que não o autoriza. A decisão é do GRAU, nunca da presença do número.
    const linhas = linhasDeLeitura(
      { power: 100, tradition: 42, benevolence: 61 },
      { power: "indicative", tradition: "none", benevolence: "scored" },
    );
    const porValor = new Map(linhas.map((l) => [l.valor, l]));
    expect(porValor.get("power")!.numero).toBeNull();
    expect(porValor.get("tradition")!.numero).toBeNull();
    expect(porValor.get("benevolence")!.numero).toBe(61);
  });

  test("grau desconhecido cai em `none`, nunca em número", () => {
    const linhas = linhasDeLeitura({ power: 100 }, { power: "inventado" });
    expect(linhas.find((l) => l.valor === "power")!.numero).toBeNull();
  });

  test("empate no topo NÃO vira manchete", () => {
    // `Array.sort` é estável e a ordem de VALORES põe `power` antes de
    // `benevolence`: num empate a manchete saía na linha mais estigmatizante
    // da página ("apagou o nome de outra criança").
    const linhas = linhasDeLeitura(
      { power: 50, benevolence: 50 },
      { power: "scored", benevolence: "scored" },
    );
    expect(resumoHonesto(linhas, true)).toMatch(/Nenhum comportamento se destacou/);
  });

  test("amostra insuficiente some com a frase toda", () => {
    const linhas = linhasDeLeitura({ power: 90 }, { power: "scored" });
    expect(resumoHonesto(linhas, false)).toMatch(/curta demais/);
  });

  test("partida sem escolha com custo não sustenta leitura", () => {
    const p = partidaCompleta() as Record<string, unknown>;
    p.status = "abandonada";
    (p.resumo as Record<string, unknown>).fogueirasAcesas = 1;
    (p.resumo as Record<string, unknown>).dilemasVistos = 0;
    (p.resumo as Record<string, unknown>).dilemasResolvidos = 0;
    (p.resumo as Record<string, unknown>).aldeoesAjudados = 0;
    (p.resumo as Record<string, unknown>).lampioesAcesos = 0;
    p.dilemas = [];
    (p.medidas as { pedra: Record<string, unknown> }).pedra.borda = false;
    (p.medidas as { tocha: Record<string, unknown> }).tocha.passarela = 0;
    (p.medidas as { movimento: Record<string, unknown> }).movimento.movendoSeg = 40;
    (p.medidas as { movimento: Record<string, unknown> }).movimento.luzSeg = 30;
    (p.medidas as { movimento: Record<string, unknown> }).movimento.escuroSeg = 10;
    expect(calcularPerfil(aceito(p)).amostraSuficiente).toBe(false);
  });
});
