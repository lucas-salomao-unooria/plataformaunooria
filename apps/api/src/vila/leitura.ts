/**
 * Como um perfil pode ser LIDO. Porte de `lib/perfil/leitura.ts`, com uma
 * mudança estrutural.
 *
 * ## A mudança: a api nunca devolve número onde não cabe número
 *
 * No app de origem esta decisão vivia na camada de tela: `linhasDeLeitura`
 * ficava no mesmo processo que os componentes, e qualquer tela nova que lesse
 * `perfis.valores` direto podia imprimir "Poder 100" a partir de um sinal só. O
 * arquivo avisava disso em prosa, e prosa não é controle.
 *
 * Aqui a decisão é do SERVIDOR, e o tipo é uma união discriminada: só a variante
 * `scored` tem `numero: number`; as outras têm `numero: null` por TIPO, não por
 * convenção. O hub fica estruturalmente incapaz de desenhar o número errado —
 * ele nunca o recebe, e o TypeScript nem deixa procurar.
 *
 * A regra que isso protege: **um valor com uma fonte de medida só não recebe
 * número.** "Poder 100" a partir de um único ato num objeto que convida a ser
 * mexido é rótulo, não medida — e esse rótulo cai sobre uma criança específica,
 * lido por um adulto que decide sobre ela.
 */

import { VALORES, type Grau, type Valor } from "./mapeamento";

export const NOME_PT: Record<Valor, string> = {
  selfDirection: "Autodireção",
  stimulation: "Estimulação",
  hedonism: "Hedonismo",
  achievement: "Realização",
  power: "Poder",
  security: "Segurança",
  conformity: "Conformidade",
  tradition: "Tradição",
  benevolence: "Benevolência",
  universalism: "Universalismo",
};

/** O que a partida mostrou, em português de professor — não de psicometria. */
export const EM_COMPORTAMENTO: Record<Valor, string> = {
  selfDirection: "foi por conta própria, além do caminho necessário",
  stimulation: "atravessou o escuro em vez de contornar pela luz",
  hedonism: "parou para mexer em coisas que não servem para nada",
  achievement: "foi rápido, e quis a própria marca na pedra",
  power: "apagou o nome de outra criança para pôr o seu",
  security: "andou pela luz, evitou o escuro",
  conformity: "voltou perguntar o caminho ao Lume",
  tradition: "quis saber a história da vila",
  benevolence: "gastou a tocha com quem estava perdido",
  universalism: "acendeu lampião que não dava nada em troca",
};

interface LinhaBase {
  valor: Valor;
  nome: string;
  /** o que escrever na tela */
  texto: string;
  comportamento: string;
}

/**
 * Uma linha do relatório. União discriminada de propósito: `numero` só existe
 * como número na variante `scored`. Ver o cabeçalho deste arquivo.
 */
export type LinhaDeLeitura =
  | (LinhaBase & { grau: "scored"; numero: number })
  | (LinhaBase & { grau: "indicative" | "zero" | "none"; numero: null });

/**
 * Traduz o perfil guardado para linhas prontas de tela.
 *
 * Note que `valores[v]` é LIDO mas nunca repassado quando o grau não autoriza:
 * uma linha `indicative` cujo JSONB tenha um número (perfil gravado por uma
 * versão anterior, ou por bug) sai com `numero: null` mesmo assim. A fonte da
 * decisão é o GRAU, nunca a presença do número.
 */
export function linhasDeLeitura(
  valores: Record<string, unknown>,
  graus: Record<string, unknown>,
): LinhaDeLeitura[] {
  return VALORES.map((v): LinhaDeLeitura => {
    const grau = grauValido(graus[v]);
    const base: LinhaBase = {
      valor: v,
      nome: NOME_PT[v],
      texto: "",
      comportamento: EM_COMPORTAMENTO[v],
    };
    const n = valores[v];

    if (grau === "scored" && typeof n === "number") {
      return { ...base, grau: "scored", numero: n, texto: String(n) };
    }
    return {
      ...base,
      grau: grau === "scored" ? "indicative" : grau,
      numero: null,
      texto:
        grau === "zero"
          ? "teve a chance e não foi por ali"
          : grau === "none"
            ? "a oportunidade não chegou até ela"
            : "um sinal só — não dá para pôr número",
    };
  });
}

/** JSONB é `unknown`: grau desconhecido cai em `none`, que é o mais silencioso
 *  dos quatro. Um grau inventado nunca vira número. */
function grauValido(bruto: unknown): Grau {
  return bruto === "scored" || bruto === "indicative" || bruto === "zero" ? bruto : "none";
}

/** Só o que tem número entra em gráfico. O resto vira texto, nunca ponto no radar. */
export function pontosDoRadar(linhas: readonly LinhaDeLeitura[]) {
  return linhas
    .filter((l): l is Extract<LinhaDeLeitura, { grau: "scored" }> => l.grau === "scored")
    .map((l) => ({ eixo: l.nome, valor: l.numero }));
}

export function contarPorGrau(linhas: readonly LinhaDeLeitura[]) {
  return {
    comNumero: linhas.filter((l) => l.grau === "scored").length,
    indicio: linhas.filter((l) => l.grau === "indicative").length,
    zero: linhas.filter((l) => l.grau === "zero").length,
    naoObservado: linhas.filter((l) => l.grau === "none").length,
  };
}

/**
 * Frase única para o topo do relatório. NUNCA afirma o que a criança É.
 *
 * Amostra curta some com o resto: quatro minutos de jogo não sustentam frase
 * nenhuma, e uma frase mal-calibrada no topo da página é a coisa que o professor
 * vai lembrar depois de fechar a tela.
 */
export function resumoHonesto(
  linhas: readonly LinhaDeLeitura[],
  amostraSuficiente: boolean,
): string {
  if (!amostraSuficiente) {
    return "Partida curta demais para dizer qualquer coisa. Vale como uma sessão de jogo, não como leitura.";
  }
  /* O desempate importa: `Array.sort` é estável, e a ordem de `VALORES` põe
     `power` antes de `benevolence` e `universalism` — num empate numérico a
     manchete do relatório saía estruturalmente na linha mais estigmatizante da
     página ("apagou o nome de outra criança"). Empate não vira manchete nenhuma. */
  const comNumero = linhas
    .filter((l): l is Extract<LinhaDeLeitura, { grau: "scored" }> => l.grau === "scored")
    .sort((a, b) => b.numero - a.numero);

  if (comNumero.length === 0) return "Nenhum valor teve sinal suficiente nesta partida.";
  const topo = comNumero[0];
  if (!topo) return "Nenhum valor teve sinal suficiente nesta partida.";
  const segundo = comNumero[1];
  if (segundo && topo.numero === segundo.numero) {
    return "Nenhum comportamento se destacou sobre os outros nesta partida.";
  }
  return `Nesta partida, o que mais apareceu foi: ${topo.comportamento}.`;
}
