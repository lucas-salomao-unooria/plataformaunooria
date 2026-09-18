import { z } from "zod";
import {
  GRUPO,
  IDS_DE_MENSAGEM,
  LOTE_DEFAULT,
  MOLDE_DO_LOTE,
  MURAL,
  PARIDADE,
  PERGUNTA_DA_REFLEXAO,
  PISO_DA_REFLEXAO,
  PISO_DE_ENCAMINHAMENTOS,
  PODCAST,
  TEMA_DEFAULT,
  TETO_DA_REFLEXAO,
  TONS_EMOCIONAIS,
  TOTAL_DE_MENSAGENS,
  mensagensPublicas,
  resumoDaMensagem,
  type MensagemDoLote,
} from "../src/quem-mandou-isso/catalogo";
import { HomologacaoSchema, PainelSchema, ReflexaoSchema } from "../src/quem-mandou-isso/contrato-de-rotas";
import { MENSAGENS as MENSAGENS_DE_ERRO, STATUS } from "../src/quem-mandou-isso/erros";
import {
  CAMPOS_SENSIVEIS,
  PROIBIDO_NO_PAINEL,
  TERMOS_PROIBIDOS_NA_TELA,
  paraLog,
  termosProibidosEm,
} from "../src/quem-mandou-isso/invariantes";
import { validarLote } from "../src/quem-mandou-isso/preparo.service";
import {
  contaDaTurma,
  estadoDaCuradoria,
  validarParidade,
} from "../src/quem-mandou-isso/regras/curadoria";
import {
  ACOES_DO_GATE,
  ETAPAS,
  ETAPA_DA_ACAO,
  PASSOS,
  aguardandoATurma,
  avancarAte,
  etapaAntesDe,
  normalizarEtapa,
  normalizarPasso,
  passoEfetivo,
} from "../src/quem-mandou-isso/regras/passos";
import { CHAVES_REDIGIDAS } from "../src/observabilidade/redaction";

/**
 * Regras puras da exp-05 — sem Prisma, sem HTTP.
 *
 * O que estes testes protegem não é "a função devolve X": é a mecânica
 * pedagógica da missão. A falha de qualquer um deles significa que a aula
 * passou a medir outra coisa — o lote deixou de ser indecidível por formato, o
 * Mural fechou sem a criança ter lido o grupo, o telão contou quem não
 * confirmou, ou o gabarito passou a existir antes do telão.
 *
 * Molde: `rastro-boato-regras.spec.ts` e `manifesto-ia-regras.spec.ts`.
 */

/** A mesma contagem que `validarLote` usa — os tetos de leitura são por palavra. */
function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** O lote curado como o modelo o devolveria: objeto solto, para `validarLote`. */
function loteBruto(): MensagemDoLote[] {
  return LOTE_DEFAULT.map((m) => ({ ...m }));
}

