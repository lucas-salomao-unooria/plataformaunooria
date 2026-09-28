import { describe, expect, test } from "vitest";
import {
  continuarGerandoPodcast,
  problemaDaFala,
  textoDoProgressoDoPodcast,
  aulaEmAndamento,
  continuarGerando,
  descreverMatriz,
  distribuicaoDaSala,
  falhasAcumuladas,
  lenteDoPost,
  mesmoLote,
  ordenarLinhas,
  percentualPublicado,
  problemaDaLegenda,
  rotuloDoBotao,
  rotuloDoPost,
  textoDasRodadas,
  textoDoEnvio,
  textoDoPar,
  textoDoProgressoDaMidia,
  type LinhaDoPainel,
  type PostDaCobertura,
} from "./a-selecao-tipos";

const linha = (nome: string, extra: Partial<LinhaDoPainel> = {}): LinhaDoPainel => ({
  estudanteId: nome,
  nome,
  usuario: nome.toLowerCase(),
  equipe: null,
  iniciou: false,
  passo: "desafio",
  publicou: false,
  publicadaEm: null,
  selecao: null,
  matriz: null,
  legenda: null,
  par: null,
  tempoFeedS: null,
  entregouReflexao: false,
  reflexaoTexto: null,
  concluiu: false,
  ...extra,
});

const post = (id: string, legenda: string): PostDaCobertura => ({
  id,
  perfil: "@folhaoficial_",
  enquadramento: "institucional",
  descricaoImagem: "Uma cena qualquer da praça.",
  legenda,
  tagFonte: "Gabinete",
  tagAngulo: "Maquete",
  curtidas: 1,
  comentarios: 1,
  comentariosDestaque: ["a", "b"],
});

describe("o botão único", () => {
  /* A suíte e2e casa por texto exato, e o sheet é a fonte: estes três rótulos
     não mudam sem mudar lá. */
  test("mostra a PRÓXIMA etapa, com o rótulo do sheet", () => {
    expect(rotuloDoBotao("mural")).toBe("Liberar Mural da Turma");
    expect(rotuloDoBotao("fichas")).toBe("Revelar Fichas Técnicas");
    expect(rotuloDoBotao("explicacao")).toBe("Liberar Conclusão Individual");
  });

  test("depois da explicação não há botão — e a exploração nunca é destino", () => {
    expect(rotuloDoBotao(null)).toBeNull();
    expect(rotuloDoBotao("exploracao")).toBeNull();
  });
});

describe("a matriz em linguagem de professor", () => {
  test("Oficial / Comunitária / Números, sem as lentes zeradas", () => {
    expect(descreverMatriz({ institucional: 2, comunitario: 0, estatistico: 1 })).toBe("2 Oficial · 1 Números");
    expect(descreverMatriz({ institucional: 0, comunitario: 3, estatistico: 0 })).toBe("3 Comunitária");
    expect(descreverMatriz({ institucional: 1, comunitario: 1, estatistico: 1 })).toBe(
      "1 Oficial · 1 Comunitária · 1 Números",
    );
  });

  test("sem matriz (não publicou) é travessão", () => {
    expect(descreverMatriz(null)).toBe("—");
  });

  test("a lente sai da POSIÇÃO do id, a amarra que a homologação cobra", () => {
    expect(lenteDoPost("post_a_4")).toBe("institucional");
    expect(lenteDoPost("post_b_1")).toBe("comunitario");
    expect(lenteDoPost("post_c_3")).toBe("estatistico");
    expect(lenteDoPost("post_d_1")).toBeNull();
    expect(lenteDoPost("post_a_5")).toBeNull();
  });

  test("o perfil médio da sala cala enquanto ninguém publicou", () => {
    expect(distribuicaoDaSala({ institucional: 0, comunitario: 0, estatistico: 0 }, 0)).toBeNull();
    expect(distribuicaoDaSala({ institucional: 40, comunitario: 35, estatistico: 25 }, 7)).toBe(
      "Perfil editorial médio da sala: 40% Oficial, 35% Comunitária, 25% Números.",
    );
  });

  test("o post da tríade: lente e o começo da legenda; sem o post, só a lente", () => {
    const posts = [post("post_a_1", "Obras do novo polo cultural e esportivo avançam conforme cronograma oficial.")];
    expect(rotuloDoPost("post_a_1", posts)).toBe("Oficial: “Obras do novo polo cultural e…”");
    expect(rotuloDoPost("post_c_2", posts)).toBe("Números");
    expect(rotuloDoPost("post_a_1", [post("post_a_1", "Curta demais.")])).toBe("Oficial: “Curta demais.”");
  });
});

