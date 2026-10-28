import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AssetsModule } from "../assets/assets.module";
import { EvidenciasModule } from "../evidencias/evidencias.module";
import { ImagensDoBancoPadraoDaExp03ef1bService } from "./banco-padrao-imagens.service";
import { MidiaDaExp03ef1bService } from "./midia.service";
import { NinaNoticiaBancoPadraoController } from "./nina-noticia-banco-padrao.controller";
import { NinaNoticiaTurmasController } from "./nina-noticia-turmas.controller";
import { NinaNoticiaController } from "./nina-noticia.controller";
import { NinaNoticiaService } from "./nina-noticia.service";
import { PreparoDaExp03ef1bService } from "./preparo.service";

/**
 * Lado server da exp03ef1b — Nina e a Notícia que Desapareceu (ADR-197).
 * Prisma e Auth são globais.
 *
 * **`EvidenciasModule`**: a missão tem ficha (E14), e o service marca as cinco
 * ações dentro das transações delas. As equipes entram como funções livres
 * (`equipes/consulta.ts`), não como módulo.
 *
 * **`AiModule` em três superfícies, nenhuma durante a aula**: o rascunho das
 * notícias (`preparo.service.ts`) e as imagens do pacote (`midia.service.ts`),
 * da professora; e as imagens do BANCO PADRÃO (`banco-padrao-imagens.service.ts`),
 * do `admin`. A aula inteira é determinística.
 *
 * **`AssetsModule`** é o bucket das imagens (`experiencias/exp03ef1b/feira/`).
 */
@Module({
  imports: [AiModule, AssetsModule, EvidenciasModule],
  controllers: [NinaNoticiaController, NinaNoticiaTurmasController, NinaNoticiaBancoPadraoController],
  providers: [
    NinaNoticiaService,
    PreparoDaExp03ef1bService,
    MidiaDaExp03ef1bService,
    ImagensDoBancoPadraoDaExp03ef1bService,
  ],
  exports: [NinaNoticiaService],
})
export class NinaNoticiaModule {}
