import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: o processo responde. */
  @Get("healthz")
  healthz() {
    return { ok: true };
  }

  /** Readiness: o banco responde. */
  @Get("readyz")
  async readyz() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch {
      throw new ServiceUnavailableException("banco indisponível");
    }
  }
}
