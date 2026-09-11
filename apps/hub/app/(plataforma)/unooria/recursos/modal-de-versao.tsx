"use client";

import { data } from "@edu/sdk";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Selection,
  Tag,
} from "@edu/ui/ds";
import type { ExperienciaNoPainel } from "./tipos";

/**
 * A VERSÃO de uma experiência (ADR-87): o histórico, o rollback e o canário.
 *
 * DUAS ALAVANCAS, e cada uma só aparece no escopo onde faz sentido:
 *
 *  - **Ativar para a rede** — só no escopo-CONTRATO. Troca a `versao_ativa` do
 *    catálogo e RESTAURA o manifesto daquela versão (`viewport`, `permissoes`,
 *    `series`). É o rollback de verdade.
 *  - **Fixar neste escopo** — só FORA do contrato. Grava `versao_fixa` na linha
 *    daquele escopo: uma escola roda a versão nova enquanto a rede segue na
 *    anterior.
 *
 * Fixar no escopo-contrato seria uma segunda maneira, mais fraca, de fazer o
 * que "ativar" faz: ela mudaria a versão do bundle sem restaurar o manifesto —
 * e reabriria exatamente o defeito que o histórico existe para consertar (a
 * exp-70 sem `allow-pointer-lock`). Por isso a alavanca não é oferecida ali.
 */

interface VersaoPublicada {
  versao: string;
  publicadaEm: string;
  publicadaPor: string;
  ativa: boolean;
}

interface Historico {
  versaoAtiva: string;
  emRollback: boolean;
  versoes: VersaoPublicada[];
}

const dia = data;

