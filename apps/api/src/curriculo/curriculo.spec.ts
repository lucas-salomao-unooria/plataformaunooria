import {
  habilidadesDe,
  habilidadesDeComputacao,
  habilidadePorCodigo,
  agruparPorOrganizador,
  TOTAL_DE_HABILIDADES,
} from "./consulta";
import { componentesDoAno, componentePorSlug, anosInvalidos, tipoDeOrganizador } from "./componentes";
import { habilidadesComputacao } from "./dados/habilidades-computacao";
import {
  aulasSemanaisDeReferencia,
  horasRelogioNoAno,
  cumpreMinimoLegal,
  HORAS_MINIMAS_ANUAIS,
} from "./carga-horaria";

/**
 * Estes testes guardam o DADO, não só o código. Uma reextração que perca
 * habilidades passa no typecheck sem reclamar de nada — o array continua sendo
 * um array. Os totais abaixo são os números oficiais da BNCC, e é por isso que
 * eles estão escritos: se a próxima execução do extrator devolver 1.290
 * habilidades no EF, o professor de alguma turma perde currículo em silêncio.
 */
describe("dado extraído da BNCC", () => {
  it("tem os totais oficiais de cada documento", () => {
    // 1304 (EF) + 183 (EM) + 130 (Computação — o anexo INTEIRO).
    //
    // Eram 129 até 2026-09-17, e a linha que faltava era a EF05CO011: a BNCC a
    // publica com TRÊS dígitos, num erro de digitação dela, e o extrator só
    // reconhecia dois. O número 129 estava escrito aqui como se fosse o
    // esperado ("de 130 no anexo") — um teste que documentava a perda em vez de
    // recusá-la.
    expect(TOTAL_DE_HABILIDADES).toBe(1304 + 183 + 130);
  });

  it("preserva o texto do documento HOMOLOGADO, não o do rascunho", () => {
    // A página do Ensino Médio do MEC serve um PDF de maio/2018 em que esta
    // habilidade não tem "criticamente" nem "fatos relativos". Se este teste
    // cair, alguém apontou o extrator para o rascunho.
    const h = habilidadePorCodigo("EM13MAT101");
    expect(h?.descricao).toContain("criticamente");
    expect(h?.descricao).toContain("fatos relativos");
  });

  it("expande a faixa de anos do código, sem duplicar a habilidade", () => {
    const h = habilidadePorCodigo("EF15LP01");
    expect(h?.anos).toEqual(["1EF", "2EF", "3EF", "4EF", "5EF"]);

    // A mesma habilidade responde em todos os anos da faixa, e é a MESMA.
    const no1 = habilidadesDe("lingua-portuguesa", "1EF");
    const no5 = habilidadesDe("lingua-portuguesa", "5EF");
    expect(no1.some((x) => x.codigo === "EF15LP01")).toBe(true);
    expect(no5.some((x) => x.codigo === "EF15LP01")).toBe(true);
  });

  it("não confunde a sigla EF de etapa com a de Educação Física", () => {
    const h = habilidadePorCodigo("EF12EF01");
    expect(h?.componente).toBe("educacao-fisica");
    expect(h?.anos).toEqual(["1EF", "2EF"]);
  });

  it("liga a habilidade ao objeto de conhecimento da MESMA linha da tabela", () => {
    // A associação vem de coordenadas do PDF; um erro de meio ponto no
    // alinhamento troca o objeto de conhecimento de todas as habilidades da
    // página, e o texto continua plausível. Estes dois são conferidos no PDF.
    expect(habilidadePorCodigo("EF15LP01")?.objetoDeConhecimento).toBe(
      "Reconstrução das condições de produção e recepção de textos",
    );
    expect(habilidadePorCodigo("EF01MA01")?.unidadeTematica).toBe("Números");
  });

  /**
   * A integridade da BNCC de Computação, que tem um layout só dela: eixo e
   * objeto de conhecimento CENTRADOS na célula, e não alinhados ao topo como no
   * resto do documento. O extrator aplicava a regra do resto ("o último rótulo
   * acima") e errava 80 das 130 linhas — a primeira habilidade de cada ano sem
   * eixo nenhum, e as das fronteiras com o eixo anterior.
   *
   * **Nada disso aparecia.** O tipo é `string | null`, o `tsc` não tem o que
   * dizer, e a tela do plano de ensino agrupa por eixo e lista o objeto: o
   * resultado era um agrupamento plausível e inteiramente falso, que a
   * professora leria como currículo.
   *
   * O que estes testes usam é a ESTRUTURA do documento, não uma amostra: os
   * rótulos ladrilham a coluna, então as habilidades de cada um saem em bloco
   * CONSECUTIVO, e os três eixos aparecem uma vez cada, na mesma ordem, em todo
   * ano. Uma reextração que erre a geometria quebra as duas coisas.
   */
  describe("BNCC de Computação: a geometria da tabela", () => {
    const EIXOS = ["PENSAMENTO COMPUTACIONAL", "MUNDO DIGITAL", "CULTURA DIGITAL"];
    const porAno = () => {
      const grupos = new Map<string, (typeof habilidadesComputacao)[number][]>();
      for (const h of habilidadesComputacao) {
        const chave = h.codigo.slice(0, 6);
        grupos.set(chave, [...(grupos.get(chave) ?? []), h]);
      }
      return grupos;
    };
    /** Os valores distintos na ordem em que aparecem, sem repetir vizinhos. */
    const blocos = (valores: (string | null | undefined)[]) =>
      valores.filter((v, i) => i === 0 || v !== valores[i - 1]);

    it("dá a cada ano os três eixos, uma vez cada e na ordem do documento", () => {
      for (const [ano, hs] of porAno()) {
        if (ano.startsWith("EM13")) continue; // o EM usa competência, não eixo
        expect({ ano, eixos: blocos(hs.map((h) => h.eixo)) }).toEqual({ ano, eixos: EIXOS });
      }
    });

    it("não deixa as habilidades de um mesmo objeto de conhecimento espalhadas", () => {
      for (const [ano, hs] of porAno()) {
        const vistos = blocos(hs.map((h) => h.objetoDeConhecimento));
        // Um valor que reaparece depois de outro é rótulo atribuído fora do
        // bloco dele: a célula da tabela não se parte em duas.
        expect({ ano, repetidos: vistos.length - new Set(vistos).size }).toEqual({
          ano,
          repetidos: 0,
        });
      }
    });

    it("não grava cabeçalho de tabela como objeto de conhecimento", () => {
      // "OBJETO DE CONHECIMENTO" no singular é o cabeçalho DESTE documento, e a
      // lista de ruído do extrator só trazia o plural da BNCC regular: onze
      // habilidades saíram com o cabeçalho gravado como o objeto delas.
      const cabecalhos = habilidadesComputacao.filter((h) =>
        /^(EIXO|OBJETOS? DE CONHECIMENTO|HABILIDADES?|COMPETÊNCIA)/i.test(
          h.objetoDeConhecimento ?? "",
        ),
      );
      expect(cabecalhos.map((h) => h.codigo)).toEqual([]);
    });

    it("traz a EF05CO011, que a própria BNCC publica com três dígitos", () => {
      // O código fica como está no documento oficial. "Corrigi-lo" para
      // EF05CO11 inventaria um código que nenhuma rede vai procurar.
      const h = habilidadePorCodigo("EF05CO011");
      expect(h?.eixo).toBe("CULTURA DIGITAL");
      expect(h?.anos).toEqual(["5EF"]);
    });

    it("põe a EF05CO08 no eixo e no objeto do PDF", () => {
      // Conferida à mão na página 32 do anexo: ela é de CULTURA DIGITAL, e o
      // dataset a dava como MUNDO DIGITAL com o cabeçalho da tabela no lugar do
      // objeto de conhecimento. A prova é do DADO: ela não depende de missão
      // nenhuma usar a habilidade.
      const h = habilidadePorCodigo("EF05CO08");
      expect(h?.eixo).toBe("CULTURA DIGITAL");
      expect(h?.objetoDeConhecimento).toBe("Segurança e responsabilidade no uso da tecnologia");
      expect(h?.descricao).toBe(
        "Acessar as informações na Internet de forma crítica para distinguir os conteúdos confiáveis de não confiáveis.",
      );
    });

    it("dá eixo a toda habilidade do EF — e a nenhuma do EM", () => {
      // No Ensino Médio a coluna é COMPETÊNCIA ESPECÍFICA: não há eixo nem
      // objeto de conhecimento para atribuir, e inventar um seria pior.
      for (const h of habilidadesComputacao) {
        const temEixo = h.eixo !== null;
        expect({ codigo: h.codigo, temEixo }).toEqual({
          codigo: h.codigo,
          temEixo: h.etapa === "EF",
        });
      }
    });
  });

  it("cobre todos os anos de 1EF a 3EM em Língua Portuguesa e Matemática", () => {
    const anos = ["1EF", "2EF", "3EF", "4EF", "5EF", "6EF", "7EF", "8EF", "9EF"];
    for (const ano of anos) {
      expect(habilidadesDe("lingua-portuguesa", ano).length).toBeGreaterThan(0);
      expect(habilidadesDe("matematica", ano).length).toBeGreaterThan(0);
    }
    for (const ano of ["1EM", "2EM", "3EM"]) {
      expect(habilidadesDe("lingua-portuguesa-em", ano).length).toBeGreaterThan(0);
      expect(habilidadesDe("matematica-em", ano).length).toBeGreaterThan(0);
    }
  });
});

