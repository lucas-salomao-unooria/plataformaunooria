import type { Nivel } from '../../evidencias/regras';
import { INTUICAO } from './justificativa';
import { ORDEM_DO_MAPA, nomeDoBairro, noBairro, paraOBairro, pelaFonte, aFonte } from './canal-a';

/**
 * "O QUE VOCÊ PRECISARIA SABER" de cada fonte, no registro (EM13CO14, ADR-169).
 * PURO.
 *
 * Sempre dois cartões, cada um com um par (fonte, bairro), e as MESMAS cinco
 * perguntas para toda fonte. O gabarito é por CÉLULA, da tabela abaixo (a da
 * v3, tirada de `modelo/conjuntos.ts`):
 *
 * - `distorce`: a fonte muda a estimativa de pessoas do bairro em 10% ou mais;
 *   só valem as perguntas-chave da fonte;
 * - `nao-enxerga`: a fonte não cobre o bairro; só vale "Se ela enxerga este bairro";
 * - `nao-distorce`: a célula NUNCA vira cartão (decisão do PO, 16/10) — o
 *   cartão é trocado por um par da mesma fonte num bairro onde ela distorce ou
 *   não enxerga, com texto hipotético. Por isso "Nada: aqui ela basta" nunca é
 *   certo num cartão.
 *
 * O mapa de estradas fica FORA: ele não muda a estimativa de pessoas de bairro
 * nenhum, e a interdição só gera um aviso que a tela mostra a todos.
 *
 * A régua: os dois certos → demonstra; um → em desenvolvimento; nenhum → não
 * demonstra; sem dois cartões válidos → sem marca.
 */
export const PERGUNTAS_DA_FONTE = [
  { id: 'quando', texto: 'Quando ela foi medida' },
  { id: 'conta', texto: 'O que exatamente ela conta' },
  { id: 'enxerga', texto: 'Se ela enxerga este bairro' },
  { id: 'quem', texto: 'Quem a produziu, e para quê' },
  { id: 'nada', texto: 'Nada: aqui ela basta' },
] as const;
export type PerguntaDaFonte = (typeof PERGUNTAS_DA_FONTE)[number]['id'];
export const IDS_DAS_PERGUNTAS = PERGUNTAS_DA_FONTE.map((p) => p.id) as [PerguntaDaFonte, ...PerguntaDaFonte[]];

type Caso = 'distorce' | 'nao-enxerga' | 'nao-distorce';
interface Celula {
  caso: Caso;
  /** As perguntas-chave (só valem onde a fonte distorce ou não enxerga). */
  certas: readonly PerguntaDaFonte[];
}

const D = (...certas: PerguntaDaFonte[]): Celula => ({ caso: 'distorce', certas });
const CEGA: Celula = { caso: 'nao-enxerga', certas: ['enxerga'] };
const OK: Celula = { caso: 'nao-distorce', certas: [] };

/** A tabela das células: fonte × bairro. */
export const CELULAS: Readonly<Record<string, Readonly<Record<string, Celula>>>> = {
  // só existe registro onde alguém chamou
  ocorrencias: { ribeirinha: D('conta', 'quem'), valeverde: OK, morroalto: D('conta', 'quem'), industrial: OK },
  // dois sensores parados repetem o último valor; não mede o Morro Alto
  sensores: { ribeirinha: D('quando'), valeverde: OK, morroalto: CEGA, industrial: D('quando') },
  // feito há 9 anos
  censo: { ribeirinha: OK, valeverde: OK, morroalto: D('quando'), industrial: OK },
  // uma célula da grade junta Ribeirinha e Morro Alto
  previsao: { ribeirinha: D('enxerga', 'conta'), valeverde: OK, morroalto: D('enxerga', 'conta'), industrial: OK },
  // vê construção, não gente (5% no Morro Alto, abaixo do limite)
  satelite: { ribeirinha: OK, valeverde: OK, morroalto: OK, industrial: D('conta') },
  // conta aparelho, não pessoa
  telefonia: { ribeirinha: D('conta'), valeverde: OK, morroalto: D('conta'), industrial: OK },
  // feito casa a casa, só na Ribeirinha
  estudo: { ribeirinha: OK, valeverde: CEGA, morroalto: CEGA, industrial: CEGA },
};

/** As fontes da tarefa: todas menos o mapa de estradas. */
export const FONTES_DA_TAREFA = Object.keys(CELULAS);

const celula = (fonte: string, bairro: string): Celula => CELULAS[fonte]?.[bairro] ?? OK;
const distorce = (fonte: string, bairro: string) => celula(fonte, bairro).caso !== 'nao-distorce';

/** Os bairros onde a fonte distorce ou não enxerga, na ordem do mapa. */
export function bairrosQueDistorcem(fonte: string): string[] {
  return ORDEM_DO_MAPA.filter((b) => distorce(fonte, b));
}

