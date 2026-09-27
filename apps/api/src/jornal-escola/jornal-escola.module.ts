import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AssetsModule } from "../assets/assets.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { DiagramacaoService } from "./diagramacao.service";
import { JornalEscolaProfessorController } from "./jornal-escola-professor.controller";
import { JornalEscolaTurmasController } from "./jornal-escola-turmas.controller";
import { JornalEscolaController } from "./jornal-escola.controller";
import { JornalEscolaService } from "./jornal-escola.service";
import { MidiaDaExp04ef1bService } from "./midia.service";
import { PreparoDaExp04ef1bService } from "./preparo.service";

/**
 * Lado server da exp04ef1b — Jornal da Escola: A Edição de Bento. Prisma e
 * Auth são globais.
 *
 * **`EvidenciasModule` entra** porque a missão tem ficha pedagógica (E14): o
 * service registra o contexto de P1/P2 no `onModuleInit` e marca as três ações
 * dentro das transações do latch e da Chave. As equipes NÃO entram como módulo:
 * o painel lê `equipes/consulta.ts`, funções livres sobre o `tx`.
 *
 * **`AiModule` entra em TRÊS superfícies, e só nelas.** Duas são do professor,
 * antes da aula: o rascunho do pacote (`preparo.service.ts`) e as imagens das
 * notícias (`midia.service.ts`). A terceira é a diagramação em sala
 * (`diagramacao.service.ts`): a IA escolhe UM layout do enum, com teto de tempo
 * e o modelo automático de reserva. O resto da aula (a mesa, as pistas, o
 * latch, o resultado, a Chave, a revisão) é determinístico, e nenhuma criança
 * espera o Vertex para ver a próxima tela.
 *
 * **`AssetsModule`** é o bucket das imagens (`experiencias/exp04ef1b/jornal/`).
 */
@Module({
  imports: [AiModule, AssetsModule, EvidenciasModule],
  controllers: [JornalEscolaController, JornalEscolaTurmasController, JornalEscolaProfessorController],
  providers: [JornalEscolaService, DiagramacaoService, PreparoDaExp04ef1bService, MidiaDaExp04ef1bService],
  exports: [JornalEscolaService],
})
export class JornalEscolaModule {}
