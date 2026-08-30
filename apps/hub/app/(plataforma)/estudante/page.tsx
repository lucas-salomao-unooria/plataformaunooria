import { EmptyState } from "@edu/ui/ds";
import { CartaoMissaoEstudante } from "@/components/cartao-missao-estudante";
import { auth } from "@/lib/auth";
import { MISSOES_DO_ESTUDANTE } from "@/lib/missoes-do-estudante";

export const metadata = { title: "Missões — Plataforma Unooria" };

/** Primeiro nome, para o cumprimento. */
function primeiroNome(nome: string): string {
  return (nome.trim().split(/\s+/)[0] ?? "").replace(/[.,]$/, "");
}

/**
 * Hub do ESTUDANTE: a lista de missões que ele pode entrar.
 *
 * Antes o estudante caía direto na experiência da série dele; agora ele escolhe.
 * A lista não é filtrada por série hoje (ver `lib/missoes-do-estudante.ts`).
 */
export default async function HubEstudante() {
  const session = await auth();
  const usuario = session!.usuario;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-[24px] font-bold text-unooria-neutral-950">
          Olá, {primeiroNome(usuario.nome)}
        </h1>
        <p className="text-[14px] text-unooria-neutral-500">
          Escolha a missão que você vai entrar agora.
        </p>
      </div>

      {MISSOES_DO_ESTUDANTE.length === 0 ? (
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title="Nenhuma missão disponível"
          description="Assim que uma missão for liberada, ela aparece aqui."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {MISSOES_DO_ESTUDANTE.map((missao) => (
            <li key={missao.expId} className="h-full">
              <CartaoMissaoEstudante missao={missao} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
