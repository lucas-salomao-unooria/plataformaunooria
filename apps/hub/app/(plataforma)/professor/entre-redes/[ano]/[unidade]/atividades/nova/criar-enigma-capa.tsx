"use client";

import { useEffect, useState } from "react";

import { Button, Card, EmptyState, FeedbackAlert, Icon, ProgressBar, SectionHeader, Selection, Tag, TextArea, TextField } from "@edu/ui/ds";
import {
  AssistenteDeAtividade,
  type ResultadoDaCriacao,
  type TurmaDoAssistente,
} from "@/components/atividades/assistente-de-atividade";
import {
  AVISO_SEM_IA,
  CHAVES_PRONTAS,
  NOTA_MAX,
  RAIO_PADRAO,
  TEMA,
  TEXTO_DA_GERACAO,
  alvoNaFaixaComum,
  caminhoDaTurma as caminhoDaApi,
  erroDaApi,
  marcasDoConteudo,
  palavrasDoTexto,
  problemasDoRecorte,
  type ChavePronta,
  type InvarianteId,
  type MarcaNaCena,
  type PacoteDaTurma,
  type PacoteDoProfessor,
  type RespostaDoGerar,
  type SeloDaCena,
} from "@/lib/enigma-capa-tipos";

import { CenaDoEnigma } from "../../resultados/cena-do-enigma";

interface PreparoLido {
  turmaId: string;
  dados: PacoteDaTurma | null;
}

interface Recorte {
  disciplina: string;
  tema: string;
  palavrasTexto: string;
  nota: string;
}

/** A atividade já gravada (pacote pronto, ou rascunho aprovado): o assistente só faz o resto. */
interface AtividadeGravada {
  turmaId: string;
  id: string;
  resumo: string;
  /** O pacote pronto já entra em andamento (`banco-padrao` aprova E põe no ar, num toque — one-pager §9a). */
  noAr: boolean;
}

const RECORTE_VAZIO: Recorte = { disciplina: "", tema: "", palavrasTexto: "", nota: "" };
const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
const BFF = (turmaId: string) => `/api/plataforma${caminhoDaApi(turmaId)}`;
const JSON_HEADERS = { "content-type": "application/json" };

/** O botão de cada pacote pronto. A Biblioteca é o caminho curto do PO (§9a), literal. */
const ROTULO_DO_PRONTO: Record<ChavePronta, string> = {
  biblioteca: "USAR BANCO PADRÃO (BIBLIOTECA)",
  horta: "Usar o pacote pronto da Horta",
  museu: "Usar o pacote pronto do Museu",
};

/**
 * O id da atividade numa resposta que pode vir em duas formas: o pacote
 * (`{ id }`) ou o em andamento (`{ atividade: { pacoteId } }`, a do
 * `banco-padrao`, que põe no ar). Aceitar as duas evita depender de qual a
 * rota devolve — o id é o mesmo.
 */
function idDaAtividade(corpo: unknown): string | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as { id?: unknown; atividade?: { pacoteId?: unknown } | null; rascunho?: { id?: unknown } | null };
  if (typeof c.id === "string") return c.id;
  if (typeof c.atividade?.pacoteId === "string") return c.atividade.pacoteId;
  return null;
}

/** O rascunho numa resposta: `{ rascunho }` (GET rascunho, gerar) ou o próprio pacote (marcar os objetos). */
function rascunhoDaResposta(corpo: unknown): PacoteDoProfessor | null {
  if (!corpo || typeof corpo !== "object") return null;
  if ("rascunho" in corpo) return ((corpo as { rascunho: PacoteDoProfessor | null }).rascunho ?? null);
  return "conteudo" in corpo ? (corpo as PacoteDoProfessor) : null;
}

const recorteDoPacote = (p: { disciplina: string; tema: string; palavras: string[]; nota: string | null }): Recorte => ({
  disciplina: p.disciplina,
  tema: p.tema,
  palavrasTexto: p.palavras.join(", "),
  nota: p.nota ?? "",
});