describe("o par no Mural", () => {
  test("colega de verdade, equipe e colega virtual", () => {
    expect(textoDoPar({ rotulo: "Ana", virtual: false })).toBe("com Ana");
    expect(textoDoPar({ rotulo: "Equipe 3", virtual: false })).toBe("com Equipe 3");
    expect(textoDoPar({ rotulo: "Tomás", virtual: true })).toBe("com Tomás (colega virtual)");
  });

  test("sem par ainda (Mural fechado ou não publicou) é nulo", () => {
    expect(textoDoPar(null)).toBeNull();
  });
});

describe("quantos publicaram", () => {
  test("o sujeito é o computador quando a turma tem equipes", () => {
    expect(textoDoEnvio({ publicaram: 4, total: 6 }, true)).toBe(
      "4 de 6 computadores publicaram os Stories nos perfis simulados.",
    );
    expect(textoDoEnvio({ publicaram: 20, total: 31 }, false)).toBe(
      "20 de 31 estudantes publicaram os Stories nos perfis simulados.",
    );
  });

  test("percentual inteiro, e turma vazia não vira NaN", () => {
    expect(percentualPublicado({ publicaram: 4, total: 5 })).toBe(80);
    expect(percentualPublicado({ publicaram: 1, total: 3 })).toBe(33);
    expect(percentualPublicado({ publicaram: 0, total: 0 })).toBe(0);
  });

  test("a aula só para de ser acompanhada quando todos concluíram a última etapa", () => {
    const resumo = (concluiram: number, total: number) => ({
      total,
      iniciaram: total,
      publicaram: total,
      entregaram: concluiram,
      concluiram,
      computadores: { publicaram: total, total },
      porComputador: false,
      distribuicaoMedia: { institucional: 0, comunitario: 0, estatistico: 0 },
    });
    expect(aulaEmAndamento({ etapa: "explicacao", resumo: resumo(5, 5) })).toBe(false);
    expect(aulaEmAndamento({ etapa: "explicacao", resumo: resumo(4, 5) })).toBe(true);
    expect(aulaEmAndamento({ etapa: "fichas", resumo: resumo(5, 5) })).toBe(true);
    // Turma sem ninguém: continua esperando — pode ser só cedo.
    expect(aulaEmAndamento({ etapa: "explicacao", resumo: resumo(0, 0) })).toBe(true);
  });
});

describe("a lista por computador", () => {
  test("alfabética pelo que a célula mostra, com número como número — nunca por publicação", () => {
    const ordem = ordenarLinhas([
      linha("Zé", { publicou: true }),
      linha("Bia", { equipe: { id: "e10", nome: "Equipe 10" } }),
      linha("Ana"),
      linha("Caio", { equipe: { id: "e2", nome: "Equipe 2" } }),
    ]).map((l) => l.equipe?.nome ?? l.nome);
    expect(ordem).toEqual(["Ana", "Equipe 2", "Equipe 10", "Zé"]);
  });

  test("as rodadas do histórico", () => {
    expect(textoDasRodadas(0)).toBe("nunca rodou");
    expect(textoDasRodadas(1)).toBe("1 rodada");
    expect(textoDasRodadas(3)).toBe("3 rodadas");
  });
});

describe("o preparo", () => {
  const vinte = "uma ".repeat(20).trim();

  test("a legenda do post: de 20 a 45 palavras, até 320 caracteres", () => {
    expect(problemaDaLegenda(vinte)).toBeNull();
    expect(problemaDaLegenda("")).toBe("A legenda não pode ficar vazia.");
    expect(problemaDaLegenda("poucas palavras aqui")).toBe("Tem 3 palavras; o mínimo é 20.");
    expect(problemaDaLegenda("uma ".repeat(46))).toBe("Tem 46 palavras; o máximo é 45.");
    expect(problemaDaLegenda(`${vinte} ${"x".repeat(320)}`)).toBe("Encurte para até 320 caracteres.");
  });

  test("o mesmo lote não se aprova duas vezes: tema, foco e legendas, com espaço nas pontas ignorado", () => {
    const base = { tema: "A praça", foco: null, posts: [{ id: "post_a_1", legenda: "Texto." }] };
    expect(mesmoLote(base, { ...base, foco: "" })).toBe(true);
    expect(mesmoLote(base, { ...base, tema: " A praça " })).toBe(true);
    expect(mesmoLote(base, { ...base, tema: "Outra praça" })).toBe(false);
    expect(mesmoLote(base, { ...base, foco: "o bairro" })).toBe(false);
    expect(mesmoLote(base, { ...base, posts: [{ id: "post_a_1", legenda: "Texto editado." }] })).toBe(false);
  });
});

