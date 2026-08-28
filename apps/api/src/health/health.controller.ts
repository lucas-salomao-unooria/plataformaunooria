import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Contrato } from "../openapi/contrato";
import { SanidadeSchema } from "./contrato-de-rotas";

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: o processo responde. */
  @Get("healthz")
  @Contrato({
    resumo: "O processo está vivo.",
    descricao:
      "Não toca no banco de propósito: é a sonda que decide reiniciar o container, e um Postgres lento derrubaria um processo saudável.",
    resposta: SanidadeSchema,
    acesso: "publica",
  })
  healthz() {
    return { ok: true };
  }

  /** Readiness: o banco responde. */
  @Get("readyz")
  @Contrato({
    resumo: "As dependências estão prontas (banco).",
    descricao:
      "Banco fora do ar responde **503**, não `ok: false` — o balanceador tira a instância do rodízio pelo código, não pelo corpo.",
    resposta: SanidadeSchema,
    acesso: "publica",
  })
  async readyz() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch {
      throw new ServiceUnavailableException("banco indisponível");
    }
  }
}
