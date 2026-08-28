import { DiscoveryService, NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { chaveDaRota, listarRotas, type RotaDescoberta } from "../src/openapi/rotas";

/**
 * A trava do documento OpenAPI.
 *
 * Documentação de API só é confiável enquanto é impossível acrescentar rota sem
 * documentá-la. Este teste percorre o roteador do Nest — não uma lista escrita à
 * mão — e cobra `@Contrato` de cada rota. Sem ele, o `/docs` seria a mesma coisa
 * que o `expires_at` que ficou no schema depois que a rotina saiu do código:
 * um registro que quem lê acredita, e que ninguém mantém.
 *
 * Sobe o contexto do Nest (sem servidor HTTP) porque a varredura precisa dos
 * controllers INSTANCIADOS — a metadata do `@Contrato` mora no método do
 * protótipo, e é o container que sabe quais controllers existem. Como todo teste
 * de `tests/`, isso encosta no Postgres local do README; nenhuma requisição é
 * feita.
 *
 * Usa `NestFactory` e não `@nestjs/testing` de propósito: os testes desta api
 * montam o que precisam com o que já é dependência, e um pacote a mais para
 * chamar `createApplicationContext` não se paga.
 */

// Só para o `validarEnv` do boot passar. Nada aqui é usado de verdade: nenhuma
// requisição é feita, nenhuma conexão é aberta.
const ENV_MINIMA: Record<string, string> = {
  DATABASE_URL: "postgresql://postgres:pass@localhost:5432/unooria",
  OIDC_ISSUER: "http://localhost:3000",
  OIDC_JWKS_URI: "http://localhost:3000/.well-known/jwks.json",
  AI_PROVIDER: "mock",
};

/**
 * As rotas que ainda não declararam contrato.
 *
 * **Esta lista só encolhe.** Ela existe porque documentar 146 rotas de uma vez
 * seria um diff que ninguém revisa de verdade — e uma resposta mal descrita
 * passaria batida no meio. Cada commit cobre um módulo e apaga as linhas dele.
 *
 * O que a lista NÃO permite é rota nova entrar sem contrato: acrescentar uma
 * linha aqui é uma decisão explícita, do mesmo jeito que
 * `SEM_CHAVE_POR_DECISAO` em `identidade-unica.spec.ts`. A diferença é que
 * aquelas exceções são permanentes e estas são dívida, com data para acabar.
 */
const SEM_CONTRATO_AINDA = new Set<string>([
  "POST /ai/gerar",
  "GET /alunos/{id}/historico",
  "GET /alunos/{id}/perfil-portatil",
  "GET /alunos/{id}/perfis-recebidos",
  "POST /alunos/{id}/transferir",
  "GET /analise/atividades/{id}",
  "GET /analise/csv",
  "GET /analise/resumo",
  "GET /atividades",
  "POST /atividades",
  "DELETE /atividades/{id}",
  "GET /atividades/{id}",
  "GET /atividades/{id}/alunos/{runId}",
  "GET /atividades/{id}/analise",
  "GET /atividades/{id}/analise/csv",
  "PATCH /atividades/{id}/antagonismo",
  "POST /atividades/{id}/ativar",
  "POST /atividades/{id}/destilar",
  "GET /atividades/{id}/distribuicao",
  "GET /atividades/{id}/etapa",
  "POST /atividades/{id}/etapa",
  "GET /atividades/{id}/geracao/progresso",
  "POST /atividades/{id}/gerar",
  "PATCH /atividades/{id}/ia",
  "POST /atividades/{id}/limpar",
  "GET /atividades/{id}/monitor",
  "GET /atividades/{id}/perfis",
  "POST /atividades/{id}/perfis",
  "POST /atividades/{id}/perfis/da-vila",
  "GET /atividades/{id}/posts",
  "POST /atividades/{id}/redistribuir",
  "POST /bemestar/checkins/{id}/respostas",
  "DELETE /bemestar/dados",
  "GET /bemestar/historico",
  "GET /bemestar/hoje",
  "GET /bemestar/resumo",
  "GET /escolas",
  "POST /escolas",
  "PATCH /escolas/{id}",
  "POST /escolas/{id}/lotacoes",
  "GET /escolas/{id}/pessoas",
  "POST /escolas/lotacoes-em-lote",
  "GET /escolas/minhas",
  "GET /escolas/minhas/resumo",
  "GET /experiencias",
  "GET /experiencias/{expId}",
  "PUT /experiencias/{expId}",
  "DELETE /lotacoes/{id}",
  "DELETE /matriculas/{id}",
  "PATCH /matriculas/{id}",
  "POST /perfis-recebidos",
  "DELETE /perfis-recebidos/{id}",
  "GET /perfis-recebidos/{id}",
  "POST /perfis/importar",
  "GET /periodos-letivos",
  "POST /periodos-letivos",
  "GET /planos",
  "POST /planos",
  "DELETE /planos/{id}",
  "GET /planos/{id}",
  "PATCH /planos/{id}",
  "PUT /planos/{id}/conteudo",
  "POST /planos/{id}/restaurar",
  "GET /planos/referencias",
  "POST /planos/referencias",
  "DELETE /planos/referencias/{id}",
  "GET /planos/referencias/disponiveis",
  "DELETE /posts/{id}",
  "PATCH /posts/{id}",
  "GET /posts/{id}/comentarios",
  "POST /posts/{id}/regenerar",
  "GET /progresso/{expId}",
  "POST /progresso/{expId}",
  "POST /progresso/{expId}/concluir",
  "GET /rostering/contas-de-assento",
  "POST /rostering/importar",
  "GET /rostering/modelos/exemplo.csv",
  "GET /rostering/modelos/usuarios.csv",
  "POST /rostering/oneroster/{arquivo}",
  "POST /runs",
  "GET /runs/{id}/busca",
  "POST /runs/{id}/conclusao",
  "GET /runs/{id}/dossie",
  "POST /runs/{id}/entrar",
  "POST /runs/{id}/eventos",
  "GET /runs/{id}/fase",
  "GET /runs/{id}/feed",
  "POST /runs/{id}/finish",
  "GET /runs/{id}/perdidos",
  "POST /runs/{id}/reacoes",
  "GET /runs/{id}/reflexao",
  "POST /runs/{id}/reflexao",
  "POST /runs/{id}/reset",
  "GET /runs/{id}/salvos",
  "POST /runs/{id}/student-post",
  "GET /runs/boot",
  "POST /telemetry/batch",
  "POST /telemetry/beacon",
  "POST /telemetry/ingest",
  "GET /turmas",
  "POST /turmas",
  "GET /turmas/{id}",
  "PATCH /turmas/{id}",
  "POST /turmas/{id}/matriculas",
  "GET /turmas/minhas",
  "GET /unoogpt/agregado/escola",
  "POST /unoogpt/alocacao",
  "PUT /unoogpt/conjuntos",
  "POST /unoogpt/contrafactual",
  "POST /unoogpt/passo",
  "POST /unoogpt/pergunta",
  "GET /unoogpt/professor/alunos/{alunoId}",
  "GET /unoogpt/professor/turmas",
  "DELETE /unoogpt/professor/turmas/{turmaId}",
  "GET /unoogpt/professor/turmas/{turmaId}",
  "POST /unoogpt/professor/turmas/{turmaId}/relogio",
  "POST /unoogpt/reiniciar",
  "GET /unoogpt/relogio",
  "GET /unoogpt/resultado",
  "GET /unoogpt/sessao",
  "POST /unoogpt/simular",
  "POST /unootube/credibilidade",
  "POST /unootube/curtidos/{videoId}",
  "GET /unootube/ranking",
  "POST /unootube/reiniciar",
  "POST /unootube/salvos",
  "POST /unootube/salvos/{videoId}/remover",
  "GET /unootube/sessao",
  "GET /unootube/turmas",
  "GET /unootube/turmas/{turmaId}/resultados",
  "GET /usuarios",
  "PATCH /usuarios/{id}",
  "POST /usuarios/{id}/reset-senha",
  "POST /usuarios/importar-csv",
  "GET /vila/agregado/turmas",
  "GET /vila/agregado/turmas/{turmaId}",
  "GET /vila/professor/alunos/{alunoId}",
  "GET /vila/professor/cartoes",
  "GET /vila/professor/turmas/{turmaId}",
  "DELETE /vila/professor/turmas/{turmaId}/dados",
  "POST /vila/sessoes",
  "POST /vila/sessoes/{id}/concluir",
]);

describe("cobertura do OpenAPI", () => {
  let rotas: RotaDescoberta[];
  let contexto: INestApplicationContext;

  beforeAll(async () => {
    for (const [chave, valor] of Object.entries(ENV_MINIMA)) {
      process.env[chave] ??= valor;
    }
    contexto = await NestFactory.createApplicationContext(AppModule, { logger: false });
    rotas = listarRotas(contexto.get(DiscoveryService));
  });

  afterAll(async () => {
    await contexto?.close();
  });

  test("o roteador tem rotas — se esta falhar, a varredura quebrou e as outras passam por vazio", () => {
    expect(rotas.length).toBeGreaterThan(100);
  });

  test("toda rota declara resumo e schema de resposta", () => {
    const semContrato = rotas
      .filter((r) => !SEM_CONTRATO_AINDA.has(chaveDaRota(r)))
      .filter((r) => !r.contrato?.resumo || !r.contrato?.resposta)
      .map((r) => `${chaveDaRota(r)}  (${r.origem})`);
    expect(semContrato).toEqual([]);
  });

  test("a lista de pendências não guarda rota que não existe mais", () => {
    const existentes = new Set(rotas.map(chaveDaRota));
    const mortas = [...SEM_CONTRATO_AINDA].filter((chave) => !existentes.has(chave));
    // Entrada morta é pior que lista grande: ela dá a impressão de dívida
    // conhecida onde já não há rota nenhuma, e some do radar de quem for
    // encolhendo a lista.
    expect(mortas).toEqual([]);
  });

  test("o acesso declarado bate com os guards que a rota realmente tem", () => {
    const divergentes: string[] = [];
    for (const rota of rotas) {
      const acesso = rota.contrato?.acesso;
      if (!acesso) continue;
      const temOidc = rota.guards.includes("OidcGuard");
      // Uma rota que se documenta como pública e tem `OidcGuard` mandaria o
      // leitor tentar sem token e levar 401 — e o contrário é pior: prometeria
      // proteção que não existe.
      if (acesso === "publica" && temOidc) {
        divergentes.push(`${chaveDaRota(rota)}: diz "publica" mas tem OidcGuard`);
      }
      if (acesso === "token" && !temOidc) {
        divergentes.push(`${chaveDaRota(rota)}: diz "token" mas não tem OidcGuard`);
      }
    }
    expect(divergentes).toEqual([]);
  });

  test("rota com papéis não pode se declarar pública", () => {
    const contraditorias = rotas
      .filter((r) => r.contrato?.acesso === "publica" && r.perfis.length > 0)
      .map((r) => `${chaveDaRota(r)}: @Roles(${r.perfis.join(", ")})`);
    expect(contraditorias).toEqual([]);
  });
});
