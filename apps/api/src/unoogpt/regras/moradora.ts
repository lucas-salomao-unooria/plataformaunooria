import { embaralhar, type Nivel } from '../../evidencias/regras';
import { INTUICAO } from './justificativa';
import { aFonte, doBairro, lista } from './canal-a';

/**
 * A RESPOSTA À MORADORA, no fechamento (EM13CO26, ADR-169). PURO.
 *
 * A Ouvidoria repassa a pergunta de uma moradora do bairro sem equipe com mais
 * gente em risco; o grupo monta a resposta com uma frase de cada parte. As
 * frases certas de "Os dados" e de "Quem decidiu" são MONTADAS pelo servidor a
 * partir do que o grupo fez — em cada perfil, cada parte tem exatamente uma
 * frase certa, e ela é verdadeira para aquele grupo.
 *
 * | Perfil | "Os dados" | "Quem decidiu" |
 * | --- | --- | --- |
 * | citou fonte em toda equipe enviada | "Para decidir, usei: {fontes citadas}." | com o assistente de IA |
 * | misto: fonte numa, intuição na outra | "Para decidir, usei {fonte} e, numa das equipes, a minha avaliação." | com o assistente de IA |
 * | pediu dados, intuição em todas | "Consultei {fontes}, mas decidi pela minha avaliação." | com o assistente de IA |
 * | não pediu dados | "Decidi sem consultar dados, pela minha avaliação." | "eu era o responsável pela sala" |
 *
 * | Partes certas | Nível |
 * | --- | --- |
 * | 4 | demonstra |
 * | 3 | em desenvolvimento |
 * | 0 a 2 | não demonstra |
 *
 * 81 combinações por perfil (3⁴): 1 demonstra, 8 em desenvolvimento, 72 não
 * demonstra. O texto fala de pessoas afetadas, nunca de mortes.
 */
export type PerfilDaMoradora = 'citou' | 'misto' | 'consultou' | 'sem-dados';

export const PARTES_DA_MORADORA = ['dados', 'criterio', 'quem', 'contestar'] as const;
export type ParteDaMoradora = (typeof PARTES_DA_MORADORA)[number];
export type RespostasDaMoradora = Record<ParteDaMoradora, string>;

export const TITULO_DA_PARTE: Record<ParteDaMoradora, string> = {
  dados: 'Os dados',
  criterio: 'O critério',
  quem: 'Quem decidiu',
  contestar: 'Se quiser contestar',
};

/** O id da opção certa de cada parte. As frases certas de dados e quem mudam com o perfil; o id não. */
export const CERTA = 'certa';

const FIXAS: Record<ParteDaMoradora, { id: string; texto: string }[]> = {
  dados: [
    { id: 'anexo', texto: 'Segue em anexo a lista dos moradores que entraram na conta.' },
    { id: 'melhores-dados', texto: 'Usamos os melhores dados disponíveis naquele momento.' },
  ],
  criterio: [
    {
      id: CERTA,
      texto: 'Mandei as equipes aonde, com o que eu sabia, elas fariam mais diferença; o seu ficou de fora.',
    },
    {
      id: 'tecnico',
      texto: 'O critério é técnico, e explicar como ele funciona não ajudaria você a entender o resultado.',
    },
    {
      id: 'de-sempre',
      texto: 'Seguimos o mesmo critério de sempre, o que a sala de operações usa em todas as outras chuvas.',
    },
  ],
  quem: [
    { id: 'o-sistema', texto: 'Quem decidiu foi o sistema de inteligência artificial da sala.' },
    { id: 'sigilo', texto: 'Não posso dizer quem decidiu, para proteger a segurança da equipe.' },
  ],
  contestar: [
    { id: CERTA, texto: 'Você pode pedir à Ouvidoria os dados e os critérios, e contestar.' },
    { id: 'redes', texto: 'Você pode deixar sua reclamação nas redes sociais da prefeitura.' },
    { id: 'emergencia', texto: 'Como era emergência, não cabe pedido de explicação nem revisão.' },
  ],
};

export const QUEM_COM_IA = 'A decisão foi minha; um assistente de IA me ajudou a ler os dados.';
export const QUEM_SEM_IA = 'A decisão foi minha; eu era o responsável pela sala naquela hora.';

