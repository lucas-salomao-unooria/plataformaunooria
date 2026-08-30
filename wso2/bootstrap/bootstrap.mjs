/**
 * Configura o WSO2 IS local para a plataforma: tenant do contrato, claims,
 * scope, aplicação OIDC do hub e usuários de teste.
 *
 * Idempotente — cada passo verifica antes de criar, então `docker compose up`
 * pode rodar quantas vezes for.
 *
 * Node puro, sem dependências: o container é um `node:22-alpine` cru.
 *
 * Formatos validados empiricamente contra o IS 7.3.0 (não confie em docs de
 * versões antigas):
 *   - Basic auth do admin funciona nas Management APIs; dentro do tenant o
 *     usuário é `admin@{tenant}`. Exceção: `scim2/Me` NÃO aceita basic auth
 *     (use `scim2/Users`).
 *   - `provisioningMethod` do owner do tenant é `inline-password` (minúsculo
 *     com hífen). Com outro valor a API responde 201 mas grava OUTRA senha,
 *     e todo acesso ao tenant vira um 401 sem explicação.
 *   - O dialeto local tem id literal `local`; os demais usam base64url do URI.
 *   - Atributos custom SCIM vivem no schema `urn:scim:schemas:extension:custom:User`
 *     (o `urn:scim:wso2:schema` é de sistema e rejeita POST). O dialeto precisa
 *     ser criado primeiro, e o claimURI usa `:` como separador do nome.
 *   - `accessTokenAttributes` (PUT em inbound-protocols/oidc) valida contra os
 *     claims OIDC existentes — a ordem claims → app importa.
 */
import { writeFileSync } from "node:fs";
import { request } from "node:https";
import { connect } from "node:tls";

// O IS local usa o certificado de demonstração da distribuição (self-signed,
// CN=localhost, enquanto o host no compose é `identity-server`) — nenhuma CA
// pública o assina, e a verificação padrão o recusa.
//
// A saída NÃO é `NODE_TLS_REJECT_UNAUTHORIZED=0`: aquilo desliga a verificação
// do PROCESSO INTEIRO e para toda origem, o que faz este script aceitar
// qualquer certificado de qualquer servidor — inclusive um MITM no meio do
// compose. O que ele faz agora é PINAR: lê o certificado uma vez (primeiro
// contato, é o mesmo arquivo que api e hub vão consumir por NODE_EXTRA_CA_CERTS)
// e passa esse PEM como a ÚNICA CA aceita nas chamadas seguintes. O que é
// dispensado é só a conferência de NOME do host, porque o CN da distribuição
// não bate com o nome do serviço; a identidade da chave continua obrigatória.

const env = (nome) => {
  const v = process.env[nome];
  if (v === undefined || v === "") throw new Error(`variável de ambiente ${nome} não definida`);
  return v;
};

const IS_URL = env("IS_INTERNAL_URL");
const IS_PUBLIC_URL = env("IS_PUBLIC_URL");
const ADMIN_USER = env("ADMIN_USERNAME");
const ADMIN_PASS = env("ADMIN_PASSWORD");
const CONTRATO = env("CONTRATO");
const TENANT_ADMIN_PASS = env("TENANT_ADMIN_PASSWORD");
const HUB_CALLBACK = env("HUB_CALLBACK_URL");
const SEED_PASSWORD = env("SEED_PASSWORD");
const ESCOLA_DEMO = env("ESCOLA_DEMO_ID");

const APP_NAME = "plataforma-hub";
const AUDIENCE = "plataforma-api";
const SCOPE = "escola";

/** Nomes lidos LITERALMENTE por apps/api/src/auth/token.service.ts. */
const CLAIMS = [
  { nome: "escola_id", rotulo: "Escola", descricao: "Identificador da escola (tenancy)" },
  { nome: "turma_id", rotulo: "Turma", descricao: "Identificador da turma" },
  { nome: "perfil", rotulo: "Perfil", descricao: "estudante | professor | gestor | admin-contrato" },
];

