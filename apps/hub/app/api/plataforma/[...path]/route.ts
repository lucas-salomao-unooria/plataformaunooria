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
  /* EQUIPES NA MISSÃO (E13): sortear, separar, salvar e desfazer as equipes de
     uma missão numa turma. Client-side pela mesma razão do liberar: o professor
     monta as equipes na frente da sala, e a ficha precisa responder na hora. As
     guardas de papel estão na api (só `professor` escreve; gestor lê). */
  "equipes",
  /* EVIDÊNCIA PEDAGÓGICA (E14): "Confirmar para a turma" (POST) e o ajuste do
     nível de uma habilidade, de um estudante ou de vários (PATCH), no painel da
     atividade. Client-side porque o professor corrige olhando a turma, e o
     painel volta atualizado na própria resposta. As guardas de papel estão na
     api (só `professor` escreve; gestor lê). */
  "evidencias",
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
  /* O interruptor da rede (ADR-87). Só a LEITURA passa por aqui: a escrita é do
     painel da Unooria, e o `@Roles("admin")` da api é quem a protege. */
  "recursos",
  "perfis",
  "analise",
  "progresso",
  /* app-70: o botão de zerar os dados da turma é client-side, e é o único
     caminho da Vila que não passa por `apiDoServidor`. As guardas de papel estão
     na api (`@Roles("professor")`); isto aqui só decide quais prefixos o BFF
     repassa. */
  "vila",
  /* exp02em1b: a LARGADA do relógio da turma é client-side — o professor aperta
     durante a aula e o painel precisa responder na hora, sem recarregar a
     página. É o único caminho do unooGPT que não passa por `apiDoServidor`.
     As guardas de papel estão na api (`@Roles("professor")`). */
  "unoogpt",
  /* exp07ef1b: os GATES da aula (abrir a Aula 2, congelar o debate, liberar a
     reflexão) e o preparo da mídia são client-side — a professora aperta
     durante a aula e as 30 telas precisam andar na hora, sem recarregar
     página. As guardas de papel estão na api (`@Roles("professor")`). */
  "o-eco-no-grupo",
  /* exp06ef2b: o gate da aula (abrir a Aula 2, pausar a simulação) e o "zerar
     turma" são client-side pela mesma razão da exp07ef1b — a professora aperta no
     meio da aula e as 30 telas andam na hora. As guardas de papel estão na api
     (`@Roles("professor", "gestor_escola", "gestor_contrato")`). */
  "rastro-boato",
  /* exp01ef1b: o latch da Roda (LIBERAR REFLEXÃO FINAL), a preparação do pacote
     (gerar/aprovar) e o "zerar turma" são client-side — o professor aperta no
     meio da aula e os tablets do 1º ano andam pelo polling deles. As guardas
     de papel estão na api (`@Roles("professor", ...GESTORES)`). */
  "foto-conta",
  /* exp08ef4b: a preparação do caso da escola (gerar/publicar), os dois botões do
     debate e o "zerar turma" são client-side pela mesma razão da exp06ef2b — a
     professora aperta no meio da aula e as 30 telas andam na hora, por polling
     de 5s (ADR-93). As guardas de papel estão na api (`@Roles("professor",
     "gestor_escola", "gestor_contrato")`). */
  "manifesto-ia",
  /* exp05ef1b v2.2: o preparo (gerar e aprovar o pacote), os TRÊS botões da
     aula — revelação, síntese e reflexão —, o "Zerar Turma para Nova
     Aplicação" e o painel que se atualiza sozinho são client-side pela mesma
     razão da exp08ef4b: a professora aperta no meio da aula, na frente da sala,
     e as telas andam pelo polling de 3 s (ADR-93). O painel é relido daqui a
     cada 5 s enquanto a aula anda. As guardas de papel estão na api (gerar,
     aprovar, os botões e zerar são `@Roles("professor")`, e só de quem leciona;
     gestor lê). */
  "quem-mandou-isso",
  /* Os cadastros de interesse do site público (ADR-107) — só a LEITURA, e só
     `admin` (o `@Roles` está na api). A ESCRITA não passa por aqui: ela vem de
     visitante sem sessão, e tem rota própria (`/api/cadastro-de-interesse`). */
  "prospeccao",
  /* Sinais do NAVEGADOR do hub (cap. 17): erro de cliente e Web Vitals postam
     pela mesma rota que a SDK usa dentro do iframe, mas o client do hub não
     tem bearer — passa por aqui. A api aplica cota e redaction. */
  "observabilidade",
] as const;

/**
 * Sinal do navegador que TAMBÉM vale sem sessão (ADR-84): erro de cliente e
 * Web Vital na landing, no login e na troca de senha.
 *
 * Estas duas rotas são as únicas em que "não há sessão" não pode virar 401. A
 * tela de login é por onde todo mundo passa, e o erro dela era o único que não
 * deixava rastro em lugar nenhum — o 401 daqui descartava exatamente o sinal de
 * que ninguém estava conseguindo entrar.
 *
 * Quem escolhe o destino é o BFF, não o client: com sessão vai para a rota
 * autenticada (e o log ganha o id do usuário), sem sessão vai para a pública
 * (sem identidade, com cota por IP). O client posta sempre no mesmo lugar e
 * nunca vê um 401 — que, além de descartar o sinal, sujava o console de toda
 * suíte e2e como "pendência conhecida".
 */
function ehSinalDoNavegador(request: NextRequest, path: string[]): boolean {
  return request.method === "POST" && path.length === 2 && path[0] === "observabilidade" && (path[1] === "erros-cliente" || path[1] === "vitals");
}

async function proxy(request: NextRequest, path: string[]) {
  const session = await auth();
  const sinalDoNavegador = ehSinalDoNavegador(request, path);
  const semSessao = !session?.usuario;
  if (semSessao && !sinalDoNavegador) {
    return NextResponse.json({ mensagem: "sem sessão" }, { status: 401 });
  }
  // Preso na troca de senha ainda é gente usando uma tela: o erro dela conta.
  if (session?.usuario?.precisaTrocarSenha && !sinalDoNavegador) {
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

  const u = session?.usuario;
  const token = u
    ? await assinarTokenExperiencia({
        sub: u.id,
        escola_id: u.escolaId,
        turma_id: u.turmaId,
        perfil: u.papel,
      })
    : null;

  const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  // Sem sessão, o mesmo sinal vai para o par público da rota.
  const caminho = token ? path.join("/") : `observabilidade/publico/${path[1]}`;
  const destino = new URL(`${apiUrl}/${caminho}`);
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
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        /*
         * O `user-agent` do NAVEGADOR só é repassado para os sinais de
         * observabilidade, e é o que os torna úteis: é dele que a api deriva
         * `navegador`/`so`/`tipo`. Sem esta linha o BFF mandava o user-agent do
         * runtime do Next, e todo erro do hub era classificado como
         * `outro/outro/desktop` — medido antes de existir (ADR-84). Não vale
         * para as demais rotas: elas não leem o cabeçalho, e repassá-lo seria
         * ampliar o que atravessa o BFF sem consumidor.
         */
        ...(sinalDoNavegador && request.headers.get("user-agent")
          ? { "user-agent": request.headers.get("user-agent") as string }
          : {}),
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