describe("o laço das imagens", () => {
  test("repete enquanto falta e a última chamada andou", () => {
    expect(continuarGerando({ completo: false, geradas: ["post_a_1", "post_a_2"] })).toBe(true);
    expect(continuarGerando({ completo: true, geradas: ["post_a_1"] })).toBe(false);
  });

  /* O caso que custa dinheiro: tudo o que sobrou falhou. Repetir seria pedir
     de novo ao provedor as mesmas imagens, em laço, na quota da professora. */
  test("para quando uma chamada não gera nada", () => {
    expect(continuarGerando({ completo: false, geradas: [] })).toBe(false);
  });

  test("a falha que saiu numa volta seguinte deixa de ser falha", () => {
    const primeira = falhasAcumuladas([], { falharam: ["post_a_2"], midia: { post_a_1: "u1" } });
    expect(primeira).toEqual(["post_a_2"]);
    const segunda = falhasAcumuladas(primeira, {
      falharam: ["post_b_1"],
      midia: { post_a_1: "u1", post_a_2: "u2" },
    });
    expect(segunda).toEqual(["post_b_1"]);
  });

  test("o texto do progresso", () => {
    expect(textoDoProgressoDaMidia({ total: 8, prontas: 3 })).toBe("3 de 8 imagens prontas.");
    expect(textoDoProgressoDaMidia({ total: 8, prontas: 8 })).toBe("As 8 imagens estão prontas.");
    expect(textoDoProgressoDaMidia({ total: 1, prontas: 0 })).toBe("0 de 1 imagem pronta.");
    expect(textoDoProgressoDaMidia({ total: 0, prontas: 0 })).toBe("Nenhum post desta cobertura pede imagem.");
  });
});

describe("o podcast de recapitulação", () => {
  const FALAS = {
    institucional:
      "A Folha Oficial vinha com a planta nova da biblioteca, o comunicado da secretaria e a data de entrega, tudo arrumadinho.",
    comunitario:
      "Aí logo embaixo você rolava mais um pouco e via a Voz Coletiva: vizinhos reclamando do barulho e da falta de lugar para estudar.",
    estatistico:
      "E se não bastasse, tinha a Métrica Urbana com gráficos do custo da reforma e dos empréstimos de livros antes e depois.",
  };

  test("a régua da fala espelha a da api: palavras, link, e-mail, @ e tamanho", () => {
    expect(problemaDaFala(FALAS.institucional)).toBeNull();
    expect(problemaDaFala("")).toBe("A fala não pode ficar vazia.");
    expect(problemaDaFala("Curta demais.")).toBe("Tem 2 palavras; o mínimo é 12.");
    expect(problemaDaFala(`${FALAS.comunitario} Veja em www.exemplo.com.br`)).toMatch(/link/);
    expect(problemaDaFala(`${FALAS.comunitario} Escreva para contato@exemplo.org`)).toMatch(/e-mail/);
    expect(problemaDaFala(`${FALAS.estatistico} Siga @metrica_urbana.`)).toMatch(/sem @/);
    expect(problemaDaFala(`${"ação ".repeat(90)}`)).toMatch(/longa demais/);
  });

  test("editar só uma fala do podcast é mudança: a aprovação acende", () => {
    const base = { tema: "A biblioteca", foco: null, posts: [], podcast: FALAS };
    expect(mesmoLote(base, { ...base, podcast: { ...FALAS } })).toBe(true);
    expect(mesmoLote(base, { ...base, podcast: { ...FALAS, comunitario: `${FALAS.comunitario} Muito barulho.` } })).toBe(false);
  });

  test("o laço do áudio para com o episódio pronto ou quando uma chamada não anda", () => {
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

