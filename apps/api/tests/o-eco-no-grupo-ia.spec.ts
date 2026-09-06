import { TTS_LIMITE_TEXTO } from "../src/ai/vertex.provider";
import { FEED, MATERIA, OPCOES } from "../src/o-eco-no-grupo/catalogo";
import { TERMOS_PROIBIDOS_NA_TELA } from "../src/o-eco-no-grupo/invariantes";
import { IDS_DE_MIDIA, MIDIA, ORDEM_DE_PREPARO, ehDerivada } from "../src/o-eco-no-grupo/midia";
import {
  SCHEMA_DAS_REACOES,
  promptDaDevolutiva,
  promptDasReacoes,
  promptDeAmara,
} from "../src/o-eco-no-grupo/prompts";
import {
  PALAVRAS_POR_BALAO,
  validarDevolutiva,
  validarFalaDeAmara,
  validarFalaDoGrupo,
} from "../src/o-eco-no-grupo/regras/sanitizador";

/**
 * A camada de IA da exp-07 — sem rede, sem credencial.
 *
 * O que estes testes protegem: que o modelo escreva a fala e NUNCA decida o
 * resultado, que nada do prompt chegue à tela, e que o roteiro do podcast caiba
 * na síntese. Cada um deles corresponde a uma falha que só apareceria na frente
 * de uma turma.
 */

describe("o sanitizador das falas geradas", () => {
  test("recusa balão acima do teto de palavras do 7º ano", () => {
    const longa = "palavra ".repeat(PALAVRAS_POR_BALAO + 5);
    expect(validarFalaDoGrupo(longa).join(" ")).toMatch(/teto/);
  });

  test("recusa termo que quebra a ficção ou rotula a criança", () => {
    // Cada um destes já é uma frase que a plataforma se recusa a exibir.
    expect(validarFalaDoGrupo("Isso é fake news, gente!").join(" ")).toMatch(/não pode aparecer/);
    expect(validarFalaDoGrupo("A professora vai explicar essa atividade.").join(" ")).toMatch(
      /não pode aparecer/,
    );
    expect(validarFalaDoGrupo("Você errou feio dessa vez.").join(" ")).toMatch(/não pode aparecer/);
  });

  test("recusa fala que entrega o mecanismo antes da descoberta", () => {
    expect(validarFalaDoGrupo("A resposta certa era a opção com o link.").join(" ")).toMatch(
      /entrega o mecanismo/,
    );
  });

  test("recusa marcação de texto — ninguém escreve com asterisco no grupo", () => {
    expect(validarFalaDoGrupo("Isso é **muito grave**, vizinhos!").join(" ")).toMatch(/marcação/);
  });

  test("recusa saída que ecoa o prompt em vez de responder", () => {
    // Foi assim que o mock vazou o começo da instrução para dentro da tela.
    expect(validarDevolutiva("O cenário é um grupo de WhatsApp chamado...").join(" ")).toMatch(
      /ecoa a instrução/,
    );
    expect(
      validarFalaDeAmara("[mock] resposta para: As pessoas: Carlos, Dona Lúcia").join(" "),
    ).toMatch(/ecoa a instrução/);
    // A marca do mock sozinha NÃO é vazamento: `conversar` é o único método que
    // o mock não falha fechado, e barrá-la deixaria Amara muda em dev.
    expect(validarFalaDeAmara("[mock] Consultei o que dava e já podemos seguir.")).toEqual([]);
  });

  test("recusa devolutiva que vira nota disfarçada", () => {
    expect(validarDevolutiva("Você acertou 2 de 2 nas estratégias.").join(" ")).toMatch(
      /não é nota/,
    );
  });

  test("aceita a fala que o bairro realmente diria", () => {
    expect(validarFalaDoGrupo("Caramba, quase repassei isso pros meus parentes!")).toEqual([]);
    expect(
      validarFalaDeAmara("Sério que cortaram bem o parágrafo do alvará? Que sacanagem."),
    ).toEqual([]);
  });
});

