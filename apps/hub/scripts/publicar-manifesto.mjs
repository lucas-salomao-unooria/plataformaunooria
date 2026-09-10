#!/usr/bin/env node
/**
 * Publica o MANIFESTO de uma experiência na api (`PUT /experiencias/:expId`)
 * a partir do `public/experiencia.json` dela — o passo 4 do deploy em
 * docs/INFRA.md que o workflow só descrevia e não executava.
 *
 * A rota exige `gestor_contrato` (a ADR-80 aposentou `admin-contrato` em
 * 2026-09-08). Este script assina um token de 5 minutos com
 * a MESMA chave que o hub usa (`TOKEN_SIGNING_KEY_PEM`, do Secret Manager) e
 * o mesmo `kid` (thumbprint), então a api o valida pelo JWKS do hub sem nada
 * novo. Vive em apps/hub/scripts porque `jose` é dependência do hub.
 *
 * Uso (CI ou manual):
 *   API_URL=https://... HUB_ORIGIN=https://... TOKEN_SIGNING_KEY_PEM="$(gcloud secrets ...)" \
 *     node apps/hub/scripts/publicar-manifesto.mjs apps/experiencias/exp-90-plano-de-aula [--versao 1.0.1]
 *
 * `--versao` sobrescreve a do experiencia.json — é o ROLLBACK: repetir o PUT
 * apontando para a versão anterior já publicada no bucket.
 */
import { readFile } from "node:fs/promises";
import { createPublicKey } from "node:crypto";
import { join } from "node:path";
import { SignJWT, calculateJwkThumbprint, exportJWK, importPKCS8 } from "jose";

const [pasta, ...resto] = process.argv.slice(2);
const versaoForcada = resto[resto.indexOf("--versao") + 1] && resto.includes("--versao") ? resto[resto.indexOf("--versao") + 1] : null;
const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const HUB_ORIGIN = process.env.HUB_ORIGIN ?? "http://localhost:3000";
const PEM = process.env.TOKEN_SIGNING_KEY_PEM;

if (!pasta || !PEM) {
  console.error("Uso: API_URL=... HUB_ORIGIN=... TOKEN_SIGNING_KEY_PEM=... node apps/hub/scripts/publicar-manifesto.mjs <pasta-da-exp> [--versao x.y.z]");
  process.exit(1);
}

const manifesto = JSON.parse(await readFile(join(pasta, "public", "experiencia.json"), "utf8"));
const versao = versaoForcada ?? manifesto.versao;
if (!/^\d+\.\d+\.\d+$/.test(versao ?? "")) {
  console.error(`versão inválida: ${versao}`);
  process.exit(1);
}

const pem = PEM.replace(/\\n/g, "\n");
const privateKey = await importPKCS8(pem, "RS256");
const publicJwk = await exportJWK(createPublicKey(pem));
const kid = await calculateJwkThumbprint(publicJwk);

/* `gestor_contrato`, e o NOME é o que importa aqui: o `token.service.ts` da api
   valida este claim contra a tupla `PERFIS` de `auth/claims.ts` ANTES de
   qualquer checagem de papel, e valor fora dela sai como 401 "Token inválido"
   — não 403. Foi exatamente o que derrubou o job `ativar-exps` do deploy de
   2026-09-10, dois dias depois de a ADR-80 renomear o papel: os bundles subiram
   e a `versaoAtiva` não virou. Mudou `PERFIS`? Mude esta linha junto. */
const token = await new SignJWT({ escola_id: "", perfil: "gestor_contrato" })
  .setProtectedHeader({ alg: "RS256", kid })
  .setSubject("ci-deploy")
  .setIssuer(HUB_ORIGIN)
  .setAudience("plataforma-api")
  .setIssuedAt()
  .setExpirationTime("5m")
  .sign(privateKey);

const corpo = {
  nome: manifesto.nome,
  versaoAtiva: versao,
  series: manifesto.series ?? [],
  /* A unidade do ano. `null` na transversal e na ferramenta de professor — elas
     não moram numa unidade —, e é o que ORDENA a grade da sala (ADR-69). Sem
     ela a ordem cai no `exp_id`, que é numeração de experiência e não do ano
     letivo: o 7º ano apareceria depois do 8º. */
  unidade: manifesto.unidade ?? null,
  /* A QUE PRODUTO a experiência pertence (ADR-87). É o que a põe no painel da
     Unooria e o que lhe dá o teto do produto. Esquecer aqui não dá erro: a
     coluna nasce NULA, a experiência some do painel e ninguém é avisado — ela
     continua abrindo normalmente, então nem o smoke acusa. Quem cobra o campo
     é `apps/api/tests/manifestos-declaram-produto.spec.ts`, no CI. */
  produto: manifesto.produto ?? null,
  capabilities: manifesto.capabilities ?? [],
  viewport: manifesto.viewport ?? null,
  publico: manifesto.publico ?? "estudante",
  /* Esquecer este campo aqui é INVISÍVEL em dev e quebra em produção: sem
     manifesto o hub lê `permissoes` do `experiencia.json` do bundle, então a
     bancada funciona; COM manifesto ele lê a coluna, que nasceria `[]`. Para a
     exp-70 isso significa iframe sem `allow-pointer-lock` — o jogo sobe, a
     intro aparece, a criança clica em ENTRAR NA VILA e a câmera não gira.
     Campo novo no `experiencia.json` tem de ser adicionado AQUI também. */
  permissoes: manifesto.permissoes ?? [],
};

const r = await fetch(`${API_URL}/experiencias/${encodeURIComponent(manifesto.id)}`, {
  method: "PUT",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify(corpo),
});
const resposta = await r.text();
if (!r.ok) {
  console.error(`✖ PUT /experiencias/${manifesto.id} → ${r.status}: ${resposta.slice(0, 300)}`);
  process.exit(1);
}
console.log(
  `✔ manifesto publicado: ${manifesto.id}@${versao} (publico=${corpo.publico}` +
    `${corpo.permissoes.length ? `, permissoes=${corpo.permissoes.join("+")}` : ""}) em ${API_URL}`,
);
