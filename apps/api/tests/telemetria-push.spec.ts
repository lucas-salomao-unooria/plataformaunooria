import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PubSubPushGuard } from "../src/telemetry/pubsub-push.guard";

/**
 * Teste de contrato do `POST /telemetry/ingest`: a rota grava evento de estudante,
 * não passa pelo OidcGuard e fica exposta na internet atrás do Load Balancer.
 * O que se garante aqui é que ela FALHA FECHADA — uma env faltando desliga a
 * rota, nunca a abre.
 *
 * A verificação da assinatura em si (JWKS do Google) não é exercitada: exigiria
 * um servidor de JWKS falso, e o que ela faz é o próprio `jose`, já testado.
 * O que é nosso, e o que quebra em silêncio numa refatoração, é a decisão de
 * fechar quando falta configuração.
 */
function guard(config: Record<string, string | undefined>) {
  return new PubSubPushGuard({ get: (chave: string) => config[chave] } as unknown as ConfigService);
}

function contexto(headers: Record<string, string> = {}) {
  return { switchToHttp: () => ({ getRequest: () => ({ headers }) }) } as never;
}

const CONFIGURADO = {
  TELEMETRIA_PUSH_SA: "plataforma-unooria-dev-push@entre-redes.iam.gserviceaccount.com",
  TELEMETRIA_PUSH_AUDIENCE: "https://api-plataforma.unooria.com",
};

describe("PubSubPushGuard", () => {
  it("sem TELEMETRIA_PUSH_SA a rota fica fechada, não aberta", async () => {
    await expect(guard({ ...CONFIGURADO, TELEMETRIA_PUSH_SA: undefined }).canActivate(contexto()))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("sem TELEMETRIA_PUSH_AUDIENCE a rota fica fechada", async () => {
    await expect(
      guard({ ...CONFIGURADO, TELEMETRIA_PUSH_AUDIENCE: undefined }).canActivate(contexto()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("configurado, mas sem Authorization, recusa", async () => {
    await expect(guard(CONFIGURADO).canActivate(contexto())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("token que não é do Google é recusado", async () => {
    // Assinatura inválida: nem chega a bater `email`/`aud`.
    await expect(
      guard(CONFIGURADO).canActivate(contexto({ authorization: "Bearer aaa.bbb.ccc" })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
