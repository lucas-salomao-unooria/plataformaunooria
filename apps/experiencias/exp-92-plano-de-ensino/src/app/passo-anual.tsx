import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  FeedbackAlert,
  ProgressBar,
  RichTextEditor,
  SectionHeader,
} from "@edu/ui/ds";

import { api, statusDoErro } from "../lib/api";
import { baixarDoc, documentoAnual, imprimir } from "../lib/exportar";
import type { Configuracao, PlanoAnual, PlanoAnualComConteudo } from "../lib/tipos";

/**
 * PASSO 3 — O PLANO ANUAL. Geração assíncrona e edição.
 *
 * O documento é PROSA, e é o único lugar do produto onde a IA escreve texto
 * corrido: fundamentação, progressão, avaliação, atendimento à diversidade. O
 * professor edita à vontade — o Markdown original fica intocado no servidor, e
 * "Restaurar" existe justamente para quem editou demais.
 *
 * O polling é do mesmo tipo da exp-90 (a geração leva minutos e corre em
 * background). Enquanto gera, mostramos o que está sendo feito em vez de uma
 * barra anônima: um plano anual demora, e o professor precisa saber que o
 * sistema não travou.
 */

const INTERVALO_POLLING_MS = 3_000;

const ETAPAS = [
  "Lendo as habilidades que você distribuiu…",
  "Organizando a progressão de cada período…",
  "Escrevendo estratégias e instrumentos de avaliação…",
  "Redigindo o atendimento à diversidade e as notas finais…",
];

interface Props {
  configuracao: Configuracao;
  plano: PlanoAnual;
  professorNome: string;
  onAtualizado: (p: PlanoAnual) => void;
  onVoltar: () => void;
  onAvancar: () => void;
}

export function PassoAnual({
  configuracao,
  plano,
  professorNome,
  onAtualizado,
  onVoltar,
  onAvancar,
}: Props) {
  const [status, setStatus] = useState(plano.status);
  const [html, setHtml] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(plano.erro);
  const [sujo, setSujo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const editado = useRef<string>("");

  const carregar = useCallback(async () => {
    const resposta = await api.get<PlanoAnualComConteudo>(
      `/planejamento/planos-anuais/${plano.id}`,
    );
    setStatus(resposta.plano.status);
    setErro(resposta.plano.erro);
    if (resposta.html !== null) {
      setHtml(resposta.html);
      editado.current = resposta.html;
    }
    onAtualizado(resposta.plano);
    return resposta.plano.status;
  }, [plano.id, onAtualizado]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Polling enquanto gera. Para no primeiro estado terminal.
  useEffect(() => {
    if (status !== "gerando" && status !== "pendente") return;
    const t = window.setInterval(() => void carregar(), INTERVALO_POLLING_MS);
    const e = window.setInterval(() => setEtapa((n) => (n + 1) % ETAPAS.length), 9_000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(e);
    };
  }, [status, carregar]);

  async function gerar() {
    setErro(null);
    try {
      await api.post(`/planejamento/planos-anuais/${plano.id}/gerar`);
      setStatus("gerando");
    } catch (falha) {
      const codigo = statusDoErro(falha);
      setErro(
        codigo === 403
          ? "A cota diária de IA acabou. Tente novamente amanhã, ou fale com a coordenação."
          : codigo === 400
            ? "Distribua as habilidades pelos períodos antes de gerar o plano."
            : "Não foi possível iniciar a geração agora.",
      );
    }
  }

  async function salvar() {
    if (!editado.current) return;
    setSalvando(true);
    try {
      await api.put(`/planejamento/planos-anuais/${plano.id}/conteudo`, { html: editado.current });
      setHtml(editado.current);
      setSujo(false);
    } catch {
      setErro("Não foi possível salvar as alterações.");
    } finally {
      setSalvando(false);
    }
  }

  // Ctrl/Cmd+S salva, como em qualquer editor de documento.
  useEffect(() => {
    const atalho = (ev: KeyboardEvent) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") {
        ev.preventDefault();
        if (sujo) void salvar();
      }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  });

  const documento = () => documentoAnual(editado.current || html || "", configuracao, professorNome);

  return (
    <section className="passo">
      <SectionHeader
        title={plano.titulo}
        description="O plano anual: fundamentação, progressão por período, avaliação e atendimento à diversidade. Você pode editar tudo."
      />

      {erro && <FeedbackAlert type="error" description={erro} />}

      {(status === "pendente" || status === "erro") && !html && (
        <div className="estado-vazio">
          <p>
            As habilidades estão distribuídas. Agora o gerador escreve o plano anual a partir delas
            — leva alguns minutos.
          </p>
          <Button variant="primary" onClick={() => void gerar()}>
            {status === "erro" ? "Tentar de novo" : "Escrever o plano anual"}
          </Button>
        </div>
      )}

      {(status === "gerando" || (status === "pendente" && html === null && erro === null)) && (
        <div className="estado-gerando" aria-live="polite">
          <ProgressBar indeterminate />
          <p>{ETAPAS[etapa]}</p>
          <p className="nota">
            Pode fechar esta tela: a geração continua no servidor e o plano estará aqui quando você
            voltar.
          </p>
        </div>
      )}

      {status === "pronto" && html !== null && (
        <>
          <div className="acoes acoes--topo">
            <Button variant="tertiary" size="sm" onClick={() => imprimir(documento(), plano.titulo)}>
              Imprimir
            </Button>
            <Button variant="tertiary" size="sm" onClick={() => baixarDoc(documento(), plano.titulo)}>
              Baixar .doc
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void gerar()}>
              Gerar de novo
            </Button>
            <Button variant="primary" size="sm" onClick={() => void salvar()} loading={salvando} disabled={!sujo}>
              {sujo ? "Salvar alterações" : "Salvo"}
            </Button>
          </div>

          <RichTextEditor
            value={html}
            onChange={(valor: string) => {
              editado.current = valor;
              setSujo(true);
            }}
            minHeight={520}
          />
        </>
      )}

      <div className="acoes">
        <Button variant="secondary" onClick={onVoltar}>
          Voltar à distribuição
        </Button>
        <Button variant="primary" onClick={onAvancar} disabled={status !== "pronto"}>
          Planejar as aulas
        </Button>
      </div>
    </section>
  );
}
