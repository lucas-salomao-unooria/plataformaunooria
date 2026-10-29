import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { FonteDoPodcast } from "../podcast/fonte";
import { PodcastService } from "../podcast/podcast.service";
import { EXP_ID } from "./conteudo";
import { FALANTES_DO_PODCAST, FALAS_DO_TEMA_PADRAO, VAGAS_DO_PODCAST, VOZ_DO_PODCAST, roteiroDoPodcast } from "./podcast";
import { PortaVozDosDadosService } from "./porta-voz-dos-dados.service";

/**
 * O Porta-Voz dos Dados no podcast da plataforma (ADR-150): a atividade é o
 * PACOTE homologado (o pedido, ou o em andamento), e o roteiro é FIXO — sem
 * vaga, `padrao` sempre verdade, sem `escrita` (`POST …/falas-do-tema` responde
 * 404 para esta missão, de propósito). Só o professor o ouve (decisão 1).
 */
export function fonteDoPodcastDaExp03em1b(missao: PortaVozDosDadosService): FonteDoPodcast {
  return {
    expId: EXP_ID,
    titulo: "Por Trás do Gráfico: Quem Controla o Eixo?",
    descricao: "Alex e Sam · cerca de 3 min 40 s",
    falantes: FALANTES_DO_PODCAST,
    voz: VOZ_DO_PODCAST,
    vagas: VAGAS_DO_PODCAST,
    falasPadrao: { ...FALAS_DO_TEMA_PADRAO },
    roteiro: roteiroDoPodcast,
    async atividade(escolaId, turmaId, professorId, atividadeId) {
      const pacote = await missao.pacoteParaPodcast(escolaId, turmaId, professorId, atividadeId);
      return { id: pacote.id, tema: pacote.tema, padrao: true };
    },
  };
}

/** Registra a fonte na subida — o `PodcastService` não importa missão nenhuma. */
@Injectable()
export class PodcastDaExp03em1b implements OnModuleInit {
  constructor(
    private readonly podcast: PodcastService,
    private readonly missao: PortaVozDosDadosService,
  ) {}

  onModuleInit(): void {
    this.podcast.registrarFonte(fonteDoPodcastDaExp03em1b(this.missao));
  }
}
