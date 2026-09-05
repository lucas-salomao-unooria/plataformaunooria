import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  FeedbackAlert,
  Icon,
  ProgressBar,
  RadioGroup,
  SectionHeader,
  Tag,
  TextArea,
} from "@edu/ui/ds";

import { api, experiencia, statusDoErro } from "../lib/api";
import {
  faltam,
  formatarData,
  formatarDia,
  mensagemDoStatus,
  percentual,
  todasRespondidas,
  varianteDaFaixa,
  type Tela,
} from "../lib/estado";
import type { Apoio, Historico, Hoje, RespostaResponder, Resultado } from "../lib/tipos";

/**
 * O check-in do dia em UMA tela: abertura (IA), três frases do DASS-21 (fixas,
 * vindas da api), a pergunta aberta (IA) e Enviar. Menos de um minuto.
 *
 * O que NÃO está aqui, de propósito: os 21 itens (só os 3 do dia chegam), a
 * pontuação (calculada na api ao fechar o ciclo), qualquer prompt. O bundle
 * exibe o que a api decide — inclusive a mensagem de apoio.
 */

interface Props {
  professorNome: string;
  hojeInicial: Hoje;
}

const MAX_TEXTO = 600;

export function BemEstarApp({ professorNome, hojeInicial }: Props) {
  const [hoje, setHoje] = useState<Hoje>(hojeInicial);
  const [tela, setTela] = useState<Tela>(hojeInicial.checkin.status === "respondido" ? "feito" : "checkin");
  const [respostas, setRespostas] = useState<Record<number, number | undefined>>({});
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [devolucao, setDevolucao] = useState<RespostaResponder | null>(null);
  const [historico, setHistorico] = useState<Historico | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  const { checkin, ciclo } = hoje;
  const itens = checkin.itens.map((i) => i.numero);
  const completo = todasRespondidas(respostas, itens);

  useEffect(() => {
    experiencia().track("attempted", "checkin", {
      contexto: { numero: hojeInicial.checkin.numero, status: hojeInicial.checkin.status },
    });
  }, [hojeInicial.checkin.numero, hojeInicial.checkin.status]);

  // ----------------------------------------------------------------- ações

  const recarregarHoje = useCallback(async () => {
    const novo = await api.get<Hoje>("/bemestar/hoje");
    setHoje(novo);
    setRespostas({});
    setTexto("");
    setDevolucao(null);
    setTela(novo.checkin.status === "respondido" ? "feito" : "checkin");
  }, []);

  const enviar = useCallback(async () => {
    if (!completo) {
      setErro("Responda às três frases antes de enviar.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      const textoLivre = texto.trim();
      const r = await api.post<RespostaResponder>(`/bemestar/checkins/${checkin.id}/respostas`, {
        respostas: itens.map((n) => ({ item: n, valor: respostas[n] })),
        textoLivre: textoLivre || undefined,
      });
      experiencia().track("completed", "checkin", { contexto: { numero: r.checkin.numero, comTexto: Boolean(textoLivre) } });
      if (r.resultado) experiencia().track("completed", "ciclo", { contexto: { cicloId: r.ciclo.id } });
      setDevolucao(r);
      setHoje((atual) => ({ ...atual, checkin: r.checkin, ciclo: r.ciclo, resultado: r.resultado, apoio: r.apoio }));
      setTela("feito");
    } catch (falha) {
      const status = statusDoErro(falha);
      setErro(mensagemDoStatus(status));
      // Já respondido em outra aba, ou o dia virou: a api tem a verdade.
      if (status === 409 || status === 404) {
        try {
          await recarregarHoje();
        } catch {
          // fica na tela com a mensagem
        }
      }
    } finally {
      setEnviando(false);
    }
  }, [completo, texto, checkin.id, itens, respostas, recarregarHoje]);

  const abrirHistorico = useCallback(async () => {
    setErro("");
    setCarregandoHistorico(true);
    setTela("historico");
    experiencia().track("interacted", "historico");
    try {
      setHistorico(await api.get<Historico>("/bemestar/historico"));
    } catch (falha) {
      setErro(mensagemDoStatus(statusDoErro(falha), "Não foi possível carregar o histórico agora."));
    } finally {
      setCarregandoHistorico(false);
    }
  }, []);

  const apagarTudo = useCallback(async () => {
    if (
      !window.confirm(
        "Apagar todas as suas respostas, anotações e resultados? Essa ação não pode ser desfeita.",
      )
    )
      return;
    setErro("");
    try {
      await api.delete("/bemestar/dados");
      experiencia().track("interacted", "apagar-dados");
      setHistorico(null);
      await recarregarHoje();
    } catch (falha) {
      setErro(mensagemDoStatus(statusDoErro(falha), "Não foi possível apagar agora. Tente de novo."));
    }
  }, [recarregarHoje]);

  const voltar = useCallback(() => {
    setErro("");
    setTela(checkin.status === "respondido" ? "feito" : "checkin");
  }, [checkin.status]);

  // -------------------------------------------------------------------- UI

  // Texto do progresso fora da barra: com `valuePosition="none"` o DS não
  // desenha rótulo nenhum, e uma barra vazia sem legenda não diz nada.
  const progresso = ciclo ? (
    <div className="app-stack unooria-gap-xxs">
      <ProgressBar
        value={percentual(ciclo.respondidos, ciclo.total)}
        variant="brand"
        size="sm"
        aria-label={`Ciclo: ${ciclo.respondidos} de ${ciclo.total} check-ins`}
        valuePosition="none"
      />
      <p className="app-muted">
        Ciclo: {ciclo.respondidos} de {ciclo.total} check-ins · cada um cobre 3 das 21 frases
      </p>
    </div>
  ) : null;

  return (
    <div className="app-shell">
      <main className="app-main">
        <div className="app-col-main app-stack unooria-gap-m">
          {/* ---------------------------------------------------- check-in -- */}
          {tela === "checkin" && (
            <>
              <SectionHeader
                title={`Como você está, ${primeiroNome(professorNome)}?`}
                description={checkin.abertura}
                badge={
                  <Badge variant="info" size="md">
                    Check-in {checkin.numero} de {checkin.total}
                  </Badge>
                }
                actions={
                  <Button variant="ghost" size="sm" onClick={() => void abrirHistorico()} leftIcon={<Icon name="history" size="xs" />}>
                    Histórico
                  </Button>
                }
                divider
              />

              {progresso}
              {erro && <FeedbackAlert type="error" description={erro} />}

              <div className="app-stack unooria-gap-xxs">
                <p className="app-muted">{hoje.instrucao}</p>
                <ul className="app-escala" aria-label="Escala de respostas">
                  {hoje.escala.map((e) => (
                    <li key={e.valor}>
                      <strong>{e.curto}</strong> — {e.rotulo}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="app-stack unooria-gap-s">
                {checkin.itens.map((item) => (
                  <div key={item.numero} className="app-surface app-item">
                    <RadioGroup
                      name={`item-${item.numero}`}
                      label={item.texto}
                      direction="horizontal"
                      size="md"
                      // "" e não undefined: o RadioGroup do DS é controlado desde o 1º render.
                      value={respostas[item.numero] ?? ""}
                      onChange={(v) => setRespostas((atual) => ({ ...atual, [item.numero]: Number(v) }))}
                      options={hoje.escala.map((e) => ({ value: e.valor, label: e.curto }))}
                    />
                  </div>
                ))}
              </div>

              <TextArea
                label={checkin.pergunta}
                value={texto}
                onChange={(ev: React.ChangeEvent<HTMLTextAreaElement>) => setTexto(ev.target.value.slice(0, MAX_TEXTO))}
                maxLength={MAX_TEXTO}
                rows={3}
                /*
                 * A copy diz as DUAS coisas porque as duas são verdade, e a
                 * segunda estava faltando. Nenhuma pessoa da escola ou da rede
                 * lê isto: o controller do bem-estar é `@Roles("professor")`,
                 * o serviço escopa por `professorId` e não existe visão de
                 * gestor — a garantia é real e é forte. Mas o texto é enviado
                 * ao Vertex para gerar o acolhimento
                 * (`bemestar.service.ts#gerarAcolhimento`), e a versão anterior
                 * — "Só você lê o que escreve aqui" — omitia isso.
                 *
                 * Omitir era o erro: a pessoa está decidindo, naquele campo, se
                 * conta que não está bem. Uma garantia de privacidade que a
                 * pessoa descobre depois ser parcial não custa só a frase;
                 * custa o instrumento, porque o próximo check-in ela responde
                 * com reserva. Quem não escreve nada não envia nada — sem
                 * texto, `gerarAcolhimento` devolve o texto fixo sem chamar IA.
                 */
                helperText="Opcional. Nenhuma pessoa da escola ou da rede lê o que você escreve aqui. Uma IA lê, e é ela que escreve a resposta de acolhimento."
              />

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => void enviar()}
                isDisabled={!completo || enviando}
                leftIcon={<Icon name="check" size="xs" />}
              >
                {enviando ? "Enviando…" : "Enviar check-in"}
              </Button>
              <p className="app-muted">{hoje.aviso}</p>
            </>
          )}

          {/* ------------------------------------------------------- feito -- */}
          {tela === "feito" && (
            <>
              <SectionHeader
                title="Check-in de hoje feito"
                description={devolucao?.acolhimento ?? checkin.acolhimento ?? "Registrado. Até o próximo."}
                badge={
                  <Badge variant="success" size="md">
                    Check-in {checkin.numero} de {checkin.total}
                  </Badge>
                }
                actions={
                  <Button variant="ghost" size="sm" onClick={() => void abrirHistorico()} leftIcon={<Icon name="history" size="xs" />}>
                    Histórico
                  </Button>
                }
                divider
              />

              {erro && <FeedbackAlert type="error" description={erro} />}
              {hoje.apoio && <AlertaDeApoio apoio={hoje.apoio} />}

              {hoje.resultado ? (
                <section className="app-stack unooria-gap-s">
                  <SectionHeader
                    title="Retrato da sua semana"
                    description="Ciclo fechado: as 21 frases respondidas ao longo dos últimos check-ins, somadas por dimensão."
                    variant="compact"
                  />
                  <ResultadoDoCiclo resultado={hoje.resultado} />
                  <p className="app-muted">{hoje.resultado.aviso}</p>
                </section>
              ) : (
                <section className="app-surface unooria-p-m app-stack unooria-gap-xs">
                  {progresso}
                  {ciclo && (
                    <p className="app-muted">
                      {faltam(ciclo.respondidos, ciclo.total) === 1
                        ? "Falta 1 check-in para o retrato da semana. Até amanhã."
                        : `Faltam ${faltam(ciclo.respondidos, ciclo.total)} check-ins para o retrato da semana. Até amanhã.`}
                    </p>
                  )}
                </section>
              )}

              {(devolucao?.checkin.textoLivre ?? checkin.textoLivre) && (
                <div className="app-surface unooria-p-m app-stack unooria-gap-xxs">
                  <span className="app-muted">O que você escreveu hoje</span>
                  <p className="app-lista__principal">{devolucao?.checkin.textoLivre ?? checkin.textoLivre}</p>
                </div>
              )}
            </>
          )}

          {/* --------------------------------------------------- histórico -- */}
          {tela === "historico" && (
            <>
              <SectionHeader
                title="Seu histórico"
                description={historico?.aviso ?? hoje.aviso}
                actions={
                  <Button variant="ghost" size="sm" onClick={voltar} leftIcon={<Icon name="arrow_back" size="xs" />}>
                    Voltar
                  </Button>
                }
                divider
              />

              {erro && <FeedbackAlert type="error" description={erro} />}

              {carregandoHistorico || !historico ? (
                <ProgressBar indeterminate variant="brand" size="sm" label="Carregando…" valuePosition="none" />
              ) : historico.ciclos.length === 0 && historico.anotacoes.length === 0 ? (
                <div className="app-surface unooria-p-l">
                  <EmptyState
                    variant="no-data"
                    title="Nada por aqui ainda"
                    description="Seus check-ins e o retrato de cada ciclo de 7 dias aparecem aqui. Só você vê."
                    primaryAction={{ label: "Voltar ao check-in", onClick: voltar }}
                  />
                </div>
              ) : (
                <>
                  {historico.ciclos.length > 0 && (
                    <section className="app-stack unooria-gap-s">
                      <SectionHeader title="Ciclos concluídos" description="Pontuação por dimensão (0 a 42) e a faixa correspondente." variant="compact" />
                      {historico.ciclos.map((c) => (
                        <div key={c.id} className="app-surface app-ciclo">
                          <span className="app-muted">
                            {formatarData(c.iniciadoEm)} → {c.concluidoEm ? formatarData(c.concluidoEm) : "—"}
                          </span>
                          <div className="app-ciclo__linhas">
                            {c.resultado.dimensoes.map((d) => (
                              <div key={d.subescala} className="app-ciclo__linha">
                                <span>
                                  {d.rotulo} · <strong>{d.pontos}</strong>
                                </span>
                                <Badge variant={varianteDaFaixa(d.faixa)} size="sm">
                                  {d.faixaRotulo}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </section>
                  )}

                  {historico.anotacoes.length > 0 && (
                    <section className="app-stack unooria-gap-s">
                      <SectionHeader title="Suas anotações" description="O que você escreveu em cada check-in." variant="compact" />
                      <div className="app-surface app-lista">
                        {historico.anotacoes.map((a) => (
                          <div key={a.id} className="app-lista__item">
                            <span className="app-lista__dia">{formatarDia(a.dia)}</span>
                            <div className="app-lista__texto">
                              <p className="app-lista__principal">{a.textoLivre ?? "Sem anotação neste dia."}</p>
                              {a.acolhimento && <p className="app-lista__apoio">{a.acolhimento}</p>}
                            </div>
                            {a.sinalDeApoio && (
                              <Tag variant="warning" size="sm">
                                Apoio
                              </Tag>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="app-acoes">
                    <span className="app-muted">Estes dados são seus. Apagar remove tudo, de todos os ciclos.</span>
                    <span className="app-acoes__fim">
                      <Button variant="danger" size="sm" onClick={() => void apagarTudo()} leftIcon={<Icon name="delete" size="xs" />}>
                        Apagar meus dados
                      </Button>
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ------------------------------------------------------------- componentes

function ResultadoDoCiclo({ resultado }: { resultado: Resultado }) {
  return (
    <div className="app-resultado">
      {resultado.dimensoes.map((d) => (
        <div key={d.subescala} className="app-surface app-resultado__card">
          <div className="app-resultado__topo">
            <span className="app-resultado__rotulo">{d.rotulo}</span>
            <Badge variant={varianteDaFaixa(d.faixa)} size="md">
              {d.faixaRotulo}
            </Badge>
          </div>
          <p className="app-resultado__pontos">
            <strong>{d.pontos}</strong> de 42
          </p>
          <p className="app-resultado__leitura">{d.leitura}</p>
        </div>
      ))}
    </div>
  );
}

function AlertaDeApoio({ apoio }: { apoio: Apoio }) {
  return (
    <FeedbackAlert
      type="warning"
      title={apoio.titulo}
      description={
        <>
          {apoio.texto}
          <ul className="app-recursos">
            {apoio.recursos.map((r) => (
              <li key={r.nome}>
                <strong>{r.nome}</strong> — {r.detalhe}
              </li>
            ))}
          </ul>
        </>
      }
    />
  );
}

/** "Prof. Demo" → "Demo": ignora títulos abreviados no cumprimento. */
function primeiroNome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return (partes.find((p) => !p.endsWith(".")) ?? partes[0] ?? "").replace(/[.,]$/, "");
}
