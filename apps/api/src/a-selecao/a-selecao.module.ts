import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AssetsModule } from "../assets/assets.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { ASelecaoProfessorController } from "./a-selecao-professor.controller";
import { ASelecaoTurmasController } from "./a-selecao-turmas.controller";
import { ASelecaoController } from "./a-selecao.controller";
import { ASelecaoService } from "./a-selecao.service";
import { ClassificacaoService } from "./classificacao.service";
import { MidiaDaExp07ef1bService } from "./midia.service";
import { PodcastDaExp07ef1bService } from "./podcast.service";
import { PreparoDaExp07ef1bService } from "./preparo.service";

/**
 * Lado server da exp07ef1b. Prisma e Auth são globais.
 *
 * **`EvidenciasModule` entra** porque esta missão tem ficha pedagógica
 * (E14): o service registra o contexto das enquetes no
 * `onModuleInit` e marca a EF07CO11 depois do latch. As equipes NÃO entram
 * como módulo: o painel e o pareamento leem `equipes/consulta.ts`, que são
 * funções livres sobre o `tx` — o desenho que evita a dependência esquecida.
 *
 * **`AiModule` entra em TRÊS superfícies, e só nelas.** Duas são do professor,
 * antes da aula: o rascunho da cobertura (`preparo.service.ts`) e as imagens
 * dos posts (`midia.service.ts`). A terceira é o Canal A
 * (`classificacao.service.ts`): a legenda graduada depois do latch, com teto
 * de tempo e sem falar com a criança — e, falhando, sem marcar nada. O resto da
 * aula (o feed, o latch, a matriz, o pareamento, o Mural) é determinístico, e
 * nenhuma criança espera o Vertex para ver a próxima tela.
 *
 * **`AssetsModule`** é o bucket das imagens (`experiencias/exp07ef1b/selecao/`).
 * É global, e entra aqui por extenso para a dependência ficar à vista.
 */
@Module({
  imports: [AiModule, AssetsModule, EvidenciasModule],
  controllers: [ASelecaoController, ASelecaoTurmasController, ASelecaoProfessorController],
  providers: [
    ASelecaoService,
    ClassificacaoService,
    PreparoDaExp07ef1bService,
    MidiaDaExp07ef1bService,
    PodcastDaExp07ef1bService,
  ],
  exports: [ASelecaoService],
})
export class ASelecaoModule {}
