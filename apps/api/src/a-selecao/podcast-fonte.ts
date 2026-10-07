import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { FonteDoPodcast } from "../podcast/fonte";
import { PodcastService } from "../podcast/podcast.service";
import { ASelecaoService, EXP_ID } from "./a-selecao.service";
import {
  FALANTES_DO_PODCAST,
  FALAS_DO_TEMA_PADRAO,
  VAGAS_DO_PODCAST,
  VOZ_DO_PODCAST,
  roteiroDoPodcast,
  type FalasDoTema,
} from "./podcast";

/**
 * A A Seleção no podcast da plataforma (ADR-150). O roteiro é o de
 * `podcast.ts`; as três falas do tema NÃO passam pela tabela
 * `podcast_roteiros` nem pela escrita do módulo `podcast`: elas nascem no LOTE
 * do preparo e moram na cobertura (`exp07ef1b_coberturas.podcast`, ADR-119),
 * revisadas pela professora na customização. Por isso a fonte não tem
 * `escrita`, e a atividade traz as falas como `falasProprias`.
 */
export function fonteDoPodcastDaExp07ef1b(selecao: Pick<ASelecaoService, "coberturaParaMidia">): FonteDoPodcast {
  return {
    expId: EXP_ID,
    titulo: "A Seleção — o podcast de recapitulação",
    descricao: "Lucas e Clara · cerca de 3 min 45 s",
    falantes: FALANTES_DO_PODCAST,
    voz: VOZ_DO_PODCAST,
    vagas: VAGAS_DO_PODCAST,
    falasPadrao: { ...FALAS_DO_TEMA_PADRAO },
    roteiro: (falas) => roteiroDoPodcast(falas as FalasDoTema),
    async atividade(escolaId, turmaId, professorId, atividadeId) {
      const cobertura = await selecao.coberturaParaMidia(escolaId, turmaId, professorId, atividadeId);
      return { id: cobertura.id, tema: cobertura.tema, padrao: false, falasProprias: { ...cobertura.podcast } };
    },
  };
}

/** Registra a fonte na subida — o `PodcastService` não importa missão nenhuma. */
@Injectable()
export class PodcastDaExp07ef1b implements OnModuleInit {
  constructor(
    private readonly podcast: PodcastService,
    private readonly selecao: ASelecaoService,
  ) {}

  onModuleInit(): void {
    this.podcast.registrarFonte(fonteDoPodcastDaExp07ef1b(this.selecao));
  }
}