/**
 * NOVA ATIVIDADE de O ENIGMA DA CAPA DA RÁDIO (ADR-184, ADR-130). O PACOTE — a
 * cena panorâmica com as duas fotos, os selos, as falas da visitante e os dois
 * objetos iguais do fundo — é a atividade que a turma vive, e nasce do
 * professor por um de três caminhos (one-pager §9a, decisão do Lucas 3):
 *
 * 1. **USAR BANCO PADRÃO (BIBLIOTECA)**, um toque (`POST banco-padrao`), ou os
 *    pacotes prontos da Horta e do Museu (a mesma rota, outra `chave`): a
 *    atividade nasce pronta, sem curadoria;
 * 2. **Gerar com IA** (`POST gerar-conteudo`: disciplina, tema, 3 a 6
 *    palavras-chave, nota): a barra lúdica “A Rádio Escola está preparando as
 *    fotos...”, e sem saldo ou com a IA fora o rascunho vem do pacote pronto da
 *    disciplina, com o aviso;
 * 3. a **CURADORIA** do rascunho: a panorâmica com as duas molduras, os selos e
 *    as falas (editáveis, o que o §9a permite), e — o passo que só o professor
 *    faz — **“Toque no {NOME} na imagem”** para cada objeto igual, porque a IA
 *    desenha a cena mas não devolve coordenada. Os dois toques vão juntos
 *    (`POST rascunho/invariantes`); “Refazer” apaga e começa de novo; GERAR
 *    NOVAMENTE pede outra cena; “Aprovar” (`POST homologar`) grava a atividade
 *    PRONTA.
 *
 * O “Criar atividade” do assistente não grava o conteúdo: ele já existe, e o
 * resto (pôr no ar — o “Usar esta atividade agora” — e as equipes) é do
 * `concluirCriacao`.
 */
