import { useMemo, useState } from "react";
import { AlertBox, Button, Modal, PuzzleBlock, PuzzleTrack, RadioGroup, ScrollBar, SpeechBubble } from "@edu/ui/ds";
import { gravarMemoria, lerMemoria } from "../../lib/memoria";
import { ICONE_DO_BLOCO } from "../../lib/meios";
import {
  blocosNasVagas,
  corpoDaChave,
  marcarLado,
  marcarRepeticao,
  marcarSeFalhar,
  montagemValida,
  montagemVazia,
  porNaVaga,
  proximaVagaLivre,
  tirarDaVaga,
  type MontagemDaChave,
} from "../../lib/regras";
import { E5, REDACAO } from "../../lib/textos";
import type { BlocoDaChave, CorpoDaChave, IdDeBloco, LadoDaCondicao, Repeticao, SeFalhar } from "../../lib/tipos";
import { Cabecalho } from "./cabecalho";

/**
 * A ordem das opções na tela: a mesma em todo cartão e em toda vaga (a posição
 * não diz nada). Os lados saem do `Record` de rótulos, e não de uma lista
 * escrita aqui: `["aprova", "reprova"]` no bundle teria, letra por letra, a
 * forma do `LADO_CERTO` da api — e o grep do `dist/` precisa poder provar que
 * não há gabarito nele.
 */
const LADOS = Object.keys(E5.lado) as LadoDaCondicao[];
const SE_FALHAR: readonly SeFalhar[] = ["parar", "seguir"];
const REPETICOES: readonly Repeticao[] = ["todas", "so_a_primeira"];

/**
 * E5 — a Chave do Editor, o MONTADOR (3.0.0, ADR-168). O Bento reaparece, e a
 * dupla monta a regra dela: escolhe três dos SEIS blocos (três pilares e três
 * iscas, na ordem da bandeja que a api embaralhou para esta sessão), põe cada
 * um numa vaga ORDENADA (1º, 2º, 3º passo), decide para cada um dos dois
 * cartões do bloco se a pista PASSA ou FALHA, o que fazer "se esta pista
 * falhar" e, no rodapé, se os passos valem para TODAS as notícias.
 *
 * **Só toques, sem arrastar**: toque no bloco (fica escolhido) e depois na
 * vaga ("Colocar aqui"), ou "Adicionar na próxima vaga"; tocar no bloco de uma
 * vaga cheia o devolve à bandeja (e as escolhas dele vão junto).
 *
 * **Um envio, sem correção.** O "Pronto" só acende com tudo escolhido
 * (`regras.ts#corpoDaChave`), pede confirmação ("Depois de enviar, a Chave não
 * muda") e manda o `POST chave`. A resposta NÃO diz se a Chave está certa — a
 * tela não sabe quais blocos são pilares nem de que lado fica cada cartão
 * (regra 3) — e não há "devolvidos" nem nova tentativa: a Chave errada segue
 * para a revisão e para a simulação, onde ela é TESTADA, não corrigida.
 *
 * **Os cartões vêm na ordem embaralhada** (`sessao.blocos[].cartoes`); a tela
 * guarda a escolha pela posição CANÔNICA (`Cartao.indice`), que é o `lados` do
 * contrato. A montagem em curso vive na memória da aba (`chave`), e um F5 não
 * a apaga.
 *
 * Montada, a api já pôs o passo em `revisao`; a casca segura esta tela até
 * "Abrir a Mesa de Revisão".
 */
