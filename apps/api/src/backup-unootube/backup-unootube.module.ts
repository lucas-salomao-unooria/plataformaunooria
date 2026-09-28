import { Module } from "@nestjs/common";
import { BackupUnootubeProfessorController } from "./backup-unootube-professor.controller";
import { BackupUnootubeTurmasController } from "./backup-unootube-turmas.controller";
import { BackupUnootubeController } from "./backup-unootube.controller";
import { BackupUnootubeService } from "./backup-unootube.service";

/**
 * Lado server do UnooTube ARQUIVADO (backup-exp04ef1b). Prisma e Auth são módulos globais.
 *
 * **Este módulo NÃO está no `app.module`, de propósito.** Arquivar é tirar do
 * produto sem apagar: o código continua compilando e os testes continuam
 * rodando contra `backup_exp04ef1b_sessoes`, mas nenhuma rota é servida —
 * ninguém joga uma experiência arquivada. Ver `AGENTS.md` desta pasta.
 */
@Module({
  controllers: [BackupUnootubeController, BackupUnootubeTurmasController, BackupUnootubeProfessorController],
  providers: [BackupUnootubeService],
  exports: [BackupUnootubeService],
})
export class BackupUnootubeModule {}
