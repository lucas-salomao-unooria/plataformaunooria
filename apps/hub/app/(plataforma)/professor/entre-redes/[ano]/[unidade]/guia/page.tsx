import { notFound } from "next/navigation";

import { Card, ScrollBar } from "@edu/ui/ds";
import { GuiaDaAula } from "@/components/guia/guia-da-aula";
import { apiDoServidor } from "@/lib/api-servidor";
import {
  buscarMissao,
  rotaDaMissao,
  rotuloDaMissao,
  MISSAO_ATUAL,
  MISSAO_ECO_NO_GRUPO,
  MISSAO_RASTRO_BOATO,
  MISSAO_UNOOGPT,
} from "@/lib/entre-redes/catalogo";
import { buscarGuia } from "@/lib/entre-redes/guias";
import type { BlocosVivos } from "@/lib/entre-redes/guias/tipos";

import { IntervencoesDoEco, type MaterialDoEco } from "./intervencoes-do-eco";
import { IntervencoesDoRastro, type MaterialDoRastro } from "./intervencoes-do-rastro";
import { MomentosDoPainel } from "./momentos-do-painel";
import { TelasDaRevelacao } from "./telas-da-revelacao";

/**
 * O guia da aula de uma missão do Entre Redes — DESPACHANTE, como `page.tsx`
 * da missão.
 *
 * Era uma página só, do Instanooria, com 447 linhas de conteúdo em JSX e um
 * `notFound()` para qualquer outro `expId`. Agora o conteúdo é dado
 * (`lib/entre-redes/guias/`) e a ordem é do renderizador
 * (`components/guia/`); o que sobra aqui é o que só esta rota sabe: quais
 * BLOCOS VIVOS cada missão injeta.
 *
 * Bloco vivo é o que tem fonte de verdade em outro lugar e não pode virar texto.
 * Cinco missões têm um: os momentos e as telas da revelação do Instanooria, a
 * tabela dos vieses do unooGPT, os 21 vídeos do UnooTube, as intervenções do
 * Rastro do Boato e as do Eco no Grupo — as quatro últimas vindas da api. Ver
 * a nota em `guias/tipos.ts`.
 *
 * **Missão com conteúdo que a turma LÊ na tela não descreve esse conteúdo no
 * guia: injeta um bloco vivo.** A prosa diverge — a do UnooTube dizia "metade…
 * a outra metade" quando a divisão real do catálogo é 11 e 10 —, e o professor
 * conduz o debate com palavras que ninguém viu.
 */

/** O que a api devolve em GET /unoogpt/professor/fontes. */
type RespostaFontes = {
  fontes: Array<{
    slug: string;
    nome: string;
    periodo: string;
    serve: string;
    vies: string;
    cobre: string[];
  }>;
};

const NOME_DO_BAIRRO: Record<string, string> = {
  ribeirinha: "Ribeirinha",
  valeverde: "Vale Verde",
  morroalto: "Morro Alto",
  industrial: "Industrial",
};

export default async function GuiaPage({
  params,
}: {
  params: Promise<{ ano: string; unidade: string }>;
}) {
  // O middleware já garante sessão de professor em /professor/**.
  const { ano: anoSlug, unidade: unidadeSlug } = await params;

  const encontrado = buscarMissao(anoSlug, unidadeSlug);
  // Unidade "em breve" não tem aula para guiar; missão publicada sem guia
  // escrito também cai aqui — e o teste de `guias/index.test.ts` existe para
  // que esse segundo caso nunca chegue à produção.
  if (!encontrado || encontrado.missao.status !== "disponivel") notFound();
  const { ano, missao } = encontrado;
  const guia = missao.expId ? buscarGuia(missao.expId) : null;
  if (!guia || !missao.ficha) notFound();

  const blocos = await blocosDaMissao(missao.expId);

  return (
    <GuiaDaAula
      guia={guia}
      trilha={[
        { label: "Início", href: "/professor" },
        { label: "Entre Redes", href: "/professor/entre-redes" },
        { label: rotuloDaMissao(ano, missao), href: rotaDaMissao(missao) },
        { label: "Guia da aula" },
      ]}
      cabecalho={{
        missao: missao.titulo,
        contexto: rotuloDaMissao(ano, missao),
        duracao: missao.ficha.duracao,
      }}
      voltar={{ href: rotaDaMissao(missao), rotulo: "Voltar para a missão" }}
      blocos={blocos}
    />
  );
}

