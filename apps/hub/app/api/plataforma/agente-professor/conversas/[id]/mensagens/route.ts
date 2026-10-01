import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  cabecalhosParaApi,
  motivoDaFalha,
  passagemDaSessao,
  respostaDeQuemDesistiu,
  sinalDaChamada,
  tokenCurto,
  urlDaApi,
} from "@/lib/bff";
import { cabecalhosComoObjeto, logDaRequisicao } from "@/lib/log";

/**
 * O TURNO DO AGENTE DE IA DO PROFESSOR — a única rota do hub que repassa um
 * stream (SSE) da api ao navegador. Contrato: `docs/regras/agente-professor.md`.
 *
 * **Por que não o BFF genérico (`../../../../[...path]/route.ts`).** Ele tem
 * teto de 180 s (`TIMEOUT_DO_BFF_MS`), calibrado para UMA chamada de geração, e
 * devolve só `content-type`/`content-disposition`. Um turno é outra coisa: a api
 * segura o stream por até 240 s (e manda `: ping` a cada 15 s), e o corpo
 * precisa chegar ao navegador pedaço a pedaço, sem buffer nem compressão. A
 * sessão, o token curto e os cabeçalhos são os MESMOS do BFF (`lib/bff.ts`):
 * só o teto e a resposta mudam.
 *
 * Rota estática: no App Router o segmento literal `agente-professor` vence o
 * catch-all `[...path]` do mesmo nível, então o `POST .../mensagens` cai aqui e
 * o resto de `/agente-professor/**` (listar, criar, ler, apagar) segue pelo BFF.
 */

/* Nunca pré-renderizar nem guardar em cache: cada chamada é um turno. O runtime
   é o Node — o `fetch` com `AbortSignal.any` e o corpo em stream são dele. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 250 s: acima dos 240 s da api (que corta antes, com o evento `erro`
 * `TEMPO_ESGOTADO` — é o corte que o professor deveria ver) e abaixo dos 300 s
 * do Cloud Run do hub (que derrubaria a conexão sem dizer nada). Este teto é a
 * rede de segurança para a api que parou de responder no meio do stream.
 */
export const TETO_DO_TURNO_MS = 250_000;

/**
 * Os cabeçalhos do stream. `no-transform` é o que importa mais: o servidor do
 * Next (`next start` / `output: standalone`) comprime com o pacote
 * `compression`, que SEGURA os pedaços até ter o bastante para comprimir — e o
 * texto chegaria todo de uma vez no fim. Ele pula a resposta que traz
 * `Cache-Control: no-transform` (conferido em
 * `next/dist/compiled/compression`), então não é preciso desligar a
 * compressão do hub inteiro. `x-accel-buffering: no` é o mesmo pedido a um
 * proxy nginx no caminho.
 */
export const CABECALHOS_DO_STREAM = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  "x-accel-buffering": "no",
} as const;

/* O id vira CAMINHO na api: só um UUID passa. Sem isto, um `..` codificado
   apontaria o POST com o token do professor para outra rota da api. A
   resposta imita a da api para id inválido — 404, sem distinguir. */
const IdSchema = z.string().uuid();

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Ctx) {
  const passagem = await passagemDaSessao();
  if ("recusa" in passagem) return passagem.recusa;
  const usuario = passagem.usuario!;

  const { id } = await ctx.params;
  const lido = IdSchema.safeParse(id);
  if (!lido.success) {
    return NextResponse.json({ codigo: "conversa-inexistente", mensagem: "Conversa não encontrada." }, { status: 404 });
  }

  const cabecalhos = cabecalhosComoObjeto(request.headers);
  const token = await tokenCurto(usuario);
  let resposta: Response;
  try {
    resposta = await fetch(urlDaApi(`agente-professor/conversas/${lido.data}/mensagens`), {
      method: "POST",
      headers: { ...cabecalhosParaApi(request, { token, temCorpo: true }), accept: "text/event-stream" },
      // O corpo vai como veio: quem valida `{ texto }` (1–4.000) é a api.
      body: await request.arrayBuffer(),
      cache: "no-store",
      /* O sinal vale para o CORPO também, não só para os cabeçalhos: o teto
         cobre o stream inteiro, e o "Parar" do navegador (ou a aba fechada)
         aborta a leitura — e a api, vendo a conexão cair, aborta a chamada ao
         agente (`res.on("close")` lá). */
      signal: sinalDaChamada(request, TETO_DO_TURNO_MS),
    });
  } catch (erro) {
    const motivo = motivoDaFalha(erro, request);
    if (motivo === "cliente-desistiu") return respostaDeQuemDesistiu();
    /* Só ids e códigos no log: nunca o texto da pergunta (regra 6 da raiz — o
       professor pode ter escrito o nome de um estudante). */
    logDaRequisicao(cabecalhos).warn(
      { rota: "agente-professor.turno", codigo: motivo === "timeout" ? "api-timeout" : "api-indisponivel", err: erro },
      "a api não respondeu ao turno do agente",
    );
    return NextResponse.json(
      motivo === "timeout"
        ? { codigo: "TEMPO_ESGOTADO", mensagem: "A resposta demorou demais e foi interrompida. Tente de novo." }
        : { codigo: "plataforma-indisponivel", mensagem: "A plataforma não respondeu. Tente de novo em instantes." },
      { status: motivo === "timeout" ? 504 : 502 },
    );
  }

  const tipo = resposta.headers.get("content-type") ?? "";
  if (!tipo.includes("text/event-stream")) {
    /* RECUSA ANTES DO STREAM (400, 403, 404, 429, 503): a api responde JSON
       `{ codigo, mensagem }` e o status diz por quê. Repassa os dois como
       vieram — é deles que o navegador decide a mensagem e se oferece
       "Tentar de novo". */
    return new NextResponse(resposta.body, {
      status: resposta.status,
      headers: { "content-type": tipo || "application/json" },
    });
  }

  return new Response(resposta.body, { status: resposta.status, headers: CABECALHOS_DO_STREAM });
}
