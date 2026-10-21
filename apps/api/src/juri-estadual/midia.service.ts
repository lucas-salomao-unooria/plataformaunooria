import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { AssetsService } from "../assets/assets.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { erroDeJogo } from "./erros";
import { JuriEstadualService, type PacoteLido } from "./juri-estadual.service";
import { chaveDaMidia, laminasDosProjetos, nomeDaLamina, promptDeLamina, type Lamina } from "./regras/laminas";
import { EXP_ID } from "./vocabulario";

/**
 * As IMAGENS dos estandes: geradas pelo professor no preparo, servidas a todos.
 * Molde: `jornal-escola/midia.service.ts` — INCREMENTAL (até
 * `IMAGENS_POR_CHAMADA` novas por chamada: o BFF do hub corta em 180 s),
 * idempotente, com o custo estimado e o `falharam[]`.
 *
 * **Quatro imagens por estande** desde a 0.8.0 (ADR-178): a capa e as lâminas
 * do carrossel (`regras/laminas.ts`), cada uma com o seu pedido ao modelo.
 *
 * **Sem imagem a missão roda igual**: o post chega com `imagem.url: null`, e a
 * experiência desenha a arte procedural do estande (o `alt` continua valendo).
 *
 * **O arquivo é o hash do PEDIDO** (`nomeDaLamina`: a capa, só a
 * `imagem.descricao`), em `experiencias/exp06ef1b/mostra/`: a mesma cena gerada
 * uma vez serve a toda turma que a homologar, e um texto editado pelo professor
 * é outro arquivo.
 *
 * **O professor VÊ e APROVA as imagens antes da turma** (pedido do PO, no molde
 * da exp07ef1b, ADR-146): gerar e refazer só valem enquanto o pacote está com
 * `imagens_aprovadas_em` nulo (`JuriEstadualService.pacoteParaMidia`, 409
 * `imagens-ja-aprovadas`), e sem a aprovação a atividade não vai ao ar.
 */

/**
 * Quantas imagens NOVAS por chamada. Cada uma leva de 5 a 10 s; desde a 0.8.0
 * (quatro lâminas por estande, ADR-178: 160 imagens por mostra) elas saem em
 * paralelo, `IMAGENS_EM_PARALELO` de cada vez — oito numa chamada são duas
 * levas de ~10 s, longe dos 180 s do BFF. Umas vinte idas para a mostra toda.
 */
export const IMAGENS_POR_CHAMADA = 8;
export const IMAGENS_EM_PARALELO = 4;

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

/** As regerações em andamento, por pacote e lâmina: dois cliques não pagam duas imagens. */
const refazendo = new Map<string, Promise<ImagemRefeita>>();

export interface ImagemRefeita {
  pacoteId: string;
  projetoId: string;
  lamina: Lamina;
  /** A chave na `midia` (`proj-a1` para a capa, `proj-a1:detalhe` para as outras). */
  chave: string;
  url: string;
}

