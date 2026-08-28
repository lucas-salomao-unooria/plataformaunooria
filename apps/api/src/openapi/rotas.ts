import { RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from "@nestjs/common/constants";
import type { DiscoveryService } from "@nestjs/core";
import { ROLES_KEY } from "../auth/roles";
import type { Perfil } from "../auth/claims";
import { CONTRATO_KEY, type OpcoesDoContrato } from "./contrato";

export type RotaDescoberta = {
  /** `GET`, `POST`, ... */
  metodo: string;
  /** Caminho no dialeto do OpenAPI: `/turmas/{id}/matriculas`, não `:id`. */
  caminho: string;
  /** `TurmasController.minhas` — é o que aparece quando a trava falha. */
  origem: string;
  /** Código de sucesso REAL: o `@HttpCode`, ou o padrão do verbo. */
  status: number;
  /** Vazio = qualquer papel autenticado (só `OidcGuard`). */
  perfis: readonly Perfil[];
  /** Nomes das classes de guard aplicadas (classe + método). */
  guards: readonly string[];
  contrato?: OpcoesDoContrato;
};

/** Junta os pedaços de caminho e traduz `:id` para `{id}`. */
function montarCaminho(...pedacos: string[]): string {
  const junto = pedacos
    .flatMap((p) => p.split("/"))
    .filter((p) => p.length > 0)
    .join("/");
  return "/" + junto.replace(/:([^/]+)/g, "{$1}");
}

function comoLista(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === "string");
  return [];
}

function nomesDeGuard(alvo: object): string[] {
  const bruto = Reflect.getMetadata(GUARDS_METADATA, alvo) as unknown;
  if (!Array.isArray(bruto)) return [];
  return bruto.map((g) => {
    // `@UseGuards` aceita a classe ou uma instância dela.
    if (typeof g === "function") return g.name;
    if (g && typeof g === "object") return g.constructor.name;
    return String(g);
  });
}

/** O código que o Nest devolve quando o handler não diz nada. */
const PADRAO_DO_VERBO: Record<string, number> = { POST: 201 };

/**
 * Todas as rotas registradas, com o que cada uma declarou sobre si.
 *
 * É a fonte única de três consumidores que precisam concordar: o documento
 * OpenAPI, a trava de cobertura (`tests/openapi-cobertura.spec.ts`) e o gerador
 * do apêndice C. Se cada um percorresse as rotas do seu jeito, o documento
 * poderia listar uma rota que a trava não vê — e a trava serve exatamente para
 * isso não acontecer.
 *
 * Percorre pelo `DiscoveryService` (API pública do Nest) e não pelo `_router`
 * do express: o roteador só guarda o handler já embrulhado, e a metadata do
 * `@Contrato` e do `@Roles` mora no método ORIGINAL do controller.
 */
export function listarRotas(discovery: DiscoveryService): RotaDescoberta[] {
  const rotas: RotaDescoberta[] = [];

  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;

    const prototipo = Object.getPrototypeOf(instance) as object;
    const caminhosDoController = comoLista(Reflect.getMetadata(PATH_METADATA, metatype));
    const guardsDaClasse = nomesDeGuard(metatype);

    for (const nome of Object.getOwnPropertyNames(prototipo)) {
      if (nome === "constructor") continue;
      const handler = (prototipo as Record<string, unknown>)[nome];
      if (typeof handler !== "function") continue;

      const verbo = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      if (verbo === undefined) continue;
      const metodo = RequestMethod[verbo];

      const contrato = Reflect.getMetadata(CONTRATO_KEY, handler) as OpcoesDoContrato | undefined;
      const perfis = (Reflect.getMetadata(ROLES_KEY, handler) ??
        Reflect.getMetadata(ROLES_KEY, metatype) ??
        []) as Perfil[];
      const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) as number | undefined;
      const guards = [...guardsDaClasse, ...nomesDeGuard(handler)];

      for (const base of caminhosDoController.length > 0 ? caminhosDoController : [""]) {
        const sufixos = comoLista(Reflect.getMetadata(PATH_METADATA, handler));
        for (const sufixo of sufixos.length > 0 ? sufixos : [""]) {
          rotas.push({
            metodo,
            caminho: montarCaminho(base, sufixo),
            origem: `${metatype.name}.${nome}`,
            status: httpCode ?? PADRAO_DO_VERBO[metodo] ?? 200,
            perfis,
            guards,
            contrato,
          });
        }
      }
    }
  }

  return rotas.sort((a, b) => a.caminho.localeCompare(b.caminho) || a.metodo.localeCompare(b.metodo));
}

/** A chave estável de uma rota, usada na lista de pendências e nas mensagens. */
export const chaveDaRota = (r: Pick<RotaDescoberta, "metodo" | "caminho">) =>
  `${r.metodo} ${r.caminho}`;