describe("catálogo — o lote curado e o gabarito", () => {
  test("são 8 mensagens, com os ids do catálogo e nenhum repetido", () => {
    // Cardinalidade é regra: o piso de 3 encaminhamentos e o teto da rolagem
    // ("leu até a 8ª") só significam alguma coisa sobre um grupo de 8 balões.
    expect(LOTE_DEFAULT).toHaveLength(TOTAL_DE_MENSAGENS);
    expect(LOTE_DEFAULT.map((m) => m.id)).toEqual([...IDS_DE_MENSAGEM]);
    expect(new Set(LOTE_DEFAULT.map((m) => m.id)).size).toBe(TOTAL_DE_MENSAGENS);
  });

  test("a paridade é 3 verdadeiras, 3 falsas e 2 ambíguas", () => {
    // Não é preferência: é o que impede "se está em caixa alta é mentira" de
    // fechar a conta sozinha, e o que dá ao telão uma barra longa de cada lado.
    expect(PARIDADE).toEqual({ verdadeira: 3, falsa: 3, ambigua: 2 });
    expect(Object.values(PARIDADE).reduce((a, b) => a + b, 0)).toBe(TOTAL_DE_MENSAGENS);
    expect(validarParidade(LOTE_DEFAULT)).toEqual({ ok: true });
  });

  test("o molde e o banco curado concordam posição a posição", () => {
    // O molde é o que a IA recebe: tipo e veracidade são FIXOS por posição. Se
    // o banco curado divergisse dele, a turma que gera o lote e a turma que
    // aprova o curado veriam grupos com formatos diferentes — e o guia da aula,
    // que é escrito sobre o curado, passaria a descrever a outra.
    expect(MOLDE_DO_LOTE.map((m) => [m.id, m.tipo, m.veracidade, m.tom])).toEqual(
      LOTE_DEFAULT.map((m) => [m.id, m.tipo, m.veracidade, m.tom]),
    );
  });

  test("o formato do balão NÃO prediz a veracidade", () => {
    // É a coisa que sustenta a lição inteira: a mensagem falsa não parece
    // malfeita, e a verdadeira não parece profissional. Se todo `texto` fosse
    // verdadeiro, a criança resolveria o grupo sem ler nenhuma mensagem.
    const porTipo = LOTE_DEFAULT.filter((m) => m.tipo === "texto");
    const veracidades = new Set(porTipo.map((m) => m.veracidade));
    expect(veracidades.has("verdadeira")).toBe(true);
    expect(veracidades.has("falsa")).toBe(true);
  });

  test("o banco curado passa pela régua do preparo — a sua própria", () => {
    // `validarLote` é o que rejeita a saída da IA. Aplicá-lo ao lote autoral é o
    // teste que descobre o dia em que a régua reprovaria a copy homologada —
    // exatamente o que a exp-06 registrou ao proibir a palavra "nota".
    expect(() => validarLote({ mensagens: loteBruto() })).not.toThrow();
  });

  test("os tetos de leitura da faixa valem no banco curado (RNF-USAB-002)", () => {
    // 5º ano: o comunicado oficial é o único texto longo, e ele é longo DE
    // PROPÓSITO — é o atrito que a mensagem alarmista não tem.
    const por = (id: string) => LOTE_DEFAULT.find((m) => m.id === id)!;
    expect(palavras(por("msg-1").corpo)).toBeGreaterThanOrEqual(40);
    expect(palavras(por("msg-1").corpo)).toBeLessThanOrEqual(70);
    for (const m of LOTE_DEFAULT.filter((m) => m.tipo === "audio")) {
      expect(palavras(m.corpo)).toBeGreaterThanOrEqual(30);
      expect(palavras(m.corpo)).toBeLessThanOrEqual(50);
    }
    for (const m of LOTE_DEFAULT.filter((m) => m.id !== "msg-1" && m.tipo !== "audio")) {
      expect({ id: m.id, curta: palavras(m.corpo) <= 25 }).toEqual({ id: m.id, curta: true });
    }
  });

  test("toda explicação cabe sob o selo (≤ 120 caracteres)", () => {
    for (const m of LOTE_DEFAULT) {
      expect({ id: m.id, tamanho: m.explicacao.length <= 120 }).toEqual({
        id: m.id,
        tamanho: true,
      });
    }
  });

  test("as horas são a manhã inteira, em ordem estritamente crescente", () => {
    // `validarLote` cobra a ordem do lote gerado. O curado é o molde dela: um
    // grupo em que a resposta do professor chega ANTES do boato conta outra
    // história, e a criança lê a conversa de cima para baixo.
    const horas = LOTE_DEFAULT.map((m) => m.hora);
    expect([...horas].sort()).toEqual(horas);
    expect(new Set(horas).size).toBe(horas.length);
  });

  test("o áudio tem transcrição e duração — não há arquivo nenhum na missão", () => {
    // Zero mídia binária: a transcrição É o áudio (e é acessibilidade, não
    // remendo), e a duração é o que o player simulado mostra.
    for (const m of LOTE_DEFAULT.filter((m) => m.tipo === "audio")) {
      expect(m.corpo.length).toBeGreaterThan(0);
      expect(m.duracaoSeg).toBeGreaterThanOrEqual(12);
      expect(m.duracaoSeg).toBeLessThanOrEqual(20);
    }
    // A imagem é legenda com rótulo; o link é card com manchete, veículo e data.
    const imagem = LOTE_DEFAULT.find((m) => m.tipo === "imagem")!;
    expect(imagem.titulo).toBeTruthy();
    const link = LOTE_DEFAULT.find((m) => m.tipo === "link")!;
    expect([link.titulo, link.fonte, link.data].every(Boolean)).toBe(true);
  });

  test("a data antiga do link é o detalhe que a mensagem ambígua esconde", () => {
    // O card é a única mensagem em que a pista NÃO está no texto: está no
    // rodapé. Sem `data`, a ambígua vira simplesmente verdadeira.
    const link = LOTE_DEFAULT.find((m) => m.tipo === "link")!;
    expect(link.veracidade).toBe("ambigua");
    expect(link.data).toMatch(/\d{4}/);
  });

  test("mensagensPublicas() NÃO leva veracidade, tom nem explicação", () => {
    // Regra inviolável nº 3. O `Omit` do catálogo faz o vazamento reprovar no
    // `tsc`; este teste é a rede do dia em que alguém montar o lote à mão.
    for (const publica of mensagensPublicas(LOTE_DEFAULT)) {
      const chaves = Object.keys(publica);
      expect(chaves).not.toContain("veracidade");
      expect(chaves).not.toContain("tom");
      expect(chaves).not.toContain("explicacao");
    }
    // E o gabarito não sobrevive nem à serialização: nenhum rótulo de
    // veracidade, nenhuma explicação, em nenhum campo.
    const bruto = JSON.stringify(mensagensPublicas(LOTE_DEFAULT));
    for (const rotulo of ["verdadeira", "falsa", "ambigua"]) {
      expect(bruto).not.toContain(rotulo);
    }
    expect(bruto).not.toContain(LOTE_DEFAULT[1]!.explicacao);
  });

  test("o resumo da barra é rótulo curto, e prefere o título ao corpo", () => {
    // A barra do telão carrega oito rótulos numa tela de projetor: o corpo
    // inteiro do comunicado ali seria um parágrafo por barra.
    for (const m of LOTE_DEFAULT) {
      expect(palavras(resumoDaMensagem(m))).toBeLessThanOrEqual(6);
    }
    const link = LOTE_DEFAULT.find((m) => m.tipo === "link")!;
    expect(resumoDaMensagem(link).startsWith(link.titulo!.split(/\s+/)[0]!)).toBe(true);
  });
});

