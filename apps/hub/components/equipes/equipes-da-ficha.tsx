import { SectionHeader } from "@edu/ui/ds";
import { auth } from "@/lib/auth";
import { ATIVIDADE_DA_TURMA } from "@/lib/equipes";
import { equipesDaMissao, ultimasEquipes } from "@/lib/equipes-servidor";
import { copyDaMissao } from "@/lib/missoes-do-estudante";

import { SecaoEquipes } from "./secao-equipes";

/**
 * As EQUIPES DE UMA ATIVIDADE (E13, ADR-130): quem divide um computador.
 *
 * A equipe é da atividade, e não da missão: a seção mora na PÁGINA DA
 * ATIVIDADE (os resultados da A Seleção, do Jornal e do Quem Mandou, a
 * `/professor/atividades/[id]` do Instanooria), e a criação da atividade já
 * pergunta o modo. Só aparece quando a api diz que a missão aceita equipe
 * (`permitida`) — a lista é da api, o hub não guarda a dele — e some com
 * `null` (api fora do ar, atividade de outra turma): a página continua
 * servindo para o resto.
 */
export async function EquipesDaAtividade({
  turmaId,
  expId,
  atividadeId,
  titulo = "Equipes desta atividade",
  separarAoAbrir,
}: {
  turmaId: string;
  expId: string;
  atividadeId: string;
  titulo?: string;
  /** "Eu separo" escolhido na criação: as equipes vazias já abrem (ver `SecaoEquipes`). */
  separarAoAbrir?: number | null;
}) {
  const [equipes, session] = await Promise.all([equipesDaMissao(turmaId, expId, atividadeId), auth()]);
  if (!equipes?.permitida) return null;

  const podeEditar = session?.usuario.papel === "professor";
  /* "Usar as equipes da atividade anterior" só é oferecido a quem pode salvar,
     e a leitura sai daqui (e não de um fetch no cliente) para a opção já estar
     no formulário quando ele aparece. */
  const ultima = podeEditar ? await ultimasEquipes(turmaId, expId, atividadeId) : null;
  const tituloDaUltima = ultima?.origem ? (copyDaMissao(ultima.origem.expId)?.titulo ?? null) : null;

  return (
    <section className="flex flex-col gap-4" data-equipes-da-atividade={atividadeId}>
      <SectionHeader
        title={titulo}
        description="Para quando alunos dividem um computador: quem entra na missão representa a equipe."
      />
      <SecaoEquipes
        turmaId={turmaId}
        expId={expId}
        atividadeId={atividadeId}
        inicial={equipes}
        podeEditar={podeEditar}
        ultima={ultima}
        tituloDaUltima={tituloDaUltima}
        separarAoAbrir={separarAoAbrir}
      />
    </section>
  );
}

/**
 * A seção da FICHA, só para a missão SEM atividade — o unooGPT, até ser
 * refeito com elas (ADR-130): uma montagem por turma, com o id fixo `turma`.
 * As missões com atividade montam as equipes na página de cada atividade.
 */
export function EquipesDaFicha({ turmaId, expId }: { turmaId: string; expId: string }) {
  return (
    <EquipesDaAtividade turmaId={turmaId} expId={expId} atividadeId={ATIVIDADE_DA_TURMA} titulo="Equipes desta turma" />
  );
}
