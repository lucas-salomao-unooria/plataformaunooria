import { aleatorioDe, embaralhar, type Nivel } from "../../evidencias/regras";
import type { MensagemDoPacote, Tom, Veracidade } from "../catalogo";

/**
 * O CARTÃO DE FRASES da EF05CO03: realizar operações de negação, conjunção e
 * disjunção sobre "verdadeiro" e "falso".
 *
 * Depois dos crachás, a criança sabe os valores SIMPLES de cada uma das três
 * mensagens que encaminhou (verdadeira ou falsa; emocional ou neutra). O
 * cartão pede a OPERAÇÃO sobre eles: "a mensagem de Pedro é falsa E neutra?".
 * Os crachás não respondem a frase composta — quem a resolve é a criança —, e
 * por isso o cartão pode vir depois da revelação sem entregar a resposta.
 *
 * O desenho, todo verificado por `tests/quem-mandou-isso-regras.spec.ts` nas
 * 56 trincas possíveis do pacote:
 *   - 6 frases: 2 com E, 2 com OU e 2 com NÃO;
 *   - cada mensagem aparece em 2 frases, com dois operadores DIFERENTES;
 *   - 3 frases certas ("Sim") e 3 erradas ("Não"): quem responde tudo igual
 *     acerta a metade, e cai em "em processo", nunca em "atingiu";
 *   - E e OU ligam um valor de CADA eixo (nunca "verdadeira E falsa"); NÃO
 *     nega um valor só; sem dupla negação;
 *   - o sorteio tem semente (a sessão): o F5 devolve as mesmas frases.
 *
 * A resposta esperada (`esperado`) nunca desce: o cliente recebe `id` e `texto`.
 */

export const OPERADORES = ["E", "OU", "NAO"] as const;
export type Operador = (typeof OPERADORES)[number];

export const RESPOSTAS = ["sim", "nao"] as const;
export type Resposta = (typeof RESPOSTAS)[number];

export const TOTAL_DE_FRASES = 6;

/** A mensagem como o cartão a vê: o necessário para a frase e o gabarito. */
export type MensagemDoCartao = Pick<MensagemDoPacote, "id" | "remetente" | "texto" | "veracidade" | "tom">;

export interface FraseDoCartao {
  id: string;
  operador: Operador;
  msgId: string;
  texto: string;
  esperado: Resposta;
}

const OUTRA_VERACIDADE: Readonly<Record<Veracidade, Veracidade>> = { verdadeira: "falsa", falsa: "verdadeira" };
const OUTRO_TOM: Readonly<Record<Tom, Tom>> = { emocional: "neutra", neutra: "emocional" };

/** Quantas palavras do começo do texto entram na referência. */
const PALAVRAS_DO_INICIO = 4;

/**
 * Como a criança reconhece a mensagem: quem mandou e o começo do texto, como
 * no grupo ("A mensagem de Pedro Henrique “Gente, vocês viram isso…”"). Nunca
 * "mensagem 1": a criança não numera mensagens. Sempre "a mensagem", feminino,
 * para os adjetivos concordarem (link e comunicado também são mensagens no
 * grupo).
 */
export function referenciaDa(m: Pick<MensagemDoPacote, "remetente" | "texto">): string {
  const palavras = m.texto.replace(/\s+/g, " ").trim().split(" ");
  const inicio = palavras
    .slice(0, PALAVRAS_DO_INICIO)
    .join(" ")
    .replace(/[,.;:!?…]+$/u, "");
  const reticencias = palavras.length > PALAVRAS_DO_INICIO ? "…" : "";
  return `A mensagem de ${m.remetente} “${inicio}${reticencias}”`;
}

/**
 * Os pares (operador, operador) de cada mensagem: dois operadores diferentes
 * por mensagem e cada operador duas vezes no cartão. Toda escolha assim é uma
 * permutação de [E, OU, NAO] para a 1ª frase de cada mensagem mais um
 * deslocamento (1 ou 2) para a 2ª — o sorteio escolhe uma das doze.
 */
function paresDeOperadores(aleatorio: () => number): [Operador, Operador][] {
  const primeiros = embaralhar(OPERADORES, aleatorio);
  const desloca = aleatorio() < 0.5 ? 1 : 2;
  return primeiros.map((op, i) => [op, primeiros[(i + desloca) % primeiros.length] as Operador]);
}

function sortear<T>(lista: readonly T[], aleatorio: () => number): T {
  return lista[Math.min(lista.length - 1, Math.floor(aleatorio() * lista.length))] as T;
}

