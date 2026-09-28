import {
  CLAUSULAS_DEFAULT,
  CONCESSAO_DO_BOT,
  CONTEXTO_DEFAULT,
  PISO_DA_JUSTIFICATIVA,
  PROMPTS_DEFAULT,
  PROMPTS_EXIGIDOS,
  TAGS,
  TAGS_EXIGIDAS,
  TETO_DA_JUSTIFICATIVA,
  acharClausula,
  acharPrompt,
  clausulasPublicas,
  promptsPublicos,
} from "../src/manifesto-ia/catalogo";
import { MENSAGENS as MENSAGENS_DE_ERRO, STATUS } from "../src/manifesto-ia/erros";
import {
  CAMPOS_SENSIVEIS,
  PROIBIDO_NO_PAINEL,
  TERMOS_PROIBIDOS_NA_TELA,
  paraLog,
  termosProibidosEm,
} from "../src/manifesto-ia/invariantes";
import { disparar, estadoDaAuditoria } from "../src/manifesto-ia/regras/auditoria";
import {
  DELAY_DA_GOVERNANCA_MS,
  compilarManifesto,
} from "../src/manifesto-ia/regras/manifesto";
import { padroesEm, temDadoPessoal } from "../src/manifesto-ia/regras/moderacao";
import {
  ACOES_DO_GATE,
  ETAPAS,
  ETAPA_DA_ACAO,
  PASSOS,
  aguardandoATurma,
  congeladoParaDebate,
  avancarAte,
  normalizarEtapa,
  normalizarPasso,
  passoEfetivo,
  proximoPasso,
} from "../src/manifesto-ia/regras/passos";
import { CHAVES_REDIGIDAS } from "../src/observabilidade/redaction";
import { PercursoSchema } from "../src/manifesto-ia/contrato-de-rotas";

/**
 * Regras puras da exp08ef4b — sem Prisma, sem HTTP.
 *
 * O que estes testes protegem não é "a função devolve X": é a mecânica
 * pedagógica e as quatro ressalvas da banca. Cada bloco corresponde a um
 * não-negociável documentado, e a falha de qualquer um significa que a missão
 * passou a medir outra coisa.
 */

describe("catálogo", () => {
  test("3 questionamentos e 4 cláusulas — a cardinalidade é a spec", () => {
    // Não é preferência de layout: a tela do PICO é um grid 2×2 (`E3-ALU-01`) e
    // o seletor tem 3 cards. Mudar o número muda a tela e o teto da faixa.
    expect(PROMPTS_DEFAULT).toHaveLength(3);
    expect(CLAUSULAS_DEFAULT).toHaveLength(4);
  });

  test("os ids são únicos — id repetido colidiria no UNIQUE da auditoria", () => {
    expect(new Set(PROMPTS_DEFAULT.map((p) => p.id)).size).toBe(PROMPTS_DEFAULT.length);
    expect(new Set(CLAUSULAS_DEFAULT.map((c) => c.id)).size).toBe(CLAUSULAS_DEFAULT.length);
  });

  test("nenhum balão da máquina passa de 60 palavras (teto de leitura da faixa)", () => {
    const conta = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
    for (const p of PROMPTS_DEFAULT) {
      expect(conta(p.replicaIa)).toBeLessThanOrEqual(60);
    }
    expect(conta(CONTEXTO_DEFAULT.premissaIaAutoritaria)).toBeLessThanOrEqual(60);
    expect(conta(CONCESSAO_DO_BOT)).toBeLessThanOrEqual(60);
  });

  test("`promptsPublicos` NÃO leva a réplica da máquina", () => {
    // Ver a defesa antes de fazer a pergunta desmonta a cena da auditoria.
    for (const p of promptsPublicos(PROMPTS_DEFAULT)) {
      expect(p).not.toHaveProperty("replicaIa");
    }
  });

  test("`clausulasPublicas` NÃO leva a justificativa sugerida", () => {
    // Material do professor. Mostrá-la ao estudante transformaria a autoria da
    // Etapa 5 em cópia.
    for (const c of clausulasPublicas(CLAUSULAS_DEFAULT)) {
      expect(c).not.toHaveProperty("justificativaSugerida");
    }
  });

  test("as 4 tags do percurso, e exatamente 2 exigidas", () => {
    expect(TAGS).toHaveLength(4);
    expect(TAGS_EXIGIDAS).toBe(2);
  });

  test("id de tag é identificador: minúsculo, sem acento (ADR-91)", () => {
    // O id vai à coluna, ao verbo de telemetria e à nuvem do painel; o rótulo
    // com acento é o que a pessoa lê. Trocar um pelo outro quebraria o CHECK
    // de vocabulário da migration.
    for (const t of TAGS) {
      expect(t.id).toMatch(/^[a-z]+$/);
      expect(t.rotulo.length).toBeGreaterThan(0);
    }
  });

  test("busca por id devolve o item, e `undefined` para id desconhecido", () => {
    expect(acharPrompt(PROMPTS_DEFAULT, "prompt_origem_dados")?.id).toBe("prompt_origem_dados");
    expect(acharPrompt(PROMPTS_DEFAULT, "prompt_inventado")).toBeUndefined();
    expect(acharClausula(CLAUSULAS_DEFAULT, "clausula_veto_humano")?.id).toBe(
      "clausula_veto_humano",
    );
    expect(acharClausula(CLAUSULAS_DEFAULT, "clausula_inventada")).toBeUndefined();
  });
});

