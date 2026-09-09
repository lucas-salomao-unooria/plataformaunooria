import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { assinarTokenExperiencia } from "@/lib/chave-token";
import { cabecalhosComoObjeto, logDaRequisicao } from "@/lib/log";
import { traceparentDeSaida } from "@/lib/otel-propagacao";

/**
 * Teto maior que o do `apiDoServidor`: por aqui passam exportações (CSV de
 * análise) e importações (planilha de 30 MB), que legitimamente demoram.
 */
export const TIMEOUT_DO_BFF_MS = 30_000;

/**
 * BFF: o client do hub NUNCA segura bearer token (a sessão é cookie
 * httpOnly). Componentes client chamam `/api/plataforma/...` e este handler
 * valida a sessão, assina um token curto e repassa à api NestJS.
 *
 * Allowlist explícita: só os prefixos de rota da api que as telas do hub
 * usam. Nada de proxy aberto.
 */
const PREFIXOS_PERMITIDOS = [
  "usuarios",
  /* Área administrativa: importação de pessoas, turmas, enturmamento e o
     calendário do contrato. As guardas de papel estão na api (`@Roles`); isto
     aqui só decide quais prefixos o BFF repassa. */
  "rostering",
  "turmas",
  /* A SALA DE AULA (ADR-69): a grade da turma e o liberar/encerrar. É
     client-side porque o professor aperta na frente da sala e o card precisa
     responder na hora. As guardas de papel estão na api. */
  "salas",
  "matriculas",
  "periodos-letivos",
  /* A REDE: escolas do contrato, o vínculo das pessoas com elas (lotações) e a
     transferência de estudante entre escolas. */
  "escolas",
  /* Perfil portátil RECEBIDO de outra rede: ler e apagar. A importação tem rota
     própria do hub (`/api/perfil-recebido`) porque precisa devolver o MOTIVO da
     recusa, que este BFF engole — e não por segurança: quem confere a assinatura
     é a api, justamente para não depender de quem chama. */
  "perfis-recebidos",
  "lotacoes",
  "estudantes",
  "atividades",
  "runs",
  "posts",
  "experiencias",
  "perfis",
  "analise",
  "progresso",
  /* exp-70: o botão de zerar os dados da turma é client-side, e é o único
     caminho da Vila que não passa por `apiDoServidor`. As guardas de papel estão
     na api (`@Roles("professor")`); isto aqui só decide quais prefixos o BFF
     repassa. */
  "vila",
  /* exp-03: a LARGADA do relógio da turma é client-side — o professor aperta
     durante a aula e o painel precisa responder na hora, sem recarregar a
     página. É o único caminho do unooGPT que não passa por `apiDoServidor`.
     As guardas de papel estão na api (`@Roles("professor")`). */
  "unoogpt",
  /* exp-07: os GATES da aula (abrir a Aula 2, congelar o debate, liberar a
     reflexão) e o preparo da mídia são client-side — a professora aperta
     durante a aula e as 30 telas precisam andar na hora, sem recarregar
     página. As guardas de papel estão na api (`@Roles("professor")`). */
  "o-eco-no-grupo",
  /* exp-06: o gate da aula (abrir a Aula 2, pausar a simulação) e o "zerar
     turma" são client-side pela mesma razão da exp-07 — a professora aperta no
     meio da aula e as 30 telas andam na hora. As guardas de papel estão na api
     (`@Roles("professor", "gestor_escola", "gestor_contrato")`). */
  "rastro-boato",
  /* Sinais do NAVEGADOR do hub (cap. 17): erro de cliente e Web Vitals postam
     pela mesma rota que a SDK usa dentro do iframe, mas o client do hub não
     tem bearer — passa por aqui. A api aplica cota e redaction. */
  "observabilidade",
] as const;

async function proxy(request: NextRequest, path: string[]) {
  const session = await auth();
  if (!session?.usuario) {
    return NextResponse.json({ mensagem: "sem sessão" }, { status: 401 });
  }
  if (session.usuario.precisaTrocarSenha) {
    return NextResponse.json({ mensagem: "troque a senha antes de continuar" }, { status: 403 });
  }
  const prefixo = path[0] ?? "";
  const cabecalhos = cabecalhosComoObjeto(request.headers);
  if (!PREFIXOS_PERMITIDOS.includes(prefixo as (typeof PREFIXOS_PERMITIDOS)[number])) {
    // Era um 404 mudo. É o sintoma de uma tela nova que esqueceu de pedir
    // passagem aqui — e, sem esta linha, ele se parecia com "a api não tem a
    // rota". Só o prefixo vai ao log: o resto do caminho pode carregar id.
    logDaRequisicao(cabecalhos).warn({ prefixo, codigo: "bff-prefixo-recusado" }, "prefixo fora da allowlist do BFF");
    return NextResponse.json({ mensagem: "rota não permitida" }, { status: 404 });
  }

  const u = session.usuario;
  const token = await assinarTokenExperiencia({
    sub: u.id,
    escola_id: u.escolaId,
    turma_id: u.turmaId,
    perfil: u.papel,
  });

  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  const destino = new URL(`${apiUrl}/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((valor, chave) => destino.searchParams.set(chave, valor));

  const temCorpo = request.method !== "GET" && request.method !== "HEAD";
  // O `traceparent` do navegador (ou do LB) segue para a api: é o que faz a
  // chamada do painel do professor aparecer no mesmo trace que o span da api.
  const traceparent = traceparentDeSaida(cabecalhos);
  let resposta: Response;
  try {
    resposta = await fetch(destino, {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(traceparent ? { traceparent } : {}),
        ...(temCorpo ? { "content-type": request.headers.get("content-type") ?? "application/json" } : {}),
      },
      body: temCorpo ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_DO_BFF_MS),
    });
  } catch (erro) {
    const timeout = erro instanceof Error && erro.name === "TimeoutError";
    logDaRequisicao(cabecalhos).warn(
      { prefixo, metodo: request.method, codigo: timeout ? "api-timeout" : "api-indisponivel", err: erro },
      timeout ? "a api não respondeu ao BFF no teto" : "a api não respondeu ao BFF",
    );
    return NextResponse.json({ mensagem: "a plataforma não respondeu; tente de novo" }, { status: timeout ? 504 : 502 });
  }

  // Repassa corpo e content-type como vieram (JSON, CSV de exportação, etc.).
  return new NextResponse(resposta.body, {
    status: resposta.status,
    headers: {
      "content-type": resposta.headers.get("content-type") ?? "application/json",
      ...(resposta.headers.get("content-disposition")
        ? { "content-disposition": resposta.headers.get("content-disposition")! }
        : {}),
    },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };
export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
/* `PUT` entrou com a sala de aula (ADR-69): liberar/encerrar é idempotente, e o
   verbo diz isso. Um método que falta aqui não vira 404 e sim **405**, sem
   linha no log do BFF — o sintoma aparece como "o botão não faz nada". */
export async function PUT(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
