"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, FeedbackAlert, Modal } from "@edu/ui/ds";
import { erroDaResposta } from "@/lib/jornal-escola-tipos";

/**
 * ZERAR A TURMA da exp04ef1b — uma RODADA NOVA do mesmo pacote, SEM apagar.
 *
 * O molde é o zerar da exp07ef1b, e o diálogo diz o mesmo: nada some. A rodada
 * passada fica — as duas edições, as pistas abertas e a Chave —, porque é ela
 * que o painel de habilidades mostra, e um zerar que apagasse levaria a
 * evidência junto (a contagem de rodadas colidiria com as marcas dela). A
 * turma volta à exploração, os dois portões fecham e cada computador recomeça
 * pelo Bento.
 *
 * **O aviso mora no diálogo, antes do clique.** Com as MESMAS notícias, a
 * descoberta se perde: a turma já sabe quais não podiam ir para a capa, e a 1ª
 * edição da rodada nova mede memória, não checagem. O caminho para reaplicar é
 * outro pacote, no preparo — que vira atividade nova, com rodada 1.
 *
 * O atributo `data-zerar-turma` e os textos "Zerar {turma}?" / "Zerar a
 * turma" são os que as suítes e2e procuram, como nas outras missões.
 */
export function ZerarTurmaJornalEscola({
  turmaId,
  nomeDaTurma,
  tema,
}: {
  turmaId: string;
  nomeDaTurma: string;
  /** O tema do pacote em andamento — é ele que a rodada nova repete. */
  tema: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, transicionar] = useTransition();

  async function zerar() {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/plataforma/jornal-escola/turmas/${encodeURIComponent(turmaId)}/zerar`, { method: "POST" });
      if (!r.ok) {
        setErro(erroDaResposta(await r.json().catch(() => null), "Não deu para zerar agora.").mensagem);
        return;
      }
      setAberto(false);
      transicionar(() => router.refresh());
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="outline" className="acao-destrutiva" size="sm" onClick={() => setAberto(true)} data-zerar-turma>
        Zerar a turma
      </Button>
      <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
        Abre uma rodada nova de {nomeDaTurma} com o mesmo pacote e volta a aula para a exploração. Nada é
        apagado: a rodada anterior fica no painel de habilidades.
      </p>

      <Modal isOpen={aberto} onClose={() => setAberto(false)} title={`Zerar ${nomeDaTurma}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-unooria-neutral-800">
            A turma volta ao começo — o Bento, a mesa e a 1ª edição —, o resultado e a revisão fecham e cada
            computador monta a capa de novo. <strong>Nada é apagado</strong>: as duas edições, as pistas abertas
            e a Chave desta rodada continuam guardadas, e a evidência dela segue no painel de habilidades.
          </p>
          <FeedbackAlert
            type="warning"
            title="Com as mesmas notícias, a descoberta se perde"
            description={`A rodada nova repete “${tema}”. Quem já viu os leitores reagirem sabe quais notícias não podiam ir para a capa, e a 1ª edição deixa de ser espontânea. Para aplicar de novo com esta turma, prefira gerar um pacote com outro tema no preparo, acima: um pacote novo vira uma atividade nova, e a turma recomeça na rodada 1.`}
          />
          <p className="text-[13px] leading-relaxed text-unooria-neutral-600">
            Só esta turma é afetada, e a telemetria da aula anterior continua registrada.
          </p>
          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => void zerar()} isDisabled={enviando}>
              {enviando ? "Zerando…" : "Zerar a turma"}
            </Button>
            <Button variant="secondary" onClick={() => setAberto(false)} isDisabled={enviando}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
