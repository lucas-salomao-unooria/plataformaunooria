import { useEffect, useMemo, useRef, useState } from "react";
import { ButtonUnv, StoryPoll, StoryViewer } from "@edu/ui/ds-unoovista";
import { dataUriDeSvg, svgDaConsulta } from "../../lib/arte";
import { api, reportarErro, statusDoErro, tipoDaFalha } from "../../lib/api";
import { telemetria } from "../../lib/telemetria";
import { CONTAS, ENQUETE } from "../../lib/textos";
import { ENQUETES, EXP_ID, type IdDaEnquete, type PerguntaDaEnquete } from "../../lib/tipos";
import { usePaleta } from "../componentes/midia";

interface EnqueteNaTela {
  pergunta: string;
  opcoes: { id: string; label: string }[];
}

/**
 * E6-ALU-02 — a consulta aos jurados: as três perguntas de evidência (p1, p2,
 * p3) nos STORIES da comissão, tema escuro, uma por segmento. Descem pelas
 * rotas GENÉRICAS de `/evidencias` (molde: `exp07ef1b/src/app/clone/enquetes.tsx`),
 * embaralhadas a cada leitura — a tela guarda o `id`, nunca a posição.
 *
 * - **Nunca mostra acerto.** A figurinha não sabe qual opção é "certa" e a api
 *   devolve `{ enviada: true }` para qualquer uma; depois do voto, só a
 *   confirmação neutra da ata.
 * - **Uma tentativa por pergunta, e a falha pula para o fim** — 409 (a
 *   professora zerou a turma no meio), rede, 404: a conclusão nunca fica presa
 *   numa pergunta opcional. Por isso aqui NÃO há `comRepeticao`.
 * - **F5**: a api guarda a PRIMEIRA resposta; o `id` votado fica no
 *   `sessionStorage` só para a enquete reabrir travada e a história abrir na
 *   primeira que falta.
 * - **Sem avanço automático** (WCAG 2.2.2): passa-se de pergunta pelo toque na
 *   história ou pelo botão "Próxima pergunta", só depois de votar.
 */
export function Enquetes({
  votosGuardados,
  concluindo,
  aoVotar,
  aoConcluir,
}: {
  votosGuardados: Readonly<Record<string, string>>;
  concluindo: boolean;
  aoVotar: (perguntaId: IdDaEnquete, alternativaId: string) => void;
  aoConcluir: (respondidas: number) => void;
}) {
  const paleta = usePaleta("dark");
  const fundo = useMemo(() => dataUriDeSvg(svgDaConsulta(ENQUETE.titulo, paleta)), [paleta]);
  const [votos, setVotos] = useState<Record<string, string>>(() => ({ ...votosGuardados }));
  const [segmento, setSegmento] = useState(() => {
    const primeira = ENQUETES.findIndex((id) => !votosGuardados[id]);
    return primeira === -1 ? ENQUETES.length - 1 : primeira;
  });
  const [enquetes, setEnquetes] = useState<Partial<Record<IdDaEnquete, EnqueteNaTela>>>({});
  const [encerrada, setEncerrada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const pedidas = useRef(new Set<string>());

  const id = ENQUETES[segmento] ?? ENQUETES[0];
  const atual = enquetes[id];
  const voto = votos[id] ?? null;
  const respondidas = ENQUETES.filter((e) => votos[e]).length;
  const todas = respondidas === ENQUETES.length;

  function pular(perguntaId: IdDaEnquete, erro: unknown) {
    if (tipoDaFalha(erro) === "invalida") reportarErro(erro);
    telemetria.pulouEnquete(perguntaId, statusDoErro(erro) ?? 0);
    setEncerrada(true);
  }

  // A pergunta do segmento, lida uma vez (o SDK já reenvia o GET uma vez).
  useEffect(() => {
    const pedidasAgora = pedidas.current;
    if (encerrada || pedidasAgora.has(id)) return;
    pedidasAgora.add(id);
    let viva = true;
    let chegou = false;
    void (async () => {
      try {
        const p = await api.get<PerguntaDaEnquete>(`/evidencias/${EXP_ID}/perguntas/${id}`);
        if (!viva) return;
        chegou = true;
        setEnquetes((atuais) => ({
          ...atuais,
          [id]: { pergunta: p.enunciado, opcoes: p.alternativas.map((a) => ({ id: a.id, label: a.texto })) },
        }));
      } catch (erro) {
        if (viva) pular(id, erro);
      }
    })();
    return () => {
      viva = false;
      // Desmontou antes de a pergunta chegar: a próxima montagem pede de novo.
      if (!chegou) pedidasAgora.delete(id);
    };
  }, [id, encerrada]);

  async function votar(alternativaId: string) {
    if (enviando || voto) return;
    setEnviando(true);
    try {
      await api.post(`/evidencias/${EXP_ID}/perguntas/${id}/resposta`, { alternativaId });
      setVotos((v) => ({ ...v, [id]: alternativaId }));
      aoVotar(id, alternativaId);
      telemetria.respondeuEnquete(id);
    } catch (erro) {
      pular(id, erro);
    } finally {
      setEnviando(false);
    }
  }

  const podeAvancar = Boolean(voto) && segmento < ENQUETES.length - 1 && !encerrada;
  const avancar = () => podeAvancar && setSegmento((s) => s + 1);
  const voltar = () => segmento > 0 && setSegmento((s) => s - 1);
  const fecho = encerrada || todas;

  return (
    <div className="tela tela--story" data-unv-theme="dark">
      <h1 className="so-leitor">{ENQUETE.titulo}</h1>
      <div className="story">
        <StoryViewer
          theme="dark"
          mediaSrc={fundo}
          mediaAlt={ENQUETE.titulo}
          username={CONTAS.comissao}
          segments={ENQUETES.length}
          currentSegment={segmento + 1}
          segmentProgress={voto ? 1 : 0}
          onNext={podeAvancar ? avancar : undefined}
          onPrev={segmento > 0 ? voltar : undefined}
          nextLabel={ENQUETE.proxima}
          prevLabel={ENQUETE.anterior}
          footer={
            fecho ? (
              <ButtonUnv variant="primary" size="md" block disabled={concluindo} onClick={() => aoConcluir(respondidas)}>
                {ENQUETE.encerrar}
              </ButtonUnv>
            ) : podeAvancar ? (
              <ButtonUnv variant="secondary" size="md" block onClick={avancar}>
                {ENQUETE.proxima}
              </ButtonUnv>
            ) : (
              <p className="story__rodape">{ENQUETE.titulo}</p>
            )
          }
        >
          {encerrada && !atual ? (
            <p className="consulta__encerrada" role="status">
              {ENQUETE.encerrada}
            </p>
          ) : atual ? (
            <StoryPoll
              key={id}
              question={atual.pergunta}
              options={atual.opcoes}
              value={voto && atual.opcoes.some((o) => o.id === voto) ? voto : null}
              disabled={enviando || Boolean(voto) || encerrada}
              sentLabel={ENQUETE.confirmada[id]}
              onVote={(alternativa) => void votar(alternativa)}
            />
          ) : null}
        </StoryViewer>
      </div>
    </div>
  );
}