describe("os prompts", () => {
  test("o prompt das reações recebe o desfecho JÁ decidido, e não pede opinião sobre ele", () => {
    // Esta é a linha que separa "o modelo escreve a fala" de "o modelo decide a
    // lição": em nenhum lugar se pergunta ao modelo se a resposta foi boa.
    const checada = promptDasReacoes("B", "checada");
    expect(checada).toContain("O grupo se acalma");
    expect(checada).toMatch(/fixar a mensagem/i);
    expect(promptDasReacoes("A", "ruido")).toContain("O boato ganha força");
    expect(promptDasReacoes("C", "conflito")).toContain("A conversa azeda");
    for (const p of [promptDasReacoes("A", "ruido"), promptDasReacoes("B", "checada")]) {
      expect(p).not.toMatch(/qual (é |e )?a (resposta|opção) (certa|correta)/i);
    }
  });

  test("todo prompt proíbe explicitamente os termos que não podem chegar à tela", () => {
    const proibidosCitados = ["atividade", "professor", "gabarito", "fake news", "nota"];
    for (const prompt of [
      promptDasReacoes("B", "checada"),
      promptDeAmara(),
      promptDaDevolutiva(["buscar_fonte", "reparar_selo"], "evidencia_desarma"),
    ]) {
      for (const termo of proibidosCitados) expect(prompt.toLowerCase()).toContain(termo);
      expect(prompt).toMatch(/35 palavras/);
    }
  });

  test("a devolutiva cita o TEXTO das escolhas, não o id", () => {
    // Mandar `buscar_fonte` faria o modelo comentar um slug.
    const prompt = promptDaDevolutiva(["buscar_fonte", "reparar_selo"], "evidencia_desarma");
    expect(prompt).toContain("Buscar a reportagem completa no portal original");
    expect(prompt).toContain("encerra o boato sem transformar a conversa em disputa pessoal");
    expect(prompt).not.toContain("buscar_fonte");
  });

  test("o prompt de Amara a proíbe de dar aula", () => {
    const prompt = promptDeAmara();
    expect(prompt).toMatch(/investigação no\s+grupo JÁ TERMINOU/i);
    expect(prompt).toMatch(/não dê aula/i);
  });

  test("o schema das reações fecha o autor num conjunto de três", () => {
    const autor = SCHEMA_DAS_REACOES.properties?.reacoes?.items?.properties?.autor;
    expect(autor?.enum).toEqual(["Carlos", "Dona Lúcia", "Marcos Admin"]);
  });

  test("nenhum prompt carrega o gabarito em forma de resposta pronta", () => {
    // O modelo sabe QUAL desfecho aconteceu (precisa, para escrever a reação),
    // mas não recebe "a opção B é a correta" em lugar nenhum.
    for (const prompt of [promptDasReacoes("B", "checada"), promptDeAmara()]) {
      expect(prompt).not.toMatch(/opção b (é|e) a correta/i);
      expect(prompt).not.toContain("correta: true");
    }
  });
});

