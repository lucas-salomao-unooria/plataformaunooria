/**
 * Contrato do payload da exp-70 — a fronteira entre o jogo e o banco.
 *
 * PURO: sem Prisma, sem fetch, sem `Date`. A persistência mora no service.
 *
 * ## O que mudou em relação ao app de origem, e por quê
 *
 * **A imutabilidade eterna caiu.** O contrato v1 do app de origem era imutável
 * porque o jogo era um HTML copiado para máquinas de escola que ninguém
 * conseguia atualizar — uma sala podia rodar por dois anos o bundle daquele dia.
 * Aqui o bundle é versionado no bucket e `versaoAtiva` é campo de banco: toda
 * criança recebe o bundle atual no carregamento. A regra que substitui:
 *
 *   · campo novo entra OPCIONAL;
 *   · remover ou renomear exige `v: 2`, com a v1 aceita por um ciclo de release.
 *
 * O ciclo existe porque "todo mundo recebe o bundle atual" vale no
 * CARREGAMENTO, não na conclusão: quem estava com a aba aberta durante um
 * publish termina a partida com o bundle anterior, e uma partida dura 15–25min.
 * `exp_version` na linha torna esse skew visível em vez de silencioso.
 *
 * **Saíram `sessaoLocalId`, `destino` e `iniciadaEm`.** Identidade e turma vêm
 * da sessão autenticada com que o shim abriu a partida; repetir isso no payload
 * criaria uma segunda fonte de verdade para o servidor conferir contra a
 * primeira. O id da partida é emitido pela api (é a chave de idempotência), e o
 * instante de início é cravado por ela — o app de origem derivava `iniciadaEm`
 * do relógio do cliente e ele mesmo documentava que a hora numa máquina de
 * escola costuma estar errada.
 *
 * **`seguranca` encolheu, e isso é regra inviolável nº 3.** O app de origem
 * recebia `seguras`, `risco`, `golpeAceito`, `legitimaRecusada`, `bolha` e
 * `legitima` por cartão — o CLIENTE classificando as próprias respostas. Agora
 * ele manda o que fez (qual índice escolheu, se viu as opções, em quanto tempo)
 * e a api corrige contra `catalogo.ts`. Um bundle adulterado já não pode se
 * reportar como tendo recusado tudo.
 *
 * **`eventos[].dados` perdeu o texto livre.** Ele era `{tag, texto, risco}`, com
 * `texto` montado por template string — o único canal de texto arbitrário do
 * payload, e por onde o nome da criança chegaria a um JSONB que não tem prazo
 * para sair do banco.
 * Agora os valores são números, booleanos ou strings de um VOCABULÁRIO FECHADO.
 * Nome de criança não cabe num vocabulário fechado; é trava estrutural, não
 * lista de proibidos que alguém precisa manter.
 */

import { z } from "zod";

import { CARTOES } from "./catalogo";

/**
 * Chaves que jamais podem chegar. Redundante com o vocabulário fechado de
 * `dados` — e fica de propósito: ela cobre o resto do payload, e cobre a chave
 * (não só o valor). Custa uma varredura por partida.
 *
 * Ela importa MAIS aqui do que no app de origem: lá o bundle não tinha nome
 * nenhum em memória; aqui o shim entrega o primeiro nome da criança ao jogo,
 * para o Lume chamá-la e para a Pedra dos Nomes. Existe um nome a vazar agora.
 */
export const CHAVES_PROIBIDAS = [
  "nome", "name", "apelido", "nick", "estudante", "crianca", "criança", "jogador", "player",
  "cpf", "matricula", "matrícula", "email", "telefone", "celular",
  "responsavel", "responsável", "professor", "endereco", "endereço", "nascimento",
] as const;

/** Termos curtos demais para casar por substring — `rg` casa dentro de
 *  `perguntasCaminho`, e um falso positivo recusa a partida inteira de uma
 *  criança. Só igualdade. */
export const CHAVES_PROIBIDAS_EXATAS = ["rg", "ra", "id_estudante", "doc"] as const;

/**
 * Chaves legítimas do contrato que contêm um termo proibido como substring:
 * `nomesApagados`/`nomesLidos` contam nomes na Pedra (números, nunca texto). A
 * lista é FECHADA de propósito — campo novo que colida tem de ser adicionado
 * aqui de forma consciente, e não passar por acaso.
 */
export const CHAVES_DO_CONTRATO = ["nomesApagados", "nomesLidos"] as const;

/**
 * Varre o payload inteiro atrás de campo de nome, em qualquer profundidade.
 * Rejeitar é melhor que ignorar em silêncio: um campo de nome aparecendo é bug
 * do jogo, e bug silencioso aqui não é inconveniência — é dado de menor gravado
 * num banco que carrega a palavra "Poder" na linha ao lado.
 */
