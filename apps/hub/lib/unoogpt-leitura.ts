import type { MarcoDaTrilha, RodadaDoEstudante } from "./unoogpt-tipos";

/**
 * Como a tela do professor escreve TEMPO e MARCO da exp-03. Puro.
 *
 * O texto mora aqui e não no banco pelo mesmo motivo da linha do tempo do
 * estudante: o payload guarda fato, e frase envelhece. E mora no hub, não
 * importado da experiência: o clone é da seção `chatgpt`, e o que fala aqui é a
 * escola.
 */

/** "3:40" a partir de segundos. Arredonda ANTES de dividir (senão dá "3:60"). */
export function cronometro(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A hora corrente da cidade a partir do minuto narrativo: "17h24". */
export function horaDaCidade(minuto: number): string {
  const total = 17 * 60 + Math.min(Math.max(minuto, 0), 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}h${String(total % 60).padStart(2, "0")}`;
}

/**
 * Com que relógio datar um marco: o cronômetro que o estudante via, quando foi
 * gravado; senão (modo livre, marco antigo) a hora da cidade.
 */
export function quandoDoMarco(m: Pick<MarcoDaTrilha, "segundosRestantes" | "minuto">): string {
  return m.segundosRestantes === null
    ? horaDaCidade(m.minuto)
    : `faltavam ${cronometro(m.segundosRestantes)}`;
}

const ORIGEM_DO_RECOMECO: Record<"investigacao" | "resultado", string> = {
  investigacao: "pela lixeira, no meio da investigação",
  resultado: "por “Tentar de novo”, depois do resultado",
};

/** Cada marco vira uma frase curta para o professor. */
export function descreverMarco(m: MarcoDaTrilha): string {
  const d = (m.dados ?? {}) as Record<string, unknown>;
  switch (m.tipo) {
    case "inicio":
      return "Entrou na investigação.";
    case "fontes":
      return `O assistente carregou ${((d.rotulos ?? []) as string[]).join(" e ") || "uma fonte"}.`;
    case "leitura": {
      const conflitos = (d.conflitos ?? []) as { nome: string }[];
      return conflitos.length > 0
        ? `Cruzou os dados — fontes em conflito sobre ${conflitos.map((c) => c.nome).join(", ")}.`
        : "Cruzou os dados.";
    }
    case "alocacao":
      return `Destinos: Alfa → ${(d.alfa as string | null) ?? "base"} · Bravo → ${(d.bravo as string | null) ?? "base"}.`;
    case "envio":
      return `Enviou as equipes${m.motivoDoFim ? ` com o relógio já fechado (${m.motivoDoFim === "tempo" ? "a chuva chegou" : "o professor encerrou"})` : ""}.`;
    case "recomeco": {
      const origem = d.origem as "investigacao" | "resultado" | null | undefined;
      return `Recomeçou${origem ? ` ${ORIGEM_DO_RECOMECO[origem]}` : ""}.`;
    }
    default:
      return "";
  }
}

/** O estado do relógio da turma, em português de professor. */
export function faseEmTexto(r: NonNullable<RodadaDoEstudante["recomeco"]>): string {
  if (r.fase === "aguardando") return "antes da largada";
  if (r.fase === "encerrado") {
    return r.motivoDoFim === "professor" ? "depois de o professor encerrar" : "depois de a chuva chegar";
  }
  if (r.modo === "livre") return "com a aula correndo, sem cronômetro";
  return r.segundosRestantes === null
    ? "com a aula correndo"
    : `com a aula correndo, faltavam ${cronometro(r.segundosRestantes)}`;
}

/** "Faltavam 1:40", "estourou (a chuva chegou)", "sem cronômetro". */
export function envioEmTexto(e: NonNullable<RodadaDoEstudante["envio"]>): string {
  if (e.estourou) return e.motivoDoFim === "professor" ? "estourou — o professor encerrou" : "estourou — a chuva chegou";
  if (e.segundosRestantes === null) return "sem cronômetro (modo livre)";
  return `faltavam ${cronometro(e.segundosRestantes)}`;
}
