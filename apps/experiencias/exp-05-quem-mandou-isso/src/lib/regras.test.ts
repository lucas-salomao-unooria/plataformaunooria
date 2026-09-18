import { describe, expect, test } from "vitest";
import {
  INTERVALO_DO_GATE_MS,
  MS_DO_TOQUE_LONGO,
  SEGUNDOS_ATE_O_SCAFFOLDING,
  estaNoMural,
  mensagensEncaminhadas,
  proporcao,
  segundosDesde,
  telaDoPasso,
} from "./regras";
import type { Estado, LotePublico, Passo } from "./tipos";

const PASSOS: Passo[] = ["contexto", "curadoria", "espera", "revelado", "reflexao", "fim"];

const LOTE: LotePublico = {
  tema: "Mudança nas regras do intervalo",
  grupo: { nome: "Turma 5ºB", subtitulo: "você, Camila, Lucas, Pedro e mais 20" },
  mural: { nome: "Mural da Turma" },
  mensagens: [
    { id: "msg-1", remetente: "Coordenação", hora: "09:40", tipo: "texto", corpo: "a" },
    { id: "msg-2", remetente: "Lucas", hora: "09:42", tipo: "texto", corpo: "b" },
    { id: "msg-3", remetente: "Pedro", hora: "09:43", tipo: "audio", corpo: "c", duracaoSeg: 18 },
    { id: "msg-4", remetente: "Grêmio", hora: "09:45", tipo: "imagem", corpo: "d" },
  ],
};

function estado(parcial: Partial<Estado> = {}): Estado {
  return {
    passo: "curadoria",
    passoDoEstudante: "curadoria",
    aguardandoATurma: false,
    preparada: true,
    encaminhadas: [],
    totalEncaminhadas: 0,
    atingiuPiso: false,
    faltam: 3,
    leuTudo: false,
    podeConfirmar: false,
    encaminhouTudo: false,
    confirmou: false,
    confirmadoEm: null,
    midiasAbertas: [],
    entregouReflexao: false,
    concluidoEm: null,
    turma: { etapa: "exploracao" },
    revelacao: null,
    ...parcial,
  };
}

describe("a missão nasce vazia", () => {
  test("sem lote homologado, TODO passo cai na tela de espera do preparo", () => {
    // Não há banco curado de reserva nesta missão: o lote é do tema que a
    // professora escolheu. Cair no feed com `lote === null` seria uma tela de
    // mensageiro sem mensagem nenhuma — que a criança lê como app quebrado.
    for (const p of PASSOS) expect(telaDoPasso(p, false, false)).toBe("preparo");
  });

  test("com lote, o passo volta a mandar", () => {
    expect(telaDoPasso("contexto", true, false)).toBe("contexto");
  });
});

describe("a tela do passo", () => {
  test("o grupo e o Mural são o MESMO passo — quem alterna é o estudante", () => {
    // Gravar cada travessia como passo faria o polling do gate empurrá-lo de
    // uma tela para a outra a cada 5 s.
    expect(telaDoPasso("curadoria", true, false)).toBe("grupo");
    expect(telaDoPasso("curadoria", true, true)).toBe("mural");
  });

  test("um F5 depois do latch cai na espera, não no Mural aberto", () => {
    // `passo` já vem reconciliado com a etapa da turma. O `muralAberto` do
    // cliente não pode reabrir uma curadoria que o servidor fechou.
    expect(telaDoPasso("espera", true, true)).toBe("espera");
  });

  test("todo passo tem tela — nenhum cai em undefined", () => {
    for (const p of PASSOS) expect(telaDoPasso(p, true, false)).toBeTruthy();
  });
});

describe("o Mural lê na ordem do GRUPO", () => {
  test("não na ordem em que a criança encaminhou", () => {
    // Reordenar por clique faria a mesma curadoria parecer outra a cada
    // revisão — e, na revelação, faria a fita de veracidade mudar de lugar
    // entre uma tela e a seguinte.
    const ids = mensagensEncaminhadas(LOTE, ["msg-4", "msg-1"]).map((m) => m.id);
    expect(ids).toEqual(["msg-1", "msg-4"]);
  });

  test("ignora id que não está no lote desta turma", () => {
    // O lote é homologado por turma: uma tela velha falando com um lote novo
    // não pode desenhar um balão fantasma.
    expect(mensagensEncaminhadas(LOTE, ["msg-9"])).toEqual([]);
  });

  test("estaNoMural é o que acende o selo Encaminhada", () => {
    expect(estaNoMural(estado({ encaminhadas: ["msg-2"] }), "msg-2")).toBe(true);
    expect(estaNoMural(estado({ encaminhadas: ["msg-2"] }), "msg-3")).toBe(false);
  });
});

describe("as barras do infográfico", () => {
  test("a proporção é inteira e sobre a soma das duas", () => {
    expect(proporcao(30, 40)).toBe(75);
    expect(proporcao(10, 40)).toBe(25);
  });

  test("valor pequeno não some: piso de 2%", () => {
    // Largura zero diz "não existe" quando o dado é "existe e é pequeno" — que
    // é justamente a leitura do card quando a sala filtrou bem.
    expect(proporcao(1, 400)).toBe(2);
  });

  test("turma sem nenhum encaminhamento não desenha barra nenhuma", () => {
    expect(proporcao(0, 0)).toBe(0);
    expect(proporcao(0, 12)).toBe(0);
  });
});

describe("segundosDesde", () => {
  test("não devolve negativo quando o relógio da escola atrasa", () => {
    // O tempo até o primeiro encaminhamento é o dado central da missão: um
    // número negativo aqui seria um evento de telemetria mentindo sobre o
    // impulso que ela existe para medir.
    expect(segundosDesde(2_000, 1_000)).toBe(0);
  });

  test("conta segundos inteiros", () => {
    expect(segundosDesde(0, 12_800)).toBe(12);
  });
});

describe("as travas de tempo são as do ofício", () => {
  test("o toque longo é de 400 ms", () => {
    // Mais curto, a rolagem do feed vira seleção acidental num tablet — e ela
    // encaminha uma mensagem que não escolheu, para um Mural irreversível.
    expect(MS_DO_TOQUE_LONGO).toBe(400);
  });

  test("o balão de inação só entra depois de 4 minutos", () => {
    // Encurtar isto entrega o gesto a quem ainda estava lendo, e a missão mede
    // quem travou — não quem demorou.
    expect(SEGUNDOS_ATE_O_SCAFFOLDING).toBe(240);
  });

  test("o gate da turma é polling de 5 s (ADR-93)", () => {
    expect(INTERVALO_DO_GATE_MS).toBe(5_000);
  });
});
