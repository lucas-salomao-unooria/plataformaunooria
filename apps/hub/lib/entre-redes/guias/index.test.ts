import { describe, expect, test } from "vitest";

import { MISSOES_DISPONIVEIS } from "../catalogo";
import { buscarGuia, MISSOES_SEM_GUIA, todosOsGuias } from "./index";
import { SECOES_DO_GUIA, TEMPOS_DO_GUIA } from "./tipos";

/**
 * O que estes testes seguram é uma coisa só: **missão publicada sem guia**.
 *
 * O tipo `GuiaDaAula` cobra as seções de quem escreve um guia; ninguém cobra de
 * quem publica uma missão e não escreve nenhum. Esse é o caso que dói — o
 * professor recebe a missão na trilha, com o botão "Abrir guia da aula" levando
 * a um 404, e descobre isso na frente da turma.
 */
describe("guias da aula", () => {
  test("toda missão disponível com experiência tem guia", () => {
    const semGuia = MISSOES_DISPONIVEIS.filter((missao) => missao.expId)
      .map((missao) => missao.expId!)
      .filter((expId) => !buscarGuia(expId) && !MISSOES_SEM_GUIA.includes(expId));

    expect(semGuia).toEqual([]);
  });

  test("todo guia aponta para uma missão que existe no catálogo", () => {
    const publicadas = new Set(
      MISSOES_DISPONIVEIS.map((missao) => missao.expId).filter(Boolean),
    );
    for (const guia of todosOsGuias()) {
      expect(publicadas.has(guia.expId)).toBe(true);
    }
  });

  test("nenhum guia tem seção vazia", () => {
    for (const guia of todosOsGuias()) {
      expect(guia.objetivos.length, `${guia.expId}: objetivos`).toBeGreaterThan(0);
      expect(guia.bncc.length, `${guia.expId}: bncc`).toBeGreaterThan(0);
      expect(guia.antes.tecnico.length, `${guia.expId}: preparo técnico`).toBeGreaterThan(0);
      expect(guia.antes.pedagogico.length, `${guia.expId}: preparo pedagógico`).toBeGreaterThan(0);
      expect(guia.antes.naoDiga.length, `${guia.expId}: o que não dizer`).toBeGreaterThan(0);
      expect(guia.roteiro.linhas.length, `${guia.expId}: roteiro`).toBeGreaterThan(0);
      expect(guia.debate.perguntas.length, `${guia.expId}: perguntas`).toBeGreaterThan(3);
      expect(guia.observacao.marcas.length, `${guia.expId}: folha`).toBeGreaterThan(1);
      expect(guia.mediacao.length, `${guia.expId}: mediação`).toBeGreaterThan(0);
      expect(guia.depois.sintese.length, `${guia.expId}: síntese`).toBeGreaterThan(1);
      expect(guia.depois.rubrica.criterios.length, `${guia.expId}: rubrica`).toBeGreaterThan(0);
      expect(guia.depois.desdobramentos.length, `${guia.expId}: desdobramentos`).toBeGreaterThan(0);
      expect(guia.cuidados.length, `${guia.expId}: cuidados`).toBeGreaterThan(0);
      expect(guia.adaptacoes.length, `${guia.expId}: adaptações`).toBeGreaterThan(0);
      expect(guia.duvidas.length, `${guia.expId}: dúvidas`).toBeGreaterThan(0);
    }
  });

  /*
   * A escada do debate. Perguntar "onde isso acontece na sua vida?" a uma turma
   * que ainda não descreveu o que viu produz a resposta que o estudante acha
   * que o professor quer ouvir — por isso todo guia precisa das duas pontas.
   *
   * As exceções, e só elas, por decisão do dono do produto:
   * - O Enigma da Capa da Rádio (exp02ef1b) saiu da 2.0.0 SEM transferência
   *   (ADR-186) — nem a etapa na tela nem o rótulo no guia. A pergunta da vida
   *   da criança continua no debate, como generalização.
   * - O Assistente Invisível (exp01em1b) perdeu o caso de transferência da
   *   Etapa 6 na 1.0.3 (ADR-189, decisão do Lucas em 2026-10-27, no espírito do
   *   pedido do Vinicius de tirar a transferência e o Canal B) — o card da tela,
   *   o caso no roteiro da api e a pergunta-ponte do guia. O debate fecha nas
   *   perguntas 3 e 4 do PO, como generalização.
   */
  const SEM_TRANSFERENCIA = new Set(["exp02ef1b", "exp01em1b"]);
  test("todo debate tem retomada e transferência", () => {
    for (const guia of todosOsGuias()) {
      const niveis = new Set(guia.debate.perguntas.map((p) => p.nivel));
      expect(niveis.has("retomada"), `${guia.expId}: falta retomada`).toBe(true);
      expect(niveis.has("transferencia"), `${guia.expId}: transferência`).toBe(!SEM_TRANSFERENCIA.has(guia.expId));
    }
  });

  /*
   * Os códigos da BNCC Computação são POR ANO (EF04CO08, EF08CO11) mais dois
   * blocos plurianuais (EF15CO*, EF69CO*) e o Médio (EM13CO*). A numeração por
   * pares que se supõe por analogia com as outras áreas — EF67CO, EF89CO — não
   * existe no complemento, e já foi escrita errada uma vez.
   */
  test("os códigos da BNCC têm a forma do complemento de Computação", () => {
    const forma = /^(EF(0[1-9]|15|69)|EM13)CO\d{2}$/;
    for (const guia of todosOsGuias()) {
      for (const habilidade of guia.bncc) {
        expect(habilidade.codigo, `${guia.expId}: ${habilidade.codigo}`).toMatch(forma);
        expect(habilidade.texto.length).toBeGreaterThan(30);
        expect(habilidade.ondeAcontece.length).toBeGreaterThan(10);
      }
    }
  });

  test("cada guia tem no máximo uma habilidade principal", () => {
    for (const guia of todosOsGuias()) {
      const principais = guia.bncc.filter((h) => h.principal);
      expect(principais.length, `${guia.expId}`).toBe(1);
    }
  });

  /* O índice do renderizador é montado a partir desta lista: seção nova sem
     título no renderizador sairia como âncora sem nome. */
  test("as seções do guia são as que o renderizador conhece", () => {
    expect([...SECOES_DO_GUIA]).toEqual([
      "objetivos",
      "antes",
      "cuidados",
      "roteiro",
      "debate",
      "mediacao",
      "depois",
      "adaptacoes",
      "duvidas",
    ]);
  });

  /* As abas do guia (ADR-182) são os tempos. Seção fora de todo tempo some da
     tela sem erro nenhum — o renderizador só desenha o que algum tempo lista —,
     e seção em dois tempos aparece duas vezes, com a mesma âncora. A ordem dos
     tempos lida em sequência tem de ser a ordem das seções: é a do papel. */
  test("toda seção mora em exatamente um tempo, na ordem do guia", () => {
    const nosTempos = TEMPOS_DO_GUIA.flatMap((tempo) => [...tempo.secoes]);
    expect(nosTempos).toEqual([...SECOES_DO_GUIA]);
  });
});
