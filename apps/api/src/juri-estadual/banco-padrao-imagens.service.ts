import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import type { AtribuicaoDoConsumo } from "../ai/consumo-de-ia";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { AssetsService } from "../assets/assets.service";
import { logger } from "../observabilidade/logger";
import { conteudoDoBancoPadrao } from "./banco-padrao";
import type { GeracaoDoBancoPadraoSchema, ImagensDoBancoPadraoSchema } from "./contrato-de-rotas";
import { IMAGENS_POR_CHAMADA, TAMANHO_DA_IMAGEM, nomeDaImagem } from "./midia.service";
import { promptDaImagem } from "./prompts";
import { EXP_ID } from "./vocabulario";

/**
 * As IMAGENS DO BANCO PADRÃO — uma por projeto, quarenta, geradas fora de
 * qualquer turma pelo `admin` (`POST /juri-estadual/banco-padrao/imagens`) e
 * LIGADAS ao pacote `padrao` quando ele nasce.
 *
 * - **O nome é o da customização** (`nomeDaImagem(descricao)`, com a versão do
 *   pedido de imagem): a descrição do banco é derivada do título, então o
 *   arquivo de um projeto do banco é sempre o mesmo, e uma turma que homologar o
 *   banco padrão (o fallback) e gerar as imagens dele acha o arquivo pronto.
 * - **Sem tabela**: o storage É o registro. "Existe o arquivo deste nome?" é a
 *   pergunta, e tabela sem `escola_id` não é permitida (regra 1).
 * - **Sem quota de professor**: é custo da plataforma, não de uma turma, e o
 *   `QuotaService` não conhece o `admin`. Quem enxerga o gasto é o painel de
 *   custos (ADR-161), pela atribuição explícita abaixo; quem segura a mão é o
 *   rate limit da rota e o lote de quatro.
 * - **Incremental e idempotente**, como a customização: até quatro novas por
 *   chamada (o BFF corta em 180 s), e o que já existe no storage não é gerado
 *   de novo.
 */

/** O recurso do painel de custos (`recursos/custos-de-ia.ts#RECURSOS_DE_IA`). */
export const RECURSO_DAS_IMAGENS_DO_BANCO = "juri-estadual-banco-padrao";

/**
 * A quem o painel de custos atribui cada imagem: a plataforma (sem escola), o
 * `admin`, e o recurso do banco padrão — não `juri-estadual`, que é o custo das
 * turmas.
 */
export const ATRIBUICAO_DAS_IMAGENS_DO_BANCO: AtribuicaoDoConsumo = {
  escolaId: null,
  perfil: "admin",
  recurso: RECURSO_DAS_IMAGENS_DO_BANCO,
};

export type ImagensDoBancoPadrao = z.infer<typeof ImagensDoBancoPadraoSchema>;
export type GeracaoDoBancoPadrao = z.infer<typeof GeracaoDoBancoPadraoSchema>;

/** Uma geração por processo: dois cliques do admin não pagam a mesma imagem duas vezes. */
let emCurso: Promise<GeracaoDoBancoPadrao> | null = null;

/** Os projetos do banco com o nome do arquivo de cada um, na ordem do banco. */
function projetosDoBanco() {
  return conteudoDoBancoPadrao().projetos.map((p) => ({
    id: p.id,
    descricao: p.imagem.descricao,
    nome: nomeDaImagem(p.imagem.descricao),
  }));
}

@Injectable()
export class ImagensDoBancoPadraoService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
  ) {}

  /**
   * As imagens do banco que JÁ existem no storage, por id de projeto — o que o
   * pacote `padrao` leva na `midia`. Nunca lança: o storage fora do ar deixa o
   * pacote sem imagem (a experiência desenha a arte procedural), e o professor
   * não perde o "Usar Banco Padrão" por isso.
   */
  async existentes(): Promise<Record<string, string>> {
    try {
      return (await this.lerProgresso()).imagens;
    } catch {
      logger.warn({ codigo: "exp06ef1b-banco-imagens-ilegiveis" }, "storage ilegível; o banco padrão segue sem imagem");
      return {};
    }
  }

  /** O progresso: quantas existem, quais faltam e as URLs. */
  async progresso(): Promise<ImagensDoBancoPadrao> {
    return this.lerProgresso();
  }

  /** Gera as próximas que faltam (até quatro) e devolve o progresso. */
  async gerar(): Promise<GeracaoDoBancoPadrao> {
    if (emCurso) return emCurso;
    emCurso = this.gerarDeVerdade().finally(() => {
      emCurso = null;
    });
    return emCurso;
  }

  private async gerarDeVerdade(): Promise<GeracaoDoBancoPadrao> {
    const antes = await this.lerProgresso();
    const pendentes = projetosDoBanco().filter((p) => antes.faltam.includes(p.id));
    const geradas: string[] = [];
    const falharam: string[] = [];
    for (const projeto of pendentes.slice(0, IMAGENS_POR_CHAMADA)) {
      try {
        const bytes = await this.ia.generateImage(promptDaImagem(projeto.descricao), {
          proporcao: "4:3",
          atribuicao: ATRIBUICAO_DAS_IMAGENS_DO_BANCO,
        });
        await this.assets.salvarMidiaDeExperiencia({
          expId: EXP_ID,
          nome: projeto.nome,
          bytes,
          contentType: "image/webp",
          imagem: { ...TAMANHO_DA_IMAGEM },
        });
        geradas.push(projeto.id);
      } catch {
        /* Sem `err` no log: a mensagem do provider pode carregar trecho do pedido. */
        logger.warn({ codigo: "exp06ef1b-banco-imagem-falhou", projeto: projeto.id }, "imagem do banco padrão não gerada");
        falharam.push(projeto.id);
      }
    }
    return { ...(await this.lerProgresso()), geradas, falharam };
  }

  private async lerProgresso(): Promise<ImagensDoBancoPadrao> {
    const projetos = projetosDoBanco();
    const existe = await Promise.all(projetos.map((p) => this.assets.midiaDeExperienciaExiste(EXP_ID, p.nome)));
    const imagens: Record<string, string> = {};
    const faltam: string[] = [];
    projetos.forEach((p, i) => {
      if (existe[i]) imagens[p.id] = this.assets.urlDaMidiaDeExperiencia(EXP_ID, p.nome);
      else faltam.push(p.id);
    });
    const prontas = projetos.length - faltam.length;
    return { total: projetos.length, prontas, faltam, completo: faltam.length === 0, imagens };
  }
}
