import { SectionHeader } from "@edu/ui/ds";
import { auth } from "@/lib/auth";
import { equipesDaMissao, ultimasEquipes } from "@/lib/equipes-servidor";
import { copyDaMissao } from "@/lib/missoes-do-estudante";

import { SecaoEquipes } from "./secao-equipes";

/**
 * A seção "Equipes desta turma" da FICHA da missão (E13), montada pelo
 * despachante dentro do `corpo()` — uma vez, para todos os corpos, pela mesma
 * razão da faixa da turma: sete cópias divergem.
 *
 * Só existe com turma (`?turmaId=`, vindo da sala) e quando a api diz que a
 * missão aceita equipe (`permitida`). A lista de missões é da api; o hub não
 * guarda a dele. `null` da api (fora do ar, rota ausente) também some com a
 * seção — a ficha continua servindo para o resto.
 */
export async function EquipesDaFicha({ turmaId, expId }: { turmaId: string; expId: string }) {
  const [equipes, session] = await Promise.all([equipesDaMissao(turmaId, expId), auth()]);
  if (!equipes?.permitida) return null;

  const podeEditar = session?.usuario.papel === "professor";
  /* "Manter as equipes da última missão" só é oferecido a quem pode salvar, e
     a leitura sai daqui (e não de um fetch no cliente) para a opção já estar no
     formulário quando ele aparece. */
  const ultima = podeEditar ? await ultimasEquipes(turmaId, expId) : null;
  const tituloDaUltima = ultima?.origem ? (copyDaMissao(ultima.origem.expId)?.titulo ?? null) : null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Equipes desta turma"
        description="Para quando alunos dividem um computador: quem entra na missão representa a equipe."
      />
      <SecaoEquipes
        turmaId={turmaId}
        expId={expId}
        inicial={equipes}
        podeEditar={podeEditar}
        ultima={ultima}
        tituloDaUltima={tituloDaUltima}
      />
    </section>
  );
}
