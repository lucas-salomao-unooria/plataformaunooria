/**
 * O VOCABULÁRIO do Canal A da exp08ef1b (ADR-167): as três tarefas e o texto
 * fixo delas. Os GABARITOS moram aqui, na api (regra 3): o estudante recebe os
 * textos e os ids, nunca qual explica, qual efeito é o certo ou que nível cada
 * mensagem vale.
 *
 * O MESMO vocabulário dos CHECKs da migration `20261016180000_exp08ef1b_canal_a`
 * — `tests/motor-evidencia-postgres.spec.ts` compara os dois.
 */

export const TAREFAS = ["raio-x", "termos", "envio"] as const;
export type Tarefa = (typeof TAREFAS)[number];

/** O marcador da ficha que cada tarefa grava (`evidencias/fichas/exp08ef1b.ts`). */
export const MARCADOR_DA_TAREFA = {
  "raio-x": "raio-x",
  termos: "termos",
  envio: "envio",
} as const satisfies Record<Tarefa, string>;

/** O envio numa atividade sem fofoca ou humor nos dois lados, só na casa que a trava muda. */
export const MARCADOR_DO_ENVIO_LIMITADO = "envio-sem-confiabilidade";

/** A reflexão lida pela IA. */
export const MARCADOR_DA_REFLEXAO = "reflexao";

// ── 6a Raio-x ────────────────────────────────────────────────────────────

/** O que o estudante diz de cada post: puxa para A, para B, ou informa. */
export const OPCOES_DO_RAIO_X = ["A", "B", "neutro"] as const;
export type OpcaoDoRaioX = (typeof OPCOES_DO_RAIO_X)[number];

// ── 6b Os termos ─────────────────────────────────────────────────────────

/**
 * As cinco cláusulas, fictícias, iguais para todos e NESTA ordem. `explica`
 * e `efeito` são o gabarito: ficam no servidor.
 */
export const CLAUSULAS = [
  {
    id: "c1",
    texto: "Registramos suas curtidas, salvamentos, comentários e o tempo que você passa em cada publicação.",
    explica: true,
    efeito: "e1",
  },
  {
    id: "c2",
    texto: "Você pode desligar os avisos de novas curtidas e comentários a qualquer momento.",
    explica: false,
    efeito: null,
  },
  {
    id: "c3",
    texto: "Usamos o seu histórico de interações para escolher quais publicações você vê e em que ordem.",
    explica: true,
    efeito: "e2",
  },
  {
    id: "c4",
    texto: "Um algoritmo confere se cada perfil com selo de verificado pertence mesmo a quem diz ser.",
    explica: false,
    efeito: null,
  },
  {
    id: "c5",
    texto: "Guardamos o histórico das suas interações no app enquanto a sua conta existir.",
    explica: true,
    efeito: "e3",
  },
] as const;
export type ClausulaId = (typeof CLAUSULAS)[number]["id"];
export const IDS_DAS_CLAUSULAS = CLAUSULAS.map((c) => c.id) as readonly ClausulaId[];

/** As três opções de efeito, as mesmas para toda cláusula marcada. */
export const EFEITOS = [
  { id: "e1", texto: "Cada toque e cada pausa minha virou informação para o app." },
  { id: "e2", texto: "Os posts de um lado chegaram muito mais que os do outro." },
  { id: "e3", texto: "O que eu fiz no começo continuou pesando até o fim." },
] as const;
export type EfeitoId = (typeof EFEITOS)[number]["id"];
export const IDS_DOS_EFEITOS = EFEITOS.map((e) => e.id) as readonly EfeitoId[];

/** A mudança que daria mais controle: só uma é o julgamento crítico. */
export const MUDANCAS = [
  {
    id: "controle",
    texto: "Mostrar por que cada post aparece e deixar desligar a personalização do feed.",
  },
  {
    id: "forma",
    texto: "Escrever os termos com letra maior e frases mais curtas, para facilitar a leitura.",
  },
  {
    id: "aceitacao",
    texto: "Nenhuma: quem aceitou os termos já concordou com tudo o que está escrito.",
  },
] as const;
export type MudancaId = (typeof MUDANCAS)[number]["id"];
export const IDS_DAS_MUDANCAS = MUDANCAS.map((m) => m.id) as readonly MudancaId[];

// ── 6c Mandar pra quem não viu ───────────────────────────────────────────

/** As quatro mensagens prontas. O tipo é o gabarito: fica no servidor. */
export const MENSAGENS = [
  {
    id: "m1",
    tipo: "aviso",
    texto: "Isso é só um pedaço: aqui cada um recebe coisas diferentes. Vale procurar mais antes de decidir.",
  },
  {
    id: "m2",
    tipo: "neutra",
    texto: "Separei uns posts sobre o assunto. Dá uma olhada quando puder e depois me conta o que achou.",
  },
  {
    id: "m3",
    tipo: "encerra",
    texto: "Esses posts resolvem a questão. Com eles você já sabe quem tem razão, nem precisa ver mais.",
  },
  {
    id: "m4",
    tipo: "ridiculariza",
    texto: "Separei uns posts. Repara no tamanho da bobagem que o outro lado anda espalhando por aí.",
  },
] as const;
export type MensagemId = (typeof MENSAGENS)[number]["id"];
export type TipoDeMensagem = (typeof MENSAGENS)[number]["tipo"];
export const IDS_DAS_MENSAGENS = MENSAGENS.map((m) => m.id) as readonly MensagemId[];

/** Até 140 caracteres na frase opcional do envio — o CHECK da migration diz o mesmo. */
export const FRASE_DO_ENVIO_MAX = 140;

/** Quantos posts o envio aceita. A seleção vazia não é aceita. */
export const POSTS_DO_ENVIO_MAX = 3;

/** Os tipos de autor que a confiabilidade cobra: página de fofoca ou de humor. */
export const TIPOS_SEM_CONFIABILIDADE = ["fofoca_tema", "humor"] as const;
export function ehFofocaOuHumor(tipo: string | null | undefined): boolean {
  return (TIPOS_SEM_CONFIABILIDADE as readonly string[]).includes(tipo ?? "");
}

/** O neutro SOBRE o tema (o fora do tema — lanche, bicho, escola — nunca entra). É a categoria que a geração grava. */
export { CATEGORIA_NEUTRO_NO_TEMA as CATEGORIA_DO_NEUTRO_NO_TEMA } from "../../geracao/plano";
