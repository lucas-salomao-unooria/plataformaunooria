/**
 * O vocabulário da exp03ef1b — Nina e a Notícia que Desapareceu (3º ano EF,
 * unidade 1). Os valores fechados que o contrato, as regras, o conteúdo e os
 * CHECKs da migração repetem; aqui eles existem UMA vez.
 *
 * A experiência e o hub têm um espelho declarado destas listas (a experiência
 * não importa a api); o teste de cada lado compara o espelho com o que a api
 * devolve, porque uma segunda lista de valores é a que ninguém atualiza junto.
 *
 * Nomes INTERNOS podem diferir do texto da tela: o passo e a etapa `aposta`
 * aparecem para a criança e para a professora como "escolha" (ajuste do PO de
 * 27/10, spec §7.1) — o nome interno ficou, a palavra na tela mudou.
 */

export const EXP_ID = "exp03ef1b";

// ------------------------------------------------------------ os passos

/**
 * Os passos do estudante, na ordem (spec §1). O servidor guarda o passo, e um
 * F5 retoma nele. A ordem é contrato: `regras/passos.ts` compara por índice.
 *
 * galeria (E1) → aposta (E2, a ESCOLHA) → [portão `filtro`] → filtro (E3-01)
 * → omissao (E3-02, e a espera do portão `inspecao`) → ficha (E4-01) →
 * carimbos (E4-02) → reparo (E4-03) → desfecho (E4-04 | E4-05) → ponte (E5-00)
 * → rotina (E5-01) → caso (E6-01) → fim (E6-03).
 */
export const PASSOS = [
  "galeria",
  "aposta",
  "filtro",
  "omissao",
  "ficha",
  "carimbos",
  "reparo",
  "desfecho",
  "ponte",
  "rotina",
  "caso",
  "fim",
] as const;
export type Passo = (typeof PASSOS)[number];

/**
 * As etapas da TURMA — o relógio que a professora move. `aposta` é a de
 * partida; "Liberar Filtro" leva a `filtro`; "Liberar Inspeção" leva a
 * `inspecao`. Só avança, uma por vez.
 */
export const ETAPAS = ["aposta", "filtro", "inspecao"] as const;
export type Etapa = (typeof ETAPAS)[number];

/**
 * O que a professora pede no `POST turmas/:turmaId/gate`: `liberar` (a próxima
 * etapa — ou a etapa de destino em `para`, que tem de ser a próxima), `pausar`
 * e `retomar` (a flag `pausada`, que congela todas as telas no overlay
 * "Momento de conversar com a turma!"). Zerar é rota própria.
 */
export const ACOES_DO_GATE = ["liberar", "pausar", "retomar"] as const;
export type AcaoDoGate = (typeof ACOES_DO_GATE)[number];

/**
 * A etapa VISÍVEL (E1–E6) de cada passo: é o número do card "Equipes na etapa
 * N" do painel e da coluna de progresso. Não é o relógio da turma.
 */
export const ETAPA_VISIVEL_DO_PASSO: Readonly<Record<Passo, 1 | 2 | 3 | 4 | 5 | 6>> = {
  galeria: 1,
  aposta: 2,
  filtro: 3,
  omissao: 3,
  ficha: 4,
  carimbos: 4,
  reparo: 4,
  desfecho: 4,
  ponte: 5,
  rotina: 5,
  caso: 6,
  fim: 6,
};

// ---------------------------------------------------- as reportagens

/**
 * Os três SUPORTES da mesma feira, sempre os mesmos e nesta ordem: o mural
 * impresso, o portal da escola e o telão do corredor. É ESTRUTURA do servidor
 * (spec §0.5): a IA escreve o texto de cada um, nunca escolhe quais são.
 */
export const SUPORTES = ["mural", "portal", "telao"] as const;
export type Suporte = (typeof SUPORTES)[number];

/** O kicker do cartão de reportagem (E1). */
export const ROTULO_DO_SUPORTE: Readonly<Record<Suporte, string>> = {
  mural: "Mural Impresso",
  portal: "Portal da Escola",
  telao: "Telão do Corredor",
};

