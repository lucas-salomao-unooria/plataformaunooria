import { RotuloDaTrilha } from "@/components/trilha";
import { apiDoServidor } from "@/lib/api-servidor";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import type { PainelDaFoto, ProjecaoDaFoto, TurmaDaFoto } from "@/lib/foto-conta-tipos";
import { normalizarSerie } from "@/lib/series";

import { AulaFotoConta } from "./aula-foto-conta";
import { SeletorDeTurma } from "./seletor-de-turma";

/**
 * A aula de O QUE A FOTO CONTA: preparação do pacote, o dashboard ao vivo, a
 * projeção da Roda e os DOIS botões do professor (liberar a reflexão, zerar).
 *
 * Esta é a tela que o professor PROJETA na lousa durante a Roda de Conversa —
 * por isso a projeção comparativa (as duas fotos com O QUE FICOU NO MEIO / DE
 * FORA) mora aqui, e não numa rota própria: a aula inteira se conduz de um
 * lugar só, sem trocar de tela com a turma esperando.
 *
 * A REGRA QUE ESTA TELA APLICA: sem ranking e sem nota (a missão é 100%
 * formativa). A lista de hesitação nomeia crianças para MEDIAÇÃO DE LEITURA —
 * ela é o único lugar com nome, e o payload que a alimenta é a rota
 * autenticada do professor (DAD-07).
 */
export async function ResultadosFotoConta({
  missao,
  turma,
}: {
  missao: Missao;
  turma: string;
}) {
  const rotaBase = `${rotaDaMissao(missao)}/resultados`;

  const lista = await apiDoServidor<{ turmas: TurmaDaFoto[] }>("/foto-conta/turmas");
  const todas = lista?.turmas ?? [];
  /* O filtro por série FICA — esta missão é do 1º ano. Sem turma da série, o
     certo é dizer isso, nunca oferecer uma turma que não vai jogar. */
  const turmas = todas.filter((t) => normalizarSerie(t.serie) === "1EF");
  const aviso =
    turmas.length === 0
      ? "Você não tem turma de 1º ano, e esta missão é dessa série. Para conduzir uma missão, entre pela turma em Minhas turmas."
      : undefined;

  const painel = turma
    ? await apiDoServidor<PainelDaFoto>(`/foto-conta/turmas/${encodeURIComponent(turma)}`)
    : null;
  const projecao = turma
    ? await apiDoServidor<ProjecaoDaFoto>(
        `/foto-conta/turmas/${encodeURIComponent(turma)}/projecao`,
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Esta missão chama a tela de "A aula ao vivo": daqui se prepara o
          pacote, se projeta a Roda e se libera a reflexão — o rótulo genérico
          do registro de rotas é corrigido pela página. */}
      <RotuloDaTrilha valor="A aula ao vivo" />

      <header className="flex flex-col gap-1">
        <p className="text-[12px] uppercase tracking-widest text-unooria-neutral-500">
          {missao.titulo}
        </p>
        <h1 className="text-[24px] font-bold leading-tight text-unooria-neutral-950">
          A aula ao vivo
        </h1>
        <p className="max-w-3xl text-[14px] leading-relaxed text-unooria-neutral-700">
          Prepare o pacote da turma (ou deixe o banco padrão assumir), acompanhe as escolhas
          durante a missão, projete as duas fotos na Roda de Conversa e libere a reflexão final
          quando a conversa fechar.
        </p>
      </header>

      <SeletorDeTurma turmas={turmas} turmaId={turma} rotaBase={rotaBase} aviso={aviso} />

      {painel && projecao ? (
        <AulaFotoConta painelInicial={painel} projecaoInicial={projecao} />
      ) : null}
    </div>
  );
}
