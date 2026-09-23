import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import { LOTE_DEFAULT, MOLDE_DO_LOTE, TEMA_DEFAULT, type Gatilho, type MensagemDoLote } from "./catalogo";
import { termosProibidosEm } from "./invariantes";
import {
  MAX_TOKENS_DO_PREPARO,
  SCHEMA_DO_PREPARO,
  SYSTEM_DO_PREPARO,
  promptDoPreparo,
} from "./prompts";
import { validarParidade } from "./regras/curadoria";

/**
 * A ÚNICA superfície de IA da exp05ef1b: o rascunho do lote da turma, antes da aula.
 *
 * Três coisas que este serviço não faz, e cada ausência é uma regra:
 *
 * 1. **Não publica.** O que ele devolve é RASCUNHO. Só o clique da professora
 *    em "Aprovar e publicar" grava `aprovado_por_professor: true`, e é esse
 *    booleano que a tela do estudante consulta (RF-001).
 * 2. **Não avalia nada.** A IA não corrige a curadoria do estudante, não lê a
 *    reflexão dele e não entra na aula. Falha aqui não tem consequência em
 *    sala: a professora aprova o banco curado e a missão roda.
 * 3. **Não decide a estrutura.** Tipo e veracidade por posição são do MOLDE:
 *    `validar` rejeita saída fora dele e o `generateJson` regera; esgotadas as
 *    tentativas, o banco curado volta com `usouIa: false`.
 *
 * O contrato de quota é o da ADR-74: `temSaldo` ANTES, `aoUsarTokens` contando
 * o que o vendor cobrou por TENTATIVA — inclusive as que `validar` rejeitou,
 * porque elas foram pagas igual. Perfil `professor`, que tem o teto próprio.
 */

export interface RascunhoDoLote {
  tema: string;
  mensagens: MensagemDoLote[];
}

/** O banco curado, como objeto mutável para a tela editar. */
export function loteDefault(): RascunhoDoLote {
  return { tema: TEMA_DEFAULT, mensagens: LOTE_DEFAULT.map((m) => ({ ...m })) };
}

type Bruta = Partial<Record<keyof MensagemDoLote, unknown>>;

