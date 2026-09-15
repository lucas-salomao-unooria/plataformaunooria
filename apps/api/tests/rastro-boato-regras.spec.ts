import {
  AUDITORIAS_EXIGIDAS,
  CONVERSAS,
  IDS_DE_BLOCO,
  MENSAGENS,
  ORDEM_CORRETA,
  OPCAO_QUE_INTERROMPE,
  TETO_DA_REFLEXAO,
  blocosPublicos,
  chatDaMensagem,
  opcao,
  opcoesPublicas,
} from "../src/rastro-boato/catalogo";
import {
  PROIBIDO_NO_PAINEL,
  TERMOS_PROIBIDOS_NA_TELA,
  paraLog,
  termosProibidosEm,
} from "../src/rastro-boato/invariantes";
import { MENSAGENS as MENSAGENS_DE_ERRO } from "../src/rastro-boato/erros";
import { auditar, estadoDaAuditoria, podeDecidir } from "../src/rastro-boato/regras/auditoria";
import { validarCiclo } from "../src/rastro-boato/regras/ciclo";
import {
  ETAPAS,
  PASSOS,
  aguardandoATurma,
  normalizarPasso,
  passoEfetivo,
  proximoPasso,
} from "../src/rastro-boato/regras/passos";
import { SCORE_DO_NIVEL, nivelDe, scoreDe } from "../src/rastro-boato/regras/pontuacao";
import { curvas, topologiaDe } from "../src/rastro-boato/regras/topologia";

/**
 * Regras puras da exp-06 — sem Prisma, sem HTTP.
 *
 * O que estes testes protegem não é "a função devolve X": é a mecânica
 * pedagógica. Cada bloco corresponde a um não-negociável documentado, e a falha
 * de qualquer um significa que a missão passou a medir outra coisa.
 */

describe("catálogo", () => {
  test("as 4 conversas do PRD existem, e nenhuma outra", () => {
    // Cardinalidade é regra: o estudante opera estritamente nos 4 chats
    // pré-definidos (não-objetivo 3.1.3 do PRD).
    expect(CONVERSAS.map((c) => c.id)).toEqual(["gremio", "turma", "bairro", "tomas"]);
  });

  test("há mais mensagens auditáveis do que a cota exige", () => {
    // Se houvesse exatamente 3, "quais auditar" deixaria de ser escolha — e é a
    // escolha que vira dado em `exp_06_auditorias`.
    expect(MENSAGENS.length).toBeGreaterThan(AUDITORIAS_EXIGIDAS);
  });

  test("as 3 fontes que sustentam a descoberta estão em conversas diferentes", () => {
    // Empilhá-las num chat só faria a auditoria caber numa rolagem, e a Etapa 2
    // perderia a navegação que ela mede.
    const chats = ["msg-boato-01", "msg-audio-anonimo", "msg-laudo-pdf"].map(chatDaMensagem);
    expect(new Set(chats).size).toBe(3);
  });

  test("todo áudio tem transcrição verbatim", () => {
    // RNF-A11Y-002: a redundância é acessibilidade, não fallback de mídia
    // ausente. Um áudio sem legenda deixa a missão inacessível de vez.
    for (const m of MENSAGENS.filter((m) => m.tipo === "audio")) {
      expect(m.transcricao).toBeTruthy();
    }
  });

  test("nenhum metadado diz qual mensagem é a falsa", () => {
    // Um campo `confiavel` responderia a pergunta antes de ela ser feita: ler
    // os números é a tarefa (EF06CO01).
    for (const m of MENSAGENS) {
      expect(Object.keys(m.metadados).sort()).toEqual(["autor", "carimbo", "detalhe", "saltos"]);
    }
  });

  test("`saltos: null` distingue mensagem escrita ali de mensagem nunca encaminhada", () => {
    // Ausência de encaminhamento não é zero encaminhamentos: o laudo tem 0
    // (foi publicado e não correu), a fala de Tomás tem null (nasceu ali).
    expect(MENSAGENS.find((m) => m.id === "msg-laudo-pdf")?.metadados.saltos).toBe(0);
    expect(MENSAGENS.find((m) => m.id === "msg-tomas-privado")?.metadados.saltos).toBeNull();
  });

  test("as opções públicas não carregam desfecho nem reação", () => {
    // Regra inviolável nº 3: com `desfecho` no bundle, a resposta certa está no
    // DevTools antes de a criança responder.
    for (const o of opcoesPublicas()) {
      expect(Object.keys(o).sort()).toEqual(["id", "texto"]);
    }
  });

  test("os blocos públicos não carregam a ordem certa", () => {
    for (const b of blocosPublicos()) {
      expect(Object.keys(b).sort()).toEqual(["id", "texto"]);
    }
    // E a ordem correta é derivada do catálogo do servidor, não reescrita.
    expect(ORDEM_CORRETA).toEqual(IDS_DE_BLOCO);
  });

  test("só a opção B interrompe a corrente", () => {
    expect(opcao(OPCAO_QUE_INTERROMPE).desfecho).toBe("interrompeu");
    expect(opcao("A").desfecho).toBe("amplificou");
    expect(opcao("C").desfecho).toBe("silenciou");
  });

  test("nenhuma reação rotula quem escolheu", () => {
    // PED-11: a consequência é a curva no mapa, não uma frase que julga.
    for (const id of ["A", "B", "C"] as const) {
      expect(termosProibidosEm(opcao(id).reacao)).toEqual([]);
    }
  });
});

