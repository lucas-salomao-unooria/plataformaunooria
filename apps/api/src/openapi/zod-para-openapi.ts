import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
// Import profundo porque `@nestjs/swagger` só reexporta `OpenAPIObject` da raiz
// (`dist/interfaces/index.d.ts`). É type-only: não cria acoplamento em runtime.
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

/**
 * Zod → JSON Schema, no dialeto que o OpenAPI 3.0 aceita.
 *
 * Esta é a única tradução do repo, e ela existe para o documento ser DERIVADO
 * do schema que a rota já usa para validar. Descrever o corpo de novo, à mão,
 * num `@ApiBody`, criaria uma segunda descrição das 146 rotas que ninguém
 * obriga a concordar com a primeira — a armadilha do `expires_at` que ficou no
 * schema depois que a rotina saiu do código.
 *
 * ## O que se PERDE na conversão, e por que está tudo bem
 *
 * `.refine()` e `.superRefine()` são funções JavaScript: JSON Schema não tem
 * como expressá-las, e a biblioteca as DESCARTA em silêncio. Não é um bug — é o
 * limite do formato. O `AjustarMatriculaSchema` exige "turmaDestinoId OU
 * principal" e essa exigência não aparece no documento.
 *
 * Por isso `@Contrato` tem o campo `notas`: restrição que o Zod sabe checar e o
 * JSON Schema não sabe dizer vira texto na descrição da operação. A validação
 * continua onde sempre esteve (a api recusa o corpo errado do mesmo jeito); o
 * que as `notas` consertam é o documento não MENTIR por omissão para quem lê.
 *
 * Não há `z.lazy` em lugar nenhum da api — por isso `$refStrategy: "none"`
 * (que estouraria em schema recursivo) é seguro, e o documento sai com os
 * esquemas embutidos em vez de `$ref`. Custa repetição no JSON e ganha um
 * documento que não depende de um registro de nomes estáveis.
 */
/**
 * As opções que este módulo usa — e a assinatura pela qual ele chama a
 * biblioteca.
 *
 * O `zodToJsonSchema` publicado declara o retorno como
 * `(Target extends "jsonSchema7" ? JsonSchema7Type : object) & { definitions?… }`,
 * e o `JsonSchema7Type` é uma união recursiva grande. Com `target: "openApi3"` o
 * resultado é só `object`, mas o compilador ainda instancia o outro ramo — e
 * estoura com **TS2589** ("type instantiation is excessively deep"), num erro
 * que aponta para a chamada e não diz nada sobre a causa.
 *
 * Fixar aqui a assinatura que de fato usamos resolve sem `any` e sem
 * `skipLibCheck` mentiroso: os tipos do NOSSO lado continuam todos concretos.
 * Some no dia em que a biblioteca simplificar o retorno.
 */
type OpcoesDaConversao = {
  target: "openApi3";
  $refStrategy: "none";
  errorMessages: boolean;
  pipeStrategy: "input" | "output";
  effectStrategy: "input" | "any";
};

const converter = zodToJsonSchema as unknown as (
  schema: ZodTypeAny,
  opcoes: OpcoesDaConversao,
) => Record<string, unknown>;

export function zodParaOpenApi(
  schema: ZodTypeAny,
  lado: "entrada" | "saida" = "entrada",
): SchemaObject {
  const convertido = converter(schema, {
    target: "openApi3",
    $refStrategy: "none",
    errorMessages: false,
    // Numa rota, o corpo é o que CHEGA e a resposta é o que SAI. Com
    // `.transform()` no meio (o `textoLivre` do bem-estar tem um), os dois lados
    // são tipos diferentes, e usar o de entrada nos dois descreveria a resposta
    // errada.
    pipeStrategy: lado === "entrada" ? "input" : "output",
    effectStrategy: lado === "entrada" ? "input" : "any",
  });
  // `$schema` é do JSON Schema, não do OpenAPI: deixá-lo faz validador de spec
  // reclamar de propriedade desconhecida.
  const { $schema: _ignorado, ...limpo } = convertido;
  return limpo as SchemaObject;
}

/**
 * Um schema de OBJETO Zod → uma entrada por chave, que é como o OpenAPI
 * descreve query string (um parâmetro por nome, não um objeto).
 *
 * Schema que não seja objeto no topo não tem tradução aqui e devolve lista
 * vazia — o `@Contrato` recusa isso antes, para o silêncio não passar.
 */
export function queryParaParametros(
  schema: ZodTypeAny,
): Array<{ nome: string; obrigatorio: boolean; esquema: SchemaObject }> {
  // Tipo local em vez de `SchemaObject & {...}`: o `SchemaObject` do swagger é
  // recursivo, e intersecioná-lo estoura o orçamento de profundidade do tsc
  // (TS2589) — com o erro aparecendo lá em cima, na chamada do
  // `zodToJsonSchema`, que não tem nada a ver.
  type RaizDeObjeto = {
    properties?: Record<string, SchemaObject>;
    required?: string[];
  };
  const raiz = zodParaOpenApi(schema, "entrada") as RaizDeObjeto;
  const propriedades = raiz.properties ?? {};
  const obrigatorias = new Set(raiz.required ?? []);
  return Object.entries(propriedades).map(([nome, esquema]) => ({
    nome,
    obrigatorio: obrigatorias.has(nome),
    esquema,
  }));
}
