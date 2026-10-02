"use client";

import { useState } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar, Selection, Tag, TextArea, TextField } from "@edu/ui/ds";
import {
  AssistenteDeAtividade,
  type ResultadoDaCriacao,
  type TurmaDoAssistente,
} from "@/components/atividades/assistente-de-atividade";
import {
  DISCIPLINAS,
  PARAMETROS,
  PARAMETROS_VAZIOS,
  ROTULO_DA_DISCIPLINA,
  TOTAL_DE_PROJETOS,
  caminhoDaTurma,
  conteudoCompleto,
  corpoDosParametros,
  distribuirErros,
  erroDaResposta,
  estandesPorArea,
  falhaDaIa,
  normalizarConteudo,
  parametrosNaTela,
  problemasDosParametros,
  problemasPorCampo,
  rotuloCurtoDaArea,
  rotuloDaDisciplina,
  type ConteudoDoPacote,
  type PacoteHomologado,
  type ParametrosNaTela,
  type ProjetoDoPacote,
  type ProjetoRegenerado,
  type RascunhoDoPacote,
} from "@/lib/juri-estadual-tipos";

import { CartaoDoEstande, EditorDoEstande } from "../../resultados/estande-do-preparo";

/** A copy revisada (§1, E0-PROF-02 a 04), no que ela sobreviveu à criação. A suíte e2e casa por texto exato. */
const COPY = {
  titulo: "Configuração Pedagógica da Mostra",
  rotuloDaDisciplina: "Componente Curricular",
  ajudaDaDisciplina: "Selecione a matéria para contextualizar os 16 estandes da mostra científica.",
  rotuloDoTema: "Tema Geral da Feira",
  exemploDoTema: "Exemplo: Feira de Inovações para a Comunidade Escolar.",
  rotuloDosAssuntos: "Objetos de Conhecimento da Aula",
  ajudaDosAssuntos: "Liste de 3 a 6 tópicos trabalhados nesta semana para distribuir nas 4 áreas.",
  rotuloDoContexto: "Contexto da escola (opcional)",
  exemploDoContexto: "Exemplo: escola em área rural, perto de um rio.",
  gerar: "Gerar Mostra Personalizada com IA",
  gerando: "Organizando os 16 estandes da feira com inteligência artificial...",
  espera: "Isso pode levar perto de um minuto. Aguarde a montagem das categorias.",
  tituloDaCuradoria: "Curadoria da Mostra: 16 Estandes",
  instrucaoDaCuradoria:
    "Revise os títulos e os textos das postagens. Use Editar estande para mudar qualquer um, ou Regenerar estande para pedir outro.",
  /* Sem banco padrão nesta missão (decisão de 2026-10-02): a frase não oferece saída que não existe. */
  semSaldo:
    "Limite de geração com IA atingido por hoje. Esta missão não tem mostra pronta: a atividade pode ser criada quando o saldo voltar.",
  falhaDaIa: "O serviço de geração automática oscilou. Tente novamente em instantes.",
} as const;

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

type Aviso = { tipo: "success" | "warning" | "info"; texto: string };

/** De onde veio a falha da IA — é o que o "Tentar de novo" repete. */
type FalhaDaIa = { tipo: "sem-saldo" | "indisponivel"; de: "gerar" | string };

