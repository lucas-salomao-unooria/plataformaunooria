import { notFound } from "next/navigation";

import { EmptyState } from "@edu/ui/ds";
import { LinkButton } from "@/components/link-button";
import {
  MISSAO_ECO_NO_GRUPO,
  MISSAO_RASTRO_BOATO,
  MISSAO_UNOOGPT,
  MISSAO_UNOOTUBE,
  buscarMissao,
  rotuloDaMissao,
} from "@/lib/entre-redes/catalogo";

import { MissaoInstanooria } from "./missao-instanooria";
import { MissaoOEcoNoGrupo } from "./missao-o-eco-no-grupo";
import { MissaoRastroBoato } from "./missao-rastro-boato";
import { MissaoUnooGPT } from "./missao-unoogpt";
import { MissaoUnooTube } from "./missao-unootube";

/**
 * Página de uma missão do Entre Redes — DESPACHANTE por `missao.expId`.
 *
 * Cada missão publicada tem o próprio corpo: o Instanooria configura
 * atividades e tem guia; o UnooTube é conteúdo fixo e só mostra resultados; o
 * unooGPT tem uma ação AO VIVO (a largada do relógio da turma) e sem ela a aula
 * não começa. Unidades "em breve" continuam com o aviso honesto abaixo.
 */
export default async function MissaoPage({
  params,
}: {
  params: Promise<{ ano: string; unidade: string }>;
}) {
  const { ano: anoSlug, unidade: unidadeSlug } = await params;

  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  if (!encontrado) notFound();
  const { ano, missao } = encontrado;

  // Unidade sem conteúdo acessada pela URL: a trilha não linka para cá, mas o
  // endereço é adivinhável. Melhor dizer o que é do que devolver um 404 seco.
  if (missao.status === "em-breve" || !missao.ficha) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          variant="no-data"
          size="lg"
          bordered
          fullWidth
          title={`${rotuloDaMissao(ano, missao)} ainda está em produção`}
          description="Assim que esta missão for publicada ela aparece na trilha do Entre Redes, pronta para configurar."
        />
        <div>
          <LinkButton href="/professor/entre-redes" variant="secondary">
            Voltar para a trilha
          </LinkButton>
        </div>
      </div>
    );
  }

  const comFicha = { ...missao, ficha: missao.ficha };
  if (missao.expId === MISSAO_UNOOTUBE.expId) {
    return <MissaoUnooTube ano={ano} missao={comFicha} />;
  }
  if (missao.expId === MISSAO_UNOOGPT.expId) {
    return <MissaoUnooGPT ano={ano} missao={comFicha} />;
  }
  if (missao.expId === MISSAO_ECO_NO_GRUPO.expId) {
    return <MissaoOEcoNoGrupo ano={ano} missao={comFicha} />;
  }
  if (missao.expId === MISSAO_RASTRO_BOATO.expId) {
    return <MissaoRastroBoato ano={ano} missao={comFicha} />;
  }
  return <MissaoInstanooria ano={ano} missao={comFicha} />;
}
