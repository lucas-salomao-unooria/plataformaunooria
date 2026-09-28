export interface AiRequest {
  system: string;
  user: string;
  maxTokens?: number;
  /**
   * Família de modelo, neutra de vendor. `padrao` é o modelo do dia a dia
   * (reações ao vivo, tutor); `longo` é o modelo com janela de SAÍDA grande —
   * planos anuais, relatórios — que o provider mapeia para outro modelo
   * (`VERTEX_MODEL_LONGO`). Quem chama não sabe qual modelo é.
   */
  modelo?: "padrao" | "longo";
  temperatura?: number;
}
export interface AiResult {
  texto: string;
  tokensUsados: number;
  /** Tokens do prompt e da resposta, quando o vendor os separa (`usageMetadata`).
   *  Só a métrica lê; a quota continua em `tokensUsados`. */
  tokensEntrada?: number;
  tokensSaida?: number;
  /** Por que o modelo parou: `STOP` (natural) ou outro motivo do vendor
   *  (`MAX_TOKENS`, `SAFETY`...). Aditivo: quem não liga, ignora. */
  finishReason?: string;
  /** Quantas voltas de ferramenta a conversa deu, e em que tentativa parou.
   *  Só `conversar()` preenche — existe para o log medir o turno em vez de
   *  lembrar dele ("a IA responde muita coisa" continua sendo impressão sem
   *  número). `generate`/`generateJson` deixam ausente. */
  voltas?: number;
  tentativas?: number;
}

/**
 * Schema de resposta estruturada NEUTRO de vendor (subconjunto de JSON Schema:
 * object/array/string/number/boolean). Cada provider traduz para o formato do
 * seu modelo — nenhum módulo fora de `src/ai` conhece o vendor.
 */
export interface AiJsonSchema {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, AiJsonSchema>;
  items?: AiJsonSchema;
  required?: string[];
  enum?: string[];
  /**
   * Descrição do campo, repassada ao modelo. Não é comentário de código: numa
   * DECLARAÇÃO DE FERRAMENTA é por aqui que o modelo descobre o que pode
   * mandar ("bairro de destino: ribeirinha, valeverde, morroalto ou
   * industrial"). Sem ela o modelo chuta o valor do argumento.
   */
  description?: string;
}

export interface AiJsonRequest<T> {
  prompt: string;
  system?: string;
  responseSchema: AiJsonSchema;
  /** Valida e normaliza a saída; lançar erro faz a tentativa ser regerada. */
  validar: (bruto: unknown) => T;
  temperatura?: number;
  tentativas?: number;
  /**
   * Teto de saída. Ausente = o teto do modelo. Existe pelo mesmo motivo que em
   * `AiRequest`, e aqui o sintoma é pior: JSON estruturado longo (uma quinzena
   * de aulas passa de 9k tokens) trunca no meio, e JSON truncado não chega
   * como `MAX_TOKENS` legível — chega como `JSON.parse` falhando três vezes.
   */
  maxTokens?: number;
  /** Mesma família neutra de `AiRequest.modelo`. */
  modelo?: AiRequest["modelo"];
  /**
   * Quanto o vendor cobrou, chamado UMA VEZ POR TENTATIVA — inclusive pelas que
   * `validar` rejeitou: elas foram pagas igual, e quem tem teto diário precisa
   * contar o que foi pago (mesma regra do `tokensUsados` de `conversar`).
   *
   * É opcional porque `generateJson` devolve `T` e nem todo consumidor tem
   * quota. **Mas quem chama `QuotaService.temSaldo` TEM de passar isto** — sem
   * ele não há de onde tirar o número, e a alternativa é o que o repo fazia:
   * a app-92 não debitava nada e a exp07ef1b debitava 1.500 fixo, chute que não
   * acompanha prompt nem modelo. Ver ADR-74.
   */
  aoUsarTokens?: (tokens: number) => void;
}

/**
 * Uma ferramenta que o modelo pode chamar no meio da conversa. NEUTRA de
 * vendor: `parametros` reusa o `AiJsonSchema` acima, e cada provider traduz.
 *
 * Existe porque há experiência em que **nenhum número pode sair da LLM**: o
 * valor vem de um motor determinístico e o modelo só narra o que a ferramenta
 * devolveu. Sem isto, a alternativa era a experiência falar com o vendor por
 * fora — proibido (só `src/ai` conhece o vendor).
 */
export interface AiFerramenta {
  nome: string;
  descricao: string;
  parametros: AiJsonSchema;
}

