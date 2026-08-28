import type { INestApplication } from "@nestjs/common";
import { DiscoveryService } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import type {
  OperationObject,
  ParameterObject,
} from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { ZodUndefined, ZodVoid } from "zod";
import { chaveDaRota, listarRotas, type RotaDescoberta } from "./rotas";
import { queryParaParametros, zodParaOpenApi } from "./zod-para-openapi";

export const ESQUEMA_BEARER = "token-da-plataforma";

const DESCRICAO = `
API da Plataforma Unooria. Um contrato = uma stack; dentro dela, as escolas
compartilham o banco com isolamento lógico por \`escola_id\` e Row-Level Security.

**Autenticação.** Quase toda rota exige o token da plataforma no cabeçalho
\`Authorization: Bearer\`. Ele é assinado pelo hub (RS256, 15min) e traz
\`{sub, escola_id, turma_id?, perfil}\`. Para experimentar aqui, pegue um token
de uma sessão do hub e cole em **Authorize**.

**Papéis.** \`aluno\`, \`professor\`, \`gestor\` e \`admin-contrato\` — este último é a
única exceção que atravessa escolas. Cada operação diz quais aceita; sem essa
linha, qualquer papel autenticado passa.

**O que este documento não consegue dizer.** Restrições escritas em \`.refine()\`
não têm tradução em JSON Schema e aparecem como texto em _Restrições_, não como
esquema. A validação continua sendo a do Zod.
`.trim();

/** A etiqueta da operação: o primeiro segmento do caminho (`/turmas/{id}` → `turmas`). */
const etiquetaDe = (caminho: string) => caminho.split("/").filter(Boolean)[0] ?? "raiz";

function descricaoDaOperacao(rota: RotaDescoberta): string {
  const partes: string[] = [];
  const c = rota.contrato;
  if (c?.descricao) partes.push(c.descricao);

  if (c?.acesso === "publica") {
    partes.push("**Acesso:** rota pública, sem _guard_ — deliberadamente.");
  } else if (c?.acesso === "servico") {
    partes.push(
      "**Acesso:** chave de serviço em cabeçalho, não token de pessoa. Com a variável de ambiente ausente a rota responde **503**.",
    );
  } else if (c?.acesso === "token-no-corpo") {
    partes.push(
      "**Acesso:** o token vai no CORPO, não no cabeçalho — `navigator.sendBeacon` não manda cabeçalho. Verificado à mão, com o mesmo rigor do `OidcGuard`.",
    );
  } else if (c?.acesso === "push") {
    partes.push(
      "**Acesso:** _push_ do Pub/Sub (ID token do Google). Com as variáveis ausentes a rota responde **401**, nunca aberta.",
    );
  } else if (rota.perfis.length > 0) {
    partes.push(`**Papéis:** ${rota.perfis.join(", ")}.`);
  } else {
    partes.push("**Papéis:** qualquer papel autenticado.");
  }

  if (c?.notas?.length) {
    partes.push(["**Restrições:**", ...c.notas.map((n) => `- ${n}`)].join("\n"));
  }
  return partes.join("\n\n");
}

/**
 * `OperationObject` do swagger não conhece as extensões `x-`, embora o OpenAPI
 * as permita em qualquer objeto. O tipo local acrescenta as duas que usamos —
 * sem `any`, e sem afrouxar o resto da operação.
 */
type OperacaoComExtensoes = OperationObject & {
  "x-papeis": string[];
  "x-acesso": string;
};

