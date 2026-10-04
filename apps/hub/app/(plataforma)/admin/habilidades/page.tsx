import { EmptyState } from "@edu/ui/ds";
import { PainelDaEscola } from "@/components/evidencias/painel-da-escola";
import { PainelDaRede } from "@/components/evidencias/painel-da-rede";
import { SeletorDaConsulta } from "@/components/evidencias/seletor-da-consulta";
import { apiDoServidor } from "@/lib/api-servidor";
import { auth } from "@/lib/auth";
import { escolaConsolidada, redeConsolidada } from "@/lib/evidencias-servidor";
import { ehDoContrato, type Papel } from "@/lib/papeis";

export const metadata = { title: "Painel de habilidades — Plataforma Unooria" };

/**
 * `/admin/habilidades` — o PAINEL DE HABILIDADES da gestão (F14.7).
 *
 * A mesma entrada no menu, duas alturas, pelo papel:
 *   - a COORDENAÇÃO DA ESCOLA lê a própria escola (H14.7.2);
 *   - a COORDENAÇÃO REGIONAL lê as escolas da regional dela, e os perfis de
 *     contrato escolhem a regional ou leem a rede inteira (H14.7.3).
 *
 * Quem decide o alcance é a api (`/evidencias/rede/consolidado` ignora o
 * `?regionalId=` da regional). O seletor de regional só existe para o
 * contrato — para a regional ele ofereceria a diretoria do vizinho.
 */
export default async function HabilidadesDaGestaoPage({
  searchParams,
}: {
  searchParams: Promise<{ regionalId?: string }>;
}) {
  const session = await auth();
  const papel = session!.usuario.papel as Papel;

  if (papel === "gestor_escola") {
    const painel = await escolaConsolidada();
    return (
      <div className="flex flex-col gap-6">
        <Cabecalho subtitulo={painel ? `${painel.escola.nome}${painel.periodo ? ` · ${painel.periodo.titulo}` : ""}` : null} />
        {painel ? (
          <PainelDaEscola painel={painel} linkDaTurma={{ prefixo: "/admin/habilidades/turmas/" }} />
        ) : (
          <Indisponivel />
        )}
      </div>
    );
  }

  const { regionalId } = await searchParams;
  const regionais = ehDoContrato(papel)
    ? ((await apiDoServidor<Array<{ id: string; nome: string }>>("/escolas?tipo=regional")) ?? [])
    : [];
  const painel = await redeConsolidada(ehDoContrato(papel) ? regionalId : undefined);

  return (
    <div className="flex flex-col gap-6">
      <Cabecalho
        subtitulo={
          painel
            ? `${painel.regional?.nome ?? "Todas as regionais"}${painel.periodo ? ` · ${painel.periodo.titulo}` : ""}`
            : null
        }
      />
      {ehDoContrato(papel) ? (
        <SeletorDaConsulta
          id="regional-do-painel"
          rotulo="Regional"
          parametro="regionalId"
          valor={regionalId ?? ""}
          opcoes={[{ value: "", label: "Todas as regionais" }, ...regionais.map((r) => ({ value: r.id, label: r.nome }))]}
        />
      ) : null}
      {painel ? <PainelDaRede painel={painel} linkDaEscola={{ prefixo: "/admin/habilidades/escolas/" }} /> : <Indisponivel />}
    </div>
  );
}

function Cabecalho({ subtitulo }: { subtitulo: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-[24px] font-bold text-unooria-neutral-950">Painel de habilidades</h1>
      {subtitulo ? <p className="text-[14px] font-semibold text-unooria-neutral-700">{subtitulo}</p> : null}
      <p className="max-w-3xl text-[14px] text-unooria-neutral-500">
        Habilidades da BNCC de Computação demonstradas nas missões, por unidade do ano. Em cada missão vale o melhor
        resultado de cada estudante entre as atividades; quem não tem registro conta como &quot;não avaliado&quot;,
        nunca como &quot;não atingiu&quot;. Sem ranking: o painel é para acompanhar e apoiar, não para comparar.
      </p>
    </div>
  );
}

function Indisponivel() {
  return (
    <EmptyState
      variant="no-data"
      size="lg"
      bordered
      fullWidth
      title="Não foi possível abrir o painel agora."
      description="Tente de novo em instantes."
    />
  );
}