export type TipoDoCartao = 'real' | 'hipotetico' | 'segundo';

export interface CartaoDaFonte {
  id: 'c1' | 'c2';
  /** A equipe de onde o par saiu (`null` no segundo cartão de uma equipe só). */
  equipe: 'alfa' | 'bravo' | null;
  bairroDaEquipe: string | null;
  fonte: string;
  bairro: string;
  tipo: TipoDoCartao;
  /** Como o grupo chegou à fonte: citou, foi por intuição, ou é a próxima que abriu. */
  origem: 'citou' | 'intuicao' | 'proxima';
  texto: string;
  certas: PerguntaDaFonte[];
}

export interface EquipeEnviada {
  equipe: 'alfa' | 'bravo';
  bairro: string | null;
  justificativa: string | null;
}

/**
 * Entre os bairros onde a fonte distorce, o que a última leitura do grupo
 * mostrava com mais gente; empate ou bairro fora da leitura segue o mapa.
 */
function bairroHipotetico(
  fonte: string,
  leitura: readonly { bairro: string; esperado: number }[],
  evitar: ReadonlySet<string>,
): string | null {
  const candidatos = bairrosQueDistorcem(fonte).filter((b) => !evitar.has(b));
  if (candidatos.length === 0) return null;
  const peso = (b: string) => leitura.find((l) => l.bairro === b)?.esperado ?? -1;
  return [...candidatos].sort((a, b) => peso(b) - peso(a) || ORDEM_DO_MAPA.indexOf(a) - ORDEM_DO_MAPA.indexOf(b))[0]!;
}

const nomeDaEquipe = (e: 'alfa' | 'bravo') => (e === 'alfa' ? 'Alfa' : 'Bravo');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A fonte de partida de uma equipe: a citada no "por que aqui?", ou a primeira
 * que o grupo abriu (intuição, ou o mapa de estradas citado). `null` sem fonte.
 */
function fonteDeOrigem(
  justificativa: string | null,
  abertas: readonly string[],
): { fonte: string; origem: 'citou' | 'intuicao' } | null {
  if (justificativa && justificativa !== INTUICAO && FONTES_DA_TAREFA.includes(justificativa)) {
    return { fonte: justificativa, origem: 'citou' };
  }
  const primeira = abertas.find((f) => FONTES_DA_TAREFA.includes(f));
  return primeira ? { fonte: primeira, origem: 'intuicao' } : null;
}

/** A próxima fonte aberta (depois de `depois`) que distorce em algum bairro fora de `evitar`. */
function proximaFonte(abertas: readonly string[], depois: string, evitar: (f: string) => ReadonlySet<string>): string | null {
  const daTarefa = abertas.filter((f) => FONTES_DA_TAREFA.includes(f));
  const inicio = daTarefa.indexOf(depois);
  const resto = [...daTarefa.slice(inicio + 1), ...daTarefa.slice(0, Math.max(inicio, 0))];
  return resto.find((f) => bairrosQueDistorcem(f).some((b) => !evitar(f).has(b))) ?? null;
}

function textoDoCartao(c: {
  equipe: 'alfa' | 'bravo' | null;
  bairroDaEquipe: string | null;
  fonte: string;
  bairro: string;
  origem: 'citou' | 'intuicao' | 'proxima';
  segundo: boolean;
}): string {
  const partes: string[] = [];
  if (c.equipe && c.bairroDaEquipe) partes.push(`Equipe ${nomeDaEquipe(c.equipe)} → ${nomeDoBairro(c.bairroDaEquipe)}.`);
  if (c.segundo) {
    partes.push(c.origem === 'proxima' ? `Outra fonte que o grupo abriu foi ${aFonte(c.fonte)}.` : `Ainda sobre ${aFonte(c.fonte)}.`);
    partes.push(`Se fosse usá-la ${paraOBairro(c.bairro)}, o que precisaria saber antes?`);
    return partes.join(' ');
  }
  if (c.origem === 'citou') partes.push(`Você disse que foi ${pelaFonte(c.fonte)}.`);
  else if (c.origem === 'intuicao') {
    partes.push(`Você foi por intuição. A primeira fonte que o grupo abriu foi ${aFonte(c.fonte)}.`);
  } else partes.push(`Outra fonte que o grupo abriu foi ${aFonte(c.fonte)}.`);

  if (c.bairro !== c.bairroDaEquipe) {
    partes.push(`Se fosse usar essa fonte ${noBairro(c.bairro)}, o que você precisaria saber?`);
  } else if (c.origem === 'citou') {
    partes.push(`Antes de confiar nessa fonte ${paraOBairro(c.bairro)}, o que você precisaria saber?`);
  } else {
    partes.push(`Se fosse usá-la ${paraOBairro(c.bairro)}, o que precisaria saber antes?`);
  }
  return cap(partes.join(' '));
}