describe("cota de auditoria (PED-02 — a porta que a missão mede)", () => {
  test("dois questionamentos DISTINTOS abrem o pico; um não", () => {
    expect(PROMPTS_EXIGIDOS).toBe(2);
    expect(estadoDaAuditoria([]).cotaAtingida).toBe(false);
    expect(estadoDaAuditoria(["prompt_origem_dados"]).cotaAtingida).toBe(false);
    expect(
      estadoDaAuditoria(["prompt_origem_dados", "prompt_preconceito_historico"]).cotaAtingida,
    ).toBe(true);
  });

  test("o mesmo questionamento duas vezes NÃO fecha a cota", () => {
    // Se fechasse, a criança chegaria ao pico sem ter visto a contradição — que
    // é o objeto da aula. A hipótese pedagógica é que ela só aparece no segundo
    // prompt: o primeiro a máquina responde com estatística.
    const estado = estadoDaAuditoria(["prompt_origem_dados", "prompt_origem_dados"]);
    expect(estado.total).toBe(1);
    expect(estado.cotaAtingida).toBe(false);
    expect(estado.faltam).toBe(1);
  });

  test("`disparar` recusa id desconhecido e id repetido", () => {
    const ids = PROMPTS_DEFAULT.map((p) => p.id);
    expect(disparar([], "prompt_inventado", ids)).toEqual({
      ok: false,
      codigo: "prompt-desconhecido",
    });
    expect(disparar(["prompt_origem_dados"], "prompt_origem_dados", ids)).toEqual({
      ok: false,
      codigo: "prompt-ja-enviado",
    });
  });

  test("o terceiro questionamento é permitido — 2 é mínimo, não teto", () => {
    const ids = PROMPTS_DEFAULT.map((p) => p.id);
    const r = disparar(
      ["prompt_origem_dados", "prompt_preconceito_historico"],
      "prompt_quem_define_regras",
      ids,
    );
    expect(r.ok).toBe(true);
    expect(estadoDaAuditoria(r.ok ? r.enviados : []).total).toBe(3);
  });
});

