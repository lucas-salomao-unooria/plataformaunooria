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

/**
 * OS TERMOS DE USO DA ENTRADA (ADR-179): o texto jurídico denso que o
 * estudante "aceita" antes do feed, como num app real. As 5 cláusulas do 6b
 * estão ENTERRADAS nele, com as mesmas palavras, entre parágrafos de praxe —
 * o caminho mais fácil é pular, e é esse o comportamento esperado. Cada
 * entrada é um parágrafo; `{c1}`…`{c5}` são as cláusulas, no lugar delas.
 */
export const TERMOS_DA_ENTRADA = [
  "1. ACEITAÇÃO. Ao acessar ou utilizar o Unoovista (\"Serviço\"), o Usuário declara ter lido, compreendido e aceitado integralmente estes Termos de Uso e a Política de Privacidade, que os integra para todos os fins, ressalvadas as disposições específicas aplicáveis a funcionalidades disponibilizadas em caráter experimental, que poderão ser alteradas ou descontinuadas a qualquer tempo, independentemente de aviso prévio.",
  "2. CONTA. O Usuário é o único responsável pela guarda de suas credenciais e por todas as atividades realizadas a partir de sua conta, comprometendo-se a manter atualizados os dados cadastrais e a comunicar imediatamente qualquer uso não autorizado. 2.1. {c1}",
  "3. CONTEÚDO. O Usuário concede ao Unoovista licença não exclusiva, gratuita, mundial e transferível para hospedar, reproduzir, adaptar, distribuir e exibir o conteúdo que publicar, na medida necessária à operação, à melhoria e à promoção do Serviço, sem prejuízo dos direitos morais do autor nos termos da legislação aplicável. 3.1. {c2}",
  "4. FUNCIONAMENTO DO SERVIÇO. O Unoovista poderá, a seu exclusivo critério e sem obrigação de aviso, alterar recursos, layout, limites de uso e quaisquer funcionalidades, bem como realizar testes com grupos de Usuários para avaliação de novas versões. 4.1. {c3} 4.2. O Serviço é fornecido \"no estado em que se encontra\", sem garantias de disponibilidade ininterrupta ou de adequação a finalidade específica.",
  "5. VERIFICAÇÃO E SEGURANÇA. Para prevenir fraudes, spam e uso indevido, o Unoovista poderá adotar medidas técnicas e organizacionais, incluindo a análise automatizada de padrões de uso. 5.1. {c4} 5.2. Contas que violem estes Termos poderão ser suspensas ou encerradas, a qualquer tempo, independentemente de notificação.",
  "6. DADOS E RETENÇÃO. O tratamento de dados pessoais observa a legislação aplicável e a Política de Privacidade. 6.1. {c5} 6.2. Determinados registros poderão ser mantidos por prazos superiores para cumprimento de obrigação legal ou regulatória, exercício regular de direitos ou prevenção de fraudes.",
  "7. DISPOSIÇÕES GERAIS. A tolerância quanto ao descumprimento de qualquer obrigação não implica renúncia ou novação. Estes Termos poderão ser atualizados periodicamente, e o uso continuado do Serviço após a publicação de nova versão implicará concordância com as alterações.",
] as const;

/** O texto da entrada com as cláusulas no lugar — o que a tela recebe. */
export function termosDaEntrada(): string[] {
  const porId = new Map<string, string>(CLAUSULAS.map((c) => [c.id, c.texto]));
  return TERMOS_DA_ENTRADA.map((p) => p.replace(/\{(c[1-5])\}/g, (_, id: string) => porId.get(id)!));
}

// ── 6c Mandar pra quem não viu ───────────────────────────────────────────

/** As quatro mensagens prontas. O tipo é o gabarito: fica no servidor. */
export const MENSAGENS = [
  {
    id: "m1",
    tipo: "aviso",
    texto: "Isso é só uma parte. Aqui cada um vê coisas diferentes, então procura mais antes de decidir.",
  },
  {
    id: "m2",
    tipo: "neutra",
    texto: "Separei uns posts sobre o assunto. Dá uma olhada e depois me fala o que achou.",
  },
  {
    id: "m3",
    tipo: "encerra",
    texto: "Com esses posts dá pra ver quem tem razão. Nem precisa procurar mais.",
  },
  {
    id: "m4",
    tipo: "ridiculariza",
    texto: "Separei uns posts. Olha só a bobagem que o outro lado anda espalhando.",
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