describe("auditoria — a cota de 3 fontes distintas", () => {
  test("reabrir o mesmo balão não conta de novo", () => {
    // A pergunta é "auditou 3 fontes", não "abriu 3 modais".
    const estado = estadoDaAuditoria(["msg-boato-01", "msg-boato-01", "msg-boato-01"]);
    expect(estado.total).toBe(1);
    expect(estado.cotaAtingida).toBe(false);
  });

  test("releitura devolve ok, não erro", () => {
    // Um 409 aqui transformaria reler — o comportamento que a missão QUER — em
    // mensagem de erro na tela.
    const r = auditar(["msg-boato-01"], "msg-boato-01");
    expect(r).toEqual({ ok: true, novo: false });
  });

  test("mensagem fora do catálogo é recusada", () => {
    expect(auditar([], "msg-inventada")).toEqual({
      ok: false,
      codigo: "mensagem-desconhecida",
    });
  });

  test("3 distintas fecham a cota e liberam a decisão", () => {
    const ids = ["msg-boato-01", "msg-audio-anonimo", "msg-laudo-pdf"];
    expect(estadoDaAuditoria(ids).cotaAtingida).toBe(true);
    expect(estadoDaAuditoria(ids).faltam).toBe(0);
    expect(podeDecidir(ids)).toBe(true);
  });

  test("2 distintas não liberam", () => {
    const ids = ["msg-boato-01", "msg-laudo-pdf"];
    expect(podeDecidir(ids)).toBe(false);
    expect(estadoDaAuditoria(ids).faltam).toBe(1);
  });
});

describe("ciclo — validação sem nota", () => {
  test("a ordem do catálogo é coerente", () => {
    const r = validarCiclo([...ORDEM_CORRETA]);
    expect(r).toEqual({ ok: true, coerente: true, ordem: [...ORDEM_CORRETA] });
  });

  test("ordem trocada é INCOERENTE, e não um erro", () => {
    // RF-007: sequência incoerente grava igual e a missão segue. O que a missão
    // recusa é modelo incompleto, não modelo diferente.
    const invertida = [...ORDEM_CORRETA].reverse();
    const r = validarCiclo(invertida);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.coerente).toBe(false);
  });

  test("bloco repetido é slot vazio disfarçado de array cheio", () => {
    // Arrastar "gatilho" para dois slots deixa um slot logicamente vazio,
    // ainda que o array venha com 4 posições preenchidas.
    expect(validarCiclo(["gatilho", "gatilho", "repasse", "sem-checagem"])).toEqual({
      ok: false,
      codigo: "blocos-incompletos",
    });
  });

  test("quantidade errada e bloco desconhecido caem no mesmo código", () => {
    expect(validarCiclo(["gatilho"]).ok).toBe(false);
    expect(validarCiclo(["gatilho", "repasse", "sem-checagem", "inventado"]).ok).toBe(false);
  });
});