export function TelaDaChave({
  sessaoId,
  blocos,
  tamanho,
  aoEnviar,
  aoIrParaRevisao,
}: {
  sessaoId: string;
  blocos: readonly BlocoDaChave[];
  tamanho: number;
  /** O `POST chave`. `false` = falhou por um motivo que não se repete (a casca já tratou). */
  aoEnviar: (corpo: CorpoDaChave) => Promise<boolean>;
  aoIrParaRevisao: () => void;
}) {
  const porId = useMemo(() => new Map(blocos.map((b) => [b.id, b])), [blocos]);
  const [montagem, setMontagem] = useState<MontagemDaChave>(
    () => montagemValida(lerMemoria(sessaoId).chave, new Set(porId.keys()), tamanho) ?? montagemVazia(tamanho),
  );
  const [escolhido, setEscolhido] = useState<IdDeBloco | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [montada, setMontada] = useState(false);

  const travada = enviando || montada;
  const usados = blocosNasVagas(montagem);
  const naBandeja = blocos.filter((b) => !usados.has(b.id));
  const livre = proximaVagaLivre(montagem);
  const corpo = corpoDaChave(montagem);

  function mudar(nova: MontagemDaChave) {
    setMontagem(nova);
    gravarMemoria(sessaoId, { chave: nova });
  }

  function colocar(indice: number) {
    if (travada || !escolhido) return;
    mudar(porNaVaga(montagem, indice, escolhido));
    setEscolhido(null);
  }

  function devolver(indice: number) {
    if (travada) return;
    mudar(tirarDaVaga(montagem, indice));
  }

  async function enviar() {
    if (!corpo || travada) return;
    setEnviando(true);
    const ok = await aoEnviar(corpo);
    setEnviando(false);
    setConfirmando(false);
    if (ok) {
      setMontada(true);
      gravarMemoria(sessaoId, { chave: undefined });
    }
  }

  const preenchidas = montagem.vagas.filter((v) => v.bloco !== null).length;
  const rotuloEscolhido = escolhido ? porId.get(escolhido)?.rotulo : undefined;
  const status = montada
    ? E5.montada
    : rotuloEscolhido && livre !== -1
      ? E5.escolhido(String(rotuloEscolhido))
      : E5.preenchidas(preenchidas, tamanho);

  const vagas = montagem.vagas.map((vaga, i) => {
    const bloco = vaga.bloco ? porId.get(vaga.bloco) : undefined;
    if (!bloco) {
      /* Vaga vazia: a silhueta do DS; com um bloco escolhido, o botão de pôr ali. */
      return escolhido && !travada && rotuloEscolhido ? (
        <Button
          variant="outline"
          size="lg"
          fullWidth
          className="acao-crianca"
          aria-label={E5.colocarNaVaga(String(rotuloEscolhido), i + 1)}
          onClick={() => colocar(i)}
        >
          {E5.colocarAqui}
        </Button>
      ) : null;
    }
    return (
      <div className="chave__vaga">
        <p className="chave__ordem">{E5.ordem(i + 1)}</p>
        <PuzzleBlock
          label={bloco.rotulo}
          description={bloco.legenda}
          icon={ICONE_DO_BLOCO[bloco.id]}
          state={montada ? "locked" : "placed"}
          disabled={enviando}
          onClick={() => devolver(i)}
        />
        <div className="opcoes-amplas chave__escolhas">
          {bloco.cartoes.map((cartao) => (
            <RadioGroup
              key={cartao.indice}
              name={`lado-${bloco.id}-${cartao.indice}`}
              label={E5.cartao(cartao.texto, cartao.exemplo)}
              size="lg"
              direction="horizontal"
              value={vaga.lados[cartao.indice] ?? ""}
              disabled={travada}
              options={LADOS.map((l) => ({ value: l, label: E5.lado[l] }))}
              onChange={(v) => {
                if (v === "aprova" || v === "reprova") mudar(marcarLado(montagem, i, cartao.indice, v));
              }}
            />
          ))}
          <RadioGroup
            name={`se-falhar-${bloco.id}`}
            label={E5.seFalhar}
            size="lg"
            direction="horizontal"
            value={vaga.seFalhar ?? ""}
            disabled={travada}
            options={SE_FALHAR.map((s) => ({ value: s, label: E5.opcoesSeFalhar[s] }))}
            onChange={(v) => {
              if (v === "parar" || v === "seguir") mudar(marcarSeFalhar(montagem, i, v));
            }}
          />
        </div>
      </div>
    );
  });

  return (
    <div className="tela">
      <Cabecalho titulo={E5.titulo} />
      <ScrollBar className="rolagem" autoHide>
        <div className="tela__corpo">
          <SpeechBubble speaker={REDACAO.bento} tone="guide">
            {montada ? E5.montada : E5.bentoAlgoritmo}
          </SpeechBubble>

          {!montada && <AlertBox variant="info" theme="light" device="mobile" role="status" description={E5.combinem} />}

          <PuzzleTrack label={E5.chave} slots={vagas} status={status} aria-busy={enviando || undefined} />

          {!montada && naBandeja.length > 0 && (
            <div className="chave__bandeja-e-acao">
              <ul className="chave__bandeja" aria-label={E5.bandeja}>
                {naBandeja.map((b) => (
                  <li key={b.id}>
                    <PuzzleBlock
                      label={b.rotulo}
                      description={b.legenda}
                      icon={ICONE_DO_BLOCO[b.id]}
                      state="idle"
                      aria-pressed={escolhido === b.id}
                      disabled={enviando || livre === -1}
                      onClick={() => setEscolhido((atual) => (atual === b.id ? null : b.id))}
                    />
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="lg"
                fullWidth
                className="acao-crianca"
                disabled={!escolhido || livre === -1 || travada}
                onClick={() => colocar(livre)}
              >
                {E5.adicionar}
              </Button>
            </div>
          )}

          <div className="opcoes-amplas">
            <RadioGroup
              name="repeticao"
              label={E5.repeticao}
              size="lg"
              value={montagem.repeticao ?? ""}
              disabled={travada}
              options={REPETICOES.map((r) => ({ value: r, label: E5.opcoesRepeticao[r] }))}
              onChange={(v) => {
                if (v === "todas" || v === "so_a_primeira") mudar(marcarRepeticao(montagem, v));
              }}
            />
          </div>
        </div>
      </ScrollBar>
      <div className="tela__acao">
        {montada ? (
          <Button size="lg" fullWidth className="acao-crianca" onClick={aoIrParaRevisao}>
            {E5.irParaRevisao}
          </Button>
        ) : (
          <>
            <p className="mesa__status" role="status">
              {corpo ? "" : E5.falta}
            </p>
            <Button size="lg" fullWidth className="acao-crianca" disabled={!corpo} onClick={() => setConfirmando(true)}>
              {E5.pronto}
            </Button>
          </>
        )}
      </div>

      <Modal
        isOpen={confirmando}
        onClose={() => {
          if (!enviando) setConfirmando(false);
        }}
        size="sm"
        title={E5.confirmarTitulo}
        description={E5.confirmarDescricao}
        closeOnOverlayClick={!enviando}
        closeOnEsc={!enviando}
        showCloseButton={false}
        primaryAction={
          <Button size="lg" fullWidth className="acao-crianca" isLoading={enviando} onClick={() => void enviar()}>
            {E5.enviar}
          </Button>
        }
        secondaryAction={
          <Button
            variant="outline"
            size="lg"
            fullWidth
            className="acao-crianca"
            disabled={enviando}
            onClick={() => setConfirmando(false)}
          >
            {E5.conferir}
          </Button>
        }
      />
    </div>
  );
}
