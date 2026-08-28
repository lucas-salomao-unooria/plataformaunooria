import { SetMetadata } from "@nestjs/common";
import { ZodObject, type ZodTypeAny } from "zod";

export const CONTRATO_KEY = "contrato-da-rota";

/**
 * Como a rota é autorizada. Os PAPÉIS não estão aqui de propósito: eles já são
 * declarados por `@Roles(...)`, e repeti-los seria abrir espaço para o
 * documento dizer "gestor" enquanto o guard exige "admin-contrato". O
 * `documento.ts` lê o `@Roles` real.
 *
 * O que sobra é o que o `@Roles` não sabe dizer: se a rota é aberta de
 * propósito, ou se quem a chama é um serviço em vez de uma pessoa.
 */
export type Acesso =
  /** `OidcGuard`: exige o token da plataforma. O caso normal. */
  | "token"
  /** Sem guard, deliberadamente — `/healthz`, `/readyz`, `/auth/login`. */
  | "publica"
  /** Chave de serviço em cabeçalho; env ausente ⇒ 503. */
  | "servico"
  /** `PubSubPushGuard`: ID token do Google. Env ausente ⇒ 401. */
  | "push";

export type OpcoesDoContrato = {
  /** Uma linha. Vira o `summary` da operação e a coluna do apêndice C. */
  resumo: string;
  /** A prosa — por que a rota existe, o que ela recusa. Markdown. */
  descricao?: string;
  /**
   * Restrições que o Zod checa e o JSON Schema não sabe expressar — tudo que
   * mora num `.refine()`. Sem isto, o documento mente por omissão. Ver
   * `zod-para-openapi.ts`.
   */
  notas?: string[];
  corpo?: ZodTypeAny;
  /**
   * Só quando o corpo não é JSON. `POST /rostering/importar` recebe a planilha
   * como `text/csv` cru — anunciá-la como JSON faria o "Try it out" montar uma
   * requisição que a api recusa.
   */
  tipoDoCorpo?: string;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
  /** O que a rota devolve em caso de sucesso. Obrigatório: é o contrato. */
  resposta: ZodTypeAny;
  /** Só quando a resposta não é JSON (o modelo de planilha devolve `text/csv`). */
  tipoDaResposta?: string;
  /** Só quando o código de sucesso não é o padrão do verbo (ex.: 202). */
  status?: number;
  acesso?: Acesso;
};

/**
 * Declara o contrato HTTP de uma rota — e é só isso que ele faz.
 *
 * Repare que ele NÃO chama `@ApiOperation`/`@ApiBody`/`@ApiResponse`. A
 * primeira versão chamava, e tinha dois defeitos que não dava para consertar
 * ali dentro: um decorator não enxerga o verbo da rota (o `@Get`/`@Post` pode
 * ser aplicado depois dele, e a ordem de avaliação é de baixo para cima), então
 * ele teria de ADIVINHAR o código de sucesso — 200 ou 201 conforme o verbo, 200
 * de novo se houver `@HttpCode`. E ele também não enxerga o `@Roles`, que mora
 * no mesmo método mas é lido por outro decorator.
 *
 * Então aqui só ficam os dados, e quem monta a operação inteira é
 * `documento.ts`, que percorre as rotas JÁ REGISTRADAS e tem o verbo, o
 * `@HttpCode` e o `@Roles` à mão. O efeito colateral bom é que o teste de
 * cobertura, o documento e o interceptor leem exatamente a mesma metadata —
 * não há como o Swagger dizer uma coisa e a trava conferir outra.
 */
export const Contrato = (opcoes: OpcoesDoContrato): MethodDecorator => {
  // Falha ALTO, na subida, e não com uma query silenciosamente sem parâmetro:
  // `queryParaParametros` só sabe abrir objeto, e um `z.string()` passado aqui
  // sairia como lista vazia — a rota apareceria no documento sem filtro nenhum.
  if (opcoes.query && !(opcoes.query instanceof ZodObject)) {
    throw new TypeError(`Contrato "${opcoes.resumo}": query precisa ser z.object({...})`);
  }
  if (opcoes.params && !(opcoes.params instanceof ZodObject)) {
    throw new TypeError(`Contrato "${opcoes.resumo}": params precisa ser z.object({...})`);
  }
  return SetMetadata(CONTRATO_KEY, opcoes);
};