describe("topologia — o Aha! da Etapa 4", () => {
  test("a opção que interrompe alcança muito menos que as outras duas", () => {
    const interrompeu = topologiaDe("interrompeu");
    expect(interrompeu.interrompeu).toBe(true);
    expect(interrompeu.alcance).toBeLessThan(topologiaDe("silenciou").alcance);
  });

  test("os números batem com a copy: 1.200 e 850", () => {
    // A tela escreve estes números por extenso. Divergir aqui faria a legenda
    // contar outra coisa que o desenho.
    expect(topologiaDe("amplificou").alcance).toBe(1200);
    expect(topologiaDe("silenciou").alcance).toBe(850);
  });

  test("encaminhar e calar NÃO dão no mesmo número", () => {
    // É o ponto da missão: se os dois empatassem, a tela ensinaria que a
    // inação é neutra — e o que a missão descobre é o contrário.
    expect(topologiaDe("amplificou").alcance).not.toBe(topologiaDe("silenciou").alcance);
  });

  test("a malha ANTES do nó do estudante é idêntica nos três caminhos", () => {
    // O que o estudante fez não muda o que aconteceu antes dele; mostrar um
    // começo diferente por escolha seria a revelação mentindo (PROD-09).
    const antes = (d: Parameters<typeof topologiaDe>[0]) =>
      topologiaDe(d)
        .aneis.filter((a) => a.nivel < 3)
        .map((a) => a.nos);
    expect(antes("interrompeu")).toEqual(antes("amplificou"));
    expect(antes("amplificou")).toEqual(antes("silenciou"));
  });

  test("na interrupção, os anéis evitados continuam na tela APAGADOS", () => {
    // O estudante precisa ver o que NÃO aconteceu: um grafo que simplesmente
    // acaba no nó 3 não mostra o que foi evitado.
    const apagados = topologiaDe("interrompeu").aneis.filter((a) => !a.aceso);
    expect(apagados.length).toBeGreaterThan(0);
    expect(apagados.every((a) => a.nivel > 3)).toBe(true);
  });

  test("nenhum anel manda mais de 36 círculos para o DOM", () => {
    // RISCO-001: 1.200 elementos SVG travam o Chromebook da escola. O número
    // real vai em `nos`; `desenhar` é o que a tela põe no DOM.
    for (const d of ["interrompeu", "amplificou", "silenciou"] as const) {
      for (const anel of topologiaDe(d).aneis) {
        expect(anel.desenhar).toBeLessThanOrEqual(36);
        expect(anel.desenhar).toBeLessThanOrEqual(anel.nos);
      }
    }
  });

  test("as curvas mostram a assimetria que a copy promete", () => {
    const c = curvas();
    expect(c.boato.at(-1)).toBe(1200);
    expect(c.laudo.at(-1)).toBe(45);
    expect(c.razao).toBe(26);
    expect(c.minutos).toHaveLength(c.boato.length);
    expect(c.minutos).toHaveLength(c.laudo.length);
  });
});

describe("nível de intervenção — qualitativo, nunca nota", () => {
  test("acertar sem checar não é o mesmo comportamento de checar e agir", () => {
    // Quem denuncia sem ter auditado acertou por sorte, e a plataforma não pode
    // ler isso como leitura crítica.
    expect(nivelDe(false, "B")).toBe("basico");
    expect(nivelDe(true, "B")).toBe("avancado");
  });

  test("checar sem intervir é o degrau do meio", () => {
    expect(nivelDe(true, "A")).toBe("intermediario");
    expect(nivelDe(true, "C")).toBe("intermediario");
  });

  test("o score só produz três valores — os do CHECK do banco", () => {
    const possiveis = new Set(Object.values(SCORE_DO_NIVEL));
    expect([...possiveis].sort((a, b) => a - b)).toEqual([0, 70, 100]);
    for (const auditou of [true, false]) {
      for (const o of ["A", "B", "C"] as const) {
        expect(possiveis.has(scoreDe(auditou, o))).toBe(true);
      }
    }
  });
});

