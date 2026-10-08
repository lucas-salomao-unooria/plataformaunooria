"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, FeedbackAlert, SectionHeader, Snackbar, Tabs } from "@edu/ui/ds";
import {
  AJUSTES_MAX,
  MARCA_A_REVISAR,
  MARCA_DA_ORIGEM,
  RESULTADO,
  ROTULO_DO_STATUS,
  ajustesEmMassa,
  caminhoDoPainel,
  celula,
  comRodadaEmAndamento,
  erroDaApi,
  recorteDoValor,
  recorteInicial,
  resumoPendentes,
  resumoPendentesParaLeitura,
  rodadaSemRegistro,
  rodadasComPendentes,
  rodadasDoPainel,
  rotuloDoRecorte,
  valorDoRecorte,
  type AjusteDeEvidencia,
  type EstudanteDoPainel,
  type PainelDeHabilidades as Painel,
  type RecorteDoPainel,
  type StatusDaEvidencia,
} from "@/lib/evidencias";

import { AjustarCelula, type CelulaEmAjuste } from "./ajustar-celula";
import { AjustarSelecionados } from "./ajustar-selecionados";
import { ErroDoPainel, type Erro } from "./erro-do-painel";
import { TabelaDeHabilidades } from "./tabela-de-habilidades";

type Props = {
  turmaId: string;
  expId: string;
  atividadeId: string;
  inicial: Painel;
  /** Só o professor confirma e ajusta. A coordenação lê (e a api recusaria o resto). */
  podeEditar: boolean;
  /**
   * A rodada que a missão tem EM ANDAMENTO nesta atividade, ou `null`. Ganha
   * aba mesmo sem evidência: sem isto, a rodada aberta pelo "Zerar" só
   * aparecia depois de alguém jogar e de a página ser recarregada.
   */
  rodadaEmAndamento?: number | null;
};

const NIVEIS_DO_CRITERIO = ["atingiu", "em_processo", "nao_atingiu"] as const;

const SEM_REDE = "Não deu para falar com a plataforma. Confira a conexão e tente de novo.";

/**
 * EVIDÊNCIA PEDAGÓGICA (E14): as habilidades da BNCC que cada estudante
 * demonstrou numa atividade, rodada a rodada.
 *
 * **Missão sem ficha pedagógica não desenha nada** (`temFicha: false`). As
 * que têm ficha são Quem mandou isso? v2.2 (ADR-118), A Seleção
 * (exp07ef1b), o Jornal da Escola (exp04ef1b) e o Júri Estadual (exp06ef1b),
 * cada uma nos resultados dela, e o Unoovista (exp08ef1b), na página da
 * atividade — onde o bloco acendeu sozinho quando a ficha entrou.
 *
 * Não há ranking: a ordem é a alfabética (a equipe junta), nenhuma coluna
 * ordena, e nada soma níveis. O estudante nunca vê esta tela.
 */
export function PainelDeHabilidades(props: Props) {
  if (!props.inicial.temFicha) return null;
  return <PainelComFicha {...props} />;
}

