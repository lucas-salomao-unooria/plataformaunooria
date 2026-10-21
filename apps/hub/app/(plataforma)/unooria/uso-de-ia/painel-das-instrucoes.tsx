"use client";

import { useState } from "react";
import {
  Button,
  Card,
  FeedbackAlert,
  Icon,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Tag,
  TextArea,
} from "@edu/ui/ds";
import type { Atendente, CamposDaConfiguracao, ConfiguracaoDaAjuda } from "./tipos";

/**
 * AS INSTRUÇÕES DE CADA ATENDENTE (ADR-165) — o "como responder" do prompt do
 * mascote e do avatar, editável pelo `admin`.
 *
 * Só o comportamento é editável. O conhecimento da plataforma (o mapa de
 * produto e os guias da aula) e quem está perguntando a api acrescenta sempre,
 * depois deste texto: uma edição não consegue tirar a base do prompt. O texto
 * fica no banco e só a api o lê (regra 2) — o navegador de quem pergunta nunca
 * o recebe.
 *
 * Texto igual ao padrão (ou vazio) grava "padrão": quando o texto do código
 * melhorar, a rede que nunca personalizou recebe a melhoria.
 */

const MAXIMO = 8_000;
const MINIMO = 20;

const ATENDENTES: Array<{ id: Atendente; nome: string; campo: "instrucoesMascote" | "instrucoesAvatar" }> = [
  { id: "mascote", nome: "Mascote da Unooria", campo: "instrucoesMascote" },
  { id: "avatar", nome: "Atendente em vídeo", campo: "instrucoesAvatar" },
];

function camposDe(c: ConfiguracaoDaAjuda): CamposDaConfiguracao {
  return {
    atendentePadrao: c.atendentePadrao,
    permitirTroca: c.permitirTroca,
    mascoteVoz: c.mascoteVoz,
    mascoteModelo: c.mascoteModelo,
    mascoteSensibilidade: c.mascoteSensibilidade,
    mascoteSuavizacao: c.mascoteSuavizacao,
    mascoteAntecipacaoMs: c.mascoteAntecipacaoMs,
    mascoteBocaRepouso: c.mascoteBocaRepouso,
    instrucoesMascote: c.instrucoesMascote,
    instrucoesAvatar: c.instrucoesAvatar,
  };
}

/** O que vai ao banco: igual ao padrão, ou vazio, é `null` (vale o padrão). */
function paraGravar(texto: string, padrao: string): string | null {
  const limpo = texto.trim();
  return limpo === "" || limpo === padrao.trim() ? null : limpo;
}

const curtoDemais = (texto: string) => texto.trim() !== "" && texto.trim().length < MINIMO;

