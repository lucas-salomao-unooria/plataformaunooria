import type { RodadaDoModelo } from '../ferramentas';
import { CONJUNTO_POR_SLUG } from '../modelo/conjuntos';
import { MISSAO_TEMPESTADE } from '../cenario';

/**
 * Os quatro tipos de Marco e o que cada um guarda.
 *
 * PURO, e por isso testável: o que pode virar payload é decidido aqui, não na
 * camada de banco. Só entra dado que já é público na tela — viés, cobertura por
 * conjunto e parâmetro oculto ficam de fora, senão a Lacuna atravessaria a
 * fronteira pelo caminho mais silencioso que existe, um JSON de auditoria
 * (regra de ouro 1).
 */
export type Marco =
  | { tipo: 'fontes'; minuto: number; dados: { somadas: string[]; rotulos: string[] } }
  | {
      tipo: 'leitura';
      minuto: number;
      dados: {
        cobertura: number;
        topo: { bairro: string; nome: string; esperado: number; margem: number }[];
        efeito: { fonte: string; rotulo: string; bairro: string; de: number; para: number }[];
        conflitos: { bairro: string; nome: string }[];
        empates: string[][];
      };
    }
  | { tipo: 'alocacao'; minuto: number; dados: { alfa: string | null; bravo: string | null } }
  | {
      tipo: 'envio';
      minuto: number;
      dados: { salvas: number; vitimas: number; emRisco: number; naoConsultados: string[] };
    };

const nomeDe = (slug: string) =>
  MISSAO_TEMPESTADE.bairros.find((b) => b.slug === slug)?.nome ?? slug;
const rotuloDe = (slug: string) => CONJUNTO_POR_SLUG.get(slug)?.rotuloCurto ?? slug;

export function marcoDeFontes(minuto: number, somadas: string[]): Marco {
  return { tipo: 'fontes', minuto, dados: { somadas, rotulos: somadas.map(rotuloDe) } };
}

/**
 * Guarda só os três maiores: a trilha é para ler no debate, não para auditar.
 *
 * Defensivo de propósito. A rodada chega pela borda (ferramenta do agente) e
 * pode vir incompleta; um marco pobre é melhor que um turno perdido — a
 * conversa não pode quebrar porque a trilha não conseguiu se escrever.
 */
export function marcoDeLeitura(minuto: number, rodada: Partial<RodadaDoModelo>): Marco {
  return {
    tipo: 'leitura',
    minuto,
    dados: {
      cobertura: rodada.coberturaDaCidade ?? 0,
      topo: [...(rodada.estimativas ?? [])]
        .sort((a, b) => b.pessoasEmRisco.esperado - a.pessoasEmRisco.esperado)
        .slice(0, 3)
        .map((e) => ({
          bairro: e.bairro,
          nome: nomeDe(e.bairro),
          esperado: e.pessoasEmRisco.esperado,
          margem: Math.round((e.pessoasEmRisco.max - e.pessoasEmRisco.min) / 2),
        })),
      efeito: (rodada.efeito?.mudou ?? []).slice(0, 2).map((m) => ({
        fonte: rodada.efeito!.fonte,
        rotulo: rotuloDe(rodada.efeito!.fonte),
        bairro: nomeDe(m.bairro),
        de: m.de,
        para: m.para,
      })),
      conflitos: (rodada.conflitos ?? []).map((c) => ({
        bairro: c.bairro,
        nome: nomeDe(c.bairro),
      })),
      empates: (rodada.empates ?? []).map((g) => g.map(nomeDe)),
    },
  };
}

export function marcoDeAlocacao(
  minuto: number,
  alocacao: { alfa: string | null; bravo: string | null },
): Marco {
  return {
    tipo: 'alocacao',
    minuto,
    dados: {
      alfa: alocacao.alfa ? nomeDe(alocacao.alfa) : null,
      bravo: alocacao.bravo ? nomeDe(alocacao.bravo) : null,
    },
  };
}

export function marcoDeEnvio(
  minuto: number,
  totais: { salvas: number; vitimas: number; emRisco: number },
  naoConsultados: string[],
): Marco {
  return {
    tipo: 'envio',
    minuto,
    dados: { ...totais, naoConsultados: naoConsultados.map(rotuloDe) },
  };
}
