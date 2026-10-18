import type { Nivel } from '../../evidencias/regras';

/**
 * A LIGAÇÃO DA SECRETARIA DE SAÚDE (EM13CO26, ADR-172). PURO.
 *
 * Aparece na investigação, no primeiro destino escolhido ou ao abrir a decisão
 * — o que vier antes. O grupo decide o que pedir de dados de terceiros, como
 * quem trata o dado. A régua:
 *
 * | Opção | Nível |
 * | --- | --- |
 * | só a contagem, sem nomes | em desenvolvimento (TETO deste marcador) |
 * | as três outras | não demonstra |
 * | fechou o cartão sem responder | sem marca |
 *
 * O teto em "em desenvolvimento" é a própria régua, e NÃO `limitadoPelaAtividade`:
 * um clique entre 4 acerta 1 vez em 4 ao acaso, e, como entre os marcadores da
 * EM13CO26 vale o melhor, esse clique daria "demonstra" na habilidade inteira por
 * sorte. O "demonstra" fica com a resposta à moradora.
 */
export const TEXTO_DA_SAUDE =
  'A Secretaria de Saúde pode mandar agora dados sobre pessoas com deficiência ou mobilidade reduzida, para você escolher os bairros. O que você pede?';

export const OPCOES_DA_SAUDE = [
  { id: 'contagem', texto: 'Só o número dessas pessoas em cada bairro, sem nomes', nivel: 'em_processo' },
  { id: 'lista-completa', texto: 'A lista com nome, endereço e condição de cada pessoa', nivel: 'nao_atingiu' },
  { id: 'lista-apagada', texto: 'A lista com nome e endereço, apagada depois da chuva', nivel: 'nao_atingiu' },
  { id: 'nada', texto: 'Nada: dado de saúde é sensível demais para pedir', nivel: 'nao_atingiu' },
] as const satisfies readonly { id: string; texto: string; nivel: Nivel }[];

export type OpcaoDaSaude = (typeof OPCOES_DA_SAUDE)[number]['id'];
export const IDS_DA_SAUDE = OPCOES_DA_SAUDE.map((o) => o.id) as [OpcaoDaSaude, ...OpcaoDaSaude[]];

/**
 * A CONTAGEM que a Saúde manda (aval do PO, 16/10). Usa a mesma base de
 * endereços do cadastro de 9 anos atrás, então o Morro Alto aparece com menos da
 * metade — a contagem não corrige viés nenhum de graça, e não mexe no modelo
 * nem no podcast. O Cientista não a comenta (`agente/prompt.ts`).
 */
export const CONTAGEM_DA_SAUDE = [
  { bairro: 'ribeirinha', pessoas: 2150 },
  { bairro: 'valeverde', pessoas: 980 },
  { bairro: 'morroalto', pessoas: 850 },
  { bairro: 'industrial', pessoas: 190 },
] as const;

const TOTAL = CONTAGEM_DA_SAUDE.reduce((a, b) => a + b.pessoas, 0);
/** "4.170": o separador de milhar sem depender do ICU do Node. */
const milhar = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** O que chega ao grupo: uma CONSEQUÊNCIA, nunca um julgamento. */
export function entregaDaSaude(opcao: OpcaoDaSaude): {
  contagem: { bairro: string; pessoas: number }[] | null;
  aviso: string | null;
} {
  if (opcao === 'nada') return { contagem: null, aviso: null };
  const contagem = CONTAGEM_DA_SAUDE.map((c) => ({ ...c }));
  if (opcao === 'contagem') return { contagem, aviso: null };
  return {
    contagem,
    aviso: `Chegaram nomes e endereços de ${milhar(TOTAL)} pessoas, que agora ficam no sistema.`,
  };
}

export function nivelDaSaude(opcao: OpcaoDaSaude | null): Nivel | null {
  if (opcao === null) return null;
  return OPCOES_DA_SAUDE.find((o) => o.id === opcao)?.nivel ?? null;
}
