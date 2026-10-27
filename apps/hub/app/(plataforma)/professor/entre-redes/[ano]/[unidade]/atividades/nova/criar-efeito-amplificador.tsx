"use client";

import { useEffect, useState } from "react";

import { Button, Card, EmptyState, FeedbackAlert, ProgressBar, SectionHeader, Selection, Tag, TextArea, TextField } from "@edu/ui/ds";
import {
  AssistenteDeAtividade,
  type ResultadoDaCriacao,
  type TurmaDoAssistente,
} from "@/components/atividades/assistente-de-atividade";
import {
  AVISO_SEM_IA,
  MANCHETES,
  ROTULO_DA_MANCHETE,
  ROTULO_DO_NO,
  ROTULO_DO_TIPO,
  erroDaApi,
  problemasDoRecorte,
  topicosDoTexto,
  type ConteudoDoPacote,
  type Origem,
  type PacoteDaTurma,
  type PacoteDoProfessor,
  type RespostaDoGerar,
} from "@/lib/efeito-amplificador-tipos";

interface Curadoria {
  origem: Origem;
  conteudo: ConteudoDoPacote;
  de: "rascunho" | "ia" | "padrao";
}

interface PreparoLido {
  turmaId: string;
  dados: PacoteDaTurma | null;
}

interface Recorte {
  disciplina: string;
  tema: string;
  topicosTexto: string;
  contexto: string;
}

const RECORTE_VAZIO: Recorte = { disciplina: "", tema: "", topicosTexto: "", contexto: "" };
const SEM_REDE = "A conexão falhou. Confira a internet e tente de novo.";
/** As duas dicas que se alternam durante a geração (copy do professor, "Dica pedagógica rotativa 1 e 2"). */
const DICAS = [
  "Atenção aos nós críticos: todo pacote gerado conterá uma alucinação factual, um trecho sem crédito e um vazamento de dados de colega.",
  "No Unoovista, o algoritmo impulsionará o post na madrugada (02h30) independentemente do texto, provando que a entrega visa tempo de tela.",
];

const caminhoDaTurma = (turmaId: string) => `/api/plataforma/efeito-amplificador/turmas/${encodeURIComponent(turmaId)}`;

const recorteDoPacote = (p: { disciplina: string; tema: string; assuntos: string[]; contexto?: string | null }): Recorte => ({
  disciplina: p.disciplina,
  tema: p.tema,
  topicosTexto: p.assuntos.join("\n"),
  contexto: p.contexto ?? "",
});

/**
 * NOVA ATIVIDADE de O EFEITO AMPLIFICADOR (ADR-181, ADR-130). O PACOTE — o
 * rascunho do UnooriaAI com os três nós, as manchetes e os comentários da
 * madrugada — é a atividade que a turma vive, e nasce do professor: o Banco
 * Curado Padrão (Convivência Escolar e Celular) ou um tema da disciplina dele
 * gerado com IA (one-pager §9a).
 *
 * **Nada da IA chega à turma sem o clique em "Homologar Pacote"** (o `criar`
 * deste passo), e nem esse clique põe no ar: o último passo do assistente
 * pergunta. A curadoria edita TODO o texto; o gabarito (o nó de cada
 * parágrafo, a categoria de cada comentário) aparece só como etiqueta, porque
 * a régua da api (os três nós, as duas dimensões de saúde, o recorte dentro do
 * trecho copiado) recusa um pacote que perca a mecânica — e devolve TODAS as
 * frases de uma vez.
 */