/** O suporte cuja ficha tem o campo Onde VAZIO — a notícia que desaparece no filtro. */
export const SUPORTE_OMITIDO: Suporte = "telao";

/** Os campos da ficha, na ordem da gaveta. */
export const CAMPOS = ["quem", "onde", "quando"] as const;
export type Campo = (typeof CAMPOS)[number];

export const ROTULO_DO_CAMPO: Readonly<Record<Campo, string>> = {
  quem: "Quem",
  onde: "Onde",
  quando: "Quando",
};

/** Os LUGARES (o campo Onde). Os três são os valores da pastilha Onde na E3. */
export const LUGARES = ["patio", "biblioteca", "quadra"] as const;
export type Lugar = (typeof LUGARES)[number];

/** Quem aparece numa ficha (as da feira, as fichas-teste e as do Desafio Extra). */
export const PESSOAS = ["estudantes", "professores", "familias", "visitantes"] as const;
export type Pessoa = (typeof PESSOAS)[number];

/** Os dias (o campo Quando). */
export const DIAS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
export type Dia = (typeof DIAS)[number];

/**
 * A ESTRUTURA FIXA da feira (spec §0.5): as três reportagens são do pátio, com
 * os estudantes, na sexta. O rótulo "Pátio escolar" do ícone de lugar (E1)
 * também é fixo.
 */
export const LUGAR_DO_EVENTO: Lugar = "patio";
export const QUEM_DO_EVENTO: Pessoa = "estudantes";
export const QUANDO_DO_EVENTO: Dia = "sexta";
export const ROTULO_DO_LUGAR_DO_EVENTO = "Pátio escolar";

/**
 * Os VALORES de cada pastilha do filtro (E3-ALU-01).
 *
 * Onde: Pátio, Biblioteca, Quadra (protótipo, "Valores para Onde").
 *
 * Quem e Quando: o protótipo e o sheet não trazem os valores. DECISÃO da
 * fundação: as pastilhas oferecem valores que NÃO são os da feira, para que a
 * busca continue HONESTA (booleana sobre o pacote) e ainda assim cumpra a
 * decisão 8 da spec — "Quem ou Quando devolvem 0 notícias". Oferecer
 * "estudantes" ou "sexta" devolveria as três e apagaria o momento da omissão;
 * mentir no resultado ensinaria o contrário da missão. Valor novo aqui exige
 * olhar `regras/filtro.ts` e o teste "só Onde=Pátio encontra".
 */
export const VALORES_DO_FILTRO = {
  quem: ["professores", "familias", "visitantes"],
  onde: LUGARES,
  quando: ["segunda", "terca", "quarta"],
} as const satisfies Readonly<Record<Campo, readonly string[]>>;
export type ValorDoFiltro = (typeof VALORES_DO_FILTRO)[Campo][number];

/** O rótulo de cada valor que aparece numa ficha, numa pastilha ou numa etiqueta. */
export const ROTULO_DO_VALOR: Readonly<Record<Lugar | Pessoa | Dia, string>> = {
  patio: "Pátio",
  biblioteca: "Biblioteca",
  quadra: "Quadra",
  estudantes: "estudantes",
  professores: "professores",
  familias: "famílias",
  visitantes: "visitantes",
  segunda: "segunda",
  terca: "terça",
  quarta: "quarta",
  quinta: "quinta",
  sexta: "sexta",
  sabado: "sábado",
};

// ------------------------------------------------------- os carimbos

/**
 * Os três carimbos (E4-ALU-02 e E6-ALU-01). Cada cartão traz as TRÊS opções
 * visíveis, ícone + texto (ajuste do PO, spec §7.5) — sem cor de certo/errado.
 */
export const CARIMBOS = ["v", "x", "duvida"] as const;
export type Carimbo = (typeof CARIMBOS)[number];