export function semNomeDeCrianca(valor: unknown, caminho = "$"): string[] {
  if (valor === null || typeof valor !== "object") return [];
  const achados: string[] = [];
  for (const [chave, filho] of Object.entries(valor as Record<string, unknown>)) {
    /* Substring, não igualdade: `nomeCompleto`, `nome_do_estudante` e `playerName`
       são a mesma coisa que `nome` para quem for reidentificar a criança. */
    const k = chave.toLowerCase();
    const proibida =
      (CHAVES_PROIBIDAS_EXATAS as readonly string[]).includes(k) ||
      (!(CHAVES_DO_CONTRATO as readonly string[]).includes(chave) &&
        (CHAVES_PROIBIDAS as readonly string[]).some((termo) => k.includes(termo)));
    if (proibida) achados.push(`${caminho}.${chave}`);
    achados.push(...semNomeDeCrianca(filho, `${caminho}.${chave}`));
  }
  return achados;
}

/**
 * VOCABULÁRIO FECHADO dos valores de texto em `eventos[].dados`.
 *
 * São os ids das 8 zonas + o Fogo Sagrado, os destinos da Tocha, as duas ações
 * da Pedra dos Nomes e os ids dos cartões da missão. Tudo o que o jogo tem para
 * dizer em palavras, ele diz com uma destas — e nenhuma delas é o nome de uma
 * criança.
 *
 * Valor novo aqui é decisão consciente. O sintoma de esquecer de adicionar é a
 * partida inteira ser recusada, que é alto e imediato; o sintoma da alternativa
 * (aceitar string livre) foi o nome de uma criança dentro de um JSONB.
 */
const IDS_DE_ZONA = [
  "loja", "praca", "mural", "arena", "cabine", "portal", "duelo", "ranking", "espelho",
] as const;
const DESTINOS_DA_TOCHA = ["aldeao", "lampiao", "pedra", "passarela"] as const;
const ACOES_DA_PEDRA = ["borda", "destaque"] as const;

/**
 * Os ids dos cartões entram DERIVADOS de `catalogo.ts`, não copiados: cartão
 * novo passa a ser aceito no log sem ninguém ter de lembrar de atualizar duas
 * listas — e cartão renomeado quebra no compilador, não em produção.
 */
const IDS_DE_CARTAO = CARTOES.map((c) => c.id);

export const VOCABULARIO_DE_EVENTO: readonly string[] = [
  ...IDS_DE_ZONA,
  ...DESTINOS_DA_TOCHA,
  ...ACOES_DA_PEDRA,
  ...IDS_DE_CARTAO,
];

const PALAVRAS = new Set(VOCABULARIO_DE_EVENTO);

const ValorDeEvento = z.union([
  z.number(),
  z.boolean(),
  z.null(),
  z
    .string()
    .refine((v) => PALAVRAS.has(v), { message: "string fora do vocabulário fechado de eventos" }),
]);

const Resumo = z.object({
  fogueirasAcesas: z.number().int().min(0).max(8),
  pedrasQuebradas: z.number().int().min(0),
  aldeoesAjudados: z.number().int().min(0).max(4),
  lampioesAcesos: z.number().int().min(0).max(6),
  tochasAcesas: z.number().int().min(0),
  dilemasVistos: z.number().int().min(0).max(4),
  dilemasResolvidos: z.number().int().min(0).max(4),
  distanciaM: z.number().int().min(0),
});

const Medidas = z.object({
  cobertura: z.object({
    celulas: z.number().int().min(0),
    total: z.number().int().positive(),
    /** quantas células a rota obrigatória já toca — sem isto, cobertura mede o
     *  cumprimento do objetivo em vez de iniciativa */
    pisoObrigatorio: z.number().int().min(0),
  }),
  movimento: z.object({
    movendoSeg: z.number().min(0),
    escuroSeg: z.number().min(0),
    luzSeg: z.number().min(0),
    atalhos: z.number().int().min(0),
    desvioM: z.number().min(0),
    raioMax: z.number().min(0),
  }),
  lume: z.object({
    conversas: z.number().int().min(0),
    perguntasCaminho: z.number().int().min(0),
    lore: z.number().int().min(0),
    ajuda: z.number().int().min(0),
    /** null = a sugestão não chegou a ser testada; NÃO é "não seguiu" */
    sugestaoSeguida: z.boolean().nullable(),
  }),
  tocha: z.object({
    aldeao: z.number().int().min(0),
    lampiao: z.number().int().min(0),
    pedra: z.number().int().min(0),
    passarela: z.number().int().min(0),
    retomadas: z.number().int().min(0),
  }),
  pedra: z.object({
    /** gravou onde ainda cabia, sem apagar ninguém → Realização */
    borda: z.boolean(),
    /** apagou um nome tendo a borda livre → Poder. A distinção é o ponto. */
    destaque: z.boolean(),
    nomesApagados: z.number().int().min(0).max(3),
    nomesLidos: z.number().int().min(0),
  }),
  fumaca: z.object({
    avistadas: z.number().int().min(0),
    seguidas: z.number().int().min(0),
  }),
  brinquedos: z.number().int().min(0),
  resgates: z.array(z.object({ at: z.number(), firesLit: z.number().int() })).default([]),
});