export function CriarEfeitoAmplificador({
  turmas,
  turmaInicial,
  rotaDaMissao,
}: {
  turmas: TurmaDoAssistente[];
  turmaInicial: string;
  rotaDaMissao: string;
}) {
  const [preparo, setPreparo] = useState<PreparoLido | null>(null);
  const [preparoVisto, setPreparoVisto] = useState<PreparoLido | null>(null);
  const [recorte, setRecorte] = useState<Recorte>(RECORTE_VAZIO);
  const [curadoria, setCuradoria] = useState<Curadoria | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [tentou, setTentou] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [dica, setDica] = useState(0);
  const [semIa, setSemIa] = useState<"sem-saldo" | "indisponivel" | null>(null);
  const [errosDaApi, setErrosDaApi] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  if (preparo !== preparoVisto) {
    setPreparoVisto(preparo);
    const rascunho = preparo?.dados?.rascunho ?? null;
    if (rascunho && !curadoria) {
      setRecorte(recorteDoPacote(rascunho));
      setCuradoria({ origem: rascunho.origem, conteudo: rascunho.conteudo, de: "rascunho" });
    }
  }

  useEffect(() => {
    if (!gerando) return;
    const id = setInterval(() => setDica((i) => (i + 1) % DICAS.length), 4_000);
    return () => clearInterval(id);
  }, [gerando]);

  const topicos = topicosDoTexto(recorte.topicosTexto);
  const problemas = problemasDoRecorte({ ...recorte, topicos });
  const pronto = curadoria !== null && problemas.length === 0;

  function trocar(campo: keyof Recorte, valor: string) {
    setRecorte((atual) => ({ ...atual, [campo]: valor }));
  }

  function mexer(f: (c: ConteudoDoPacote) => ConteudoDoPacote) {
    setCuradoria((atual) => (atual ? { ...atual, conteudo: f(atual.conteudo) } : atual));
    setErrosDaApi([]);
  }

  async function gerar(turmaId: string) {
    setTentou(true);
    if (problemas.length > 0) return;
    setGerando(true);
    setErro(null);
    setSemIa(null);
    setErrosDaApi([]);
    try {
      const r = await fetch(`${caminhoDaTurma(turmaId)}/gerar-conteudo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          disciplina: recorte.disciplina,
          tema: recorte.tema.trim(),
          assuntos: topicos,
          contexto: recorte.contexto.trim() || null,
        }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { mensagem, erros } = erroDaApi(corpo, "Não deu para gerar agora. O Banco Curado Padrão continua disponível.");
        setErrosDaApi(erros);
        setErro(mensagem);
        return;
      }
      const resposta = corpo as RespostaDoGerar;
      /* O recorte VOLTA do rascunho: sem IA, a api devolve o banco curado com o tema DELE. */
      setRecorte(recorteDoPacote(resposta.rascunho));
      setCuradoria({ origem: resposta.rascunho.origem, conteudo: resposta.rascunho.conteudo, de: resposta.usouIa ? "ia" : "padrao" });
      setSemIa(resposta.usouIa ? null : (resposta.motivo ?? "indisponivel"));
    } catch {
      setErro(SEM_REDE);
    } finally {
      setGerando(false);
    }
  }

  function usarPadrao(padrao: PacoteDaTurma["padrao"]) {
    setErro(null);
    setSemIa(null);
    setErrosDaApi([]);
    setRecorte(recorteDoPacote({ ...padrao, contexto: null }));
    setCuradoria({ origem: "padrao", conteudo: structuredClone(padrao.conteudo), de: "padrao" });
  }

  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (!curadoria) return { ok: false, mensagem: "Monte o pacote no passo Conteúdo.", erros: [] };
    setErrosDaApi([]);
    const r = await fetch(`${caminhoDaTurma(turmaId)}/homologar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        disciplina: recorte.disciplina,
        tema: recorte.tema.trim(),
        assuntos: topicos,
        contexto: recorte.contexto.trim() || null,
        origem: curadoria.origem,
        conteudo: curadoria.conteudo,
      }),
    });
    const corpo: unknown = await r.json().catch(() => null);
    if (!r.ok) {
      const { mensagem, erros } = erroDaApi(corpo, "Não deu para homologar o pacote agora.");
      setErrosDaApi(erros);
      return {
        ok: false,
        mensagem: erros.length > 0 ? `${mensagem} Volte ao passo Conteúdo para ver o que ajustar.` : mensagem,
        erros,
      };
    }
    return { ok: true, id: (corpo as PacoteDoProfessor).id };
  }

  return (
    <AssistenteDeAtividade
      expId="exp02em1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={pronto}
      resumoDoConteudo={curadoria ? `“${recorte.tema.trim()}” · ${curadoria.origem === "ia" ? "gerado com IA" : "Banco Curado Padrão"}` : null}
      rotuloDoCriar={(porNoAr) => (porNoAr ? "Homologar Pacote e Iniciar Atividade com a Turma" : "Homologar Pacote")}
      criar={criar}
      conteudo={(turmaId) => {
        const dados = preparo?.turmaId === turmaId ? preparo.dados : undefined;
        return (
          <section className="flex flex-col gap-4" data-preparo>
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
            ) : (
              <>
                <Card variant="elevated">
                  <div className="flex flex-col gap-4">
                    <SectionHeader
                      title="Configuração de Missão — 2º ano do Ensino Médio"
                      description="Defina o tema da aula para gerar o pacote por IA ou ative o banco curado padrão em um clique."
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="secondary" size="md" isDisabled={gerando} onClick={() => usarPadrao(dados.padrao)} data-acao="usar-padrao">
                        {`Usar pacote padrão: ${dados.padrao.nome}`}
                      </Button>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Selection
                        label="Componente Curricular da BNCC"
                        helperText="Selecione um componente da 2ª série do Ensino Médio, Computação ou Projeto Interdisciplinar."
                        placeholder="Selecione"
                        value={recorte.disciplina || undefined}
                        showOptionCheckbox={false}
                        options={dados.disciplinas.map((d) => ({ value: d.slug, label: d.rotulo }))}
                        onChange={(valor) => trocar("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : valor)}
                      />
                      <TextField
                        label="Tema Central da Aula (máximo 60 caracteres)"
                        placeholder="Exemplo: Impacto das Telas no Sono e Ritmo Circadiano."
                        helperText="Ele entra na fala de abertura do UnooriaAI: “Olá, vamos montar seu post para…”."
                        value={recorte.tema}
                        maxLength={60}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("tema", e.target.value)}
                      />
                      <TextArea
                        label="Tópicos da Discussão (3 a 6 itens, um por linha)"
                        placeholder={"Exemplo:\nluz azul\nprivação de sono\nretenção comercial"}
                        helperText={`${topicos.length} ${topicos.length === 1 ? "tópico" : "tópicos"} · ${topicos.join("").length}/600 caracteres`}
                        rows={4}
                        value={recorte.topicosTexto}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocar("topicosTexto", e.target.value)}
                      />
                      <TextField
                        label="Contexto Escolar Local (opcional, máximo 120 caracteres)"
                        placeholder="Exemplo: uso de smartphones durante os intervalos."
                        value={recorte.contexto}
                        maxLength={120}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocar("contexto", e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="primary" size="md" isDisabled={gerando} isLoading={gerando} onClick={() => void gerar(turmaId)} data-acao="gerar-conteudo">
                        Gerar Conteúdo com IA
                      </Button>
                    </div>
                    {tentou && problemas.length > 0 && !curadoria ? (
                      <FeedbackAlert type="warning" description="Preencha o tema e informe entre 3 e 6 tópicos para prosseguir com a geração." />
                    ) : null}
                    {gerando ? (
                      <div className="flex flex-col gap-2" role="status">
                        <ProgressBar indeterminate label="Gerando rascunho de IA e repercussões simuladas..." valuePosition="none" />
                        <p className="text-[12px] text-unooria-neutral-600">{DICAS[dica]}</p>
                      </div>
                    ) : null}
                    {semIa ? <FeedbackAlert type="warning" title={AVISO_SEM_IA[semIa].titulo} description={AVISO_SEM_IA[semIa].descricao} /> : null}
                    {erro ? <FeedbackAlert type="error" description={erro} /> : null}
                  </div>
                </Card>

                {curadoria ? (
                  <Curadoria curadoria={curadoria} mexer={mexer} errosDaApi={errosDaApi} problemasDoRecorte={problemas} />
                ) : null}
              </>
            )}
          </section>
        );
      }}
    />
  );
}

