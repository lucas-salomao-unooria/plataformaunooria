/**
 * Como o professor LÊ um desfecho gravado. PURO: sem Prisma, sem React.
 *
 * As duas contas vivem aqui, e não na tela, pelo mesmo motivo de
 * `leitura.ts`: decidida no componente, a primeira tela nova esquece — e o
 * esquecimento é silencioso. O cliente da experiência tem a própria cópia da
 * cobertura para animar o mapa; esta é a que vai ao relatório.
 */

export interface DesfechoGravado {
  porBairro: { emRisco: number; equipe: string | null }[];
  totais: { emRisco: number; salvas: number };
}

/**
 * Onde estava o risco da cidade, e quanto dele os dois bairros escolhidos
 * cobriam — em porcentagem inteira. É a medida da DECISÃO: a sorte da rodada
 * mexe no resgate, não nisto. `null` quando não havia risco (divisão por zero
 * não vira 0%: é ausência, não zero).
 */
export function coberturaDoRisco(desfecho: DesfechoGravado): number | null {
  if (desfecho.totais.emRisco <= 0) return null;
  const atendido = desfecho.porBairro
    .filter((b) => b.equipe !== null)
    .reduce((soma, b) => soma + b.emRisco, 0);
  return Math.round((atendido / desfecho.totais.emRisco) * 100);
}

export interface FaixaEsperada {
  media: number;
  faixa: readonly [number, number];
  amostras: readonly number[];
  /** Percentil do resgate real entre TODAS as corridas, gravado no confirmar. */
  percentil?: number | null;
}

export interface PosicaoNaFaixa {
  /** 0–100: quantas corridas da mesma decisão renderam MENOS ou igual. */
  percentil: number;
  /** Dentro de [p10, p90]? Fora é sorte (ou azar) visível. */
  dentroDaFaixa: boolean;
  acimaDaMedia: boolean;
}

/**
 * Onde o resgate real caiu na faixa da mesma decisão.
 *
 * Usa o percentil gravado quando existe (200 corridas). Sem ele, cai nas
 * amostras que a tela do estudante também vê — grosso (passos de 5%), mas
 * honesto: é o mesmo conjunto que o estudante teve na frente.
 */
export function posicaoNaFaixa(salvas: number, esperado: FaixaEsperada): PosicaoNaFaixa {
  const percentil =
    esperado.percentil ?? percentilEntre(salvas, esperado.amostras);
  return {
    percentil,
    dentroDaFaixa: salvas >= esperado.faixa[0] && salvas <= esperado.faixa[1],
    acimaDaMedia: salvas >= esperado.media,
  };
}

/** Fração (0–100, inteira) das corridas com resgate menor ou igual ao real. */
export function percentilEntre(valor: number, corridas: readonly number[]): number {
  if (corridas.length === 0) return 0;
  const abaixo = corridas.filter((c) => c <= valor).length;
  return Math.round((abaixo / corridas.length) * 100);
}