/**
 * NOVA ATIVIDADE do JÚRI ESTADUAL DE PROJETOS (ADR-130): o preparo da mostra é
 * o passo de conteúdo da criação, no molde do Jornal da Escola
 * (`criar-jornal-escola.tsx`). A missão é o esqueleto (o feed, a cédula, a
 * galeria, os pacotes, a cadeia, Mariana); o PACOTE — os dezesseis estandes
 * em quatro áreas, sobre o tema do professor — é a atividade.
 *
 * O caminho, na ordem da tela:
 *
 * 1. **parametrizar** — componente curricular (as nove disciplinas da missão),
 *    tema, assuntos e, se quiser, o contexto da escola;
 * 2. **gerar com IA** (`gerar-conteudo`), com a espera à vista. O 429 diz que
 *    o saldo acabou e NÃO oferece banco padrão — a missão não tem um (decisão
 *    de 2026-10-02); o 503 oferece tentar de novo;
 * 3. **curar** os dezesseis estandes, em quatro grupos (um por área): editar
 *    título, legenda e bastidor, e regenerar um estande (`regenerar-projeto`),
 *    que sem IA devolve o estande como estava;
 * 4. **homologar** — é o "Criar atividade" do assistente (`criar` →
 *    `homologar`). A atividade nasce PRONTA, e o último passo pergunta se ela
 *    já entra em andamento.
 *
 * E as IMAGENS? São do pacote GRAVADO, como no Jornal: geram-se na página da
 * atividade (`resultados/imagens-do-juri.tsx`), para onde o assistente leva
 * logo depois de criar. Gerar para um rascunho gastaria a quota à toa.
 *
 * `gerar-conteudo` e `regenerar-projeto` NÃO persistem: o rascunho vive aqui, e
 * só `homologar` grava. O `pacote-invalido` traz a lista de problemas em
 * frases; as que citam um estande (`proj-b2`) vão para o cartão dele.
 */
