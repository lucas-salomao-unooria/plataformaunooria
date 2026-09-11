import { Inject, Injectable } from "@nestjs/common";
import { AI_PROVIDER, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { logger } from "../observabilidade/logger";
import {
  CLAUSULAS_DEFAULT,
  CONTEXTO_DEFAULT,
  PROMPTS_DEFAULT,
  type ClausulaDeGovernanca,
  type ContextoDaTurma,
  type PromptDeAuditoria,
} from "./catalogo";
import { termosProibidosEm } from "./invariantes";
import {
  MAX_TOKENS_DO_PREPARO,
  SCHEMA_DO_PREPARO,
  SYSTEM_DO_PREPARO,
  promptDoPreparo,
} from "./prompts";

/**
 * A ÚNICA superfície de IA da exp-08: o rascunho do pacote da turma, antes da
 * aula.
 *
 * Três coisas que este serviço não faz, e cada ausência é uma regra:
 *
 * 1. **Não publica.** O que ele devolve é RASCUNHO. Só o clique da professora
 *    em "Aprovar Conteúdo da Turma" grava `aprovado_por_professor: true`, e é
 *    esse booleano que a tela do estudante consulta (exigência 8.2 / PED-04).
 * 2. **Não avalia nada.** A IA não corrige a justificativa do estudante, não
 *    pontua cláusula e não entra na aula. Falha aqui não tem consequência em
 *    sala: a missão roda com o banco curado.
 * 3. **Não decide o formato.** `validar` rejeita saída fora da forma esperada e
 *    o `generateJson` regera; esgotadas as tentativas, o pacote curado volta.
 *
 * O contrato de quota é o da ADR-74: `temSaldo` ANTES, `aoUsarTokens` contando
 * o que o vendor cobrou por TENTATIVA — inclusive as que `validar` rejeitou,
 * porque elas foram pagas igual. Perfil `professor`, que tem o teto próprio.
 */

export interface PacoteDeConteudo {
  contexto: ContextoDaTurma;
  prompts: PromptDeAuditoria[];
  clausulas: ClausulaDeGovernanca[];
}

/** O pacote curado da Unooria, como objeto mutável para a tela editar. */
export function pacoteDefault(): PacoteDeConteudo {
  return {
    contexto: { ...CONTEXTO_DEFAULT },
    prompts: PROMPTS_DEFAULT.map((p) => ({ ...p })),
    clausulas: CLAUSULAS_DEFAULT.map((c) => ({ ...c })),
  };
}

interface Bruto {
  contexto?: Partial<ContextoDaTurma>;
  prompts?: Partial<PromptDeAuditoria>[];
  clausulas?: Partial<ClausulaDeGovernanca>[];
}

/** Palavras de um texto. Serve o teto de 60 do balão da máquina. */
function palavras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Valida e normaliza a saída do modelo.
 *
 * Lançar aqui faz a tentativa ser regerada (contrato do `generateJson`), e é
 * por isso que as regras de FAIXA entram na validação e não numa checagem
 * posterior: um balão de 90 palavras não é erro de formato, é conteúdo fora do
 * teto de leitura do 8º ano — e vale mais regerar do que aceitar e deixar a
 * professora corrigir 7 textos à mão.
 *
 * O que ele NÃO regenera: os IDs. Eles vêm do enum do schema, e um id fora da
 * lista faz o pacote inteiro cair no default — id inventado produziria uma
 * cláusula que a tela mostra e o servidor não reconhece.
 */
function validarPacote(bruto: unknown): PacoteDeConteudo {
  const b = bruto as Bruto;

  const contexto = b.contexto ?? {};
  if (!contexto.escola?.trim() || !contexto.casoUsoTitulo?.trim()) {
    throw new Error("contexto sem escola ou sem título do caso");
  }
  if (!contexto.premissaIaAutoritaria?.trim()) {
    throw new Error("contexto sem a premissa de abertura da máquina");
  }
  if (palavras(contexto.premissaIaAutoritaria) > 60) {
    throw new Error("a premissa de abertura passa de 60 palavras");
  }

  const prompts = b.prompts ?? [];
  if (prompts.length !== PROMPTS_DEFAULT.length) {
    throw new Error(`esperava ${PROMPTS_DEFAULT.length} questionamentos`);
  }
  const clausulas = b.clausulas ?? [];
  if (clausulas.length !== CLAUSULAS_DEFAULT.length) {
    throw new Error(`esperava ${CLAUSULAS_DEFAULT.length} cláusulas`);
  }

  /* Os ids são casados pela ORDEM do catálogo, não pelo que o modelo devolveu:
     o enum do schema restringe os valores, mas nada garante que ele não repita
     um id — e dois prompts com o mesmo id colidiriam no UNIQUE da tabela de
     auditorias, no meio da aula. */
  const prontosPrompts = PROMPTS_DEFAULT.map((padrao, i) => {
    const p = prompts[i] ?? {};
    const replicaIa = p.replicaIa?.trim();
    if (!replicaIa) throw new Error(`questionamento ${i + 1} sem réplica`);
    if (palavras(replicaIa) > 60) {
      throw new Error(`a réplica do questionamento ${i + 1} passa de 60 palavras`);
    }
    const rotuloBotao = p.rotuloBotao?.trim();
    const textoPrompt = p.textoPrompt?.trim();
    if (!rotuloBotao || !textoPrompt) throw new Error(`questionamento ${i + 1} incompleto`);
    return { id: padrao.id, rotuloBotao, textoPrompt, replicaIa };
  });

  const prontasClausulas = CLAUSULAS_DEFAULT.map((padrao, i) => {
    const c = clausulas[i] ?? {};
    const tituloClausula = c.tituloClausula?.trim();
    const artigoTexto = c.artigoTexto?.trim();
    const justificativaSugerida = c.justificativaSugerida?.trim();
    if (!tituloClausula || !artigoTexto || !justificativaSugerida) {
      throw new Error(`cláusula ${i + 1} incompleta`);
    }
    return { id: padrao.id, tituloClausula, artigoTexto, justificativaSugerida };
  });

  /* As invariantes de tela valem para o texto GERADO igual: "gabarito" ou
     "ranking" numa réplica da máquina quebraria a mesma regra que a copy
     autoral respeita. Regerar é melhor que confiar na revisão humana de um
     texto que a professora talvez só passe o olho. */
  const visiveis = [
    contexto.premissaIaAutoritaria,
    ...prontosPrompts.flatMap((p) => [p.rotuloBotao, p.textoPrompt, p.replicaIa]),
    ...prontasClausulas.flatMap((c) => [c.tituloClausula, c.artigoTexto]),
  ];
  for (const texto of visiveis) {
    const proibidos = termosProibidosEm(texto);
    if (proibidos.length > 0) {
      throw new Error(`texto com termo proibido na tela: ${proibidos.join(", ")}`);
    }
  }

  return {
    contexto: {
      escola: contexto.escola.trim(),
      casoUsoTitulo: contexto.casoUsoTitulo.trim(),
      premissaIaAutoritaria: contexto.premissaIaAutoritaria.trim(),
    },
    prompts: prontosPrompts,
    clausulas: prontasClausulas,
  };
}

@Injectable()
export class PreparoDaExp08Service {
  constructor(
    @Inject(AI_PROVIDER) private readonly ia: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  /**
   * Gera o rascunho do pacote da turma.
   *
   * Devolve `{ pacote, usouIa: false }` quando não deu — e o pacote é o curado
   * da Unooria, completo e homologado, não um remendo. O sinal `usouIa` é o que
   * a tela usa para dizer "Utilizando pacote curado padrão da Unooria" em vez
   * de fingir que a IA respondeu.
   *
   * Não lança em falha de vendor: o único jeito de esta rota estragar a aula
   * seria bloquear a professora, e ela precisa poder aprovar o pacote curado
   * com o Vertex fora do ar.
   */
  async gerar(
    escolaId: string,
    usuarioId: string,
    perfil: Perfil,
    parametros: { nomeEscola: string; casoContextual: string; focoPrioritario: string },
  ): Promise<{ pacote: PacoteDeConteudo; usouIa: boolean; tokens: number }> {
    if (!(await this.quota.temSaldo(escolaId, usuarioId, perfil))) {
      logger.info({ codigo: "exp08-preparo-sem-saldo", escolaId }, "preparo sem saldo de IA");
      return { pacote: this.comParametros(parametros), usouIa: false, tokens: 0 };
    }

    let tokens = 0;
    try {
      const pacote = await this.ia.generateJson<PacoteDeConteudo>({
        system: SYSTEM_DO_PREPARO,
        prompt: promptDoPreparo(parametros),
        responseSchema: SCHEMA_DO_PREPARO,
        maxTokens: MAX_TOKENS_DO_PREPARO,
        // Baixa de propósito: o que se pede é conteúdo curricular consistente
        // dentro de um formato fixo, não variedade criativa.
        temperatura: 0.4,
        aoUsarTokens: (n) => {
          tokens += n;
        },
        validar: validarPacote,
      });
      await this.quota.consumir(escolaId, usuarioId, tokens);
      return { pacote, usouIa: true, tokens };
    } catch (erro) {
      /* Cobra o que foi PAGO mesmo na falha: as tentativas rejeitadas pelo
         `validar` já foram faturadas pelo vendor (ADR-74). Não cobrar aqui
         seria dar tokens de graça a quem estourou o formato três vezes. */
      if (tokens > 0) await this.quota.consumir(escolaId, usuarioId, tokens);
      logger.warn(
        { codigo: "exp08-preparo-falhou", escolaId, tokens, err: erro },
        "geração do pacote da turma falhou; devolvendo o banco curado",
      );
      return { pacote: this.comParametros(parametros), usouIa: false, tokens };
    }
  }

  /**
   * O pacote curado com o nome da escola da professora aplicado.
   *
   * Só o nome, e é a linha que separa fallback útil de fallback preguiçoso: o
   * manifesto compilado carrega "Escola Estadual Conectada" no cabeçalho, e um
   * documento que a turma vai assinar com o nome de outra escola é pior que um
   * documento sem nome. O caso e o foco NÃO são aplicados — reescrevê-los sem
   * o modelo daria um texto genérico se passando por contextualizado.
   */
  private comParametros(p: { nomeEscola: string }): PacoteDeConteudo {
    const pacote = pacoteDefault();
    pacote.contexto.escola = p.nomeEscola;
    return pacote;
  }
}