describe("passos e o Checkpoint A (ADR-93)", () => {
  test("os 7 passos, na ordem do roteiro", () => {
    expect([...PASSOS]).toEqual([
      "briefing",
      "chat",
      "decisao",
      "manifesto",
      "percurso",
      "podcast",
      "fim",
    ]);
  });

  test("as 2 etapas da turma e as ações que levam a cada uma", () => {
    expect([...ETAPAS]).toEqual(["missao", "debate"]);
    expect([...ACOES_DO_GATE]).toEqual(["pausar-para-debate", "retomar-missao"]);
    expect(ETAPA_DA_ACAO["pausar-para-debate"]).toBe("debate");
    expect(ETAPA_DA_ACAO["retomar-missao"]).toBe("missao");
  });

  test("`debate` segura em `manifesto` — a assinatura espera o debate oral", () => {
    expect(passoEfetivo("percurso", "debate")).toBe("manifesto");
    expect(aguardandoATurma("percurso", "debate")).toBe(true);
  });

  /**
   * O DEFEITO QUE A SUÍTE DE POSTGRES ENCONTROU, agora preso aqui também.
   *
   * O congelamento era um TETO, e `aguardandoATurma` era
   * `passoEfetivo !== passo`. O estudante parado exatamente em `manifesto`
   * ficava com os dois iguais — `false` — e **o overlay de pausa não aparecia
   * para quem tinha acabado de ler o documento**, que é quem o debate existe
   * para reunir. Passava no typecheck e nestes testes.
   */
  test("o congelamento é uma JANELA: acende para quem ESTÁ em `manifesto`", () => {
    expect(congeladoParaDebate("manifesto", "debate")).toBe(true);
    expect(aguardandoATurma("manifesto", "debate")).toBe(true);
    expect(passoEfetivo("manifesto", "debate")).toBe("manifesto");
  });

  test("e NÃO alcança quem já assinou — o latch é do estudante, não da turma", () => {
    // Congelar quem terminou tiraria da tela um percurso já protocolado.
    for (const passo of ["podcast", "fim"] as const) {
      expect(congeladoParaDebate(passo, "debate")).toBe(false);
      expect(passoEfetivo(passo, "debate")).toBe(passo);
      expect(aguardandoATurma(passo, "debate")).toBe(false);
    }
  });

  test("`debate` NÃO empurra para a frente quem está atrás — mexe só no teto", () => {
    // Se subisse o piso, apertar "Pausar para Debate" arrastaria para o
    // manifesto quem ainda auditava a máquina — e são justamente essas
    // crianças que o debate tenta alcançar.
    expect(passoEfetivo("chat", "debate")).toBe("chat");
    expect(passoEfetivo("decisao", "debate")).toBe("decisao");
    expect(aguardandoATurma("chat", "debate")).toBe(false);
  });

  test("`missao` não tem teto: a missão corre inteira sem ninguém apertar nada", () => {
    for (const passo of PASSOS) {
      expect(passoEfetivo(passo, "missao")).toBe(passo);
    }
  });

  test("estudante SEM turma não tem gate — senão seria um beco sem saída", () => {
    // Sem sala não há quem aperte o botão para soltá-lo.
    expect(passoEfetivo("percurso", null)).toBe("percurso");
    expect(aguardandoATurma("percurso", null)).toBe(false);
  });

  test("`avancarAte` nunca anda para trás", () => {
    // Um F5 na Etapa 5 não pode devolver a criança ao briefing que ela já leu,
    // e uma requisição fora de ordem não pode reabrir uma tela latch.
    expect(avancarAte("percurso", "chat")).toBe("percurso");
    expect(avancarAte("chat", "percurso")).toBe("percurso");
    expect(avancarAte("fim", "briefing")).toBe("fim");
  });

  test("`proximoPasso` do último é ele mesmo", () => {
    expect(proximoPasso("fim")).toBe("fim");
    expect(proximoPasso("briefing")).toBe("chat");
  });

  test("valor desconhecido do banco cai no inicial, sem lançar", () => {
    expect(normalizarPasso("passo_de_outra_versao")).toBe("briefing");
    expect(normalizarPasso(null)).toBe("briefing");
    expect(normalizarEtapa("aula1")).toBe("missao");
    expect(normalizarEtapa(undefined)).toBe("missao");
  });
});

describe("o manifesto compilado (Etapa 4)", () => {
  test("o delay diegético é de 2000ms exatos (não-negociável 2)", () => {
    expect(DELAY_DA_GOVERNANCA_MS).toBe(2000);
  });

  test("o documento carrega a escola e a cláusula escolhida", () => {
    const clausula = CLAUSULAS_DEFAULT[2]!;
    const md = compilarManifesto(CONTEXTO_DEFAULT, clausula);
    expect(md).toContain(CONTEXTO_DEFAULT.escola);
    expect(md).toContain(clausula.tituloClausula);
    expect(md).toContain(clausula.artigoTexto);
  });

  test("NÃO carrega as outras três cláusulas", () => {
    // A "Diretriz Soberana Aprovada" é UMA. Um documento com as quatro faria a
    // escolha do PICO não ter consequência visível — e a consequência é o Aha!.
    const escolhida = CLAUSULAS_DEFAULT[0]!;
    const md = compilarManifesto(CONTEXTO_DEFAULT, escolhida);
    for (const outra of CLAUSULAS_DEFAULT.slice(1)) {
      expect(md).not.toContain(outra.artigoTexto);
    }
  });

  test("é Markdown com bloco de citação — a tela o mostra num `CodeBlock`", () => {
    const md = compilarManifesto(CONTEXTO_DEFAULT, CLAUSULAS_DEFAULT[0]!);
    expect(md.startsWith("# MANIFESTO DE DIREITOS DIGITAIS DOS ESTUDANTES")).toBe(true);
    expect(md).toContain("> **");
  });
});

