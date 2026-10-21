import { ExpFrame } from "@/components/ExpFrame";
import { auth } from "@/lib/auth";
import { montarEmbed } from "@/lib/embed-experiencia";
import { EXP_PLANO_DE_AULA } from "@/lib/plano-de-aula";

/**
 * **Gerador de Plano de Aula** dentro do hub: a app-90 (Vite, estática)
 * embedada na casca do professor. Antes era um serviço Cloud Run separado
 * aberto em nova guia; agora é a mesma sessão, o mesmo token e a mesma api.
 *
 * Renderiza o `ExpFrame` direto (sem `ExpHost`): não há viewport de aparelho
 * nem chrome de estudante, e a conclusão não é progresso de estudante. O wrapper
 * anula o padding do layout para o editor usar a altura toda.
 *
 * Em dev, sem manifesto: `?src=http://localhost:5175` (ou a porta registrada
 * em `lib/experiencias-dev.ts`).
 */
export default async function PlanoDeAulaPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string }>;
}) {
  const session = await auth();
  const usuario = session!.usuario; // middleware garante professor em /professor/**

  const { src } = await searchParams;
  const srcDev = process.env.NODE_ENV !== "production" ? src : undefined;
  const embed = await montarEmbed(EXP_PLANO_DE_AULA, usuario, { srcDev });

  return (
    <div className="-mx-5 -mb-8 tela-cheia">
      {/* `tela-cheia` (em `@edu/ui/styles/plataforma.css`) faz o `main` distribuir
          a altura por flex; as margens negativas devolvem o padding que ele
          reserva. NÃO volte a `calc(100dvh - 64px)`: o header mede 65px com a
          borda, e o 1px que sobrava punha uma barra de rolagem parada na tela.
          `-mb-8` e não `-my-8`: o padding de CIMA ficou, porque agora é onde a
          trilha do layout desenha. Quem distribui o resto continua sendo o flex
          — não subtraia a altura da trilha na mão. */}
      <ExpFrame
        src={embed.src}
        expOrigin={embed.expOrigin}
        token={embed.token}
        estudante={embed.estudante}
        apiUrl={embed.apiUrl}
        config={{ expId: EXP_PLANO_DE_AULA, obs: embed.obs }}
        /**
         * As permissões de iframe do manifesto (`allow-downloads` aqui). Esta
         * linha faltava, e a consequência não aparecia em lugar nenhum: o
         * `ExpFrame` recebia `permissoes` undefined, montava o sandbox sem
         * `allow-downloads`, e o "Baixar .doc" do professor não fazia nada —
         * sem erro na tela e sem linha no console. `/exp/[expId]` e
         * `/dev-embed` sempre repassaram; as três rotas de professor, não.
         */
        permissoes={embed.permissoes}
        titulo={embed.manifesto?.nome}
      />
    </div>
  );
}
