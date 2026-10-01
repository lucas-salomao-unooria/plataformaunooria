"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  FeedbackAlert,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  SectionHeader,
  Selection,
  Snackbar,
  Tag,
  TextArea,
} from "@edu/ui/ds";
import { buscarProduto, type CopyDoProduto, type SlugDeProduto } from "@/lib/produtos";
import { HistoricoDeRecursos } from "@/components/historico-de-recursos";
import { ModalDeVersao } from "./modal-de-versao";
import type {
  EscolaDoEscopo,
  EstadoAqui,
  ExperienciaNoPainel,
  Painel,
  ProdutoNoPainel,
} from "./tipos";

/** O rótulo do escopo-contrato. Aparece no seletor e no diálogo de confirmação. */
const ESCOPO_CONTRATO = "__contrato__";

/**
 * O rótulo de `herda` DEPENDE do escopo, e isso não é cosmético.
 *
 * No contrato não existe "de cima": ali `herda` é o padrão do código, que é
 * LIGADO. Numa escola, `herda` é seguir a regional ou o contrato. Chamar as duas
 * coisas de "Herda" faria o operador do escopo-contrato procurar um nível que
 * não existe.
 */
function rotuloDeHerda(noContrato: boolean): string {
  return noContrato ? "Padrão (ligado)" : "Herda de cima";
}

function opcoesDoInterruptor(noContrato: boolean) {
  return [
    { value: "herda", label: rotuloDeHerda(noContrato) },
    { value: "ligado", label: "Ligado" },
    { value: "desligado", label: "Desligado" },
  ];
}

/** A frase que explica DE ONDE vem o estado que está valendo. */
function explicacaoDoEfetivo(item: ProdutoNoPainel | ExperienciaNoPainel): string {
  const { efetivo } = item;
  if ("tetoDoProduto" in item && item.tetoDoProduto) {
    return "O produto está desligado neste escopo — nada dentro dele abre.";
  }
  if (efetivo.origem === "padrao") return "Ninguém decidiu: vale o padrão, que é ligado.";
  if (efetivo.origem === "aqui") {
    return efetivo.motivo
      ? `Decidido neste escopo: ${efetivo.motivo}`
      : "Decidido neste escopo.";
  }
  if (efetivo.origem === "contrato") {
    const base = "Vem da rede (contrato inteiro)";
    return efetivo.motivo ? `${base}: ${efetivo.motivo}` : `${base}.`;
  }
  const onde = efetivo.decididoEm ?? "um escopo acima";
  const base = `Herdado de ${onde}`;
  return efetivo.motivo ? `${base}: ${efetivo.motivo}` : `${base}.`;
}

/** O que uma mudança pede à api. `herda` é DELETE; os outros dois são PUT. */
type Pendente = {
  recursoId: string;
  rotulo: string;
  destino: EstadoAqui;
};

/**
 * O PAINEL: um cartão por produto, e dentro dele as experiências que o manifesto
 * declarou como parte dele (`experiencias.produto`). Nenhuma lista à mão aqui —
 * é isso que faz a experiência nova aparecer sozinha.
 *
 * Três estados por interruptor, e não dois: sem `herda`, "ligado nesta escola"
 * fica idêntico a "herdado ligado" e desfazer a exceção é impossível.
 */