function montarOperacao(rota: RotaDescoberta, atual: OperationObject): OperacaoComExtensoes {
  const c = rota.contrato;
  if (!c) return { ...atual, "x-papeis": [...rota.perfis], "x-acesso": "token" };

  const parametros: ParameterObject[] = [];
  if (c.params) {
    for (const p of queryParaParametros(c.params)) {
      // Parâmetro de caminho é sempre obrigatório — o OpenAPI exige isso, e um
      // `required: false` aqui torna o documento inválido.
      parametros.push({ name: p.nome, in: "path", required: true, schema: p.esquema });
    }
  }
  if (c.query) {
    for (const p of queryParaParametros(c.query)) {
      parametros.push({ name: p.nome, in: "query", required: p.obrigatorio, schema: p.esquema });
    }
  }

  // Resposta declarada como `z.void()` é 204 de verdade: o OpenAPI descreve
  // isso como resposta SEM `content`. Emitir um `content` com esquema vazio
  // faria o "Try it out" mostrar um corpo que nunca chega.
  const semCorpo = c.resposta instanceof ZodVoid || c.resposta instanceof ZodUndefined;

  const operacao: OperacaoComExtensoes = {
    ...atual,
    tags: [etiquetaDe(rota.caminho)],
    summary: c.resumo,
    description: descricaoDaOperacao(rota),
    parameters: parametros,
    responses: {
      [String(c.status ?? rota.status)]: semCorpo
        ? { description: "Sucesso, sem corpo." }
        : {
            description: "Sucesso.",
            content: {
              [c.tipoDaResposta ?? "application/json"]: {
                schema: zodParaOpenApi(c.resposta, "saida"),
              },
            },
          },
    },
    // Rota pública não carrega esquema de segurança; as de serviço e de push
    // não usam o Bearer da plataforma e são descritas na prosa.
    security: c.acesso && c.acesso !== "token" ? [] : [{ [ESQUEMA_BEARER]: [] }],
    /**
     * Extensões `x-`: a autorização em forma LEGÍVEL POR MÁQUINA, além da prosa.
     *
     * Existem para o gerador do apêndice C não ter de reler a `description`
     * procurando "**Papéis:**". Um gerador que faz parsing da própria prosa
     * quebra na primeira vez que alguém reescreve a frase — e quebra em
     * silêncio, produzindo uma tabela de autorização errada, que é o pior
     * defeito possível num catálogo de rotas.
     */
    "x-papeis": [...rota.perfis],
    "x-acesso": c.acesso ?? "token",
  };

  if (c.corpo) {
    operacao.requestBody = {
      required: true,
      content: {
        [c.tipoDoCorpo ?? "application/json"]: { schema: zodParaOpenApi(c.corpo, "entrada") },
      },
    };
  }

  return operacao;
}

/**
 * O documento OpenAPI da api.
 *
 * O esqueleto (quais caminhos existem, com que verbo) vem do
 * `SwaggerModule.createDocument`, que lê o roteador do Nest — é a única fonte
 * que não pode inventar uma rota que não existe. O CONTEÚDO de cada operação
 * vem do `@Contrato` do método, via `listarRotas`.
 *
 * As duas travessias precisam concordar, e a função CONFERE isso: caminho que
 * `listarRotas` monta e o esqueleto não tem é erro alto aqui, não uma operação
 * silenciosamente sem descrição. Sem essa conferência, um dia em que o Nest
 * mudasse a forma de compor prefixo de controller o documento continuaria
 * subindo, só que vazio — e o "Try it out" mandaria requisição para um caminho
 * que não responde.
 */
export function construirDocumento(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Plataforma Unooria — API")
    .setDescription(DESCRICAO)
    .setVersion(process.env.npm_package_version ?? "0.1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      ESQUEMA_BEARER,
    )
    .build();

  const documento = SwaggerModule.createDocument(app, config);
  const rotas = listarRotas(app.get(DiscoveryService));

  const semEsqueleto: string[] = [];
  for (const rota of rotas) {
    const caminho = documento.paths[rota.caminho];
    const verbo = rota.metodo.toLowerCase() as keyof typeof caminho;
    const operacao = caminho?.[verbo] as OperationObject | undefined;
    if (!operacao) {
      semEsqueleto.push(`${chaveDaRota(rota)} (${rota.origem})`);
      continue;
    }
    (caminho as Record<string, unknown>)[verbo] = montarOperacao(rota, operacao);
  }

  if (semEsqueleto.length > 0) {
    throw new Error(
      "As rotas descobertas não batem com o roteador do Nest — `listarRotas` e " +
        "`createDocument` divergiram ao montar o caminho:\n  " +
        semEsqueleto.join("\n  "),
    );
  }

  return documento;
}
