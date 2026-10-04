import { NextResponse, type NextRequest } from "next/server";
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
 * Teto maior que o do `apiDoServidor`: por aqui passam exportações (CSV de
 * análise) e importações (planilha de 30 MB), que legitimamente demoram.
 *
 * Eram 30 s, calibrados para TRANSFERÊNCIA de arquivo. As rotas de geração por
 * IA são espera de outra natureza — a api fica parada enquanto o modelo
 * escreve — e passaram a encostar no teto. MEDIDO em 2026-09-28 (provider
 * `vertex`, `gemini-3.6-flash`), com o ADC válido e o Vertex respondendo:
 *
 *   - `quem-mandou-isso/.../gerar` (8 mensagens) ......... 6 a 13 s
 *   - `jornal-escola/.../gerar-conteudo` (8 notícias) .... 19 a 24 s
 *   - `a-selecao/.../gerar-conteudo` (12 posts + 3 falas)  20 a 30,1 s
 *   - `a-selecao/.../gerar-podcast` (UM trecho por volta)  ~21 s, 5 voltas
 *
 * A Seleção virou moeda ao ar: a MESMA chamada deu 200 em 24,9 s e 504 em
 * 30,1 s na mesma sessão. E o 504 aqui é caro de um jeito que não aparece: o
 * corte é do lado do hub, a api TERMINA o trabalho e debita a quota de IA do
 * professor — só que ninguém está mais ouvindo a resposta.
 *
 * O número é o teto de UMA chamada, não uma promessa de que a tela espera tudo
 * isso: o que fazer com a espera é decisão de cada tela (o podcast, por
 * exemplo, fatia o episódio em um trecho por chamada). Se uma rota precisar de
 * mais que 3 min, o conserto não é subir daqui de novo — é tirá-la do caminho
 * síncrono (a api aceita, responde na hora e a tela pergunta depois).
 */
