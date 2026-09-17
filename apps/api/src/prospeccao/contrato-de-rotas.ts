import { z } from "zod";

/**
 * O CADASTRO DE INTERESSE (ADR-107) — o contrato do formulário do site público
 * e o da tela que lê os cadastros.
 *
 * Os tetos de tamanho são os do bundle original, um por um. Eles não estão aqui
 * para economizar disco: é o que impede que um robô encha a tabela com um campo
 * de megabytes, e é o que garante que a coluna da tela caiba na linha.
 */

/** A frase que o site exibe ao lado da caixa de consentimento. */
export const TEXTO_DO_CONSENTIMENTO = "Autorizo o contato da Unooria sobre o ENTRE REDES.";

export const CadastroDeInteresseSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  /* `.email()` e não um `regex` caseiro: o endereço é o único jeito de
     responder a quem se cadastrou, e também a chave do dedupe. */
  email: z.string().trim().email().max(180),
  telefone: z.string().trim().min(1).max(40),
  organizacao: z.string().trim().min(1).max(180),
  cargo: z.string().trim().min(1).max(100),
  /* `literal(true)`, não `boolean`: sem o aceite não existe base legal para
     guardar nada (LGPD art. 7º, I), então "false" não é um cadastro sem
     consentimento — é uma requisição inválida. */
  consentimento: z.literal(true),
  /**
   * O CAMPO-ARMADILHA. Fica escondido no formulário e fora da ordem de foco:
   * gente não o vê, preenchedor automático de robô sim. Vindo preenchido, a
   * api responde 201 e NÃO grava — recusar com erro ensinaria o robô a tentar
   * de novo sem ele.
   */
  website: z.string().max(200).optional(),
});

export const CadastroRecebidoSchema = z.object({
  recebido: z.literal(true),
});

/** Uma linha da tabela do painel. O `id` não sai: não há rota que o consuma. */
const CadastroSchema = z.object({
  nome: z.string(),
  email: z.string(),
  telefone: z.string(),
  organizacao: z.string(),
  cargo: z.string(),
  criadoEm: z.string().describe("ISO 8601, em UTC — quem formata é a tela (ADR-98/99)."),
});

export const CadastrosSchema = z.object({
  cadastros: z.array(CadastroSchema),
  /** O total REAL na tabela, que pode ser maior que a lista devolvida. */
  total: z.number().int(),
});

export type Cadastro = z.infer<typeof CadastroSchema>;

/**
 * Teto da listagem. Cinco mil é o número do bundle original, mantido: é ordens
 * de grandeza acima do volume real de um funil comercial B2G, e é o que evita
 * que um dia de robô transforme a tela num download de vários megabytes.
 */
export const TETO_DA_LISTAGEM = 5_000;