describe("componente da rede × área da BNCC", () => {
  it("dá ao professor de Biologia as habilidades de Ciências da Natureza", () => {
    // O caso que quebra qualquer produto que trate componente e origem como a
    // mesma coisa: a BNCC do EM não tem habilidades de Biologia.
    const bio = habilidadesDe("biologia", "2EM");
    expect(bio.length).toBeGreaterThan(0);
    expect(bio.every((h) => h.codigo.startsWith("EM13CNT"))).toBe(true);
    expect(componentePorSlug("biologia")?.habilidadesPorArea).toBe(true);
  });

  it("dá a Biologia, Física e Química o mesmo conjunto — elas compartilham a área", () => {
    const bio = habilidadesDe("biologia", "1EM").map((h) => h.codigo);
    const fis = habilidadesDe("fisica", "1EM").map((h) => h.codigo);
    const qui = habilidadesDe("quimica", "1EM").map((h) => h.codigo);
    expect(fis).toEqual(bio);
    expect(qui).toEqual(bio);
  });

  it("mantém Língua Portuguesa e Matemática como componentes nomeados no EM", () => {
    expect(habilidadesDe("lingua-portuguesa-em", "1EM").every((h) => h.codigo.startsWith("EM13LP"))).toBe(true);
    expect(habilidadesDe("matematica-em", "1EM").every((h) => h.codigo.startsWith("EM13MAT"))).toBe(true);
    expect(componentePorSlug("lingua-portuguesa-em")?.habilidadesPorArea).toBeUndefined();
  });

  it("não oferta Língua Inglesa antes do 6º ano (LDB art. 26 §5º)", () => {
    const nos5 = componentesDoAno("5EF").map((c) => c.slug);
    const nos6 = componentesDoAno("6EF").map((c) => c.slug);
    expect(nos5).not.toContain("lingua-inglesa");
    expect(nos6).toContain("lingua-inglesa");
  });

  it("não oferta Ensino Religioso no Ensino Médio (LDB art. 33)", () => {
    expect(componentesDoAno("1EM").map((c) => c.slug)).not.toContain("ensino-religioso");
    expect(componentesDoAno("9EF").map((c) => c.slug)).toContain("ensino-religioso");
  });

  it("não expõe Computação como componente escolhível — ela é transversal", () => {
    expect(componentesDoAno("5EF").map((c) => c.slug)).not.toContain("computacao");
    expect(habilidadesDeComputacao("5EF").length).toBeGreaterThan(0);
  });

  it("só aponta para anos que existem", () => {
    expect(anosInvalidos()).toEqual([]);
  });
});

