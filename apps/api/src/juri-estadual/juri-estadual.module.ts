import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AssetsModule } from "../assets/assets.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { ImagensDoBancoPadraoService } from "./banco-padrao-imagens.service";
import { JuriEstadualBancoPadraoController } from "./juri-estadual-banco-padrao.controller";
import { JuriEstadualProfessorController } from "./juri-estadual-professor.controller";
import { JuriEstadualTurmasController } from "./juri-estadual-turmas.controller";
import { JuriEstadualController } from "./juri-estadual.controller";
import { JuriEstadualService } from "./juri-estadual.service";
import { MidiaDaExp06ef1bService } from "./midia.service";
import { PodcastDaExp06ef1b } from "./podcast-fonte";
import { PreparoDaExp06ef1bService } from "./preparo.service";

/**
 * Lado server da exp06ef1b — O Júri Estadual de Projetos. Prisma e Auth são
 * globais.
 *
 * **`EvidenciasModule` entra** porque a missão tem ficha pedagógica (E14): o
 * service registra o contexto das enquetes no `onModuleInit` e marca as três
 * ações dentro das transações da revisão do voto (EF06CO10 e EF06CO01) e da
 * cadeia (EF06CO03). As
 * equipes NÃO entram como módulo: o painel lê `equipes/consulta.ts`, funções
 * livres sobre o `tx`.
 *
 * **`AiModule` entra em TRÊS superfícies, nenhuma durante a aula**: o rascunho
 * da mostra (`preparo.service.ts`) e as imagens dos estandes
 * (`midia.service.ts`), do professor; e as imagens do BANCO PADRÃO
 * (`banco-padrao-imagens.service.ts`), do `admin`. A aula inteira (o feed, o
 * voto, a galeria, a cadeia) é determinística, e nenhuma criança espera o
 * Vertex.
 *
 * **`AssetsModule`** é o bucket das imagens (`experiencias/exp06ef1b/mostra/`).
 *
 * **`PodcastService`** (global) é o podcast de recapitulação da plataforma
 * (ADR-150, ADR-151): a missão registra a fonte (`podcast-fonte.ts`) e a
 * homologação grava as falas do tema que o professor revisou.
 */
@Module({
  imports: [AiModule, AssetsModule, EvidenciasModule],
  controllers: [
    JuriEstadualController,
    JuriEstadualTurmasController,
    JuriEstadualProfessorController,
    JuriEstadualBancoPadraoController,
  ],
  providers: [
    JuriEstadualService,
    PreparoDaExp06ef1bService,
    MidiaDaExp06ef1bService,
    ImagensDoBancoPadraoService,
    PodcastDaExp06ef1b,
  ],
  exports: [JuriEstadualService],
})
export class JuriEstadualModule {}
