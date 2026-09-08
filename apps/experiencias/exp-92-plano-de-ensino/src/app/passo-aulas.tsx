import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Collapse,
  FeedbackAlert,
  Icon,
  ProgressBar,
  SectionHeader,
  Tag,
  TextArea,
  TextField,
  Toggle,
} from "@edu/ui/ds";

import { api, statusDoErro } from "../lib/api";
import {
  baixarDoc,
  documentoDaSemana,
  documentoDeSemanas,
  imprimir,
} from "../lib/exportar";
import type {
  Aula,
  CalendarioDoAno,
  Configuracao,
  PlanoAnual,
  PlanoDePeriodo,
  Semana,
} from "../lib/tipos";
import { DIAS, dataCurta, dataLonga } from "../lib/tipos";

/**
 * PASSO 4 — AS AULAS. O granular, e o que o professor abre toda semana.
 *
 * As aulas são DADO, não prosa: cada uma é um objeto editável, e o documento
 * impresso nasce delas. É o que permite editar a aula de quinta sem tocar na de
 * terça, e é o que faz o plano virar registro — a caixa "aula cumprida" e a
 * observação são preenchidas DEPOIS da aula, e não vêm da IA.
 *
 * O esqueleto (quantas aulas, em que dia, em que horário) vem da grade real do
 * professor, calculado no servidor. O modelo só preenche o conteúdo pedagógico
 * das aulas que existem.
 */

const INTERVALO_POLLING_MS = 3_000;

interface Props {
  configuracao: Configuracao;
  plano: PlanoAnual;
  professorNome: string;
  onVoltar: () => void;
}

