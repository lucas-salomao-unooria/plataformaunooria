import { useState } from "react";
import { Button, Card, CardContent, NEWS_MEDIUM_LABELS, RevealClue, ScrollBar, SectionHeader } from "@edu/ui/ds";
import { gravarMemoria, lerMemoria } from "../../lib/memoria";
import { ICONE_DA_PISTA } from "../../lib/meios";
import { pistasDoBoatoValidas, registrarPistaDoBoato } from "../../lib/regras";
import { E6, PISTA } from "../../lib/textos";
import {
  TIPOS_DE_PISTA,
  type CorpoDaTransferencia,
  type DecisaoDaTransferencia,
  type TipoDePista,
  type TransferenciaDaTela,
} from "../../lib/tipos";
import { MensagemEncaminhada } from "../pecas/mensagem-encaminhada";

const DECISOES: readonly DecisaoDaTransferencia[] = ["repassar", "nao_repassar"];

/**
 * E6 — a TRANSFERÊNCIA (3.0.0, ADR-168): o boato chega e a criança decide, à
 * mão, o que faz com ele. Fora da redação e sem o Bento: a Unooria fala, numa
 * tela NEUTRA — sem fala de ninguém, sem destaque nem animação nas pistas, e
 * nada nela pede para verificar. Saiu o Desafio Final de múltipla escolha
 * (P1/P2): a habilidade agora é medida pelo que a criança FAZ.
 *
 * A mensagem é o `MessageBubble` do `unoochat` (`forwardedLabel`, ADR-136); as
 * três pistas são `RevealClue` sem julgamento, com o texto que já desceu no
 * `GET transferencia` (abrir não vai à api); "Repassar para o grupo" e "Não
 * repassar" estão à mão DESDE O INÍCIO, logo abaixo das pistas, com o mesmo
 * peso visual. A tela registra as pistas abertas ANTES da decisão, na ordem
 * (memória da aba: o F5 não as apaga), e a decisão as manda junto
 * (`POST transferencia`). Depois dela nada mais conta.
 *
 * Decidido, a síntese ÚNICA (`e6.feedback.sintese_inicial`, a mesma para
 * todos: a tela não sabe se a decisão "foi boa", e não diz), a frase da
 * conversa com a professora e o "Concluir Missão".
 */
export function DesafioFinal({
  sessaoId,
  dados,
  decidida,
  concluindo,
  aoDecidir,
  aoConcluir,
}: {
  sessaoId: string;
  /** O `GET transferencia`; `null` enquanto não volta. */
  dados: TransferenciaDaTela | null;
  /** `estado.transferida` — a decisão já está gravada (também depois do F5). */
  decidida: boolean;
  concluindo: boolean;
  /** O `POST transferencia`. `false` = falhou por um motivo que não se repete (a casca já tratou). */
  aoDecidir: (corpo: CorpoDaTransferencia) => Promise<boolean>;
  aoConcluir: () => void;
}) {
  const [abertasAntes, setAbertasAntes] = useState<readonly TipoDePista[]>(() =>
    pistasDoBoatoValidas(lerMemoria(sessaoId).boato),
  );
  const [abertas, setAbertas] = useState<ReadonlySet<TipoDePista>>(() => new Set(abertasAntes));
  const [decidindo, setDecidindo] = useState(false);

  function alternar(tipo: TipoDePista, aberta: boolean) {
    setAbertas((atual) => {
      const nova = new Set(atual);
      if (aberta) nova.add(tipo);
      else nova.delete(tipo);
      return nova;
    });
    if (!aberta) return;
    const registradas = registrarPistaDoBoato(abertasAntes, tipo, decidida || decidindo);
    if (registradas === abertasAntes) return;
    setAbertasAntes(registradas);
    gravarMemoria(sessaoId, { boato: [...registradas] });
  }

  async function decidir(decisao: DecisaoDaTransferencia) {
    if (decidida || decidindo) return;
    setDecidindo(true);
    const ok = await aoDecidir({ pistas: [...abertasAntes], decisao });
    setDecidindo(false);
    if (ok) gravarMemoria(sessaoId, { boato: undefined });
  }

  return (
    <div className="tela tela--escola">
      <SectionHeader className="tela__topo" variant="mobile" divider title={E6.titulo} />
      <ScrollBar className="rolagem" autoHide>
        {dados ? (
          <div className="tela__corpo">
            <MensagemEncaminhada remetente={dados.remetente} texto={dados.mensagem} rotulo={NEWS_MEDIUM_LABELS.message} />

            <div className="gaveta__pistas">
              {TIPOS_DE_PISTA.map((tipo) => (
                <RevealClue
                  key={tipo}
                  label={PISTA[tipo].rotulo}
                  question={PISTA[tipo].pergunta}
                  icon={ICONE_DA_PISTA[tipo]}
                  open={abertas.has(tipo)}
                  onOpenChange={(aberta) => alternar(tipo, aberta)}
                >
                  {dados.pistas[tipo]}
                </RevealClue>
              ))}
            </div>

            {decidida ? (
              <Card>
                <CardContent>
                  <p className="tela__texto" role="status">
                    {E6.sintese}
                  </p>
                  <p className="tela__texto">{E6.conversa}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="julgar" role="group" aria-label={E6.oQueFazer}>
                {DECISOES.map((d) => (
                  <Button
                    key={d}
                    variant="outline"
                    size="lg"
                    fullWidth
                    className="acao-crianca"
                    disabled={decidindo}
                    onClick={() => void decidir(d)}
                  >
                    {E6.decisao[d]}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="tela__corpo" aria-busy="true" />
        )}
      </ScrollBar>
      {decidida && (
        <div className="tela__acao">
          <Button size="lg" fullWidth className="acao-crianca" isLoading={concluindo} onClick={aoConcluir}>
            {E6.concluir}
          </Button>
        </div>
      )}
    </div>
  );
}
