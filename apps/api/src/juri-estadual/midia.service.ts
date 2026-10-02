import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { AssetsService } from "../assets/assets.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { erroDeJogo } from "./erros";
import { JuriEstadualService, type PacoteLido } from "./juri-estadual.service";
import { VERSAO_DO_PEDIDO_DE_IMAGEM, promptDaImagem } from "./prompts";
import { EXP_ID } from "./vocabulario";

/**
 * As IMAGENS dos estandes: geradas pelo professor no preparo, servidas a todos.
 * Molde: `jornal-escola/midia.service.ts` — INCREMENTAL (até duas novas por
 * chamada: o BFF do hub corta em 30 s), idempotente, com o custo estimado e o
 * `falharam[]`.
 *
 * **Sem imagem a missão roda igual**: o post chega com `imagem.url: null`, e a
 * experiência desenha a arte procedural do estande (o `alt` continua valendo).
 *
 * **O arquivo é o hash da DESCRIÇÃO** (`imagem.descricao`), em
 * `experiencias/exp06ef1b/mostra/`: a mesma cena gerada uma vez serve a toda
 * turma que a homologar, e uma descrição editada pelo professor é outro arquivo.
 */

/** Quantas imagens NOVAS por chamada. Cada uma leva de 5 a 10 s; o BFF corta em 30. */
export const IMAGENS_POR_CHAMADA = 2;

/**
 * Custo estimado por imagem, em tokens: a geração de imagem é cobrada por
 * imagem e não devolve contagem, e debitar zero faria a quota mentir.
 */
export const CUSTO_ESTIMADO_POR_IMAGEM = 2_000;

/** 800×600 (4:3), a foto do estande no post do Unoovista. */
export const TAMANHO_DA_IMAGEM = { largura: 800, altura: 600 } as const;

/**
 * Preparos em andamento NESTE processo, por pacote: dois cliques do mesmo
 * professor (ou duas abas) não geram a mesma imagem duas vezes. Lock de
 * processo, e não `pg_advisory_lock`: segurar uma transação pelos segundos da
 * geração sairia mais caro que a corrida rara entre instâncias.
 */
const emPreparo = new Map<string, Promise<ProgressoDaMidia>>();

export interface ProgressoDaMidia {
  pacoteId: string;
  total: number;
  prontas: number;
  faltam: number;
  geradas: string[];
  falharam: string[];
  completo: boolean;
  imagens: Record<string, string>;
}

/** O nome do arquivo no bucket, abaixo de `experiencias/exp06ef1b/`. */
export function nomeDaImagem(descricao: string): string {
  const hash = createHash("sha256").update(`${VERSAO_DO_PEDIDO_DE_IMAGEM}|${descricao.trim()}`).digest("hex");
  return `mostra/${hash.slice(0, 32)}.webp`;
}

@Injectable()
export class MidiaDaExp06ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
    private readonly quota: QuotaService,
    private readonly juri: JuriEstadualService,
  ) {}

  /**
   * Gera as próximas imagens que faltam no pacote. Idempotente: o que já está
   * no pacote é pulado, e o que já está no bucket (a mesma descrição, noutra
   * turma) entra DE GRAÇA, sem contar no lote.
   */
  async gerar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    usuarioId: string,
    perfil: Perfil,
    /** A atividade PRONTA sendo preparada; sem ela, a em andamento (ADR-130). */
    pacoteId?: string,
  ): Promise<ProgressoDaMidia> {
    const pacote = await this.juri.pacoteParaMidia(escolaId, turmaId, professorId, pacoteId);
    const emCurso = emPreparo.get(pacote.id);
    if (emCurso) return emCurso;

    const trabalho = this.gerarDeVerdade(escolaId, usuarioId, perfil, pacote).finally(() => {
      emPreparo.delete(pacote.id);
    });
    emPreparo.set(pacote.id, trabalho);
    return trabalho;
  }

  private async gerarDeVerdade(escolaId: string, usuarioId: string, perfil: Perfil, pacote: PacoteLido): Promise<ProgressoDaMidia> {
    const projetos = pacote.conteudo.projetos;
    const midia: Record<string, string> = { ...pacote.midia };
    const pendentes = projetos.filter((p) => !midia[p.id]);

    if (pendentes.length > 0 && !(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      throw erroDeJogo("sem-saldo-de-ia");
    }

    const geradas: string[] = [];
    const falharam: string[] = [];
    let novas = 0;
    for (const projeto of pendentes) {
      if (novas >= IMAGENS_POR_CHAMADA) break;
      const nome = nomeDaImagem(projeto.imagem.descricao);
      try {
        let url: string;
        if (await this.assets.midiaDeExperienciaExiste(EXP_ID, nome)) {
          url = this.assets.urlDaMidiaDeExperiencia(EXP_ID, nome);
        } else {
          novas += 1;
          const bytes = await this.ia.generateImage(promptDaImagem(projeto.imagem.descricao), { proporcao: "4:3" });
          url = await this.assets.salvarMidiaDeExperiencia({
            expId: EXP_ID,
            nome,
            bytes,
            contentType: "image/webp",
            imagem: { ...TAMANHO_DA_IMAGEM },
          });
          await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_IMAGEM);
        }
        await this.juri.registrarMidia(escolaId, pacote.id, projeto.id, url);
        midia[projeto.id] = url;
        geradas.push(projeto.id);
      } catch {
        /* Sem `err` no log: a mensagem do provider pode carregar trecho do
           pedido, e o pedido carrega a descrição que o professor escreveu. */
        logger.warn(
          { codigo: "exp06ef1b-midia-falhou", escolaId, projeto: projeto.id },
          "imagem não gerada — o estande segue com a arte procedural",
        );
        falharam.push(projeto.id);
      }
    }

    const prontas = projetos.filter((p) => midia[p.id]).length;
    return {
      pacoteId: pacote.id,
      total: projetos.length,
      prontas,
      faltam: projetos.length - prontas,
      geradas,
      falharam,
      completo: prontas === projetos.length,
      imagens: midia,
    };
  }
}
