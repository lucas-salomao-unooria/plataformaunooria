import { PrismaClient } from "@prisma/client";
import { lerManifestos } from "../prisma/catalogo-e-liberacoes";

/**
 * O CATÁLOGO REAL É PRÉ-CONDIÇÃO DA SUÍTE, como o schema é (`globalSetup`).
 *
 * O DEFEITO QUE ISTO CONSERTA, e ele custou um CI vermelho que passava na
 * máquina: `experiencias` é tabela de CONTRATO, sem `escola_id` e sem RLS, e
 * várias suítes LEEM dela sem nunca a escrever — o teto do produto sobre a
 * experiência, a composição produto → experiências do painel, a grade da sala,
 * o `GET /recursos/efetivos`. No banco de desenvolvimento o `seed` já a
 * preencheu, então essas suítes passavam. No CI o Postgres é descartável e
 * recém-migrado: a tabela está VAZIA, e o produto desligado não fechava a porta
 * de nada porque nenhuma experiência declarava pertencer a ele.
 *
 * O sintoma apontava para o lugar errado — `expect(codigo).toBe(
 * "recurso-indisponivel")` recebendo `null`, que se lê como "a guarda não
 * funciona" quando o que faltava era o dado. E ele NÃO reproduz localmente:
 * quem rodar a suíte na máquina vê verde.
 *
 * A FONTE É A MESMA DO CI E DO SEED: o `public/experiencia.json` de cada
 * experiência. Um catálogo de teste escrito à mão aqui seria a terceira fonte
 * de verdade sobre o que existe, e divergiria no primeiro publish.
 *
 * `update` MÍNIMO, `create` completo — a distinção é a lição de
 * `salas-postgres.spec.ts`, com uma diferença que importa: lá o `update`
 * gravava valores INVENTADOS (`nome: expId`, `versaoAtiva: "1.0.0"`) sobre
 * linhas reais; aqui os valores são os do manifesto, os mesmos que o deploy
 * grava. Mesmo assim `nome` e `versaoAtiva` ficam fora do `update`: num banco
 * de desenvolvimento a `versao_ativa` pode estar deliberadamente numa versão
 * anterior (alguém fez rollback pelo painel), e rodar os testes não é motivo
 * para desfazer isso.
 */
/** Postgres inalcançável NÃO derruba a corrida: 75 das 95 suítes são unitárias
 *  e rodavam sem banco antes deste `globalSetup` existir — tirar isso seria
 *  cobrar docker de quem só quer rodar `regras.spec.ts`. As de integração
 *  reprovam sozinhas, com o erro de conexão delas, que é o diagnóstico certo.
 *  Qualquer OUTRO erro sobe: banco que responde e recusa a escrita é defeito, e
 *  engolir isso devolveria o vermelho confuso que este arquivo existe para
 *  acabar. */
const SEM_BANCO = /P1000|P1001|P1002|P1003|ECONNREFUSED|ENOTFOUND|Can't reach database/;

export default async function prepararCatalogo(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    for (const m of lerManifestos()) {
      /* O que as suítes de fato leem: a que produto a experiência pertence
         (o TETO), para quem ela é e em que série/unidade ela entra na grade. */
      const oQueASuiteLe = {
        series: m.series ?? [],
        unidade: m.unidade ?? null,
        produto: m.produto ?? null,
        publico: m.publico ?? "estudante",
      };
      const linha = await prisma.experiencia.upsert({
        where: { expId: m.id },
        update: oQueASuiteLe,
        create: {
          expId: m.id,
          nome: m.nome,
          versaoAtiva: m.versao,
          capabilities: m.capabilities ?? [],
          viewport: m.viewport ?? undefined,
          permissoes: m.permissoes ?? [],
          ...oQueASuiteLe,
        },
      });

      /* O HISTÓRICO da versão que está NO AR — não a do manifesto. É o que a
         migração de backfill fez, e o que `disponibilidades-postgres` cobra:
         `versao_ativa` sem linha em `experiencias_versoes` faz o painel abrir
         dizendo que não conhece versão nenhuma da experiência que está no ar. */
      await prisma.experienciaVersao.upsert({
        where: { expId_versao: { expId: m.id, versao: linha.versaoAtiva } },
        update: {},
        create: {
          expId: m.id,
          versao: linha.versaoAtiva,
          manifesto: { ...m, versao: linha.versaoAtiva } as object,
          publicadaPor: "testes",
        },
      });
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    if (!SEM_BANCO.test(mensagem)) throw erro;
    console.warn(
      "\n[catalogo-real] Postgres inalcançável — o catálogo não foi semeado.\n" +
        "  As suítes de integração (tests/*-postgres.spec.ts) vão reprovar.\n" +
        `  ${mensagem.split("\n")[0]}\n`,
    );
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}
