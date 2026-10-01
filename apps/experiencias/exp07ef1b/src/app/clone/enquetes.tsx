import { useEffect, useRef, useState } from "react";
import { DmPoll } from "@edu/ui/ds-insta";
import { api, reportarErro, statusDoErro, tipoDaFalha } from "../../lib/api";
import { separarEnunciado } from "../../lib/regras";
import { telemetria } from "../../lib/telemetria";
import { ENQUETE } from "../../lib/textos";
import { ENQUETES, EXP_ID, type IdDaEnquete, type PerguntaDaEnquete } from "../../lib/tipos";
import { AcaoDaDm, BalaoDaAmara, DmDaAmara } from "./dm-da-amara";

interface EnqueteNaTela {
  id: IdDaEnquete;
  contexto: string | null;
  pergunta: string;
  opcoes: { id: string; label: string }[];
  /** O `id` votado; `null` = ainda não. */
  voto: string | null;
  /** O voto não chegou à api: a enquete trava SEM "Resposta enviada ✓". */
  perdida: boolean;
}

/**
 * As enquetes da DM — as duas perguntas de evidência do PO, DEPOIS da reflexão
 * (a ordem do PO: perguntar antes sugeriria a resposta escrita).
 *
 * É a Amara quem pergunta, então é o clone: a mesma `DirectThread` do desafio,
 * com a enquete (`DmPoll`). Se o `enunciado` da api trouxer uma mensagem de
 * contexto antes da pergunta, separada por uma linha em branco, ela vai num
 * balão antes da enquete (`regras.ts#separarEnunciado`). Os da versão do PO de
 * 2026-10-01 são só a pergunta.
 *
 * **Nunca mostra acerto.** O `DmPoll` não sabe qual opção é "certa" e a api
 * devolve `{ enviada: true }` para qualquer uma — o nível de cada alternativa
 * é segredo de servidor (regra 3). Depois do voto, só "Resposta enviada ✓".
 *
 * **Enquete que falha pula para o fim** — 409 `sem-atividade-em-andamento`
 * (a professora zerou a turma no meio), rede, 404: a conclusão da missão nunca
 * fica presa numa pergunta opcional. Por isso aqui NÃO há repetição: uma
 * tentativa (o SDK já reenvia o GET uma vez) e, falhou, encerramento.
 *
 * **F5**: as enquetes reaparecem, e a api guarda a PRIMEIRA resposta. O `id`
 * votado fica no `sessionStorage` só para a enquete reabrir travada, sem
 * convidar a um segundo toque que não valeria nada.
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
  const [enquetes, setEnquetes] = useState<EnqueteNaTela[]>([]);
  const [proxima, setProxima] = useState(0);
  const [encerrada, setEncerrada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const votos = useRef(votosGuardados);

  /** Pula o resto: registra por quê e encerra a conversa. */
  function pular(id: IdDaEnquete, erro: unknown) {
    if (tipoDaFalha(erro) === "invalida") reportarErro(erro);
    telemetria.pulouEnquete(id, statusDoErro(erro) ?? 0);
    setEncerrada(true);
  }

  // Carrega a enquete da vez (uma de cada vez: a segunda chega depois do voto).
  useEffect(() => {
    if (encerrada) return;
    const id = ENQUETES[proxima];
    if (!id) {
      setEncerrada(true);
      return;
    }
    let viva = true;
    void (async () => {
      try {
        const p = await api.get<PerguntaDaEnquete>(`/evidencias/${EXP_ID}/perguntas/${id}`);
        if (!viva) return;
        const { contexto, pergunta } = separarEnunciado(p.enunciado);
        const guardado = votos.current[id];
        const voto = guardado && p.alternativas.some((a) => a.id === guardado) ? guardado : null;
        setEnquetes((atuais) => [
          ...atuais.filter((e) => e.id !== id),
          { id, contexto, pergunta, opcoes: p.alternativas.map((a) => ({ id: a.id, label: a.texto })), voto, perdida: false },
        ]);
        // Já votada antes do F5: segue para a próxima sem pedir o toque de novo.
        if (voto) setProxima((n) => n + 1);
      } catch (erro) {
        if (viva) pular(id, erro);
      }
    })();
    return () => {
      viva = false;
    };
  }, [proxima, encerrada]);

  async function votar(id: IdDaEnquete, alternativaId: string) {
    if (enviando) return;
    setEnviando(true);
    try {
      await api.post(`/evidencias/${EXP_ID}/perguntas/${id}/resposta`, { alternativaId });
      votos.current = { ...votos.current, [id]: alternativaId };
      aoVotar(id, alternativaId);
      telemetria.respondeuEnquete(id);
      setEnquetes((atuais) => atuais.map((e) => (e.id === id ? { ...e, voto: alternativaId } : e)));
      setProxima((n) => n + 1);
    } catch (erro) {
      setEnquetes((atuais) => atuais.map((e) => (e.id === id ? { ...e, perdida: true } : e)));
      pular(id, erro);
    } finally {
      setEnviando(false);
    }
  }

  const respondidas = enquetes.filter((e) => e.voto !== null).length;

  return (
    <DmDaAmara
      rodape={
        encerrada ? (
          <AcaoDaDm ocupado={concluindo} aoTocar={() => aoConcluir(respondidas)}>
            {ENQUETE.fecharConversa}
          </AcaoDaDm>
        ) : undefined
      }
    >
      {enquetes.map((e) => (
        <div key={e.id} className="dm__grupo">
          {e.contexto && <BalaoDaAmara posicao="first">{e.contexto}</BalaoDaAmara>}
          <BalaoDaAmara posicao={e.contexto ? "last" : "single"} bare>
            <DmPoll
              question={e.pergunta}
              options={e.opcoes}
              value={e.voto}
              disabled={enviando || e.perdida || encerrada}
              sentLabel={ENQUETE.enviada}
              onVote={(alternativa) => void votar(e.id, alternativa)}
            />
          </BalaoDaAmara>
        </div>
      ))}
      {encerrada && <BalaoDaAmara>{ENQUETE.encerramento}</BalaoDaAmara>}
    </DmDaAmara>
  );
}
