"use client";

import { dataHora } from "@edu/sdk";
import { useCallback, useState } from "react";
import {
  Button,
  Card,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  SectionHeader,
  Snackbar,
  TextArea,
  TextField,
} from "@edu/ui/ds";
import { HistoricoDeRecursos } from "@/components/historico-de-recursos";
import { PainelDoAtendente } from "./painel-do-atendente";
import type { ChaveDeLimite, ConfiguracaoDaAjuda, LimiteDaAjuda } from "./tipos";

/**
 * OS MINUTOS DA AJUDA COM ATENDENTE (ADR-132) — o par do painel de quotas, com
 * o mesmo desenho (cartão por limite, janela com motivo obrigatório, histórico
 * recortado).
 *
 * A Ajuda NÃO conta tokens: o que ela custa é o tempo de conversa — vídeo do
 * avatar, que o fornecedor cobra por minuto, ou voz do mascote (ADR-158). Por
 * isso a unidade aqui é o minuto, e vale para os dois atendentes juntos.
 *
 * Em cima, QUEM atende (`PainelDoAtendente`, ADR-158): o histórico embaixo é
 * um só para os dois painéis (`prefixo="ajuda:"`), e qualquer mudança remonta.
 */
const LIMITES: Record<ChaveDeLimite, { titulo: string; explica: string; teto: number }> = {
  "minutos-por-dia": {
    titulo: "Minutos por dia",
    explica: "Quanto tempo de conversa com o atendente cada pessoa tem por dia, somando todas as conversas.",
    teto: 600,
  },
  "minutos-por-sessao": {
    titulo: "Minutos por conversa",
    explica: "A duração máxima de uma conversa. Ao chegar nela, o atendente se despede e a janela fecha.",
    teto: 60,
  },
};

function lerInteiro(texto: string): number {
  const limpo = texto.replace(/\D/g, "");
  return limpo === "" ? Number.NaN : Number(limpo);
}

