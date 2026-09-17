import { NextResponse, type NextRequest } from "next/server";
import { cabecalhosComoObjeto, logDaRequisicao } from "@/lib/log";
import { traceparentDeSaida } from "@/lib/otel-propagacao";

/**
 * O cadastro de interesse do site público (ADR-107) — do formulário para a api.
 *
 * Rota PRÓPRIA, e não o BFF de `/api/plataforma/*`, por duas razões:
 *
 *  - o BFF exige sessão, e aqui não há: quem preenche é um visitante. A única
 *    exceção que ele abre é a dos sinais de navegador (ADR-84), e ampliá-la
 *    para uma rota que ESCREVE dado pessoal tornaria a regra "o BFF exige
 *    sessão" uma regra com lista de exceções — que é como ela deixa de valer;
 *  - o MOTIVO da recusa precisa chegar ao formulário. O BFF repassa o corpo,
 *    mas o texto que o site mostra é decisão desta camada: a api responde com
 *    código (`corpo-invalido`, `cota-excedida`) e quem traduz para a frase que
 *    a pessoa lê é aqui.
 *
 * O `x-forwarded-for` É REPASSADO, e sem ele a defesa cai: a cota da api é por
 * IP, e sem o cabeçalho todos os visitantes chegam como um único cliente — o
 * primeiro robô gastaria a cota de todo mundo e o formulário pararia de aceitar
 * cadastro de gente de verdade, com a tela dizendo "tente mais tarde".
 */

const TIMEOUT_MS = 10_000;

const FRASES: Record<string, string> = {
  "corpo-invalido": "Revise os campos obrigatórios.",
  "cota-excedida": "Recebemos cadastros demais deste acesso agora há pouco. Tente novamente mais tarde.",
};

export async function POST(request: NextRequest) {
  const cabecalhos = cabecalhosComoObjeto(request.headers);
  const traceparent = traceparentDeSaida(cabecalhos);
  const encaminhado = request.headers.get("x-forwarded-for");

  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}/prospeccao/publico/cadastros`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(encaminhado ? { "x-forwarded-for": encaminhado } : {}),
        ...(traceparent ? { traceparent } : {}),
      },
      body: await request.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (erro) {
    logDaRequisicao(cabecalhos).warn({ codigo: "prospeccao-api-indisponivel", err: erro }, "a api não respondeu ao cadastro de interesse");
    return NextResponse.json(
      { mensagem: "Não foi possível enviar agora. Tente novamente em alguns minutos." },
      { status: 502 },
    );
  }

  const corpo = (await resposta.json().catch(() => ({}))) as { codigo?: string; mensagem?: string };
  if (!resposta.ok) {
    return NextResponse.json(
      { mensagem: FRASES[corpo.codigo ?? ""] ?? corpo.mensagem ?? "Não foi possível enviar agora." },
      { status: resposta.status },
    );
  }
  return NextResponse.json(corpo, { status: 201 });
}