function textoDaFrase(m: MensagemDoCartao, operador: Operador, esperado: Resposta, aleatorio: () => number): string {
  const ref = referenciaDa(m);
  if (operador === "NAO") {
    // "NÃO é A" é certa quando A é o valor que a mensagem NÃO tem.
    const eixoVeracidade = aleatorio() < 0.5;
    const real = eixoVeracidade ? m.veracidade : m.tom;
    const outro = eixoVeracidade ? OUTRA_VERACIDADE[m.veracidade] : OUTRO_TOM[m.tom];
    return `${ref} NÃO é ${esperado === "sim" ? outro : real}.`;
  }

  /* E e OU: um valor de cada eixo. Quais dos dois batem com a mensagem decide
     a resposta — E é certa só com os dois; OU é errada só sem nenhum. */
  const combinacoes: readonly (readonly [boolean, boolean])[] =
    operador === "E"
      ? esperado === "sim"
        ? [[true, true]]
        : [
            [true, false],
            [false, true],
            [false, false],
          ]
      : esperado === "sim"
        ? [
            [true, true],
            [true, false],
            [false, true],
          ]
        : [[false, false]];
  const [bateVeracidade, bateTom] = sortear(combinacoes, aleatorio);
  const v = bateVeracidade ? m.veracidade : OUTRA_VERACIDADE[m.veracidade];
  const t = bateTom ? m.tom : OUTRO_TOM[m.tom];
  return `${ref} é ${v} ${operador} ${t}.`;
}

/**
 * A resposta CERTA de uma frase, recalculada do zero a partir do gabarito: é o
 * que o teste usa para conferir `esperado` sem confiar no gerador.
 */
export function avaliarFrase(
  m: Pick<MensagemDoPacote, "veracidade" | "tom">,
  operador: Operador,
  a: Veracidade | Tom,
  b?: Veracidade | Tom,
): Resposta {
  const tem = (valor: Veracidade | Tom) => valor === m.veracidade || valor === m.tom;
  if (operador === "NAO") return tem(a) ? "nao" : "sim";
  if (b === undefined) throw new Error("E e OU ligam dois valores");
  const certa = operador === "E" ? tem(a) && tem(b) : tem(a) || tem(b);
  return certa ? "sim" : "nao";
}

/** A semente do cartão: a SESSÃO. O mesmo estudante, pacote e rodada — as mesmas frases. */
export function sementeDoCartao(escolaId: string, estudanteId: string, pacote: { id: string; rodada: number }): string {
  return `${escolaId}:${estudanteId}:${pacote.id}:${pacote.rodada}`;
}

/**
 * As seis frases das três mensagens que o estudante encaminhou. `semente` é a
 * sessão (`sementeDoCartao`): a mesma sessão, as mesmas frases, na mesma ordem.
 */
export function frasesDoCartao(mensagens: readonly MensagemDoCartao[], semente: string): FraseDoCartao[] {
  if (mensagens.length !== 3) throw new Error("o cartão lê exatamente as 3 mensagens encaminhadas");
  const aleatorio = aleatorioDe(`exp05ef1b:operacoes:${semente}`);
  const pares = paresDeOperadores(aleatorio);
  const respostas = embaralhar<Resposta>(["sim", "sim", "sim", "nao", "nao", "nao"], aleatorio);

  const frases = mensagens.flatMap((m, i) => {
    const [op1, op2] = pares[i] as [Operador, Operador];
    return [
      { m, operador: op1, esperado: respostas[i * 2] as Resposta },
      { m, operador: op2, esperado: respostas[i * 2 + 1] as Resposta },
    ].map(({ m: msg, operador, esperado }) => ({
      operador,
      msgId: msg.id,
      esperado,
      texto: textoDaFrase(msg, operador, esperado, aleatorio),
    }));
  });
  /* A ordem final também é sorteada: as duas frases da mesma mensagem não
     ficam sempre coladas, e a posição não vira pista. */
  return embaralhar(frases, aleatorio).map((f, i) => ({ id: `f${i + 1}`, ...f }));
}

/** Acertos: a resposta enviada igual à esperada, frase a frase (pelo `id`). */
export function acertosDoCartao(frases: readonly FraseDoCartao[], respostas: ReadonlyMap<string, Resposta>): number {
  return frases.filter((f) => respostas.get(f.id) === f.esperado).length;
}

/** Os acertos por operador — informação para o professor, fora do nível. */
export function acertosPorOperador(
  frases: readonly FraseDoCartao[],
  respostas: ReadonlyMap<string, Resposta>,
): Record<Operador, number> {
  const conta: Record<Operador, number> = { E: 0, OU: 0, NAO: 0 };
  for (const f of frases) if (respostas.get(f.id) === f.esperado) conta[f.operador] += 1;
  return conta;
}

/**
 * A RÉGUA da EF05CO03: 5 ou 6 acertos atingem, 3 ou 4 estão em processo, 0 a
 * 2 não atingem. Ao acaso: 10,9% / 54,7% / 34,4% (o teste enumera as 64
 * combinações de respostas). Cartão não enviado não chega aqui: é "Não
 * avaliado", a ausência de marca.
 */
export function nivelCO03(acertos: number): Nivel {
  if (!Number.isInteger(acertos) || acertos < 0 || acertos > TOTAL_DE_FRASES) {
    throw new Error(`acertos fora de 0..${TOTAL_DE_FRASES}`);
  }
  if (acertos >= 5) return "atingiu";
  if (acertos >= 3) return "em_processo";
  return "nao_atingiu";
}
