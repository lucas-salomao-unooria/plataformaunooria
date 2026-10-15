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
  RadioGroup,
  SectionHeader,
  Selection,
  Snackbar,
  Tag,
  TextArea,
  TextField,
  Toggle,
} from "@edu/ui/ds";
import { PainelDasInstrucoes } from "./painel-das-instrucoes";
import type { Atendente, CamposDaConfiguracao, ConfiguracaoDaAjuda } from "./tipos";

/**
 * QUEM ATENDE NA AJUDA (ADR-158) — o par dos minutos, no mesmo desenho
 * (cartão com o que vale, janela com motivo obrigatório, histórico embaixo).
 *
 * Dois atendentes: o MASCOTE da Unooria (o modelo 3D falando pelo Gemini Live)
 * e o AVATAR em vídeo (LiveAvatar). O `admin` escolhe o padrão da rede, se a
 * pessoa pode trocar dentro da janela, e os ajustes do mascote — a voz, o
 * modelo do Live e a boca (os mesmos controles do teste do mascote).
 *
 * O DS não publica controle deslizante: os ajustes da boca são `TextField`
 * numéricos com a faixa no texto de apoio — a mesma faixa que o Zod e o CHECK
 * da api cobram.
 */

const NOME: Record<Atendente, string> = { mascote: "Mascote da Unooria", avatar: "Atendente em vídeo" };
const EXPLICA: Record<Atendente, string> = {
  mascote: "O mascote 3D da Unooria conversa por voz e por escrito. A boca acompanha a fala.",
  avatar: "Uma pessoa em vídeo (avatar do fornecedor) conversa por voz e por escrito.",
};

type CampoDeAjuste = "mascoteSensibilidade" | "mascoteSuavizacao" | "mascoteAntecipacaoMs" | "mascoteBocaRepouso";

interface Ajuste {
  campo: CampoDeAjuste;
  rotulo: string;
  explica: string;
  min: number;
  max: number;
  inteiro: boolean;
}

const AJUSTES: Ajuste[] = [
  {
    campo: "mascoteSensibilidade",
    rotulo: "Sensibilidade da boca",
    explica: "De 0 a 1. Mais alto, a boca abre até com a fala baixa.",
    min: 0,
    max: 1,
    inteiro: false,
  },
  {
    campo: "mascoteSuavizacao",
    rotulo: "Suavização",
    explica: "De 0 a 1. Mais alto, a boca abre e fecha mais devagar.",
    min: 0,
    max: 1,
    inteiro: false,
  },
  {
    campo: "mascoteAntecipacaoMs",
    rotulo: "Antecipação (milissegundos)",
    explica: "De 0 a 200. Quanto a boca se mexe antes do som, como na fala de verdade.",
    min: 0,
    max: 200,
    inteiro: true,
  },
  {
    campo: "mascoteBocaRepouso",
    rotulo: "Boca parada",
    explica: "De 0 a 1. Em silêncio: 0 é a boca fechada, 1 é o sorriso do desenho.",
    min: 0,
    max: 1,
    inteiro: false,
  },
];

const MODELO_RE = /^[a-z0-9][a-z0-9.-]{2,80}$/;

type Rascunho = Omit<CamposDaConfiguracao, CampoDeAjuste> & Record<CampoDeAjuste, string>;

function paraRascunho(c: CamposDaConfiguracao): Rascunho {
  return {
    atendentePadrao: c.atendentePadrao,
    permitirTroca: c.permitirTroca,
    mascoteVoz: c.mascoteVoz,
    mascoteModelo: c.mascoteModelo,
    mascoteSensibilidade: String(c.mascoteSensibilidade).replace(".", ","),
    mascoteSuavizacao: String(c.mascoteSuavizacao).replace(".", ","),
    mascoteAntecipacaoMs: String(c.mascoteAntecipacaoMs),
    mascoteBocaRepouso: String(c.mascoteBocaRepouso).replace(".", ","),
    // As instruções têm janela própria (`PainelDasInstrucoes`): aqui só seguem como estão.
    instrucoesMascote: c.instrucoesMascote,
    instrucoesAvatar: c.instrucoesAvatar,
  };
}

/** O número de um campo, ou `null` fora da faixa. Aceita vírgula (é como se escreve aqui). */
function lerAjuste(a: Ajuste, texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  const n = Number(limpo);
  if (limpo === "" || !Number.isFinite(n) || n < a.min || n > a.max) return null;
  if (a.inteiro && !Number.isInteger(n)) return null;
  return n;
}

