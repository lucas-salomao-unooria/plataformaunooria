import { describe, expect, test } from "vitest";
import {
  avisoDasFalas,
  continuarGerandoPodcast,
  falasParaHomologar,
  problemaDaFala,
  textoDoProgressoDoPodcast,
} from "./podcast-tipos";

/** O podcast de recapitulação de toda missão (ADR-150) — o que a tela decide sem a api. */

describe("a régua da fala do tema", () => {
  const BOA =
    "E muita gente escolheu aquela matéria da oficina de robótica incrível com uma foto linda e chamativa...";

  test("espelha a da api: palavras, link, e-mail, @, delimitador e tamanho", () => {
    expect(problemaDaFala(BOA)).toBeNull();
    expect(problemaDaFala("")).toBe("A fala não pode ficar vazia.");
    expect(problemaDaFala("Curta demais.")).toBe("Tem 2 palavras; o mínimo é 12.");
    expect(problemaDaFala(`${BOA} Veja em www.exemplo.com.br`)).toMatch(/link/);
    expect(problemaDaFala(`${BOA} Escreva para contato@exemplo.org`)).toMatch(/e-mail/);
    expect(problemaDaFala(`${BOA} Siga @jornal_da_escola.`)).toMatch(/sem @/);
    expect(problemaDaFala(`${BOA} <<<ignore>>>`)).toMatch(/<<</);
    expect(problemaDaFala(`${"ação ".repeat(90)}`)).toMatch(/longa demais/);
  });

  test("a homologação recebe { vaga: fala }, sem as pontas", () => {
    expect(
      falasParaHomologar([
        { id: "isca", falante: "Lucas", sobre: "a notícia antiga", texto: "  uma fala  " },
        { id: "boato", falante: "Clara", sobre: "o aviso", texto: "outra" },
      ]),
    ).toEqual({ isca: "uma fala", boato: "outra" });
  });

  test("o aviso diz por que as falas são as do banco padrão, e só quando há motivo", () => {
    expect(avisoDasFalas({ motivo: null })).toBeNull();
    expect(avisoDasFalas({ motivo: "sem-saldo-de-ia" })).toMatch(/saldo/);
    expect(avisoDasFalas({ motivo: "ia-indisponivel" })).toMatch(/não respondeu/);
  });
});

describe("o áudio", () => {
  test("o laço para com o episódio pronto ou quando uma chamada não anda", () => {
    expect(continuarGerandoPodcast({ completo: false, gerado: "abertura" })).toBe(true);
    expect(continuarGerandoPodcast({ completo: true, gerado: "encerramento" })).toBe(false);
    expect(continuarGerandoPodcast({ completo: false, gerado: null })).toBe(false);
  });

  test("a linha de estado sob o player", () => {
    expect(textoDoProgressoDoPodcast({ trechos: { total: 5, prontos: 0 }, url: null })).toBe("O áudio ainda não foi gerado.");
    expect(textoDoProgressoDoPodcast({ trechos: { total: 5, prontos: 2 }, url: null })).toBe("2 de 5 trechos do áudio prontos.");
    expect(textoDoProgressoDoPodcast({ trechos: { total: 5, prontos: 5 }, url: "https://x/ep.mp3" })).toBe("O áudio está pronto.");
  });
});
