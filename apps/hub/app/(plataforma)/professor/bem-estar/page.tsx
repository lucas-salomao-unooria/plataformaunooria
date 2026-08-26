import { ExpFrame } from "@/components/ExpFrame";
import { auth } from "@/lib/auth";
import { EXP_BEM_ESTAR } from "@/lib/bem-estar";
import { montarEmbed } from "@/lib/embed-experiencia";

/**
 * **Como você está?** dentro do hub: a exp-91 (Vite, estática) embedada na
 * casca do professor — mesma sessão, mesmo token, mesma api (o desenho da
 * exp-90 em `/professor/plano-de-aula`).
 *
 * `ExpFrame` direto (sem `ExpHost`): não há aparelho nem chrome de aluno. O
 * wrapper anula o padding do layout para a experiência usar a altura toda.
 *
 * Em dev, sem manifesto: `?src=http://localhost:5176` (ou a porta registrada
 * em `lib/experiencias-dev.ts`).
 */
export default async function BemEstarPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante professor em /professor/**

  const { src } = await searchParams;
  const srcDev = process.env.NODE_ENV !== "production" ? src : undefined;
  const embed = await montarEmbed(EXP_BEM_ESTAR, usuario, { srcDev });

  return (
    <div className="-mx-5 -my-8" style={{ height: "calc(100dvh - 64px)" }}>
      <ExpFrame
        src={embed.src}
        expOrigin={embed.expOrigin}
        token={embed.token}
        aluno={embed.aluno}
        apiUrl={embed.apiUrl}
        config={{ expId: EXP_BEM_ESTAR }}
      />
    </div>
  );
}
