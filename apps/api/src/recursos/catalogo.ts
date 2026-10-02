import { z } from "zod";

/**
 * O VOCABULÁRIO DOS RECURSOS — o que o painel da Unooria pode ligar e desligar.
 *
 * Um "recurso" é uma unidade com interruptor, e existem dois tipos:
 *
 *   - `produto:<slug>`        — o produto inteiro (o card do hub do professor)
 *   - `experiencia:<expId>`   — uma experiência dentro de um produto
 *
 * O id é TEXTO com prefixo, e não duas colunas (`tipo` + `alvo`), porque a
 * chave da decisão é sempre o par (recurso, escopo): com duas colunas todo
 * `findMany`, todo índice único e toda comparação do resolvedor passariam a
 * carregar as duas, e o `@@unique` teria três campos com um deles nulável — o
 * desenho em que o Postgres já não garante unicidade (ver a migration).
 *
 * NÃO CONFUNDA com os outros dois eixos que decidem se uma missão abre:
 *
 *   | eixo             | pergunta                              | quem decide |
 *   |------------------|---------------------------------------|-------------|
 *   | catálogo         | que forma a experiência tem?          | o manifesto |
 *   | liberação        | está aberta NESTA TURMA? (ADR-69)     | professor   |
 *   | disponibilidade  | existe NESTA REDE?                    | Unooria     |
 *
 * Disponibilidade é PRÉ-CONDIÇÃO de liberação, nunca o contrário.
 */

/**
 * Os produtos da plataforma. CÓPIA DELIBERADA do slug de
 * `apps/hub/lib/produtos.ts`, pelo mesmo motivo de `PERFIS`/`Papel`: aquele
 * arquivo carrega a COPY (nome, chamada, descrição, rótulo do botão) e é
 * compilado no bundle do hub; este carrega só o vocabulário e a composição.
 * Juntar os dois arrastaria texto de interface para dentro da api ou a
 * composição para dentro de um bundle client.
 *
 * O que segura a divergência é o `Record` exaustivo do lado do hub (produto sem
 * copy não compila) e o teste `manifestos-declaram-produto.spec.ts` deste lado
 * (experiência apontando para produto que não existe aqui não passa).
 */
export const PRODUTOS = [
  "entre-redes",
  "plano-de-aula",
  "plano-de-ensino",
  "bem-estar",
  /* O primeiro produto SEM experiência: a superfície é o botão flutuante do
     layout do professor, e a api o tranca pela classe com `@Produto(...)`
     (`comum/disponibilidade.guard.ts`). No painel aparece com `experiencias: []`
     — a composição é derivada de `experiencias.produto`, e nenhuma aponta
     para ele. Contrato: `docs/regras/agente-professor.md`. */
  "agente-professor",
  /* A Ajuda com avatar (ADR-132): também SEM experiência. A superfície é o item
     "Ajuda" do menu da conta, em TODAS as áreas menos a do estudante, e a api
     tranca `POST /ajuda/sessoes` pela classe com `@Produto("ajuda")`. */
  "ajuda",
] as const;

export type Produto = (typeof PRODUTOS)[number];

export const ProdutoSchema = z.enum(PRODUTOS);

/** Os dois tipos de recurso. Fechado: id fora disto é erro de programação. */
export const TIPOS_DE_RECURSO = ["produto", "experiencia"] as const;
export type TipoDeRecurso = (typeof TIPOS_DE_RECURSO)[number];

/**
 * O formato de um `recurso_id`. O CHECK da migration cobra o MESMO padrão, e o
 * teste `disponibilidades-postgres.spec.ts` prende os dois — divergir aqui dá
 * 500 no `PUT` com o motivo visível só no log da api, que é exatamente como o
 * vocabulário de `permissoes` já quebrou um deploy inteiro.
 */
export const RECURSO_ID_RE = /^(produto|experiencia):[a-z0-9-]+$/;

export const RecursoIdSchema = z
  .string()
  .regex(RECURSO_ID_RE, "recurso no formato produto:<slug> ou experiencia:<expId>");

export function recursoDoProduto(produto: Produto): string {
  return `produto:${produto}`;
}

export function recursoDaExperiencia(expId: string): string {
  return `experiencia:${expId}`;
}

/** `null` quando o id não segue o vocabulário — linha antiga, id escrito à mão
 *  em SQL. Dado real, não exceção: quem resolve trata como "não decidido". */
export function partesDoRecurso(
  recursoId: string,
): { tipo: TipoDeRecurso; alvo: string } | null {
  const casou = RECURSO_ID_RE.exec(recursoId);
  if (!casou) return null;
  const [tipo, alvo] = recursoId.split(":") as [TipoDeRecurso, string];
  return { tipo, alvo };
}
