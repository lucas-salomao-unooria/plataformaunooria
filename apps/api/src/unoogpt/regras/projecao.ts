import type { BairroPublico } from './sanitizador';
import { CAPACIDADE_DA_EQUIPE } from '../modelo/parametros';
import { chegaATempo, eficienciaDoTempo } from '../modelo/tempestade';

/**
 * O que a decisão do estudante PROJETA — a partir do que ele enxerga, nunca da
 * verdade oculta.
 *
 * Este número sai das estimativas dos Conjuntos carregados, com o viés e a
 * faixa deles junto. Usar aqui a média real da simulação (esperadoDe) daria ao
 * estudante um placar antes da decisão: bastaria varrer as combinações e escolher a
 * maior, e a Missão passaria a ter resposta certa — que é exatamente o que ela
 * nega (ADR-0006).
 *
 * PURO: sem Prisma, sem Date.
 */
export interface Rota {
  equipe: 'alfa' | 'bravo';
  bairro: string | null;
  nome: string | null;
  minutos: number | null;
  passa: boolean;
  aviso: string | null;
}

export interface Projecao {
  rotas: Rota[];
  /** Pessoas com resposta priorizada, pela leitura atual. Null = sem dado nenhum. */
  atendidas: number | null;
  /**
   * A MENOR confiança entre os bairros escolhidos, como rótulo.
   *
   * Antes isto era média de pesos numéricos (alta = 0,85…) exibida como "85%",
   * uma precisão inventada — o tipo de número falso que a Missão inteira
   * combate. E é a pior das duas leituras que manda: decisão apoiada numa
   * estimativa fraca é uma decisão fraca, por melhor que seja a outra.
   */
  confianca: 'alta' | 'média' | 'baixa' | null;
  equipesOciosas: number;
  avisos: string[];
}

const ORDEM_DA_CONFIANCA = ['baixa', 'média', 'alta'] as const;

export function projetar(
  bairros: BairroPublico[],
  alocacao: { alfa: string | null; bravo: string | null },
  saidaEmMinutos: number,
  temTempos: boolean,
): Projecao {
  const equipes = ['alfa', 'bravo'] as const;
  const avisos: string[] = [];
  const confiancas: ('alta' | 'média' | 'baixa')[] = [];
  let atendidas = 0;
  let comDado = 0;

  const rotas: Rota[] = equipes.map((equipe) => {
    const slug = alocacao[equipe];
    const bairro = bairros.find((b) => b.slug === slug) ?? null;
    if (!slug || !bairro) {
      return { equipe, bairro: null, nome: null, minutos: null, passa: true, aviso: null };
    }

    const rota = chegaATempo(slug, equipe, saidaEmMinutos);
    // Os minutos só aparecem com o mapa de estradas carregado: sem ele, o
    // estudante não sabe quanto leva — e este painel não pode contar por fora.
    const minutos = temTempos ? (bairro.tempos?.[equipe] ?? null) : null;
    // Informação, não alarme: o painel diz a que horas a equipe chega e o que
    // já terá acontecido na cidade quando ela chegar.
    if (rota.motivo) avisos.push(`${bairro.nome}: ${rota.motivo}.`);

    if (bairro.estimativa) {
      comDado += 1;
      confiancas.push(bairro.estimativa.confianca);
      const alcance = Math.min(bairro.estimativa.pessoasEmRisco.esperado, CAPACIDADE_DA_EQUIPE);
      atendidas += Math.round(alcance * eficienciaDoTempo(rota.folga));
    } else {
      avisos.push(`${bairro.nome}: você não carregou nada que enxergue esse bairro.`);
    }

    return {
      equipe,
      bairro: slug,
      nome: bairro.nome,
      minutos,
      passa: rota.chegou,
      aviso: rota.motivo,
    };
  });

  const equipesOciosas = rotas.filter((r) => r.bairro === null).length;
  if (equipesOciosas > 0) {
    avisos.push(
      equipesOciosas === 2
        ? 'Nenhuma equipe tem destino: as duas ficam na base.'
        : 'Uma equipe está sem destino e fica na base.',
    );
  }

  const pior = confiancas.sort(
    (a, b) => ORDEM_DA_CONFIANCA.indexOf(a) - ORDEM_DA_CONFIANCA.indexOf(b),
  )[0];

  return {
    rotas,
    atendidas: comDado > 0 ? atendidas : null,
    confianca: pior ?? null,
    equipesOciosas,
    avisos,
  };
}
