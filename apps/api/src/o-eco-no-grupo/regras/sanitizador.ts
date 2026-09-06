import { termosProibidosEm } from "../invariantes";

/**
 * O que uma fala escrita pelo modelo precisa cumprir para chegar à tela.
 *
 * Estas funções são o `validar` que o provider chama entre as tentativas: um
 * motivo derruba a tentativa e o modelo tenta de novo SABENDO por quê. Elas são
 * do domínio — o laço é de `src/ai`.
 *
 * Três regras, e nenhuma é estética:
 *
 * 1. **Teto de palavras.** O RNF de carga cognitiva do 7º ano é 35 palavras por
 *    balão de chat. Um parágrafo do modelo no meio do grupo não é só feio: é
 *    uma mensagem que ninguém escreveria num WhatsApp, e a ilusão cai.
 * 2. **Termos proibidos** (`invariantes.ts`): nada que quebre a ficção
 *    ("atividade", "professor") nem que rotule a criança ("fake news",
 *    "você errou").
 * 3. **Nada de gabarito.** O modelo recebe o desfecho para escrever a reação
 *    certa; ele não pode DIZER qual era a resposta certa, porque quem descobre
 *    isso é o estudante, olhando o print.
 */

/** Teto do balão de chat (RNF-USAB-001, 7º ano). */
export const PALAVRAS_POR_BALAO = 35;

/** Teto da fala de Amara no privado — ela conversa, mas não disserta. */
export const PALAVRAS_DE_AMARA = 60;

/** Teto da devolutiva do percurso, que é um parágrafo e não um relatório. */
export const PALAVRAS_DA_DEVOLUTIVA = 70;

function contarPalavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Frases que entregariam o mecanismo antes da hora. Não é lista de palavrão: é
 * a lista do que o modelo tende a dizer quando quer ser didático — e ser
 * didático aqui é estragar a descoberta.
 */
const ENTREGA_O_MECANISMO = [
  "resposta certa",
  "resposta correta",
  "opcao correta",
  "opção correta",
  "a alternativa",
  "voce deveria",
  "você deveria",
  "o correto seria",
];

function entregaOMecanismo(texto: string): string[] {
  const alvo = texto.toLowerCase();
  return ENTREGA_O_MECANISMO.filter((f) => alvo.includes(f));
}

/**
 * Pedaços do prompt de sistema. Se aparecerem na saída, o modelo ecoou a
 * instrução em vez de responder — e o prompt descreve o mecanismo da missão
 * (quem é quem, o que o print cortou, o que não pode ser dito). Publicá-lo na
 * tela seria a regra inviolável nº 2 pelo avesso: o segredo não vazaria pelo
 * bundle, vazaria pela resposta.
 *
 * Não é hipótese: com `AI_PROVIDER=mock` a devolutiva voltou sendo o começo do
 * próprio prompt, e o sanitizador a deixou passar.
 */
const MARCAS_DO_PROMPT = [
  "o cenário é um grupo",
  "regras de escrita",
  "as pessoas:",
  "você é a amara",
];

/**
 * `[mock]` NÃO entra nesta lista, e a ausência é deliberada: o `MockProvider`
 * é o único caminho de conversa em dev (`conversar` é o método que ele não
 * falha fechado, justamente para a experiência abrir sem Vertex), e barrar a
 * marca dele deixaria Amara muda na máquina de quem desenvolve. O eco do
 * prompt continua barrado pela primeira marca acima — que é o que importa.
 */

function ecoaOPrompt(texto: string): string[] {
  const alvo = texto.toLowerCase();
  return MARCAS_DO_PROMPT.filter((m) => alvo.includes(m));
}

function motivosComuns(texto: string, tetoDePalavras: number): string[] {
  const motivos: string[] = [];
  const palavras = contarPalavras(texto);
  if (palavras > tetoDePalavras) {
    motivos.push(`a fala tem ${palavras} palavras; o teto é ${tetoDePalavras}`);
  }
  const proibidos = termosProibidosEm(texto);
  if (proibidos.length > 0) {
    motivos.push(`usa termo que não pode aparecer na tela: ${proibidos.join(", ")}`);
  }
  const entrega = entregaOMecanismo(texto);
  if (entrega.length > 0) {
    motivos.push(`entrega o mecanismo da missão: ${entrega.join(", ")}`);
  }
  const eco = ecoaOPrompt(texto);
  if (eco.length > 0) {
    motivos.push(`ecoa a instrução em vez de responder: ${eco.join(", ")}`);
  }
  return motivos;
}

/** Uma mensagem de morador no grupo. */
export function validarFalaDoGrupo(texto: string): string[] {
  const motivos = motivosComuns(texto, PALAVRAS_POR_BALAO);
  // Ninguém no grupo do bairro escreve com marcação de texto.
  if (/[*_`#]/.test(texto)) motivos.push("usa marcação de texto; no chat ninguém escreve assim");
  return motivos;
}

/** Uma fala de Amara no chat privado, depois da decisão. */
export function validarFalaDeAmara(texto: string): string[] {
  return motivosComuns(texto, PALAVRAS_DE_AMARA);
}

/** O comentário formativo sobre o "Meu percurso". */
export function validarDevolutiva(texto: string): string[] {
  const motivos = motivosComuns(texto, PALAVRAS_DA_DEVOLUTIVA);
  // A devolutiva é sobre o que o estudante escolheu, não uma nota disfarçada.
  if (/\b\d+\s*(pontos?|%|de\s*\d+)\b/i.test(texto)) {
    motivos.push("traz pontuação; o percurso não é nota");
  }
  return motivos;
}