function PainelComFicha({ turmaId, expId, atividadeId, inicial, podeEditar, rodadaEmAndamento = null }: Props) {
  const router = useRouter();

  /* O `router.refresh()` entrega um `inicial` novo; a tela passa a mostrá-lo
     (o ajuste de estado durante o render que o React recomenda para prop que
     muda — o mesmo desenho da seção de equipes). */
  const [dados, setDados] = useState(inicial);
  const [inicialVisto, setInicialVisto] = useState(inicial);
  if (inicial !== inicialVisto) {
    setInicialVisto(inicial);
    setDados(inicial);
  }

  const [escolhido, setEscolhido] = useState<RecorteDoPainel>(() => recorteInicial(inicial));
  /* Rodada NOVA em andamento (o professor acabou de zerar): a tela vai para
     ela, que é onde os resultados vão chegar. */
  const [emAndamentoVisto, setEmAndamentoVisto] = useState(rodadaEmAndamento);
  if (rodadaEmAndamento !== emAndamentoVisto) {
    setEmAndamentoVisto(rodadaEmAndamento);
    if (rodadaEmAndamento !== null && (emAndamentoVisto === null || rodadaEmAndamento > emAndamentoVisto)) {
      setEscolhido(rodadaEmAndamento);
    }
  }
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(new Set());
  const [emAjuste, setEmAjuste] = useState<CelulaEmAjuste | null>(null);
  const [emMassa, setEmMassa] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<Erro | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /* As abas: as rodadas com evidência, mais a em andamento. `dados` continua
     sendo o que a api disse — é por ele que se sabe se ela aceita ajuste. */
  const naTela = comRodadaEmAndamento(dados, rodadaEmAndamento);
  const rodadas = rodadasDoPainel(naTela);
  /* O painel novo pode não ter mais a rodada escolhida: cai no resultado. */
  const recorte = recorteDoValor(valorDoRecorte(escolhido), naTela);
  const rodada = recorte === RESULTADO ? null : recorte;
  const semRegistro = rodadaSemRegistro(dados, rodada);
  const editavel = podeEditar && rodada !== null && !semRegistro;
  const base = caminhoDoPainel(turmaId, expId, atividadeId);

  /* Quem saiu da turma sai da seleção. */
  const idsDaTurma = new Set(dados.estudantes.map((e) => e.id));
  const marcados = [...selecionados].filter((id) => idsDaTurma.has(id));

  /* Quem só lê não recebe "sua confirmação": o botão não é dela. */
  const pendentesAqui =
    rodada === null
      ? null
      : podeEditar
        ? resumoPendentes(dados.pendentes, rodada)
        : resumoPendentesParaLeitura(dados.pendentes, rodada);
  const pendentesFora = recorte === RESULTADO ? rodadasComPendentes(dados.pendentes) : [];

  function trocarRecorte(valor: string | number) {
    setEscolhido(recorteDoValor(valor, naTela));
    setErro(null);
  }

  function selecionar(estudanteId: string, marcado: boolean) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (marcado) proximo.add(estudanteId);
      else proximo.delete(estudanteId);
      return proximo;
    });
  }

  function abrirCelula(estudante: EstudanteDoPainel, codigo: string) {
    if (!editavel || rodada === null) return;
    setErro(null);
    setEmAjuste({
      estudanteId: estudante.id,
      nome: estudante.nome,
      codigo,
      descricao: dados.habilidades.find((h) => h.codigo === codigo)?.descricao ?? "",
      rodada,
      leitura: celula(estudante, rodada, codigo),
    });
  }

  function fecharJanelas() {
    setEmAjuste(null);
    setEmMassa(false);
    setErro(null);
  }

  /** As duas ações devolvem o painel inteiro; a tela usa a resposta E relê do servidor. */
  async function chamar(
    caminho: string,
    init: RequestInit,
    tituloDoErro: string,
    padrao: string,
  ): Promise<Painel | null> {
    setOcupado(true);
    setErro(null);
    try {
      const resposta = await fetch(caminho, init);
      const corpo: unknown = await resposta.json().catch(() => null);
      if (!resposta.ok) {
        setErro({ titulo: tituloDoErro, ...erroDaApi(corpo, padrao) });
        return null;
      }
      return corpo as Painel;
    } catch {
      setErro({ titulo: tituloDoErro, mensagem: SEM_REDE, erros: [] });
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function ajustar(ajustes: AjusteDeEvidencia[], alvoRodada: number, limparSelecao: boolean) {
    if (ajustes.length === 0) return;
    /* O teto do Zod da api. Cortar a lista calado mudaria só parte da turma
       dizendo que mudou tudo; é melhor recusar antes de mandar. */
    if (ajustes.length > AJUSTES_MAX) {
      setErro({
        titulo: "Seleção grande demais",
        mensagem: `Dá para mudar até ${AJUSTES_MAX} estudantes de uma vez.`,
        erros: [],
      });
      return;
    }
    const painel = await chamar(
      `${base}/rodadas/${alvoRodada}/ajustes`,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ajustes }) },
      "Não deu para salvar",
      "A plataforma recusou o ajuste. Tente de novo.",
    );
    if (!painel) return;
    setDados(painel);
    setEmAjuste(null);
    setEmMassa(false);
    if (limparSelecao) setSelecionados(new Set());
    setAviso("Habilidades atualizadas.");
    router.refresh();
  }

  async function confirmar(alvoRodada: number) {
    const painel = await chamar(
      `${base}/rodadas/${alvoRodada}/confirmar`,
      { method: "POST" },
      "Não deu para confirmar",
      "A plataforma recusou a confirmação. Tente de novo.",
    );
    if (!painel) return;
    setDados(painel);
    setAviso("Resultado confirmado para a turma.");
    router.refresh();
  }

  const janelaAberta = emAjuste !== null || emMassa;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Habilidades da BNCC"
        description="O que cada estudante demonstrou nesta atividade, rodada a rodada. Sem registro é “Não avaliado”, que não é o mesmo que “Não atingiu”."
      />

      {aviso ? <Snackbar severity="success" title={aviso} onClose={() => setAviso(null)} /> : null}
      {!janelaAberta ? <ErroDoPainel erro={erro} /> : null}

      <Tabs
        value={valorDoRecorte(recorte)}
        onChange={trocarRecorte}
        items={[
          ...rodadas.map((r) => {
            const pendentes = dados.pendentes[String(r)] ?? 0;
            return {
              value: valorDoRecorte(r),
              label: rotuloDoRecorte(r),
              ...(pendentes > 0 ? { badge: pendentes } : {}),
            };
          }),
          { value: valorDoRecorte(RESULTADO), label: rotuloDoRecorte(RESULTADO) },
        ]}
      />

      {pendentesAqui && rodada !== null ? (
        <FeedbackAlert
          type="warning"
          title={pendentesAqui}
          description="A turma fez esta rodada num computador só: o que ele registrou foi copiado para a turma inteira, e só conta depois de confirmado. Depois, dá para ajustar cada estudante."
          action={
            podeEditar ? (
              <Button
                variant="primary"
                size="sm"
                isDisabled={ocupado}
                isLoading={ocupado && !janelaAberta}
                onClick={() => void confirmar(rodada)}
              >
                Confirmar para a turma
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {semRegistro && rodada !== null ? (
        <FeedbackAlert
          type="info"
          title={`A rodada ${rodada} começou`}
          description="Os resultados aparecem aqui conforme os estudantes jogam, sem precisar recarregar a página. Assim que o primeiro chegar, dá para ajustar cada estudante."
        />
      ) : null}

      {recorte === RESULTADO ? (
        <p className="text-[13px] text-unooria-neutral-500">
          A melhor rodada de cada habilidade, só com o que já vale. Para avaliar ou alterar, abra a rodada: aqui aparece
          só o melhor resultado.
          {pendentesFora.length > 0
            ? ` A aula projetada ${pendentesFora.length === 1 ? "da rodada" : "das rodadas"} ${pendentesFora.join(", ")} ainda não conta aqui: ela espera confirmação.`
            : ""}
        </p>
      ) : null}

      {editavel && rodada !== null ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" isDisabled={marcados.length === 0 || ocupado} onClick={() => setEmMassa(true)}>
            Ajustar a seleção
          </Button>
          <span className="text-[13px] text-unooria-neutral-500">
            {marcados.length === 0
              ? "Marque estudantes para ajustar em grupo, ou clique num nível para ajustar uma célula."
              : marcados.length === 1
                ? "Seleção: 1 estudante"
                : `Seleção: ${marcados.length} estudantes`}
          </span>
        </div>
      ) : null}

      <TabelaDeHabilidades
        estudantes={dados.estudantes}
        habilidades={dados.habilidades}
        recorte={recorte}
        selecionavel={editavel}
        selecionados={new Set(marcados)}
        onSelecionar={selecionar}
        onSelecionarTodos={(marcado) => setSelecionados(marcado ? new Set(idsDaTurma) : new Set())}
        onAbrirCelula={abrirCelula}
      />

      {recorte !== RESULTADO ? (
        <p className="text-[12px] text-unooria-neutral-500">
          “{MARCA_DA_ORIGEM.equipe}”: copiado de quem dividiu o computador · “{MARCA_DA_ORIGEM.projecao}”: veio da aula
          projetada · “{MARCA_A_REVISAR}”: da aula projetada, ainda não conta · “{MARCA_DA_ORIGEM.professor}”: ajuste
          docente
        </p>
      ) : null}

      {/* As habilidades, com o critério de cada nível (ADR-145): o professor
          consulta aqui o que fez a criança chegar ao nível que a tabela mostra. */}
      <ul className="flex flex-col gap-3 text-[13px] text-unooria-neutral-700" data-criterios-das-habilidades>
        {dados.habilidades.map((habilidade) => (
          <li key={habilidade.codigo} className="flex flex-col gap-1">
            <span>
              <span className="font-semibold text-unooria-neutral-950">{habilidade.codigo}</span>
              {habilidade.descricao ? ` — ${habilidade.descricao}` : ""}
            </span>
            {habilidade.criterios ? (
              <ul className="flex flex-col gap-0.5 pl-4">
                {NIVEIS_DO_CRITERIO.map((nivel) => (
                  <li key={nivel}>
                    <span className="font-semibold">{ROTULO_DO_STATUS[nivel]}:</span> {habilidade.criterios?.[nivel]}
                  </li>
                ))}
                {habilidade.criterios.observacao ? (
                  <li className="text-unooria-neutral-500">{habilidade.criterios.observacao}</li>
                ) : null}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {emAjuste ? (
        <AjustarCelula
          key={`${emAjuste.estudanteId}-${emAjuste.codigo}-${emAjuste.rodada}`}
          alvo={emAjuste}
          ocupado={ocupado}
          erro={erro}
          onFechar={fecharJanelas}
          onSalvar={(status: StatusDaEvidencia) =>
            void ajustar(
              [{ estudanteId: emAjuste.estudanteId, habilidade: emAjuste.codigo, status }],
              emAjuste.rodada,
              false,
            )
          }
        />
      ) : null}

      {emMassa && rodada !== null ? (
        <AjustarSelecionados
          quantos={marcados.length}
          rodada={rodada}
          habilidades={dados.habilidades}
          ocupado={ocupado}
          erro={erro}
          onFechar={fecharJanelas}
          onSalvar={(habilidade, status) =>
            void ajustar(ajustesEmMassa(marcados, habilidade, status), rodada, true)
          }
        />
      ) : null}
    </section>
  );
}