describe("passos — os dois relógios", () => {
  const todos = ETAPAS.flatMap((etapa) => PASSOS.map((passo) => ({ etapa, passo })));

  test("sem turma não há gate: o estudante corre no próprio ritmo", () => {
    // A guarda de liberação já recusou quem não tem sala. O ramo existe para
    // que um beco sem saída nunca nasça de um `null` que ninguém previu.
    for (const passo of PASSOS) {
      expect(passoEfetivo(passo, null)).toBe(passo);
      expect(aguardandoATurma(passo, null)).toBe(false);
    }
  });

  test("a exploração é TETO na espera: o latch não passa dela sozinho", () => {
    // Confirmar o Mural é o fim do que a criança decide por conta própria. O
    // que vem depois é a turma.
    expect(passoEfetivo("espera", "exploracao")).toBe("espera");
    expect(passoEfetivo("revelado", "exploracao")).toBe("espera");
    expect(passoEfetivo("reflexao", "exploracao")).toBe("espera");
  });

  test("a revelação é PISO e TETO: quando o telão acende, a sala inteira está em `revelado`", () => {
    // Quem não tinha confirmado é EMPURRADO (a janela da curadoria acabou), e
    // quem já estava adiante é SEGURADO (o card de síntese é lá).
    for (const passo of PASSOS.filter((p) => p !== "fim")) {
      expect(passoEfetivo(passo, "revelacao")).toBe("revelado");
    }
  });

  test("a etapa da reflexão NÃO empurra ninguém até a pergunta", () => {
    // Quem chega atrasado vê o Mural revelado primeiro, e é dele que o botão
    // sai. Pular direto seria responder sobre uma cena que a criança não viu.
    expect(passoEfetivo("curadoria", "reflexao")).toBe("revelado");
    expect(passoEfetivo("espera", "reflexao")).toBe("revelado");
    expect(passoEfetivo("reflexao", "reflexao")).toBe("reflexao");
  });

  test("`fim` nunca é revisitado — o latch é do estudante, não da turma", () => {
    // "Voltar para a exploração" não traz de volta quem já respondeu ao tio.
    for (const etapa of ETAPAS) expect(passoEfetivo("fim", etapa)).toBe("fim");
  });

  test("aguardandoATurma é true só quando a etapa SEGURA, nunca quando ela empurra", () => {
    // Ser levado adiante não é esperar: com a etapa empurrando, a tela tem o
    // que mostrar. Os três pares abaixo são os únicos em que a turma segura, e
    // todos nascem de um `voltar-exploracao` ou de uma revelação sem reflexão
    // liberada.
    const segurados = todos.filter(({ etapa, passo }) => aguardandoATurma(passo, etapa));
    expect(segurados).toEqual([
      { etapa: "exploracao", passo: "revelado" },
      { etapa: "exploracao", passo: "reflexao" },
      { etapa: "revelacao", passo: "reflexao" },
    ]);
  });

  test("a espera depois do latch NÃO acende a bandeira — e não precisa", () => {
    // ARMADILHA DE LEITURA: "confirmou e espera o telão" é o momento em que a
    // criança mais espera, e `aguardandoATurma` é `false` ali. Não é defeito: a
    // bandeira diz "a etapa te puxou para trás", e quem confirmou está
    // EXATAMENTE no teto (`espera`), sem nada para puxar. Quem desenha a tela de
    // espera lê `passo === "espera"`, não esta bandeira — foi o que a
    // experiência fez.
    expect(passoEfetivo("espera", "exploracao")).toBe("espera");
    expect(aguardandoATurma("espera", "exploracao")).toBe(false);
  });

  test("avancarAte nunca anda para trás", () => {
    // Uma requisição fora de ordem (duas abas, retry de rede) não pode puxar o
    // passo para trás e reabrir um latch.
    for (const atual of PASSOS) {
      for (const alvo of PASSOS) {
        const resultado = avancarAte(atual, alvo);
        expect(PASSOS.indexOf(resultado)).toBeGreaterThanOrEqual(PASSOS.indexOf(atual));
        expect(PASSOS.indexOf(resultado)).toBe(
          Math.max(PASSOS.indexOf(atual), PASSOS.indexOf(alvo)),
        );
      }
    }
  });

  test("passo e etapa desconhecidos voltam ao começo, não quebram", () => {
    // Uma linha gravada por uma versão futura não pode derrubar a tela; ela
    // volta para a cena de abertura.
    expect(normalizarPasso("passo-de-uma-versao-futura")).toBe("contexto");
    expect(normalizarPasso(null)).toBe("contexto");
    expect(normalizarEtapa("etapa-inventada")).toBe("exploracao");
    expect(normalizarEtapa(undefined)).toBe("exploracao");
  });

  test("os dois botões mestres e o inverso, e a etapa que cada um abre", () => {
    expect(ETAPA_DA_ACAO).toEqual({
      "iniciar-revelacao": "revelacao",
      "liberar-reflexao": "reflexao",
      "voltar-exploracao": "exploracao",
    });
    expect(ACOES_DO_GATE).toHaveLength(3);
    // A ordem das etapas é o que decide "a turma já revelou?".
    expect(etapaAntesDe("exploracao", "revelacao")).toBe(true);
    expect(etapaAntesDe("reflexao", "revelacao")).toBe(false);
    expect(etapaAntesDe("exploracao", "exploracao")).toBe(false);
  });
});