export function PainelDeRecursos({
  inicial,
  escolas,
}: {
  inicial: Painel;
  escolas: EscolaDoEscopo[];
}) {
  const router = useRouter();
  const [painel, setPainel] = useState(inicial);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  /** A experiência cuja janela de versão está aberta. */
  const [versaoDe, setVersaoDe] = useState<ExperienciaNoPainel | null>(null);
  /** Quantas mudanças esta montagem já gravou — a chave que remonta o
   *  histórico. Ver o bloco do Histórico, no fim do arquivo. */
  const [mudancas, setMudancas] = useState(0);
  const [navegando] = useTransition();

  const escolaId = painel.escopo.escolaId;
  const noContrato = escolaId === null;

  const opcoesDeEscopo = useMemo(() => {
    /* Regionais antes das escolas, como na tela de Regionais: é a ordem da
       hierarquia (rede → regional → escola), e quem chega lê de cima para
       baixo. */
    const regionais = escolas.filter((e) => e.tipo === "regional");
    const unidades = escolas.filter((e) => e.tipo !== "regional");
    return [
      { value: ESCOPO_CONTRATO, label: "Rede (contrato inteiro)" },
      ...regionais.map((e) => ({ value: e.id, label: `Regional · ${e.nome}` })),
      ...unidades.map((e) => ({
        value: e.id,
        label: e.pai ? `${e.nome} — ${e.pai}` : e.nome,
      })),
    ];
  }, [escolas]);

  const trocarEscopo = useCallback(
    (valor: string) => {
      /* O escopo vai para a URL: é o que faz recarregar, compartilhar o link e
         voltar pelo histórico caírem no mesmo lugar. */
      router.push(valor === ESCOPO_CONTRATO ? "/unooria/recursos" : `/unooria/recursos?escolaId=${valor}`);
    },
    [router],
  );

  const reler = useCallback(async () => {
    const url = escolaId
      ? `/api/plataforma/recursos/painel?escolaId=${encodeURIComponent(escolaId)}`
      : "/api/plataforma/recursos/painel";
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      setErro("O painel não recarregou. O que você acabou de mudar pode já estar valendo — recarregue a página.");
      return;
    }
    setPainel((await r.json()) as Painel);
    /* Toda releitura do painel acontece DEPOIS de uma escrita — é o único
       momento em que o histórico mudou. Contar aqui cobre as duas alavancas
       (o interruptor e a janela de versão) sem cada uma ter de lembrar. */
    setMudancas((n) => n + 1);
  }, [escolaId]);

  /** `herda` some a linha; `ligado`/`desligado` a gravam. */
  const aplicar = useCallback(
    async (alvo: Pendente, motivoDado: string) => {
      setSalvando(true);
      setErro(null);
      try {
        const base = `/api/plataforma/recursos/${encodeURIComponent(alvo.recursoId)}`;
        const r =
          alvo.destino === "herda"
            ? await fetch(escolaId ? `${base}?escolaId=${encodeURIComponent(escolaId)}` : base, {
                method: "DELETE",
              })
            : await fetch(base, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  escolaId,
                  ligado: alvo.destino === "ligado",
                  ...(alvo.destino === "desligado" ? { motivo: motivoDado } : {}),
                }),
              });

        if (!r.ok) {
          const corpo = (await r.json().catch(() => null)) as { mensagem?: string } | null;
          setErro(corpo?.mensagem ?? "Não foi possível gravar. Nada mudou.");
          return;
        }
        setPendente(null);
        setMotivo("");
        await reler();
        setAviso(
          alvo.destino === "herda"
            ? `${alvo.rotulo}: exceção removida.`
            : `${alvo.rotulo}: ${alvo.destino}.`,
        );
      } finally {
        setSalvando(false);
      }
    },
    [escolaId, reler],
  );

  /**
   * DESLIGAR SEMPRE PASSA PELO DIÁLOGO, e não é zelo: o motivo é obrigatório (o
   * banco recusa sem ele), e no escopo-contrato um clique alcança a rede inteira
   * — os ~10 mil estudantes de um contrato. É a consequência ruim que a ADR-87
   * registra, e este diálogo é a mitigação que ela nomeia.
   */
  const pedirMudanca = useCallback(
    (recursoId: string, rotulo: string, destino: EstadoAqui) => {
      if (destino === "desligado") {
        setMotivo("");
        setPendente({ recursoId, rotulo, destino });
        return;
      }
      void aplicar({ recursoId, rotulo, destino }, "");
    },
    [aplicar],
  );

  const ocupado = salvando || navegando;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Recursos da rede"
        description="O que esta rede tem no ar. Desligar fecha para todo mundo no escopo escolhido — a liberação por turma do professor continua onde está e volta a valer quando você religar."
      />

      <Card variant="outlined">
        <div className="flex flex-col gap-2 py-2">
          <div className="max-w-[420px]">
            <Selection
              id="escopo-do-painel"
              label="Escopo"
              value={escolaId ?? ESCOPO_CONTRATO}
              options={opcoesDeEscopo}
              onChange={(v) => trocarEscopo(String(v))}
            />
          </div>
          <p className="text-[13px] text-unooria-neutral-500">
            O escopo mais específico ganha: escola, depois a regional dela, depois a rede.
          </p>
        </div>
      </Card>

      {erro ? <FeedbackAlert type="error" title="Não deu" description={erro} /> : null}

      {painel.produtos.map((produto) => {
        const copy = copyDoProduto(produto.slug);
        const recursoId = `produto:${produto.slug}`;
        return (
          <Card key={produto.slug} variant="outlined">
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-semibold text-unooria-neutral-950">
                      {copy?.nome ?? produto.slug}
                    </h2>
                    <Badge variant={produto.efetivo.ligado ? "success" : "error"}>
                      {produto.efetivo.ligado ? "no ar" : "desligado"}
                    </Badge>
                  </div>
                  <p className="text-[13px] text-unooria-neutral-500">
                    {explicacaoDoEfetivo(produto)}
                  </p>
                </div>
                <div className="w-[200px]">
                  <Selection
                    id={`interruptor-${produto.slug}`}
                    label="Neste escopo"
                    value={produto.estadoAqui}
                    options={opcoesDoInterruptor(noContrato)}
                    disabled={ocupado}
                    onChange={(v) =>
                      pedirMudanca(recursoId, copy?.nome ?? produto.slug, String(v) as EstadoAqui)
                    }
                  />
                </div>
              </div>

              {produto.experiencias.length === 0 ? (
                <p className="text-[13px] text-unooria-neutral-500">
                  Nenhuma experiência declara este produto no manifesto ainda.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-unooria-neutral-200 border-t border-unooria-neutral-200">
                  {produto.experiencias.map((exp) => (
                    <li
                      key={exp.expId}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="flex min-w-[240px] flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-medium text-unooria-neutral-800">
                            {exp.nome}
                          </span>
                          {/* A etiqueta da versão é o BOTÃO da janela de versão:
                              é onde a mão vai, e um botão "Versão" separado
                              repetiria a informação que a etiqueta já dá. */}
                          <button
                            type="button"
                            className="cursor-pointer"
                            onClick={() => setVersaoDe(exp)}
                            aria-label={`Versão de ${exp.nome}`}
                          >
                            <Tag variant={exp.versaoFixa ? "info" : "neutral"} size="sm" clickable>
                              v{exp.versaoFixa ?? exp.versaoAtiva}
                              {exp.versaoFixa ? " · fixada" : ""}
                            </Tag>
                          </button>
                        </div>
                        <span className="text-[12px] text-unooria-neutral-500">
                          {exp.expId} · {explicacaoDoEfetivo(exp)}
                        </span>
                      </div>
                      <div className="w-[200px]">
                        <Selection
                          id={`interruptor-${exp.expId}`}
                          label="Neste escopo"
                          value={exp.estadoAqui}
                          options={opcoesDoInterruptor(noContrato)}
                          /* Desabilitado quando o TETO do produto é quem fechou:
                             mostrar o controle ativo aqui prometeria uma mudança
                             que o resolvedor ignoraria. O motivo fica ao lado, e
                             o controle NÃO desaparece — controle que some parece
                             defeito. */
                          disabled={ocupado || exp.tetoDoProduto}
                          onChange={(v) =>
                            pedirMudanca(
                              `experiencia:${exp.expId}`,
                              exp.nome,
                              String(v) as EstadoAqui,
                            )
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        );
      })}

      <Modal
        isOpen={pendente !== null}
        onClose={() => (salvando ? undefined : setPendente(null))}
        size="sm"
        theme="light"
      >
        <ModalHeader>
          <ModalTitle>Desligar {pendente?.rotulo}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            {noContrato ? (
              <FeedbackAlert
                type="warning"
                title="Isto vale para a REDE INTEIRA"
                description="Todas as escolas do contrato. Quem estiver dentro agora termina a sessão; ninguém mais entra."
              />
            ) : (
              <p className="text-[14px] text-unooria-neutral-700">
                Vale para <strong>{painel.escopo.nome}</strong> e para o que estiver abaixo dela.
              </p>
            )}
            <TextArea
              id="motivo-do-desligamento"
              label="Motivo"
              rows={3}
              placeholder="Não contratado neste termo. / Incidente #123: a missão abre em branco."
              helperText="Obrigatório, e fica no painel. Seis meses depois é ele que diz se isto foi decisão comercial ou incidente que ninguém reverteu."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" size="md" disabled={salvando} onClick={() => setPendente(null)}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={salvando || motivo.trim().length < 3}
            onClick={() => pendente && aplicar(pendente, motivo.trim())}
          >
            {salvando ? "Desligando…" : "Desligar"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* O HISTÓRICO (ADR-89) fecha a tela, e a chave é o ESCOPO: trocar de
          escopo remonta o painel inteiro, e com ele esta lista — que passa a
          mostrar o que aconteceu naquele escopo mais o que a rede decidiu. */}
      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Histórico"
          description="Quem mudou o quê, quando e por quê. A linha de disponibilidade é sobrescrita a cada mudança; este registro não — nem por UPDATE, que o banco recusa."
        />
        {/* `key` REMONTA a lista depois de cada mudança, e sem isso a tela
            MENTE sobre o que ela mesma acabou de fazer: o histórico busca na
            montagem, então desligar um produto deixava a lista sem a linha que
            o desligamento acabou de gravar — quem operasse duas vezes veria a
            primeira mudança e não a segunda. É o mesmo defeito que a janela de
            versão teve com a faixa de rollback, e a mesma doutrina do
            `key={escopo}` da página (ADR-85): escopo e nonce são INSUMO da
            lista, e insumo novo remonta em vez de sincronizar estado. */}
        <HistoricoDeRecursos key={mudancas} escolaId={escolaId} />
      </div>

      <ModalDeVersao
        experiencia={versaoDe}
        escolaId={escolaId}
        nomeDoEscopo={painel.escopo.nome}
        onFechar={() => setVersaoDe(null)}
        onMudou={async () => {
          await reler();
          /* A janela fica ABERTA depois de gravar: quem ativa uma versão quer
             ver o aviso da conferência no CDN, e fechar por cima dele
             esconderia justamente a informação que decide se o trabalho
             acabou. Quem fecha é a pessoa. */
        }}
      />

      {aviso ? (
        <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} />
      ) : null}
    </div>
  );
}

/** A copy do produto vive em `lib/produtos.ts`; slug desconhecido não quebra a
 *  tela — ele aparece pelo próprio slug, que é o que o operador precisa ver. */
function copyDoProduto(slug: string): CopyDoProduto | null {
  try {
    return buscarProduto(slug as SlugDeProduto);
  } catch {
    return null;
  }
}
