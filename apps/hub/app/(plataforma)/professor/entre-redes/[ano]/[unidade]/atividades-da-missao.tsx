import { EmptyState, FeedbackAlert } from "@edu/ui/ds";
import { CartaoAtividade } from "@/components/cartao-atividade";
import { LinkButton } from "@/components/link-button";
import { atividadesDaMissao } from "@/lib/atividades-servidor";
import {
  rotaDaAtividade,
  rotaDaNovaAtividade,
  serieDaMissao,
  type MissaoComAtividade,
} from "@/lib/entre-redes/atividades";
import { rotaDaMissao, type Missao } from "@/lib/entre-redes/catalogo";
import { normalizarSerie } from "@/lib/series";
import { minhasTurmas, type TurmaDoProfessor } from "@/lib/turmas";

/**
 * "SUAS ATIVIDADES NESTA MISSÃO" (ADR-130) — a seção que as quatro missões com
 * atividade dividem, no molde da lista do Instanooria.
 *
 * A missão é o esqueleto narrativo; a atividade é a missão que a turma faz de
 * fato, e quem a cria é o professor — a plataforma não cria nada. Cada uma é
 * uma configuração da missão para um tema dele, e ele escolhe qual está EM
 * ANDAMENTO: as outras ficam prontas, esperando a vez.
 *
 * A lista é DA TURMA: a atividade e as equipes dela são de uma turma só. Sem
 * turma (a trilha do Entre Redes, um link salvo), a seção pede para escolher
 * uma — entre as do professor que são da série da missão.
 */
export async function AtividadesDaMissao({
  missao,
  expId,
  turma,
}: {
  missao: Missao;
  expId: MissaoComAtividade;
  turma: TurmaDoProfessor | null;
}) {
  const rotaBase = rotaDaMissao(missao);

  if (!turma) {
    const serie = serieDaMissao(expId);
    const turmas = (await minhasTurmas()).filter((t) => normalizarSerie(t.serie) === serie);
    return (
      <section className="flex flex-col gap-4" data-atividades-da-missao>
        <div>
          <h2 className="text-[18px] font-bold text-unooria-neutral-950">Suas atividades nesta missão</h2>
          <p className="text-[13px] text-unooria-neutral-500">
            Cada atividade é uma configuração da missão para um tema seu, numa turma. Escolha a turma para ver as
            atividades dela e criar a próxima.
          </p>
        </div>
        {turmas.length === 0 ? (
          <EmptyState
            variant="no-data"
            size="lg"
            bordered
            fullWidth
            title="Você não tem turma desta série"
            description="As atividades são criadas por turma. Entre por uma turma em Minhas turmas."
          />
        ) : (
          <div className="flex flex-wrap gap-2" data-escolha-de-turma>
            {turmas.map((t) => (
              <LinkButton key={t.id} href={`${rotaBase}?turmaId=${encodeURIComponent(t.id)}`} variant="secondary">
                {t.nome}
              </LinkButton>
            ))}
          </div>
        )}
      </section>
    );
  }

  const atividades = await atividadesDaMissao(expId, turma.id);
  const emAndamento = atividades?.find((a) => a.estado === "em-andamento") ?? null;
  const prontas = atividades?.filter((a) => a.estado === "pronta").length ?? 0;

  return (
    <section className="flex flex-col gap-4" data-atividades-da-missao>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-unooria-neutral-950">Suas atividades com a turma {turma.nome}</h2>
          <p className="text-[13px] text-unooria-neutral-500">
            Cada atividade é uma configuração da missão para um tema seu. Você pode ter quantas quiser, e escolhe
            qual a turma está fazendo agora.
          </p>
        </div>
        <LinkButton href={rotaDaNovaAtividade(rotaBase, expId, turma.id)}>Nova atividade</LinkButton>
      </div>

      {atividades === null ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos ler as atividades desta turma"
          description="Confira a conexão e recarregue a página."
        />
      ) : atividades.length === 0 ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title={`Nenhuma atividade com a turma ${turma.nome} ainda`}
          description="Crie a primeira: escolha o conteúdo, monte as equipes e ponha no ar quando a turma for fazer a missão."
        />
      ) : (
        <>
          {/* Sem atividade em andamento, a turma vê a missão FECHADA — e a
              plataforma não abre nada sozinha. Dizer isso aqui é o que evita o
              "os alunos não conseguem entrar" que parece defeito. */}
          {!emAndamento && prontas > 0 ? (
            <FeedbackAlert
              type="info"
              title="Nenhuma atividade em andamento"
              description="A turma vê a missão fechada até você escolher uma. Use “Usar esta atividade agora” na que ela vai fazer."
            />
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2">
            {atividades.map((atividade) => (
              <li key={atividade.id}>
                <CartaoAtividade
                  atividade={atividade}
                  href={rotaDaAtividade(rotaBase, expId, turma.id, atividade.id)}
                  expId={expId}
                  turmaId={turma.id}
                  emAndamentoAgora={emAndamento && emAndamento.id !== atividade.id ? emAndamento.titulo : null}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
