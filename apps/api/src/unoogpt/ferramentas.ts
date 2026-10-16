import type { AiFerramenta } from '../ai/provider';
import { CONJUNTO_POR_SLUG } from './modelo/conjuntos';
import {
  coberturaDaCidade,
  conflitos,
  efeitoDe,
  empates,
  estimar,
  pontosCegos,
} from './modelo/estimativa';
import { sementeDe } from './modelo/aleatorio';

/**
 * A rodada do modelo — o que a FERRAMENTA devolve ao Cientista para ele narrar
 * (ADR-0006).
 *
 * Três invariantes, e eles são o produto:
 * - nunca número seco: tudo é min/esperado/max;
 * - nunca recomendação: há `tendencia` (ordenação), não `aloque aqui`;
 * - ponto cego é resposta: bairro sem cobertura entra em `pontosCegos`, e o
 *   Cientista precisa dizer que não sabe.
 */
export const MODELO = { nome: 'Sauá-1', versao: 1 } as const;

export function rodarModelo(
  sessaoId: string,
  rodada: number,
  conjuntos: readonly string[],
  /** A última fonte somada: rende a explicação do que mudou por causa dela. */
  fonteNova?: string,
) {
  const semente = sementeDe(`${sessaoId}:${rodada}`);
  const estimativas = estimar(conjuntos, semente);
  const visiveis = estimativas.filter((e) => e.cobertura > 0);

  return {
    modelo: MODELO.nome,
    conjuntos: conjuntos.map((s) => CONJUNTO_POR_SLUG.get(s)?.nome ?? s),
    coberturaDaCidade: coberturaDaCidade(estimativas),
    estimativas: visiveis,
    pontosCegos: pontosCegos(estimativas),
    // Onde as fontes discordam: vira cartão na conversa.
    conflitos: conflitos(conjuntos),
    // Bairros que a margem não separa: a ordem da tabela não é ranking.
    empates: empates(estimativas).map((g) => g.map((b) => b)),
    // O que a última fonte mudou, por subtração — não por narrativa. Sem
    // fonte declarada, vale a última somada: carregar e cruzar costumam ser
    // turnos diferentes, e a explicação não pode se perder no caminho.
    efeito: (() => {
      const alvo = fonteNova ?? (conjuntos.length > 1 ? conjuntos[conjuntos.length - 1] : null);
      if (!alvo) return null;
      const mudou = efeitoDe(conjuntos, alvo, semente).slice(0, 3);
      return mudou.length > 0 ? { fonte: alvo, mudou } : null;
    })(),
    // Ordenação por gente em risco. NÃO é recomendação de alocação: o modelo
    // não sabe onde a equipe chega, e nunca decide.
    tendencia: [...visiveis]
      .sort((a, b) => b.pessoasEmRisco.esperado - a.pessoasEmRisco.esperado)
      .map((e) => e.bairro),
    aviso: 'Isto é tendência sobre os conjuntos carregados, não previsão do que vai acontecer.',
  };
}

export type RodadaDoModelo = ReturnType<typeof rodarModelo>;

/**
 * Ferramenta de carregar dados. O Cientista chama quando o estudante CONCORDA em
 * usar algo — a escolha acontece na conversa, não num painel de caixas.
 */
export const FERRAMENTA_USAR_DADOS: AiFerramenta = {
  nome: 'usar_dados',
  descricao:
    'Passa a usar os dados indicados. Eles SOMAM ao que já está carregado — nada é descartado e não há teto. Chame quando o estudante pedir, concordar, ou quando a pergunta dele exigir uma fonte que ainda não está em uso.',
  parametros: {
    type: 'object',
    properties: {
      dados: {
        type: 'array',
        description:
          'Identificadores dos dados a usar, entre: ocorrencias, sensores, censo, previsao, satelite, telefonia, viaria, estudo.',
        items: { type: 'string' },
      },
    },
    required: ['dados'],
  },
};

/**
 * Registrar a alocação. O Cientista NÃO escolhe o destino — mas quando o estudante
 * escolhe, é ele quem opera o rádio. Sem esta ferramenta, o estudante dizia "então
 * aloca pra lá" e batia numa parede: o Cientista recusava a ação inteira, e não
 * só a decisão.
 */