export function PassoAulas({ configuracao, plano, professorNome, onVoltar }: Props) {
  const [calendario, setCalendario] = useState<CalendarioDoAno | null>(null);
  const [semanaAtiva, setSemanaAtiva] = useState<Semana | null>(null);
  const [exportando, setExportando] = useState(false);
  const [periodo, setPeriodo] = useState<PlanoDePeriodo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  const carregarCalendario = useCallback(async () => {
    const c = await api.get<CalendarioDoAno>(
      `/planejamento/configuracoes/${configuracao.id}/calendario`,
    );
    setCalendario(c);
    return c;
  }, [configuracao.id]);

  useEffect(() => {
    void carregarCalendario().catch(() => setErro("Não foi possível carregar o calendário."));
  }, [carregarCalendario]);

  const carregarPeriodo = useCallback(async (id: string) => {
    const p = await api.get<PlanoDePeriodo>(`/planejamento/periodos/${id}`);
    setPeriodo(p);
    return p.status;
  }, []);

  // Polling enquanto a semana gera.
  useEffect(() => {
    if (periodo?.status !== "gerando") return;
    const t = window.setInterval(() => {
      void carregarPeriodo(periodo.id).then((s) => {
        if (s !== "gerando") void carregarCalendario();
      });
    }, INTERVALO_POLLING_MS);
    return () => window.clearInterval(t);
  }, [periodo?.status, periodo?.id, carregarPeriodo, carregarCalendario]);

  async function abrir(semana: Semana) {
    setSemanaAtiva(semana);
    setPeriodo(null);
    setErro(null);
    setSujo(false);
    if (semana.planoId) await carregarPeriodo(semana.planoId).catch(() => setErro("Falha ao abrir."));
  }

  async function gerar(semana: Semana) {
    setErro(null);
    try {
      const { id } = await api.post<{ id: string }>(
        `/planejamento/planos-anuais/${plano.id}/periodos/${semana.ordem}/gerar`,
        { feriados: [] },
      );
      await carregarPeriodo(id);
    } catch (falha) {
      const codigo = statusDoErro(falha);
      setErro(
        codigo === 403
          ? "A cota diária de IA acabou. Tente novamente amanhã."
          : codigo === 400
            ? "Esta semana não tem aula — confira a grade de horários na regência."
            : "Não foi possível gerar o plano desta semana.",
      );
    }
  }

  /**
   * Baixa MAIS DE UMA semana num só documento — a entrega.
   *
   * O planejamento é semanal (ADR-76) e o recorte da entrega mora aqui: duas
   * semanas para a escola que recolhe de quinze em quinze dias, ou o período de
   * avaliação inteiro. As aulas das outras semanas NÃO estão em memória (a tela
   * carrega uma por vez), então vêm do servidor já filtradas pelo status: se
   * uma semana do meio não foi planejada, ela simplesmente não entra, e o
   * documento diz quantas entraram.
   */
  async function baixarConjunto(ordens: number[], nomeDoRecorte: string) {
    if (!ordens.length) return;
    setErro(null);
    setExportando(true);
    try {
      const { periodos } = await api.get<{ periodos: PlanoDePeriodo[] }>(
        `/planejamento/planos-anuais/${plano.id}/periodos`,
      );
      const escolhidas = periodos.filter((p) => ordens.includes(p.ordem));
      if (!escolhidas.length) {
        setErro("Nenhuma dessas semanas foi planejada ainda.");
        return;
      }
      baixarDoc(
        documentoDeSemanas(escolhidas, configuracao, professorNome, nomeDoRecorte),
        `${configuracao.componenteRotulo} — ${nomeDoRecorte}`,
      );
    } catch {
      setErro("Não foi possível montar o documento. Tente de novo.");
    } finally {
      setExportando(false);
    }
  }

  function editarAula(numero: number, mudanca: Partial<Aula>) {
    setSujo(true);
    setPeriodo((atual) =>
      atual
        ? { ...atual, aulas: atual.aulas.map((a) => (a.numero === numero ? { ...a, ...mudanca } : a)) }
        : atual,
    );
  }

  async function salvar() {
    if (!periodo) return;
    setSalvando(true);
    try {
      const p = await api.put<PlanoDePeriodo>(`/planejamento/periodos/${periodo.id}/aulas`, {
        aulas: periodo.aulas,
      });
      setPeriodo(p);
      setSujo(false);
    } catch {
      setErro("Não foi possível salvar as aulas.");
    } finally {
      setSalvando(false);
    }
  }

  if (!calendario) return <p aria-live="polite">Carregando o calendário…</p>;

  const documento = () => (periodo ? documentoDaSemana(periodo, configuracao, professorNome) : "");
  const titulo = `${configuracao.componenteRotulo} — ${semanaAtiva?.rotulo ?? ""}`;

  /** A semana seguinte à aberta, quando ela existe e já está planejada. */
  const proximaSemana = semanaAtiva
    ? (calendario.semanas.find((s) => s.ordem === semanaAtiva.ordem + 1) ?? null)
    : null;
  /** Quantas semanas do período da aberta já foram planejadas. */
  const planejadasDoPeriodo = semanaAtiva
    ? calendario.semanas.filter(
        (s) => s.periodoDeAvaliacao === semanaAtiva.periodoDeAvaliacao && s.status === "pronto",
      )
    : [];
  const periodoDaSemanaAtiva = semanaAtiva
    ? (calendario.periodos.find((p) => p.ordem === semanaAtiva.periodoDeAvaliacao) ?? null)
    : null;

  return (
    <section className="passo">
      <SectionHeader
        title="Suas aulas"
        description="Você planeja uma semana por vez, a partir do que distribuiu no plano anual. Na hora de entregar, o documento pode juntar duas semanas ou o período de avaliação inteiro."
      />

      {erro && <FeedbackAlert type="error" description={erro} />}

      {!semanaAtiva && (
        <>
          {calendario.periodos.map((p) => (
            <Collapse
              key={p.ordem}
              variant="bordered"
              title={p.rotulo}
              subtitle={`${dataCurta(p.inicio)} a ${dataCurta(p.fim)} · ${p.aulasEstimadas} aulas`}
              defaultOpen={p.ordem === 1}
            >
              <ul className="lista-de-semanas">
                {calendario.semanas
                  .filter((s) => s.periodoDeAvaliacao === p.ordem)
                  .map((s) => (
                    <li key={s.ordem}>
                      <button type="button" className="semana" onClick={() => void abrir(s)}>
                        <span className="semana__rotulo">
                          <strong>{s.rotulo}</strong>
                          <span>
                            {dataCurta(s.inicio)} – {dataCurta(s.fim)}
                          </span>
                        </span>
                        <span className="semana__estado">
                          <span>{s.aulasPrevistas} aula(s)</span>
                          {s.status === "pronto" && <Badge variant="success">Planejada</Badge>}
                          {s.status === "gerando" && <Badge variant="info">Gerando…</Badge>}
                          {s.status === "erro" && <Badge variant="error">Falhou</Badge>}
                          {!s.status && <Tag variant="neutral">A planejar</Tag>}
                          <Icon name="chevron_right" size="s" />
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>

              {/* O recorte da ENTREGA, no cabeçalho do período: quem recolhe
                  planejamento por bimestre baixa tudo de uma vez, sem abrir as
                  dez semanas. Só aparece com semana planejada — um botão que
                  produz documento vazio é pior que botão nenhum. */}
              {calendario.semanas.some(
                (s) => s.periodoDeAvaliacao === p.ordem && s.status === "pronto",
              ) && (
                <div className="exportar-conjunto">
                  <p className="exportar-conjunto__rotulo">
                    {
                      calendario.semanas.filter(
                        (s) => s.periodoDeAvaliacao === p.ordem && s.status === "pronto",
                      ).length
                    }{" "}
                    semana(s) planejada(s) neste período:
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    isLoading={exportando}
                    leftIcon={<Icon name="download" size="xs" />}
                    onClick={() =>
                      void baixarConjunto(
                        calendario.semanas
                          .filter((s) => s.periodoDeAvaliacao === p.ordem && s.status === "pronto")
                          .map((s) => s.ordem),
                        p.rotulo,
                      )
                    }
                  >
                    Baixar o {p.rotulo} inteiro
                  </Button>
                </div>
              )}
            </Collapse>
          ))}
        </>
      )}

      {semanaAtiva && (
        <>
          <div className="acoes acoes--topo">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSemanaAtiva(null);
                setPeriodo(null);
                void carregarCalendario();
              }}
            >
              ← Todas as semanas
            </Button>
            {periodo?.status === "pronto" && (
              <>
                <Button variant="ghost" size="sm" onClick={() => imprimir(documento(), titulo)}>
                  Imprimir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Icon name="download" size="xs" />}
                  onClick={() => baixarDoc(documento(), titulo)}
                >
                  Baixar esta semana
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void gerar(semanaAtiva)}>
                  Gerar de novo
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void salvar()}
                  isLoading={salvando}
                  disabled={!sujo}
                >
                  {sujo ? "Salvar" : "Salvo"}
                </Button>
              </>
            )}
          </div>

          {/* A ENTREGA de mais de uma semana. Fica aqui, e não junto do
              "Baixar esta semana", porque é outra decisão: uma é o que o
              professor está editando agora, a outra é o que ele vai levar à
              coordenação. Cada botão só existe quando tem conteúdo — o da
              quinzena exige a semana seguinte PLANEJADA, senão o documento
              sairia com uma semana só e o nome mentiria. */}
          {periodo?.status === "pronto" &&
            (proximaSemana?.status === "pronto" || planejadasDoPeriodo.length > 1) && (
              <div className="exportar-conjunto">
                <p className="exportar-conjunto__rotulo">Entregar mais de uma semana:</p>
                {proximaSemana?.status === "pronto" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isLoading={exportando}
                    leftIcon={<Icon name="download" size="xs" />}
                    onClick={() =>
                      void baixarConjunto(
                        [semanaAtiva.ordem, proximaSemana.ordem],
                        `${semanaAtiva.rotulo} e ${proximaSemana.rotulo}`,
                      )
                    }
                  >
                    Esta e a próxima (quinzena)
                  </Button>
                )}
                {planejadasDoPeriodo.length > 1 && periodoDaSemanaAtiva && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isLoading={exportando}
                    leftIcon={<Icon name="download" size="xs" />}
                    onClick={() =>
                      void baixarConjunto(
                        planejadasDoPeriodo.map((s) => s.ordem),
                        periodoDaSemanaAtiva.rotulo,
                      )
                    }
                  >
                    O {periodoDaSemanaAtiva.rotulo} ({planejadasDoPeriodo.length} semanas)
                  </Button>
                )}
              </div>
            )}

          <h3 className="titulo-da-semana">
            {semanaAtiva.rotulo} · {dataLonga(semanaAtiva.inicio)} a {dataLonga(semanaAtiva.fim)} ·{" "}
            {semanaAtiva.aulasPrevistas} aula(s)
          </h3>

          {!periodo && semanaAtiva.aulasPrevistas === 0 && (
            <FeedbackAlert
              type="warning"
              description="Esta semana não tem aula na sua grade de horários. Confira a regência se isso não estiver certo."
            />
          )}

          {!periodo && semanaAtiva.aulasPrevistas > 0 && (
            <div className="estado-vazio">
              <p>
                Esta semana ainda não foi planejada. O gerador detalha as{" "}
                {semanaAtiva.aulasPrevistas} aulas a partir das habilidades do{" "}
                {semanaAtiva.periodoDeAvaliacao}º período.
              </p>
              <Button variant="primary" onClick={() => void gerar(semanaAtiva)}>
                Planejar estas aulas
              </Button>
            </div>
          )}

          {periodo?.status === "gerando" && (
            <div className="estado-gerando" aria-live="polite">
              <ProgressBar indeterminate />
              <p>Detalhando as aulas…</p>
            </div>
          )}

          {periodo?.status === "erro" && (
            <FeedbackAlert
              type="error"
              description={periodo.erro ?? "A geração falhou."}
              action={<Button size="sm" onClick={() => void gerar(semanaAtiva)}>Tentar de novo</Button>}
            />
          )}

          {periodo?.status === "pronto" &&
            periodo.aulas.map((aula) => (
              <CartaoDeAula
                key={aula.numero}
                aula={aula}
                minutos={configuracao.minutosPorAula}
                onEditar={(m) => editarAula(aula.numero, m)}
              />
            ))}
        </>
      )}

      <div className="acoes">
        <Button variant="secondary" onClick={onVoltar}>
          Voltar ao plano anual
        </Button>
      </div>
    </section>
  );
}

