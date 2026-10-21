import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import type { AtribuicaoDoConsumo } from "../ai/consumo-de-ia";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { AssetsService } from "../assets/assets.service";
import { logger } from "../observabilidade/logger";
import { conteudoDoBancoPadrao } from "./banco-padrao";
import type { GeracaoDoBancoPadraoSchema, ImagensDoBancoPadraoSchema } from "./contrato-de-rotas";
import { IMAGENS_EM_PARALELO, IMAGENS_POR_CHAMADA, TAMANHO_DA_IMAGEM } from "./midia.service";
import { laminasDosProjetos, nomeDaLamina, promptDeLamina } from "./regras/laminas";
import { EXP_ID } from "./vocabulario";

/**
 * As IMAGENS DO BANCO PADRÃO — quatro por projeto (as lâminas do carrossel,
 * ADR-178), cento e sessenta, geradas fora de
 * qualquer turma pelo `admin` (`POST /juri-estadual/banco-padrao/imagens`) e
 * LIGADAS ao pacote `padrao` quando ele nasce.
 *
 * - **O nome é o da customização** (`nomeDaLamina`, com a versão do
 *   pedido de imagem): a descrição do banco é derivada do título, então o
 *   arquivo de um projeto do banco é sempre o mesmo, e uma turma que homologar o
 *   banco padrão (o fallback) e gerar as imagens dele acha o arquivo pronto.
 * - **Sem tabela**: o storage É o registro. "Existe o arquivo deste nome?" é a
 *   pergunta, e tabela sem `escola_id` não é permitida (regra 1).
 * - **Sem quota de professor**: é custo da plataforma, não de uma turma, e o
 *   `QuotaService` não conhece o `admin`. Quem enxerga o gasto é o painel de
 *   custos (ADR-161), pela atribuição explícita abaixo; quem segura a mão é o
 *   rate limit da rota e o lote de `IMAGENS_POR_CHAMADA`.
 * - **Incremental e idempotente**, como a customização: até
 *   `IMAGENS_POR_CHAMADA` novas por chamada (o BFF corta em 180 s), e o que já existe no storage não é gerado
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

/** Cada lâmina de cada projeto do banco, com a chave da `midia` e o nome do arquivo, na ordem do banco. */
function itensDoBanco() {
  return laminasDosProjetos(conteudoDoBancoPadrao().projetos).map(({ projeto, lamina, chave }) => ({
    chave,
    lamina,
    projeto,
    nome: nomeDaLamina(lamina, projeto),
  }));
}

@Injectable()
export class ImagensDoBancoPadraoService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
  ) {}

  /**
   * As imagens do banco que JÁ existem no storage, por chave de lâmina — o que o
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

  /** Gera as próximas que faltam (até `IMAGENS_POR_CHAMADA`) e devolve o progresso. */
  async gerar(): Promise<GeracaoDoBancoPadrao> {
    if (emCurso) return emCurso;
    emCurso = this.gerarDeVerdade().finally(() => {
      emCurso = null;
    });
    return emCurso;
  }

  private async gerarDeVerdade(): Promise<GeracaoDoBancoPadrao> {
    const antes = await this.lerProgresso();
    const pendentes = itensDoBanco()
      .filter((i) => antes.faltam.includes(i.chave))
      .slice(0, IMAGENS_POR_CHAMADA);
    const geradas: string[] = [];
    const falharam: string[] = [];
    for (let inicio = 0; inicio < pendentes.length; inicio += IMAGENS_EM_PARALELO) {
      const leva = pendentes.slice(inicio, inicio + IMAGENS_EM_PARALELO);
      const resultados = await Promise.allSettled(
        leva.map(async (item) => {
          const bytes = await this.ia.generateImage(promptDeLamina(item.lamina, item.projeto), {
            proporcao: "4:3",
            atribuicao: ATRIBUICAO_DAS_IMAGENS_DO_BANCO,
          });
          await this.assets.salvarMidiaDeExperiencia({
            expId: EXP_ID,
            nome: item.nome,
            bytes,
            contentType: "image/webp",
            imagem: { ...TAMANHO_DA_IMAGEM },
          });
        }),
      );
      resultados.forEach((r, i) => {
        const item = leva[i]!;
        if (r.status === "fulfilled") {
          geradas.push(item.chave);
          return;
        }
        /* Sem `err` no log: a mensagem do provider pode carregar trecho do pedido. */
        logger.warn(
          { codigo: "exp06ef1b-banco-imagem-falhou", projeto: item.projeto.id, lamina: item.lamina },
          "imagem do banco padrão não gerada",
        );
        falharam.push(item.chave);
      });
    }
    return { ...(await this.lerProgresso()), geradas, falharam };
  }

  private async lerProgresso(): Promise<ImagensDoBancoPadrao> {
    const itens = itensDoBanco();
    const existe = await Promise.all(itens.map((i) => this.assets.midiaDeExperienciaExiste(EXP_ID, i.nome)));
    const imagens: Record<string, string> = {};
    const faltam: string[] = [];
    itens.forEach((item, i) => {
      if (existe[i]) imagens[item.chave] = this.assets.urlDaMidiaDeExperiencia(EXP_ID, item.nome);
      else faltam.push(item.chave);
    });
    const prontas = itens.length - faltam.length;
    return { total: itens.length, prontas, faltam, completo: faltam.length === 0, imagens };
  }
}