describe("curadoria — a porta do Mural", () => {
  const TRES = ["msg-1", "msg-2", "msg-3"];

  test("validarParidade recusa 4/3/1 — e diz a contagem que encontrou", () => {
    // O lote torto é um 400 na tela do preparo, nunca uma aula torta.
    const torto = LOTE_DEFAULT.map((m) =>
      m.id === "msg-8" ? { ...m, veracidade: "verdadeira" as const } : { ...m },
    );
    expect(validarParidade(torto)).toEqual({
      ok: false,
      codigo: "lote-paridade-invalida",
      contagem: { verdadeira: 4, falsa: 3, ambigua: 1 },
    });
  });

  test("validarParidade recusa um lote de 7, mesmo com a proporção certa", () => {
    // 3/3/1 não é "quase": o grupo teria sete balões, e a rolagem até a 8ª
    // mensagem — a condição que libera o Mural — nunca aconteceria.
    expect(validarParidade(LOTE_DEFAULT.slice(0, 7)).ok).toBe(false);
  });

  test("o Mural só fecha com o piso E a leitura — as duas, sempre", () => {
    expect(estadoDaCuradoria(TRES, false).podeConfirmar).toBe(false);
    expect(estadoDaCuradoria(["msg-1", "msg-2"], true).podeConfirmar).toBe(false);
    expect(estadoDaCuradoria(TRES, true).podeConfirmar).toBe(true);
    expect(PISO_DE_ENCAMINHAMENTOS).toBe(3);
  });

  test("encaminhar a mesma mensagem duas vezes não avança o piso", () => {
    // A pergunta é "escolheu 3 mensagens", não "tocou 3 vezes na setinha".
    const estado = estadoDaCuradoria(["msg-2", "msg-2", "msg-2"], true);
    expect(estado.total).toBe(1);
    expect(estado.encaminhadas).toEqual(["msg-2"]);
    expect(estado.atingiuPiso).toBe(false);
    expect(estado.faltam).toBe(2);
  });

  test("`faltam` nunca fica negativo", () => {
    // É número de tela ("faltam 2"), e um -3 apareceria escrito lá.
    expect(estadoDaCuradoria([...IDS_DE_MENSAGEM], true).faltam).toBe(0);
  });

  test("encaminhar TUDO é o caminho degenerado, e ele não é travado", () => {
    // Quem manda as oito não filtrou nada — e é isso que o telão vai mostrar.
    // Travar seria corrigir a criança antes de ela ver a consequência.
    const tudo = estadoDaCuradoria([...IDS_DE_MENSAGEM], true);
    expect(tudo.encaminhouTudo).toBe(true);
    expect(tudo.podeConfirmar).toBe(true);
    expect(estadoDaCuradoria(IDS_DE_MENSAGEM.slice(0, 7), true).encaminhouTudo).toBe(false);
  });
});

