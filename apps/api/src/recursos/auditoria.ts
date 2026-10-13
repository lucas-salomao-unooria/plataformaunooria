import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

/**
 * O REGISTRO APPEND-ONLY das mudanças do painel (ADR-89).
 *
 * A linha de `disponibilidades` responde "o que vale AGORA"; ela é sobrescrita
 * a cada mudança, e por isso não responde "quem desligou isto, e quando?". O
 * log estruturado (`recurso-alterado`) responde — para quem tem acesso ao Cloud
 * Logging. Esta tabela responde na TELA, que é onde a pergunta é feita.
 */

export const ACOES_DE_AUDITORIA = [
  "ligado",
  "desligado",
  /** A exceção do escopo foi REMOVIDA: ele volta a seguir o de cima. */
  "herdado",
  "versao-ativada",
  "versao-fixada",
  "versao-soltada",
  /** O teto diário de IA de um perfil mudou (ADR-105). `recurso_id` é `quota:<perfil>`. */
  "quota-alterada",
  /** A configuração da Ajuda mudou (ADR-158). `recurso_id` é `ajuda:configuracao`; sem `detalhe`. */
  "configuracao-alterada",
] as const;

export type AcaoDeAuditoria = (typeof ACOES_DE_AUDITORIA)[number];

export const AcaoSchema = z.enum(ACOES_DE_AUDITORIA);

/** As duas ações que carregam versão — o CHECK do banco cobra o mesmo par. */
const COM_VERSAO: readonly AcaoDeAuditoria[] = ["versao-ativada", "versao-fixada"];

/** O `detalhe` de uma mudança de quota: o número que valia e o que passou a valer. */
export type DetalheDeQuota = { de: number; para: number };
export const DetalheDeQuotaSchema = z.object({ de: z.number().int(), para: z.number().int() });

/**
 * Grava uma linha de histórico. **Nunca falha a operação que a chamou.**
 *
 * O registro é subordinado ao ato: se ele não puder ser escrito, a decisão do
 * operador — desligar um produto num incidente — não pode ser desfeita por
 * causa disso. O que não pode acontecer é o erro sumir, então ele vai ao log
 * com código próprio, que é o que uma métrica de log alcança.
 *
 * `autorNome` é CONGELADO aqui, com uma consulta a mais por escrita (que são
 * raras): um JOIN na leitura mostraria o nome de hoje, ou nada se a conta saiu
 * da rede, e o registro deixaria de dizer quem era aquela pessoa naquele dia.
 */
export async function registrarAuditoria(
  prisma: PrismaClient,
  dados: {
    recursoId: string;
    escolaId: string | null;
    acao: AcaoDeAuditoria;
    versao?: string | null;
    motivo?: string | null;
    /** Só em `quota-alterada` (CHECK bicondicional): `{ de, para }`. */
    detalhe?: DetalheDeQuota | null;
    autorId: string;
  },
  aoFalhar: (erro: unknown) => void,
): Promise<void> {
  try {
    const autor = await prisma.user.findUnique({
      where: { id: dados.autorId },
      select: { displayName: true },
    });
    await prisma.recursoAuditoria.create({
      data: {
        recursoId: dados.recursoId,
        escolaId: dados.escolaId,
        acao: dados.acao,
        /* O CHECK do banco é bicondicional: versão existe exatamente nas duas
           ações que a carregam. Normalizar aqui evita um 500 por um `versao`
           que chegou de carona numa ação de liga/desliga. */
        versao: COM_VERSAO.includes(dados.acao) ? (dados.versao ?? null) : null,
        /* Mesma normalização para o `detalhe`: ele só significa algo na mudança
           de quota, e o banco recusa nas outras ações (ADR-105). */
        detalhe: dados.acao === "quota-alterada" ? (dados.detalhe ?? undefined) : undefined,
        motivo: dados.motivo ?? null,
        autorId: dados.autorId,
        /* Conta sem nome não deveria existir, mas o registro não é o lugar de
           descobrir isso: um rótulo genérico é melhor que uma linha perdida. */
        autorNome: autor?.displayName ?? "(conta sem nome)",
      },
    });
  } catch (erro) {
    aoFalhar(erro);
  }
}
