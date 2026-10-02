import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AssetsModule } from "../assets/assets.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { JuriEstadualProfessorController } from "./juri-estadual-professor.controller";
import { JuriEstadualTurmasController } from "./juri-estadual-turmas.controller";
import { JuriEstadualController } from "./juri-estadual.controller";
import { JuriEstadualService } from "./juri-estadual.service";
import { MidiaDaExp06ef1bService } from "./midia.service";
import { PreparoDaExp06ef1bService } from "./preparo.service";

/**
 * Lado server da exp06ef1b — O Júri Estadual de Projetos. Prisma e Auth são
 * globais.
 *
 * **`EvidenciasModule` entra** porque a missão tem ficha pedagógica (E14): o
 * service registra o contexto das enquetes no `onModuleInit` e marca as três
 * ações dentro das transações da revisão do voto, dos pacotes e da cadeia. As
 * equipes NÃO entram como módulo: o painel lê `equipes/consulta.ts`, funções
 * livres sobre o `tx`.
 *
 * **`AiModule` entra em DUAS superfícies, as duas do professor, antes da aula**:
 * o rascunho da mostra (`preparo.service.ts`) e as imagens dos estandes
 * (`midia.service.ts`). A aula inteira (o feed, o voto, a galeria, os pacotes, a
 * cadeia) é determinística, e nenhuma criança espera o Vertex.
 *
 * **`AssetsModule`** é o bucket das imagens (`experiencias/exp06ef1b/mostra/`).
 */
@Module({
  imports: [AiModule, AssetsModule, EvidenciasModule],
  controllers: [JuriEstadualController, JuriEstadualTurmasController, JuriEstadualProfessorController],
  providers: [JuriEstadualService, PreparoDaExp06ef1bService, MidiaDaExp06ef1bService],
  exports: [JuriEstadualService],
})
export class JuriEstadualModule {}
