import { ITENS_DO_PACOTE, LIMITES, type ConteudoDoPacote, type ItemDoPacote } from "../conteudo";
import { ConteudoDoPacoteSchema } from "../contrato-de-rotas";

/**
 * A RÉGUA DO PACOTE — a mesma para o banco padrão (o teste), para a saída da
 * IA do preparo (`prompts.ts#validarSaidaDoPreparo`), para o item regenerado,
 * para o texto que o professor edita e para a homologação. Devolve TODAS as
 * frases de uma vez — é o professor quem lê. Puro.
 *
 * O que ela garante, além da forma e dos limites do contrato:
 *
 * - **O pacote não antecipa a inferência.** A descoberta da missão é que o
 *   assistente decide pelo HORÁRIO e pela CONEXÃO (E4). Um enunciado, uma
 *   dúvida ou uma resposta que fale de horário, madrugada, noite, conexão,
 *   sinal, internet ou rede entregaria a pista antes da aposta — e o pacote é
 *   a única parte da missão que muda com o tema. As fichas, os avisos de
 *   sistema e a bancada são fixos e ficam FORA desta régua (são eles que
 *   revelam).
 * - **As dúvidas são cinco perguntas diferentes** (o Thiago pergunta três
 *   vezes; repetidas, o limite da 3ª mensagem pareceria bug) e as duas trilhas
 *   têm títulos diferentes (o rebaixamento precisa ser visível).
 */

/** Os termos que entregariam a inferência. Sem acento e em minúsculas: o texto é normalizado antes. */
export const TERMOS_PROIBIDOS = /\b(horarios?|madrugadas?|noites?|noturn[oa]s?|conexao|conexoes|sinal|sinais|internet|redes?)\b/;

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR");

/** O primeiro termo proibido que o texto cita, ou `null`. */
export function termoProibido(texto: string): string | null {
  const m = TERMOS_PROIBIDOS.exec(normalizar(texto));
  return m ? m[1]! : null;
}

/** O nome do item na tela do professor (as frases da régua falam a língua da curadoria). */
export const ROTULO_DO_ITEM: Readonly<Record<ItemDoPacote, string>> = {
  trilhaAvancada: "a Trilha Avançada",
  reforcoBasico: "o Reforço Básico",
  "duvidas.lucas": "a dúvida do Lucas",
  "duvidas.beatriz": "a dúvida da Beatriz",
  "duvidas.thiago1": "a 1ª dúvida do Thiago",
  "duvidas.thiago2": "a 2ª dúvida do Thiago",
  "duvidas.thiago3": "a 3ª dúvida do Thiago",
  "respostas.lucas": "a resposta ao Lucas",
  "respostas.beatriz": "a resposta à Beatriz",
  "respostas.thiago1": "a 1ª resposta ao Thiago",
  "respostas.thiago2": "a 2ª resposta ao Thiago",
  "respostas.thiago3": "a 3ª resposta ao Thiago",
  leitura: "a Leitura Recomendada",
};

/** O valor de um item: os que têm título são `{titulo, texto}`; os outros, só o texto. */
export type ValorDoItem = { titulo?: string; texto: string };

/** Os itens com título (as trilhas e a leitura). */
export function itemTemTitulo(item: ItemDoPacote): boolean {
  return item === "trilhaAvancada" || item === "reforcoBasico" || item === "leitura";
}

/** O limite do TEXTO de cada item (o título é sempre `LIMITES.titulo`). */
export function limiteDoItem(item: ItemDoPacote): number {
  if (item === "trilhaAvancada" || item === "reforcoBasico") return LIMITES.enunciado;
  if (item === "leitura") return LIMITES.resumo;
  return item.startsWith("duvidas.") ? LIMITES.duvida : LIMITES.resposta;
}

export function lerItem(c: ConteudoDoPacote, item: ItemDoPacote): ValorDoItem {
  switch (item) {
    case "trilhaAvancada":
      return { titulo: c.trilhaAvancada.titulo, texto: c.trilhaAvancada.enunciado };
    case "reforcoBasico":
      return { titulo: c.reforcoBasico.titulo, texto: c.reforcoBasico.enunciado };
    case "leitura":
      return { titulo: c.leitura.titulo, texto: c.leitura.resumo };
    default: {
      const [grupo, quem] = item.split(".") as ["duvidas" | "respostas", keyof ConteudoDoPacote["duvidas"]];
      return { texto: c[grupo][quem] };
    }
  }
}

/** O pacote com UM item trocado — cópia, sem mexer no original. O título ausente mantém o anterior. */
export function comItem(c: ConteudoDoPacote, item: ItemDoPacote, v: ValorDoItem): ConteudoDoPacote {
  const novo: ConteudoDoPacote = structuredClone(c);
  switch (item) {
    case "trilhaAvancada":
      novo.trilhaAvancada = { titulo: v.titulo ?? c.trilhaAvancada.titulo, enunciado: v.texto };
      break;
    case "reforcoBasico":
      novo.reforcoBasico = { titulo: v.titulo ?? c.reforcoBasico.titulo, enunciado: v.texto };
      break;
    case "leitura":
      novo.leitura = { titulo: v.titulo ?? c.leitura.titulo, resumo: v.texto };
      break;
    default: {
      const [grupo, quem] = item.split(".") as ["duvidas" | "respostas", keyof ConteudoDoPacote["duvidas"]];
      novo[grupo][quem] = v.texto;
    }
  }
  return novo;
}

/** O pacote "limpo": espaços colapsados em todo texto (a IA e o professor deixam quebras soltas). */
export function aparar(c: ConteudoDoPacote): ConteudoDoPacote {
  let novo = c;
  for (const item of ITENS_DO_PACOTE) {
    const v = lerItem(novo, item);
    const limpo = (t: string) => t.replace(/\s+/g, " ").trim();
    novo = comItem(novo, item, { ...(v.titulo !== undefined ? { titulo: limpo(v.titulo) } : {}), texto: limpo(v.texto) });
  }
  return novo;
}

/**
 * Os problemas do pacote, em frases para o professor. Vazio = homologável.
 * Recebe `unknown`: a forma também é régua (o JSON da IA, a linha antiga).
 */
export function problemasDoPacote(bruto: unknown): string[] {
  const forma = ConteudoDoPacoteSchema.safeParse(bruto);
  if (!forma.success) {
    return [...new Set(forma.error.issues.map((i) => `O campo ${i.path.join(".") || "pacote"} está fora do formato (${i.message}).`))];
  }
  const c = forma.data as ConteudoDoPacote;
  const p: string[] = [];
  for (const item of ITENS_DO_PACOTE) {
    const v = lerItem(c, item);
    for (const texto of [v.titulo, v.texto]) {
      if (texto === undefined) continue;
      const termo = termoProibido(texto);
      if (termo) {
        p.push(`${ROTULO_DO_ITEM[item][0]!.toLocaleUpperCase("pt-BR")}${ROTULO_DO_ITEM[item].slice(1)} cita "${termo}": o pacote não pode falar de horário nem de conexão, que é o que a turma vai descobrir.`);
        break;
      }
    }
  }
  const duvidas = Object.values(c.duvidas).map((d) => normalizar(d).replace(/\s+/g, " ").trim());
  if (new Set(duvidas).size !== duvidas.length) p.push("As cinco dúvidas do chat precisam ser perguntas diferentes.");
  if (normalizar(c.trilhaAvancada.titulo) === normalizar(c.reforcoBasico.titulo)) {
    p.push("A Trilha Avançada e o Reforço Básico precisam de títulos diferentes.");
  }
  return [...new Set(p)];
}