export function CriarJuriEstadual({
  turmas,
  turmaInicial,
  rotaDaMissao,
}: {
  turmas: TurmaDoAssistente[];
  turmaInicial: string;
  rotaDaMissao: string;
}) {
  const [parametros, setParametros] = useState<ParametrosNaTela>(PARAMETROS_VAZIOS);
  const [conteudo, setConteudo] = useState<ConteudoDoPacote | null>(null);
  /* O tema para o qual OS ESTANDES NA TELA foram escritos. Trocar o texto do
     tema sem gerar de novo deixaria a mostra falando de outro assunto. */
  const [temaDosEstandes, setTemaDosEstandes] = useState("");
  const [editando, setEditando] = useState<string | null>(null);

  const [gerando, setGerando] = useState(false);
  const [regenerando, setRegenerando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [falha, setFalha] = useState<FalhaDaIa | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; erros: string[] } | null>(null);

  const errosDosParametros = problemasDosParametros(parametros);
  const parametrosValidos = Object.keys(errosDosParametros).length === 0;
  const completo = conteudoCompleto(conteudo);
  const hashtagDaArea = new Map((conteudo?.categorias ?? []).map((c) => [c.area, c.hashtag] as const));
  const problemasDeCampo = new Map(
    (conteudo?.projetos ?? []).map((p) => [p.id, problemasPorCampo(p, hashtagDaArea.get(p.area))] as const),
  );
  const comProblema = (conteudo?.projetos ?? []).filter((p) => Object.keys(problemasDeCampo.get(p.id) ?? {}).length > 0);
  const errosDaApi = distribuirErros(erro?.erros ?? []);
  const pronto = completo && parametrosValidos && comProblema.length === 0;
  const ocupado = gerando || regenerando !== null;
  const emEdicao = editando ? (conteudo?.projetos.find((p) => p.id === editando) ?? null) : null;
  /* A criação nasce vazia: o erro de um campo só aparece depois que o
     professor escreveu nele — campo vazio de saída não é engano dele. */
  const erroDoCampo = (campo: "tema" | "assuntos" | "contexto") => (parametros[campo] ? errosDosParametros[campo] : undefined);

  function limparRecados() {
    setErro(null);
    setAviso(null);
    setFalha(null);
  }

  function trocarParametro(campo: keyof ParametrosNaTela, valor: string) {
    setParametros((atual) => ({ ...atual, [campo]: valor }));
  }

  function trocarProjeto(novo: ProjetoDoPacote) {
    setConteudo((atual) => (atual ? { ...atual, projetos: atual.projetos.map((p) => (p.id === novo.id ? novo : p)) } : atual));
  }

  async function gerar(turmaId: string) {
    if (!parametrosValidos) return;
    setGerando(true);
    limparRecados();
    try {
      const r = await fetch(`/api/plataforma${caminhoDaTurma(turmaId)}/gerar-conteudo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpoDosParametros(parametros)),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { codigo, mensagem } = erroDaResposta(corpo, "O gerador não respondeu. Tente de novo.");
        const tipo = falhaDaIa(r.status, codigo);
        if (tipo) setFalha({ tipo, de: "gerar" });
        else setErro({ mensagem, erros: [] });
        return;
      }
      const rascunho = corpo as RascunhoDoPacote;
      setParametros(parametrosNaTela(rascunho.parametros));
      setConteudo(rascunho.conteudo);
      setTemaDosEstandes(rascunho.parametros.tema);
      setEditando(null);
      setAviso({
        tipo: "success",
        texto:
          "Mostra gerada. Leia os 16 estandes e edite o que quiser antes de criar a atividade — nada vai à turma sem o seu clique.",
      });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setGerando(false);
    }
  }

  async function regenerar(turmaId: string, projetoId: string) {
    if (!conteudo) return;
    if (!parametrosValidos) {
      setErro({ mensagem: "Para regenerar um estande, preencha o componente curricular, o tema e os assuntos acima.", erros: [] });
      return;
    }
    setRegenerando(projetoId);
    limparRecados();
    try {
      const r = await fetch(`/api/plataforma${caminhoDaTurma(turmaId)}/regenerar-projeto`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...corpoDosParametros(parametros), conteudo: normalizarConteudo(conteudo), projetoId }),
      });
      const corpo: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const { codigo, mensagem } = erroDaResposta(corpo, "Não deu para regenerar agora. Tente de novo em instantes.");
        const tipo = falhaDaIa(r.status, codigo);
        if (tipo) setFalha({ tipo, de: projetoId });
        else setErro({ mensagem, erros: [] });
        return;
      }
      const { projeto, usouIa } = corpo as ProjetoRegenerado;
      if (!usouIa) {
        setAviso({ tipo: "warning", texto: "A inteligência artificial não respondeu desta vez, e o estande ficou como estava." });
        return;
      }
      trocarProjeto({ ...projeto, id: projetoId });
      setAviso({ tipo: "success", texto: "Estande regenerado. Leia de novo antes de criar a atividade." });
    } catch {
      setErro({ mensagem: SEM_CONEXAO, erros: [] });
    } finally {
      setRegenerando(null);
    }
  }

  function repetirAposFalha(turmaId: string) {
    if (!falha) return;
    if (falha.de === "gerar") void gerar(turmaId);
    else void regenerar(turmaId, falha.de);
  }

  async function criar(turmaId: string): Promise<ResultadoDaCriacao> {
    if (!conteudo) return { ok: false, mensagem: "Gere a mostra antes de criar a atividade.", erros: [] };
    const r = await fetch(`/api/plataforma${caminhoDaTurma(turmaId)}/homologar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parametros: corpoDosParametros(parametros), conteudo: normalizarConteudo(conteudo) }),
    });
    if (!r.ok) {
      const { mensagem, erros } = erroDaResposta(await r.json().catch(() => null), "Não deu para criar a atividade agora.");
      setErro({ mensagem, erros });
      return { ok: false, mensagem, erros };
    }
    const criado = (await r.json()) as PacoteHomologado;
    return { ok: true, id: criado.id };
  }

  return (
    <AssistenteDeAtividade
      expId="exp06ef1b"
      rotaDaMissao={rotaDaMissao}
      turmas={turmas}
      turmaInicial={turmaInicial}
      conteudoPronto={pronto}
      resumoDoConteudo={
        completo && conteudo
          ? `“${conteudo.tema.trim()}” · ${rotuloDaDisciplina(parametros.disciplina)} · ${TOTAL_DE_PROJETOS} estandes em 4 áreas`
          : null
      }
      criar={criar}
      conteudo={(turmaId) => (
        <Card variant="outlined" title={COPY.titulo}>
          <div className="flex flex-col gap-5" data-preparo-juri>
            <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
              A inteligência artificial escreve os 16 estandes da mostra sobre o tema da sua aula, em quatro áreas.
              Esta missão não tem mostra pronta: sem gerar, não há atividade.{" "}
              <strong>Nenhum texto gerado por inteligência artificial é exibido aos estudantes sem a sua aprovação.</strong>
            </p>

            {/* ─────────────────────────────────── os parâmetros ───── */}
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 lg:grid-cols-2">
                <Selection
                  label={COPY.rotuloDaDisciplina}
                  helperText={COPY.ajudaDaDisciplina}
                  placeholder="Selecione"
                  value={parametros.disciplina || undefined}
                  showOptionCheckbox={false}
                  options={DISCIPLINAS.map((d) => ({ value: d, label: ROTULO_DA_DISCIPLINA[d] }))}
                  onChange={(valor) => trocarParametro("disciplina", Array.isArray(valor) ? (valor[0] ?? "") : String(valor))}
                />
                <TextField
                  label={COPY.rotuloDoTema}
                  placeholder={COPY.exemploDoTema}
                  helperText={erroDoCampo("tema") ? undefined : `De ${PARAMETROS.tema.min} a ${PARAMETROS.tema.max} caracteres.`}
                  value={parametros.tema}
                  maxLength={PARAMETROS.tema.max}
                  error={erroDoCampo("tema")}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarParametro("tema", e.target.value)}
                />
              </div>
              <TextArea
                label={COPY.rotuloDosAssuntos}
                helperText={erroDoCampo("assuntos") ? undefined : COPY.ajudaDosAssuntos}
                value={parametros.assuntos}
                rows={3}
                maxLength={PARAMETROS.assuntos.max}
                error={erroDoCampo("assuntos")}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => trocarParametro("assuntos", e.target.value)}
              />
              <TextField
                label={COPY.rotuloDoContexto}
                placeholder={COPY.exemploDoContexto}
                helperText={erroDoCampo("contexto") ? undefined : `Até ${PARAMETROS.contextoMax} caracteres. Sem nome de pessoa nem de escola real.`}
                value={parametros.contexto}
                maxLength={PARAMETROS.contextoMax}
                error={erroDoCampo("contexto")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => trocarParametro("contexto", e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="ai"
                  size="sm"
                  leftIcon={<Icon name="auto_awesome" size={18} />}
                  onClick={() => void gerar(turmaId)}
                  isDisabled={ocupado || !parametrosValidos}
                  data-acao="gerar-mostra"
                >
                  {gerando ? "Gerando…" : COPY.gerar}
                </Button>
              </div>
              {gerando ? (
                <div className="flex flex-col gap-1" data-gerando-mostra>
                  <ProgressBar indeterminate label={COPY.gerando} variant="brand" />
                  <p className="text-[12px] text-unooria-neutral-600">{COPY.espera}</p>
                </div>
              ) : null}
              {completo && parametros.tema.trim() !== temaDosEstandes.trim() && !errosDosParametros.tema ? (
                <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
                  O tema mudou, mas os estandes na tela ainda falam de “{temaDosEstandes}”. Clique em {COPY.gerar} para
                  escrevê-los sobre o tema novo — ou siga sabendo que a mostra continua sobre o anterior.
                </p>
              ) : null}
            </div>

            {falha ? (
              <div data-falha-da-ia={falha.tipo}>
                <FeedbackAlert
                  type={falha.tipo === "sem-saldo" ? "warning" : "error"}
                  description={falha.tipo === "sem-saldo" ? COPY.semSaldo : COPY.falhaDaIa}
                  action={
                    falha.tipo === "indisponivel" ? (
                      <Button variant="secondary" size="sm" onClick={() => repetirAposFalha(turmaId)} isDisabled={ocupado}>
                        Tentar de novo
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : null}
            {aviso ? <FeedbackAlert type={aviso.tipo} description={aviso.texto} /> : null}
            {erro ? (
              <FeedbackAlert
                type="error"
                description={
                  errosDaApi.geral.length > 0 || Object.keys(errosDaApi.porProjeto).length > 0 ? (
                    <span className="flex flex-col gap-1">
                      <span>{erro.mensagem}</span>
                      {errosDaApi.geral.length > 0 ? (
                        <ul className="list-disc pl-5">
                          {errosDaApi.geral.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : null}
                      {Object.keys(errosDaApi.porProjeto).length > 0 ? <span>Os estandes com ajuste estão marcados abaixo.</span> : null}
                    </span>
                  ) : (
                    erro.mensagem
                  )
                }
              />
            ) : null}

            {/* ─────────────────────────────────── a curadoria ───── */}
            <div className="flex flex-col gap-3 border-t border-unooria-neutral-200 pt-4">
              <p className="text-[14px] font-semibold text-unooria-neutral-950">{COPY.tituloDaCuradoria}</p>
              {!completo || !conteudo ? (
                <p className="text-[12px] leading-snug text-unooria-neutral-600" data-mostra-vazia>
                  Preencha os campos acima e gere a mostra. Os 16 estandes aparecem aqui, em quatro áreas, para você ler
                  e editar.
                </p>
              ) : (
                <>
                  <p className="max-w-3xl text-[13px] leading-snug text-unooria-neutral-700">{COPY.instrucaoDaCuradoria}</p>
                  {/* O "Continuar" apagado sem motivo escrito é o silêncio que a
                      exp05ef1b já pagou: diga o que falta, e onde. */}
                  {!parametrosValidos || comProblema.length > 0 ? (
                    <div className="flex flex-col gap-1 text-[12px] leading-snug text-unooria-danger" role="status">
                      {!parametrosValidos ? <p>Falta o componente curricular, o tema ou os assuntos, nos campos acima.</p> : null}
                      {comProblema.length > 0 ? (
                        <p>
                          {comProblema.length === 1 ? "Um estande precisa" : `${comProblema.length} estandes precisam`} de ajuste.
                          Eles estão marcados abaixo.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-6" data-curadoria-da-mostra>
                    {estandesPorArea(conteudo).map(({ categoria, projetos }) => (
                      <section key={categoria.area} className="flex flex-col gap-3" data-area={categoria.area}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[14px] font-semibold text-unooria-neutral-950">
                            {rotuloCurtoDaArea(categoria.area)} — {categoria.nome}
                          </span>
                          <Tag variant="info" size="sm">
                            {categoria.hashtag}
                          </Tag>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                          {projetos.map((p) => (
                            <CartaoDoEstande
                              key={p.id}
                              projeto={p}
                              problemas={Object.keys(problemasDeCampo.get(p.id) ?? {}).length}
                              errosDaApi={errosDaApi.porProjeto[p.id] ?? []}
                              aoEditar={() => setEditando(p.id)}
                              aoRegenerar={() => void regenerar(turmaId, p.id)}
                              regenerando={regenerando === p.id}
                              ocupado={ocupado}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              )}
            </div>

            {emEdicao && conteudo ? (
              <EditorDoEstande
                projeto={emEdicao}
                categoria={conteudo.categorias.find((c) => c.area === emEdicao.area)}
                problemas={problemasDeCampo.get(emEdicao.id) ?? {}}
                errosDaApi={errosDaApi.porProjeto[emEdicao.id] ?? []}
                aoMudar={trocarProjeto}
                aoFechar={() => setEditando(null)}
                aoRegenerar={() => void regenerar(turmaId, emEdicao.id)}
                regenerando={regenerando === emEdicao.id}
                ocupado={ocupado}
              />
            ) : null}
          </div>
        </Card>
      )}
    />
  );
}
