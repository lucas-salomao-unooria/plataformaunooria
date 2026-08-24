import { Inject, Injectable } from '@nestjs/common';

import { AI_PROVIDER, type AiProvider } from '../ai/provider';
import { AssetsService } from '../assets/assets.service';
import type { Antagonismo, LoteSpec, ProgressoGeracao } from '../comum/insta/tipos';
import { PrismaService } from '../prisma/prisma.service';

import { filaOrfa, progressoDaAtividade } from './progresso';
import { destilarAntagonismo, type EntradaDestilacao } from './prompts/destilacao';
import { GeracaoWorker } from './worker';

/**
 * Casca NestJS do pipeline de geração de conteúdo (docs 05 e 07). As decisões
 * de produto vivem em `worker.ts`/`plano.ts`/`progresso.ts`, portados do
 * origem; aqui só se resolve a injeção (PrismaService, AI_PROVIDER,
 * AssetsService) e se expõe a superfície que os controllers usam.
 *
 * Não há retomada no boot: o origem também não a tinha — a fila órfã é
 * retomada pelo polling de progresso do painel (`filaOrfa` + disparo), e a
 * reciclagem por `updatedAt` devolve à fila o que uma instância morta deixou
 * "rodando".
 */
@Injectable()
export class GeracaoService {
  private readonly worker: GeracaoWorker;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    assets: AssetsService,
  ) {
    this.worker = new GeracaoWorker({ prisma, provider, assets });
  }

  /** Passo 2 do doc 05: pergunta-chave + destilação dos dois lados. */
  destilar(entrada: EntradaDestilacao): Promise<Antagonismo> {
    return destilarAntagonismo(this.provider, entrada);
  }

  /**
   * Enfileira a geração (personas → lotes → validação) e dispara o worker.
   * Os lotes vêm de `planejarLotes` (`./plano`), calculados por quem cria a
   * atividade — o servidor decide o mix, a IA só preenche.
   */
  async iniciarGeracao(escolaId: string, activityId: string, lotes: LoteSpec[]): Promise<void> {
    await this.worker.enfileirarGeracao(escolaId, activityId, lotes);
    this.worker.dispararWorker(escolaId, activityId);
  }

  /** Dispara (ou retoma) o worker sem mexer na fila — regeneração avulsa, retomada. */
  dispararWorker(escolaId: string, activityId: string): void {
    this.worker.dispararWorker(escolaId, activityId);
  }

  /** Há worker desta atividade acordado NESTA instância? */
  workerAtivo(activityId: string): boolean {
    return this.worker.workerAtivo(activityId);
  }

  /**
   * Progresso para o polling do painel — e, como no endpoint do origem, retoma
   * a fila que ficou órfã (status `gerando` sem worker acordado após restart).
   */
  async progresso(escolaId: string, activityId: string): Promise<ProgressoGeracao> {
    const progresso = await progressoDaAtividade(this.prisma, escolaId, activityId);
    if (filaOrfa(activityId, progresso.status)) {
      this.worker.dispararWorker(escolaId, activityId);
    }
    return progresso;
  }
}
