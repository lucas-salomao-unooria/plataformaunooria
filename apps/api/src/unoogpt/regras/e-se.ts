import { embaralhar, type Nivel } from '../../evidencias/regras';
import { corridasPareadas, type Alocacao } from '../modelo/tempestade';
import { ORDEM_DO_MAPA } from './canal-a';

/**
 * "E SE…", no resultado (EM13CO11, ADR-169). PURO.
 *
 * "Duas outras decisões, nas mesmas 20 tempestades": para cada comparação, uma
 * faixa de 20 quadradinhos, cada um dizendo qual das duas decisões resgatou
 * mais naquela tempestade (`corridasPareadas`, as mesmas tempestades e a mesma
 * sorte da operação). Mede INTERPRETAR o que um modelo prevê — não criar, nem
 * explorar: explorar fica no "E se…" livre, que não dá marca.
 *
 * O gabarito é a fração das 20: a outra resgata mais em 18 ou mais → "mais";
 * em 2 ou menos → "menos"; o resto → "depende". O servidor monta UMA clara (19
 * ou 20, ou 0 ou 1) e UMA na zona "depende" (de 6 a 14) — nunca perto da
 * fronteira, para a resposta depender da leitura e não do limite. A busca:
 *   1. trocar o destino de uma equipe;
 *   2. trocar os dois destinos;
 *   3. comparar duas outras decisões entre si ("Comparada com a primeira, a
 *      segunda decisão…").
 * A ordem das duas comparações é embaralhada.
 *
 * | Clara | "Depende" | Nível |
 * | --- | --- | --- |
 * | certa | certa | demonstra |
 * | certa | errada | em desenvolvimento |
 * | errada | qualquer | não demonstra |
 * | não respondidas | — | sem marca |
 */
export const TEMPESTADES = 20;

export const RESPOSTAS_DO_E_SE = [
  { id: 'mais', texto: 'Resgata mais em quase todas as tempestades' },
  { id: 'menos', texto: 'Resgata menos em quase todas as tempestades' },
  { id: 'depende', texto: 'Depende: em umas resgata mais, em outras menos' },
] as const;
export type RespostaDoESe = (typeof RESPOSTAS_DO_E_SE)[number]['id'];
export const IDS_DO_E_SE = RESPOSTAS_DO_E_SE.map((r) => r.id) as [RespostaDoESe, ...RespostaDoESe[]];

/** Em cada tempestade, qual decisão resgatou mais: a de referência, a outra, ou empate. */
export type Quadradinho = 'referencia' | 'outra' | 'empate';

export interface Comparacao {
  id: 'clara' | 'depende';
  /** De referência: a do estudante, ou a "primeira" no passo 3. */
  referencia: Alocacao;
  outra: Alocacao;
  /** `sua`: compara com a decisão dele; `entre-outras`: passo 3. */
  modo: 'sua' | 'entre-outras';
  quadradinhos: Quadradinho[];
  gabarito: RespostaDoESe;
}

export function gabaritoDe(maisEm: number, total = TEMPESTADES): RespostaDoESe {
  if (maisEm >= total - 2) return 'mais';
  if (maisEm <= 2) return 'menos';
  return 'depende';
}

const ehClara = (maisEm: number, menosEm: number) => maisEm >= TEMPESTADES - 1 || menosEm >= TEMPESTADES - 1;
const ehDepende = (maisEm: number) => maisEm >= 6 && maisEm <= 14;

function comparar(referencia: Alocacao, outra: Alocacao, saida: number) {
  const par = corridasPareadas(referencia, outra, { saidaEmMinutos: saida }, TEMPESTADES);
  const quadradinhos: Quadradinho[] = par.sua.corridas.map((a, i) => {
    const b = par.outra.corridas[i]!;
    return b > a ? 'outra' : b < a ? 'referencia' : 'empate';
  });
  return { quadradinhos, maisEm: par.comparacao.maisEm, menosEm: par.comparacao.menosEm };
}

const igual = (a: Alocacao, b: Alocacao) => a.alfa === b.alfa && a.bravo === b.bravo;
const valida = (a: Alocacao) => (a.alfa !== null || a.bravo !== null) && (a.alfa === null || a.alfa !== a.bravo);

/** As decisões candidatas, na ordem da busca. */
function passo1(sua: Alocacao): Alocacao[] {
  const r: Alocacao[] = [];
  for (const b of ORDEM_DO_MAPA) if (b !== sua.alfa) r.push({ alfa: b, bravo: sua.bravo });
  for (const b of ORDEM_DO_MAPA) if (b !== sua.bravo) r.push({ alfa: sua.alfa, bravo: b });
  return r.filter(valida);
}
function passo2(sua: Alocacao): Alocacao[] {
  const r: Alocacao[] = [];
  for (const a of ORDEM_DO_MAPA) {
    if (a === sua.alfa) continue;
    for (const b of ORDEM_DO_MAPA) if (b !== sua.bravo) r.push({ alfa: a, bravo: b });
  }
  return r.filter(valida);
}
function todasAsOutras(sua: Alocacao): Alocacao[] {
  const r: Alocacao[] = [];
  for (const a of ORDEM_DO_MAPA) for (const b of ORDEM_DO_MAPA) r.push({ alfa: a, bravo: b });
  return r.filter((x) => valida(x) && !igual(x, sua));
}

/**
 * As duas comparações, ou `null` quando a busca não acha as duas (o cartão não
 * aparece e não há marca).
 */
export function montarComparacoes(sua: Alocacao, saida: number, aleatorio: () => number): Comparacao[] | null {
  let clara: Comparacao | null = null;
  let depende: Comparacao | null = null;

  const tentar = (referencia: Alocacao, outra: Alocacao, modo: Comparacao['modo']) => {
    if ((clara && depende) || igual(referencia, outra)) return;
    const c = comparar(referencia, outra, saida);
    if (!clara && ehClara(c.maisEm, c.menosEm)) {
      clara = { id: 'clara', referencia, outra, modo, quadradinhos: c.quadradinhos, gabarito: gabaritoDe(c.maisEm) };
    } else if (!depende && ehDepende(c.maisEm)) {
      depende = { id: 'depende', referencia, outra, modo, quadradinhos: c.quadradinhos, gabarito: gabaritoDe(c.maisEm) };
    }
  };

  for (const outra of passo1(sua)) tentar(sua, outra, 'sua');
  for (const outra of passo2(sua)) tentar(sua, outra, 'sua');
  const outras = todasAsOutras(sua);
  for (let i = 0; i < outras.length && !(clara && depende); i++) {
    for (let j = 0; j < outras.length && !(clara && depende); j++) {
      if (i !== j) tentar(outras[i]!, outras[j]!, 'entre-outras');
    }
  }
  if (!clara || !depende) return null;
  return embaralhar([clara, depende], aleatorio);
}

export function nivelDoESe(comparacoes: readonly Comparacao[] | null, respostas: Record<string, string>): Nivel | null {
  if (!comparacoes) return null;
  const clara = comparacoes.find((c) => c.id === 'clara');
  const depende = comparacoes.find((c) => c.id === 'depende');
  if (!clara || !depende || !respostas.clara || !respostas.depende) return null;
  if (respostas.clara !== clara.gabarito) return 'nao_atingiu';
  return respostas.depende === depende.gabarito ? 'atingiu' : 'em_processo';
}