describe("filtro de dado pessoal (a decisão: recusar, não gravar)", () => {
  test("pega os padrões estruturados", () => {
    expect(temDadoPessoal("me liga (11) 98765-4321")).toBe(true);
    expect(temDadoPessoal("meu cpf é 123.456.789-00")).toBe(true);
    expect(temDadoPessoal("manda pro meu email joao@escola.com")).toBe(true);
    expect(temDadoPessoal("moro no cep 01310-100")).toBe(true);
    expect(temDadoPessoal("meu insta é @joaozinho.silva")).toBe(true);
  });

  test("devolve o NOME do padrão, nunca o trecho que casou", () => {
    // É o que pode ir ao log e à resposta: diz o que aconteceu sem reproduzir
    // o dado que a regra está tentando não guardar.
    const nomes = padroesEm("liga (11) 98765-4321");
    expect(nomes).toContain("telefone");
    expect(nomes.join(" ")).not.toContain("98765");
  });

  test("NÃO recusa o ano — o falso positivo mais provável", () => {
    // "desde 2019 a escola usa esse sistema" é argumento situado, não PII. Um
    // filtro que casasse 4 dígitos soltos recusaria metade dos parágrafos.
    expect(temDadoPessoal("Desde 2019 a escola usa esse sistema e ninguém explicou")).toBe(false);
    expect(temDadoPessoal("A turma tem 32 estudantes e 4 professores")).toBe(false);
  });

  test("NÃO tenta adivinhar nome próprio — risco aceito e declarado", () => {
    // Recusar isto cortaria justamente o argumento que a Etapa 5 mede, e a
    // criança não teria como saber o que fazer com a mensagem de erro.
    expect(temDadoPessoal("meu tio Silva foi reprovado por um sistema desses")).toBe(false);
  });

  test("o regex global não vaza estado entre chamadas", () => {
    // `RegExp` com `g` guarda `lastIndex`: um literal compartilhado entre
    // requisições pularia o começo do texto seguinte, e um telefone passaria
    // batido a cada duas submissões.
    const texto = "liga (11) 98765-4321";
    expect(temDadoPessoal(texto)).toBe(true);
    expect(temDadoPessoal(texto)).toBe(true);
    expect(temDadoPessoal(texto)).toBe(true);
  });

  test("o 422 é o status, e a mensagem diz o que tirar", () => {
    expect(STATUS["dado-pessoal-no-texto"]).toBe(422);
    // 422 e não 400: a requisição está bem-formada e a regra é semântica.
    expect(MENSAGENS_DE_ERRO["dado-pessoal-no-texto"]).toMatch(/telefone/i);
  });
});

describe("o formulário do percurso", () => {
  const valido = {
    tags: ["autonomia", "justica"],
    justificativa: "Sem revisão humana a máquina decide sozinha sobre a vida de alguém.",
  };

  test("aceita 2 tags distintas e texto no piso", () => {
    expect(PercursoSchema.safeParse(valido).success).toBe(true);
  });

  test("recusa 1 tag, 3 tags e tags repetidas", () => {
    expect(PercursoSchema.safeParse({ ...valido, tags: ["autonomia"] }).success).toBe(false);
    expect(
      PercursoSchema.safeParse({ ...valido, tags: ["autonomia", "justica", "privacidade"] })
        .success,
    ).toBe(false);
    // Repetir deixa um slot logicamente vazio dentro de um array cheio, e a
    // nuvem da turma contaria a mesma criança duas vezes na mesma palavra.
    expect(
      PercursoSchema.safeParse({ ...valido, tags: ["justica", "justica"] }).success,
    ).toBe(false);
  });

  test("recusa tag fora do vocabulário", () => {
    expect(
      PercursoSchema.safeParse({ ...valido, tags: ["autonomia", "eficiencia"] }).success,
    ).toBe(false);
  });

  test("o `trim` vem antes do piso: campo de espaços é percurso em branco", () => {
    const espacos = " ".repeat(PISO_DA_JUSTIFICATIVA + 5);
    expect(PercursoSchema.safeParse({ ...valido, justificativa: espacos }).success).toBe(false);
  });

  test("respeita o teto — caixa livre sem teto é lugar onde cabe o imprevisto", () => {
    const longo = "a".repeat(TETO_DA_JUSTIFICATIVA + 1);
    expect(PercursoSchema.safeParse({ ...valido, justificativa: longo }).success).toBe(false);
  });
});

