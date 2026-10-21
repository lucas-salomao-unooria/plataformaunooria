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
import type { PerfilDaQuota, QuotaDeIa } from "./tipos";

/**
 * A COPY de cada perfil, e a régua que traduz tokens em coisa que se entende.
 *
 * "Token" fica: é a unidade em que o modelo cobra, e trocá-la por outra
 * palavra inventaria uma medida que não existe na fatura. O que a tela faz é
 * dizer, ao lado, quanto isso É em uso real — e as duas medidas são as que
 * foram MEDIDAS no projeto, não estimativas: uma partida completa da Missão
 * Tempestade (exp02em1b) custa ~77 mil tokens (`unoogpt/regras/defaults.ts`), e um
 * plano anual da app-90 passa de 220 mil só de prompt.
 */
const PERFIS: Record<
  PerfilDaQuota,
  { titulo: string; quemUsa: string; unidade: string; custoDaUnidade: number; porQuem: string }
> = {
  estudante: {
    titulo: "Estudantes",
    quemUsa: "O tutor do Unoovista e a Missão Tempestade.",
    unidade: "partidas completas da Missão Tempestade",
    custoDaUnidade: 77_000,
    porQuem: "por pessoa",
  },
  professor: {
    titulo: "Professores",
    quemUsa:
      "Plano de aula, planejamento de ensino, o preparo das missões (fotos, casos, mídia) e o apoio do acompanhamento de bem-estar. Gestores que venham a usar IA entram nesta régua.",
    unidade: "planos anuais gerados",
    custoDaUnidade: 220_000,
    porQuem: "por pessoa",
  },
  /* ADR-169: a leitura da PLATAFORMA para a evidência pedagógica, fora da quota
     do estudante — e o teto é POR ESCOLA, não por pessoa. A leitura de uma
     legenda custa na casa dos milhares de tokens (o modelo raciocina); 10 mil
     é a régua conservadora até o painel de custos dar o número medido. */
  avaliacao: {
    titulo: "Avaliação das missões",
    quemUsa:
      "A leitura que a plataforma faz do trabalho do estudante para medir as habilidades (a legenda dos Stories na A Seleção). Não sai da quota do estudante: avaliar não compete com o uso dele. Esgotada, a leitura vai para a revisão do professor.",
    unidade: "leituras de legenda",
    custoDaUnidade: 10_000,
    porQuem: "por escola",
  },
};

const numero = (n: number) => n.toLocaleString("pt-BR");

/** Só dígitos, como o campo aceita; vazio vira `NaN` e trava o botão. */
function lerInteiro(texto: string): number {
  const limpo = texto.replace(/\D/g, "");
  return limpo === "" ? Number.NaN : Number(limpo);
}

/** O mesmo teto de sanidade do Zod da api: um zero a mais não vira quota infinita. */
const TETO_DE_SANIDADE = 100_000_000;

