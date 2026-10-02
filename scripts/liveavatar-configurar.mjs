#!/usr/bin/env node
/**
 * Prepara a conta do LiveAvatar para a Ajuda com avatar (ADR-132) de UM
 * contrato/ambiente — e imprime as envs que a api precisa.
 *
 *   LIVEAVATAR_API_KEY=… AJUDA_LLM_SEGREDO=… \
 *     node scripts/liveavatar-configurar.mjs <ambiente> <url-publica-da-api>
 *
 *   ex.: node scripts/liveavatar-configurar.mjs dev https://api-entreredes-dev.exemplo.com
 *
 * Cria, se ainda não existirem (idempotente pelo NOME `unooria-ajuda-<ambiente>`):
 *   1. o SEGREDO que o vendor manda ao nosso LLM (`Authorization: Bearer`). O
 *      tipo é `OPENAI_API_KEY` — MEDIDO: a api deles recusa o `LLM_API_KEY` que
 *      a skill da HeyGen ensina;
 *   2. a CONFIGURAÇÃO DE LLM, apontando para `<url>/ajuda/llm` (o vendor chama
 *      `{base_url}/chat/completions` e `{base_url}/models`);
 *   3. o CONTEXTO, cujo prompt é SÓ o marcador `[sessao:${sessao}]`: o prompt de
 *      verdade e a base moram na api (regra 2), e o que o vendor manda na
 *      mensagem `system` é descartado depois de lido o token.
 *
 * ESCREVE NA CONTA REAL do vendor. Não cria nada no GCP: o segredo da api
 * (`AJUDA_LLM_SEGREDO`) e a chave da conta vão para o Secret Manager pelo
 * Terraform, que mora em outro repo (`docs/INFRA.md`).
 *
 * Trocar a URL ou o segredo: o vendor não tem edição documentada — apague a
 * configuração (e o segredo) com o nome do ambiente no painel dele e rode de
 * novo. Apagar o segredo ANTES da configuração quebra a configuração sem aviso.
 */

const API = process.env.LIVEAVATAR_API_URL ?? "https://api.liveavatar.com";
const CHAVE = process.env.LIVEAVATAR_API_KEY;
const SEGREDO = process.env.AJUDA_LLM_SEGREDO;
const [ambiente, urlDaApi] = process.argv.slice(2);

function sair(mensagem) {
  console.error(`✗ ${mensagem}`);
  process.exit(1);
}

if (!ambiente || !/^[a-z0-9-]{2,30}$/.test(ambiente)) sair("uso: liveavatar-configurar.mjs <ambiente> <url-publica-da-api>");
if (!urlDaApi || !/^https:\/\//.test(urlDaApi)) sair("a URL da api tem de ser PÚBLICA e https — o vendor chama de fora");
if (!CHAVE) sair("exporte LIVEAVATAR_API_KEY");
if (!SEGREDO || SEGREDO.length < 32) sair("exporte AJUDA_LLM_SEGREDO (32+ caracteres) — o MESMO valor que a api vai ler");

const NOME = `unooria-ajuda-${ambiente}`;
const BASE_URL = `${urlDaApi.replace(/\/$/, "")}/ajuda/llm`;

async function chamar(metodo, caminho, corpo) {
  const res = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { "x-api-key": CHAVE, "content-type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.code !== 1000)) sair(`${metodo} ${caminho}: ${res.status} ${JSON.stringify(json)?.slice(0, 300)}`);
  return json?.data;
}

/** As listagens do vendor ora vêm em `data`, ora em `data.results`. */
const lista = (data) => (Array.isArray(data) ? data : (data?.results ?? []));

const segredos = lista(await chamar("GET", "/v1/secrets"));
let segredo = segredos.find((s) => s.secret_name === NOME);
if (segredo) console.log(`• segredo ${NOME} já existe (${segredo.id}) — o valor não é conferível; para trocar, apague e rode de novo`);
else {
  segredo = await chamar("POST", "/v1/secrets", { secret_type: "OPENAI_API_KEY", secret_value: SEGREDO, secret_name: NOME });
  console.log(`✓ segredo criado (${segredo.id})`);
}

const configuracoes = lista(await chamar("GET", "/v1/llm-configurations"));
let configuracao = configuracoes.find((c) => c.display_name === NOME);
if (configuracao) {
  console.log(`• configuração de LLM ${NOME} já existe (${configuracao.id})`);
  if (configuracao.base_url !== BASE_URL) console.warn(`! ela aponta para ${configuracao.base_url}, não para ${BASE_URL}`);
} else {
  configuracao = await chamar("POST", "/v1/llm-configurations", {
    display_name: NOME,
    model_name: "unooria-ajuda",
    secret_id: segredo.id,
    base_url: BASE_URL,
  });
  console.log(`✓ configuração de LLM criada (${configuracao.id}) → ${BASE_URL}`);
}

const contextos = lista(await chamar("GET", "/v1/contexts"));
let contexto = contextos.find((c) => c.name === NOME);
if (contexto) console.log(`• contexto ${NOME} já existe (${contexto.id})`);
else {
  contexto = await chamar("POST", "/v1/contexts", {
    name: NOME,
    // SÓ o marcador: o vendor troca `${sessao}` pelo token da sessão (dynamic_variables).
    prompt: "Atendente da Ajuda da Unooria. [sessao:${sessao}]",
    // Falado palavra por palavra quando a sala abre — não passa pelo nosso LLM.
    opening_text: "Olá! Eu sou o atendente da Unooria. Em que posso ajudar você na plataforma?",
  });
  console.log(`✓ contexto criado (${contexto.id})`);
}

console.log(`
As envs da api deste ambiente (as duas primeiras são SEGREDO — Secret Manager):
  LIVEAVATAR_API_KEY=<a chave da conta>
  AJUDA_LLM_SEGREDO=<o valor exportado aqui>
  AJUDA_SESSAO_CHAVE=<32+ caracteres aleatórios, só da api>
  LIVEAVATAR_CONTEXT_ID=${contexto.id}
  LIVEAVATAR_LLM_CONFIG_ID=${configuracao.id}`);
