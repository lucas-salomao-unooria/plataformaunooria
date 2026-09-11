import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AuthClaims, PERFIS, Perfil } from "./claims";
import { ehDoContrato } from "../auth/claims";

/**
 * Descreve por que um token foi rejeitado, sem nunca tocar no conteúdo dele.
 *
 * `jose` anexa ao erro um `code` (`ERR_JWS_SIGNATURE_VERIFICATION_FAILED`,
 * `ERR_JWT_CLAIM_VALIDATION_FAILED`, ...) e, em falha de claim, o `claim`
 * culpado. É o que distingue "issuer com uma barra a mais" de "escola_id
 * ausente" — indistinguíveis pela resposta 401, e os dois erros mais comuns ao
 * plugar um IdP novo.
 */
function descreverFalha(err: unknown): string {
  if (!(err instanceof Error)) return "erro desconhecido";
  const { code, claim } = err as Error & { code?: unknown; claim?: unknown };
  const partes = [typeof code === "string" ? code : err.name];
  if (typeof claim === "string") partes.push(`claim=${claim}`);
  partes.push(err.message);
  return partes.join(" ");
}

/**
 * Verificação de token isolada do guard para ser reutilizável onde não há
 * header Authorization — p.ex. `POST /telemetry/beacon`, que recebe o token no
 * corpo porque `sendBeacon` não envia headers.
 *
 * O JWKS é lazy e por instância do service (não no load do módulo): permite
 * injetar config em teste e não explode quando a env só existe no boot real.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  private getJwks() {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(this.config.getOrThrow<string>("OIDC_JWKS_URI")));
    }
    return this.jwks;
  }

  async verificar(token: string): Promise<AuthClaims> {
    try {
      const { payload } = await jwtVerify(token, this.getJwks(), {
        issuer: this.config.getOrThrow<string>("OIDC_ISSUER"),
        audience: this.config.getOrThrow<string>("OIDC_AUDIENCE"),
      });
      const perfil = payload["perfil"];
      if (!PERFIS.includes(perfil as Perfil)) throw new Error("claim perfil inválido");
      const claims: AuthClaims = {
        usuarioId: String(payload.sub ?? ""),
        escolaId: String(payload["escola_id"] ?? ""),
        turmaId: payload["turma_id"] ? String(payload["turma_id"]) : undefined,
        perfil: perfil as Perfil,
      };
      if (!claims.usuarioId) throw new Error("claim sub ausente");
      // Os perfis de CONTRATO (`gestor_contrato`, `admin`) são a única exceção
      // cross-escola (regra inviolável nº 1) — daí `ehDoContrato`, e não uma
      // comparação com um nome só (ADR-80).
      if (!claims.escolaId && !ehDoContrato(claims.perfil)) {
        throw new Error("claim escola_id ausente");
      }
      return claims;
    } catch (err: unknown) {
      // O motivo vai para o log; a resposta continua genérica. Sem PII e sem o
      // token em texto claro (regra 6 do CLAUDE.md).
      this.logger.warn(`Token rejeitado: ${descreverFalha(err)}`);
      throw new UnauthorizedException("Token inválido");
    }
  }
}