/**
 * Quais BLOCOS VIVOS cada missão injeta, e em que seção.
 *
 * Era um ternário aninhado com duas missões. Com cinco ele deixaria de ser
 * legível — e a sexta seria a que alguém acrescenta no ramo errado.
 *
 * As cinco chamadas de api são SEQUENCIAIS de propósito: cada render atende a
 * uma missão só, então nunca há duas para paralelizar. `apiDoServidor` devolve
 * `null` em falha (com a linha de log), e cada bloco tem o próprio cartão de
 * "não carregou" — o guia abre inteiro mesmo com a api fora, porque as outras
 * nove seções dele continuam servindo.
 */
async function blocosDaMissao(expId: string | undefined): Promise<BlocosVivos | undefined> {
  switch (expId) {
    case MISSAO_ATUAL.expId:
      return { antes: <MomentosDoPainel />, mediacao: <TelasDaRevelacao /> };

    case MISSAO_UNOOGPT.expId:
      return { debate: await tabelaDeVieses() };

    case MISSAO_RASTRO_BOATO.expId:
      return {
        debate: (
          <IntervencoesDoRastro
            dados={await apiDoServidor<MaterialDoRastro>("/rastro-boato/professor/material")}
          />
        ),
      };

    case MISSAO_ECO_NO_GRUPO.expId:
      return {
        debate: (
          <IntervencoesDoEco
            dados={await apiDoServidor<MaterialDoEco>("/o-eco-no-grupo/professor/material")}
          />
        ),
      };

    default:
      return undefined;
  }
}

/**
 * As 8 fontes do unooGPT e o viés de cada uma — o material do debate daquela
 * missão, que a experiência nunca revela.
 *
 * Vem da api (`/unoogpt/professor/fontes`, professor-only) e não de uma cópia
 * aqui: os textos são derivados da MESMA instrução que o agente recebe, e uma
 * cópia desatualizada faria o professor contar à turma um viés que o cenário já
 * não produz.
 */
async function tabelaDeVieses() {
  const resposta = await apiDoServidor<RespostaFontes>("/unoogpt/professor/fontes");
  const fontes = resposta?.fontes ?? [];

  if (fontes.length === 0) {
    return (
      <div className="guia-bloco">
        <Card variant="outlined" title="A tabela dos vieses não carregou">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            Atualize esta página antes da aula. O debate desta missão depende dela: é a única
            superfície em que o viés de cada fonte é dito com todas as letras, e a experiência
            do estudante não o revela em nenhum momento.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="guia-bloco guia-bloco--longo">
      <Card variant="elevated" title="As 8 fontes e o viés de cada uma — só para você">
        <p className="text-[13px] leading-relaxed text-unooria-neutral-800">
          <strong>Não projete esta tabela</strong> e não a entregue impressa à turma. Puxe uma
          fonte por vez no debate, sempre começando por como ela foi PRODUZIDA — “quem mediu
          isso? quando? o que esse instrumento consegue ver?” — e deixe a turma deduzir o resto.
          Deduzido vale muito mais que contado.
        </p>
        <ScrollBar orientation="horizontal" autoHide className="mt-4">
          {/* Rolagem lateral da tabela larga pelo `ScrollBar` do DS: em tela estreita a
              tabela do guia passa da coluna, e a barra some quando ninguém a usa. */}
            <table className="w-full min-w-[680px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-unooria-neutral-500">
                  <th className="w-44 py-2 font-semibold">Fonte</th>
                  <th className="py-2 font-semibold">O que ela mostra</th>
                  <th className="py-2 font-semibold">Em que ela engana</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {fontes.map((fonte) => (
                  <tr key={fonte.slug} className="border-t border-unooria-neutral-200">
                    <td className="py-2.5 pr-3">
                      <span className="block font-semibold text-unooria-neutral-950">
                        {fonte.nome}
                      </span>
                      <span className="mt-1 block text-[11px] text-unooria-neutral-500">
                        {fonte.periodo}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 leading-relaxed text-unooria-neutral-800">
                      {fonte.serve}
                      <span className="mt-1 block text-[11px] text-unooria-neutral-500">
                        cobre:{" "}
                        {fonte.cobre.length === 0
                          ? "nenhum bairro"
                          : fonte.cobre
                              .map((bairro) => NOME_DO_BAIRRO[bairro] ?? bairro)
                              .join(", ")}
                      </span>
                    </td>
                    <td className="py-2.5 leading-relaxed text-unooria-neutral-800">
                      {fonte.vies}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </ScrollBar>
      </Card>
    </div>
  );
}
