import { describe, expect, test } from "vitest";

import {
  NAO_AVALIADO,
  RESULTADO,
  ajustesEmMassa,
  caminhoDoPainel,
  celula,
  comRodadaEmAndamento,
  descricaoDaCelula,
  erroDaApi,
  ordenarPorEquipe,
  recorteDoValor,
  recorteInicial,
  resumoPendentes,
  resumoPendentesParaLeitura,
  rodadasComPendentes,
  rodadaSemRegistro,
  rodadasDoPainel,
  rotuloDoRecorte,
  tituloDaAtividadeNoPerfil,
  valorDoRecorte,
  type EstudanteDoPainel,
} from "./evidencias";

const COD = "EF08CO11";
const OUTRA = "EF69CO07";

function estudante(parcial: Partial<EstudanteDoPainel> & Pick<EstudanteDoPainel, "id" | "nome">): EstudanteDoPainel {
  return { equipe: null, porRodada: {}, resultado: {}, ...parcial };
}

const ana = estudante({
  id: "a",
  nome: "Ana Souza",
  porRodada: {
    "1": {
      [COD]: { status: "em_processo", origem: "propria", situacao: "valida" },
      [OUTRA]: { status: "atingiu", origem: "equipe", situacao: "valida" },
    },
    "2": {
      [COD]: { status: "atingiu", origem: "projecao", situacao: "a_revisar" },
      [OUTRA]: { status: "nao_participou", origem: "professor", situacao: "valida" },
    },
  },
  resultado: { [COD]: "em_processo", [OUTRA]: "atingiu" },
});

describe("a célula", () => {
  test("sem linha é 'Não avaliado', nunca 'Não atingiu'", () => {
    const vazia = estudante({ id: "x", nome: "X" });
    for (const recorte of [1, 2, RESULTADO] as const) {
      const leitura = celula(vazia, recorte, COD);
      expect(leitura.rotulo).toBe(NAO_AVALIADO);
      expect(leitura.status).toBeNull();
      expect(leitura.variante).toBe("outline");
    }
    /* A rodada existe, a habilidade não: continua não avaliado. */
    expect(celula(ana, 1, "EF15CO01").rotulo).toBe("Não avaliado");
  });

  test("a evidência própria não leva marca de origem", () => {
    expect(celula(ana, 1, COD)).toEqual({
      rotulo: "Em processo",
      variante: "info",
      status: "em_processo",
      origem: "propria",
    });
  });

  test("a cópia da equipe, a revisão e o 'Não participou' têm marca discreta", () => {
    expect(celula(ana, 1, OUTRA)).toMatchObject({ rotulo: "Atingiu", origem: "equipe", marca: "da equipe" });
    expect(celula(ana, 2, OUTRA)).toMatchObject({
      rotulo: "Não participou",
      variante: "neutral",
      origem: "professor",
      marca: "revisado",
    });
  });

  test("a cópia da aula projetada ainda não confirmada diz 'a revisar'", () => {
    expect(celula(ana, 2, COD)).toMatchObject({
      rotulo: "Atingiu",
      origem: "projecao",
      marca: "a revisar",
      aRevisar: true,
    });
  });

  test("o resultado da atividade não tem origem nem marca", () => {
    const leitura = celula(ana, RESULTADO, COD);
    expect(leitura).toEqual({ rotulo: "Em processo", variante: "info", status: "em_processo" });
  });

  test("'Não atingiu' é aviso, não erro", () => {
    const beto = estudante({ id: "b", nome: "Beto", resultado: { [COD]: "nao_atingiu" } });
    expect(celula(beto, RESULTADO, COD)).toMatchObject({ rotulo: "Não atingiu", variante: "warning" });
  });

  test("o nome acessível diz quem, o quê e de onde veio", () => {
    expect(descricaoDaCelula("Ana Souza", OUTRA, celula(ana, 1, OUTRA))).toBe("Ana Souza, EF69CO07: Atingiu (da equipe)");
    expect(descricaoDaCelula("Ana Souza", COD, celula(ana, 1, COD))).toBe("Ana Souza, EF08CO11: Em processo");
  });
});

describe("as rodadas", () => {
  test("sem evidência nenhuma, a rodada 1 existe assim mesmo", () => {
    expect(rodadasDoPainel({ rodadas: [] })).toEqual([1]);
    expect(rodadasDoPainel({ rodadas: [3, 1, 3] })).toEqual([1, 3]);
  });

  test("os rótulos", () => {
    expect(rotuloDoRecorte(2)).toBe("Rodada 2");
    expect(rotuloDoRecorte(RESULTADO)).toBe("Resultado da atividade (melhor rodada)");
  });

  test("o valor da aba vai e volta, e rodada que não existe cai no resultado", () => {
    const painel = { rodadas: [1, 2] };
    expect(recorteDoValor(valorDoRecorte(2), painel)).toBe(2);
    expect(recorteDoValor(valorDoRecorte(RESULTADO), painel)).toBe(RESULTADO);
    expect(recorteDoValor("7", painel)).toBe(RESULTADO);
  });

  test("a rodada em andamento ganha aba antes da primeira evidência (logo depois de Zerar)", () => {
    expect(comRodadaEmAndamento({ rodadas: [1] }, 2).rodadas).toEqual([1, 2]);
    expect(comRodadaEmAndamento({ rodadas: [1, 2] }, 2).rodadas).toEqual([1, 2]);
    expect(comRodadaEmAndamento({ rodadas: [1] }, null).rodadas).toEqual([1]);
    expect(comRodadaEmAndamento({ rodadas: [] }, 1).rodadas).toEqual([1]);
  });

  test("a rodada sem registro na api é só de leitura: a api aceita até a maior com registro, e a 1 sempre", () => {
    expect(rodadaSemRegistro({ rodadas: [1] }, 2)).toBe(true);
    expect(rodadaSemRegistro({ rodadas: [1, 2] }, 2)).toBe(false);
    expect(rodadaSemRegistro({ rodadas: [] }, 1)).toBe(false);
    expect(rodadaSemRegistro({ rodadas: [1] }, null)).toBe(false);
  });

  test("abre na rodada mais recente com pendência; sem pendência, no resultado", () => {
    expect(recorteInicial({ rodadas: [1, 2, 3], pendentes: { "1": 4, "2": 0, "3": 2 } })).toBe(3);
    expect(recorteInicial({ rodadas: [1, 2], pendentes: { "1": 0, "2": 0 } })).toBe(RESULTADO);
    expect(recorteInicial({ rodadas: [], pendentes: {} })).toBe(RESULTADO);
  });
});