export const TIMEOUT_DO_BFF_MS = 180_000;

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
  /* exp06ef2b: o gate da aula (abrir a Aula 2, pausar a simulação) e o "zerar
     turma" são client-side — a professora aperta no meio da aula e as 30 telas
     andam na hora, sem recarregar a página. As guardas de papel estão na api
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
  /* exp07ef1b: o preparo da cobertura (gerar/aprovar), a geração das imagens
     — um laço do cliente, duas por chamada, porque doze não cabem nos 30 s
     deste BFF —, o botão ÚNICO da aula (Mural, fichas, conclusão), a consulta
     leve do painel a cada 5 s e o "zerar turma" são client-side: a professora
     aperta na frente da sala e as telas andam na hora pelo polling (ADR-93).
     As guardas de papel estão na api (`@Roles("professor", ...GESTORES)`). */
  "a-selecao",
  /* exp04ef1b: o preparo do pacote (gerar, regenerar uma notícia, homologar e o
     "Usar Banco Padrão", que lê `professor/material` e homologa na hora), as
     imagens — o mesmo laço do cliente da exp07ef1b, duas por chamada, porque
     oito não cabem nos 30 s deste BFF —, o botão ÚNICO da aula (Liberar
     resultado, Liberar revisão), a consulta leve do painel a cada 5 s e o
     "zerar turma" são client-side: o professor aperta na frente da sala e as
     telas andam pelo polling do gate (ADR-93). As guardas de papel estão na
     api (`@Roles("professor", ...GESTORES)`, e `turmaVisivel` por turma). */
  "jornal-escola",
  /* exp06ef1b: o preparo da mostra (gerar os dezesseis estandes, regenerar um
     estande e homologar — não há banco padrão: sem saldo de IA, 429 e nada a
     oferecer), as imagens — o mesmo laço do cliente do Jornal, duas por
     chamada —, o botão ÚNICO da aula (Liberar a Galeria Oculta), a consulta
     leve do painel a cada 5 s e o "zerar turma" são client-side: o professor
     aperta na frente da sala e as telas andam pelo polling do gate de 3 s
     (ADR-93). As guardas de papel estão na api (`@Roles("professor",
     ...GESTORES)`, e a turma conferida por escola). */
  "juri-estadual",
  /* Os cadastros de interesse do site público (ADR-107) — a LEITURA e a
     eliminação a pedido do titular (H10.5.2), só `admin` (o `@Roles` está na
     api). A ESCRITA não passa por aqui: ela vem de visitante sem sessão, e tem
     rota própria (`/api/cadastro-de-interesse`). */
  "prospeccao",
  /* Sinais do NAVEGADOR do hub (cap. 17): erro de cliente e Web Vitals postam
     pela mesma rota que a SDK usa dentro do iframe, mas o client do hub não
     tem bearer — passa por aqui. A api aplica cota e redaction. */
  "observabilidade",
  /* O AGENTE DE IA DO PROFESSOR (`docs/regras/agente-professor.md`): listar,
     criar, ler e apagar conversas. O TURNO (`POST .../conversas/:id/mensagens`)
     NÃO passa por aqui: é SSE de até 4 min e tem rota estática própria
     (`agente-professor/conversas/[id]/mensagens/route.ts`), que vence este
     catch-all. As guardas (`@Roles("professor")`, `@Produto`) estão na api. */
  "agente-professor",
  /* A Ajuda com avatar (ADR-132): abrir e encerrar a sessão de vídeo. É
     client-side porque o modal abre no MENU, em qualquer tela; a conversa em si
     não passa por aqui — o vendor fala direto com a api. */
  "ajuda",
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
  const sinalDoNavegador = ehSinalDoNavegador(request, path);
  const passagem = await passagemDaSessao({ aceitaSemSessao: sinalDoNavegador });
  if ("recusa" in passagem) return passagem.recusa;

  const prefixo = path[0] ?? "";
  const cabecalhos = cabecalhosComoObjeto(request.headers);
  if (!PREFIXOS_PERMITIDOS.includes(prefixo as (typeof PREFIXOS_PERMITIDOS)[number])) {
    // Era um 404 mudo. É o sintoma de uma tela nova que esqueceu de pedir
    // passagem aqui — e, sem esta linha, ele se parecia com "a api não tem a
    // rota". Só o prefixo vai ao log: o resto do caminho pode carregar id.
    logDaRequisicao(cabecalhos).warn({ prefixo, codigo: "bff-prefixo-recusado" }, "prefixo fora da allowlist do BFF");
    return NextResponse.json({ mensagem: "rota não permitida" }, { status: 404 });
  }

  const u = passagem.usuario;
  const token = u ? await tokenCurto(u) : null;

  // Sem sessão, o mesmo sinal vai para o par público da rota.
  const destino = urlDaApi(token ? path.join("/") : `observabilidade/publico/${path[1]}`);
  request.nextUrl.searchParams.forEach((valor, chave) => destino.searchParams.set(chave, valor));

  const temCorpo = request.method !== "GET" && request.method !== "HEAD";
  let resposta: Response;
  try {
    resposta = await fetch(destino, {
      method: request.method,
      headers: {
        // O `traceparent` do navegador (ou do LB) segue para a api: é o que faz a
        // chamada do painel do professor aparecer no mesmo trace que o span da api.
        ...cabecalhosParaApi(request, { token, temCorpo }),
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
      },
      body: temCorpo ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      /* O teto E a desistência do navegador: fechar a aba no meio de uma
         exportação (ou de uma geração por IA) cancela a chamada à api, em vez
         de o hub seguir esperando uma resposta que ninguém vai ler. */
      signal: sinalDaChamada(request, TIMEOUT_DO_BFF_MS),
    });
  } catch (erro) {
    const motivo = motivoDaFalha(erro, request);
    if (motivo === "cliente-desistiu") {
      // Não é falha da api nem do hub: quem pediu foi embora. Sem `warn`.
      logDaRequisicao(cabecalhos).info({ prefixo, metodo: request.method, codigo: motivo }, "o navegador desistiu da chamada");
      return respostaDeQuemDesistiu();
    }
    const timeout = motivo === "timeout";
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
