import "server-only";
import {
  SignJWT,
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  importPKCS8,
  type JWK,
  type KeyLike,
} from "jose";
import type { Papel } from "./papeis";

/**
 * O HUB é o emissor dos tokens que a api valida (RS256 + JWKS servido em
 * `/.well-known/jwks.json`). Quando o WSO2 entrar, o emissor troca por config
 * na API — este módulo continua existindo só se o hub precisar assinar algo.
 *
 * Chave: `TOKEN_SIGNING_KEY_PEM` (PKCS#8). Sem ela, em dev, gera-se um par
 * efêmero (cacheado em globalThis para sobreviver ao hot reload); a api
 * refaz o fetch do JWKS quando vê um `kid` desconhecido, então reiniciar o
 * hub em dev não trava nada. Em produção a env é obrigatória.
 */

const TTL_SEGUNDOS = 15 * 60;

interface MaterialDeChave {
  privateKey: KeyLike;
  publicJwk: JWK & { kid: string };
}

declare global {
  var __chaveTokenHub: Promise<MaterialDeChave> | undefined;
}

async function carregarMaterial(): Promise<MaterialDeChave> {
  const pem = process.env.TOKEN_SIGNING_KEY_PEM;
  let privateKey: KeyLike;
  let publicJwk: JWK;

  if (pem) {
    privateKey = await importPKCS8(pem.replace(/\\n/g, "\n"), "RS256");
    const { createPublicKey } = await import("node:crypto");
    publicJwk = (await exportJWK(createPublicKey(pem.replace(/\\n/g, "\n")))) as JWK;
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TOKEN_SIGNING_KEY_PEM é obrigatória em produção");
    }
    console.warn("[chave-token] TOKEN_SIGNING_KEY_PEM ausente — usando par RS256 efêmero (dev)");
    const par = await generateKeyPair("RS256");
    privateKey = par.privateKey;
    publicJwk = (await exportJWK(par.publicKey)) as JWK;
  }

  const kid = await calculateJwkThumbprint(publicJwk);
  return { privateKey, publicJwk: { ...publicJwk, kid, alg: "RS256", use: "sig" } };
}

function material(): Promise<MaterialDeChave> {
  globalThis.__chaveTokenHub ??= carregarMaterial();
  return globalThis.__chaveTokenHub;
}

export interface ClaimsDeExperiencia {
  sub: string;
  escola_id: string;
  turma_id?: string;
  perfil: Papel;
}

/** Token de curta duração entregue à experiência via `hub:init`/`hub:token`
 *  e usado pelo BFF nas chamadas server-side à api. */
export async function assinarTokenExperiencia(claims: ClaimsDeExperiencia): Promise<string> {
  const { privateKey, publicJwk } = await material();
  return new SignJWT({
    escola_id: claims.escola_id,
    ...(claims.turma_id ? { turma_id: claims.turma_id } : {}),
    perfil: claims.perfil,
  })
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setSubject(claims.sub)
    .setIssuer(process.env.HUB_ORIGIN ?? "http://localhost:3000")
    .setAudience("plataforma-api")
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEGUNDOS}s`)
    .sign(privateKey);
}

export async function jwksPublico(): Promise<{ keys: JWK[] }> {
  const { publicJwk } = await material();
  return { keys: [publicJwk] };
}

/**
 * Assina um PERFIL PORTÁTIL — o documento que a criança leva ao sair da rede.
 *
 * Reusa a MESMA chave dos tokens de experiência, e por isso nenhum material de
 * chave novo entrou por causa deste recurso: a api de destino já sabe procurar
 * o JWKS em `/.well-known/jwks.json` da origem que assinou.
 *
 * O payload é `{ hash }`, não o documento: assim o arquivo entregue à família
 * fica LEGÍVEL (`{ perfil, assinatura }`), e a assinatura cobre o hash canônico
 * do perfil. `aud: "perfil-portatil"` separa esta assinatura da de token de
 * experiência — a mesma chave, dois usos que nunca podem ser confundidos um
 * pelo outro.
 *
 * Sem prazo de validade: um documento de portabilidade é como um histórico
 * escolar em papel — ele não caduca, e a data de emissão está no próprio
 * documento para quem precisar julgar se está velho.
 */
export async function assinarPerfilPortatil(hash: string): Promise<string> {
  const { privateKey, publicJwk } = await material();
  return new SignJWT({ hash })
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setIssuer(process.env.HUB_ORIGIN ?? "http://localhost:3000")
    .setAudience("perfil-portatil")
    .setIssuedAt()
    .sign(privateKey);
}
