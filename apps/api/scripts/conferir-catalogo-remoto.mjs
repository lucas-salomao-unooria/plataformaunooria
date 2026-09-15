/**
 * CONFERE O CATÁLOGO DE UMA STACK REMOTA — SÓ LEITURA. Nada aqui escreve.
 *
 * POR QUE ELE EXISTE. Em 2026-09-10 apareceu a suspeita de que a suíte de
 * testes tivesse reescrito o catálogo do banco de DEV: `salas-postgres.spec.ts`
 * fazia `upsert` com o `update` COMPLETO, então rodar a suíte sobrescrevia
 * `nome`, `versaoAtiva`, `unidade` e `produto` de experiências REAIS. O
 * `upsert` foi consertado (o `update` passou a tocar só o que a suíte exige),
 * e ficou provado que dev e hml nunca foram tocadas — o CI roda os testes
 * contra um `postgres:16` descartável (`.github/workflows/ci.yml`), não contra
 * a stack. **Mas "provado por leitura de código" não é o mesmo que "conferido
 * no banco"**, e é isso que este script faz.
 *
 * NÃO É MIGRATION, DE PROPÓSITO. Uma migration corrige um estado; aqui não há
 * estado a corrigir sem antes saber qual é o certo — e o certo mora nos
 * `public/experiencia.json`, que o deploy já reaplica a cada publicação. Uma
 * migration que "restaurasse" o catálogo escreveria valores inventados por
 * quem a escreveu, e o sintoma disso é pior que o do problema: uma experiência
 * some da grade de uma série sem ninguém ter mudado nada.
 *
 * O QUE ELE PROCURA (as impressões digitais da poluição, não "estranhezas"):
 *   1. `nome = exp_id` — a assinatura EXATA do defeito: a suíte gravava o
 *      próprio `expId` na coluna `nome`. Nenhum manifesto real faz isso.
 *   2. `exp-99-%` e `teste-%` — fixtures de teste que só existem em banco local.
 *   3. o catálogo inteiro, para conferir versão, produto e público a olho.
 *   4. `disponibilidades` e `recursos_auditoria` — o que o painel decidiu
 *      naquela stack, para conferir contra o que se espera ter decidido.
 *
 * COMO RODAR (o Cloud SQL de dev/hml só tem IP privado, sem bastion e sem VPN):
 * um Cloud Run Job EFÊMERO na VPC, com a imagem da api — que já traz o
 * `@prisma/client` gerado. `gcloud run jobs execute` não aceita `--command`,
 * então o script vai em gzip+base64 numa env (teto de 32 KiB somando todas):
 *
 *   Z=$(gzip -c apps/api/scripts/conferir-catalogo-remoto.mjs | base64 | tr -d '\n')
 *   printf 'S: %s\n' "$Z" > /tmp/envs.yaml
 *   gcloud run jobs create conferir-catalogo --project entre-redes-dev --region us-east1 \
 *     --image <a MESMA imagem da api desta stack> \
 *     --network <vpc> --subnet <subnet> --vpc-egress private-ranges-only \
 *     --service-account <contrato>-api@<projeto>.iam.gserviceaccount.com \
 *     --set-secrets DATABASE_URL=<contrato>-database-url:latest \
 *     --env-vars-file /tmp/envs.yaml \
 *     --command node --args='^@^-e@eval(require("zlib").gunzipSync(Buffer.from(process.env.S,"base64")).toString())'
 *   gcloud run jobs execute conferir-catalogo --project ... --region ... --wait
 *   gcloud logging read 'resource.labels.job_name=conferir-catalogo' --limit 200 --project ...
 *   gcloud run jobs delete conferir-catalogo --project ... --region ...   # APAGUE no fim
 *
 * `gcloud run jobs list` do projeto deve voltar a mostrar apenas o `-migrate`.
 */

import { PrismaClient } from "@prisma/client";

/* `$queryRaw` e nada de model do Prisma: este script tem de rodar mesmo se o
   schema da imagem estiver à frente ou atrás do banco daquela stack. */
const prisma = new PrismaClient();

const linha = (t) => console.log(t);
const bloco = (t) => linha(`\n-- ${t} ${"-".repeat(Math.max(0, 60 - t.length))}`);

/** Uma consulta que pode falhar porque a tabela ainda não existe naquela stack
 *  (o painel de recursos é de 2026-09) — e isso é resposta, não erro. */
async function seExistir(nomeDaTabela, consulta) {
  try {
    return await consulta();
  } catch (erro) {
    const msg = String(erro?.message ?? erro);
    if (/does not exist|não existe/i.test(msg)) {
      linha(`  (a tabela ${nomeDaTabela} ainda não existe nesta stack)`);
      return null;
    }
    throw erro;
  }
}

