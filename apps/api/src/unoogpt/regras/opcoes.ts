import { MISSAO_TEMPESTADE } from '../cenario';

/**
 * As alternativas de alocação que o Cientista põe na mesa. PURO.
 *
 * O prompt já obriga o Cientista a propor duas opções concretas e perguntar
 * qual o estudante quer — isso não é novo, e não é decidir por ele. O que é novo é
 * a proposta chegar ESTRUTURADA: dois pares de bairro, validados pelo servidor,
 * que viram dois botões. O estudante que escreveu "manda la" e "no melio" e viu o
 * relógio zerar não precisava de mais uma frase para digitar.
 *
 * A ferramenta NÃO aceita texto livre: nenhum número da LLM entra no cartão. O
 * que o botão mostra sai do motor, como todo número da Missão.
 */
export interface ParDeDestinos {
  alfa: string;
  bravo: string;
}

export type Opcoes = readonly [ParDeDestinos, ParDeDestinos];

/** Quantas opções cabem na mesa. Três já é menu; uma não é escolha. */
export const QUANTAS_OPCOES = 2;

const ehBairro = (slug: unknown): slug is string =>
  typeof slug === 'string' && MISSAO_TEMPESTADE.bairros.some((b) => b.slug === slug);

/**
 * Valida o que a ferramenta trouxe.
 *
 * `jaCruzou` é obrigatório: propor alocação antes de olhar dado nenhum é
 * chutar com cara de recomendação, e o estudante clicaria sem ter investigado —
 * que é exatamente a competência que a Missão treina.
 */
export function validarOpcoes(
  argumentos: Record<string, unknown>,
  ctx: { jaCruzou: boolean },
): { aceito: false; motivo: string } | { aceito: true; opcoes: Opcoes } {
  if (!ctx.jaCruzou) {
    return {
      aceito: false,
      motivo:
        'você ainda não carregou fonte nenhuma. Carregue com usar_dados antes de propor alocação: sem dado, opção é chute',
    };
  }

  const bruto = Array.isArray(argumentos.opcoes) ? argumentos.opcoes : [];
  const pares: ParDeDestinos[] = [];
  for (const item of bruto) {
    const o = item as Record<string, unknown>;
    const alfa = typeof o?.alfa === 'string' ? o.alfa.toLowerCase() : null;
    const bravo = typeof o?.bravo === 'string' ? o.bravo.toLowerCase() : null;
    if (!ehBairro(alfa) || !ehBairro(bravo)) continue;
    // Duas equipes no mesmo bairro não é alternativa, é desperdício de equipe.
    if (alfa === bravo) continue;
    if (pares.some((p) => p.alfa === alfa && p.bravo === bravo)) continue;
    pares.push({ alfa, bravo });
  }

  if (pares.length < QUANTAS_OPCOES) {
    return {
      aceito: false,
      motivo: `preciso de ${QUANTAS_OPCOES} opções diferentes, cada uma com um bairro para a Alfa e outro para a Bravo`,
    };
  }
  return { aceito: true, opcoes: [pares[0], pares[1]] as unknown as Opcoes };
}
