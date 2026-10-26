import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import { AssetsService } from "../assets/assets.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { EXP_ID, type ConteudoDoPacote, type Disciplina } from "./conteudo";
import {
  MAX_TOKENS_DO_PREPARO,
  SCHEMA_DO_PREPARO,
  SYSTEM_DO_PREPARO,
  conteudoDaCenaGerada,
  pedidoDeImagem,
  promptDoPreparo,
  validarSaidaDoPreparo,
} from "./prompts";

/** Por que o rascunho saiu do pacote pronto — é o que decide a frase da tela (429 × 503). */
export type MotivoDoPronto = "sem-saldo" | "indisponivel";

export interface ResultadoDoPreparo {
  conteudo: ConteudoDoPacote | null;
  motivo: MotivoDoPronto | null;
  tokens: number;
}

/** A panorâmica gerada, em webp: o tamanho dos pacotes prontos. */
export const TAMANHO_DA_CENA = { largura: 1920, altura: 1080 } as const;

/**
 * Custo estimado da imagem, em tokens, quando o vendor não devolve a contagem
 * (o molde do Júri): debitar zero faria a quota mentir.
 */
export const CUSTO_ESTIMADO_DA_IMAGEM = 2_000;

/**
 * A ÚNICA superfície de IA da exp02ef1b: a CENA do pacote, antes da aula
 * ("Gerar com IA" — one-pager §9a). Duas chamadas, as duas pagas pelo PERFIL
 * `professor` (regra 5): o texto (`generateJson`) e a panorâmica 16:9
 * (`generateImage`), salva no bucket de mídia da experiência.
 *
 * `temSaldo` ANTES; o que o vendor cobrou é debitado DEPOIS, por tentativa —
 * inclusive as que o `validar` rejeitou, e inclusive quando a imagem falha
 * depois de o texto sair (ADR-74).
 *
 * Não lança em falha de vendor: sem saldo ou com o Vertex fora, quem chama
 * recebe `conteudo: null` e cai no pacote pronto da disciplina — a aula
 * acontece. Não aprova nada: só a homologação do professor põe uma cena
 * diante da turma, e os alvos ele marca tocando na imagem.
 */
@Injectable()
export class PreparoDaExp02ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
    private readonly assets: AssetsService,
  ) {}

  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    recorte: { disciplina: Disciplina; tema: string; palavras: readonly string[]; nota?: string | null },
  ): Promise<ResultadoDoPreparo> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      logger.info({ codigo: "exp02ef1b-preparo-sem-saldo", escolaId }, "preparo sem saldo de IA; rascunho do pacote pronto");
      return { conteudo: null, motivo: "sem-saldo", tokens: 0 };
    }
    let tokens = 0;
    let daImagem = 0;
    let imagemPedida = false;
    try {
      const cena = await this.ia.generateJson({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(recorte),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        temperatura: 0.6,
        aoUsarTokens: (n) => {
          tokens += n;
        },
        validar: validarSaidaDoPreparo,
      });

      imagemPedida = true;
      const bytes = await this.ia.generateImage(pedidoDeImagem(cena), {
        proporcao: "16:9",
        aoUsarTokens: (n) => {
          daImagem += n;
        },
      });
      tokens += daImagem > 0 ? daImagem : CUSTO_ESTIMADO_DA_IMAGEM;
      daImagem = 0;
      imagemPedida = false;

      const url = await this.assets.salvarMidiaDeExperiencia({
        expId: EXP_ID,
        nome: `cenas/${randomUUID()}.webp`,
        bytes,
        contentType: "image/webp",
        imagem: { ...TAMANHO_DA_CENA },
      });
      await this.quota.consumir(escolaId, usuarioId, tokens);
      return { conteudo: conteudoDaCenaGerada(cena, url), motivo: null, tokens };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha (ADR-74). Sem `err` com o pedido no
         log: a mensagem do provider pode carregar o tema que o professor escreveu. */
      /* A imagem que falhou entra pelo que o vendor disse que cobrou (sem contagem, nada). */
      if (imagemPedida) tokens += daImagem;
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens);
      logger.warn(
        { codigo: "exp02ef1b-preparo-falhou", escolaId, tokens, erro: erro instanceof Error ? erro.name : "desconhecido" },
        "geração da cena falhou; rascunho do pacote pronto",
      );
      return { conteudo: null, motivo: "indisponivel", tokens };
    }
  }
}
