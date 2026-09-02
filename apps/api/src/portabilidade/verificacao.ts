import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { hashDoPerfil, type PerfilPortatil } from "./regras";
import { logger } from "../observabilidade/logger";

/**
 * Conferir a assinatura de um documento emitido por OUTRA instalação.
 *
 * **Quem assina é o hub; quem verifica é a api.** A assimetria é de propósito:
 * assinar exige a chave privada, que só o hub tem (é a mesma que assina os
 * tokens de experiência e é publicada em `/.well-known/jwks.json` — nenhum
 * material de chave novo entrou por causa deste recurso). Verificar exige só a
 * chave pública, e tem de acontecer no lugar que NÃO confia em quem chama: se a
 * api recebesse o veredito pronto, bastaria um gestor forjar o campo para um
 * documento adulterado entrar marcado como conferido.
 *
 * ## A allowlist é a decisão de confiança
 *
 * O `emissor.hub` vem de dentro do arquivo, ou seja, de um desconhecido. Buscar
 * JWKS na URL que um arquivo mandou é SSRF. Por isso só se busca em origem
 * declarada em `PORTABILIDADE_EMISSORES` — **o documento SELECIONA entre origens
 * que o operador escreveu; ele nunca introduz uma URL.**
 *
 * Cada entrada é `origem` ou `origem=urlDoJwks`:
 *
 * ```
 * PORTABILIDADE_EMISSORES=https://hub.outra-rede.gov.br
 * PORTABILIDADE_EMISSORES=http://localhost:3000=http://hub:3000/.well-known/jwks.json
 * ```
 *
 * A segunda forma existe porque o `emissor.hub` do documento é o endereço do
 * NAVEGADOR — é a mesma distinção de `EXP_INTERNAL_HOST`, e pela mesma razão:
 * de dentro do contêiner da api, `localhost:3000` é a própria api. Sem ela o
 * caminho criptográfico seria impossível de exercer fora de produção, e a
 * garantia mais importante do recurso ficaria sem prova no ambiente onde se
 * trabalha todo dia.
 *
 * ## Canal
 *
 * O JWKS é buscado por https. Fora de produção, http é aceito e AVISADO: quem
 * escreveu a entrada foi o operador, no servidor, e em dev o tráfego não sai da
 * máquina. Em produção, http é recusado — a chave pública viria por um canal que
 * qualquer um reescreve, e aí a verificação não prova nada.
 */

export type Veredito =
  | { estado: "verificada" }
  | { estado: "nao-verificada"; motivo: string }
  | { estado: "invalida"; motivo: string };

/**
 * De onde saem as chaves públicas do emissor. Por padrão, o JWKS remoto dele.
 *
 * O parâmetro existe para o TESTE poder exercer o caminho criptográfico sem
 * servidor nenhum no ar.
 */
export type ResolvedorDeChaves = (urlDoJwks: string) => JWTVerifyGetKey;

export interface OpcoesDeVerificacao {
  /** Em produção, JWKS só por https. */
  producao?: boolean;
  chaves?: ResolvedorDeChaves;
  avisar?: (mensagem: string) => void;
}

const jwksPorUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const jwksRemoto: ResolvedorDeChaves = (url) => {
  let jwks = jwksPorUrl.get(url);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksPorUrl.set(url, jwks);
  }
  return jwks;
};

/** `origem` → URL do JWKS. Entrada sem `=` deriva o caminho padrão. */
export function emissoresDeclarados(lista: string | undefined): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const bruta of (lista ?? "").split(",")) {
    const entrada = bruta.trim();
    if (!entrada) continue;
    const corte = entrada.indexOf("=");
    const origem = (corte === -1 ? entrada : entrada.slice(0, corte)).trim().replace(/\/+$/, "");
    const jwks =
      corte === -1
        ? `${origem}/.well-known/jwks.json`
        : entrada.slice(corte + 1).trim();
    if (origem && jwks) mapa.set(origem, jwks);
  }
  return mapa;
}

function origemDe(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export async function verificarAssinatura(
  perfil: PerfilPortatil,
  assinatura: string,
  emissoresPermitidos: string | undefined,
  opcoes: OpcoesDeVerificacao = {},
): Promise<Veredito> {
  const { producao = false, chaves = jwksRemoto, avisar = (m: string) => logger.warn({ codigo: "portabilidade.aviso" }, m) } = opcoes;

  const origem = origemDe(perfil.emissor.hub);
  if (!origem) {
    return { estado: "nao-verificada", motivo: "o emissor não declara uma origem válida" };
  }

  const declarados = emissoresDeclarados(emissoresPermitidos);
  if (declarados.size === 0) {
    return {
      estado: "nao-verificada",
      motivo: "esta instalação não tem emissores configurados (PORTABILIDADE_EMISSORES)",
    };
  }
  const urlDoJwks = declarados.get(origem);
  if (!urlDoJwks) {
    return {
      estado: "nao-verificada",
      motivo: `${origem} não está entre os emissores configurados`,
    };
  }

  if (!urlDoJwks.startsWith("https://")) {
    if (producao) {
      return {
        estado: "nao-verificada",
        motivo: `em produção o JWKS só é buscado por https (${urlDoJwks})`,
      };
    }
    avisar(`[portabilidade] JWKS por http (${urlDoJwks}) — aceito só fora de produção`);
  }

  let carga: Record<string, unknown>;
  try {
    const { payload } = await jwtVerify(assinatura, chaves(urlDoJwks), {
      issuer: perfil.emissor.hub,
      audience: "perfil-portatil",
    });
    carga = payload as Record<string, unknown>;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    const codigo = (erro as { code?: unknown })?.code;

    /* CLASSIFICAR PELO CÓDIGO, NUNCA PELO TEXTO.
       Uma versão anterior olhava a mensagem e caía na palavra "failed" — que é
       exatamente o que a jose escreve em "signature verification failed". O
       resultado seria o pior erro possível neste recurso: documento FORJADO
       entrando marcado como "não deu para conferir", em vez de recusado.
       Agora: o que a jose classifica (tem `code`) é veredito criptográfico e
       recusa; transporte (sem `code`, ou timeout do JWKS) degrada. */
    const ehTransporte = typeof codigo !== "string" || codigo === "ERR_JWKS_TIMEOUT";
    if (ehTransporte) {
      return { estado: "nao-verificada", motivo: `não foi possível falar com ${origem}` };
    }
    /* `ERR_JWKS_NO_MATCHING_KEY` entra aqui de propósito: nós FALAMOS com o
       emissor e as chaves que ele publica não respondem por este documento.
       Pode ser rotação de chave, e ainda assim a resposta certa é recusar — ele
       que reemita. Aceitar seria dizer "confiro" sem ter conferido. */
    return { estado: "invalida", motivo: mensagem };
  }

  if (carga.hash !== hashDoPerfil(perfil)) {
    return {
      estado: "invalida",
      motivo: "a assinatura não corresponde ao conteúdo do documento",
    };
  }
  return { estado: "verificada" };
}
