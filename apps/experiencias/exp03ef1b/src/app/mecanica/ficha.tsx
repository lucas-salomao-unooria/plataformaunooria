import { Card, PuzzleBlock, PuzzleTrack, Tag } from "@edu/ui/ds";
import type { ReactNode } from "react";
import { CAMPOS, type Campo } from "../../lib/tipos";
import { E4, ROTULO_DO_CAMPO } from "../../lib/textos";
import { Icone } from "../comum/icone";

/** O conteúdo de um campo: o valor (bloco travado), uma etiqueta móvel, ou vazio. */
export type ConteudoDoCampo =
  | { tipo: "valor"; rotulo: string }
  | { tipo: "etiqueta"; rotulo: string; icone: Campo }
  | { tipo: "vazio" };

/**
 * A FICHA de uma reportagem: os três campos (Quem, Onde, Quando), cada um
 * uma calha de UMA vaga — `PuzzleTrack` com o rótulo do campo e o ícone dele.
 * É a mesma peça em três lugares: a gaveta da E4-01 (só leitura, o Onde
 * vazio "Campo vazio"), a ficha do reparo da E4-03 (as vagas acionáveis: toca
 * a etiqueta, toca o campo) e o Desafio Extra (só leitura). Só `@edu/ui/ds`.
 *
 * `vazioEmDestaque` é o Onde da gaveta: a calha com fio forte (`.campo--vazio`).
 */
export function FichaDeCampos({
  titulo,
  etiqueta,
  campos,
  acionavel = false,
  esperandoToque = false,
  destacarVazio = false,
  compacta = false,
  aoTocarCampo,
  aoTirar,
}: {
  titulo?: ReactNode;
  /** A etiqueta do suporte no canto ("TELÃO"). */
  etiqueta?: string;
  campos: Readonly<Record<Campo, ConteudoDoCampo>>;
  acionavel?: boolean;
  esperandoToque?: boolean;
  destacarVazio?: boolean;
  /** Blocos `sm` (só leitura, sem alvo de toque): o Desafio Extra, em duas colunas na janela. */
  compacta?: boolean;
  aoTocarCampo?: (c: Campo) => void;
  aoTirar?: (c: Campo) => void;
}) {
  return (
    <Card variant="outlined" className="ficha">
      {titulo ? (
        <div className="ficha__cabeca">
          <h2 className="ficha__titulo">{titulo}</h2>
          {etiqueta ? (
            <Tag variant="neutral" size="sm">
              {etiqueta}
            </Tag>
          ) : null}
        </div>
      ) : null}
      <div className="ficha__campos">
        {CAMPOS.map((campo) => {
          const conteudo = campos[campo];
          const vazio = conteudo.tipo === "vazio";
          return (
            <PuzzleTrack
              key={campo}
              className={`campo${vazio && destacarVazio ? " campo--vazio" : ""}`}
              label={
                <span className="campo__rotulo">
                  <Icone nome={campo} tamanho={16} />
                  {acionavel ? ROTULO_DO_CAMPO[campo] : E4.campo(ROTULO_DO_CAMPO[campo])}
                </span>
              }
              showEmptySlotLabel
              emptySlotLabel={() => (acionavel ? E4.colocarEm(ROTULO_DO_CAMPO[campo]) : E4.campoVazio)}
              onSlotActivate={acionavel ? () => aoTocarCampo?.(campo) : undefined}
              slotsDisabled={acionavel && !esperandoToque}
              slots={[
                conteudo.tipo === "vazio" ? null : (
                  <PuzzleBlock
                    size={compacta ? "sm" : "md"}
                    label={
                      conteudo.tipo === "etiqueta" ? (
                        <span className="rotulo-com-icone">
                          <Icone nome={conteudo.icone} tamanho={18} />
                          {conteudo.rotulo}
                        </span>
                      ) : (
                        conteudo.rotulo
                      )
                    }
                    state={conteudo.tipo === "etiqueta" ? "placed" : "locked"}
                    onClick={conteudo.tipo === "etiqueta" ? () => aoTirar?.(campo) : undefined}
                    className="campo__bloco"
                  />
                ),
              ]}
            />
          );
        })}
      </div>
    </Card>
  );
}
