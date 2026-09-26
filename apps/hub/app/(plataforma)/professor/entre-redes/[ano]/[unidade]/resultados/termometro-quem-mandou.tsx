"use client";

import { ProgressBar, Table, type TableColumn } from "@edu/ui/ds";
import { percentualComBase, rotuloDaOpcao } from "@/lib/quem-mandou-regras";
import type { OpcaoDaMissao, TermometroDaTurma } from "@/lib/quem-mandou-tipos";

type LinhaDoCruzamento = { motivo: string; rotulo: string; unidades: number; comFalsaNeutra: number };

/**
 * O TERMÔMETRO DA TURMA (E4-PROF-01) — o que se projeta na parede depois da
 * revelação. Usado duas vezes: no painel e na janela "Projetar o Termômetro".
 *
 * **Nenhum nome, por construção**: o que chega aqui é a conta da api
 * (`regras/termometro.ts`), cuja assinatura não tem lugar para quem
 * encaminhou. As duas barras são as da especificação: % das unidades que
 * encaminharam ao menos uma falsa neutra, e % das verdadeiras emocionais que
 * ficaram de fora — (2·N − encaminhadas) / (2·N). Os 68% e 54% dos artefatos
 * eram wireframe.
 *
 * **Sem base, sem percentual.** Com ninguém que confirmou o Mural, "0%" diria
 * que ninguém caiu, quando ninguém jogou: a tela escreve "sem dados".
 *
 * As barras são o `ProgressBar` do DS (medida com rótulo e valor na mesma
 * linha); o cruzamento motivo × falsa neutra é a `Table` do DS, sem coluna
 * ordenável — ordem é a da enquete, não de quem "errou mais".
 */
export function TermometroQuemMandou({
  termometro,
  motivos,
  porComputador,
  grande = false,
}: {
  termometro: TermometroDaTurma;
  /** Os rótulos da enquete, como a criança os leu (vêm da api). */
  motivos: readonly OpcaoDaMissao[];
  porComputador: boolean;
  /** A versão do telão: letra maior, para ler do fundo da sala. */
  grande?: boolean;
}) {
  const base = termometro.unidades;
  const unidade = porComputador ? (base === 1 ? "computador" : "computadores") : base === 1 ? "estudante" : "estudantes";
  const falsaNeutra = percentualComBase(base, termometro.falsaNeutra.percentual);
  const verdadeiraEmocional = percentualComBase(
    termometro.verdadeiraEmocionalDescartada.total,
    termometro.verdadeiraEmocionalDescartada.percentual,
  );
  const tamanhoDoRotulo = grande ? "text-[22px]" : "text-[14px]";

  const linhas: LinhaDoCruzamento[] = termometro.motivos.map((m) => ({
    ...m,
    rotulo: rotuloDaOpcao(motivos, m.motivo) ?? m.motivo,
  }));
  const colunas: TableColumn<LinhaDoCruzamento>[] = [
    { key: "rotulo", title: "O que pesou na escolha", minWidth: 220 },
    { key: "unidades", title: porComputador ? "Computadores que votaram" : "Votaram", align: "right" },
    {
      key: "comFalsaNeutra",
      title: "Desses, encaminharam falsa neutra",
      align: "right",
    },
  ];

  return (
    <div className="flex flex-col gap-5" data-termometro>
      <p className={`${grande ? "text-[20px]" : "text-[13px]"} text-unooria-neutral-600`}>
        {base} {unidade} {base === 1 ? "confirmou" : "confirmaram"} o Mural
      </p>

      {base === 0 ? (
        <p className={`${tamanhoDoRotulo} font-semibold text-unooria-neutral-800`} data-sem-dados>
          Sem dados: ninguém confirmou o Mural ainda.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className={`${tamanhoDoRotulo} font-semibold text-unooria-neutral-950`}>
              Mensagens falsas repassadas que tinham formato sério ou neutro
            </p>
            {falsaNeutra === null ? (
              <p className="text-[13px] text-unooria-neutral-600">sem dados</p>
            ) : (
              <ProgressBar
                value={falsaNeutra}
                max={100}
                size={grande ? "lg" : "md"}
                variant="primary"
                showValue
                valuePosition="bottom"
                valueFormatter={() =>
                  `${falsaNeutra}% da turma repassou (${termometro.falsaNeutra.unidades} de ${base})`
                }
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className={`${tamanhoDoRotulo} font-semibold text-unooria-neutral-950`}>
              Mensagens verdadeiras descartadas por parecerem exageradas
            </p>
            {verdadeiraEmocional === null ? (
              <p className="text-[13px] text-unooria-neutral-600">sem dados</p>
            ) : (
              <ProgressBar
                value={verdadeiraEmocional}
                max={100}
                size={grande ? "lg" : "md"}
                variant="primary"
                showValue
                valuePosition="bottom"
                valueFormatter={() =>
                  `${verdadeiraEmocional}% ficaram de fora (${termometro.verdadeiraEmocionalDescartada.descartadas} de ${termometro.verdadeiraEmocionalDescartada.total})`
                }
              />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className={`${tamanhoDoRotulo} font-semibold text-unooria-neutral-950`}>
              Comparativo: o que a turma pensou que seguiu versus o que repassou
            </p>
            <Table<LinhaDoCruzamento>
              columns={colunas}
              data={linhas}
              keyExtractor={(linha) => linha.motivo}
              emptyText="Ninguém votou na enquete ainda."
              size={grande ? "lg" : "md"}
              theme="light"
            />
          </div>
        </>
      )}

      <p className="text-[12px] leading-snug text-unooria-neutral-500">
        As escolhas foram reunidas sem nome: não há como saber quem encaminhou o quê.
      </p>
    </div>
  );
}
