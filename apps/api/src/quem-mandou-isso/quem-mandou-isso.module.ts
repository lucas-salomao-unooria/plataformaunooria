import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { PreparoDaExp05Service } from "./preparo.service";
import { QuemMandouIssoProfessorController } from "./quem-mandou-isso-professor.controller";
import { QuemMandouIssoTurmasController } from "./quem-mandou-isso-turmas.controller";
import { QuemMandouIssoController } from "./quem-mandou-isso.controller";
import { QuemMandouIssoService } from "./quem-mandou-isso.service";

/**
 * Lado server da exp-05-quem-mandou-isso. Prisma e Auth são globais.
 *
 * **`AiModule` entra, e a fronteira dele é estreita de propósito.** A IA existe
 * numa superfície só — a preparação docente pré-aula, em `PreparoDaExp05Service`
 * — e a AULA É 100% DETERMINÍSTICA: a curadoria, o latch, o histograma
 * anonimizado e o card de síntese saem do lote homologado e das regras puras de
 * `regras/`. Nenhum token é gasto com a turma na sala.
 *
 * A consequência prática é a que importa às oito da manhã: 30 crianças de 10
 * anos entram ao mesmo tempo, e nenhuma delas espera o Vertex responder. Se um
 * dia alguém precisar de IA em sala aqui, essa é uma decisão de produto com ADR
 * — não uma injeção a mais neste módulo.
 *
 * Sem `AssetsModule`, e a ausência é o desenho: **zero mídia binária**. O áudio
 * do grupo é transcrição com player simulado, a imagem é a legenda com o rótulo
 * da foto, e o link é um card de texto. Nenhum arquivo é servido.
 */
@Module({
  imports: [AiModule],
  controllers: [
    QuemMandouIssoController,
    QuemMandouIssoTurmasController,
    QuemMandouIssoProfessorController,
  ],
  providers: [QuemMandouIssoService, PreparoDaExp05Service],
  exports: [QuemMandouIssoService],
})
export class QuemMandouIssoModule {}