describe("as pendências da aula projetada", () => {
  const pendentes = { "1": 0, "2": 28 };

  test("o aviso só aparece na rodada que tem o que confirmar", () => {
    expect(resumoPendentes(pendentes, 2)).toBe("Resultado da aula projetada aguardando sua confirmação (28)");
    expect(resumoPendentes(pendentes, 1)).toBeNull();
    expect(resumoPendentes(pendentes, 5)).toBeNull();
    expect(resumoPendentes(pendentes, RESULTADO)).toBeNull();
  });

  test("quem só lê não recebe 'sua confirmação'", () => {
    expect(resumoPendentesParaLeitura(pendentes, 2)).toBe(
      "Resultado da aula projetada aguardando confirmação docente (28)",
    );
    expect(resumoPendentesParaLeitura(pendentes, 1)).toBeNull();
  });

  test("a lista das rodadas pendentes, em ordem", () => {
    expect(rodadasComPendentes({ "3": 1, "1": 2, "2": 0 })).toEqual([1, 3]);
    expect(rodadasComPendentes({})).toEqual([]);
  });
});

describe("a ordem das linhas", () => {
  const equipe1 = { id: "e1", nome: "Equipe 1" };
  const equipe2 = { id: "e2", nome: "Equipe 2" };
  const turma = [
    estudante({ id: "d", nome: "Davi Melo", equipe: equipe1 }),
    estudante({ id: "b", nome: "Bruno Lima", equipe: equipe2 }),
    estudante({ id: "a", nome: "Ana Souza", equipe: equipe1 }),
    estudante({ id: "c", nome: "Caio Reis" }),
    estudante({ id: "e", nome: "Érica Dias", equipe: equipe2 }),
  ];

  test("alfabética, com a equipe junta na posição do primeiro colega", () => {
    expect(ordenarPorEquipe(turma).map((e) => e.id)).toEqual(["a", "d", "b", "e", "c"]);
  });

  test("sem equipe, é só a ordem alfabética (com acento no lugar certo)", () => {
    const soltos = turma.map((e) => ({ ...e, equipe: null }));
    expect(ordenarPorEquipe(soltos).map((e) => e.nome)).toEqual([
      "Ana Souza",
      "Bruno Lima",
      "Caio Reis",
      "Davi Melo",
      "Érica Dias",
    ]);
  });

  test("o nível nunca mexe na ordem — não há ranking", () => {
    const comNivel = turma.map((e, i) => ({
      ...e,
      resultado: { [COD]: (["atingiu", "nao_atingiu", "em_processo"] as const)[i % 3]! },
    }));
    expect(ordenarPorEquipe(comNivel).map((e) => e.id)).toEqual(ordenarPorEquipe(turma).map((e) => e.id));
  });
});

describe("o que vai para a api", () => {
  test("os ajustes em massa não repetem estudante", () => {
    expect(ajustesEmMassa(["a", "b", "a"], COD, "nao_participou")).toEqual([
      { estudanteId: "a", habilidade: COD, status: "nao_participou" },
      { estudanteId: "b", habilidade: COD, status: "nao_participou" },
    ]);
    expect(ajustesEmMassa([], COD, "atingiu")).toEqual([]);
  });

  test("o caminho do painel passa pelo BFF, com cada parte escapada", () => {
    expect(caminhoDoPainel("t-1", "exp08ef1b", "a:b")).toBe(
      "/api/plataforma/evidencias/turma/t-1/missao/exp08ef1b/atividade/a%3Ab",
    );
  });

  test("o erro da api vira mensagem e a lista inteira de problemas", () => {
    expect(
      erroDaApi(
        { codigo: "ajuste-invalido", mensagem: "Os ajustes não puderam ser salvos.", erros: ["Há um estudante que não é desta turma.", 3] },
        "padrão",
      ),
    ).toEqual({ mensagem: "Os ajustes não puderam ser salvos.", erros: ["Há um estudante que não é desta turma."] });
    expect(erroDaApi(null, "Tente de novo.")).toEqual({ mensagem: "Tente de novo.", erros: [] });
  });
});

describe("o perfil", () => {
  test("o id da atividade não aparece: com uma, a missão basta", () => {
    expect(tituloDaAtividadeNoPerfil(0, 1)).toBeNull();
    expect(tituloDaAtividadeNoPerfil(1, 3)).toBe("Atividade 2");
  });
});
