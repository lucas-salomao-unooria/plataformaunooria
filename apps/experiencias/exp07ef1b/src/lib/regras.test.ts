import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  alternar,
  avancar,
  codePoints,
  dicaDoFeed,
  esperaDaTentativa,
  etapaAntes,
  faltamNaReflexao,
  gateMudou,
  legendaCurta,
  legendaValida,
  nomeDaConta,
  normalizarLegenda,
  passoEfetivo,
  precisaDoMural,
  reflexaoValida,
  salvosValidos,
  segundosDesde,
  selecionados,
  separarEnunciado,
  situacaoDaSelecao,
  telaDoPasso,
  temaNaFrase,
  voltar,
  SEGUNDOS_ATE_A_DICA,
  TEMPO_DE_FEED_MAX_S,
} from "./regras";
import { ETAPAS, PASSOS, type Estado, type Etapa, type Passo, type RespostaGate } from "./tipos";

/**
 * A api é a fonte da verdade dos passos e das etapas. O cliente espelha as
 * duas listas (para o `switch` da tela ser exaustivo) — e este teste LÊ o
 * arquivo da api e reprova a divergência. Sem ele, um passo novo no servidor
 * cairia numa tela que não existe, e o typecheck não veria.
 */
function listaDoArquivo(caminho: string, nome: string): string[] {
  const fonte = readFileSync(caminho, "utf8");
  const bloco = new RegExp(`export const ${nome} = \\[([\\s\\S]*?)\\] as const`).exec(fonte);
  if (!bloco?.[1]) throw new Error(`${nome} não encontrado em ${caminho}`);
  return [...bloco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "");
}

const PASSOS_DA_API = "../../api/src/a-selecao/regras/passos.ts";

describe("o espelho dos passos e das etapas da api", () => {
  test("PASSOS é o da api, na mesma ordem", () => {
    expect([...PASSOS]).toEqual(listaDoArquivo(PASSOS_DA_API, "PASSOS"));
  });

  test("ETAPAS é o da api, na mesma ordem", () => {
    expect([...ETAPAS]).toEqual(listaDoArquivo(PASSOS_DA_API, "ETAPAS"));
  });
});

describe("passoEfetivo — a mesma resposta da api num F5", () => {
  test("antes de publicar, a etapa não toca a criança", () => {
    for (const etapa of ETAPAS) {
      expect(passoEfetivo("desafio", etapa)).toBe("desafio");
      expect(passoEfetivo("feed", etapa)).toBe("feed");
      expect(passoEfetivo("salvos", etapa)).toBe("salvos");
    }
  });

  test("entre a publicação e a explicação, a etapa é piso e teto", () => {
    const esperado: Record<Etapa, Passo> = {
      exploracao: "publicado",
      mural: "mural",
      fichas: "fichas",
      explicacao: "explicacao",
    };
    for (const passo of ["publicado", "mural", "fichas", "explicacao"] as const) {
      for (const etapa of ETAPAS) expect(passoEfetivo(passo, etapa)).toBe(esperado[etapa]);
    }
  });

  test("da reflexão em diante, o passo é da criança", () => {
    for (const passo of ["reflexao", "enquetes", "fim"] as const) {
      for (const etapa of ETAPAS) expect(passoEfetivo(passo, etapa)).toBe(passo);
    }
  });

  test("etapaAntes segue a ordem do botão único da professora", () => {
    expect(etapaAntes("exploracao", "mural")).toBe(true);
    expect(etapaAntes("mural", "fichas")).toBe(true);
    expect(etapaAntes("fichas", "fichas")).toBe(false);
    expect(etapaAntes("explicacao", "mural")).toBe(false);
  });
});

describe("a tela de cada passo", () => {
  test("todo passo tem tela, e o Mural é uma tela só nas duas etapas", () => {
    const telas = PASSOS.map(telaDoPasso);
    expect(telas).toEqual([
      "desafio",
      "feed",
      "salvos",
      "espera",
      "mural",
      "mural",
      "explicacao",
      "reflexao",
      "enquetes",
      "fim",
    ]);
  });

  test("só o Mural e as fichas leem o Mural", () => {
    expect(PASSOS.filter(precisaDoMural)).toEqual(["mural", "fichas"]);
  });
});

