import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Composer } from "@edu/ui/ds-unooriaai";
import { Falas } from "../componentes/PecasDoAssistente";
import type { Contexto } from "../contexto";
import { api } from "../lib/api";
import { roteiroDaSimulacao } from "../lib/roteiro";
import { TEXTOS } from "../lib/textos";

/** O ritmo das falas e a pausa no fim, antes de voltar ao módulo escolar. */
export const RITMO_MS = 1400;
export const PAUSA_NO_FIM_MS = 3500;

/**
 * E4-ALU-01 — as três sessões de teste no UnooriaAI (a seção `unooriaai`
 * inteira: é o assistente que está falando). A conversa é ROTEIRIZADA a partir
 * do pacote (`lib/roteiro.ts`) e aparece em sequência; o `Composer` fica
 * bloqueado ("Entrada bloqueada durante a execução da bateria de testes…").
 *
 * No fim, o placeholder vira "Sessões concluídas. Relatório de auditoria
 * gerado…" e, depois de uma pausa para ler, a tela marca a simulação
 * concluída (`POST /simulacao/concluir`) — o passo vira o confronto. Um F5 no
 * meio repete a bateria do começo (o passo ainda é `simulacao`).
 *
 * Sem `ScrollBar` (é do DS da plataforma): a conversa rola na barra do sistema.
 */
export function Simulacao({ ctx }: { ctx: Contexto }) {
  const { estado, sessao, executar } = ctx;
  const falas = useMemo(
    () => (sessao.pacote ? roteiroDaSimulacao(sessao.pacote.conteudo, sessao.material) : []),
    [sessao.pacote, sessao.material],
  );
  const [vistas, setVistas] = useState(0);
  const fim = useRef<HTMLDivElement>(null);
  const concluiu = vistas >= falas.length && falas.length > 0;

  useEffect(() => {
    if (vistas >= falas.length) return;
    const id = window.setTimeout(() => setVistas((n) => n + 1), RITMO_MS);
    return () => window.clearTimeout(id);
  }, [vistas, falas.length]);

  useEffect(() => {
    if (!concluiu || estado.aguardandoProfessor) return;
    const id = window.setTimeout(() => void executar(() => api.concluirSimulacao(), "simulacao"), PAUSA_NO_FIM_MS);
    return () => window.clearTimeout(id);
  }, [concluiu, estado.aguardandoProfessor, executar]);

  useEffect(() => {
    fim.current?.scrollIntoView?.({ block: "end" });
  }, [vistas]);

  const atual = falas[Math.max(0, vistas - 1)];
  const nomes = { 1: "Lucas", 2: "Beatriz", 3: "Thiago" } as const;
  const tag = estado.equipe
    ? TEXTOS.e4chat.tagDaEquipe(estado.equipe.nome)
    : concluiu
      ? TEXTOS.e4chat.concluidas
      : TEXTOS.e4chat.sessao(atual?.sessao ?? 1, nomes[atual?.sessao ?? 1]);

  return (
    <main className="uai-tela">
      <header className="uai-topo">
        <span className="uai-topo__titulo">{TEXTOS.e4chat.titulo}</span>
        <Badge variant="default">{tag}</Badge>
      </header>
      <section className="uai-conversa" aria-live="polite">
        <Falas falas={falas.slice(0, vistas)} />
        <div ref={fim} />
      </section>
      <footer className="uai-rodape">
        <Composer
          block
          hideLeadingActions
          disabled
          readOnly
          value=""
          placeholder={concluiu ? TEXTOS.e4chat.concluida : TEXTOS.e4chat.bloqueada}
          sendLabel={TEXTOS.e4chat.enviar}
        />
      </footer>
    </main>
  );
}