export function ModalDeVersao({
  experiencia,
  escolaId,
  nomeDoEscopo,
  onFechar,
  onMudou,
}: {
  experiencia: ExperienciaNoPainel | null;
  escolaId: string | null;
  nomeDoEscopo: string;
  onFechar: () => void;
  onMudou: () => Promise<void>;
}) {
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [escolhida, setEscolhida] = useState<string>("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const noContrato = escolaId === null;
  const expId = experiencia?.expId ?? null;

  /** Relê o histórico. Usado ao abrir E depois de cada ação. */
  const lerHistorico = useCallback(
    async (marcarEscolhida: boolean) => {
      if (!expId) return;
      const r = await fetch(
        `/api/plataforma/recursos/experiencias/${encodeURIComponent(expId)}/versoes`,
        { cache: "no-store" },
      );
      if (!r.ok) {
        setErro("O histórico não carregou. Sem ele não há como escolher versão com segurança.");
        return;
      }
      const dados = (await r.json()) as Historico;
      setHistorico(dados);
      if (marcarEscolhida) setEscolhida(dados.versaoAtiva);
    },
    [expId],
  );

  useEffect(() => {
    if (!expId) return;
    setHistorico(null);
    setErro(null);
    setAviso(null);
    void lerHistorico(true);
  }, [expId, lerHistorico]);

  const agir = useCallback(
    async (acao: "ativar" | "fixar" | "soltar") => {
      if (!expId) return;
      setSalvando(true);
      setErro(null);
      setAviso(null);
      try {
        const base = `/api/plataforma/recursos/experiencias/${encodeURIComponent(expId)}`;
        const r =
          acao === "ativar"
            ? await fetch(`${base}/ativar`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ versao: escolhida }),
              })
            : await fetch(`${base}/versao`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  escolaId,
                  versao: acao === "soltar" ? null : escolhida,
                }),
              });

        if (!r.ok) {
          const corpo = (await r.json().catch(() => null)) as { mensagem?: string } | null;
          setErro(corpo?.mensagem ?? "Não foi possível gravar. Nada mudou.");
          return;
        }
        const corpo = (await r.json()) as { conferida?: boolean; manifestoRestaurado?: boolean };

        /* A CONFERÊNCIA NO CDN é informação de operação, não detalhe: "ativei" e
           "ativei e conferi que o bundle está lá" são garantias diferentes, e
           apontar a rede para uma versão que não subiu é tela branca para todo
           mundo. Quando não deu para conferir, a tela DIZ. */
        setAviso(
          corpo.conferida === false
            ? "Gravado, mas NÃO foi possível conferir se esta versão está no CDN — confira antes de fechar."
            : acao === "ativar"
              ? "Versão ativada para a rede, com o manifesto dela restaurado."
              : acao === "soltar"
                ? "Fixação removida: este escopo volta a seguir a versão da rede."
                : "Versão fixada neste escopo.",
        );
        /* O HISTÓRICO TAMBÉM É RELIDO, e não é zelo: o aviso "está em rollback"
           sai deste estado. Sem reler, ativar a última versão resolvia o
           rollback e a faixa amarela continuava na tela dizendo o contrário —
           a tela mentindo sobre o que ela mesma acabou de fazer. Visto no
           navegador. `false` para não mexer na versão escolhida: quem acabou
           de escolher não quer o seletor pulando de volta. */
        await lerHistorico(false);
        await onMudou();
      } finally {
        setSalvando(false);
      }
    },
    [escolaId, escolhida, expId, lerHistorico, onMudou],
  );

  if (!experiencia) return null;

  const opcoes = (historico?.versoes ?? []).map((v) => ({
    value: v.versao,
    label: `${v.versao} — ${dia(v.publicadaEm)}${v.ativa ? " (no ar)" : ""}`,
  }));

  return (
    <Modal isOpen onClose={() => (salvando ? undefined : onFechar())} size="sm" theme="light">
      <ModalHeader>
        <ModalTitle>Versão · {experiencia.nome}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tag variant="neutral" size="sm">
              no ar: v{experiencia.versaoAtiva}
            </Tag>
            {experiencia.versaoFixa ? (
              <Tag variant="info" size="sm">
                fixada aqui: v{experiencia.versaoFixa}
              </Tag>
            ) : null}
          </div>

          {historico?.emRollback ? (
            <FeedbackAlert
              type="warning"
              title="Esta experiência está em rollback"
              description="A versão no ar não é a última publicada. O próximo deploy que tocar esta experiência vai sobrescrever isto — o rollback é temporário por natureza."
            />
          ) : null}

          {erro ? <FeedbackAlert type="error" title="Não deu" description={erro} /> : null}
          {aviso ? <FeedbackAlert type="info" title="Feito" description={aviso} /> : null}

          {historico === null && !erro ? (
            <p className="text-[14px] text-unooria-neutral-500">Carregando o histórico…</p>
          ) : (
            <Selection
              id="versao-escolhida"
              label="Versão publicada"
              value={escolhida}
              options={opcoes}
              disabled={salvando || opcoes.length === 0}
              onChange={(v) => setEscolhida(String(v))}
            />
          )}

          <p className="text-[13px] text-unooria-neutral-500">
            {noContrato
              ? "Ativar troca a versão da REDE INTEIRA e restaura o manifesto daquela versão — viewport, permissões de iframe e séries voltam como eram."
              : `Fixar vale só para ${nomeDoEscopo}: é o canário. A rede segue na versão dela.`}
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="md" disabled={salvando} onClick={onFechar}>
          Fechar
        </Button>
        {noContrato ? (
          <Button
            variant="primary"
            size="md"
            disabled={salvando || !escolhida || escolhida === historico?.versaoAtiva}
            onClick={() => void agir("ativar")}
          >
            {salvando ? "Ativando…" : "Ativar para a rede"}
          </Button>
        ) : (
          <>
            {experiencia.versaoFixa ? (
              <Button
                variant="secondary"
                size="md"
                disabled={salvando}
                onClick={() => void agir("soltar")}
              >
                Soltar a fixação
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="md"
              disabled={salvando || !escolhida || escolhida === experiencia.versaoFixa}
              onClick={() => void agir("fixar")}
            >
              {salvando ? "Fixando…" : "Fixar neste escopo"}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}