export interface AiConversaRequest {
  system: string;
  /** A conversa até aqui, em ordem. `estudante` é quem fala com o modelo. */
  historico: Array<{ papel: "estudante" | "agente"; texto: string }>;
  ferramentas?: {
    declaracoes: AiFerramenta[];
    /** Executa a ferramenta e devolve o resultado que volta ao modelo. */
    executar: (nome: string, argumentos: Record<string, unknown>) => Promise<unknown>;
  };
  /**
   * Motivos para RECUSAR a resposta (vazio = aceita). Um motivo derruba a
   * tentativa e o modelo tenta de novo **sabendo por quê** — o reforço entra no
   * prompt da tentativa seguinte. As regras são do domínio (termo proibido,
   * número sem ferramenta ter rodado, resposta longa demais); o laço é daqui.
   */
  validar?: (texto: string) => string[];
  /**
   * O que pedir na ÚLTIMA tentativa, quando as anteriores foram rejeitadas.
   * A última baixa a exigência de propósito: insistir na mesma instrução só
   * repete o erro. Vazio cai num socorro genérico.
   */
  socorro?: string;
  maxTokens?: number;
  temperatura?: number;
  /** Teto de idas e voltas de ferramenta num turno (default 6). */
  maxVoltas?: number;
  /** Tentativas com reforço do erro anterior (default 3). */
  tentativas?: number;
}

/**
 * Proporção da imagem, neutra de vendor. Opcional porque a exp08ef1b — a única
 * consumidora até aqui — depende do 4:5 que o `AssetsService` normaliza; quem
 * precisa de outro formato pede, e não recorta depois (o recorte joga fora a
 * composição que o modelo decidiu para o formato errado).
 */
export type AiProporcao = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9";

export interface AiImagemOpcoes {
  proporcao?: AiProporcao;
}

/**
 * Timbre de voz, NEUTRO de vendor — pelo mesmo motivo de `modelo` em
 * `AiRequest`: quem pede a fala descreve QUEM fala, não o nome de catálogo de
 * uma voz do Google. Cada provider mapeia para o seu catálogo, e trocar de
 * vendor não obriga a reescrever o roteiro de nenhuma experiência.
 */
export type AiTimbre =
  | "jovem-feminino"
  | "jovem-masculino"
  | "adulto-feminino"
  | "adulto-masculino"
  | "idoso-feminino"
  | "idoso-masculino";

export interface AiFalante {
  /** Como o roteiro chama esta pessoa. Casa com `turnos[].falante`. */
  nome: string;
  timbre: AiTimbre;
}

/**
 * Uma fala para sintetizar. `texto` para monólogo; `turnos` para diálogo — e o
 * diálogo é UMA chamada, não a costura de duas: o modelo multi-falante ajusta
 * pausa, sobreposição e entonação entre as vozes, e concatenar arquivos
 * separados devolveria duas leituras em voz alta em vez de uma conversa.
 *
 * `direcao` é direção de atuação em linguagem natural ("tom assustado, voz
 * trêmula, como quem acabou de receber uma notícia ruim"). É o que transforma
 * um TTS em interpretação — e é onde o brief de assets é cumprido.
 */
export interface AiSpeechRequest {
  texto?: string;
  turnos?: Array<{ falante: string; texto: string }>;
  falantes: AiFalante[];
  direcao?: string;
  /** BCP-47. Default `pt-BR`. */
  idioma?: string;
}

export class ErroDeGeracao extends Error {
  constructor(
    message: string,
    readonly detalhe?: string,
  ) {
    super(message);
    this.name = "ErroDeGeracao";
  }
}

/** Token de injeção do provider (registrado no AiModule por AI_PROVIDER env). */
export const AI_PROVIDER = "AI_PROVIDER";

export interface AiProvider {
  generate(req: AiRequest): Promise<AiResult>;
  /** Saída JSON estruturada com retry + reforço do erro anterior no prompt. */
  generateJson<T>(req: AiJsonRequest<T>): Promise<T>;
  /** Geração de imagem: devolve os bytes originais (jpeg/png) do modelo.
   *  Falha → quem chama cai no fallback procedural (imageStatus "fallback"). */
  generateImage(prompt: string, opcoes?: AiImagemOpcoes): Promise<Buffer>;
  /** Fala sintetizada: devolve MP3. Falha → quem chama cai na transcrição. */
  generateSpeech(req: AiSpeechRequest): Promise<Buffer>;
  /**
   * Conversa multi-turno com ferramentas. `tokensUsados` é a SOMA de todas as
   * voltas e de todas as tentativas, **inclusive as rejeitadas** — é o número
   * que foi pago, e é ele que um teto de custo por sessão precisa contar.
   */
  conversar(req: AiConversaRequest): Promise<AiResult>;
}