export function CriarEnigmaCapa({
  turmas,
  turmaInicial,
  rotaDaMissao,
  baseDoBundle,
}: {
  turmas: TurmaDoAssistente[];
  turmaInicial: string;
  rotaDaMissao: string;
  /** A base do bundle da experiência (resolvida no servidor): é dela que saem as cenas prontas. */
  baseDoBundle: string | null;
}) {
  const [preparo, setPreparo] = useState<PreparoLido | null>(null);
  const [preparoVisto, setPreparoVisto] = useState<PreparoLido | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [recorte, setRecorte] = useState<Recorte>(RECORTE_VAZIO);
  const [rascunho, setRascunho] = useState<PacoteDoProfessor | null>(null);
  /* Cada geração é uma cena nova: a curadoria remonta (edições e toques são de UMA cena), mesmo que a api reuse o id do rascunho. */
  const [geracao, setGeracao] = useState(0);
  const [gravada, setGravada] = useState<AtividadeGravada | null>(null);
  const [usando, setUsando] = useState<ChavePronta | null>(null);
  const [gerando, setGerando] = useState(false);
  const [tentouGerar, setTentouGerar] = useState(false);
  const [semIa, setSemIa] = useState<"sem-saldo" | "indisponivel" | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; erros: string[] } | null>(null);

  if (preparo !== preparoVisto) {
    setPreparoVisto(preparo);
    const existente = preparo?.dados?.rascunho ?? null;
    if (existente && !rascunho) {
      setRascunho(existente);
      setRecorte(recorteDoPacote(existente));
    }
  }

  const palavras = palavrasDoTexto(recorte.palavrasTexto);
  const problemas = problemasDoRecorte({ ...recorte, palavras });
  const ocupado = gerando || usando !== null;

  function trocar(campo: keyof Recorte, valor: string) {
    setRecorte((atual) => ({ ...atual, [campo]: valor }));
  }

  async function usarPronto(turmaId: string, chave: ChavePronta, nome: string) {
    setUsando(chave);
    setErro(null);
    setSemIa(null);
    try {
      const r = await fetch(`${BFF(turmaId)}/banco-padrao`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ chave }) });
      const corpo: unknown = await r.json().catch(() => null);
      const id = r.ok ? idDaAtividade(corpo) : null;
      if (!id) {
        setErro(erroDaApi(corpo, "Não deu para usar o pacote pronto agora."));
        return;
      }
      setGravada({ turmaId, id, resumo: `${nome} · pacote pronto da Unooria, sem IA · já em andamento na turma`, noAr: true });
    } catch {
      setErro({ mensagem: SEM_REDE, erros: [] });
    } finally {
      setUsando(null);
    }
  }

  async function gerar(turmaId: string) {
    setTentouGerar(true);
    if (problemas.length > 0) return;
    setGerando(true);
    setErro(null);
    setSemIa(null);
    try {
      const r = await fetch(`${BFF(turmaId)}/gerar-conteudo`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          disciplina: recorte.disciplina,
          tema: recorte.tema.trim(),
          palavras,
          nota: recorte.nota.trim() || null,
        }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setErro(erroDaApi(corpo, "Não deu para gerar agora. Os pacotes prontos continuam disponíveis."));
        return;
      }
      const resposta = corpo as RespostaDoGerar;
      setRascunho(resposta.rascunho);
      setGeracao((n) => n + 1);
      setSemIa(resposta.usouIa ? null : (resposta.motivo ?? "indisponivel"));
    } catch {
      setErro({ mensagem: SEM_REDE, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (!gravada) return { ok: false, mensagem: "Escolha um pacote pronto ou aprove a cena gerada no passo Conteúdo.", erros: [] };
    if (gravada.turmaId !== turmaId) {
      return { ok: false, mensagem: "Esta atividade foi preparada para outra turma. Volte a ela, ou prepare de novo para esta.", erros: [] };
    }
    return { ok: true, id: gravada.id };
  }

  function recomecar() {
    setGravada(null);
    setErro(null);
  }

  return (
    <AssistenteDeAtividade
      expId="exp02ef1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={gravada !== null}
      resumoDoConteudo={gravada?.resumo ?? null}
      rotuloDoCriar={(porNoAr) => (porNoAr ? "Criar e usar esta atividade agora" : "Criar atividade")}
      criar={criar}
      conteudo={(turmaId) => {
        const dados = preparo?.turmaId === turmaId ? preparo.dados : undefined;
        return (
          <section className="flex flex-col gap-4" data-preparo-enigma>
            <LerPreparo key={`${turmaId}-${tentativa}`} turmaId={turmaId} aoLer={setPreparo} />
            {dados === undefined ? (
              <Card variant="outlined">
                <ProgressBar indeterminate label="Abrindo o preparo da turma..." valuePosition="none" />
              </Card>
            ) : dados === null ? (
              <div className="flex flex-col gap-3">
                <EmptyState
                  variant="no-data"
                  size="md"
                  bordered
                  fullWidth
                  title="Não conseguimos abrir o preparo desta turma"
                  description="Confira se a turma é sua e desta escola, e tente de novo."
                />
                <div>
                  <Button variant="secondary" size="sm" onClick={() => { setPreparo(null); setTentativa((n) => n + 1); }}>
                    Tentar de novo
                  </Button>
                </div>
              </div>
            ) : gravada ? (
              <Card variant="outlined" title="O Enigma da Capa da Rádio">
                <div className="flex flex-col gap-3" data-fase="gravada">
                  {gravada.turmaId !== turmaId ? (
                    <FeedbackAlert
                      type="warning"
                      description="Esta atividade foi preparada para outra turma. Volte à turma anterior, ou prepare de novo para esta."
                    />
                  ) : (
                    <FeedbackAlert
                      type="success"
                      title="Atividade pronta"
                      description={
                        gravada.noAr
                          ? `${gravada.resumo}. O pacote pronto entra em andamento no mesmo toque: continue para as equipes, e deixe ligado “Pôr esta atividade no ar agora” para liberar a missão na sala de aula.`
                          : `${gravada.resumo}. Continue para as equipes; no último passo, você escolhe se a turma já usa esta atividade agora.`
                      }
                    />
                  )}
                  <div>
                    <Button variant="ghost" size="sm" onClick={recomecar} data-acao="recomecar-preparo">
                      Escolher outro conteúdo
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                <Card variant="elevated">
                  <div className="flex flex-col gap-4">
                    <SectionHeader
                      title="O espaço das fotos — 2º ano"
                      description="Use um pacote pronto em um toque, ou gere com IA um espaço da sua disciplina. As fotos, a moldura e a mecânica são as mesmas em todos."
                    />
                    {/* O CAMINHO CURTO (one-pager §9a): o botão principal, antes de qualquer campo. */}
                    <div className="flex flex-col items-start gap-3 rounded-lg border border-unooria-neutral-200 p-4" data-caminho-curto>
                      <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
                        A Biblioteca Escolar é o banco padrão da missão: a mesa de leitura e o tapete com fantoches, o
                        relógio das 14:15 e o cartaz amarelo no fundo. Um toque e a atividade fica pronta, sem IA.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {CHAVES_PRONTAS.map((chave) => {
                          const pronto = dados.prontos.find((p) => p.chave === chave);
                          if (!pronto) return null;
                          return (
                            <Button
                              key={chave}
                              variant={chave === "biblioteca" ? "primary" : "secondary"}
                              size="md"
                              leftIcon={<Icon name={chave === "biblioteca" ? "local_library" : chave === "horta" ? "yard" : "museum"} size={18} />}
                              isDisabled={ocupado}
                              isLoading={usando === chave}
                              onClick={() => void usarPronto(turmaId, chave, pronto.nome)}
                              data-acao={`usar-pronto-${chave}`}
                            >
                              {ROTULO_DO_PRONTO[chave]}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3" data-gerar-com-ia>
                      <h3 className="text-[15px] font-semibold text-unooria-neutral-950">Ou gere com IA um espaço da sua disciplina</h3>
                      <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
                        A inteligência artificial desenha a cena e escreve os selos e as falas da visitante.{" "}
                        <strong>Nada chega à turma sem a sua aprovação</strong> — e você mesmo marca, na imagem, os dois
                        objetos iguais do fundo.
                      </p>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Selection
                          label="Componente curricular"
                          placeholder="Selecione"
                          value={recorte.disciplina || undefined}
                          showOptionCheckbox={false}
                          options={dados.disciplinas.map((d) => ({ value: d.slug, label: d.rotulo }))}
                          onChange={(valor) => trocar("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : String(valor))}
                        />
                        <TextField
                          label={`Tema (até ${TEMA.max} caracteres)`}
                          placeholder="Exemplo: A horta da escola e o cuidado com as plantas"
                          value={recorte.tema}
                          maxLength={TEMA.max}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("tema", e.target.value)}
                        />
                        <TextField
                          label="Palavras-chave (3 a 6, separadas por vírgula)"
                          placeholder="Exemplo: horta, plantas, adubo"
                          helperText={`${palavras.length} ${palavras.length === 1 ? "palavra" : "palavras"}`}
                          value={recorte.palavrasTexto}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("palavrasTexto", e.target.value)}
                        />
                        <TextArea
                          label={`Nota sobre a turma (opcional, até ${NOTA_MAX} caracteres)`}
                          placeholder="Exemplo: a turma cuida da horta às sextas."
                          rows={2}
                          value={recorte.nota}
                          maxLength={NOTA_MAX}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocar("nota", e.target.value)}
                        />
                      </div>
                      <div>
                        <Button
                          variant="secondary"
                          size="md"
                          leftIcon={<Icon name="auto_awesome" size={18} />}
                          isDisabled={ocupado}
                          isLoading={gerando}
                          onClick={() => void gerar(turmaId)}
                          data-acao="gerar-com-ia"
                        >
                          Gerar com IA
                        </Button>
                      </div>
                      {tentouGerar && problemas.length > 0 ? (
                        <FeedbackAlert type="warning" description={`Para gerar, ajuste: ${problemas.join(" ")}`} />
                      ) : null}
                      {gerando ? (
                        <div className="flex flex-col gap-2" role="status" data-gerando>
                          <ProgressBar indeterminate label={TEXTO_DA_GERACAO} valuePosition="none" />
                          <p className="text-[12px] text-unooria-neutral-600">A cena leva até um minuto para ficar pronta.</p>
                        </div>
                      ) : null}
                      {semIa ? (
                        <div data-aviso-sem-ia={semIa}>
                          <FeedbackAlert type="warning" title={AVISO_SEM_IA[semIa].titulo} description={AVISO_SEM_IA[semIa].descricao} />
                        </div>
                      ) : null}
                    </div>
                    {erro ? <ErroDaApi erro={erro} /> : null}
                  </div>
                </Card>

                {rascunho ? (
                  <Curadoria
                    key={`${rascunho.id}-${geracao}`}
                    turmaId={turmaId}
                    rascunho={rascunho}
                    baseDoBundle={baseDoBundle}
                    ocupado={ocupado}
                    aoMudarRascunho={setRascunho}
                    gerarNovamente={() => void gerar(turmaId)}
                    aoAprovar={(id) => setGravada({ turmaId, id, resumo: `“${rascunho.tema}” · ${rascunho.conteudo.cena.espaco} · ${rascunho.origem === "ia" ? "gerada com IA e aprovada por você" : "pacote pronto da disciplina"}`, noAr: false })}
                  />
                ) : null}
              </>
            )}
          </section>
        );
      }}
    />
  );
}

function ErroDaApi({ erro }: { erro: { mensagem: string; erros: string[] } }) {
  return (
    <FeedbackAlert
      type="error"
      description={
        erro.erros.length > 0 ? (
          <span className="flex flex-col gap-1">
            <span>{erro.mensagem}</span>
            <ul className="list-disc pl-5">
              {erro.erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </span>
        ) : (
          erro.mensagem
        )
      }
    />
  );
}

/**
 * A CURADORIA do rascunho: a cena, os selos, as falas e a marcação dos dois
 * objetos iguais. A `key` no rascunho remonta a peça a cada geração — as
 * edições e os toques são de UMA cena.
 */
function Curadoria({
  turmaId,
  rascunho,
  baseDoBundle,
  ocupado,
  aoMudarRascunho,
  gerarNovamente,
  aoAprovar,
}: {
  turmaId: string;
  rascunho: PacoteDoProfessor;
  baseDoBundle: string | null;
  ocupado: boolean;
  aoMudarRascunho: (r: PacoteDoProfessor) => void;
  gerarNovamente: () => void;
  aoAprovar: (id: string) => void;
}) {
  const cena = rascunho.conteudo.cena;
  const jaMarcados = cena.invariantes.every((i) => i.alvo !== null);
  const [marcando, setMarcando] = useState(!jaMarcados);
  const [toques, setToques] = useState<Partial<Record<InvarianteId, { x: number; y: number }>>>({});
  const [selos, setSelos] = useState<SeloDaCena[]>(() => cena.selos.map((s) => ({ ...s })));
  const [falas, setFalas] = useState(() => cena.fotos.map((f) => ({ fotoId: f.id, visitante: f.visitante })));
  const [enviando, setEnviando] = useState<"marcar" | "aprovar" | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; erros: string[] } | null>(null);

  const proximo = marcando ? cena.invariantes.find((i) => !toques[i.id]) ?? null : null;
  const marcas: MarcaNaCena[] = marcando
    ? cena.invariantes.flatMap((i) => {
        const t = toques[i.id];
        return t ? [{ id: i.id, nome: i.nome, alvo: { ...t, r: RAIO_PADRAO } }] : [];
      })
    : marcasDoConteudo(rascunho.conteudo);
  const foraDaFaixa = marcas.filter((m) => !alvoNaFaixaComum(m.alvo.x, m.alvo.r));
  const textosValidos = selos.every((s) => s.texto.trim().length > 0) && falas.every((f) => f.visitante.trim().length > 0);
  const podeAprovar = !marcando && rascunho.pendencias.length === 0 && textosValidos && !ocupado && enviando === null;

  async function enviarToques(completos: Partial<Record<InvarianteId, { x: number; y: number }>>) {
    setEnviando("marcar");
    setErro(null);
    try {
      const alvos = cena.invariantes.map((i) => ({ id: i.id, ...(completos[i.id] as { x: number; y: number }) }));
      const r = await fetch(`${BFF(turmaId)}/rascunho/invariantes`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ alvos }) });
      const corpo: unknown = await r.json().catch(() => null);
      const novo = r.ok ? rascunhoDaResposta(corpo) : null;
      if (!novo) {
        setErro(erroDaApi(corpo, "Não deu para gravar as marcações. Toque de novo."));
        setToques({});
        return;
      }
      setMarcando(false);
      setToques({});
      aoMudarRascunho(novo);
    } catch {
      setErro({ mensagem: SEM_REDE, erros: [] });
      setToques({});
    } finally {
      setEnviando(null);
    }
  }

  function tocar(ponto: { x: number; y: number }) {
    if (!proximo || enviando) return;
    const novos = { ...toques, [proximo.id]: ponto };
    setToques(novos);
    if (cena.invariantes.every((i) => novos[i.id])) void enviarToques(novos);
  }

  function refazer() {
    setToques({});
    setMarcando(true);
    setErro(null);
  }

  async function aprovar() {
    setEnviando("aprovar");
    setErro(null);
    try {
      const r = await fetch(`${BFF(turmaId)}/homologar`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          rascunhoId: rascunho.id,
          selos: selos.map((s) => ({ ...s, texto: s.texto.trim() })),
          falas: falas.map((f) => ({ ...f, visitante: f.visitante.trim() })),
        }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      const id = r.ok ? idDaAtividade(corpo) : null;
      if (!id) {
        setErro(erroDaApi(corpo, "Não deu para aprovar a atividade agora."));
        return;
      }
      aoAprovar(id);
    } catch {
      setErro({ mensagem: SEM_REDE, erros: [] });
    } finally {
      setEnviando(null);
    }
  }

  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-5" data-curadoria data-rascunho={rascunho.id}>
        <SectionHeader
          title={`Curadoria — ${cena.espaco}`}
          badge={
            <Tag variant={rascunho.origem === "ia" ? "info" : "success"} size="sm" pill>
              {rascunho.origem === "ia" ? "Gerada com IA" : "Pacote pronto"}
            </Tag>
          }
          description="Confira a cena, as duas fotos, os selos e o que a visitante diz. Marque os dois objetos iguais do fundo e aprove."
        />

        <div className="flex flex-col gap-2" data-marcacao={marcando ? "marcando" : "marcada"}>
          {proximo ? (
            <p className="text-[15px] font-bold text-unooria-neutral-950" role="status" data-toque-pedido={proximo.id}>
              {`Toque no ${proximo.nome} na imagem`}
            </p>
          ) : marcando ? (
            <p className="text-[13px] text-unooria-neutral-700" role="status">Gravando as marcações…</p>
          ) : (
            <p className="text-[13px] text-unooria-neutral-700">
              Os círculos amarelos são os dois objetos iguais que a criança vai procurar nas duas fotos.
            </p>
          )}
          <CenaDoEnigma
            conteudo={rascunho.conteudo}
            baseDoBundle={baseDoBundle}
            marcas={marcas}
            aoTocar={proximo && !enviando ? tocar : undefined}
            rotuloDoToque={proximo ? `Toque no ${proximo.nome} na imagem` : undefined}
          />
          {foraDaFaixa.length > 0 ? (
            <FeedbackAlert
              type="warning"
              description={`${foraDaFaixa.map((m) => m.nome).join(" e ")} ficou fora da faixa do meio, que aparece nas duas fotos. Os dois objetos precisam estar na parede do meio — refaça a marcação ou gere novamente.`}
            />
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" leftIcon={<Icon name="restart_alt" size={18} />} isDisabled={ocupado || enviando !== null} onClick={refazer} data-acao="refazer-marcacao">
              Refazer as marcações
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<Icon name="autorenew" size={18} />} isDisabled={ocupado || enviando !== null} onClick={gerarNovamente} data-acao="gerar-novamente">
              GERAR NOVAMENTE
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {cena.fotos.map((foto, i) => {
            const fala = falas[i];
            const selo = cena.selos.find((s) => s.id === foto.seloCoerente);
            return (
              <div key={foto.id} className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3" data-foto={foto.id}>
                <strong className="text-[14px] text-unooria-neutral-950">{`FOTO ${i + 1} — ${foto.acao}`}</strong>
                <p className="text-[12px] text-unooria-neutral-600">{`O selo que combina com ela: ${selo ? `${selo.emoji} ${selo.texto}` : "—"}`}</p>
                <TextField
                  label="O que a visitante diz quando a ação aparece na capa"
                  maxLength={80}
                  value={fala?.visitante ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const v = e.target.value;
                    setFalas((atual) => atual.map((f, j) => (j === i ? { ...f, visitante: v } : f)));
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-unooria-neutral-950">Os dois selos (CAIXA ALTA, até 3 palavras)</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {selos.map((s, i) => (
              <TextField
                key={s.id}
                label={`Selo ${i + 1} ${s.emoji}`}
                maxLength={40}
                value={s.texto}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value.toUpperCase();
                  setSelos((atual) => atual.map((x, j) => (j === i ? { ...x, texto: v } : x)));
                }}
              />
            ))}
          </div>
        </div>

        {rascunho.pendencias.length > 0 && !marcando ? (
          <FeedbackAlert
            type="warning"
            title="O que falta para aprovar"
            description={
              <ul className="list-disc pl-5">
                {rascunho.pendencias.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            }
          />
        ) : null}
        {erro ? <ErroDaApi erro={erro} /> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="md" isDisabled={!podeAprovar} isLoading={enviando === "aprovar"} onClick={() => void aprovar()} data-acao="aprovar-atividade">
            Aprovar atividade
          </Button>
          <p className="text-[12px] text-unooria-neutral-600">
            {marcando ? "Marque os dois objetos iguais para aprovar." : "Aprovada, a atividade fica pronta; você escolhe quando a turma usa."}
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Lê o preparo da turma (`GET …/pacote`) — a `key` com a turma e a tentativa faz cada troca ser uma leitura nova. */
function LerPreparo({ turmaId, aoLer }: { turmaId: string; aoLer: (lido: PreparoLido) => void }) {
  useEffect(() => {
    let vivo = true;
    void (async () => {
      let dados: PacoteDaTurma | null;
      try {
        const r = await fetch(`${BFF(turmaId)}/pacote`, { cache: "no-store" });
        dados = r.ok ? ((await r.json()) as PacoteDaTurma) : null;
      } catch {
        dados = null;
      }
      if (vivo) aoLer({ turmaId, dados });
    })();
    return () => {
      vivo = false;
    };
  }, [turmaId, aoLer]);
  return null;
}
