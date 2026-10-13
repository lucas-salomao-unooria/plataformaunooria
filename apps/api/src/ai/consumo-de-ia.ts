import { Injectable } from "@nestjs/common";
import { diaDaPlataforma } from "../comum/fuso";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import { contextoAtual } from "../tenancy/tenancy-context";
import type { OperacaoDeIa } from "./medidor.provider";

/**
 * O CONSUMO DE IA, para o painel de custos da Unooria (ADR-161).
 *
 * As métricas do cap. 17 (`iaTokens`) dizem quanto a stack gastou, mas não
 * dizem EM QUÊ — o rótulo é só o modelo, por cardinalidade. O FinOps precisa da
 * resposta que a fatura não dá: qual produto, qual escola, qual modalidade.
 * Por isso este registro é uma TABELA, agregada por dia: uma linha por
 * (dia, escola, perfil, recurso, operação, modelo), somada a cada chamada.
 *
 * **O custo NÃO é gravado aqui.** A linha guarda o que o vendor mediu
 * (tokens, imagens, segundos); o preço é dado editável (`ia_precos`, com
 * vigência) e o custo é derivado na leitura. Gravar o custo congelaria um
 * preço errado da semente para sempre; derivar deixa a correção retroativa.
 *
 * **Sem `usuario_id`, de propósito**: FinOps não precisa saber QUEM, e a linha
 * vive mais que qualquer dado de pessoa (regra 6). Quem precisa do teto por
 * pessoa é a quota (`ia_uso_diario`), que é outra pergunta.
 */

export type ModalidadeDeIa = "texto" | "imagem" | "audio" | "video";

/** As operações do `AiProvider` mais as duas portas que vivem fora dele. */
export type OperacaoDoConsumo = OperacaoDeIa | "agente" | "voz-ao-vivo";

/** Quem pagou a chamada. Ausente = sai do contexto da requisição. */
export interface AtribuicaoDoConsumo {
  escolaId?: string | null;
  perfil?: string | null;
  recurso?: string;
}

export interface UsoDeIa {
  operacao: OperacaoDoConsumo;
  modelo: string;
  modalidade: ModalidadeDeIa;
  /** `false` = a chamada falhou; o que foi pago antes da falha conta igual. */
  ok: boolean;
  tokensEntrada: number;
  /** Resposta + raciocínio: os dois saem na mesma tarifa de saída. */
  tokensSaida: number;
  imagens?: number;
  /** Segundos de áudio gerado (voz). */
  segundos?: number;
  /** O vendor não devolveu a contagem e ela foi ESTIMADA (a voz da Cloud TTS). */
  estimado?: boolean;
  atribuicao?: AtribuicaoDoConsumo;
}

/** Quem recebe o consumo — o `RegistroDeConsumo` em produção, um array no teste. */
export type RegistrarConsumo = (uso: UsoDeIa) => void;

/** Sentinela de "sem escola" (papel de contrato, tarefa de fundo) — a chave do agregado não aceita NULL. */
export const SEM_ESCOLA = "";
/** Chamada sem rota conhecida (tarefa de fundo aberta fora de requisição). */
export const RECURSO_SEM_ROTA = "sem-rota";

/**
 * O RECURSO de uma chamada é o primeiro segmento da rota que a disparou —
 * `/podcast/exp04ef1b/episodios` → `podcast`. É o MÓDULO da api, e cada módulo
 * é um produto ou uma experiência (`convencoes-de-codigo.md`). Derivar da rota,
 * e não pedir a cada consumidor que se declare, é o que faz o consumidor NOVO
 * nascer atribuído: nenhuma linha a lembrar.
 */
export function recursoDaRota(url: string | undefined): string {
  if (!url) return RECURSO_SEM_ROTA;
  const caminho = url.split("?")[0] ?? "";
  const primeiro = caminho.split("/").find((s) => s !== "");
  return primeiro && /^[a-z0-9-]{1,40}$/.test(primeiro) ? primeiro : RECURSO_SEM_ROTA;
}

/**
 * Taxa do MP3 que a Cloud Text-to-Speech devolve: 32 kbps, fixo, pela
 * documentação do `AudioEncoding.MP3`. É o que transforma o tamanho do arquivo
 * em duração sem decodificar o áudio (não há ffmpeg neste repositório).
 */
export const BITS_POR_SEGUNDO_DO_MP3 = 32_000;
/** O Gemini conta 25 tokens por segundo de áudio (página de preços da Vertex). */
export const TOKENS_POR_SEGUNDO_DE_AUDIO = 25;
/** Aproximação de tokens de texto por byte em pt-BR (≈4 bytes por token). */
export const BYTES_POR_TOKEN_DE_TEXTO = 4;