describe("invariantes de produto", () => {
  test("o parágrafo autoral está na redaction do logger (TEC-03 / DAD-08)", () => {
    // A comparação em `redigirObjeto` é por nome de chave INTEIRO em
    // minúsculas: `texto` não cobre `justificativaTexto`.
    expect(CHAVES_REDIGIDAS.has("justificativatexto")).toBe(true);
    expect(CHAVES_REDIGIDAS.has("justificativa_texto")).toBe(true);
  });

  test("os campos sensíveis nomeiam o texto do estudante e o material do professor", () => {
    for (const campo of ["justificativaTexto", "justificativaSugerida", "replicaIa"]) {
      expect(CAMPOS_SENSIVEIS as readonly string[]).toContain(campo);
    }
  });

  test("o painel não pode ter nota, ranking nem taxa de acerto (PED-07)", () => {
    for (const termo of ["score", "nota", "ranking", "acerto", "taxa"]) {
      expect(PROIBIDO_NO_PAINEL as readonly string[]).toContain(termo);
    }
  });

  test("os termos proibidos na tela cobrem andaime e rótulo sobre a criança", () => {
    for (const termo of ["gabarito", "resposta correta", "você errou", "ranking"]) {
      expect(TERMOS_PROIBIDOS_NA_TELA as readonly string[]).toContain(termo);
    }
  });

  test('"atividade" SOZINHA não é proibida — a cláusula 4 fala de redes sociais', () => {
    // Este teste é o registro de um achado: a régua reprovou a própria copy
    // homologada na primeira corrida, por causa de "atividades em redes
    // sociais" no Art. 4º. Mesmo caso que a exp06ef2b teve com "nota".
    expect(TERMOS_PROIBIDOS_NA_TELA as readonly string[]).not.toContain("atividade");
    expect(TERMOS_PROIBIDOS_NA_TELA as readonly string[]).toContain("esta atividade");
    expect(termosProibidosEm("cruzado com atividades em redes sociais")).toHaveLength(0);
    expect(termosProibidosEm("Responda esta atividade agora")).toContain("esta atividade");
  });

  test("`termosProibidosEm` não é sensível a caixa", () => {
    expect(termosProibidosEm("Veja o GABARITO da questão")).toContain("gabarito");
    expect(termosProibidosEm("Defina qual salvaguarda algorítmica")).toHaveLength(0);
  });

  test("a copy aprovada da missão passa pela própria régua", () => {
    // Sem isto, a régua poderia reprovar o texto homologado — foi o que a
    // exp06ef2b registrou ao proibir a palavra "nota" sozinha.
    const visiveis = [
      CONTEXTO_DEFAULT.premissaIaAutoritaria,
      CONCESSAO_DO_BOT,
      ...PROMPTS_DEFAULT.flatMap((p) => [p.rotuloBotao, p.textoPrompt, p.replicaIa]),
      ...CLAUSULAS_DEFAULT.flatMap((c) => [c.tituloClausula, c.artigoTexto]),
    ];
    for (const texto of visiveis) {
      expect(termosProibidosEm(texto)).toHaveLength(0);
    }
  });

  test("`paraLog` só devolve o tamanho, nunca o conteúdo", () => {
    expect(paraLog("meu telefone é 11987654321")).toBe("<26 caracteres>");
  });

  test("nenhuma mensagem de erro usa o vocabulário proibido", () => {
    // Quem lê é uma criança dentro da ficção de um terminal corporativo.
    for (const mensagem of Object.values(MENSAGENS_DE_ERRO)) {
      expect(termosProibidosEm(mensagem)).toHaveLength(0);
    }
  });
});