describe("a conta da turma — o telão anonimizado", () => {
  /** Os snapshots são listas de ids: um por estudante que CONFIRMOU. */
  const emocionais = ["msg-2", "msg-3", "msg-6"];
  const informativas = ["msg-1", "msg-4", "msg-7"];

  test("sala sem ninguém confirmado não divide por zero", () => {
    // Antes do telão a professora já olha o painel. Um `NaN` ali no meio da
    // aula é a barra de prontidão sumindo da tela dela.
    const conta = contaDaTurma(LOTE_DEFAULT, []);
    expect(conta.totalConfirmados).toBe(0);
    expect(conta.histograma).toHaveLength(TOTAL_DE_MENSAGENS);
    expect(conta.histograma.every((b) => b.total === 0 && b.percentual === 0)).toBe(true);
    expect(conta.sintese).toEqual({ emocionais: 0, informativas: 0, polaridade: "empate" });
  });

  test("só quem confirmou entra — a lista de snapshots É a lista de confirmados", () => {
    // Contar a curadoria em andamento mostraria à turma uma escolha que a
    // criança ainda podia desfazer.
    const conta = contaDaTurma(LOTE_DEFAULT, [emocionais, emocionais, informativas]);
    expect(conta.totalConfirmados).toBe(3);
    const msg2 = conta.histograma.find((b) => b.id === "msg-2")!;
    expect(msg2.total).toBe(2);
    expect(msg2.percentual).toBe(67);
  });

  test("id repetido dentro do mesmo Mural conta uma vez; id fora do lote não conta", () => {
    // O `msg-9` é a linha de uma versão anterior do lote: ela não pode virar
    // uma barra órfã no telão.
    const conta = contaDaTurma(LOTE_DEFAULT, [["msg-2", "msg-2", "msg-9"]]);
    expect(conta.histograma.find((b) => b.id === "msg-2")!.total).toBe(1);
    expect(conta.histograma.map((b) => b.id)).toEqual([...IDS_DE_MENSAGEM]);
    expect(conta.sintese.emocionais).toBe(1);
  });

  test("a urgência vence quando a sala encaminha o que assusta", () => {
    const conta = contaDaTurma(LOTE_DEFAULT, [emocionais, emocionais, informativas]);
    expect(conta.sintese.emocionais).toBe(6);
    expect(conta.sintese.informativas).toBe(3);
    expect(conta.sintese.polaridade).toBe("urgencia-venceu");
  });

  test("a polaridade VIRA quando a sala filtra bem — o card não pode mentir", () => {
    // PRD: "adaptação dinâmica caso a turma apresente comportamento atípico de
    // filtragem". Um card que afirma que a urgência venceu numa sala que
    // filtrou bem desmente o que está projetado na parede.
    const conta = contaDaTurma(LOTE_DEFAULT, [informativas, informativas, emocionais]);
    expect(conta.sintese.polaridade).toBe("informativas-venceram");
  });

  test("empate é um terceiro estado, não um arredondamento", () => {
    expect(contaDaTurma(LOTE_DEFAULT, [emocionais, informativas]).sintese.polaridade).toBe(
      "empate",
    );
  });

  test("os tons emocionais são os que a síntese soma", () => {
    expect([...TONS_EMOCIONAIS].sort()).toEqual(["alarmista", "urgente"]);
  });

  test("nenhum nome chega ao telão — a anonimização é estrutural", () => {
    // Não é disciplina: a assinatura de `contaDaTurma` não tem lugar para o
    // estudante (PED-07). Cada barra carrega o REMETENTE da ficção, nunca quem
    // encaminhou.
    const conta = contaDaTurma(LOTE_DEFAULT, [emocionais]);
    for (const barra of conta.histograma) {
      expect(Object.keys(barra).sort()).toEqual([
        "explicacao",
        "id",
        "percentual",
        "remetente",
        "resumo",
        "tipo",
        "total",
        "veracidade",
      ]);
    }
  });
});