function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function textoOuVazio(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Valida e normaliza a saída do modelo contra o MOLDE.
 *
 * Lançar aqui faz a tentativa ser regerada (contrato do `generateJson`), e é
 * por isso que as regras de FAIXA entram na validação e não numa checagem
 * posterior: um comunicado de 90 palavras não é erro de formato, é conteúdo
 * fora do teto de leitura do 5º ano — e vale mais regerar do que aceitar e
 * deixar a professora corrigir oito textos à mão.
 *
 * O que ele NÃO deixa o modelo decidir: `id`, `tipo`, `veracidade` e `tom`.
 * Eles são casados pela ORDEM do molde, não pelo que o modelo devolveu — o
 * enum do schema restringe os valores, mas nada garante que ele não troque a
 * posição do áudio com a do comunicado, e a simetria formal do lote (áudio
 * não é sempre mentira) depende da posição.
 */
export function validarLote(bruto: unknown): MensagemDoLote[] {
  const lista = (bruto as { mensagens?: unknown }).mensagens;
  if (!Array.isArray(lista) || lista.length !== MOLDE_DO_LOTE.length) {
    throw new Error(`esperava ${MOLDE_DO_LOTE.length} mensagens`);
  }

  let horaAnterior = "";
  const prontas = MOLDE_DO_LOTE.map((molde, i) => {
    const b = (lista[i] ?? {}) as Bruta;
    const remetente = textoOuVazio(b.remetente);
    const corpo = textoOuVazio(b.corpo);
    const explicacao = textoOuVazio(b.explicacao);
    const hora = textoOuVazio(b.hora);

    if (b.veracidade !== molde.veracidade) {
      throw new Error(`${molde.id} deveria ser ${molde.veracidade}`);
    }
    if (remetente.length < 2 || remetente.length > 30) {
      throw new Error(`${molde.id} sem remetente válido`);
    }
    if (!/^\d{2}:\d{2}$/.test(hora)) throw new Error(`${molde.id} sem hora HH:MM`);
    if (hora <= horaAnterior) throw new Error(`${molde.id} fora da ordem cronológica`);
    horaAnterior = hora;
    if (!corpo) throw new Error(`${molde.id} sem texto`);
    if (!explicacao || explicacao.length > 120) {
      throw new Error(`${molde.id} sem explicação de até 120 caracteres`);
    }

    /* Os tetos de leitura da faixa, por papel (RNF-USAB-002). */
    const n = palavras(corpo);
    if (molde.id === "msg-1" && (n < 40 || n > 70)) {
      throw new Error("o comunicado tem de ter entre 40 e 70 palavras");
    }
    if (molde.tipo === "audio" && (n < 30 || n > 50)) {
      throw new Error("a transcrição do áudio tem de ter entre 30 e 50 palavras");
    }
    if (molde.id !== "msg-1" && molde.tipo !== "audio" && n > 25) {
      throw new Error(`${molde.id} passa de 25 palavras`);
    }

    const pronta: MensagemDoLote = {
      id: molde.id,
      remetente,
      hora,
      tipo: molde.tipo,
      corpo,
      veracidade: molde.veracidade,
      tom: molde.tom,
      explicacao,
    };

    if (molde.tipo === "audio") {
      const duracao = Number(b.duracaoSeg);
      if (!Number.isInteger(duracao) || duracao < 12 || duracao > 18) {
        throw new Error("o áudio precisa de duração inteira entre 12 e 18 s");
      }
      pronta.duracaoSeg = duracao;
    }
    if (molde.tipo === "imagem") {
      const titulo = textoOuVazio(b.titulo);
      if (!titulo) throw new Error("a imagem precisa do rótulo do que mostra");
      pronta.titulo = titulo.slice(0, 120);
    }
    if (molde.tipo === "link") {
      const titulo = textoOuVazio(b.titulo);
      const fonte = textoOuVazio(b.fonte);
      const data = textoOuVazio(b.data);
      if (!titulo || !fonte || !data) throw new Error("o link precisa de manchete, fonte e data");
      pronta.titulo = titulo.slice(0, 120);
      pronta.fonte = fonte.slice(0, 60);
      pronta.data = data.slice(0, 40);
    }

    /* As invariantes de tela valem para o texto GERADO igual: "gabarito" ou
       "ranking" numa mensagem do grupo quebraria a mesma regra que a copy
       autoral respeita. Regerar é melhor que confiar na revisão humana de um
       texto que a professora talvez só passe o olho. */
    for (const texto of [corpo, explicacao, remetente, pronta.titulo ?? ""]) {
      const proibidos = termosProibidosEm(texto);
      if (proibidos.length > 0) {
        throw new Error(`${molde.id} com termo proibido: ${proibidos.join(", ")}`);
      }
    }
    return pronta;
  });

  /* Rede final: o molde já garante a paridade, e a checagem existe para o dia
     em que alguém mexer no molde e esquecer a conta. */
  if (!validarParidade(prontas).ok) throw new Error("o molde perdeu a paridade 3/3/2");

  return prontas;
}

@Injectable()
export class PreparoDaExp05ef1bService {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  /**
   * Gera o rascunho do lote da turma.
   *
   * Devolve `{ usouIa: false }` com o banco curado quando não deu — e o banco
   * é o conteúdo homologado da Unooria, completo, não um remendo. O sinal
   * `usouIa` é o que a tela usa para dizer "Utilizando o lote curado padrão"
   * em vez de fingir que a IA respondeu.
   *
   * Não lança em falha de vendor: o único jeito de esta rota estragar a aula
   * seria bloquear a professora, e ela precisa poder aprovar o banco curado
   * com o Vertex fora do ar.
   */
  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: { tema: string; gatilho: Gatilho; contextoDaEscola?: string },
  ): Promise<{ rascunho: RascunhoDoLote; usouIa: boolean; tokens: number }> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      logger.info({ codigo: "exp05ef1b-preparo-sem-saldo", escolaId }, "preparo sem saldo de IA");
      return { rascunho: loteDefault(), usouIa: false, tokens: 0 };
    }

    let tokens = 0;
    try {
      const mensagens = await this.ia.generateJson<MensagemDoLote[]>({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(parametros),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        // Baixa de propósito: o que se pede é conteúdo consistente dentro de
        // um molde fixo, não variedade criativa.
        temperatura: 0.3,
        aoUsarTokens: (n) => {
          tokens += n;
        },
        validar: validarLote,
      });
      await this.quota.consumir(escolaId, usuarioId, tokens);
      return { rascunho: { tema: parametros.tema, mensagens }, usouIa: true, tokens };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha: as tentativas rejeitadas pelo
         `validar` já foram faturadas pelo vendor (ADR-74). */
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens);
      logger.warn(
        { codigo: "exp05ef1b-preparo-falhou", escolaId, tokens, err: erro },
        "geração do lote da turma falhou; devolvendo o banco curado",
      );
      return { rascunho: loteDefault(), usouIa: false, tokens };
    }
  }
}
