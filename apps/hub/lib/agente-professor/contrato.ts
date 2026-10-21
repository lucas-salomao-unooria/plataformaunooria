import { z } from "zod";

/**
 * O contrato do agente de IA do professor, do lado do HUB — uma cópia
 * DELIBERADA de `apps/api/src/agente-professor/contrato-de-rotas.ts`, no mesmo
 * arranjo de `lib/papeis.ts`: o hub não importa código da api. A forma do
 * stream (os seis eventos) é contrato das quatro pontas e vive em
 * `docs/regras/agente-professor.md`; mudou lá, muda aqui E lá no mesmo commit.
 *
 * Tudo o que chega da api é LIDO por estes schemas, e o que não casa é
 * descartado em vez de quebrar a tela: um evento novo que o hub ainda não
 * conhece não pode derrubar uma resposta que está chegando.
 */

/** O mesmo teto da api (`TAMANHO_MAXIMO_DA_MENSAGEM`): o contador do compositor mostra este número. */
export const TAMANHO_MAXIMO_DA_MENSAGEM = 4_000;

/** Onde o navegador fala com o agente: SEMPRE pelo hub, nunca com a api nem com o Agent Engine. */
export const BASE_DO_AGENTE = "/api/plataforma/agente-professor";

export const FonteSchema = z.object({
  titulo: z.string(),
  paginaInicio: z.number().int().nullable().optional(),
  paginaFim: z.number().int().nullable().optional(),
});
export type Fonte = z.infer<typeof FonteSchema>;

export const ConversaResumoSchema = z.object({
  id: z.string(),
  /** `null` até o fim do 1º turno: quem escreve o título é o agente. */
  titulo: z.string().nullable(),
  criadaEm: z.string(),
  atualizadaEm: z.string(),
});
export type ConversaResumo = z.infer<typeof ConversaResumoSchema>;

export const ListaDeConversasSchema = z.array(ConversaResumoSchema);

export const ConversaCriadaSchema = z.object({ id: z.string() });

export const ConversaSchema = z.object({
  id: z.string(),
  titulo: z.string().nullable(),
  mensagens: z.array(
    z.object({
      autor: z.enum(["professor", "agente"]),
      texto: z.string(),
      fontes: z.array(FonteSchema).optional(),
    }),
  ),
});
export type Conversa = z.infer<typeof ConversaSchema>;

/** O corpo das recusas JSON (antes do stream) e do evento `erro`: `{ codigo, mensagem }`. */
export const RecusaSchema = z
  .object({
    codigo: z.string().optional(),
    mensagem: z.string().optional(),
  })
  .passthrough();
export type Recusa = z.infer<typeof RecusaSchema>;

/* ------------------------------------------------------------- o stream */

export const EventoDeltaSchema = z.object({ texto: z.string() });
export const EventoFontesSchema = z.object({ fontes: z.array(FonteSchema) });
export const EventoTituloSchema = z.object({ titulo: z.string() });
export const EventoAvisoSchema = z.object({ codigo: z.string(), mensagem: z.string() });
export const EventoErroSchema = z.object({ codigo: z.string(), mensagem: z.string() });

/** Um evento do stream já lido e validado. O que não casa com nenhum vira `null` e é ignorado. */
export type EventoDoTurno =
  | { tipo: "delta"; texto: string }
  | { tipo: "fontes"; fontes: Fonte[] }
  | { tipo: "titulo"; titulo: string }
  | { tipo: "aviso"; codigo: string; mensagem: string }
  | { tipo: "fim" }
  | { tipo: "erro"; codigo: string; mensagem: string };

function json(dados: string): unknown {
  if (dados.trim() === "") return {};
  try {
    return JSON.parse(dados);
  } catch {
    return undefined;
  }
}

/** `event:` + `data:` de um frame SSE → o evento do turno (ou `null`, se não for do contrato). */
export function lerEvento(evento: string, dados: string): EventoDoTurno | null {
  const corpo = json(dados);
  switch (evento) {
    case "delta": {
      const lido = EventoDeltaSchema.safeParse(corpo);
      return lido.success ? { tipo: "delta", texto: lido.data.texto } : null;
    }
    case "fontes": {
      const lido = EventoFontesSchema.safeParse(corpo);
      return lido.success ? { tipo: "fontes", fontes: lido.data.fontes } : null;
    }
    case "titulo": {
      const lido = EventoTituloSchema.safeParse(corpo);
      return lido.success ? { tipo: "titulo", titulo: lido.data.titulo } : null;
    }
    case "aviso": {
      const lido = EventoAvisoSchema.safeParse(corpo);
      return lido.success ? { tipo: "aviso", ...lido.data } : null;
    }
    case "fim":
      /* O `fim` encerra o turno mesmo com `data:` torto ou ausente: perder o
         fim deixaria a mensagem "escrevendo" para sempre. */
      return { tipo: "fim" };
    case "erro": {
      const lido = EventoErroSchema.safeParse(corpo);
      return {
        tipo: "erro",
        codigo: lido.success ? lido.data.codigo : "AGENTE_INDISPONIVEL",
        mensagem: lido.success ? lido.data.mensagem : "",
      };
    }
    default:
      return null;
  }
}