describe("preparo — o que o gerador tem de respeitar", () => {
  /** O lote curado com UM campo torto: é assim que a saída do modelo chega. */
  function comDefeito(id: string, patch: Partial<MensagemDoLote>): { mensagens: unknown[] } {
    return { mensagens: loteBruto().map((m) => (m.id === id ? { ...m, ...patch } : m)) };
  }

  test("aceita um lote bem formado e devolve as 8 mensagens normalizadas", () => {
    const prontas = validarLote({ mensagens: loteBruto() });
    expect(prontas.map((m) => m.id)).toEqual([...IDS_DE_MENSAGEM]);
    expect(validarParidade(prontas).ok).toBe(true);
  });

  test("id, tipo, veracidade e tom são do MOLDE, não do que o modelo devolveu", () => {
    // O enum do schema restringe os VALORES; nada garante que o modelo não
    // troque a posição do áudio com a do comunicado — e a simetria formal do
    // lote (áudio não é sempre mentira) depende da posição.
    const embaralhado = loteBruto().map((m) => ({ ...m, id: "msg-8" as const, tom: "neutro" as const }));
    const prontas = validarLote({ mensagens: embaralhado });
    expect(prontas.map((m) => m.id)).toEqual([...IDS_DE_MENSAGEM]);
    expect(prontas.map((m) => m.tom)).toEqual(MOLDE_DO_LOTE.map((m) => m.tom));
  });

  test("recusa lote fora da ordem cronológica", () => {
    // Um grupo em que o esclarecimento chega antes do boato conta outra
    // história — e a criança lê a conversa de cima para baixo.
    expect(() => validarLote(comDefeito("msg-3", { hora: "09:41" }))).toThrow(
      /ordem cronológica/,
    );
  });

  test("recusa comunicado curto demais", () => {
    // O comunicado oficial é longo DE PROPÓSITO: é o atrito que a mensagem
    // alarmista não tem, e encurtá-lo apaga metade da lição.
    expect(() => validarLote(comDefeito("msg-1", { corpo: "Haverá mudança no intervalo." }))).toThrow(
      /40 e 70 palavras/,
    );
  });

  test("recusa explicação acima de 120 caracteres", () => {
    // A explicação aparece SOB o selo, num balão de celular de 375px.
    expect(() => validarLote(comDefeito("msg-4", { explicacao: "a".repeat(121) }))).toThrow(
      /120 caracteres/,
    );
  });

  test("recusa termo proibido no texto gerado", () => {
    // A régua de tela vale para o que a IA escreve igual: "gabarito" num balão
    // do grupo denuncia o exercício que a missão mede. Regerar é melhor do que
    // confiar na revisão de um texto que a professora talvez só passe o olho.
    expect(() =>
      validarLote(comDefeito("msg-6", { corpo: "Vazou o gabarito da prova, repassa!" })),
    ).toThrow(/termo proibido/);
  });

  test("recusa áudio sem duração — o player simulado precisa do número", () => {
    expect(() => validarLote(comDefeito("msg-3", { duracaoSeg: undefined }))).toThrow(/duração/);
    expect(() => validarLote(comDefeito("msg-3", { duracaoSeg: 45 }))).toThrow(/duração/);
  });

  test("recusa quantidade diferente de 8", () => {
    expect(() => validarLote({ mensagens: loteBruto().slice(0, 7) })).toThrow(/8 mensagens/);
    expect(() => validarLote({})).toThrow(/8 mensagens/);
  });

  test("recusa veracidade fora do molde", () => {
    expect(() => validarLote(comDefeito("msg-2", { veracidade: "verdadeira" }))).toThrow(
      /deveria ser falsa/,
    );
  });

  test("a homologação cobra a paridade e os ids únicos", () => {
    // O `.refine` some do OpenAPI, então é aqui que ele fica provado.
    const base = { tema: TEMA_DEFAULT, gatilho: "urgencia", origem: "padrao" };
    expect(HomologacaoSchema.safeParse({ ...base, mensagens: loteBruto() }).success).toBe(true);
    const semParidade = loteBruto().map((m) =>
      m.id === "msg-8" ? { ...m, veracidade: "falsa" as const } : m,
    );
    expect(HomologacaoSchema.safeParse({ ...base, mensagens: semParidade }).success).toBe(false);
    const repetido = loteBruto().map((m) => ({ ...m, id: "msg-1" as const }));
    expect(HomologacaoSchema.safeParse({ ...base, mensagens: repetido }).success).toBe(false);
  });
});

