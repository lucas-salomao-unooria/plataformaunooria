import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Tranca do `POST /telemetry/ingest`, o consumo da push subscription do Pub/Sub.
 *
 * A rota grava evento de aluno e NÃO passa pelo OidcGuard — quem chama é o
 * Pub/Sub, não um usuário, e não existe token do hub nessa chamada. Com a api
 * publicada atrás do Load Balancer, sem esta verificação qualquer um na
 * internet poderia injetar telemetria falsa em qualquer escola (o `escolaId`
 * vem no corpo, já enriquecido pelo `/telemetry/batch`).
 *
 * O Pub/Sub assina cada push com um ID token do Google (`oidc_token` da
 * subscription — ver `pubsub.tf` no repo de infra). Verificamos três coisas:
 * emissor Google, `aud` igual à audience configurada na subscription, e
 * `email` igual à SA de push. As três juntas é que fazem a prova; a assinatura
 * sozinha só diz "algum projeto GCP", que não é ninguém em particular.
 *
 * FALHA FECHADA: sem `TELEMETRIA_PUSH_SA`/`TELEMETRIA_PUSH_AUDIENCE` a rota
 * rejeita tudo, em vez de ficar aberta. Em dev não há Pub/Sub e nada chega
 * aqui (`TELEMETRIA_TOPIC` vazio = eventos só no console).
 */
const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

@Injectable()
export class PubSubPushGuard implements CanActivate {
  private readonly logger = new Logger(PubSubPushGuard.name);
  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  private getJwks() {
    this.jwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URI));
    return this.jwks;
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const saEsperada = this.config.get<string>("TELEMETRIA_PUSH_SA");
    const audience = this.config.get<string>("TELEMETRIA_PUSH_AUDIENCE");
    if (!saEsperada || !audience) {
      this.logger.warn("/telemetry/ingest sem TELEMETRIA_PUSH_SA/AUDIENCE — rota desligada");
      throw new UnauthorizedException();
    }

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!token) throw new UnauthorizedException();

    try {
      const { payload } = await jwtVerify(token, this.getJwks(), {
        issuer: GOOGLE_ISSUERS,
        audience,
      });
      if (payload.email !== saEsperada || payload.email_verified !== true) {
        throw new Error(`identidade inesperada no push (esperada ${saEsperada})`);
      }
    } catch (err: unknown) {
      // Sem token e sem PII no log (regra 6): só o motivo.
      this.logger.warn(`push rejeitado: ${err instanceof Error ? err.message : "erro desconhecido"}`);
      throw new UnauthorizedException();
    }
    return true;
  }
}
