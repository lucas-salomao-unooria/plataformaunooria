import { Global, Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AssetsModule } from "../assets/assets.module";
import { EscritaDasFalasService } from "./escrita.service";
import { PodcastController } from "./podcast.controller";
import { PodcastService } from "./podcast.service";

/**
 * O podcast de recapitulação como recurso da plataforma (ADR-150). Prisma e
 * Auth são globais.
 *
 * Exporta o `PodcastService` porque é a porta das MISSÕES: o módulo de uma
 * missão com podcast o injeta para `registrarFonte` (na subida). As falas
 * aprovadas a homologação grava com `gravarFalasDoPodcast`, função livre sobre
 * o `tx` dela. A dependência vai num sentido só — este módulo não sabe que
 * missão existe.
 *
 * **Global, e o ÚLTIMO do `app.module`.** Importado pelas missões, ele entraria
 * no roteador junto com a primeira delas e reordenaria o `docs/openapi.json`
 * inteiro (e o apêndice C) a cada missão nova com podcast.
 */
@Global()
@Module({
  imports: [AiModule, AssetsModule],
  controllers: [PodcastController],
  providers: [PodcastService, EscritaDasFalasService],
  exports: [PodcastService],
})
export class PodcastModule {}
