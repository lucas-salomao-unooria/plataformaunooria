import { Card, PuzzleBlock, PuzzleTrack } from "@edu/ui/ds";
import type { ReactNode } from "react";
import type { Bloco, BlocoPublico } from "../../lib/tipos";
import { E5 } from "../../lib/textos";
import type { Arrastavel } from "../comum/arrastar";
import { Icone } from "../comum/icone";

function RotuloDoBloco({ bloco, rotulo }: { bloco: Bloco; rotulo: string }) {
  return (
    <span className="rotulo-com-icone">
      <Icone nome={bloco} tamanho={20} />
      {rotulo}
    </span>
  );
}

/**
 * A bandeja dos blocos da rotina (E5-ALU-01), na ordem EMBARALHADA que o
 * servidor mandou — a tela nunca reordena. Toque sequencial (toca o bloco,
 * que fica `selected`, e toca a vaga da esteira) OU arraste até a vaga
 * (ADR-201). Só `@edu/ui/ds`.
 */
export function BandejaDeBlocos({
  blocos,
  naEsteira,
  escolhido,
  aoEscolher,
  arrastavel,
  status,
}: {
  blocos: readonly BlocoPublico[];
  naEsteira: readonly (string | null)[];
  escolhido: string | null;
  aoEscolher: (id: string) => void;
  arrastavel?: Arrastavel;
  status: string;
}) {
  const livres = blocos.filter((b) => !naEsteira.includes(b.id));
  return (
    <Card variant="outlined" className="blocos" data-soltar="bandeja">
      <h2 className="rotulo-de-secao">{E5.bandeja}</h2>
      <ul className="blocos__lista">
        {livres.map((b) => (
          <li key={b.id}>
            <PuzzleBlock
              label={<RotuloDoBloco bloco={b.bloco} rotulo={b.rotulo} />}
              state="idle"
              selected={escolhido === b.id}
              onClick={() => aoEscolher(b.id)}
              {...arrastavel?.(b.id)}
            />
          </li>
        ))}
      </ul>
      <p className="ajuda" aria-live="polite">
        {status}
      </p>
    </Card>
  );
}

/**
 * A esteira da rotina: `PuzzleTrack` de sete vagas, com o recuo de cada vaga
 * (ENQUANTO > Pegar, SE > ok, SENÃO > revisar, FIM — spec §1). O recuo é
 * (b) COMPENSAÇÃO — sem par no DS: a calha não tem aninhamento; a margem por
 * vaga (`globals.css`, `.esteira__trilho`, o desenho de `regras.ts#RECUO_DA_VAGA`)
 * é só posição. `ativo` acende o bloco que a simulação está
 * executando (`selected`, contorno de 2px + glifo, sem cor de certo/errado).
 */
export function EsteiraDaRotina({
  blocos,
  esteira,
  executando,
  ativo,
  temEscolhido,
  aoSoltar,
  aoTirar,
  arrastavel,
  acoes,
}: {
  blocos: readonly BlocoPublico[];
  esteira: readonly (string | null)[];
  executando: boolean;
  ativo: string | null;
  temEscolhido: boolean;
  aoSoltar: (vaga: number) => void;
  aoTirar: (vaga: number) => void;
  arrastavel?: Arrastavel;
  acoes: ReactNode;
}) {
  return (
    <div className="esteira">
      <PuzzleTrack
        label={executando ? E5.esteiraExecutando : E5.esteira}
        className="esteira__trilho"
        data-soltar="esteira"
        showEmptySlotLabel
        emptySlotLabel={(i) => E5.vagaVazia(i)}
        onSlotActivate={executando ? undefined : aoSoltar}
        slotsDisabled={!temEscolhido}
        slots={esteira.map((id, vaga) => {
          const b = id ? blocos.find((x) => x.id === id) : undefined;
          if (!b) return null;
          return (
            <PuzzleBlock
              label={<RotuloDoBloco bloco={b.bloco} rotulo={b.rotulo} />}
              state={executando ? "locked" : "placed"}
              selected={executando ? ativo === b.id : undefined}
              onClick={executando ? undefined : () => aoTirar(vaga)}
              {...(executando ? {} : arrastavel?.(b.id))}
            />
          );
        })}
      />
      <div className="esteira__acoes">{acoes}</div>
    </div>
  );
}

/** A ficha que a simulação está testando (E5-ALU-01, executando): manchete, o Onde e a marca. */
export function FichaEmTeste({
  titulo,
  manchete,
  onde,
  marca,
}: {
  titulo: string;
  manchete: string;
  onde: string;
  marca: string;
}) {
  return (
    <Card variant="outlined" className="ficha-em-teste">
      <p className="rotulo-de-secao">{titulo}</p>
      <div className="ficha-em-teste__papel">
        <strong>{manchete}</strong>
        <span>{onde}</span>
        <span className="ficha-em-teste__marca">
          <Icone nome={marca === E5.marcaRevisar ? "revisar" : "ok"} tamanho={16} />
          {marca}
        </span>
      </div>
    </Card>
  );
}
