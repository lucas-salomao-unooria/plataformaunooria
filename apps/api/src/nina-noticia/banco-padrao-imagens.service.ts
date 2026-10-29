import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod";
import type { AtribuicaoDoConsumo } from "../ai/consumo-de-ia";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { AssetsService } from "../assets/assets.service";
import { logger } from "../observabilidade/logger";
import { conteudoDoBancoPadrao } from "./banco-padrao";
import type { GeracaoDoBancoPadraoSchema, ImagensDoBancoPadraoSchema } from "./contrato-de-rotas";
import { TAMANHO_DA_IMAGEM, itensDasCenasFixas, itensDoPacote, type ChaveDaMidia, type ItemDeImagem } from "./regras/imagens";
import { EXP_ID, type ChaveDaCenaFixa } from "./vocabulario";

/**
 * As IMAGENS DO BANCO PADRÃO — as quatro do pacote da Feira de Troca de Livros
 * (mural, portal, telão, cartaz) e as quatro CENAS FIXAS (o Festival de
 * Ciências e o Desafio Extra), geradas UMA vez, fora de qualquer turma, pelo
 * `admin` (`POST /nina-noticia/banco-padrao/imagens`). Molde:
 * `juri-estadual/banco-padrao-imagens.service.ts`.
 *
 * - **O nome é o da customização** (`regras/imagens.ts#nomeDaImagem`, o hash
 *   do pedido): uma turma que homologar o banco padrão e gerar as imagens dele
 *   acha o arquivo pronto.
 * - **Sem tabela**: o storage É o registro (tabela sem `escola_id` não é
 *   permitida, regra 1).
 * - **Sem quota de professor**: custo da plataforma. Quem enxerga é o painel
 *   de custos (ADR-161), pela ATRIBUIÇÃO explícita abaixo; quem segura a mão é
 *   o rate limit da rota.
 * - **As CENAS FIXAS também nascem no preparo da professora** (ADR-199,
 *   `garantirCenasFixas`): o `gerar-midia` da turma gera as que ainda não
 *   existem, na conta da PLATAFORMA (esta mesma atribuição), uma vez só — a
 *   trava por arquivo (`gerandoArquivo`) vale para o `admin` e para todas as
 *   professoras do processo, e a próxima turma acha o arquivo pelo hash.
 */

/** O recurso do painel de custos (`recursos/custos-de-ia.ts#RECURSOS_DE_IA`). */
export const RECURSO_DAS_IMAGENS_DO_BANCO = "nina-noticia-banco-padrao";

export const ATRIBUICAO_DAS_IMAGENS_DO_BANCO: AtribuicaoDoConsumo = {
  escolaId: null,
  perfil: "admin",
  recurso: RECURSO_DAS_IMAGENS_DO_BANCO,
};

/** Quantas por chamada: as oito saem em duas levas de quatro, longe dos 180 s do BFF. */
export const IMAGENS_DO_BANCO_POR_CHAMADA = 8;
export const IMAGENS_DO_BANCO_EM_PARALELO = 4;

export type ImagensDoBancoPadrao = z.infer<typeof ImagensDoBancoPadraoSchema>;
export type GeracaoDoBancoPadrao = z.infer<typeof GeracaoDoBancoPadraoSchema>;

/** Uma geração por processo: dois cliques do admin não pagam a mesma imagem duas vezes. */
let emCurso: Promise<GeracaoDoBancoPadrao> | null = null;

/**
 * As gerações em andamento POR ARQUIVO, neste processo: o `admin` na tela dele
 * e duas professoras no preparo pedindo a mesma cena fixa pagam UMA imagem.
 */
const gerandoArquivo = new Map<string, Promise<string>>();

/** As oito do banco, na ordem: as do pacote e as cenas fixas. */
export function itensDoBanco(): ItemDeImagem[] {
  return [...itensDoPacote(conteudoDoBancoPadrao()), ...itensDasCenasFixas()];
}