describe("gateMudou — quando o polling relê a sessão", () => {
  const estado = {
    passo: "publicado",
    etapa: "exploracao",
    rodada: 1,
    coberturaId: "c1",
  } as Estado;
  const gate = (parte: Partial<RespostaGate>): RespostaGate => ({
    etapa: "exploracao",
    rodada: 1,
    coberturaId: "c1",
    passoEfetivo: "publicado",
    aguardandoOProfessor: true,
    agora: "2026-09-25T08:00:00.000Z",
    ...parte,
  });

  test("nada mudou: não relê", () => {
    expect(gateMudou(estado, gate({}))).toBe(false);
  });

  test("a professora abriu o Mural", () => {
    expect(gateMudou(estado, gate({ passoEfetivo: "mural", etapa: "mural" }))).toBe(true);
  });

  test("a etapa andou mesmo sem o passo andar", () => {
    expect(gateMudou(estado, gate({ etapa: "mural" }))).toBe(true);
  });

  test("zerar a turma (rodada) e tema novo (cobertura) relêem", () => {
    expect(gateMudou(estado, gate({ rodada: 2 }))).toBe(true);
    expect(gateMudou(estado, gate({ coberturaId: "c2" }))).toBe(true);
  });

  test("rodada nula (o gate ainda não nasceu) não conta como mudança", () => {
    expect(gateMudou(estado, gate({ rodada: null, coberturaId: null }))).toBe(false);
  });
});

describe("a contagem é em CODE POINTS, como a api", () => {
  test("um emoji é um caractere, não dois", () => {
    expect("😀".length).toBe(2);
    expect(codePoints("😀")).toBe(1);
  });

  test("dez emojis passam no piso de 10 — o `.length` diria 20", () => {
    const dez = "😀".repeat(10);
    expect(legendaValida(dez, 10, 140)).toBe(true);
    expect(legendaValida("😀".repeat(9), 10, 140)).toBe(false);
  });

  test("140 emojis cabem; 141 não", () => {
    expect(legendaValida("😀".repeat(140), 10, 140)).toBe(true);
    expect(legendaValida("😀".repeat(141), 10, 140)).toBe(false);
  });

  test("a legenda é contada DEPOIS de normalizada, como a api grava", () => {
    expect(normalizarLegenda("  a\n\n\n   b  ")).toBe("a b");
    // Dez caracteres de espaço em volta de três letras não são uma legenda.
    expect(legendaValida("a          bc", 10, 140)).toBe(false);
  });

  test("o aviso de legenda curta só aparece depois de começar a escrever", () => {
    expect(legendaCurta("", 10)).toBe(false);
    expect(legendaCurta("   ", 10)).toBe(false);
    expect(legendaCurta("curta", 10)).toBe(true);
    expect(legendaCurta("agora sim, dez", 10)).toBe(false);
  });

  test("a reflexão conta o texto aparado, de 100 a 500", () => {
    expect(faltamNaReflexao("", 100)).toBe(100);
    expect(faltamNaReflexao(`  ${"a".repeat(98)}  `, 100)).toBe(2);
    expect(faltamNaReflexao("a".repeat(120), 100)).toBe(0);
    expect(reflexaoValida("😀".repeat(100), 100, 500)).toBe(true);
    expect(reflexaoValida("😀".repeat(501), 100, 500)).toBe(false);
  });
});

