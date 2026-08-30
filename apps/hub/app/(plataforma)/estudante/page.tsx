import { EmptyState } from "@edu/ui/ds";
import { CartaoMissaoAluno } from "@/components/cartao-missao-aluno";
import { auth } from "@/lib/auth";
import { MISSOES_DO_ALUNO } from "@/lib/missoes-do-aluno";

export const metadata = { title: "Missões — Plataforma Unooria" };

/** Primeiro nome, para o cumprimento. */
function primeiroNome(nome: string): string {
  return (nome.trim().split(/\s+/)[0] ?? "").replace(/[.,]$/, "");
}

/**
 * Hub do ALUNO: a lista de missões que ele pode entrar.
 *
 * Antes o aluno caía direto na experiência da série dele; agora ele escolhe.
 * A lista não é filtrada por série hoje (ver `lib/missoes-do-aluno.ts`).
 */
export default async function HubAluno() {
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

      {MISSOES_DO_ALUNO.length === 0 ? (
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
          {MISSOES_DO_ALUNO.map((missao) => (
            <li key={missao.expId} className="h-full">
              <CartaoMissaoAluno missao={missao} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