export function PainelDasInstrucoes({
  config,
  aoGravar,
}: {
  config: ConfiguracaoDaAjuda;
  aoGravar: (nova: ConfiguracaoDaAjuda) => void;
}) {
  const [rascunho, setRascunho] = useState<Record<Atendente, string> | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const abrir = () => {
    setRascunho({
      mascote: config.instrucoesMascote ?? config.instrucoesPadrao.mascote,
      avatar: config.instrucoesAvatar ?? config.instrucoesPadrao.avatar,
    });
    setMotivo("");
    setErro(null);
  };

  const novos = rascunho
    ? {
        instrucoesMascote: paraGravar(rascunho.mascote, config.instrucoesPadrao.mascote),
        instrucoesAvatar: paraGravar(rascunho.avatar, config.instrucoesPadrao.avatar),
      }
    : null;
  const valido = rascunho !== null && !curtoDemais(rascunho.mascote) && !curtoDemais(rascunho.avatar);
  const mudou =
    novos !== null &&
    (novos.instrucoesMascote !== config.instrucoesMascote || novos.instrucoesAvatar !== config.instrucoesAvatar);
  const podeGravar = valido && mudou && motivo.trim().length >= 3 && !salvando;

  const gravar = async () => {
    if (!novos || !podeGravar) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/plataforma/recursos/configuracao-da-ajuda", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...camposDe(config), ...novos, motivo: motivo.trim() }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { mensagem?: string; message?: string } | null;
        setErro(corpo?.mensagem ?? corpo?.message ?? "Não foi possível gravar. Nada mudou.");
        return;
      }
      setRascunho(null);
      aoGravar((await r.json()) as ConfiguracaoDaAjuda);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Card variant="outlined">
        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] font-semibold text-unooria-neutral-950">Instruções de cada atendente</h2>
            <p className="text-[13px] text-unooria-neutral-600">
              O jeito de responder: tom, tamanho da resposta e o que evitar. O conhecimento da plataforma e quem está
              perguntando entram sempre depois deste texto.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {ATENDENTES.map((a) => {
              const personalizado = config[a.campo] !== null;
              const texto = config[a.campo] ?? config.instrucoesPadrao[a.id];
              return (
                <div key={a.id} className="flex min-w-0 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-unooria-neutral-900">{a.nome}</span>
                    <Tag variant={personalizado ? "info" : "neutral"} size="sm" pill>
                      {personalizado ? "Personalizado" : "Texto padrão"}
                    </Tag>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-line text-[13px] text-unooria-neutral-700">{texto}</p>
                </div>
              );
            })}
          </div>

          <div>
            <Button
              variant="secondary"
              size="md"
              onClick={abrir}
              leftIcon={<Icon name="edit" size="xs" color="currentColor" aria-hidden />}
            >
              Editar instruções
            </Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={rascunho !== null} onClose={() => (salvando ? undefined : setRascunho(null))} size="lg" theme="light">
        <ModalHeader>
          <ModalTitle>Instruções de cada atendente</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {rascunho ? (
            <div className="flex flex-col gap-5">
              <FeedbackAlert
                type="info"
                title="O que este texto muda"
                description="O jeito de responder, na rede inteira, a partir da próxima pergunta. O conhecimento da plataforma (o mapa de produto e os guias da aula) e quem está perguntando entram sempre depois deste texto — não precisam estar aqui."
              />
              {ATENDENTES.map((a) => {
                const padrao = config.instrucoesPadrao[a.id];
                const igualAoPadrao = rascunho[a.id].trim() === padrao.trim();
                return (
                  <div key={a.id} className="flex flex-col gap-2">
                    <TextArea
                      id={`ajuda-instrucoes-${a.id}`}
                      label={a.nome}
                      rows={12}
                      resize="vertical"
                      maxLength={MAXIMO}
                      showCounter
                      value={rascunho[a.id]}
                      onChange={(e) => setRascunho((r) => (r ? { ...r, [a.id]: e.target.value } : r))}
                      error={
                        curtoDemais(rascunho[a.id])
                          ? `Escreva pelo menos ${MINIMO} caracteres, ou deixe vazio para usar o texto padrão.`
                          : undefined
                      }
                      helperText={igualAoPadrao ? "Este é o texto padrão da plataforma." : "Personalizado para esta rede."}
                    />
                    {!igualAoPadrao ? (
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRascunho((r) => (r ? { ...r, [a.id]: padrao } : r))}
                          leftIcon={<Icon name="restart_alt" size="xs" color="currentColor" aria-hidden />}
                        >
                          Restaurar o texto padrão
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <TextArea
                id="ajuda-instrucoes-motivo"
                label="Motivo"
                rows={3}
                placeholder="O mascote estava respondendo longo demais. / Tom mais formal para a rede estadual."
                helperText="Obrigatório, e fica no histórico."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              {erro ? <FeedbackAlert type="error" title="Não deu" description={erro} /> : null}
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" disabled={salvando} onClick={() => setRascunho(null)}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" disabled={!podeGravar} onClick={() => void gravar()}>
            {salvando ? "Gravando…" : "Gravar"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