describe("a poda: exatamente três", () => {
  test("pronta, insuficiente e excesso", () => {
    expect(situacaoDaSelecao(3, 3)).toEqual({ tipo: "pronta" });
    expect(situacaoDaSelecao(1, 3)).toEqual({ tipo: "insuficiente", faltam: 2 });
    expect(situacaoDaSelecao(12, 3)).toEqual({ tipo: "excesso", excesso: 9 });
  });

  test("a seleção deriva dos salvos, na ordem do salvamento, menos os desmarcados", () => {
    expect(selecionados(["b", "a", "c", "d"], new Set(["c"]))).toEqual(["b", "a", "d"]);
  });

  test("alternar liga e desliga preservando a ordem dos outros", () => {
    expect(alternar(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(alternar(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  test("os salvos do F5 que não são desta cobertura caem, e sem repetição", () => {
    const ids = new Set(["post_a_1", "post_b_1"]);
    expect(salvosValidos(["post_b_1", "post_x_9", 3, "post_b_1", "post_a_1"], ids)).toEqual(["post_b_1", "post_a_1"]);
  });
});

describe("o andaime do feed", () => {
  test("nenhuma dica enquanto está cedo", () => {
    expect(dicaDoFeed(0, SEGUNDOS_ATE_A_DICA - 1)).toBeNull();
  });

  test("três minutos sem salvar: a dica do marcador", () => {
    expect(dicaDoFeed(0, SEGUNDOS_ATE_A_DICA)).toBe("inatividade");
  });

  test("ela some no primeiro salvamento", () => {
    expect(dicaDoFeed(1, 999)).toBeNull();
  });

  test("o tempo nunca é negativo (o relógio da máquina da escola atrasa) nem passa do teto da api", () => {
    expect(segundosDesde(10_000, 5_000)).toBe(0);
    expect(segundosDesde(0, 61_500)).toBe(61);
    expect(segundosDesde(0, 99_999_999)).toBe(TEMPO_DE_FEED_MAX_S);
  });
});

describe("textos que a tela monta", () => {
  test("o artigo do tema desce para minúscula; o nome próprio não", () => {
    expect(temaNaFrase("A reforma e ocupação da praça central")).toBe("a reforma e ocupação da praça central");
    expect(temaNaFrase("Os jogos da escola")).toBe("os jogos da escola");
    expect(temaNaFrase("Praça Central reaberta")).toBe("Praça Central reaberta");
    expect(temaNaFrase("Alagamento no bairro")).toBe("Alagamento no bairro");
  });

  test("a conta aparece sem o @, como no cabeçalho do post", () => {
    expect(nomeDaConta("@folhaoficial_")).toBe("folhaoficial_");
  });
});

describe("o toque no Story do Mural", () => {
  test("avança dentro da tríade e, no fim da própria, passa à do colega", () => {
    expect(avancar({ lado: "minha", indice: 0 }, 3)).toEqual({ lado: "minha", indice: 1 });
    expect(avancar({ lado: "minha", indice: 2 }, 3)).toEqual({ lado: "par", indice: 0 });
    expect(avancar({ lado: "par", indice: 2 }, 3)).toEqual({ lado: "par", indice: 2 });
  });

  test("volta do primeiro do colega ao último da própria", () => {
    expect(voltar({ lado: "par", indice: 0 }, 3)).toEqual({ lado: "minha", indice: 2 });
    expect(voltar({ lado: "minha", indice: 0 }, 3)).toEqual({ lado: "minha", indice: 0 });
    expect(voltar({ lado: "par", indice: 2 }, 3)).toEqual({ lado: "par", indice: 1 });
  });
});

describe("o enunciado da enquete: a mensagem da Amara e a pergunta", () => {
  /** Os enunciados REAIS da ficha da api — o teste vale para o texto que vai à tela. */
  function enunciadosDaFicha(): string[] {
    const fonte = readFileSync("../../api/src/evidencias/fichas/exp07ef1b.ts", "utf8");
    return [...fonte.matchAll(/enunciado:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1] ?? ""}"`) as string);
  }

  test("os dois enunciados da ficha são só a pergunta do PO, sem balão de contexto", () => {
    const [p1, p2] = enunciadosDaFicha();
    expect(p1 && separarEnunciado(p1)).toEqual({
      contexto: null,
      pergunta:
        "Imagina que alguém da escola viu os Stories que você publicou e mandou: 'Valeu pelo resumo! Agora já sei tudo sobre o que aconteceu.' O que você diria?",
    });
    expect(p2 && separarEnunciado(p2)).toEqual({
      contexto: null,
      pergunta:
        "Lembra quando você viu os Stories do colega no Mural e a história parecia outra? Os dois partiram do mesmo feed. O que faz mais sentido pensar sobre isso?",
    });
  });

  test("sem a linha em branco, tudo é pergunta — nada some", () => {
    expect(separarEnunciado("Só a pergunta?")).toEqual({ contexto: null, pergunta: "Só a pergunta?" });
  });

  test("separador sem pergunta depois não apaga o texto", () => {
    expect(separarEnunciado("Só o contexto.\n\n   ")).toEqual({ contexto: null, pergunta: "Só o contexto." });
  });
});

describe("a espera entre tentativas", () => {
  test("2 s, 4 s, 8 s e depois 15 s", () => {
    expect([0, 1, 2, 3, 10].map(esperaDaTentativa)).toEqual([2_000, 4_000, 8_000, 15_000, 15_000]);
  });
});