describe("invariantes de produto", () => {
  /** Todas as chaves de um schema Zod, em qualquer profundidade. */
  function chavesDe(schema: z.ZodTypeAny, nivel = 0): string[] {
    if (nivel > 8) return [];
    const def = schema._def as {
      typeName?: string;
      type?: z.ZodTypeAny;
      innerType?: z.ZodTypeAny;
    };
    if (def.typeName === "ZodObject") {
      const shape = (schema as unknown as z.ZodObject<z.ZodRawShape>).shape;
      return Object.entries(shape).flatMap(([chave, valor]) => [
        chave,
        ...chavesDe(valor, nivel + 1),
      ]);
    }
    if (def.typeName === "ZodArray" && def.type) return chavesDe(def.type, nivel + 1);
    if (def.innerType) return chavesDe(def.innerType, nivel + 1);
    return [];
  }

  test("nenhuma mensagem de erro quebra a ficção do mensageiro", () => {
    // A criança acha que abriu um app de conversa. A régua se aplicando à
    // própria copy: "atividade" ou "gabarito" num 409 denuncia o exercício.
    for (const [codigo, texto] of Object.entries(MENSAGENS_DE_ERRO)) {
      expect({ codigo, proibidos: termosProibidosEm(texto) }).toEqual({ codigo, proibidos: [] });
    }
  });

  test("todo código de erro tem frase E status — nenhum cai como 500 mudo", () => {
    expect(Object.keys(STATUS).sort()).toEqual(Object.keys(MENSAGENS_DE_ERRO).sort());
    for (const status of Object.values(STATUS)) {
      expect([400, 403, 404, 409]).toContain(status);
    }
  });

  test("as duas recusas do Mural são frases DIFERENTES", () => {
    // "faltam mensagens" e "falta ler o resto do grupo" são coisas diferentes na
    // cabeça da criança; uma frase só faria o botão inerte parecer quebrado.
    expect(MENSAGENS_DE_ERRO["piso-nao-atingido"]).not.toBe(
      MENSAGENS_DE_ERRO["leitura-incompleta"],
    );
    expect(MENSAGENS_DE_ERRO["curadoria-confirmada"]).not.toBe(
      MENSAGENS_DE_ERRO["revelacao-iniciada"],
    );
    // A única recusa que a criança NÃO resolve sozinha manda chamar quem pode.
    expect(MENSAGENS_DE_ERRO["curadoria-nao-confirmada"]).toContain("professor");
  });

  test("nenhum texto que a criança lê rotula ou entrega o exercício", () => {
    const visiveis = [
      ...LOTE_DEFAULT.flatMap((m) => [m.corpo, m.remetente, m.titulo ?? "", m.fonte ?? ""]),
      PERGUNTA_DA_REFLEXAO,
      GRUPO.nome,
      GRUPO.subtitulo,
      MURAL.nome,
      TEMA_DEFAULT,
      PODCAST.titulo,
      ...PODCAST.blocos.flatMap((b) => b.falas),
    ];
    for (const texto of visiveis) {
      expect({ texto, proibidos: termosProibidosEm(texto) }).toEqual({ texto, proibidos: [] });
    }
  });

  test('"professor" NÃO é termo proibido nesta missão, e a ausência é deliberada', () => {
    // Diferente da exp-06: aqui o grupo é o da TURMA, e um "Prof. Marcelo"
    // escrevendo nele é o WhatsApp real. Proibir a palavra reprovaria a própria
    // copy homologada — a `msg-3` e a `msg-7` do banco curado.
    expect(TERMOS_PROIBIDOS_NA_TELA as readonly string[]).not.toContain("professor");
    expect(termosProibidosEm("Prof. Marcelo: não acreditem em boatos")).toEqual([]);
    for (const termo of ["gabarito", "fake news", "você errou", "ranking"]) {
      expect(TERMOS_PROIBIDOS_NA_TELA as readonly string[]).toContain(termo);
    }
  });

  test("`termosProibidosEm` não é sensível a caixa", () => {
    expect(termosProibidosEm("Veja o GABARITO da missão")).toEqual(["gabarito"]);
  });

  test("o painel não tem NENHUMA chave que ordene crianças (PED-11)", () => {
    // A tentação aqui é específica: com o gabarito a um JOIN de distância,
    // "quantas falsas cada um encaminhou" é a coluna que se escreve sozinha — e
    // ela é um ranking de quem caiu no boato. O que existe é o histograma da
    // SALA. Este teste lê o contrato, não a implementação: se a coluna nascer
    // no schema, ele reprova antes de a tela existir.
    const chaves = chavesDe(PainelSchema).map((c) => c.toLowerCase());
    for (const proibido of PROIBIDO_NO_PAINEL) {
      const colisao = chaves.filter((c) => c.includes(proibido.toLowerCase()));
      expect({ proibido, colisao }).toEqual({ proibido, colisao: [] });
    }
    // E a lista nomeia as colunas que alguém tentaria criar.
    for (const termo of ["score", "nota", "ranking", "acerto", "qtdFalsas", "falsasEncaminhadas"]) {
      expect(PROIBIDO_NO_PAINEL as readonly string[]).toContain(termo);
    }
  });

  test("o painel carrega o que é conduta, e a reflexão da criança", () => {
    // O contrário da regra de cima: o que o painel PRECISA ter para a professora
    // conduzir. `reflexaoTexto` está aqui e só aqui.
    const chaves = chavesDe(PainelSchema);
    for (const chave of [
      "leuTudo",
      "ouviuAudio",
      "abriuLink",
      "confirmou",
      "segundosAteOPrimeiroEncaminhamento",
      "reflexaoTexto",
      "percentualConfirmados",
      "histograma",
    ]) {
      expect(chaves).toContain(chave);
    }
  });

  test("todo CAMPO_SENSIVEL está na redaction do logger", () => {
    // A comparação de `redigirObjeto` é por nome de chave INTEIRO em
    // minúsculas: `senha` não cobre `senha_hash`, e `texto` não cobre nada além
    // de si. Um `err` do Prisma carrega o objeto que o service tentou gravar —
    // é por ele que o gabarito, ou a caixa livre de um menor de idade, chegaria
    // ao log.
    for (const campo of CAMPOS_SENSIVEIS) {
      expect({ campo, redigido: CHAVES_REDIGIDAS.has(campo.toLowerCase()) }).toEqual({
        campo,
        redigido: true,
      });
    }
  });

  test("`paraLog` só devolve o tamanho, nunca o conteúdo", () => {
    expect(paraLog("meu tio mandou isso no grupo da família")).toBe("<39 caracteres>");
  });

  test("a reflexão tem piso e teto, e o `trim` vem antes do piso", () => {
    // Um campo com cinco espaços é uma resposta em branco, e ela contaria como
    // entregue no painel da professora (o CHECK da migration é a rede final).
    expect([PISO_DA_REFLEXAO, TETO_DA_REFLEXAO]).toEqual([5, 500]);
    expect(ReflexaoSchema.safeParse({ texto: " ".repeat(PISO_DA_REFLEXAO + 5) }).success).toBe(
      false,
    );
    expect(ReflexaoSchema.safeParse({ texto: "a".repeat(TETO_DA_REFLEXAO + 1) }).success).toBe(
      false,
    );
    expect(ReflexaoSchema.safeParse({ texto: "Eu ia encaminhar sem checar." }).success).toBe(true);
  });

  test("a pergunta do tio é sobre o grupo da FAMÍLIA, não sobre a escola", () => {
    // É a transferência: a missão só cumpre o objetivo se a última pergunta sair
    // da sala de aula.
    expect(PERGUNTA_DA_REFLEXAO).toContain("tio");
    expect(PERGUNTA_DA_REFLEXAO).toContain("família");
  });

  test("o podcast é texto, e fecha com a regra que a missão quer deixar", () => {
    // A locução de 3m40 do brief não foi gravada, e a missão roda igual: a
    // transcrição é acessibilidade de sala sem fone, não remendo.
    expect(PODCAST.blocos.length).toBeGreaterThanOrEqual(5);
    const tudo = PODCAST.blocos.flatMap((b) => b.falas).join(" ");
    expect(tudo).toContain("checa");
  });
});
