/**
 * O tamanho de uma resposta do Cientista. PURO — sem provedor, sem Prisma.
 *
 * O playtest mostrou o aluno recebendo, a cada turno, uma parede: a prosa da
 * LLM listando quatro bairros com faixa e pessoas, MAIS a tabela dos seis, MAIS
 * dois avisos de empate repetidos palavra por palavra. Ele respondeu "num
 * intindi" e depois parou de ler.
 *
 * O prompt já dizia "no máximo 4 frases" — uma linha, perdida entre trinta e
 * cinco regras duras que pediam duas ou três alternativas, faixa junto de todo
 * número e a discordância entre fontes "com todas as letras". Instrução sozinha
 * não segura tamanho; medir, sim.
 */

/**
 * Frases de um texto. Quebra em `.`, `!`, `?` e em quebra de linha — o Cientista
 * escreve listas com hífen, e cada linha dessas conta como uma frase para quem
 * está lendo.
 */
export function contarFrases(texto: string): number {
  return texto.split(/[.!?]+(?:\s|$)|\n+/).filter((t) => t.trim().length > 0).length;
}

/**
 * Teto de tamanho da resposta, em caracteres.
 *
 * Medido na parede do playtest: a fala que fez o aluno parar de ler tinha ~640
 * caracteres de prosa ANTES do cartão com a tabela dos seis bairros. Em 450 cabe
 * uma frase de contexto, dois bairros com número e a pergunta de volta — que é
 * a forma que o protocolo de turno pede.
 */
export const TETO_DE_CARACTERES = 450;

/** Teto de frases. Quatro é o que o prompt promete; a quinta é folga. */
export const TETO_DE_FRASES = 5;

/**
 * Quantos bairros a PROSA pode citar quando o quadro já está na tela.
 *
 * O defeito que isto persegue é a RECITAÇÃO DA TABELA: o Cientista listando
 * bairro por bairro com o número de cada um, acima de um cartão que já mostra
 * exatamente isso.
 *
 * Citar quatro bairros, por si, não é o defeito — é o que a proposta de duas
 * alternativas faz por definição ("Alfa para X e Bravo para Y, ou Alfa para W e
 * Bravo para Z"). A primeira versão desta guarda rejeitava justamente essa
 * resposta, que é a que o protocolo de delegação PEDE. O que separa uma da
 * outra é o número colado em cada bairro.
 */
export const TETO_DE_BAIRROS_NA_PROSA = 2;

/** A partir de quantos números a citação de bairros vira recitação de tabela. */
export const NUMEROS_QUE_VIRAM_TABELA = 3;

/**
 * O que está errado com o TAMANHO desta resposta, em português para o modelo.
 *
 * Devolve motivos, não booleano: eles viram o reforço da tentativa seguinte
 * (o retry que aprende, em lib/agente/cliente.ts). Instrução sozinha não segurou
 * o tamanho — "no máximo 4 frases" era uma linha entre trinta e cinco regras.
 */
export function problemasDeTamanho(
  texto: string,
  ctx: { rodouModelo: boolean; nomesDeBairro: readonly string[] },
): string[] {
  const problemas: string[] = [];

  if (texto.length > TETO_DE_CARACTERES) {
    problemas.push(
      `sua resposta tem ${texto.length} caracteres e o limite é ${TETO_DE_CARACTERES}. Corte pela metade: uma frase de contexto, o essencial, e a pergunta de volta`,
    );
  }

  const frases = contarFrases(texto);
  if (frases > TETO_DE_FRASES) {
    problemas.push(
      `você escreveu ${frases} frases e o limite é ${TETO_DE_FRASES}. Cada linha de lista conta como uma`,
    );
  }

  if (ctx.rodouModelo) {
    const alvo = texto.toLowerCase();
    const citados = ctx.nomesDeBairro.filter((n) => alvo.includes(n.toLowerCase()));
    // "Opção 1" e "Opção 2" são rótulo, não dado: contá-los faria a proposta de
    // duas alternativas parecer uma tabela.
    const semRotulos = texto.replace(/op[çc][ãa]o\s*\d/gi, '');
    const numeros = semRotulos.match(/\d[\d.,]*/g) ?? [];
    if (citados.length > TETO_DE_BAIRROS_NA_PROSA && numeros.length >= NUMEROS_QUE_VIRAM_TABELA) {
      problemas.push(
        `você citou ${citados.length} bairros com número em cada um, e o quadro ao lado da sua fala já mostra a tabela inteira. Aponte no máximo ${TETO_DE_BAIRROS_NA_PROSA} bairros e mande ele olhar o quadro`,
      );
    }
  }

  return problemas;
}