describe("organizador por componente", () => {
  it("chama de prática de linguagem em Língua Portuguesa, não de unidade temática", () => {
    expect(tipoDeOrganizador("lingua-portuguesa", "EF")).toBe("pratica-de-linguagem");
    expect(tipoDeOrganizador("matematica", "EF")).toBe("unidade-tematica");
    expect(tipoDeOrganizador("lingua-inglesa", "EF")).toBe("eixo");
    expect(tipoDeOrganizador("ciencias-da-natureza", "EM")).toBe("competencia");
  });

  it("agrupa o Ensino Médio por competência específica, lida do código", () => {
    const grupos = agruparPorOrganizador(
      habilidadesDe("matematica-em", "1EM"),
      "EM",
      "matematica",
    );
    expect(grupos.length).toBeGreaterThan(1);
    expect(grupos[0]!.organizador).toMatch(/^Competência específica \d$/);
  });

  it("agrupa Matemática do 6º ano nas unidades temáticas da BNCC", () => {
    const grupos = agruparPorOrganizador(habilidadesDe("matematica", "6EF"), "EF", "matematica");
    const nomes = grupos.map((g) => g.organizador);
    expect(nomes).toContain("Números");
    expect(nomes).toContain("Álgebra");
    expect(nomes).toContain("Geometria");
  });

  it("joga o resíduo da extração para o fim, sem esconder habilidade", () => {
    const grupos = agruparPorOrganizador(
      [
        { codigo: "X2", descricao: "b", etapa: "EF", anos: ["1EF"], componente: "x", area: null },
        { codigo: "X1", descricao: "a", etapa: "EF", anos: ["1EF"], componente: "x", area: null, unidadeTematica: "Números" },
      ],
      "EF",
      "matematica",
    );
    expect(grupos.map((g) => g.organizador)).toEqual(["Números", "Sem classificação"]);
  });
});

