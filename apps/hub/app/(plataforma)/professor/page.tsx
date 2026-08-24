import Link from "next/link";

import { Badge, Card } from "@edu/ui/ds";
import { CartaoProduto } from "@/components/cartao-produto";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { MISSAO_ATUAL, rotaDaMissao } from "@/lib/entre-redes/catalogo";
import { PRODUTOS } from "@/lib/produtos";
import { STATUS_DA_ATIVIDADE } from "@/lib/status-atividade";

/** O que a api devolve em GET /atividades (escopado ao professor do token). */
type RespostaAtividades = {
  atividades: Array<{
    id: string;
    titulo: string;
    disciplina: string;
    recorte: string;
    perguntaChave: string;
    status: string;
    etapa: string;
    criadoEm: string;
    alunos: number;
    posts: number;
    sessoes: number;
  }>;
};

/** Primeiro nome utilizável para cumprimento (ignora títulos como "Prof."). */
function primeiroNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeiro =
    partes.find((parte) => !parte.endsWith(".")) ?? partes[0] ?? "";
  return primeiro.replace(/[.,]$/, "");
}

/**
 * Hub da Plataforma Unooria.
 *
 * Primeira tela do professor: os dois produtos e nada mais decidido por nós.
 * As atividades (que antes moravam aqui) desceram um nível — agora vivem dentro
 * da missão do Entre Redes que as gerou. O que sobra aqui é só o atalho para
 * retomar o trabalho recente, que é o pedido real de quem volta no dia seguinte.
 */
export default async function HubProfessor() {
  const session = await auth();
  const usuario = session!.usuario;

  // No origem era `prisma.activity.findMany({ take: 4 })`; a api devolve a
  // lista já ordenada por criação (desc) e escopada ao professor do token.
  const resposta = await apiDoServidor<RespostaAtividades>("/atividades");
  const recentes = (resposta?.atividades ?? []).slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">
          {/* "Prof. Demo" → primeiro nome "Prof." geraria "Olá, Prof..". */}
          Olá, {primeiroNome(usuario.nome)}
        </h1>
        <p className="text-[14px] text-unooria-neutral-500">
          Escolha por onde começar. São dois produtos, cada um com o seu tempo:
          um prepara a aula, o outro roda com a turma.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
          Produtos
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {PRODUTOS.map((produto) => (
            <li key={produto.slug} className="h-full">
              <CartaoProduto produto={produto} />
            </li>
          ))}
        </ul>
      </section>

      {recentes.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-widest text-unooria-neutral-500">
              Continue de onde parou
            </h2>
            <Link
              href={rotaDaMissao(MISSAO_ATUAL)}
              className="text-[13px] font-semibold text-unooria-neutral-700 hover:text-unooria-navy-900"
            >
              Ver todas as atividades
            </Link>
          </div>

          <Card variant="outlined">
            <ul className="flex flex-col">
              {recentes.map((atividade) => {
                const status = STATUS_DA_ATIVIDADE[atividade.status] ?? {
                  rotulo: atividade.status,
                  variante: "neutral" as const,
                };
                return (
                  <li key={atividade.id} className="linha-de-lista">
                    <Link
                      href={`/professor/atividades/${atividade.id}`}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-unooria-neutral-950">
                          {atividade.titulo}
                        </span>
                        <span className="block truncate text-[13px] text-unooria-neutral-500">
                          {atividade.disciplina} · {atividade.recorte}
                        </span>
                      </span>
                      <Badge variant={status.variante}>{status.rotulo}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