/**
 * OS DOIS CARTÕES, cartão a cartão:
 *
 * 1. o par real da equipe: a fonte citada (ou a primeira aberta) no bairro dela;
 * 2. se a fonte distorce ali ou não enxerga o bairro, o cartão é esse;
 * 3. se não distorce, vira HIPOTÉTICO: a mesma fonte num bairro onde distorce
 *    (o de mais gente na última leitura; empate ou fora da leitura, o mapa);
 * 4. se a fonte não distorce em bairro nenhum, a próxima fonte aberta que
 *    distorce, e repete o passo 3;
 * 5. se os dois cartões coincidem — ou só uma equipe saiu —, o segundo é a
 *    mesma fonte no próximo bairro onde ela distorce; sem outro bairro, a
 *    próxima fonte aberta, pelo passo 4;
 * 6. sem dois cartões válidos, `null`: não há marca.
 */
export function montarCartoes(entrada: {
  equipes: readonly EquipeEnviada[];
  /** As fontes na ordem em que o grupo as abriu (`sessoes.conjuntos`). */
  abertas: readonly string[];
  leitura: readonly { bairro: string; esperado: number }[];
}): CartaoDaFonte[] | null {
  const cartoes: CartaoDaFonte[] = [];
  const nada = new Set<string>();

  for (const e of entrada.equipes) {
    if (!e.bairro) continue;
    const partida = fonteDeOrigem(e.justificativa, entrada.abertas);
    if (!partida) continue;
    let fonte = partida.fonte;
    let origem: CartaoDaFonte['origem'] = partida.origem;
    let bairro: string | null = e.bairro;
    if (!distorce(fonte, e.bairro)) {
      if (bairrosQueDistorcem(fonte).length === 0) {
        const proxima = proximaFonte(entrada.abertas, fonte, () => nada);
        if (!proxima) continue;
        fonte = proxima;
        origem = 'proxima';
      }
      bairro = distorce(fonte, e.bairro) ? e.bairro : bairroHipotetico(fonte, entrada.leitura, nada);
    }
    if (!bairro) continue;
    cartoes.push({
      id: cartoes.length === 0 ? 'c1' : 'c2',
      equipe: e.equipe,
      bairroDaEquipe: e.bairro,
      fonte,
      bairro,
      tipo: bairro === e.bairro ? 'real' : 'hipotetico',
      origem,
      texto: textoDoCartao({ equipe: e.equipe, bairroDaEquipe: e.bairro, fonte, bairro, origem, segundo: false }),
      certas: [...celula(fonte, bairro).certas],
    });
  }

  const [primeiro, segundo] = cartoes;
  if (!primeiro) return null;
  const coincidem = segundo && segundo.fonte === primeiro.fonte && segundo.bairro === primeiro.bairro;
  if (segundo && !coincidem) return [primeiro, segundo];

  // passo 5: o segundo é a mesma fonte noutro bairro onde ela distorce
  const usados = new Set([primeiro.bairro]);
  const quem = segundo ?? primeiro;
  let fonte = primeiro.fonte;
  let bairro = bairroHipotetico(fonte, entrada.leitura, usados);
  if (!bairro) {
    const proxima = proximaFonte(entrada.abertas, fonte, (f) => (f === primeiro.fonte ? usados : nada));
    if (!proxima) return null;
    fonte = proxima;
    bairro = bairroHipotetico(fonte, entrada.leitura, fonte === primeiro.fonte ? usados : nada);
    if (!bairro) return null;
  }
  const doSegundo = segundo ? { equipe: segundo.equipe, bairroDaEquipe: segundo.bairroDaEquipe } : { equipe: null, bairroDaEquipe: null };
  return [
    primeiro,
    {
      id: 'c2',
      ...doSegundo,
      fonte,
      bairro,
      tipo: 'segundo',
      origem: fonte === primeiro.fonte ? quem.origem : 'proxima',
      texto: textoDoCartao({
        ...doSegundo,
        fonte,
        bairro,
        origem: fonte === primeiro.fonte ? quem.origem : 'proxima',
        segundo: true,
      }),
      certas: [...celula(fonte, bairro).certas],
    },
  ];
}

export function acertosDosCartoes(cartoes: readonly CartaoDaFonte[], respostas: Record<string, string>): number {
  return cartoes.filter((c) => (c.certas as readonly string[]).includes(respostas[c.id] ?? '')).length;
}

export function nivelDosCartoes(cartoes: readonly CartaoDaFonte[] | null, respostas: Record<string, string>): Nivel | null {
  if (!cartoes || cartoes.length < 2) return null;
  const certos = acertosDosCartoes(cartoes, respostas);
  if (certos === 2) return 'atingiu';
  if (certos === 1) return 'em_processo';
  return 'nao_atingiu';
}

export const textoDaPergunta = (id: string) => PERGUNTAS_DA_FONTE.find((p) => p.id === id)?.texto ?? id;
