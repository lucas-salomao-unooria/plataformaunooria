import { Module } from "@nestjs/common";
import { BemEstarController } from "./bemestar.controller";
import { BemEstarService } from "./bemestar.service";

/** Lado server da app-91-bem-estar. Prisma, Auth e Ai são módulos globais. */
@Module({
  controllers: [BemEstarController],
  providers: [BemEstarService],
  exports: [BemEstarService],
})
export class BemEstarModule {}