describe("passos — os dois relógios", () => {
  test("sem turma não há gate: o estudante corre no próprio ritmo", () => {
    // Prendê-lo no breakpoint seria um beco sem saída — não há quem dê a
    // largada para quem chegou à rede sem enturmação.
    for (const passo of PASSOS) {
      expect(passoEfetivo(passo, null)).toBe(passo);
      expect(aguardandoATurma(passo, null)).toBe(false);
    }
  });

  test("a Aula 1 é TETO: quem decidiu cedo espera no breakpoint", () => {
    // É o que faz a turma chegar junta ao mapa da rede, com a professora
    // orientando a leitura dos nós.
    expect(passoEfetivo("resultado", "aula1")).toBe("breakpoint");
    expect(aguardandoATurma("resultado", "aula1")).toBe(true);
  });

  test("a Aula 2 é PISO: ninguém é puxado para trás", () => {
    // Puxar seria punir quem leu mais rápido.
    expect(passoEfetivo("contexto", "aula2")).toBe("resultado");
    expect(aguardandoATurma("contexto", "aula2")).toBe(false);
  });

  test("`fim` nunca é revisitado — o latch é do estudante, não da turma", () => {
    // "Pausar simulação" não traz de volta quem já entregou o percurso.
    for (const etapa of ETAPAS) expect(passoEfetivo("fim", etapa)).toBe("fim");
  });

  test("passo desconhecido volta ao começo, não quebra", () => {
    expect(normalizarPasso("passo-de-uma-versao-futura")).toBe("contexto");
  });

  test("a ordem dos passos é uma cadeia sem buracos", () => {
    for (let i = 0; i < PASSOS.length - 1; i += 1) {
      expect(proximoPasso(PASSOS[i]!)).toBe(PASSOS[i + 1]);
    }
    expect(proximoPasso("fim")).toBeNull();
  });
});

describe("invariantes de produto", () => {
  test("nenhuma mensagem de erro quebra a ficção do mensageiro", () => {
    // A criança acha que abriu um app de conversa. "Atividade" e "professor"
    // numa mensagem de erro denunciam o exercício que a missão mede.
    for (const [codigo, texto] of Object.entries(MENSAGENS_DE_ERRO)) {
      // A mensagem do admin-contrato é de operação, não de tela de estudante.
      if (codigo === "escola-obrigatoria") continue;
      expect({ codigo, proibidos: termosProibidosEm(texto) }).toEqual({ codigo, proibidos: [] });
    }
  });

  test("nenhum texto do catálogo que vai à tela rotula ou entrega o exercício", () => {
    const textos = [
      ...MENSAGENS.map((m) => m.texto),
      ...MENSAGENS.flatMap((m) => (m.transcricao ? [m.transcricao] : [])),
      ...opcoesPublicas().map((o) => o.texto),
      ...blocosPublicos().map((b) => b.texto),
    ];
    for (const t of textos) {
      expect({ t, proibidos: termosProibidosEm(t) }).toEqual({ t, proibidos: [] });
    }
  });

  test("a régua proíbe nota escolar sem proibir a nota da direção", () => {
    // A missão não tem nota — mas "nota oficial" é o desmentido que o estudante
    // procura. Proibir a palavra solta reprovaria a própria copy aprovada.
    for (const termo of ["sua nota", "ranking", "pontuação"]) {
      expect(TERMOS_PROIBIDOS_NA_TELA).toContain(termo);
    }
    expect(TERMOS_PROIBIDOS_NA_TELA).not.toContain("nota");
    expect(termosProibidosEm("Alguém viu a nota da escola?")).toEqual([]);
    expect(termosProibidosEm("Veja sua nota final")).not.toEqual([]);
  });

  test("o painel proíbe qualquer coluna que ordene crianças", () => {
    for (const termo of ["score", "nivel", "pontos", "ranking"]) {
      expect(PROIBIDO_NO_PAINEL).toContain(termo);
    }
  });

  test("a redaction de log não deixa passar conteúdo de estudante", () => {
    expect(paraLog("meu nome é Ana e eu moro na rua tal")).toBe("<35 caracteres>");
  });

  test("o teto da reflexão é o do PRD", () => {
    expect(TETO_DA_REFLEXAO).toBe(280);
  });
});
