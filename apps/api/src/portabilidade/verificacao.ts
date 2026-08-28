import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { hashDoPerfil, type PerfilPortatil } from "./regras";

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
 * SSRF: o `emissor.hub` vem de dentro do arquivo, ou seja, de um desconhecido.
 * Só se busca JWKS em origem que esteja em `PORTABILIDADE_EMISSORES`. Env vazia
 * = nenhuma verificação de rede acontece e TUDO entra como `nao-verificada` —
 * degradar visivelmente é melhor que recusar o direito do titular, e melhor
 * ainda que sair buscando URL que um arquivo mandou.
 */

export type Veredito =
  | { estado: "verificada" }
  | { estado: "nao-verificada"; motivo: string }
  | { estado: "invalida"; motivo: string };

const jwksPorOrigem = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function origensPermitidas(lista: string | undefined): Set<string> {
  return new Set(
    (lista ?? "")
      .split(",")
      .map((o) => o.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

function origemDe(url: string): string | null {
  try {
    const u = new URL(url);
    /* Só HTTPS: JWKS por HTTP é chave pública buscada num canal que qualquer um
       reescreve, e aí a verificação não prova nada. */
    if (u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * De onde saem as chaves públicas do emissor. Por padrão, o JWKS remoto dele.
 *
 * O parâmetro existe para o TESTE poder exercer o caminho criptográfico — que é
 * o único ponto do recurso onde errar em silêncio seria grave — sem depender de
 * um servidor https no ar. Em dev o hub é http, e a regra de só buscar JWKS por
 * https (que não se afrouxa) tornaria essa garantia impossível de verificar.
 */
export type ResolvedorDeChaves = (origem: string) => JWTVerifyGetKey;

const jwksRemoto: ResolvedorDeChaves = (origem) => {
  let jwks = jwksPorOrigem.get(origem);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${origem}/.well-known/jwks.json`));
    jwksPorOrigem.set(origem, jwks);
  }
  return jwks;
};

export async function verificarAssinatura(
  perfil: PerfilPortatil,
  assinatura: string,
  emissoresPermitidos: string | undefined,
  chaves: ResolvedorDeChaves = jwksRemoto,
): Promise<Veredito> {
  const origem = origemDe(perfil.emissor.hub);
  if (!origem) {
    return { estado: "nao-verificada", motivo: "o emissor não declara uma origem https" };
  }

  const permitidas = origensPermitidas(emissoresPermitidos);
  if (permitidas.size === 0) {
    return {
      estado: "nao-verificada",
      motivo: "esta instalação não tem emissores configurados (PORTABILIDADE_EMISSORES)",
    };
  }
  if (!permitidas.has(origem)) {
    return {
      estado: "nao-verificada",
      motivo: `${origem} não está entre os emissores configurados`,
    };
  }

  let carga: Record<string, unknown>;
  try {
    const { payload } = await jwtVerify(assinatura, chaves(origem), {
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