export const ROTULO_DO_CARIMBO: Readonly<Record<Carimbo, string>> = {
  v: "É verdade",
  x: "Não é verdade",
  duvida: "Não dá para saber",
};

/** O glifo de cada carimbo: ✔ em círculo, ✖ em quadrado, ? em triângulo. */
export const GLIFO_DO_CARIMBO: Readonly<Record<Carimbo, string>> = { v: "✔", x: "✖", duvida: "?" };

/** Os cartões de cada momento: K1–K3 na inspeção (E4), K4–K6 no caso novo (E6). */
export const CARTOES_DA_INSPECAO = ["k1", "k2", "k3"] as const;
export const CARTOES_DO_CASO = ["k4", "k5", "k6"] as const;
export const CARTOES = [...CARTOES_DA_INSPECAO, ...CARTOES_DO_CASO] as const;
export type Cartao = (typeof CARTOES)[number];

/** Os dois momentos dos carimbos, como o `POST carimbos` os nomeia. */
export const ETAPAS_DOS_CARIMBOS = ["e4", "e6"] as const;
export type EtapaDosCarimbos = (typeof ETAPAS_DOS_CARIMBOS)[number];

// ------------------------------------------------------- o reparo

/**
 * As três ETIQUETAS da bandeja do reparo (E4-ALU-03). Desde o ajuste do PO de
 * 28/10 (spec §7.6) a ficha do telão começa com os TRÊS campos vazios, e as
 * três etiquetas são móveis: a criança monta a ficha inteira.
 */
export const ETIQUETAS = ["patio", "estudantes", "sexta"] as const;
export type Etiqueta = (typeof ETIQUETAS)[number];

/** A etiqueta que decide o reparo: válido ⇔ ela está no campo Onde. */
export const ETIQUETA_DO_LUGAR: Etiqueta = "patio";

export const DESFECHOS = ["sucesso", "erro"] as const;
export type Desfecho = (typeof DESFECHOS)[number];

// ------------------------------------------------------- a rotina

/**
 * Os sete BLOCOS da rotina (E5-ALU-01). Os ids sobem embaralhados e opacos
 * (`regras/rotina.ts`); o slug fica no servidor.
 */
export const BLOCOS = ["enquanto", "pegar", "se", "ok", "senao", "revisar", "fim"] as const;
export type Bloco = (typeof BLOCOS)[number];

export const ROTULO_DO_BLOCO: Readonly<Record<Bloco, string>> = {
  enquanto: "ENQUANTO houver ficha pendente",
  pegar: "Pegar próxima ficha",
  se: "SE campo Onde tem ícone",
  ok: "Marcar: ok",
  senao: "SENÃO",
  revisar: "Marcar: revisar",
  fim: "FIM: voltar à pilha",
};

/**
 * A SEQUÊNCIA CERTA (01e §3, "Sequência Canônica Correta"). A esteira da tela
 * tem sete vagas com indentação (ENQUANTO > Pegar, SE > ok, SENÃO > revisar,
 * FIM); a rotina é válida só com estes sete nesta ordem. GABARITO: nunca desce
 * ao estudante.
 */
export const SEQUENCIA_CERTA: readonly Bloco[] = ["enquanto", "pegar", "se", "ok", "senao", "revisar", "fim"];

/** As marcas da simulação da rotina, ficha a ficha. */
export const MARCAS_DA_ROTINA = ["ok", "revisar"] as const;
export type MarcaDaRotina = (typeof MARCAS_DA_ROTINA)[number];

/**
 * O limiar da rotina (EF03CO02 e o alerta do painel): até DUAS tentativas
 * (contando a válida) é "atingiu"; mais de TRÊS sem acertar acende "Alerta:
 * equipe em repetição sem parada.".
 */
export const TENTATIVAS_PARA_ATINGIR_A_ROTINA = 2;
export const TENTATIVAS_PARA_ALERTA_DA_ROTINA = 3;

// ------------------------------------------------------- o pacote