const CAMPOS: Array<keyof CamposDaConfiguracao> = [
  "atendentePadrao",
  "permitirTroca",
  "mascoteVoz",
  "mascoteModelo",
  "mascoteSensibilidade",
  "mascoteSuavizacao",
  "mascoteAntecipacaoMs",
  "mascoteBocaRepouso",
];

export function PainelDoAtendente({ inicial, aoMudar }: { inicial: ConfiguracaoDaAjuda; aoMudar: () => void }) {
  const [config, setConfig] = useState(inicial);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const abrir = useCallback(() => {
    setRascunho(paraRascunho(config));
    setMotivo("");
    setErro(null);
  }, [config]);

  const mudar = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) =>
    setRascunho((r) => (r ? { ...r, [campo]: valor } : r));

  const lidos = rascunho ? AJUSTES.map((a) => ({ ajuste: a, valor: lerAjuste(a, rascunho[a.campo]) })) : [];
  const modeloValido = rascunho ? MODELO_RE.test(rascunho.mascoteModelo.trim()) : false;
  const valido = rascunho !== null && modeloValido && lidos.every((l) => l.valor !== null);
  const proposta: CamposDaConfiguracao | null =
    rascunho && valido
      ? {
          atendentePadrao: rascunho.atendentePadrao,
          permitirTroca: rascunho.permitirTroca,
          mascoteVoz: rascunho.mascoteVoz,
          mascoteModelo: rascunho.mascoteModelo.trim(),
          instrucoesMascote: rascunho.instrucoesMascote,
          instrucoesAvatar: rascunho.instrucoesAvatar,
          ...(Object.fromEntries(lidos.map((l) => [l.ajuste.campo, l.valor])) as Record<CampoDeAjuste, number>),
        }
      : null;
  const mudou = proposta !== null && CAMPOS.some((c) => proposta[c] !== config[c]);
  const podeGravar = proposta !== null && mudou && motivo.trim().length >= 3 && !salvando;

  const gravar = async () => {
    if (!proposta || !podeGravar) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/plataforma/recursos/configuracao-da-ajuda", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...proposta, motivo: motivo.trim() }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { mensagem?: string; message?: string } | null;
        setErro(corpo?.mensagem ?? corpo?.message ?? "Não foi possível gravar. Nada mudou.");
        return;
      }
      setConfig((await r.json()) as ConfiguracaoDaAjuda);
      setRascunho(null);
      aoMudar();
      setAviso("Configuração da Ajuda gravada. Vale na próxima conversa aberta.");
    } finally {
      setSalvando(false);
    }
  };

  const padraoMontado = config.disponiveis[config.atendentePadrao];
  const outro: Atendente = config.atendentePadrao === "mascote" ? "avatar" : "mascote";
  const jeitoDaVoz = config.vozes.find((v) => v.nome === config.mascoteVoz)?.jeito;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Quem atende na Ajuda"
        description="O atendente que abre quando alguém clica em Ajuda, em toda a rede. Os minutos abaixo valem para os dois."
      />

      {!padraoMontado ? (
        <FeedbackAlert
          type="warning"
          title={`${NOME[config.atendentePadrao]} não está disponível neste ambiente`}
          description={
            config.disponiveis[outro]
              ? `Enquanto isso, a Ajuda abre com o ${NOME[outro].toLowerCase()}.`
              : "Nenhum dos dois atendentes está disponível neste ambiente: a Ajuda não abre."
          }
        />
      ) : null}

      <Card variant="outlined">
        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-[13px] text-unooria-neutral-500">Atendente padrão</p>
              <h2 className="text-[20px] font-semibold text-unooria-neutral-950">{NOME[config.atendentePadrao]}</h2>
              <p className="text-[13px] text-unooria-neutral-600">{EXPLICA[config.atendentePadrao]}</p>
            </div>
            <Tag variant={config.permitirTroca ? "success" : "neutral"} size="sm" pill>
              {config.permitirTroca ? "A pessoa pode trocar de atendente" : "Sem troca de atendente"}
            </Tag>
          </div>

          <div className="grid gap-4 text-[13px] text-unooria-neutral-700 sm:grid-cols-2 lg:grid-cols-3">
            <p>
              <span className="text-unooria-neutral-500">Voz do mascote: </span>
              {config.mascoteVoz}
              {jeitoDaVoz ? ` (${jeitoDaVoz})` : ""}
            </p>
            <p>
              <span className="text-unooria-neutral-500">Modelo de voz: </span>
              {config.mascoteModelo}
            </p>
            {AJUSTES.map((a) => (
              <p key={a.campo}>
                <span className="text-unooria-neutral-500">{a.rotulo}: </span>
                {String(config[a.campo]).replace(".", ",")}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-1 text-[13px] text-unooria-neutral-600">
            <p>
              {config.definidoPorNome
                ? `Definido por ${config.definidoPorNome} em ${dataHora(config.definidoEm)}.`
                : "Valor inicial da plataforma — ninguém alterou ainda."}
            </p>
            {config.motivo ? <p className="text-unooria-neutral-700">{config.motivo}</p> : null}
          </div>

          <div>
            <Button variant="secondary" size="md" onClick={abrir} aria-label="Alterar quem atende na Ajuda">
              Alterar
            </Button>
          </div>
        </div>
      </Card>

      <Modal isOpen={rascunho !== null} onClose={() => (salvando ? undefined : setRascunho(null))} size="md" theme="light">
        <ModalHeader>
          <ModalTitle>Quem atende na Ajuda</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {rascunho ? (
            <div className="flex flex-col gap-5">
              <FeedbackAlert
                type="warning"
                title="Vale para a rede inteira"
                description="Todas as escolas do contrato, a partir da próxima conversa aberta. A conversa que está no ar continua como começou."
              />
              <RadioGroup
                label="Atendente padrão"
                name="atendente-padrao"
                value={rascunho.atendentePadrao}
                onChange={(v) => mudar("atendentePadrao", v === "avatar" ? "avatar" : "mascote")}
                options={(["mascote", "avatar"] as const).map((a) => ({
                  value: a,
                  label: NOME[a],
                  helperText: config.disponiveis[a] ? EXPLICA[a] : `${EXPLICA[a]} Não está disponível neste ambiente.`,
                }))}
              />
              <Toggle
                id="ajuda-permitir-troca"
                checked={rascunho.permitirTroca}
                onChange={(marcado) => mudar("permitirTroca", marcado)}
                label="Deixar a pessoa trocar de atendente"
                description="Na janela da Ajuda aparece um botão para conversar com o outro atendente."
              />
              <Selection
                label="Voz do mascote"
                value={rascunho.mascoteVoz}
                onChange={(v) => mudar("mascoteVoz", Array.isArray(v) ? (v[0] ?? rascunho.mascoteVoz) : v)}
                options={config.vozes.map((v) => ({ value: v.nome, label: `${v.nome} (${v.jeito})` }))}
                fullWidth
                maxBoxHeight={240}
              />
              <TextField
                id="ajuda-modelo"
                label="Modelo de voz do mascote"
                value={rascunho.mascoteModelo}
                onChange={(e) => mudar("mascoteModelo", e.target.value)}
                error={rascunho.mascoteModelo !== "" && !modeloValido ? "Use o nome do modelo, por exemplo gemini-3.8-live." : undefined}
                helperText="O modelo do Gemini Live que dá a voz ao mascote. Troque só se o Google publicar um novo."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {lidos.map(({ ajuste, valor }) => (
                  <TextField
                    key={ajuste.campo}
                    id={`ajuda-${ajuste.campo}`}
                    label={ajuste.rotulo}
                    inputMode={ajuste.inteiro ? "numeric" : "decimal"}
                    value={rascunho[ajuste.campo]}
                    onChange={(e) => mudar(ajuste.campo, e.target.value)}
                    error={valor === null ? `Um número de ${ajuste.min} a ${ajuste.max}.` : undefined}
                    helperText={ajuste.explica}
                  />
                ))}
              </div>
              <TextArea
                id="ajuda-configuracao-motivo"
                label="Motivo"
                rows={3}
                placeholder="O mascote fica como padrão na rede. / A voz Puck soou mais animada no teste com professores."
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

      <PainelDasInstrucoes
        config={config}
        aoGravar={(nova) => {
          setConfig(nova);
          aoMudar();
          setAviso("Instruções gravadas. No atendente em vídeo valem na próxima pergunta; no mascote, na próxima conversa.");
        }}
      />

      {aviso ? <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} /> : null}
    </div>
  );
}
