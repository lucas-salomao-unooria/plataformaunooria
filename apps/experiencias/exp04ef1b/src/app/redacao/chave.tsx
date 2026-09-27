import { useState } from "react";
import { Button, PuzzleBlock, PuzzleTrack, ScrollBar, SpeechBubble } from "@edu/ui/ds";
import { ICONE_DO_BLOCO } from "../../lib/meios";
import { devolver, desencaixar, encaixar, JOGADA_INICIAL, type JogadaDaChave } from "../../lib/regras";
import { E5, REDACAO } from "../../lib/textos";
import type { Bloco, IdDeBloco, TentativaDaChave } from "../../lib/tipos";
import { Cabecalho } from "./cabecalho";

/**
 * E5-ALU-01 — a Chave do Editor: o Bento reaparece, e a criança encaixa três
 * dos SEIS blocos (os três pilares e três iscas, na ordem da bandeja que a api
 * embaralhou para esta sessão) na calha (`PuzzleTrack` + `PuzzleBlock`).
 *
 * **Toque sequencial, sem arrastar**: tocar na bandeja encaixa na próxima vaga,
 * tocar na calha devolve. Com a terceira vaga cheia, a tentativa vai sozinha
 * ao `POST /chave` — "conecte os três blocos para destravar" é a instrução, e
 * um botão a mais seria um passo que a copy não tem.
 *
 * **Quem corrige é a api** (regra 3): a tela não sabe quais blocos abrem a
 * Chave. A resposta diz se abriu e QUAIS voltam à bandeja (`devolvidos`, as
 * iscas enviadas): eles saem da calha no estado `returned` — com o aviso
 * escrito, não só cor — e os outros ficam onde estavam. Cada envio conta como
 * tentativa, e o nível da EF15CO02 sai do número delas, no servidor. A criança
 * nunca vê esse número.
 *
 * Com a Chave formada, a api já pôs o passo em `revisao`; a casca segura esta
 * tela (formada, travada) até o toque em "Abrir a Mesa de Revisão".
 */
export function TelaDaChave({
  blocos,
  tamanho,
  aoTentar,
  aoIrParaRevisao,
}: {
  blocos: readonly Bloco[];
  tamanho: number;
  /** O `POST /chave`. `null` = a chamada falhou por um motivo que não se repete (a casca já tratou). */
  aoTentar: (blocos: IdDeBloco[]) => Promise<TentativaDaChave | null>;
  aoIrParaRevisao: () => void;
}) {
  const [jogada, setJogada] = useState<JogadaDaChave>(JOGADA_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [formada, setFormada] = useState(false);
  const [falhou, setFalhou] = useState(false);

  const porId = new Map(blocos.map((b) => [b.id, b]));
  const naBandeja = blocos.filter((b) => !jogada.vagas.includes(b.id));
  const devolvidos = new Set(jogada.devolvidos);

  async function tentar(vagas: IdDeBloco[], atual: JogadaDaChave) {
    setEnviando(true);
    const resposta = await aoTentar(vagas);
    setEnviando(false);
    if (!resposta) {
      /* Falha que não se repete (o relógio da turma andou): a casca relê. A
         calha volta a aceitar toques, sem o último bloco, para não reenviar sozinha. */
      setJogada(desencaixar(atual, vagas[vagas.length - 1] as IdDeBloco));
      return;
    }
    if (resposta.sucesso) {
      setFormada(true);
      setFalhou(false);
      return;
    }
    setFalhou(true);
    setJogada(devolver(atual, resposta.devolvidos));
  }

  function tocarNaBandeja(id: IdDeBloco) {
    if (enviando || formada) return;
    const nova = encaixar(jogada, id, tamanho);
    setJogada(nova);
    setFalhou(false);
    if (nova.vagas.length === tamanho) void tentar([...nova.vagas], nova);
  }

  function tocarNaCalha(id: IdDeBloco) {
    if (enviando || formada) return;
    setJogada(desencaixar(jogada, id));
    setFalhou(false);
  }

  const status = formada
    ? undefined
    : enviando
      ? E5.testando
      : falhou
        ? E5.naoAbriu(jogada.devolvidos.length)
        : E5.preenchidas(jogada.vagas.length, tamanho);

  const vagas = Array.from({ length: tamanho }, (_, i) => {
    const id = jogada.vagas[i];
    const bloco = id ? porId.get(id) : undefined;
    if (!bloco) return null;
    return (
      <PuzzleBlock
        key={bloco.id}
        label={bloco.rotulo}
        description={bloco.legenda}
        icon={ICONE_DO_BLOCO[bloco.id]}
        state={formada ? "locked" : "placed"}
        onClick={() => tocarNaCalha(bloco.id)}
      />
    );
  });

  return (
    <div className="tela">
      <Cabecalho titulo={E5.titulo} />
      <ScrollBar className="rolagem" autoHide>
        <div className="tela__corpo">
          <SpeechBubble speaker={REDACAO.bento} tone="guide">
            {formada ? E5.chaveFormada : E5.bentoAlgoritmo}
          </SpeechBubble>

          <PuzzleTrack
            label={E5.chave}
            slots={vagas}
            complete={formada}
            completeLabel={E5.chaveFormada}
            status={status}
            aria-busy={enviando || undefined}
          />

          {!formada && (
            <ul className="chave__bandeja" aria-label={E5.bandeja}>
              {naBandeja.map((b) => (
                <li key={b.id}>
                  <PuzzleBlock
                    label={b.rotulo}
                    description={b.legenda}
                    icon={ICONE_DO_BLOCO[b.id]}
                    state={devolvidos.has(b.id) ? "returned" : "idle"}
                    returnedLabel={E5.voltouParaBandeja}
                    disabled={enviando}
                    onClick={() => tocarNaBandeja(b.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </ScrollBar>
      {formada && (
        <div className="tela__acao">
          <Button size="lg" fullWidth className="acao-crianca" onClick={aoIrParaRevisao}>
            {E5.irParaRevisao}
          </Button>
        </div>
      )}
    </div>
  );
}