@Injectable()
export class ImagensDoBancoPadraoDaExp03ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly assets: AssetsService,
  ) {}

  /**
   * As que JÁ existem no storage, por chave — o que o pacote leva na `midia`.
   * Nunca lança: o storage fora do ar deixa o pacote sem imagem (a ilustração
   * local), e a professora não perde o "Usar Banco Padrão" por isso.
   */
  async existentes(): Promise<Partial<Record<ChaveDaMidia, string>>> {
    try {
      return (await this.lerProgresso()).imagens;
    } catch {
      logger.warn({ codigo: "exp03ef1b-banco-imagens-ilegiveis" }, "storage ilegível; o banco padrão segue sem imagem");
      return {};
    }
  }

  /**
   * As CENAS FIXAS (o caso novo e o Desafio Extra), para o pacote de uma turma
   * (ADR-199): a que existe no storage entra de graça; a que falta é GERADA
   * aqui, na conta da plataforma (sem quota da professora). Nunca lança: a
   * cena que falhar fica de fora e a experiência desenha a ilustração local;
   * a próxima chamada tenta de novo.
   */
  async garantirCenasFixas(): Promise<Partial<Record<ChaveDaCenaFixa, string>>> {
    const saida: Partial<Record<ChaveDaCenaFixa, string>> = {};
    await Promise.all(
      itensDasCenasFixas().map(async (item) => {
        try {
          const existe = await this.assets.midiaDeExperienciaExiste(EXP_ID, item.nome);
          saida[item.chave as ChaveDaCenaFixa] = existe
            ? this.assets.urlDaMidiaDeExperiencia(EXP_ID, item.nome)
            : await this.gerarArquivo(item);
        } catch {
          /* Sem `err` no log: a mensagem do provider pode carregar trecho do pedido. */
          logger.warn({ codigo: "exp03ef1b-cena-fixa-falhou", chave: item.chave }, "cena fixa não gerada — segue a ilustração local");
        }
      }),
    );
    return saida;
  }

  async progresso(): Promise<ImagensDoBancoPadrao> {
    return this.lerProgresso();
  }

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
      .slice(0, IMAGENS_DO_BANCO_POR_CHAMADA);
    const geradas: ChaveDaMidia[] = [];
    const falharam: ChaveDaMidia[] = [];
    for (let inicio = 0; inicio < pendentes.length; inicio += IMAGENS_DO_BANCO_EM_PARALELO) {
      const leva = pendentes.slice(inicio, inicio + IMAGENS_DO_BANCO_EM_PARALELO);
      const resultados = await Promise.allSettled(
        leva.map((item) => this.gerarArquivo(item)),
      );
      resultados.forEach((r, i) => {
        const item = leva[i]!;
        if (r.status === "fulfilled") {
          geradas.push(item.chave);
          return;
        }
        logger.warn({ codigo: "exp03ef1b-banco-imagem-falhou", chave: item.chave }, "imagem do banco padrão não gerada");
        falharam.push(item.chave);
      });
    }
    return { ...(await this.lerProgresso()), geradas, falharam };
  }

  /** Gera UMA imagem do banco no arquivo do hash, na conta da plataforma — com a trava por arquivo. */
  private gerarArquivo(item: ItemDeImagem): Promise<string> {
    const emAndamento = gerandoArquivo.get(item.nome);
    if (emAndamento) return emAndamento;
    const trabalho = (async () => {
      const bytes = await this.ia.generateImage(item.prompt, {
        proporcao: "4:3",
        atribuicao: ATRIBUICAO_DAS_IMAGENS_DO_BANCO,
      });
      return this.assets.salvarMidiaDeExperiencia({
        expId: EXP_ID,
        nome: item.nome,
        bytes,
        contentType: "image/webp",
        imagem: { ...TAMANHO_DA_IMAGEM },
      });
    })().finally(() => gerandoArquivo.delete(item.nome));
    gerandoArquivo.set(item.nome, trabalho);
    return trabalho;
  }

  private async lerProgresso(): Promise<ImagensDoBancoPadrao> {
    const itens = itensDoBanco();
    const existe = await Promise.all(itens.map((i) => this.assets.midiaDeExperienciaExiste(EXP_ID, i.nome)));
    const imagens: Partial<Record<ChaveDaMidia, string>> = {};
    const faltam: ChaveDaMidia[] = [];
    itens.forEach((item, i) => {
      if (existe[i]) imagens[item.chave] = this.assets.urlDaMidiaDeExperiencia(EXP_ID, item.nome);
      else faltam.push(item.chave);
    });
    return { total: itens.length, prontas: itens.length - faltam.length, faltam, completo: faltam.length === 0, imagens };
  }
}