const LOCAL_DIALECT_ID = "local";
const LOCAL_URI = "http://wso2.org/claims";
const OIDC_URI = "http://wso2.org/oidc/claim";
const SCIM_CUSTOM_URI = "urn:scim:schemas:extension:custom:User";

const uriLocal = (nome) => `${LOCAL_URI}/${nome}`;
const b64url = (s) => Buffer.from(s).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

const log = (msg) => console.log(`   ${msg}`);
const passo = (msg) => console.log(`\n==> ${msg}`);

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function credenciais(tenant) {
  const usuario = tenant ? `${ADMIN_USER}@${tenant}` : ADMIN_USER;
  const senha = tenant ? TENANT_ADMIN_PASS : ADMIN_PASS;
  return "Basic " + Buffer.from(`${usuario}:${senha}`).toString("base64");
}

/**
 * A CA pinada — preenchida por `fixarCertificadoDoIs()` antes da primeira
 * chamada. Enquanto for null, nada de https sai daqui.
 */
let CA_DO_IS = null;

/**
 * `fetch` global não aceita agente, e é por agente que se passa uma CA. Daí o
 * `node:https` cru: são vinte linhas, e é o preço de não desligar a verificação
 * de TLS do processo. Mantém a mesma forma de retorno de antes.
 */