export function PainelDaAjuda({
  inicial,
  configuracao,
}: {
  inicial: LimiteDaAjuda[];
  /** `null` = a api não respondeu essa parte; o painel dos minutos segue. */
  configuracao: ConfiguracaoDaAjuda | null;
}) {
  const [limites, setLimites] = useState(inicial);
  const [editando, setEditando] = useState<LimiteDaAjuda | null>(null);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mudancas, setMudancas] = useState(0);

  const reler = useCallback(async () => {
    const r = await fetch("/api/plataforma/recursos/limites-da-ajuda", { cache: "no-store" });
    if (!r.ok) {
      setErro("Os limites não recarregaram. O que você acabou de gravar pode já estar valendo — recarregue a página.");
      return;
    }
    setLimites(((await r.json()) as { limites: LimiteDaAjuda[] }).limites);
    setMudancas((n) => n + 1);
  }, []);

  const abrir = useCallback((limite: LimiteDaAjuda) => {
    setValor(String(limite.minutos));
    setMotivo("");
    setErro(null);
    setEditando(limite);
  }, []);

  const novoValor = lerInteiro(valor);
  const teto = editando ? LIMITES[editando.chave].teto : 0;
  const valorValido = Number.isInteger(novoValor) && novoValor > 0 && novoValor <= teto;
  const mudou = editando !== null && novoValor !== editando.minutos;
  const podeGravar = valorValido && mudou && motivo.trim().length >= 3 && !salvando;

  const gravar = useCallback(async () => {
    if (!editando || !podeGravar) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/plataforma/recursos/limites-da-ajuda/${editando.chave}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ minutos: novoValor, motivo: motivo.trim() }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { mensagem?: string; message?: string } | null;
        setErro(corpo?.mensagem ?? corpo?.message ?? "Não foi possível gravar. Nada mudou.");
        return;
      }
      const copy = LIMITES[editando.chave];
      setEditando(null);
      await reler();
      setAviso(`${copy.titulo}: ${novoValor}. Vale na próxima conversa aberta.`);
    } finally {
      setSalvando(false);
    }
  }, [editando, podeGravar, novoValor, motivo, reler]);

  const aoMudarAtendente = useCallback(() => setMudancas((n) => n + 1), []);

  return (
    <div className="flex flex-col gap-6">
      {configuracao ? (
        <PainelDoAtendente inicial={configuracao} aoMudar={aoMudarAtendente} />
      ) : (
        <FeedbackAlert
          type="error"
          title="Quem atende na Ajuda não carregou"
          description="A api não respondeu. Recarregue a página antes de alterar o atendente."
        />
      )}

      <SectionHeader
        title="Minutos da Ajuda"
        description="A Ajuda não usa a quota de tokens acima: o custo dela é o tempo de conversa, com o mascote ou com o atendente em vídeo. Estes limites valem para cada pessoa, na rede inteira, a partir da próxima conversa."
      />

      {erro && !editando ? <FeedbackAlert type="error" title="Não deu" description={erro} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        {limites.map((limite) => {
          const copy = LIMITES[limite.chave];
          return (
            <Card key={limite.chave} variant="outlined">
              <div className="flex h-full flex-col gap-4 py-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[16px] font-semibold text-unooria-neutral-950">{copy.titulo}</h2>
                  <p className="text-[13px] text-unooria-neutral-500">{copy.explica}</p>
                </div>
                <p className="text-[28px] font-semibold leading-none text-unooria-neutral-950">
                  {limite.minutos}
                  <span className="ml-2 text-[14px] font-normal text-unooria-neutral-600">minutos</span>
                </p>
                <div className="flex flex-col gap-1 text-[13px] text-unooria-neutral-600">
                  <p>
                    {limite.definidoPorNome
                      ? `Definido por ${limite.definidoPorNome} em ${dataHora(limite.definidoEm)}.`
                      : "Valor inicial da plataforma — ninguém alterou ainda."}
                  </p>
                  {limite.motivo ? <p className="text-unooria-neutral-700">{limite.motivo}</p> : null}
                </div>
                <div className="mt-auto">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => abrir(limite)}
                    aria-label={`Alterar ${copy.titulo.toLowerCase()} da Ajuda`}
                  >
                    Alterar
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal isOpen={editando !== null} onClose={() => (salvando ? undefined : setEditando(null))} size="sm" theme="light">
        <ModalHeader>
          <ModalTitle>{editando ? LIMITES[editando.chave].titulo : ""} da Ajuda</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <FeedbackAlert
              type="warning"
              title="Vale para a rede inteira"
              description="Todas as escolas do contrato, a partir da próxima conversa aberta. A conversa que está no ar mantém o limite com que começou."
            />
            <TextField
              id="ajuda-minutos"
              label="Minutos"
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
              error={
                valor !== "" && !valorValido
                  ? novoValor <= 0 || Number.isNaN(novoValor)
                    ? "Tem de ser maior que zero — para fechar a Ajuda, desligue o produto em Recursos."
                    : `O máximo é ${teto} minutos.`
                  : undefined
              }
              helperText={"Hoje: " + (editando ? `${editando.minutos} minutos` : "")}
            />
            <TextArea
              id="ajuda-motivo"
              label="Motivo"
              rows={3}
              placeholder="A rede contratou mais tempo de atendimento. / Semana de formação dos professores."
              helperText="Obrigatório, e fica no histórico com o valor anterior e o novo."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            {erro ? <FeedbackAlert type="error" title="Não deu" description={erro} /> : null}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" disabled={salvando} onClick={() => setEditando(null)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" disabled={!podeGravar} onClick={() => void gravar()}>
            {salvando ? "Gravando…" : "Gravar"}
          </Button>
        </ModalFooter>
      </Modal>

      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Histórico da Ajuda"
          description="Quem mudou um limite de minutos ou quem atende, quando e por quê."
        />
        <HistoricoDeRecursos key={mudancas} prefixo="ajuda:" />
      </div>

      {aviso ? <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} /> : null}
    </div>
  );
}