/**
 * A Cloud TTS não devolve contagem de tokens nenhuma — só o áudio. O que a
 * Google cobra do Gemini-TTS é token de texto na entrada e token de ÁUDIO na
 * saída, então a conta se refaz daqui: a duração sai do tamanho do MP3, a saída
 * da duração (25 tokens/s), a entrada dos bytes do roteiro. Marcado
 * `estimado`, e a tela mostra "≈": é estimativa honesta, não medida do vendor.
 */
export function estimarFala(bytesDoTexto: number, bytesDoAudio: number): {
  tokensEntrada: number;
  tokensSaida: number;
  segundos: number;
} {
  const segundos = (bytesDoAudio * 8) / BITS_POR_SEGUNDO_DO_MP3;
  return {
    tokensEntrada: Math.ceil(bytesDoTexto / BYTES_POR_TOKEN_DE_TEXTO),
    tokensSaida: Math.ceil(segundos * TOKENS_POR_SEGUNDO_DE_AUDIO),
    segundos: Math.round(segundos),
  };
}

/** Inteiro não negativo — o vendor às vezes manda `undefined`, e a soma não pode virar `NaN`. */
export const inteiro = (n: number | undefined): number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;

/**
 * Grava o consumo. **Nunca falha a chamada de IA** — a resposta já foi paga e
 * entregue, e perdê-la por causa do registro seria pior que perder a linha. O
 * que não pode é sumir em silêncio: sai o log `ia-consumo-nao-gravado`.
 */
@Injectable()
export class RegistroDeConsumo {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dispara e esquece: quem chama está no caminho da resposta ao usuário e NÃO
   * espera. A promessa devolvida nunca rejeita — existe para o teste esperar a
   * gravação.
   */
  registrar(uso: UsoDeIa): Promise<void> {
    // O contexto é lido AGORA, síncrono: depois do `await` ele ainda vale (o
    // AsyncLocalStorage segue a cadeia), mas ler antes deixa explícito de onde vem.
    const ctx = contextoAtual();
    const linha = {
      ...uso,
      escolaId: uso.atribuicao?.escolaId ?? ctx?.escolaId ?? SEM_ESCOLA,
      perfil: uso.atribuicao?.perfil ?? ctx?.perfil ?? "",
      recurso: uso.atribuicao?.recurso ?? ctx?.recurso ?? RECURSO_SEM_ROTA,
    };
    return this.gravar(linha).catch((erro: unknown) =>
      logger.error(
        { codigo: "ia-consumo-nao-gravado", operacao: uso.operacao, modelo: uso.modelo, recurso: linha.recurso, err: erro },
        "a chamada de IA foi feita, mas o consumo não foi gravado",
      ),
    );
  }

  private async gravar(u: UsoDeIa & { escolaId: string; perfil: string; recurso: string }): Promise<void> {
    const dia = diaDaPlataforma(new Date());
    // Tabela de CONTRATO, sem RLS (como `ia_quotas`): fora do `comTenancy`.
    await this.prisma.$executeRaw`
      INSERT INTO ia_consumo_diario
        (dia, escola_id, perfil, recurso, operacao, modelo, modalidade,
         chamadas, falhas, tokens_entrada, tokens_saida, imagens, segundos, estimado)
      VALUES
        (${dia}::date, ${u.escolaId}, ${u.perfil}, ${u.recurso}, ${u.operacao}, ${u.modelo}, ${u.modalidade},
         1, ${u.ok ? 0 : 1}, ${inteiro(u.tokensEntrada)}, ${inteiro(u.tokensSaida)},
         ${inteiro(u.imagens)}, ${inteiro(u.segundos)}, ${u.estimado === true})
      ON CONFLICT (dia, escola_id, perfil, recurso, operacao, modelo) DO UPDATE SET
        chamadas       = ia_consumo_diario.chamadas + 1,
        falhas         = ia_consumo_diario.falhas + EXCLUDED.falhas,
        tokens_entrada = ia_consumo_diario.tokens_entrada + EXCLUDED.tokens_entrada,
        tokens_saida   = ia_consumo_diario.tokens_saida + EXCLUDED.tokens_saida,
        imagens        = ia_consumo_diario.imagens + EXCLUDED.imagens,
        segundos       = ia_consumo_diario.segundos + EXCLUDED.segundos,
        estimado       = ia_consumo_diario.estimado OR EXCLUDED.estimado,
        atualizado_em  = now()`;
  }
}