function chamar(metodo, url, { auth, corpo, scim = false } = {}) {
  if (!CA_DO_IS) throw new Error("certificado do IS ainda não foi fixado");
  const alvo = new URL(url);
  const body = corpo === undefined ? undefined : Buffer.from(JSON.stringify(corpo));

  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: alvo.hostname,
        port: alvo.port || 443,
        path: `${alvo.pathname}${alvo.search}`,
        method: metodo,
        ca: CA_DO_IS,
        // O certificado é conferido contra a CA acima; só o NOME do host não,
        // porque a distribuição vem com CN=localhost. Ver o topo do arquivo.
        checkServerIdentity: () => undefined,
        headers: {
          ...(auth ? { Authorization: auth } : {}),
          "Content-Type": scim ? "application/scim+json" : "application/json",
          Accept: "application/json, application/scim+json",
          ...(body ? { "Content-Length": body.length } : {}),
        },
      },
      (resp) => {
        const pedacos = [];
        resp.on("data", (d) => pedacos.push(d));
        resp.on("end", () => {
          const texto = Buffer.concat(pedacos).toString("utf8");
          const status = resp.statusCode;
          resolve({
            status,
            ok: status >= 200 && status < 300,
            corpo: texto ? JSON.parse(texto) : null,
            texto,
          });
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Chamada à Management API do tenant do contrato; lança em erro. */
async function api(metodo, caminho, corpo, { scim = false, tolerar = [] } = {}) {
  const r = await chamar(metodo, `${IS_URL}/t/${CONTRATO}${caminho}`, {
    auth: credenciais(CONTRATO),
    corpo,
    scim,
  });
  if (!r.ok && !tolerar.includes(r.status)) {
    throw new Error(`${metodo} /t/${CONTRATO}${caminho} → ${r.status}\n${r.texto.slice(0, 600)}`);
  }
  return r;
}

/** Idem, no super tenant (só para criar o tenant do contrato). */
async function apiSuper(metodo, caminho, corpo) {
  const r = await chamar(metodo, `${IS_URL}${caminho}`, { auth: credenciais(null), corpo });
  if (!r.ok) throw new Error(`${metodo} ${caminho} → ${r.status}\n${r.texto.slice(0, 600)}`);
  return r;
}

async function aguardar(descricao, tentativa, tentativas = 30, intervaloMs = 2000) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const r = await tentativa();
      if (r) return r;
    } catch {
      /* ainda não */
    }
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
  throw new Error(`timeout aguardando: ${descricao}`);
}

// ---------------------------------------------------------------------------
// Passos
// ---------------------------------------------------------------------------

async function criarTenant() {
  passo(`Tenant "${CONTRATO}"`);

  const { corpo } = await apiSuper("GET", `/api/server/v1/tenants?filter=domainName+eq+${CONTRATO}`);
  if (corpo?.tenants?.length) {
    log(`já existe (id ${corpo.tenants[0].id})`);
  } else {
    await apiSuper("POST", "/api/server/v1/tenants", {
      domain: CONTRATO,
      owners: [
        {
          username: ADMIN_USER,
          password: TENANT_ADMIN_PASS,
          email: `admin@${CONTRATO}.local`,
          firstname: "Admin",
          lastname: CONTRATO,
          // "inline-password", literal. Outro valor => 201 com senha errada
          // gravada, e o tenant inteiro responde 401 sem explicação.
          provisioningMethod: "inline-password",
        },
      ],
    });
    log("criado");
  }

  // O tenant é carregado sob demanda; a primeira chamada dentro dele demora.
  await aguardar("tenant responder com as credenciais do owner", async () => {
    const r = await api("GET", "/api/server/v1/claim-dialects", undefined, { tolerar: [401] });
    return r.ok;
  });
  log("tenant disponível");
}

async function criarClaimsLocais() {
  passo("Claims locais (dialeto http://wso2.org/claims)");

  const existentes = (await api("GET", `/api/server/v1/claim-dialects/${LOCAL_DIALECT_ID}/claims`)).corpo ?? [];

  for (const { nome, rotulo, descricao } of CLAIMS) {
    const uri = uriLocal(nome);
    if (existentes.some((c) => c.claimURI === uri)) {
      log(`${nome}: já existe`);
      continue;
    }
    await api("POST", `/api/server/v1/claim-dialects/${LOCAL_DIALECT_ID}/claims`, {
      claimURI: uri,
      description: descricao,
      displayName: rotulo,
      attributeMapping: [{ mappedAttribute: nome, userstore: "PRIMARY" }],
      supportedByDefault: true,
    });
    log(`${nome}: criado`);
  }
}

async function criarClaimsOidc() {
  passo("Claims OIDC (dialeto http://wso2.org/oidc/claim)");

  const dialectId = b64url(OIDC_URI);
  const existentes = (await api("GET", `/api/server/v1/claim-dialects/${dialectId}/claims`)).corpo ?? [];

  for (const { nome } of CLAIMS) {
    if (existentes.some((c) => c.claimURI === nome)) {
      log(`${nome}: já existe`);
      continue;
    }
    await api("POST", `/api/server/v1/claim-dialects/${dialectId}/claims`, {
      claimURI: nome,
      mappedLocalClaimURI: uriLocal(nome),
    });
    log(`${nome}: criado`);
  }
}

/**
 * Sem este mapeamento o SCIM2 aceita os atributos custom no POST /Users e os
 * DESCARTA em silêncio — o usuário nasce sem escola_id/perfil e o token sai
 * vazio. O schema custom gravável no IS >= 7.1 é urn:scim:schemas:extension:
 * custom:User; o urn:scim:wso2:schema é de sistema e rejeita POST (CMT-60016).
 */
async function criarClaimsScim() {
  passo(`Claims SCIM2 (dialeto ${SCIM_CUSTOM_URI})`);

  const dialetos = (await api("GET", "/api/server/v1/claim-dialects")).corpo ?? [];
  if (!dialetos.some((d) => d.dialectURI === SCIM_CUSTOM_URI)) {
    await api("POST", "/api/server/v1/claim-dialects", { dialectURI: SCIM_CUSTOM_URI });
    log("dialeto criado");
  }

  const dialectId = b64url(SCIM_CUSTOM_URI);
  const existentes = (await api("GET", `/api/server/v1/claim-dialects/${dialectId}/claims`)).corpo ?? [];

  for (const { nome } of CLAIMS) {
    // Separador ":" — com "." o parser do SCIMCustomSchemaProcessor lança
    // ArrayIndexOutOfBounds e DERRUBA o /scim2 inteiro do tenant.
    const uri = `${SCIM_CUSTOM_URI}:${nome}`;
    if (existentes.some((c) => c.claimURI === uri)) {
      log(`${nome}: já existe`);
      continue;
    }
    await api("POST", `/api/server/v1/claim-dialects/${dialectId}/claims`, {
      claimURI: uri,
      mappedLocalClaimURI: uriLocal(nome),
    });
    log(`${nome}: criado`);
  }

  // Confirmação de que o schema SCIM publicou os três — pega na hora o caso
  // de um claim truncado/corrompido, que de outra forma só apareceria como
  // atributo faltando no token dias depois.
  const schemas = (await api("GET", "/scim2/Schemas", undefined, { scim: true })).corpo ?? [];
  const custom = schemas.find((s) => s.id === SCIM_CUSTOM_URI);
  const nomes = (custom?.attributes ?? []).map((a) => a.name);
  const faltando = CLAIMS.map((c) => c.nome).filter((n) => !nomes.includes(n));
  if (faltando.length) {
    throw new Error(`schema SCIM custom não publicou: ${faltando.join(", ")} (publicou: ${nomes.join(", ")})`);
  }
  log(`schema SCIM publica: ${nomes.join(", ")}`);
}

async function criarScope() {
  passo(`Scope OIDC "${SCOPE}"`);

  const existentes = (await api("GET", "/api/server/v1/oidc/scopes")).corpo ?? [];
  if (existentes.some((s) => s.name === SCOPE)) {
    log("já existe");
    return;
  }
  await api("POST", "/api/server/v1/oidc/scopes", {
    name: SCOPE,
    displayName: "Dados escolares",
    description: "escola_id, turma_id e perfil do usuário",
    claims: CLAIMS.map((c) => c.nome),
  });
  log("criado");
}

async function criarAplicacao() {
  passo(`Aplicação OIDC "${APP_NAME}"`);

  const busca = (await api("GET", `/api/server/v1/applications?filter=name+eq+${APP_NAME}`)).corpo;
  let id = busca?.applications?.[0]?.id;

  if (id) {
    log(`já existe (id ${id})`);
  } else {
    await api("POST", "/api/server/v1/applications", {
      name: APP_NAME,
      description: "Hub da Plataforma Unooria (Auth.js v5)",
      templateId: "custom-application-oidc",
      inboundProtocolConfiguration: {
        oidc: {
          grantTypes: ["authorization_code", "refresh_token"],
          callbackURLs: [HUB_CALLBACK],
          allowedOrigins: [new URL(HUB_CALLBACK).origin],
          publicClient: false,
          pkce: { mandatory: true, supportPlainTransformAlgorithm: false },
          accessToken: {
            // JWT e não opaco: a api usa jose.jwtVerify, que falha de
            // imediato com token opaco.
            type: "JWT",
            userAccessTokenExpiryInSeconds: 3600,
            applicationAccessTokenExpiryInSeconds: 3600,
            bindingType: "None",
          },
          refreshToken: { expiryInSeconds: 86400, renewRefreshToken: true },
          idToken: {
            expiryInSeconds: 3600,
            // A api exige audience "plataforma-api"; o jose aceita quando o
            // valor está presente no array `aud`.
            audience: [AUDIENCE],
          },
        },
      },
      claimConfiguration: {
        dialect: "LOCAL",
        requestedClaims: CLAIMS.map((c) => ({
          claim: { uri: uriLocal(c.nome) },
          mandatory: c.nome !== "turma_id",
        })),
      },
    });
    id = (await api("GET", `/api/server/v1/applications?filter=name+eq+${APP_NAME}`)).corpo
      ?.applications?.[0]?.id;
    log(`criada (id ${id})`);
  }

  await habilitarAtributosNoAccessToken(id);
  return id;
}

/**
 * A ARMADILHA CENTRAL desta integração.
 *
 * Por padrão o WSO2 põe os atributos requisitados só no ID token e no
 * userinfo. O hub lê o ID token e loga perfeitamente; a api lê o ACCESS token
 * (OidcGuard → Authorization: Bearer) e recebe escola_id vazio, caindo no
 * throw do token.service.ts. Sintoma: login funciona, tudo na api dá 401.
 */
async function habilitarAtributosNoAccessToken(idApp) {
  passo("Atributos no ACCESS token (não só no ID token)");

  const oidc = (await api("GET", `/api/server/v1/applications/${idApp}/inbound-protocols/oidc`)).corpo;
  const desejados = CLAIMS.map((c) => c.nome);
  const atuais = oidc?.accessToken?.accessTokenAttributes ?? [];

  if (desejados.every((a) => atuais.includes(a))) {
    log("já habilitado");
    return;
  }

  // O PUT de inbound-protocols/oidc exige o payload completo — mandar só o
  // accessToken zeraria o resto da configuração.
  await api("PUT", `/api/server/v1/applications/${idApp}/inbound-protocols/oidc`, {
    ...oidc,
    accessToken: { ...oidc.accessToken, accessTokenAttributes: desejados },
  });
  log(`habilitado para: ${desejados.join(", ")}`);
}

async function credenciaisDaApp(idApp) {
  const oidc = (await api("GET", `/api/server/v1/applications/${idApp}/inbound-protocols/oidc`)).corpo;
  return { clientId: oidc.clientId, clientSecret: oidc.clientSecret };
}

// ---------------------------------------------------------------------------
// Usuários de teste
// ---------------------------------------------------------------------------

const SEEDS = [
  { usuario: "estudante.teste", nome: "Estudante", displayName: "Estudante Teste", perfil: "estudante", escola: ESCOLA_DEMO, turma: "8A" },
  { usuario: "professor.teste", nome: "Professor", displayName: "Professor Teste", perfil: "professor", escola: ESCOLA_DEMO },
  { usuario: "gestor.teste", nome: "Gestor", displayName: "Gestor Teste", perfil: "gestor", escola: ESCOLA_DEMO },
  // Sem escola_id de propósito: exercita a única exceção cross-escola da regra 1.
  { usuario: "admin.contrato", nome: "Admin Contrato", displayName: "Admin Contrato", perfil: "admin-contrato", escola: "" },
];

async function criarUsuarios() {
  passo("Usuários de teste");

  for (const s of SEEDS) {
    const busca = (await api("GET", `/scim2/Users?filter=userName+eq+${s.usuario}`, undefined, { scim: true })).corpo;
    if (busca?.totalResults > 0) {
      log(`${s.usuario} (${s.perfil}): já existe`);
      continue;
    }

    const custom = { perfil: s.perfil };
    if (s.escola) custom.escola_id = s.escola;
    if (s.turma) custom.turma_id = s.turma;

    const r = await api("POST", "/scim2/Users", {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      userName: s.usuario,
      password: SEED_PASSWORD,
      displayName: s.displayName ?? `${s.nome} Teste`,
      name: { givenName: s.nome, familyName: s.nome === "Admin Contrato" ? "" : "Teste" },
      emails: [{ primary: true, value: `${s.usuario}@${CONTRATO}.local` }],
      [SCIM_CUSTOM_URI]: custom,
    }, { scim: true });

    // O SCIM2 descarta atributos não mapeados EM SILÊNCIO — confira sempre.
    const gravados = r.corpo?.[SCIM_CUSTOM_URI] ?? {};
    if (gravados.perfil !== s.perfil) {
      throw new Error(`atributos custom não persistidos para ${s.usuario}: ${JSON.stringify(gravados)}`);
    }
    log(`${s.usuario} (${s.perfil}): criado`);
  }
}

// ---------------------------------------------------------------------------
// Certificado + saída
// ---------------------------------------------------------------------------

/**
 * PRIMEIRO passo do bootstrap: lê o certificado do IS e o adota como a única CA
 * das chamadas seguintes (`CA_DO_IS`), além de gravá-lo para api e hub o
 * consumirem por `NODE_EXTRA_CA_CERTS`.
 *
 * Este é o único ponto do script com `rejectUnauthorized: false`, e ele não
 * autentica nada: é o primeiro contato, feito para DESCOBRIR a chave. Falhar
 * aqui é fatal — sem CA não há como falar com o IS sem voltar a aceitar
 * qualquer certificado, que é justamente o que se está removendo.
 */
function fixarCertificadoDoIs() {
  passo("Certificado do IS");
  const { hostname, port } = new URL(IS_URL);

  return new Promise((resolve, reject) => {
    const socket = connect(
      { host: hostname, port: Number(port || 443), servername: hostname, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert?.raw) {
          return reject(new Error("não foi possível ler o certificado do IS"));
        }
        const b64 = cert.raw.toString("base64").match(/.{1,64}/g).join("\n");
        const pem = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
        CA_DO_IS = pem;
        writeFileSync("/certs/wso2-local.pem", pem);
        log(`fixado (${cert.subject?.CN ?? "?"}, impressão ${cert.fingerprint256 ?? "?"})`);
        log("salvo em wso2/certs/wso2-local.pem");
        resolve();
      },
    );
    socket.on("error", (err) => reject(new Error(`TLS com ${hostname}:${port} falhou: ${err.message}`)));
  });
}

