import { Card, Icon, PuzzleBlock, PuzzleTrack } from "@edu/ui/ds";
import { E2 } from "../../lib/textos";
import { Icone } from "../comum/icone";

export interface NoticiaDaBandeja {
  id: string;
  rotulo: string;
  curto: string;
}

/**
 * A escolha da E2 (a previsão): a bandeja "Notícias da feira" e a
 * "Caixa de resultados esperados", com três nichos. Mecânica da missão: só
 * `@edu/ui/ds` (`Card`, `PuzzleBlock`, `PuzzleTrack`).
 *
 * TOQUE, sem arraste (spec §0.2): tocar a notícia na bandeja a põe no
 * primeiro nicho vazio; tocar a notícia na caixa a devolve. Travada, os
 * blocos ficam `locked` (focáveis e legíveis, sem resposta ao toque).
 */
export function BandejaDaEscolha({
  noticias,
  naCaixa,
  travada,
  aoTocar,
  rodape,
}: {
  noticias: readonly NoticiaDaBandeja[];
  naCaixa: readonly string[];
  travada: boolean;
  aoTocar: (id: string) => void;
  rodape?: React.ReactNode;
}) {
  const fora = noticias.filter((n) => !naCaixa.includes(n.id));
  return (
    <Card variant="outlined" className={`bandeja${travada ? " bandeja--apagada" : ""}`}>
      <h2 className="rotulo-de-secao">{E2.bandeja}</h2>
      {fora.length === 0 && !travada ? <p className="bandeja__vazia">{E2.bandejaVazia}</p> : null}
      <ul className="bandeja__lista">
        {travada
          ? null
          : fora.map((n) => (
              <li key={n.id}>
                <PuzzleBlock label={n.rotulo} icon="newspaper" state="idle" onClick={() => aoTocar(n.id)} />
              </li>
            ))}
      </ul>
      <div className="bandeja__rodape">{rodape ?? (travada ? null : <p className="ajuda">{E2.bandejaAjuda}</p>)}</div>
    </Card>
  );
}

export function CaixaDaEscolha({
  caixa,
  noticias,
  travada,
  aoTirar,
  status,
  acao,
}: {
  caixa: readonly (string | null)[];
  noticias: readonly NoticiaDaBandeja[];
  travada: boolean;
  aoTirar: (id: string) => void;
  status?: string;
  acao: React.ReactNode;
}) {
  const rotulo = (
    <span className="caixa__rotulo">
      <span className="rotulo-de-secao">{E2.caixa}</span>
      <span className="caixa__busca" aria-label={`Busca: ${E2.busca}`}>
        <Icone nome="lupa" tamanho={16} />
        <Icone nome="onde" tamanho={16} />
        {E2.busca}
      </span>
    </span>
  );
  return (
    <div className={`caixa${travada ? " caixa--travada" : ""}`}>
      <PuzzleTrack
        label={rotulo}
        className="caixa__trilho"
        showEmptySlotLabel
        emptySlotLabel={(i) => (
          <span className="caixa__nicho-vazio">
            <span>{E2.vaga(i)}</span>
            <small>Vazio</small>
          </span>
        )}
        status={status}
        slots={caixa.map((id) => {
          if (!id) return null;
          const n = noticias.find((x) => x.id === id);
          if (!n) return null;
          return (
            <PuzzleBlock
              size="sm"
              label={n.curto}
              description={
                <span className="caixa__lugar">
                  <Icone nome="onde" tamanho={14} />
                  {E2.busca}
                </span>
              }
              icon="newspaper"
              state={travada ? "locked" : "placed"}
              onClick={() => !travada && aoTirar(id)}
            />
          );
        })}
      />
      <div className="caixa__acao">{acao}</div>
    </div>
  );
}

/**
 * O "vidro" sobre a caixa travada (E2, depois do latch): o cadeado, "Escolha
 * travada!" e a espera pelo filtro — sem botão (spec §1).
 * (b) COMPENSAÇÃO — sem par no DS: posição e véu com token (`.vidro`).
 */
export function VidroDaEscolha({ titulo, linhas }: { titulo: string; linhas: readonly string[] }) {
  return (
    <div className="vidro" role="status">
      <Icon name="lock" size="xl" />
      <strong className="vidro__titulo">{titulo}</strong>
      {linhas.map((l) => (
        <span key={l} className="vidro__apoio">
          {l}
        </span>
      ))}
    </div>
  );
}