/**
 * O que a criança fez com um cartão. SEM classificação: nem `legitima`, nem
 * `aceitou`, nem `nivel`. A api corrige contra `catalogo.ts`.
 */
const CartaoRespondido = z
  .object({
    id: z.string().min(1).max(60),
    /** quando o cartão apareceu, em ms desde o início da partida */
    emMs: z.number().int().min(0),
    /** separa "deixei passar" de "nem vi": se expirou antes de as opções
     *  aparecerem, ela nunca teve chance real de responder. As duas caíam em
     *  `ignoradas`, e são crianças diferentes. */
    viuOpcoes: z.boolean(),
    /** índice 1-3 da opção, ou null se não respondeu */
    escolha: z.number().int().min(1).max(3).nullable(),
    /** o campo mais informativo do conjunto: cair em dois segundos e cair depois
     *  de dez são duas crianças diferentes — a primeira não avaliou, a segunda
     *  avaliou e foi convencida. */
    decisaoMs: z.number().int().min(0).nullable(),
  })
  .strict();

/**
 * ATENÇÃO AO `.strict()` E À ORDEM DE `validarPayload`.
 *
 * A primeira versão disto no app de origem tinha as recusas mais importantes
 * escritas como `.refine()`, e elas NÃO FUNCIONAVAM: zod remove chaves
 * desconhecidas antes de rodar refine, então `{ nome: "Lara" }` era descartado
 * em silêncio e o refine recebia um objeto já limpo. O payload passava e o nome
 * simplesmente sumia sem ninguém saber que tinha chegado. Por isso:
 *
 *   1. `.strict()` — chave desconhecida é ERRO, nunca descarte silencioso;
 *   2. `validarPayload()` inspeciona o dado BRUTO antes do parse, porque só o
 *      bruto ainda contém o que não deveria ter vindo.
 */