/**
 * O perfil do grupo, do que ele FEZ: as justificativas das equipes que saíram
 * (fonte ou `intuicao`) e as fontes que abriu.
 */
export function perfilDaMoradora(entrada: {
  justificativas: readonly (string | null)[];
  conjuntos: readonly string[];
}): { perfil: PerfilDaMoradora; citadas: string[] } {
  const enviadas = entrada.justificativas.filter((j): j is string => j !== null);
  const citadas = [...new Set(enviadas.filter((j) => j !== INTUICAO))];
  if (entrada.conjuntos.length === 0) return { perfil: 'sem-dados', citadas: [] };
  if (citadas.length > 0 && enviadas.every((j) => j !== INTUICAO)) return { perfil: 'citou', citadas };
  if (citadas.length > 0) return { perfil: 'misto', citadas };
  return { perfil: 'consultou', citadas: [] };
}

/** A frase certa de "Os dados", montada com os nomes das fontes do grupo. */
export function fraseDosDados(perfil: PerfilDaMoradora, citadas: readonly string[], conjuntos: readonly string[]): string {
  if (perfil === 'citou') return `Para decidir, usei: ${lista(citadas.map(aFonte))}.`;
  if (perfil === 'misto') return `Para decidir, usei ${lista(citadas.map(aFonte))} e, numa das equipes, a minha avaliação.`;
  if (perfil === 'consultou') return `Consultei ${lista(conjuntos.map(aFonte))}, mas decidi pela minha avaliação.`;
  return 'Decidi sem consultar dados, pela minha avaliação.';
}

export function enunciadoDaMoradora(bairro: string): string {
  return `A Ouvidoria repassa a mensagem de uma moradora ${doBairro(bairro)}: "Meu bairro ficou sem equipe. Quem decidiu isso, e com base em quê?" Monte a resposta escolhendo uma frase de cada parte.`;
}

/** A APRESENTAÇÃO: as frases de cada parte, já montadas e embaralhadas. */
export function montarMoradora(
  entrada: {
    bairro: string;
    justificativas: readonly (string | null)[];
    conjuntos: readonly string[];
  },
  aleatorio: () => number,
) {
  const { perfil, citadas } = perfilDaMoradora(entrada);
  const certaDe: Partial<Record<ParteDaMoradora, string>> = {
    dados: fraseDosDados(perfil, citadas, entrada.conjuntos),
    quem: perfil === 'sem-dados' ? QUEM_SEM_IA : QUEM_COM_IA,
  };
  return {
    bairro: entrada.bairro,
    perfil,
    enunciado: enunciadoDaMoradora(entrada.bairro),
    partes: PARTES_DA_MORADORA.map((parte) => {
      const fixas = FIXAS[parte];
      const certa = certaDe[parte];
      const opcoes = certa ? [{ id: CERTA, texto: certa }, ...fixas] : fixas;
      return { id: parte, titulo: TITULO_DA_PARTE[parte], opcoes: embaralhar(opcoes, aleatorio) };
    }),
  };
}

export type ApresentacaoDaMoradora = ReturnType<typeof montarMoradora>;

export function respostaDaMoradoraValida(
  apresentacao: ApresentacaoDaMoradora,
  r: Record<string, string>,
): r is RespostasDaMoradora {
  return apresentacao.partes.every((p) => p.opcoes.some((o) => o.id === r[p.id]));
}

export function nivelDaMoradora(r: RespostasDaMoradora): Nivel {
  const certas = PARTES_DA_MORADORA.filter((p) => r[p] === CERTA).length;
  if (certas === 4) return 'atingiu';
  if (certas === 3) return 'em_processo';
  return 'nao_atingiu';
}

/** O bairro da moradora: o sem equipe com mais gente em risco no desfecho; empate, a ordem do mapa. */
export function bairroDaMoradora(
  semEquipe: readonly string[],
  porBairro: readonly { bairro: string; emRisco: number }[],
): string | null {
  let escolhido: string | null = null;
  let maior = -1;
  for (const b of semEquipe) {
    const n = porBairro.find((x) => x.bairro === b)?.emRisco ?? 0;
    if (n > maior) {
      maior = n;
      escolhido = b;
    }
  }
  return escolhido;
}