describe("o catálogo de mídia", () => {
  test("o roteiro do podcast cabe no teto de bytes da síntese", () => {
    // Estourar isto sai como HTTP 400 na hora de preparar, e a aula 2 começa
    // sem o episódio que a destrava.
    const podcast = MIDIA["podcast-recapitulacao"];
    if (podcast?.tipo !== "voz" || !podcast.turnos) throw new Error("podcast sumiu do catálogo");
    const bytes = Buffer.byteLength(podcast.turnos.map((t) => t.texto).join(" "), "utf8");
    expect(bytes).toBeLessThan(TTS_LIMITE_TEXTO);
  });

  test("toda fala tem direção de atuação — é o que separa leitura de interpretação", () => {
    for (const id of IDS_DE_MIDIA) {
      const midia = MIDIA[id];
      if (midia?.tipo === "voz") expect(midia.direcao.length).toBeGreaterThan(40);
    }
  });

  test("toda direção pede ritmo pausado — sem isso a fala sai rápida demais para 12 anos", () => {
    // MEDIDO: sem a instrução de pausa, as duas falas do chat saíam 2 e 4
    // segundos abaixo da tolerância do brief.
    for (const id of IDS_DE_MIDIA) {
      const midia = MIDIA[id];
      if (midia?.tipo !== "voz") continue;
      expect(midia.direcao.toLowerCase()).toMatch(/pausad|devagar|articulad/);
    }
  });

  test("a transcrição na tela casa com a fala gravada, palavra por palavra", () => {
    // O brief reprova o áudio que mude uma palavra: a transcrição é síncrona, e
    // divergir faria a legenda contar outra coisa que o ouvido.
    const audio = FEED.find((m) => m.tipo === "audio");
    const voz = MIDIA[audio?.midia ?? ""];
    expect(voz?.tipo).toBe("voz");
    if (voz?.tipo === "voz") expect(voz.texto).toBe(audio?.transcricao);
  });

  test("o print viral é um RECORTE da foto da reportagem, não outra geração", () => {
    // É o que faz o par ser casado: mesma cena, mesmo instante, mesma luz.
    const print = MIDIA[MATERIA.fotoDoPrint];
    if (print?.tipo !== "foto") throw new Error("print sumiu do catálogo");
    expect(print.recorteDe?.origem).toBe(MATERIA.fotoDaMateria);
    expect(print.prompt).toBe("");
  });

  test("a origem do recorte é preparada ANTES da derivada", () => {
    const print = ORDEM_DE_PREPARO.indexOf(MATERIA.fotoDoPrint);
    const materia = ORDEM_DE_PREPARO.indexOf(MATERIA.fotoDaMateria);
    expect(materia).toBeLessThan(print);
    expect(ehDerivada(MATERIA.fotoDoPrint)).toBe(true);
    expect(ehDerivada(MATERIA.fotoDaMateria)).toBe(false);
  });

  test("todo id de mídia citado pelo feed e pela matéria existe no catálogo", () => {
    // Duas listas que precisam concordar; divergir dá player mudo em produção.
    for (const m of FEED) if (m.midia) expect(IDS_DE_MIDIA).toContain(m.midia);
    expect(IDS_DE_MIDIA).toContain(MATERIA.fotoDoPrint);
    expect(IDS_DE_MIDIA).toContain(MATERIA.fotoDaMateria);
  });

  test("todo prompt de foto proíbe texto, violência e rosto identificável", () => {
    for (const id of IDS_DE_MIDIA) {
      const midia = MIDIA[id];
      if (midia?.tipo !== "foto" || midia.recorteDe) continue;
      expect(midia.prompt).toMatch(/Sem texto, sem letras/);
      expect(midia.prompt).toMatch(/Nenhuma violência/);
      expect(midia.prompt).toMatch(/Nenhum rosto identificável/);
    }
  });

  test("nenhum roteiro de voz usa termo proibido na tela", () => {
    for (const id of IDS_DE_MIDIA) {
      const midia = MIDIA[id];
      if (midia?.tipo !== "voz") continue;
      const falado = (midia.texto ?? "") + " " + (midia.turnos ?? []).map((t) => t.texto).join(" ");
      for (const termo of TERMOS_PROIBIDOS_NA_TELA) {
        expect(falado.toLowerCase()).not.toContain(termo);
      }
    }
  });

  test("as três opções continuam sem gabarito quando viram prompt", () => {
    const prompt = promptDasReacoes("B", "checada");
    // A opção escolhida aparece (o bairro reage ao que foi postado), mas as
    // outras duas não vazam nem como lista de alternativas.
    expect(prompt).toContain(OPCOES[1]!.texto);
    expect(prompt).not.toContain(OPCOES[2]!.texto);
  });
});
