import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { ManifestoIaTurmasController } from "./manifesto-ia-turmas.controller";
import { ManifestoIaController } from "./manifesto-ia.controller";
import { ManifestoIaService } from "./manifesto-ia.service";
import { PreparoDaExp08ef4bService } from "./preparo.service";

/**
 * Lado server da exp08ef4b. Prisma e Auth são globais.
 *
 * **`AiModule` entra, e a fronteira dele é estreita de propósito.** A IA existe
 * numa superfície só — a preparação docente pré-aula, em `PreparoDaExp08ef4bService`
 * — e o motor de sala é 100% determinístico: réplicas da máquina, cláusulas e o
 * manifesto compilado saem do pacote da turma ou do catálogo curado.
 *
 * A consequência prática é a que a banca registrou como ponto forte do insumo:
 * uma turma de 35 estudantes às 8h da manhã não gasta um token e não depende de
 * o Vertex responder. Se um dia alguém precisar de IA em sala aqui, essa é uma
 * decisão de produto com ADR — não uma injeção a mais neste módulo.
 *
 * Sem `AssetsModule`: os dois áudios da missão (o alerta de Amara e o
 * mini-podcast) moram no bucket de mídia e chegam por URL. A transcrição
 * integral do podcast está no catálogo, e é ela que a tela mostra hoje.
 */
@Module({
  imports: [AiModule],
  controllers: [ManifestoIaController, ManifestoIaTurmasController],
  providers: [ManifestoIaService, PreparoDaExp08ef4bService],
  exports: [ManifestoIaService],
})
export class ManifestoIaModule {}
