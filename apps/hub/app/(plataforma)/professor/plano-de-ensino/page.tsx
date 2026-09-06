import { ExpFrame } from "@/components/ExpFrame";
import { auth } from "@/lib/auth";
import { montarEmbed } from "@/lib/embed-experiencia";
import { EXP_PLANO_DE_ENSINO } from "@/lib/plano-de-ensino";

/**
 * **Planejamento de Ensino** dentro do hub: a exp-92 (Vite, estática) embedada
 * na casca do professor.
 *
 * Renderiza o `ExpFrame` direto (sem `ExpHost`): não há viewport de aparelho nem
 * chrome de estudante, e a conclusão não é progresso de estudante — é o mesmo
 * arranjo de `/professor/plano-de-aula`. O wrapper anula o padding do layout
 * para o planejamento usar a altura toda.
 *
 * Em dev, sem manifesto: `?src=http://localhost:5180` (a porta registrada em
 * `lib/experiencias-dev.ts`).
 */
export default async function PlanoDeEnsinoPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante professor em /professor/**

  const { src } = await searchParams;
  const srcDev = process.env.NODE_ENV !== "production" ? src : undefined;
  const embed = await montarEmbed(EXP_PLANO_DE_ENSINO, usuario, { srcDev });

  return (
    <div className="-mx-5 -my-8" style={{ height: "calc(100dvh - 64px)" }}>
      <ExpFrame
        src={embed.src}
        expOrigin={embed.expOrigin}
        token={embed.token}
        estudante={embed.estudante}
        apiUrl={embed.apiUrl}
        config={{ expId: EXP_PLANO_DE_ENSINO, obs: embed.obs }}
      />
    </div>
  );
}