/** O nome do arquivo mora em `regras/laminas.ts` (puro); o re-export é dos testes e do banco padrão. */
export { nomeDaImagem } from "./regras/laminas";

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

  /**
   * "GERAR OUTRA IMAGEM": o professor viu a imagem do estande e ela não serve
   * (ou o estande ficou sem imagem e ele quer tentar de novo). Uma imagem
   * nova, SEMPRE paga — o arquivo é novo, a variação entra no nome —, e só
   * enquanto as imagens estão em validação.
   *
   * Uma por chamada, num lock de processo por (pacote, projeto), pela mesma
   * razão da geração em lote: dois cliques não pagam duas imagens. A falha do
   * provedor aqui é 503 (o professor pediu ESTA imagem e espera a resposta); o
   * estande continua com a imagem que tinha, ou com a arte procedural.
   */
  async refazer(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    usuarioId: string,
    perfil: Perfil,
    pacoteId: string,
    projetoId: string,
    /** A lâmina refeita (0.8.0, ADR-178); sem ela, a capa — o contrato de antes. */
    lamina: Lamina = "capa",
  ): Promise<ImagemRefeita> {
    const pacote = await this.juri.pacoteParaMidia(escolaId, turmaId, professorId, pacoteId);
    const projeto = pacote.conteudo.projetos.find((p) => p.id === projetoId);
    if (!projeto) throw erroDeJogo("payload-invalido");
    const chaveDaImagem = chaveDaMidia(projeto.id, lamina);

    const chave = `${pacote.id}:${chaveDaImagem}`;
    const emCurso = refazendo.get(chave);
    if (emCurso) return emCurso;
    const trabalho = (async () => {
      if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) throw erroDeJogo("sem-saldo-de-ia");
      let bytes: Buffer;
      try {
        bytes = await this.ia.generateImage(promptDeLamina(lamina, projeto), { proporcao: "4:3" });
      } catch {
        logger.warn(
          { codigo: "exp06ef1b-midia-falhou", escolaId, projeto: projeto.id, lamina },
          "imagem não refeita — o estande segue com a que tinha",
        );
        throw erroDeJogo("ia-indisponivel");
      }
      const url = await this.assets.salvarMidiaDeExperiencia({
        expId: EXP_ID,
        nome: nomeDaLamina(lamina, projeto, randomUUID()),
        bytes,
        contentType: "image/webp",
        imagem: { ...TAMANHO_DA_IMAGEM },
      });
      await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_IMAGEM);
      await this.juri.registrarMidia(escolaId, pacote.id, chaveDaImagem, url);
      return { pacoteId: pacote.id, projetoId: projeto.id, lamina, chave: chaveDaImagem, url };
    })().finally(() => refazendo.delete(chave));
    refazendo.set(chave, trabalho);
    return trabalho;
  }

  private async gerarDeVerdade(escolaId: string, usuarioId: string, perfil: Perfil, pacote: PacoteLido): Promise<ProgressoDaMidia> {
    const itens = laminasDosProjetos(pacote.conteudo.projetos);
    const midia: Record<string, string> = { ...pacote.midia };
    const pendentes = itens.filter((i) => !midia[i.chave]);

    if (pendentes.length > 0 && !(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      throw erroDeJogo("sem-saldo-de-ia");
    }

    const geradas: string[] = [];
    const falharam: string[] = [];
    /* O que já está no bucket entra de graça e não conta no lote; o resto vai
       para a fila das NOVAS, até o lote da chamada. */
    const novas: typeof pendentes = [];
    for (const item of pendentes) {
      const nome = nomeDaLamina(item.lamina, item.projeto);
      if (await this.assets.midiaDeExperienciaExiste(EXP_ID, nome)) {
        const url = this.assets.urlDaMidiaDeExperiencia(EXP_ID, nome);
        await this.juri.registrarMidia(escolaId, pacote.id, item.chave, url);
        midia[item.chave] = url;
        geradas.push(item.chave);
      } else if (novas.length < IMAGENS_POR_CHAMADA) {
        novas.push(item);
      }
    }

    for (let i = 0; i < novas.length; i += IMAGENS_EM_PARALELO) {
      const leva = novas.slice(i, i + IMAGENS_EM_PARALELO);
      const resultados = await Promise.allSettled(
        leva.map(async (item) => {
          const bytes = await this.ia.generateImage(promptDeLamina(item.lamina, item.projeto), { proporcao: "4:3" });
          const url = await this.assets.salvarMidiaDeExperiencia({
            expId: EXP_ID,
            nome: nomeDaLamina(item.lamina, item.projeto),
            bytes,
            contentType: "image/webp",
            imagem: { ...TAMANHO_DA_IMAGEM },
          });
          await this.quota.consumir(escolaId, usuarioId, CUSTO_ESTIMADO_POR_IMAGEM);
          await this.juri.registrarMidia(escolaId, pacote.id, item.chave, url);
          return url;
        }),
      );
      resultados.forEach((r, k) => {
        const item = leva[k]!;
        if (r.status === "fulfilled") {
          midia[item.chave] = r.value;
          geradas.push(item.chave);
        } else {
          /* Sem `err` no log: a mensagem do provider pode carregar trecho do
             pedido, e o pedido carrega o que o professor escreveu. */
          logger.warn(
            { codigo: "exp06ef1b-midia-falhou", escolaId, projeto: item.projeto.id, lamina: item.lamina },
            "imagem não gerada — a lâmina segue com a arte procedural",
          );
          falharam.push(item.chave);
        }
      });
    }

    const prontas = itens.filter((i) => midia[i.chave]).length;
    return {
      pacoteId: pacote.id,
      total: itens.length,
      prontas,
      faltam: itens.length - prontas,
      geradas,
      falharam,
      completo: prontas === itens.length,
      imagens: midia,
    };
  }
}
