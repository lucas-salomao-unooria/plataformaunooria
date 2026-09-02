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
      dados: {
        salvas: number;
        vitimas: number;
        emRisco: number;
        naoConsultados: string[];
        /**
         * Por que cada equipe foi para lá, como o professor lê. Vive AQUI porque
         * `reiniciar` zera as justificativas da sessão: sem a cópia no envio, a
         * justificativa da tentativa 1 sumia no instante em que a 2 começava.
         */
        justificativas: { alfa: string; bravo: string };
      };
    }
  /** Entrou na Investigação. É de onde se mede "quanto demorou até falar". */
  | { tipo: 'inicio'; minuto: number; dados: Record<string, never> }
  /**
   * Clicou em Recomeçar (na Investigação) ou Tentar de novo (no Resultado). Fica
   * na tentativa que FECHA, como o último marco dela. `fase` e `modo` são o
   * relógio da turma naquele instante — a única "liberação" que existe hoje:
   * o professor controla quando dá para falar, não se dá para recomeçar.
   */
  | {
      tipo: 'recomeco';
      minuto: number;
      dados: {
        origem: 'investigacao' | 'resultado' | null;
        fase: 'aguardando' | 'correndo' | 'encerrado';
        modo: 'cronometrado' | 'livre';
      };
    };

export type TipoDeMarco = Marco['tipo'];
export const TIPOS_DE_MARCO: readonly TipoDeMarco[] = [
  'fontes',
  'leitura',
  'alocacao',
  'envio',
  'inicio',
  'recomeco',
] as const;

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
  justificativas: { alfa: string; bravo: string },
): Marco {
  return {
    tipo: 'envio',
    minuto,
    dados: { ...totais, naoConsultados: naoConsultados.map(rotuloDe), justificativas },
  };
}

export function marcoDeInicio(minuto: number): Marco {
  return { tipo: 'inicio', minuto, dados: {} };
}

export function marcoDeRecomeco(
  minuto: number,
  dados: {
    origem: 'investigacao' | 'resultado' | null;
    fase: 'aguardando' | 'correndo' | 'encerrado';
    modo: 'cronometrado' | 'livre';
  },
): Marco {
  return { tipo: 'recomeco', minuto, dados };
}

/** O que a leitura precisa de um marco gravado: o tipo, a ordem e o payload. */
export interface MarcoGravado {
  tipo: string;
  ordem: number;
  dados: unknown;
}

/**
 * Quantas vezes a COMBINAÇÃO de destinos mudou antes do envio.
 *
 * Contar linhas de `alocacao` mente por dois motivos que o cliente produz: o
 * cartão de duas opções manda um POST por equipe (dois marcos para UMA
 * decisão), e justificar passa pela mesma rota com o mesmo bairro (um marco
 * sem mudança nenhuma). O que conta é o par `(alfa, bravo)` consecutivo
 * DISTINTO — e a primeira escolha não é mudança: mudar é sair de um destino
 * que existia. Marcos depois do `envio` não entram: a decisão já foi.
 */
export function mudancasDeDestino(marcos: readonly MarcoGravado[]): number {
  const ordenados = [...marcos].sort((a, b) => a.ordem - b.ordem);
  let anterior: string | null = null;
  let mudancas = 0;
  for (const m of ordenados) {
    if (m.tipo === 'envio') break;
    if (m.tipo !== 'alocacao') continue;
    const d = (m.dados ?? {}) as { alfa?: string | null; bravo?: string | null };
    const par = `${d.alfa ?? ''}|${d.bravo ?? ''}`;
    if (par === anterior) continue;
    if (anterior !== null && anterior !== '|') mudancas += 1;
    anterior = par;
  }
  return mudancas;
}