/**
 * Origem do pacote: `padrao` — o BANCO PADRÃO da Feira de Troca de Livros
 * (`banco-padrao.ts`, um clique) — ou `ia`, gerado a partir de disciplina, tema
 * e assunto e revisado pela professora.
 */
export const ORIGENS_DO_PACOTE = ["padrao", "ia"] as const;
export type OrigemDoPacote = (typeof ORIGENS_DO_PACOTE)[number];

/**
 * As disciplinas do preparo. O sheet de copy trazia quatro opções
 * ("Língua Portuguesa, Ciências/Biologia, História/Geografia ou Projeto
 * Interdisciplinar"), mas os slugs dele não existem no catálogo da plataforma.
 * Vale a regra das outras missões (Júri, Quem mandou isso?): TODO o 3º ano da
 * matriz (`curriculo/componentes.ts#componentesDoAno("3EF")`, na ordem do
 * catálogo), mais Computação e o projeto interdisciplinar no fim — o teste
 * confere a lista contra o catálogo. Só se ACRESCENTA valor (o CHECK da
 * migração repete a lista).
 */
export const DISCIPLINAS = [
  "lingua-portuguesa",
  "arte",
  "educacao-fisica",
  "matematica",
  "ciencias",
  "geografia",
  "historia",
  "ensino-religioso",
  "computacao",
  "projeto-interdisciplinar",
] as const;
export type Disciplina = (typeof DISCIPLINAS)[number];

/** Os rótulos são os do catálogo de componentes (`curriculo/componentes.ts`); o teste confere. */
export const ROTULO_DA_DISCIPLINA: Readonly<Record<Disciplina, string>> = {
  "lingua-portuguesa": "Língua Portuguesa",
  arte: "Arte",
  "educacao-fisica": "Educação Física",
  matematica: "Matemática",
  ciencias: "Ciências",
  geografia: "Geografia",
  historia: "História",
  "ensino-religioso": "Ensino Religioso",
  computacao: "Computação",
  "projeto-interdisciplinar": "Projeto Interdisciplinar",
};

/**
 * As IMAGENS de um pacote, por chave: uma por reportagem e a do cartaz comum
 * da feira (o que a criança toca no Modal da E1). As cenas fixas do banco
 * padrão (o caso novo e o Desafio Extra) têm chaves próprias em
 * `CHAVES_DAS_CENAS_FIXAS` e só o `admin` as gera.
 */
export const CHAVES_DAS_IMAGENS = ["mural", "portal", "telao", "cartaz"] as const;
export type ChaveDaImagem = (typeof CHAVES_DAS_IMAGENS)[number];

export const CHAVES_DAS_CENAS_FIXAS = ["caso-a", "caso-b", "extra-1", "extra-2"] as const;
export type ChaveDaCenaFixa = (typeof CHAVES_DAS_CENAS_FIXAS)[number];

// ------------------------------------------------------- os tempos

/** E1: com a foto aberta, 20 s sem tocar o cartaz → o cartaz pulsa. */
export const PULSO_DA_GALERIA_MS = 20_000;
/** E4-01: 15 s sem abrir a ficha → "Inspecionar Ficha" pulsa (e `dica_inspecao_usada`). */
export const PULSO_DA_INSPECAO_MS = 15_000;
/** O estudante pergunta o portão (`GET gate`) a cada 3 s. */
export const POLLING_DO_GATE_MS = 3_000;
/** O painel da professora se atualiza a cada 5 s. */
export const POLLING_DO_PAINEL_MS = 5_000;
/** A simulação da rotina válida (contador 3 → 0) dura ~1,8 s na tela. */
export const SIMULACAO_DA_ROTINA_MS = 1_800;

/**
 * A versão do instrumento gravada em cada sessão (reprocessamento posterior).
 * 1.0.0 (2026-10-28): a primeira, sem o Canal B (spec §0.1) e com o reparo de
 * três campos vazios (spec §7.6).
 */
export const VERSAO_DO_INSTRUMENTO = "1.0.0";