async function main() {
  const [{ agora, banco }] = await prisma.$queryRaw`
    SELECT now()::text AS agora, current_database() AS banco`;
  linha(`CONFERENCIA DE CATALOGO — banco ${banco}, ${agora}`);
  linha("Somente leitura: este script nao executa nenhum INSERT, UPDATE ou DELETE.");

  let suspeitas = 0;

  bloco("1. nome igual ao exp_id (a assinatura da poluicao de teste)");
  const nomeIgual = await prisma.$queryRaw`
    SELECT exp_id, nome, versao_ativa, produto, unidade
      FROM experiencias WHERE nome = exp_id ORDER BY exp_id`;
  if (nomeIgual.length === 0) linha("  nada — nenhuma linha com nome = exp_id.");
  else {
    suspeitas += nomeIgual.length;
    for (const r of nomeIgual) linha(`  ${r.exp_id}  nome="${r.nome}"  v${r.versao_ativa}`);
    linha("  ATENCAO: estas linhas tem a marca do `upsert` da suite de testes.");
    linha("  CONSERTO: republique o manifesto da experiencia (o deploy ja faz isso),");
    linha("  NAO edite a mao — o valor certo e o do `public/experiencia.json`.");
  }

  bloco("2. fixtures de teste (exp-99-*, escolas teste-*)");
  const expsDeTeste = await prisma.$queryRaw`
    SELECT exp_id, nome FROM experiencias
     WHERE exp_id LIKE 'exp-99-%' OR exp_id LIKE '%teste%' ORDER BY exp_id`;
  const escolasDeTeste = await prisma.$queryRaw`
    SELECT id, nome, tipo FROM escolas WHERE id LIKE 'teste-%' ORDER BY id`;
  if (expsDeTeste.length === 0 && escolasDeTeste.length === 0) {
    linha("  nada — nenhuma fixture de teste nesta stack.");
  } else {
    suspeitas += expsDeTeste.length + escolasDeTeste.length;
    for (const r of expsDeTeste) linha(`  ATENCAO experiencia de teste: ${r.exp_id} ("${r.nome}")`);
    for (const r of escolasDeTeste) linha(`  ATENCAO escola de teste: ${r.id} (${r.tipo})`);
    linha("  Estas linhas nunca deveriam sair de um banco local. Apagar e seguro");
    linha("  DEPOIS de conferir que ninguem as usa (nenhum usuario na escola).");
  }

  bloco("3. o catalogo, como ele esta");
  const catalogo = await prisma.$queryRaw`
    SELECT exp_id, nome, versao_ativa, produto, unidade,
           array_length(series, 1) AS qtd_series, publico, atualizado_em::text AS quando
      FROM experiencias ORDER BY exp_id`;
  linha(`  ${catalogo.length} experiencias no catalogo:`);
  for (const r of catalogo) {
    const series = r.qtd_series === null ? "todas as series" : `${r.qtd_series} serie(s)`;
    linha(
      `  ${r.exp_id.padEnd(26)} v${String(r.versao_ativa).padEnd(8)} ` +
        `${String(r.produto ?? "(sem produto)").padEnd(14)} u${r.unidade ?? "-"} ` +
        `${series.padEnd(16)} ${r.publico.padEnd(10)} ${r.quando}`,
    );
  }
  const semProduto = catalogo.filter((r) => !r.produto);
  if (semProduto.length > 0) {
    linha(`  nota: ${semProduto.length} sem \`produto\` — elas nao aparecem agrupadas`);
    linha("  no painel da Unooria, e respondem so pelo proprio interruptor (ADR-87).");
  }

  bloco("4. o que o painel de recursos decidiu nesta stack");
  const disp = await seExistir(
    "disponibilidades",
    () => prisma.$queryRaw`
      SELECT recurso_id, coalesce(escola_id, '(a rede inteira)') AS escopo,
             ligado, versao_fixa, motivo, atualizado_em::text AS quando
        FROM disponibilidades ORDER BY atualizado_em DESC`,
  );
  if (disp && disp.length === 0) {
    linha("  nenhuma linha — tudo ligado por padrao, que e o estado normal:");
    linha("  ausencia de linha = LIGADO (o contrario de `liberacoes`).");
  } else if (disp) {
    for (const r of disp) {
      linha(
        `  ${r.ligado ? "LIGADO   " : "DESLIGADO"} ${r.recurso_id.padEnd(34)} ${r.escopo}` +
          `${r.versao_fixa ? `  versao fixa v${r.versao_fixa}` : ""}` +
          `${r.motivo ? `  — ${r.motivo}` : ""}  (${r.quando})`,
      );
    }
  }

  const aud = await seExistir(
    "recursos_auditoria",
    () => prisma.$queryRaw`
      SELECT acao, recurso_id, coalesce(escola_id, '(a rede inteira)') AS escopo,
             versao, motivo, autor_nome, quando::text AS quando
        FROM recursos_auditoria ORDER BY quando DESC LIMIT 40`,
  );
  if (aud && aud.length === 0) linha("  historico vazio: nada foi ligado nem desligado aqui.");
  else if (aud) {
    linha(`  as ${aud.length} mudancas mais recentes:`);
    for (const r of aud) {
      linha(
        `  ${r.quando}  ${r.acao.padEnd(15)} ${r.recurso_id.padEnd(30)} ${String(r.escopo).padEnd(16)} ` +
          `${r.autor_nome}${r.versao ? ` v${r.versao}` : ""}${r.motivo ? ` — ${r.motivo}` : ""}`,
      );
    }
  }

  bloco("VEREDITO");
  if (suspeitas === 0) {
    linha("  LIMPO: nenhuma marca de fixture de teste neste banco.");
    linha("  (o esperado — o CI roda a suite contra um postgres descartavel)");
  } else {
    linha(`  ${suspeitas} linha(s) suspeita(s). Leia as secoes 1 e 2 acima antes de mexer.`);
  }
  linha("");
}

main()
  .catch((erro) => {
    console.error("a conferencia falhou:", erro?.message ?? erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
