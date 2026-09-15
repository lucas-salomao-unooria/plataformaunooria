import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";

/**
 * O catálogo de experiências e as liberações de demonstração (ADR-69).
 *
 * **Por que o seed escreve `experiencias`.** Em produção quem escreve essa
 * tabela é o CI, ao publicar o bundle (`PUT /experiencias/:expId`). Numa stack
 * de desenvolvimento não há publish, então ela fica VAZIA — e desde a sala de
 * aula isso deixou de ser um detalhe cosmético: sem catálogo não há grade, e sem
 * grade o professor abre a sala e não tem o que liberar. (O sintoma antigo da
 * tabela vazia já era conhecido: o hub servia o Instanooria esticado na janela
 * por não achar o `viewport`.)
 *
 * A fonte é a MESMA que o CI lê: o `public/experiencia.json` de cada
 * experiência. Um catálogo escrito à mão aqui seria a segunda fonte de verdade
 * sobre o que existe, e divergiria no primeiro publish.
 */

/** O que o `public/experiencia.json` declara — o mesmo contrato que o CI envia. */
interface Manifesto {
  id: string;
  nome: string;
  versao: string;
  series?: string[];
  unidade?: number;
  produto?: string;
  capabilities?: string[];
  viewport?: { largura: number; altura: number } | null;
  publico?: string;
  permissoes?: string[];
}

const PASTA_DAS_EXPERIENCIAS = resolve(__dirname, "../../experiencias");

/** Lê os manifestos do monorepo. `_template` fica de fora: não é experiência. */
export function lerManifestos(): Manifesto[] {
  const pastas = readdirSync(PASTA_DAS_EXPERIENCIAS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("exp-"))
    .map((e) => e.name)
    .sort();

  const manifestos: Manifesto[] = [];
  for (const pasta of pastas) {
    const caminho = resolve(PASTA_DAS_EXPERIENCIAS, pasta, "public/experiencia.json");
    try {
      manifestos.push(JSON.parse(readFileSync(caminho, "utf8")) as Manifesto);
    } catch {
      /* Experiência sem manifesto legível não entra no catálogo — e o seed não
         morre por causa dela: quem quebra assim é uma pasta em construção. */
    }
  }
  return manifestos;
}

/**
 * Semeia `experiencias` a partir dos manifestos.
 *
 * `versaoAtiva` sai do `versao` do manifesto, como no publish. Em dev o hub nem
 * usa esse valor (ele cai no dev server do Vite), mas gravar outra coisa aqui
 * faria a tela do admin mostrar uma versão que não existe.
 */
export async function semearCatalogo(prisma: PrismaClient): Promise<number> {
  const manifestos = lerManifestos();
  for (const m of manifestos) {
    const dados = {
      nome: m.nome,
      versaoAtiva: m.versao,
      series: m.series ?? [],
      unidade: m.unidade ?? null,
      /* O produto (ADR-87). Sem ele o seed popularia o catálogo com a coluna
         NULA, e o painel da Unooria abriria numa stack de dev sem nenhuma
         experiência dentro dos produtos — a tela vazia que parece bug de tela. */
      produto: m.produto ?? null,
      capabilities: m.capabilities ?? [],
      viewport: m.viewport ?? undefined,
      publico: m.publico ?? "estudante",
      permissoes: m.permissoes ?? [],
    };
    await prisma.experiencia.upsert({
      where: { expId: m.id },
      update: dados,
      create: { expId: m.id, ...dados },
    });

    /* O HISTÓRICO junto, como o `PUT /experiencias/:expId` faz (ADR-87). Sem
       isto, uma stack semeada tem `versao_ativa` sem linha correspondente em
       `experiencias_versoes`, e o painel da Unooria abre dizendo que não conhece
       versão nenhuma da experiência que está no ar — a tela vazia que faz a
       pessoa duvidar da tela em vez do dado. `publicadaPor` é texto justamente
       para caber `seed`, que não é uma linha de `users`. */
    await prisma.experienciaVersao.upsert({
      where: { expId_versao: { expId: m.id, versao: m.versao } },
      update: { manifesto: m as object, publicadaPor: "seed" },
      create: { expId: m.id, versao: m.versao, manifesto: m as object, publicadaPor: "seed" },
    });
  }
  return manifestos.length;
}

/**
 * As missões liberadas nas turmas de demonstração.
 *
 * **Só as turmas "A".** As suítes de ponta a ponta do ESTUDANTE entram sempre
 * pela primeira conta da série, que é da turma A — então é ela que precisa
 * nascer com a missão aberta, ou a ordem canônica da suíte (estudante antes de
 * professor) quebraria: o estudante produz o estado que as telas do professor
 * leem, e ele não pode depender de um clique que só acontece depois.
 *
 * **As turmas "B" ficam fechadas de propósito**, e isso também é fixture: é
 * nelas que a suíte do professor exercita liberar e encerrar sem interferir em
 * nenhuma suíte de estudante.
 *
 * Quem "liberou" é o professor da própria turma — a coluna existe para a sala
 * poder perguntar quem abriu a missão, e um id de gestor ali contaria uma
 * história que não aconteceu.
 */
export const LIBERACOES_DE_DEMO: Array<{ turma: string; expIds: string[] }> = [
  // O 8º ano abre as duas: a Vila é o Ato 1 do Instanooria, e é o par que a
  // suíte `estudante/05-vila-do-lume` + `estudante/02-instanooria` percorre.
  { turma: "8A", expIds: ["exp-70-vila-do-lume", "exp-01-instanooria", "exp-08-manifesto-ia"] },
  { turma: "1A", expIds: ["exp-04-o-que-a-foto-conta"] },
  { turma: "4A", expIds: ["exp-02-unootube"] },
  { turma: "6A", expIds: ["exp-06-rastro-boato"] },
  { turma: "7A", expIds: ["exp-07-o-eco-no-grupo"] },
  { turma: "2EM-A", expIds: ["exp-03-unoogpt"] },
];

export async function semearLiberacoes(
  prisma: PrismaClient,
  escolaId: string,
  turmaPorNome: Map<string, string>,
  professorDaTurma: Map<string, string>,
): Promise<number> {
  let total = 0;
  for (const { turma, expIds } of LIBERACOES_DE_DEMO) {
    const turmaId = turmaPorNome.get(turma);
    const professorId = professorDaTurma.get(turma);
    /* Turma ausente não é erro: `SEED_MINIMO=1` não cria turma nenhuma, e uma
       exceção aqui derrubaria o seed mínimo por causa de uma fixture. */
    if (!turmaId || !professorId) continue;

    for (const expId of expIds) {
      await prisma.liberacao.upsert({
        where: { escolaId_turmaId_expId: { escolaId, turmaId, expId } },
        update: { estado: "liberada", encerradaEm: null },
        create: { escolaId, turmaId, expId, estado: "liberada", liberadaPor: professorId },
      });
      total += 1;
    }
  }
  return total;
}