/** A curadoria: o pacote inteiro, editável, com o gabarito só como etiqueta. */
function Curadoria({
  curadoria,
  mexer,
  errosDaApi,
  problemasDoRecorte,
}: {
  curadoria: Curadoria;
  mexer: (f: (c: ConteudoDoPacote) => ConteudoDoPacote) => void;
  errosDaApi: string[];
  problemasDoRecorte: string[];
}) {
  const c = curadoria.conteudo;
  return (
    <Card variant="elevated">
      <div className="flex flex-col gap-5" data-curadoria>
        <SectionHeader
          title="Curadoria do pacote"
          badge={<Tag variant={curadoria.origem === "ia" ? "info" : "success"} size="sm" pill>{curadoria.origem === "ia" ? "Gerado com IA" : "Banco Curado Padrão"}</Tag>}
          description="Revise o rascunho que os estudantes receberão no UnooriaAI e os comentários simulados do Unoovista. Edite os textos se desejar e clique em Homologar Pacote."
        />
        <FeedbackAlert type="info" description="As etiquetas de gabarito (o nó de cada parágrafo e o tipo de cada comentário) não chegam aos estudantes." />

        <div className="flex flex-col gap-3">
          <h3 className="text-[15px] font-semibold text-unooria-neutral-950">Rascunho da Postagem (UnooriaAI)</h3>
          {c.rascunho.map((p, i) => (
            <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3" data-paragrafo={p.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Tag variant={p.no ? "warning" : "neutral"} size="sm" pill>{p.no ? ROTULO_DO_NO[p.no] : `Parágrafo ${i + 1}`}</Tag>
              </div>
              <TextArea
                label={p.no ? "Como o UnooriaAI escreve (o problema)" : "Texto"}
                rows={3}
                value={p.texto}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  const texto = e.target.value;
                  mexer((k) => ({ ...k, rascunho: k.rascunho.map((x) => (x.id === p.id ? { ...x, texto } : x)) }));
                }}
              />
              {p.no ? (
                <TextArea
                  label="Como fica quando o estudante pede a correção"
                  rows={3}
                  value={p.corrigido ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    const corrigido = e.target.value;
                    mexer((k) => ({ ...k, rascunho: k.rascunho.map((x) => (x.id === p.id ? { ...x, corrigido } : x)) }));
                  }}
                />
              ) : null}
            </div>
          ))}
          <div className="grid gap-3 lg:grid-cols-2">
            <TextField label="A fonte inventada (como aparece no texto)" value={c.fonteInventada} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, fonteInventada: v })); }} />
            <TextField label="O colega exposto (como aparece no texto)" value={c.colega} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, colega: v })); }} />
            <TextField label="O veículo copiado (como aparece no texto)" value={c.veiculo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, veiculo: v })); }} />
            <TextField
              label="A frase que o algoritmo pinça"
              helperText="Precisa estar dentro do trecho copiado, no original e na correção: o cuidado do estudante não a tira do post."
              value={c.recorte}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, recorte: v })); }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-[15px] font-semibold text-unooria-neutral-950">Manchetes de capa</h3>
          {MANCHETES.map((m) => (
            <TextField
              key={m}
              label={ROTULO_DA_MANCHETE[m]}
              maxLength={80}
              value={c.manchetes[m]}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value; mexer((k) => ({ ...k, manchetes: { ...k.manchetes, [m]: v } })); }}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-[15px] font-semibold text-unooria-neutral-950">Comentários Simulados Noturnos (Unoovista)</h3>
          {c.comentarios.map((com) => (
            <div key={com.id} className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3" data-comentario={com.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Tag variant="neutral" size="sm" pill>{ROTULO_DO_TIPO[com.tipo]}</Tag>
                <span className="text-[12px] text-unooria-neutral-600">{`${com.handle} · ${com.horario}`}</span>
              </div>
              <TextArea
                label={com.autor}
                rows={2}
                value={com.texto}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  const texto = e.target.value;
                  mexer((k) => ({ ...k, comentarios: k.comentarios.map((x) => (x.id === com.id ? { ...x, texto } : x)) }));
                }}
              />
            </div>
          ))}
        </div>

        {errosDaApi.length > 0 ? (
          <FeedbackAlert
            type="error"
            title="O que a plataforma recusou no pacote"
            description={
              <ul className="list-disc pl-5">
                {errosDaApi.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            }
          />
        ) : null}
        {problemasDoRecorte.length > 0 ? (
          <p className="text-[12px] leading-snug text-unooria-danger" role="status">{`Para continuar, ajuste: ${problemasDoRecorte.join(" ")}`}</p>
        ) : (
          <p className="text-[12px] leading-snug text-unooria-neutral-600">
            O pacote está pronto. Em Continuar, você monta as equipes; a homologação acontece no último passo.
          </p>
        )}
      </div>
    </Card>
  );
}

/** Lê o preparo da turma (`GET .../pacote`) — a `key` com a turma e a tentativa faz cada troca ser uma leitura nova. */
function LerPreparo({ turmaId, aoLer }: { turmaId: string; aoLer: (lido: PreparoLido) => void }) {
  useEffect(() => {
    let vivo = true;
    void (async () => {
      let dados: PacoteDaTurma | null;
      try {
        const r = await fetch(`${caminhoDaTurma(turmaId)}/pacote`, { cache: "no-store" });
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
