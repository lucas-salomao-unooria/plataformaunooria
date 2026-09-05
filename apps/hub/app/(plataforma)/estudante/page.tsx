import { EmptyState } from "@edu/ui/ds";
import { CartaoMissaoEstudante } from "@/components/cartao-missao-estudante";
import { auth } from "@/lib/auth";
import { copyDaMissao } from "@/lib/missoes-do-estudante";
import { minhasSalas, type SalaDoEstudante } from "@/lib/salas";
import { rotuloDaSerie, normalizarSerie } from "@/lib/series";
import { rotuloDoTurno } from "@/lib/turmas";

export const metadata = { title: "Minhas turmas — Plataforma Unooria" };

/** Primeiro nome, para o cumprimento. */
function primeiroNome(nome: string): string {
  return (nome.trim().split(/\s+/)[0] ?? "").replace(/[.,]$/, "");
}

/** "8A · 8º ano · manhã" — a linha de identidade da sala. */
function linhaDaTurma(turma: SalaDoEstudante["turma"]): string {
  const serie = normalizarSerie(turma.serie);
  const turno = rotuloDoTurno(turma.turno);
  return [serie ? rotuloDaSerie(serie) : turma.serie, turno].filter(Boolean).join(" · ");
}

/**
 * O hub do ESTUDANTE: a TURMA dele e, dentro dela, as missões (ADR-69).
 *
 * Antes esta tela listava uma constante compilada no bundle — as cinco missões,
 * iguais para toda criança de toda escola. Agora quem responde é a api, pela
 * turma: `GET /salas/minhas` devolve a grade do ano dela com o estado de cada
 * missão.
 *
 * A GRADE VEM INTEIRA, e não só o que está aberto: a bloqueada aparece com
 * cadeado. É a promessa do que vem depois — uma lista que muda de tamanho
 * sozinha não deixa ninguém entender que a próxima unidade existe.
 *
 * Missão sem copy de estudante não entra (`copyDaMissao` devolve `null`): sem
 * título e sem chamada o card seria um retângulo com um slug dentro.
 */
export default async function HubEstudante() {
  const session = await auth();
  const usuario = session!.usuario;
  const salas = await minhasSalas();

  /* `null` e `[]` são coisas diferentes: a api fora do ar não é "você não está
     em turma nenhuma", e mandar a criança falar com a coordenação por causa de
     um 503 é o pior conselho possível. */
  if (salas === null) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">
          Olá, {primeiroNome(usuario.nome)}
        </h1>
        <EmptyState
          variant="error"
          size="lg"
          bordered
          fullWidth
          title="Não conseguimos carregar suas missões"
          description="Tente de novo em instantes. Se continuar assim, avise quem cuida da plataforma na sua escola."
        />
      </div>
    );
  }

  const comCopy = salas.map((sala) => ({
    turma: sala.turma,
    missoes: sala.missoes
      .map((missao) => ({ estado: missao.estado, copy: copyDaMissao(missao.expId) }))
      .filter((m): m is { estado: typeof m.estado; copy: NonNullable<typeof m.copy> } =>
        m.copy !== null,
      ),
  }));

  const nenhumaMissao = comCopy.every((sala) => sala.missoes.length === 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">
          Olá, {primeiroNome(usuario.nome)}
        </h1>
        <p className="text-[14px] text-unooria-neutral-500">
          {salas.length === 0
            ? "Assim que você entrar numa turma, suas missões aparecem aqui."
            : "Estas são as missões da sua turma."}
        </p>
      </div>

      {salas.length === 0 ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Você ainda não está em uma turma"
          description="Quem coloca você na turma é a secretaria da escola. Fale com alguém de lá e suas missões aparecem aqui."
        />
      ) : nenhumaMissao ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Nenhuma missão por aqui ainda"
          description="Assim que uma missão for aberta para a sua turma, ela aparece nesta tela."
        />
      ) : (
        comCopy.map((sala) => (
          <section key={sala.turma.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-unooria-neutral-200 pb-2">
              <h2 className="text-[18px] font-bold text-unooria-neutral-950">
                Turma {sala.turma.nome}
              </h2>
              <span className="text-[13px] text-unooria-neutral-500">
                {linhaDaTurma(sala.turma)}
              </span>
            </div>

            {sala.missoes.length === 0 ? (
              <p className="text-[14px] text-unooria-neutral-500">
                Nenhuma missão por aqui ainda.
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {sala.missoes.map(({ copy, estado }) => (
                  <li key={copy.expId} className="h-full">
                    <CartaoMissaoEstudante missao={copy} estado={estado} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
