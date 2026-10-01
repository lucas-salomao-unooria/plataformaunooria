import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { UsuarioDaSessao } from "@/types/next-auth";
import { auth } from "./auth";
import { assinarTokenExperiencia } from "./chave-token";
import { cabecalhosComoObjeto } from "./log";
import { traceparentDeSaida } from "./otel-propagacao";

/**
 * A PASSAGEM DO NAVEGADOR PARA A API — o que o BFF genérico
 * (`app/api/plataforma/[...path]/route.ts`) e a rota de stream do agente de IA
 * do professor (`app/api/plataforma/agente-professor/conversas/[id]/mensagens`)
 * fazem igual: ler a sessão NextAuth, recusar quem não pode passar, assinar o
 * token CURTO (a mesma moeda do `apiDoServidor` e da experiência) e montar os
 * cabeçalhos da chamada à api.
 *
 * Mora aqui, e não copiado nas duas rotas, porque é regra de segurança: a
 * recusa de quem está preso na troca de senha, por exemplo, numa cópia
 * esquecida viraria a porta dos fundos para pular `/trocar-senha` pelo chat.
 */

/** A recusa já pronta, ou o usuário (ou `null`, quando a rota aceita sem sessão). */
export type PassagemDaSessao = { recusa: NextResponse } | { usuario: UsuarioDaSessao | null };

/**
 * Sem sessão = 401; preso na troca de senha = 403 — nos dois casos JSON
 * `{ mensagem }`, que é o que as telas do hub já sabem ler.
 *
 * `aceitaSemSessao` é dos sinais do navegador do BFF (ADR-84): o erro da tela
 * de login também conta, e é justamente o de quem não conseguiu entrar.
 */
export async function passagemDaSessao(opcoes: { aceitaSemSessao?: boolean } = {}): Promise<PassagemDaSessao> {
  const session = await auth();
  const usuario = session?.usuario ?? null;
  if (!usuario && !opcoes.aceitaSemSessao) {
    return { recusa: NextResponse.json({ mensagem: "sem sessão" }, { status: 401 }) };
  }
  // Preso na troca de senha ainda é gente usando uma tela: o erro dela conta.
  if (usuario?.precisaTrocarSenha && !opcoes.aceitaSemSessao) {
    return { recusa: NextResponse.json({ mensagem: "troque a senha antes de continuar" }, { status: 403 }) };
  }
  return { usuario };
}

/** O token curto (RS256, 15 min) que a api valida — nunca chega ao navegador. */
export function tokenCurto(usuario: UsuarioDaSessao): Promise<string> {
  return assinarTokenExperiencia({
    sub: usuario.id,
    escola_id: usuario.escolaId,
    turma_id: usuario.turmaId,
    perfil: usuario.papel,
  });
}

/** O endereço interno da api. Só o servidor do hub o conhece (regra 2 da raiz). */
export function urlDaApi(caminho: string): URL {
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  return new URL(`${apiUrl}/${caminho.replace(/^\/+/, "")}`);
}

/**
 * Os cabeçalhos de toda chamada do BFF à api: o `Bearer` (quando há sessão), o
 * `traceparent` (o que põe a tela do professor e o span da api no MESMO trace)
 * e o `content-type` de quem tem corpo. Nada mais atravessa por padrão — o que
 * uma rota precisar a mais (o `user-agent` dos sinais do navegador) ela
 * acrescenta, e diz por quê.
 */
export function cabecalhosParaApi(
  request: NextRequest,
  opcoes: { token: string | null; temCorpo: boolean },
): Record<string, string> {
  const traceparent = traceparentDeSaida(cabecalhosComoObjeto(request.headers));
  return {
    ...(opcoes.token ? { authorization: `Bearer ${opcoes.token}` } : {}),
    ...(traceparent ? { traceparent } : {}),
    ...(opcoes.temCorpo ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}),
  };
}

/**
 * O teto da chamada E o cancelamento de quem pediu, num sinal só.
 *
 * `request.signal` aborta quando o navegador desiste (aba fechada, `abort()` do
 * "Parar"): repassá-lo ao `fetch` é o que faz a desistência chegar à api — que
 * só então solta o que estava fazendo. Sem ele, o hub seguia esperando uma
 * resposta que ninguém ia ler.
 */
export function sinalDaChamada(request: NextRequest, tetoMs: number): AbortSignal {
  return AbortSignal.any([request.signal, AbortSignal.timeout(tetoMs)]);
}

/** Por que o `fetch` à api não terminou: teto, desistência de quem pediu, ou a api fora do ar. */
export function motivoDaFalha(erro: unknown, request: NextRequest): "timeout" | "cliente-desistiu" | "api-indisponivel" {
  if (erro instanceof Error && erro.name === "TimeoutError") return "timeout";
  if (request.signal.aborted) return "cliente-desistiu";
  return "api-indisponivel";
}

/**
 * A resposta para quem já foi embora. Ninguém a lê; o status 499 (o "cliente
 * fechou a conexão" do nginx) só existe para o log de acesso não contar a
 * desistência como erro do servidor.
 */
export function respostaDeQuemDesistiu(): Response {
  return new Response(null, { status: 499 });
}