export const FERRAMENTA_ALOCAR: AiFerramenta = {
  nome: 'alocar_equipe',
  descricao:
    'Registra o BAIRRO DE DESTINO de uma ou das duas equipes. Chame apenas quando o estudante nomear lugares ("manda a Alfa para o Vale Verde"). NÃO use para confirmar: se ele disser "confirmo", "pode mandar" ou "pode enfrentar a tempestade" sem nomear bairro novo, use confirmar_alocacao. Nunca chame por iniciativa própria nem sugira destino.',
  parametros: {
    type: 'object',
    properties: {
      alfa: {
        type: 'string',
        description:
          'Bairro de destino da Equipe Alfa: ribeirinha, valeverde, morroalto ou industrial. Omita se ele não falou da Alfa.',
      },
      bravo: {
        type: 'string',
        description: 'Bairro de destino da Equipe Bravo. Omita se ele não falou da Bravo.',
      },
    },
  },
};

/**
 * Confirmar: ABRE a tela de envio na tela do estudante (ADR-169). Quem manda as
 * equipes é ele, no botão "Enviar equipes" — que passa pelo porquê de cada
 * equipe e leva ao registro da operação.
 */
export const FERRAMENTA_CONFIRMAR: AiFerramenta = {
  nome: 'confirmar_alocacao',
  descricao:
    'Abre, na tela do estudante, a decisão com o botão "Enviar equipes" — ela NÃO manda as equipes. É esta a ferramenta para "confirmo", "pode mandar", "manda ver", "pode enfrentar", "vamos nessa" — qualquer confirmação sem bairro novo. Exige pelo menos uma equipe com destino.',
  parametros: {
    type: 'object',
    properties: {
      confirmado: { type: 'boolean', description: 'true quando o estudante confirmou em palavras.' },
    },
    required: ['confirmado'],
  },
};

/**
 * Pôr DUAS alternativas de alocação na mesa, estruturadas.
 *
 * O prompt já obriga a propor duas opções e perguntar qual o estudante quer — isto
 * não decide nada de novo, só faz a proposta chegar como dois botões em vez de
 * duas linhas para digitar. Sem campo de texto: nenhum número da LLM entra no
 * cartão, e o servidor recusa a proposta feita antes de o modelo ter rodado.
 */
export const FERRAMENTA_PROPOR: AiFerramenta = {
  nome: 'propor_opcoes',
  descricao:
    'Põe na mesa DUAS alternativas de alocação para o estudante escolher, cada uma com um bairro para a Alfa e outro para a Bravo. Chame junto com a sua fala sempre que for oferecer alternativas, e só depois de ter rodado o modelo. NÃO é decidir: ele escolhe uma. Nunca chame com as duas equipes no mesmo bairro.',
  parametros: {
    type: 'object',
    properties: {
      opcoes: {
        type: 'array',
        description: 'Exatamente duas alternativas.',
        items: {
          type: 'object',
          properties: {
            alfa: {
              type: 'string',
              description: 'Bairro da Equipe Alfa: ribeirinha, valeverde, morroalto ou industrial.',
            },
            bravo: { type: 'string', description: 'Bairro da Equipe Bravo.' },
          },
          required: ['alfa', 'bravo'],
        },
      },
    },
    required: ['opcoes'],
  },
};

/** Declaração da ferramenta para o provedor. O modelo decide quando chamar. */
export const FERRAMENTA_RODAR_MODELO: AiFerramenta = {
  nome: 'rodar_modelo',
  descricao:
    'Roda o modelo Sauá-1 com os conjuntos de dados carregados e devolve estimativas por bairro, com faixa de incerteza, pontos cegos e tendência. Use sempre que o estudante pedir uma leitura do risco, comparação entre bairros ou o resultado do processamento.',
  parametros: {
    type: 'object',
    properties: {
      motivo: {
        type: 'string',
        description: 'Por que você está rodando o modelo agora, em uma frase.',
      },
    },
    required: ['motivo'],
  },
};

/** As cinco ferramentas do Cientista, na ordem em que ele as usa num turno. */
export const FERRAMENTAS: AiFerramenta[] = [
  FERRAMENTA_USAR_DADOS,
  FERRAMENTA_RODAR_MODELO,
  FERRAMENTA_ALOCAR,
  FERRAMENTA_CONFIRMAR,
  FERRAMENTA_PROPOR,
];
