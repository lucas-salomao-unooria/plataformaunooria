import { caminhoDasEquipes, type SugestaoDeEquipes } from "../equipes";
import { caminhoDoEmAndamento, type MissaoComAtividade } from "./atividades";

/**
 * O FIM DA CRIAÇÃO DE UMA ATIVIDADE (ADR-130), depois que a missão gravou o
 * conteúdo e devolveu o id: pôr no ar (se o professor pediu) e montar as
 * equipes do jeito que ele escolheu.
 *
 * Por que aqui, e não na api numa transação só: cada missão é dona da própria
 * atividade, e as equipes são de outro módulo. O que custa é a ordem — a
 * equipe precisa do id da atividade, que só existe depois de criá-la. Se um
 * passo falhar, a atividade JÁ existe: o que volta é a lista de avisos, e a
 * página da atividade mostra o que ficou por fazer. Nunca apagar a atividade
 * por causa da equipe: o conteúdo custou o preparo (e saldo de IA).
 *
 * Puro de propósito (o `fetch` entra por parâmetro), para o teste exercitar a
 * ordem e as falhas sem navegador.
 */

/** A escolha do passo de equipes. `manual` não grava nada aqui: as equipes vazias abrem na página. */
export type EscolhaDeEquipes =
  | { modo: "sorteio"; computadores: number }
  | { modo: "manual"; computadores: number }
  | { modo: "individual" };

export interface FimDaCriacao {
  /** O que não deu certo, em frases para o professor. A atividade existe mesmo assim. */
  avisos: string[];
}

type Busca = (url: string, init?: RequestInit) => Promise<Response>;

const BFF = "/api/plataforma";
const json = { "content-type": "application/json" };

async function mensagem(resposta: Response, padrao: string): Promise<string> {
  const corpo = (await resposta.json().catch(() => null)) as { mensagem?: unknown } | null;
  return typeof corpo?.mensagem === "string" && corpo.mensagem ? corpo.mensagem : padrao;
}

export async function concluirCriacao(
  {
    expId,
    turmaId,
    atividadeId,
    equipes,
    porNoAr,
  }: {
    expId: MissaoComAtividade;
    turmaId: string;
    atividadeId: string;
    equipes: EscolhaDeEquipes;
    porNoAr: boolean;
  },
  busca: Busca = fetch,
): Promise<FimDaCriacao> {
  const avisos: string[] = [];

  if (porNoAr) {
    try {
      const r = await busca(`${BFF}${caminhoDoEmAndamento(expId, turmaId, atividadeId)}`, {
        method: "POST",
        headers: json,
        body: "{}",
      });
      if (!r.ok) {
        avisos.push(
          `A atividade foi criada, mas não entrou em andamento: ${await mensagem(r, "tente pelo botão “Usar esta atividade agora”.")}`,
        );
      }
    } catch {
      avisos.push("A atividade foi criada, mas não entrou em andamento: sem conexão. Use “Usar esta atividade agora”.");
    }
  }

  if (equipes.modo === "manual") return { avisos };

  const base = `${BFF}${caminhoDasEquipes(turmaId, expId, atividadeId)}`;
  const falhou = (detalhe: string) => avisos.push(`A atividade foi criada, mas as equipes não foram salvas: ${detalhe}`);
  try {
    let corpo: unknown;
    if (equipes.modo === "individual") {
      corpo = { versao: 0, modo: "individual", computadores: null, ausentes: [], equipes: [] };
    } else {
      const s = await busca(`${base}/sugestao`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ modo: "sorteio", computadores: equipes.computadores, ausentes: [] }),
      });
      if (!s.ok) {
        falhou(await mensagem(s, "monte-as na página da atividade."));
        return { avisos };
      }
      const sugestao = (await s.json()) as SugestaoDeEquipes;
      corpo = {
        versao: 0,
        modo: "sorteio",
        computadores: equipes.computadores,
        ausentes: [],
        equipes: sugestao.equipes.map((e) => ({ nome: e.nome, membros: e.membros.map((m) => m.id) })),
      };
    }
    const r = await busca(base, { method: "PUT", headers: json, body: JSON.stringify(corpo) });
    if (!r.ok) falhou(await mensagem(r, "monte-as na página da atividade."));
  } catch {
    falhou("sem conexão. Monte-as na página da atividade.");
  }
  return { avisos };
}

/**
 * O endereço da página da atividade depois de criar. "Eu separo" leva o
 * número de computadores (`separar=N`): as equipes vazias já abrem para
 * arrastar, sem perguntar de novo o que acabou de ser respondido.
 */
export function destinoDepoisDeCriar(rotaDaAtividade: string, equipes: EscolhaDeEquipes): string {
  if (equipes.modo !== "manual") return rotaDaAtividade;
  const separador = rotaDaAtividade.includes("?") ? "&" : "?";
  return `${rotaDaAtividade}${separador}separar=${equipes.computadores}`;
}