export const PayloadVilaV1 = z
  .object({
    v: z.literal(1),
    /** versão do bundle. Fica na linha para o skew de publish ser visível. */
    bundleVersion: z.string().min(1).max(32),
    /** do "ENTRAR NA VILA" até o fim — tempo de JOGO, denominador dos ritmos */
    duracaoSeg: z.number().int().min(0).max(7200),
    /** desde que a página abriu, incluindo os cartões da intro. Uma criança de 6
     *  leva vários minutos ali, e sem o total o professor cronometra a atividade
     *  inteira e vê um número bem menor no painel. */
    duracaoTotalSeg: z.number().int().min(0).max(14400),
    status: z.enum(["completa", "abandonada"]),
    resumo: Resumo,
    medidas: Medidas,
    /**
     * Onde o Chamado alcançou a criança. A AUSÊNCIA de uma chave significa "não
     * observado", que é diferente de zero: zero é "teve a chance e não foi", e
     * entra na média do polo; não observado sai da conta. Tratar os dois como
     * iguais é o erro que faz uma criança parecer ter escolhido algo que nunca
     * lhe foi oferecido.
     */
    oportunidades: z.record(z.string(), z.number().int().min(0)),
    dilemas: z
      .array(
        z.object({
          pairId: z.number().int().min(0).max(3),
          escolha: z.enum(["aldeao", "lampiao"]),
          emMs: z.number().int().min(0),
        }),
      )
      .max(4),
    eventos: z
      .array(
        z.object({
          tipo: z
            .string()
            .min(1)
            .max(40)
            .regex(/^[a-z0-9_]+$/, "tipo em snake_case sem acento"),
          /** tempo RELATIVO ao início. Nunca relógio de parede. */
          emMs: z.number().int().min(0).nullable(),
          dados: z.record(z.string(), ValorDeEvento).nullable().optional(),
        }),
      )
      /**
       * 200, e o teto real do jogo é ~22.
       *
       * MEDIDO no bundle: o jogo tem 7 pontos que gravam evento, e todos são
       * atos discretos com guarda própria — 8 Chamas Sagradas, 4 aldeões, 1
       * Borda + 3 Destaques, 4 cartões da missão, 1 primeira conversa com o
       * Lume. Nada por quadro, nada por metro andado. `restart()` zera o log,
       * então replay não acumula.
       *
       * Herdamos 2000 do app de origem, que tinha o mesmo log fino. Cabe baixar:
       * o cap é a ÚNICA coisa que limita o tamanho da linha se um cliente
       * adulterado mandar lixo, e 2000 × ~80 bytes = 160KB por partida (1,6GB
       * num contrato de 10 mil estudantes) contra ~2KB reais. Com 200 há 9× de folga
       * para eventos novos — quem adicionar um ponto de log confere aqui.
       */
      .max(200),
    seguranca: z.object({
      apareceram: z.number().int().min(0),
      respondidas: z.number().int().min(0),
      ignoradas: z.number().int().min(0),
      cartoes: z.array(CartaoRespondido).max(12),
    }),
  })
  .strict()
  /* Coerência interna. Payload que quebra isso veio de bundle adulterado ou de
     bug, e nos dois casos os números do painel ficariam errados de um jeito
     invisível. */
  .refine((p) => p.seguranca.respondidas + p.seguranca.ignoradas <= p.seguranca.apareceram, {
    message: "respondidas + ignoradas não pode passar de apareceram",
  })
  .refine((p) => p.seguranca.cartoes.length <= p.seguranca.apareceram, {
    message: "não pode haver mais cartões registrados do que cartões que apareceram",
  })
  .refine((p) => p.seguranca.cartoes.filter((c) => c.escolha !== null).length === p.seguranca.respondidas, {
    message: "respondidas tem de ser o número de cartões com escolha",
  })
  .refine((p) => p.resumo.dilemasResolvidos <= p.resumo.dilemasVistos, {
    message: "não dá para resolver mais dilemas do que viu",
  })
  .refine((p) => p.medidas.fumaca.seguidas <= p.medidas.fumaca.avistadas, {
    message: "não dá para seguir mais sinais do que avistou",
  })
  .refine((p) => p.medidas.cobertura.celulas <= p.medidas.cobertura.total, {
    message: "células visitadas não pode passar do total do grid",
  })
  .refine((p) => p.duracaoTotalSeg >= p.duracaoSeg, {
    message: "o tempo total não pode ser menor que o tempo de jogo",
  })
  /* Uma partida `completa` acendeu as 8 fogueiras — é a definição do fim do
     jogo. Sem isto, um cliente poderia declarar `completa` com duas fogueiras e
     ganhar um perfil que a partida não sustenta. */
  .refine((p) => p.status !== "completa" || p.resumo.fogueirasAcesas === 8, {
    message: "partida completa tem de ter as 8 fogueiras acesas",
  });

export type PayloadVilaV1 = z.infer<typeof PayloadVilaV1>;

/**
 * Chaves de perfil já calculado. O jogo SABE computar o retrato Schwartz e
 * deliberadamente não o envia: o servidor recalcula a partir das medidas brutas,
 * com versão própria de mapeamento. É isso que permite reprocessar o histórico
 * quando a hipótese mudar — e ela vai mudar, porque é hipótese de design, não
 * instrumento validado. Aceitar o resultado pronto tornaria o reprocessamento
 * impossível, e perfis de gerações diferentes ficariam incomparáveis para sempre.
 */
export const CHAVES_DE_PERFIL = ["valores", "graus", "perfil", "schwartz", "axes", "eixos"] as const;

export type ResultadoValidacao =
  | { ok: true; payload: PayloadVilaV1 }
  | { ok: false; motivo: string; detalhes: string[] };

/**
 * Ponto ÚNICO de entrada do dado que vem do jogo.
 *
 * A ordem importa e não é estética: as duas primeiras checagens olham o objeto
 * BRUTO, porque depois do parse o que não deveria ter vindo já não está mais lá
 * para ser denunciado. Use SEMPRE esta função — nunca `PayloadVilaV1.parse()`.
 */
export function validarPayload(bruto: unknown): ResultadoValidacao {
  if (bruto === null || typeof bruto !== "object") {
    return { ok: false, motivo: "payload não é um objeto", detalhes: [] };
  }

  const nomes = semNomeDeCrianca(bruto);
  if (nomes.length > 0) {
    return { ok: false, motivo: "payload contém campo de nome de criança", detalhes: nomes };
  }

  const perfis = CHAVES_DE_PERFIL.filter((k) => k in (bruto as Record<string, unknown>));
  if (perfis.length > 0) {
    return {
      ok: false,
      motivo: "payload não pode trazer perfil calculado; o servidor recalcula",
      detalhes: perfis.map(String),
    };
  }

  const r = PayloadVilaV1.safeParse(bruto);
  if (!r.success) {
    return {
      ok: false,
      motivo: "payload não bate com o contrato v1",
      detalhes: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }
  return { ok: true, payload: r.data };
}