export function PainelDeQuotas({ inicial }: { inicial: QuotaDeIa[] }) {
  const [quotas, setQuotas] = useState(inicial);
  const [editando, setEditando] = useState<QuotaDeIa | null>(null);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** Quantas mudanças esta montagem já gravou — a chave que remonta o histórico. */
  const [mudancas, setMudancas] = useState(0);

  const reler = useCallback(async () => {
    const r = await fetch("/api/plataforma/recursos/quotas-de-ia", { cache: "no-store" });
    if (!r.ok) {
      setErro("As quotas não recarregaram. O que você acabou de gravar pode já estar valendo — recarregue a página.");
      return;
    }
    setQuotas(((await r.json()) as { quotas: QuotaDeIa[] }).quotas);
    setMudancas((n) => n + 1);
  }, []);

  const abrir = useCallback((quota: QuotaDeIa) => {
    setValor(String(quota.tokensPorDia));
    setMotivo("");
    setErro(null);
    setEditando(quota);
  }, []);

  const novoValor = lerInteiro(valor);
  const valorValido = Number.isInteger(novoValor) && novoValor > 0 && novoValor <= TETO_DE_SANIDADE;
  const mudou = editando !== null && novoValor !== editando.tokensPorDia;
  const podeGravar = valorValido && mudou && motivo.trim().length >= 3 && !salvando;

  const gravar = useCallback(async () => {
    if (!editando || !podeGravar) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/plataforma/recursos/quotas-de-ia/${editando.perfil}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokensPorDia: novoValor, motivo: motivo.trim() }),
      });
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { mensagem?: string; message?: string } | null;
        setErro(corpo?.mensagem ?? corpo?.message ?? "Não foi possível gravar. Nada mudou.");
        return;
      }
      const copy = PERFIS[editando.perfil];
      setEditando(null);
      await reler();
      setAviso(`${copy.titulo}: ${numero(novoValor)} tokens por dia. Vale na próxima chamada de IA.`);
    } finally {
      setSalvando(false);
    }
  }, [editando, podeGravar, novoValor, motivo, reler]);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Uso de IA"
        description="Quanto de IA cada pessoa pode gastar por dia, por perfil, e quanto a avaliação das missões pode gastar por escola. O teto vale para a rede inteira e na próxima chamada — não há deploy nem reinício. O contador zera à meia-noite (UTC)."
      />

      {erro && !editando ? <FeedbackAlert type="error" title="Não deu" description={erro} /> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {quotas.map((quota) => {
          const copy = PERFIS[quota.perfil];
          const equivale = Math.floor(quota.tokensPorDia / copy.custoDaUnidade);
          return (
            <Card key={quota.perfil} variant="outlined">
              <div className="flex h-full flex-col gap-4 py-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[16px] font-semibold text-unooria-neutral-950">{copy.titulo}</h2>
                  <p className="text-[13px] text-unooria-neutral-500">{copy.quemUsa}</p>
                </div>

                <div className="flex flex-col gap-1">
                  <p className="text-[28px] font-semibold leading-none text-unooria-neutral-950">
                    {numero(quota.tokensPorDia)}
                    <span className="ml-2 text-[14px] font-normal text-unooria-neutral-600">tokens por dia</span>
                  </p>
                  <p className="text-[13px] text-unooria-neutral-600">
                    Cabe cerca de <strong>{numero(equivale)}</strong> {copy.unidade} {copy.porQuem}.
                  </p>
                </div>

                <div className="flex flex-col gap-1 text-[13px] text-unooria-neutral-600">
                  <p>
                    {quota.definidoPorNome
                      ? `Definido por ${quota.definidoPorNome} em ${dataHora(quota.definidoEm)}.`
                      : "Valor inicial da plataforma — ninguém alterou ainda."}
                  </p>
                  {quota.motivo ? <p className="text-unooria-neutral-700">{quota.motivo}</p> : null}
                </div>

                <div className="mt-auto">
                  <Button variant="secondary" size="md" onClick={() => abrir(quota)} aria-label={`Alterar a quota de ${copy.titulo.toLowerCase()}`}>
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
          <ModalTitle>Quota de {editando ? PERFIS[editando.perfil].titulo.toLowerCase() : ""}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <FeedbackAlert
              type="warning"
              title="Vale para a rede inteira"
              description="Todas as escolas do contrato, na próxima chamada de IA. Quem já passou do novo teto hoje fica sem IA até amanhã."
            />
            <TextField
              id="quota-tokens-por-dia"
              label="Tokens por dia"
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
              error={
                valor !== "" && !valorValido
                  ? novoValor <= 0 || Number.isNaN(novoValor)
                    ? "Tem de ser maior que zero — para fechar a IA de um produto, desligue o produto em Recursos."
                    : "Acima do teto de sanidade (100 milhões por dia)."
                  : undefined
              }
              helperText={
                editando && valorValido
                  ? `Cabe cerca de ${numero(Math.floor(novoValor / PERFIS[editando.perfil].custoDaUnidade))} ${PERFIS[editando.perfil].unidade} ${PERFIS[editando.perfil].porQuem}.`
                  : "Hoje: " + (editando ? numero(editando.tokensPorDia) : "")
              }
            />
            <TextArea
              id="quota-motivo"
              label="Motivo"
              rows={3}
              placeholder="A rede contratou o pacote ampliado. / Incidente #123: consumo anormal na exp02em1b."
              helperText="Obrigatório, e fica no histórico com o valor anterior e o novo. Meses depois é ele que diz se isto foi decisão comercial ou incidente."
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

      {/* O HISTÓRICO (ADR-89), recortado às quotas. `key` REMONTA a lista depois
          de cada mudança — a lista busca na montagem, e sem a chave a tela
          mentiria sobre o que ela mesma acabou de gravar (a mesma doutrina do
          painel de recursos). */}
      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Histórico"
          description="Quem mudou o teto, de quanto para quanto, quando e por quê. A linha da quota é sobrescrita a cada mudança; este registro não — nem por UPDATE, que o banco recusa."
        />
        <HistoricoDeRecursos key={mudancas} prefixo="quota:" />
      </div>

      {aviso ? <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} /> : null}
    </div>
  );
}
