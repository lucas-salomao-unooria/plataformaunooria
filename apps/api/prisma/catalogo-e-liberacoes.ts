import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { EXP_ID_RE } from "../src/comum/codigo-da-experiencia";
import { CODIGO_ARQUIVADO_RE, codigoDeOrigem } from "../src/comum/arquivadas";

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

/**
 * Lê os manifestos do monorepo. `_template` fica de fora: não é experiência. E
 * as ARQUIVADAS (`backup-*`, ADR-116) também: o `EXP_ID_RE` não casa com elas,
 * e é isso que as tira do catálogo, da grade e do painel sem um filtro a mais.
 */
export function lerManifestos(): Manifesto[] {
  return lerPastas((nome) => EXP_ID_RE.test(nome));
}

/** As experiências ARQUIVADAS do monorepo: `apps/experiencias/backup-*` (ADR-116). */
export function lerManifestosArquivados(): Manifesto[] {
  return lerPastas((nome) => CODIGO_ARQUIVADO_RE.test(nome));
}

function lerPastas(servePasta: (nome: string) => boolean): Manifesto[] {
  const pastas = readdirSync(PASTA_DAS_EXPERIENCIAS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && servePasta(e.name))
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
  await semearArquivadas(prisma);
  return manifestos.length;
}

/**
 * Por que cada experiência foi arquivada — a frase que a área `/unooria/arquivados`
 * mostra. É o MESMO texto que a migração que a arquivou grava; aqui ele só vale
 * para a stack de desenvolvimento, onde a migração não teve linha para mover.
 */
const MOTIVO_DO_ARQUIVAMENTO: Record<string, string> = {
  "backup-exp04ef1b": "O Jornal da Escola tomou o código exp04ef1b (4º ano, unidade 1).",
};

/**
 * Semeia `experiencias_arquivadas` a partir de `apps/experiencias/backup-*`
 * (ADR-116). Numa stack que já existia, a migração que arquivou MOVEU a linha de
 * `experiencias` para lá, com a fotografia de turmas e estudantes; numa stack
 * nova não havia linha, e sem isto a área do admin abriria vazia. Por isso o
 * `update` é vazio: quando a linha já existe, a da migração vale.
 */
export async function semearArquivadas(prisma: PrismaClient): Promise<number> {
  const manifestos = lerManifestosArquivados();
  for (const m of manifestos) {
    const origem = codigoDeOrigem(m.id);
    if (!origem) continue;
    await prisma.experienciaArquivada.upsert({
      where: { expId: m.id },
      update: {},
      create: {
        expId: m.id,
        codigoDeOrigem: origem,
        nome: m.nome,
        versao: m.versao,
        series: m.series ?? [],
        unidade: m.unidade ?? null,
        produto: m.produto ?? null,
        motivo: MOTIVO_DO_ARQUIVAMENTO[m.id] ?? "Arquivada.",
      },
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
  { turma: "8A", expIds: ["app-70-vila-do-lume", "exp08ef1b", "exp08ef4b"] },
  { turma: "1A", expIds: ["exp01ef1b"] },
  // O 2º ano: O Enigma da Capa da Rádio (ADR-184).
  { turma: "2A", expIds: ["exp02ef1b"] },
  // O 4º ano ficou sem missão liberada entre o arquivamento do UnooTube
  // (ADR-116) e a chegada do Jornal da Escola, que herdou o código exp04ef1b.
  // É a turma da suíte `estudante/12-jornal-da-escola`.
  { turma: "4A", expIds: ["exp04ef1b"] },
  { turma: "5A", expIds: ["exp05ef1b"] },
  // O 6º ano abre as duas missões da série: a unidade 2 (exp06ef2b) e o Júri
  // Estadual de Projetos (exp06ef1b, unidade 1).
  { turma: "6A", expIds: ["exp06ef2b", "exp06ef1b"] },
  { turma: "7A", expIds: ["exp07ef1b"] },
  // A 1ª série EM: O Assistente Invisível (ADR-185).
  { turma: "1EM-A", expIds: ["exp01em1b"] },
  { turma: "2EM-A", expIds: ["exp02em1b"] },
  // A 3ª série EM: O Porta-Voz dos Dados (ADR-198).
  { turma: "3EM-A", expIds: ["exp03em1b"] },
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