describe("carga horária", () => {
  it("converte hora-aula em hora-relógio (Parecer CNE/CEB 8/2004)", () => {
    // 25 aulas de 50min × 40 semanas = 833,3h: logo acima do mínimo do EF.
    expect(horasRelogioNoAno(25)).toBeCloseTo(833.3, 1);
    // 30 aulas = 1.000h, exatamente o mínimo do EM. É a âncora que explica
    // por que quase toda rede pública converge para 30 aulas semanais no EM.
    expect(horasRelogioNoAno(30)).toBe(1000);
    // O erro que o parecer proíbe: tratar aula de 45min como uma hora.
    expect(horasRelogioNoAno(30, 45)).toBe(900);
  });

  it("usa o mínimo do EM da Lei 14.945/2024, não os 800h revogados", () => {
    expect(HORAS_MINIMAS_ANUAIS.EM).toBe(1000);
    expect(HORAS_MINIMAS_ANUAIS.EF).toBe(800);
  });

  it("avisa quando a matriz não fecha o mínimo legal", () => {
    expect(cumpreMinimoLegal(25, "EF").cumpre).toBe(true);
    expect(cumpreMinimoLegal(23, "EF").cumpre).toBe(false);
    // 25 aulas cumprem o EF e NÃO cumprem o EM — é o mesmo número, e a
    // resposta muda com a etapa.
    expect(cumpreMinimoLegal(25, "EM").cumpre).toBe(false);
    expect(cumpreMinimoLegal(30, "EM").cumpre).toBe(true);
  });

  it("distingue componente não ofertado de zero aula", () => {
    expect(aulasSemanaisDeReferencia("matematica", "1EF")).toBe(6);
    // Arte nos anos finais é 2, não 1: com dez redes a mediana se firmou em 2
    // (SME-SP e RJ ofertam 2; MG e GO, que ofertam 1, são quem trima a aula
    // para fechar a família de 25).
    expect(aulasSemanaisDeReferencia("arte", "7EF")).toBe(2);
    expect(aulasSemanaisDeReferencia("lingua-inglesa", "1EF")).toBeNull();
    expect(aulasSemanaisDeReferencia("biologia", "9EF")).toBeNull();
  });

  it("soma a matriz de referência de cada etapa", () => {
    const soma = (ano: string) =>
      componentesDoAno(ano).reduce(
        (t, c) => t + (aulasSemanaisDeReferencia(c.slug, ano as never) ?? 0),
        0,
      );
    // A matriz é o SUBTOTAL da base comum, não um total de semana: a jornada do
    // Fundamental é bimodal (25 aulas ≈ 833h em seis redes, 28–30 ≈ 890–1.000h
    // em quatro), e uma média entre as duas não descreveria rede nenhuma.
    //
    // Anos INICIAIS somam 24 e não 26 porque Língua Inglesa fica fora: a LDB só
    // a exige do 6º ano em diante, e a BNCC não tem habilidade dela antes disso.
    // Componente sem habilidade da Base não entra num planejamento dirigido
    // pela Base — vai para a parte diversificada, que é da rede.
    expect(soma("3EF")).toBe(24);
    // Anos FINAIS fecham as 26 da base comum, com o inglês dentro.
    expect(soma("7EF")).toBe(26);
    // No EM, 24 de Formação Geral Básica; as 6 restantes das 30 aulas são o
    // itinerário formativo (LDB art. 36, mínimo de 600h no triênio).
    expect(soma("1EM")).toBe(24);
  });
});