/**
 * Uma aula. Os quatro momentos ficam visíveis por padrão porque são o plano de
 * aula propriamente dito — colapsá-los transformaria a tela numa lista de temas,
 * que é exatamente o que este produto existe para não ser.
 */
function CartaoDeAula({
  aula,
  minutos,
  onEditar,
}: {
  aula: Aula;
  minutos: number;
  onEditar: (m: Partial<Aula>) => void;
}) {
  const dia = DIAS.find((d) => d.valor === aula.diaDaSemana);
  const somaDosMomentos =
    aula.momentos.retomada.minutos +
    aula.momentos.desenvolvimento.minutos +
    aula.momentos.sistematizacao.minutos +
    aula.momentos.fechamento.minutos;

  return (
    <article className={`cartao-de-aula${aula.cumprida ? " cartao-de-aula--cumprida" : ""}`}>
      <header className="cartao-de-aula__cabecalho">
        <div>
          <span className="cartao-de-aula__quando">
            Aula {aula.numero} · {dia?.longo}, {dataCurta(aula.data)} às {aula.horario} · {minutos} min
          </span>
          <TextField
            label="Tema da aula"
            value={aula.tema}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEditar({ tema: e.target.value })}
          />
        </div>
        <Toggle
          checked={aula.cumprida}
          onChange={(v) => onEditar({ cumprida: v })}
          label="Aula dada"
          size="xs"
        />
      </header>

      {aula.habilidades.length > 0 && (
        <p className="cartao-de-aula__habilidades">
          {aula.habilidades.map((c) => (
            <Tag key={c} variant="info">
              {c}
            </Tag>
          ))}
        </p>
      )}

      <TextArea
        label="Objetivo desta aula"
        value={aula.objetivo}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ objetivo: e.target.value })}
        rows={2}
      />

      <TextArea
        label="Conteúdo"
        value={aula.conteudo}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ conteudo: e.target.value })}
        rows={2}
      />

      <div className="momentos">
        <p className="momentos__titulo">
          Sequência da aula
          {somaDosMomentos > 0 && (
            <span className={somaDosMomentos > minutos ? "momentos__soma--estourou" : "momentos__soma"}>
              {somaDosMomentos} de {minutos} min
            </span>
          )}
        </p>
        {(
          [
            ["retomada", "Retomada"],
            ["desenvolvimento", "Desenvolvimento"],
            ["sistematizacao", "Sistematização"],
            ["fechamento", "Fechamento"],
          ] as const
        ).map(([chave, rotulo]) => (
          <div key={chave} className="momento">
            <div className="momento__rotulo">
              <strong>{rotulo}</strong>
              <input
                type="number"
                min={0}
                max={120}
                aria-label={`Minutos de ${rotulo}`}
                value={aula.momentos[chave].minutos}
                onChange={(e) =>
                  onEditar({
                    momentos: {
                      ...aula.momentos,
                      [chave]: { ...aula.momentos[chave], minutos: Number(e.target.value) || 0 },
                    },
                  })
                }
              />
              <span>min</span>
            </div>
            <TextArea
              value={aula.momentos[chave].o_que}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                onEditar({
                  momentos: {
                    ...aula.momentos,
                    [chave]: { ...aula.momentos[chave], o_que: e.target.value },
                  },
                })
              }
              rows={2}
              aria-label={`O que acontece em ${rotulo}`}
            />
          </div>
        ))}
      </div>

      <Collapse variant="default" title="Recursos, avaliação e adaptações" defaultOpen={false}>
        {aula.recursos.length > 0 && (
          <p className="cartao-de-aula__recursos">
            {aula.recursos.map((r, i) => (
              <Tag key={i} variant="neutral">
                {r}
              </Tag>
            ))}
          </p>
        )}
        <TextArea
          label="O que observar (avaliação da aula)"
          value={aula.avaliacao}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ avaliacao: e.target.value })}
          rows={2}
        />
        <TextArea
          label="Tarefa de casa"
          value={aula.tarefaDeCasa}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ tarefaDeCasa: e.target.value })}
          rows={2}
        />
        <TextArea
          label="Adaptações"
          value={aula.adaptacoes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ adaptacoes: e.target.value })}
          rows={2}
        />
        <TextArea
          label="Meu registro (depois da aula)"
          value={aula.observacaoDoProfessor}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onEditar({ observacaoDoProfessor: e.target.value })
          }
          rows={2}
          helperText="O que funcionou, o que ficou para a próxima. Sai no documento impresso."
        />
      </Collapse>
    </article>
  );
}