async function issuerDoDiscovery() {
  const r = await chamar("GET", `${IS_URL}/t/${CONTRATO}/oauth2/token/.well-known/openid-configuration`);
  return r.corpo?.issuer;
}

function imprimirEnvs({ clientId, clientSecret, issuer }) {
  // O issuer vem LITERAL do discovery. A URL pública troca só host:porta,
  // preservando o path — nunca remonte o issuer por concatenação.
  const issuerPublico = issuer?.replace(IS_URL, IS_PUBLIC_URL) ?? "(discovery indisponível)";
  const jwks = `${IS_PUBLIC_URL}/t/${CONTRATO}/oauth2/jwks`;
  console.log(`
${"═".repeat(74)}
  Pronto. Cole os valores abaixo e reinicie api e hub.
${"═".repeat(74)}

  ── apps/api/.env ─────────────────────────────────────────────────────────
  OIDC_ISSUER=${issuerPublico}
  OIDC_JWKS_URI=${jwks}
  OIDC_AUDIENCE=${AUDIENCE}

  ── apps/hub/.env.local ───────────────────────────────────────────────────
  AUTH_WSO2_ISSUER=${issuerPublico}
  AUTH_WSO2_CLIENT_ID=${clientId}
  AUTH_WSO2_CLIENT_SECRET=${clientSecret}

  ── TLS (certificado self-signed do IS) ───────────────────────────────────
  NODE_EXTRA_CA_CERTS=<repo>/wso2/certs/wso2-local.pem pnpm dev

  ── Usuários de teste (senha: ${SEED_PASSWORD}) ──────────────────────────
${SEEDS.map((s) => `  ${s.usuario.padEnd(18)} perfil=${s.perfil.padEnd(15)} escola_id=${s.escola || "(vazio)"}`).join("\n")}

  Console do tenant: ${IS_PUBLIC_URL}/t/${CONTRATO}/console
  No FORMULÁRIO de login digite só "${ADMIN_USER}" — o tenant vem da URL.
  (O formato ${ADMIN_USER}@${CONTRATO} é apenas para basic auth nas APIs.)
${"═".repeat(74)}
`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Configurando WSO2 IS em ${IS_URL} — contrato "${CONTRATO}"`);

  // Antes de tudo: o certificado. Ele é a CA de todas as chamadas abaixo.
  await fixarCertificadoDoIs();

  await criarTenant();
  await criarClaimsLocais();
  await criarClaimsOidc();
  await criarClaimsScim();
  await criarScope();
  const idApp = await criarAplicacao();
  await criarUsuarios();

  const { clientId, clientSecret } = await credenciaisDaApp(idApp);
  const issuer = await issuerDoDiscovery();

  imprimirEnvs({ clientId, clientSecret, issuer });
}

main().catch((err) => {
  console.error(`\n!! bootstrap falhou:\n${err.message}\n`);
  process.exit(1);
});
