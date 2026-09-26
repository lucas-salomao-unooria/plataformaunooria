import { COLEGAS_VIRTUAIS_IDS, type ColegaVirtual } from "../catalogo";
import { distancia, type Matriz } from "./matriz";

/**
 * O PAREAMENTO DO MURAL: quem vê a tríade de quem, no pico da missão.
 *
 * A unidade do pareamento é o COMPUTADOR, não a criança (a resposta desta
 * missão ao gatilho da ADR-111): dois estudantes numa tela publicaram UMA tríade, e é
 * ela que o Mural põe lado a lado com outra. Quem monta as unidades é o
 * service, com `equipes/regras.ts#colapsarEmUnidades` — aqui chega uma lista de
 * candidatos já colapsados, cada um com a matriz do representante.
 *
 * A regra de escolha é a DISTÂNCIA MÁXIMA entre as matrizes, gulosa: o par mais
 * distante da sala sai primeiro, depois o mais distante do que sobrou, e assim
 * por diante. É o que põe o "anúncio de inauguração" ao lado da "zona de
 * desastre", que é a cena do PRD. O ótimo global (maior soma de distâncias)
 * não é o que o produto pediu, e uma sala de trinta não sentiria a diferença.
 *
 * Três casos recebem o colega VIRTUAL — o mais distante entre Tomás e Malu:
 *   - quem sobra numa sala ímpar;
 *   - quem só tem, na sala, candidatos de tríade IGUAL à dele (distância zero):
 *     o PRD diz "fallback para Tomás e Malu caso não haja pares divergentes", e
 *     parear dois 1-1-1 mostraria duas histórias iguais no momento em que a
 *     missão precisa de duas diferentes;
 *   - a sala de UM computador (a projeção): não há colega de outra tela.
 * Quem publica depois de o Mural abrir também recebe o virtual, mas esse caso
 * nasce na decisão, não aqui (o pareamento da sala já rodou).
 */

export interface CandidatoAoPar {
  /** A chave da unidade (`equipe:<id>` ou `estudante:<id>`). */
  chave: string;
  matriz: Matriz;
}

export interface VirtualDoMural {
  id: ColegaVirtual;
  matriz: Matriz;
}

export type ParDoMural = { tipo: "unidade"; chave: string } | { tipo: "virtual"; id: ColegaVirtual };

/**
 * O colega virtual MAIS DISTANTE desta tríade. Empate (uma tríade toda
 * estatística dista o mesmo dos dois extremos) fica com o primeiro da lista —
 * determinístico, para o F5 mostrar sempre o mesmo colega.
 */
export function virtualMaisDistante(matriz: Matriz, virtuais: readonly VirtualDoMural[]): ColegaVirtual {
  let melhor: VirtualDoMural | undefined;
  let melhorDistancia = -1;
  for (const v of virtuais) {
    const d = distancia(matriz, v.matriz);
    if (d > melhorDistancia) {
      melhor = v;
      melhorDistancia = d;
    }
  }
  return melhor?.id ?? COLEGAS_VIRTUAIS_IDS[0];
}

/**
 * Pareia as unidades da sala. Devolve, para CADA candidato, o par dele.
 *
 * O par é simétrico: se A recebeu B, B recebeu A. Uma unidade nunca é pareada
 * consigo mesma — e, como a lista vem colapsada por computador, isso quer
 * dizer que ninguém é pareado com o próprio colega de tela. Chave repetida na
 * entrada conta uma vez só (a primeira), pela mesma razão.
 *
 * O desempate entre distâncias iguais é a ORDEM de entrada, que o service
 * entrega estável (a ordem das unidades do painel): a mesma sala, pareada duas
 * vezes, produz os mesmos pares.
 */
export function parear(
  candidatos: readonly CandidatoAoPar[],
  virtuais: readonly VirtualDoMural[],
  opcoes: { projecao?: boolean } = {},
): Map<string, ParDoMural> {
  const unicos = [...new Map(candidatos.map((c) => [c.chave, c])).values()];
  const pares = new Map<string, ParDoMural>();

  if (!opcoes.projecao) {
    const arestas: Array<{ i: number; j: number; d: number }> = [];
    for (let i = 0; i < unicos.length; i++) {
      for (let j = i + 1; j < unicos.length; j++) {
        const d = distancia((unicos[i] as CandidatoAoPar).matriz, (unicos[j] as CandidatoAoPar).matriz);
        if (d > 0) arestas.push({ i, j, d });
      }
    }
    /* `sort` estável: com a mesma distância, a aresta que veio antes (i menor,
       depois j menor) ganha. */
    arestas.sort((x, y) => y.d - x.d);
    const livres = new Set(unicos.map((_, i) => i));
    for (const { i, j } of arestas) {
      if (!livres.has(i) || !livres.has(j)) continue;
      const a = unicos[i] as CandidatoAoPar;
      const b = unicos[j] as CandidatoAoPar;
      pares.set(a.chave, { tipo: "unidade", chave: b.chave });
      pares.set(b.chave, { tipo: "unidade", chave: a.chave });
      livres.delete(i);
      livres.delete(j);
    }
  }

  for (const c of unicos) {
    if (pares.has(c.chave)) continue;
    pares.set(c.chave, { tipo: "virtual", id: virtualMaisDistante(c.matriz, virtuais) });
  }
  return pares;
}
