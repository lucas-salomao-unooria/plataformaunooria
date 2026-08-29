import { DiscoveryService, NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
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
  /* VAZIA. As 146 rotas declaram contrato. Acrescentar uma linha aqui é uma
     decisão explícita, e o teste abaixo cobra que ela não fique para trás. */
]);

describe("cobertura do OpenAPI", () => {
  let rotas: RotaDescoberta[];
  let contexto: INestApplicationContext;

  beforeAll(async () => {
    for (const [chave, valor] of Object.entries(ENV_MINIMA)) {
      process.env[chave] ??= valor;
    }
    // O AppModule entra por import DINÂMICO, depois do env acima: o
    // `ConfigModule.forRoot` roda `validarEnv` NA IMPORTAÇÃO do módulo, e um
    // import estático executaria antes deste beforeAll. Passava mesmo assim
    // quando outro spec do MESMO worker do jest já tinha exportado OIDC_* —
    // sorte de escalonamento, que a primeira mudança de dependências desfez
    // (localmente o dotenv lê apps/api/.env do disco e mascara tudo).
    const { AppModule } = await import("../src/app.module");
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
